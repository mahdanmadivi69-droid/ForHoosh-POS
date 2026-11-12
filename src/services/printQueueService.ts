/**
 * CAFE OS — Bulletproof ESC/POS Thermal Print Queue Service
 *
 * Guarantees:
 * 1. Non-Blocking: enqueueing a receipt NEVER blocks or fails checkout — the
 *    order is already saved atomically in Dexie before a job is created, and
 *    payload rasterization is deferred off the click handler.
 * 2. Persistent: jobs live in the Dexie `printQueue` table (schema v7) and
 *    survive refresh / power loss / printer outages.
 * 3. Auto-Retry: up to 3 attempts with short backoff (2s, 4s); after that the
 *    job parks as 'failed' and surfaces in the POS bar for 1-click reprint.
 * 4. Payload Integrity: every payload is byte-verified (ESC @ init, GS v 0
 *    raster body with Persian glyphs rendered on canvas, GS V paper cut).
 */

import {
  getDexiePOSDatabase,
  DecomposedPrintQueueRecord,
} from '../db/DexiePOSDatabase';
import {
  renderReceiptToCanvas,
  renderZReportToCanvas,
  convertCanvasToEscPosRaster,
  printPairedWebUSB,
  printPairedWebBluetooth,
  PrinterConnectResult,
} from './escposThermalPrinter';
import { OrderAggregate } from '../types/order-domain';
import { Tenant, ShiftReportSummary } from '../types/domain';

export interface PrintQueueStats {
  pending: number;
  printing: number;
  failed: number;
  printed: number;
}

export interface EscPosReceiptPayload {
  bytes: Uint8Array;
  itemCount: number;
  receiptNumber: string;
}

export interface ReceiptPrintOptions {
  cashTendered?: number;
  changeDue?: number;
}

const MAX_PRINT_ATTEMPTS = 3;
const PROCESS_INTERVAL_MS = 5000;

/** Checks whether a byte sequence occurs anywhere in the payload. */
function containsSequence(bytes: Uint8Array, seq: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (bytes[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Builds the complete ESC/POS byte stream for a customer receipt.
 * Persian/English are encoded via the high-fidelity 576-dot canvas raster
 * (Persian script shaped by the browser text engine), item lines and the
 * receipt number are baked into the raster, and the stream terminates with
 * the GS V paper-cut command.
 */
export function buildReceiptEscPosPayload(
  order: OrderAggregate,
  tenant: Tenant,
  cashTendered?: number,
  changeDue?: number
): EscPosReceiptPayload {
  if (typeof document === 'undefined') {
    throw new Error('ESC/POS payload rasterization requires a DOM canvas runtime.');
  }
  if (!order.items || order.items.length === 0) {
    throw new Error('پیلود فیش بدون ردیف اقلام ساخته نمی‌شود (no item lines).');
  }

  const canvas = renderReceiptToCanvas(order, tenant, cashTendered, changeDue);
  const bytes = convertCanvasToEscPosRaster(canvas);

  const dailyNo = order.dailyReceiptNumber;
  const receiptNumber =
    dailyNo !== undefined && dailyNo > 0
      ? String(dailyNo).padStart(3, '0')
      : String(order.orderNumber ?? 0);

  return { bytes, itemCount: order.items.length, receiptNumber };
}

export interface ZReportPrintMeta {
  shiftId: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  actualCountedCashToman?: number;
  discrepancyReason?: string;
}

/**
 * Builds the ESC/POS byte stream for the Z-Report (خلاصه شیفت) — same 576-dot
 * canvas raster pipeline (Persian shaped via canvas), terminating with the
 * GS V paper cut command.
 */
export function buildZReportEscPosPayload(
  report: ShiftReportSummary,
  meta: ZReportPrintMeta,
  tenant: Tenant
): EscPosReceiptPayload {
  if (typeof document === 'undefined') {
    throw new Error('ESC/POS payload rasterization requires a DOM canvas runtime.');
  }
  const canvas = renderZReportToCanvas(report, meta, tenant);
  const bytes = convertCanvasToEscPosRaster(canvas);
  return {
    bytes,
    itemCount: 0,
    receiptNumber: `Z-${meta.shiftId.slice(-8)}`,
  };
}

/**
 * Byte-level payload verification: ESC @ init, GS v 0 raster body,
 * GS V paper cut, and a non-empty stream.
 */
export function verifyEscPosPayload(bytes: Uint8Array): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!bytes || bytes.length === 0) {
    issues.push('payload is empty');
    return { valid: false, issues };
  }
  if (!containsSequence(bytes, [0x1b, 0x40])) {
    issues.push('missing ESC @ (0x1B 0x40) init');
  }
  if (!containsSequence(bytes, [0x1d, 0x76, 0x30])) {
    issues.push('missing GS v 0 (0x1D 0x76 0x30) raster data');
  }
  if (!containsSequence(bytes, [0x1d, 0x56])) {
    issues.push('missing GS V (0x1D 0x56) paper cut');
  }
  return { valid: issues.length === 0, issues };
}

type QueueListener = (stats: PrintQueueStats) => void;

class PrintQueueServiceImpl {
  private activeTenantId: string | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private listeners = new Set<QueueListener>();

  /** Starts (or re-targets) the background processor for the active tenant. */
  start(tenantId: string): void {
    this.activeTenantId = tenantId;
    if (this.timerId !== null) {
      this.notify().catch(() => {});
      return;
    }
    if (typeof setInterval === 'function') {
      this.timerId = setInterval(() => {
        this.processQueue().catch(() => {});
      }, PROCESS_INTERVAL_MS);
    }
    this.processQueue().catch(() => {});
  }

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    if (this.activeTenantId) {
      this.getStats()
        .then((stats) => listener(stats))
        .catch(() => {});
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Fire-and-forget enqueue — returns immediately, never throws to the caller.
   * Payload rasterization is deferred off the checkout click handler.
   */
  enqueueReceiptPrint(
    order: OrderAggregate,
    tenant: Tenant,
    options?: ReceiptPrintOptions
  ): void {
    const tenantId = order.tenantId || tenant.id;
    setTimeout(() => {
      (async () => {
        const payload = buildReceiptEscPosPayload(
          order,
          tenant,
          options?.cashTendered,
          options?.changeDue
        );
        const verification = verifyEscPosPayload(payload.bytes);
        if (!verification.valid) {
          throw new Error(`Invalid ESC/POS payload: ${verification.issues.join('; ')}`);
        }
        const db = getDexiePOSDatabase(tenantId);
        const now = new Date().toISOString();
        const job: DecomposedPrintQueueRecord = {
          id: `pq-${order.id}-receipt`,
          tenantId,
          orderId: order.id,
          kind: 'CUSTOMER_RECEIPT',
          payload: payload.bytes.buffer as ArrayBuffer,
          status: 'pending',
          attempts: 0,
          itemCount: payload.itemCount,
          receiptNumber: payload.receiptNumber,
          createdAt: now,
          updatedAt: now,
        };
        await db.enqueuePrintJob(job);
      })()
        .then(() => this.notify())
        .catch((err) => {
          console.warn('[PrintQueue] Receipt enqueue failed:', err);
        });
    }, 0);
  }

  /**
   * Fire-and-forget Z-Report (خلاصه شیفت) enqueue — printing NEVER blocks shift
   * closure: the job lands in the persistent Dexie printQueue and is retried in
   * the background even if the printer is out of paper or unplugged.
   */
  enqueueZReportPrint(
    report: ShiftReportSummary,
    meta: ZReportPrintMeta,
    tenant: Tenant
  ): void {
    const tenantId = tenant.id;
    setTimeout(() => {
      (async () => {
        const payload = buildZReportEscPosPayload(report, meta, tenant);
        const verification = verifyEscPosPayload(payload.bytes);
        if (!verification.valid) {
          throw new Error(`Invalid ESC/POS Z-Report payload: ${verification.issues.join('; ')}`);
        }
        const db = getDexiePOSDatabase(tenantId);
        const now = new Date().toISOString();
        const job: DecomposedPrintQueueRecord = {
          id: `pq-${meta.shiftId}-zreport`,
          tenantId,
          orderId: meta.shiftId,
          kind: 'Z_REPORT',
          payload: payload.bytes.buffer as ArrayBuffer,
          status: 'pending',
          attempts: 0,
          itemCount: payload.itemCount,
          receiptNumber: payload.receiptNumber,
          createdAt: now,
          updatedAt: now,
        };
        await db.enqueuePrintJob(job);
      })()
        .then(() => this.notify())
        .catch((err) => {
          console.warn('[PrintQueue] Z-Report enqueue failed:', err);
        });
    }, 0);
  }

  /** 1-Click reprint: re-queue every failed job and drain the queue immediately. */
  async reprintFailed(tenantId: string): Promise<number> {
    const db = getDexiePOSDatabase(tenantId);
    const count = await db.requeueFailedPrintJobs(tenantId);
    if (count > 0) {
      await this.processQueue(tenantId).catch(() => {});
    }
    await this.notify().catch(() => {});
    return count;
  }

  async getStats(tenantId: string = this.activeTenantId || 'tenant-100hich-01'): Promise<PrintQueueStats> {
    return await getDexiePOSDatabase(tenantId).getPrintQueueStats(tenantId);
  }

  private async processQueue(tenantId: string = this.activeTenantId || ''): Promise<void> {
    if (this.processing || !tenantId) return;
    this.processing = true;
    try {
      const db = getDexiePOSDatabase(tenantId);
      for (let i = 0; i < MAX_PRINT_ATTEMPTS; i++) {
        const batch = await db.claimPendingPrintJobs(tenantId, 1);
        const job = batch[0];
        if (!job) break;
        try {
          const bytes = job.payload instanceof Uint8Array ? job.payload : new Uint8Array(job.payload);
          await printEscPosBytes(bytes);
          await db.markPrintJobPrinted(job.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await db.markPrintJobFailed(job.id, message, MAX_PRINT_ATTEMPTS);
        }
        await this.notify().catch(() => {});
      }
    } finally {
      this.processing = false;
    }
  }

  private async notify(): Promise<void> {
    if (this.listeners.size === 0) return;
    try {
      const stats = await this.getStats();
      this.listeners.forEach((cb) => cb(stats));
    } catch {
      // ignore stats errors
    }
  }
}

/**
 * Background transport for queued jobs — previously-paired printers only, so
 * no user gesture is required. Tries WebUSB, then Web Bluetooth.
 */
export async function printEscPosBytes(bytes: Uint8Array): Promise<PrinterConnectResult> {
  let lastError: unknown = null;
  try {
    return await printPairedWebUSB(bytes);
  } catch (err) {
    lastError = err;
  }
  try {
    return await printPairedWebBluetooth(bytes);
  } catch (err) {
    lastError = err;
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('هیچ پرینتر حرارتی جفت‌شده‌ای در دسترس نیست.');
}

export const printQueueService = new PrintQueueServiceImpl();
