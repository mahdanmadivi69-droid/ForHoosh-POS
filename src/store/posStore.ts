import { useSyncExternalStore } from 'react';
import {
  OrderPaymentSplit,
  PaymentTenderMethod,
  PosTableItem,
  PosTableSession,
  PosTenantId,
  SplitSettlementPayload,
  SplitSettlementReceipt,
  SplitSettlementResult,
  TableTransferPayload,
  TransferExecutionResult,
} from '../types/pos';
import { calculateOrderTotals } from '../services/financialMath';

export interface TenantTableDefinition {
  readonly tableId: string;
  readonly label: string;
  readonly zoneLabelFa: string;
  readonly seats: number;
}

export const TENANT_TABLE_CATALOG: Readonly<Record<PosTenantId, readonly TenantTableDefinition[]>> = {
  modendo: [
    { tableId: 'M-01', label: 'M-01', zoneLabelFa: 'سالن اصلی', seats: 4 },
    { tableId: 'M-02', label: 'M-02', zoneLabelFa: 'سالن اصلی', seats: 4 },
    { tableId: 'M-03', label: 'M-03', zoneLabelFa: 'سالن اصلی', seats: 4 },
    { tableId: 'M-04', label: 'M-04', zoneLabelFa: 'سالن اصلی', seats: 4 },
    { tableId: 'M-07', label: 'میز ۶ نفره', zoneLabelFa: 'سالن اصلی', seats: 6 },
    { tableId: 'BAR-1', label: 'بار ۱', zoneLabelFa: 'کانتر بار', seats: 1 },
    { tableId: 'BAR-2', label: 'بار ۲', zoneLabelFa: 'کانتر بار', seats: 1 },
    { tableId: 'BAR-3', label: 'بار ۳', zoneLabelFa: 'کانتر بار', seats: 1 },
    { tableId: 'BAR-4', label: 'بار ۴', zoneLabelFa: 'کانتر بار', seats: 1 },
    { tableId: 'BAR-5', label: 'بار ۵', zoneLabelFa: 'کانتر بار', seats: 1 },
    { tableId: 'BAR-6', label: 'بار ۶', zoneLabelFa: 'کانتر بار', seats: 1 },
    { tableId: 'BAR-01', label: 'کانتر بار (کل)', zoneLabelFa: 'کانتر بار', seats: 6 },
    { tableId: 'M-05', label: 'M-05', zoneLabelFa: 'تراس', seats: 6 },
    { tableId: 'M-06', label: 'M-06', zoneLabelFa: 'تراس', seats: 6 },
    { tableId: 'T-01', label: 'T-01 (۲ نفر)', zoneLabelFa: 'تراس', seats: 2 },
    { tableId: 'T-02', label: 'T-02 (۲ نفر)', zoneLabelFa: 'تراس', seats: 2 },
    { tableId: 'T-03', label: 'T-03 (۳ نفر)', zoneLabelFa: 'تراس', seats: 3 },
    { tableId: 'L-01', label: 'کانتر چپ لانژ', zoneLabelFa: 'Lounge', seats: 4 },
    { tableId: 'L-02', label: 'L-02', zoneLabelFa: 'Lounge', seats: 4 },
    { tableId: 'L-03', label: 'L-03', zoneLabelFa: 'Lounge', seats: 4 },
    { tableId: 'L-04', label: 'L-04', zoneLabelFa: 'Lounge', seats: 4 },
    { tableId: 'L-05', label: 'مبل و میز', zoneLabelFa: 'Lounge', seats: 3 },
    { tableId: 'L-06', label: 'L-06', zoneLabelFa: 'Lounge', seats: 4 },
    { tableId: 'L-07', label: 'کانتر راست لانژ', zoneLabelFa: 'Lounge', seats: 4 },
    { tableId: 'L-08', label: 'L-08', zoneLabelFa: 'Lounge', seats: 2 },
    { tableId: 'PS5-1', label: 'PS5 #1', zoneLabelFa: 'اتاق PS5', seats: 2 },
    { tableId: 'PS5-2', label: 'PS5 #2', zoneLabelFa: 'اتاق PS5', seats: 2 },
    { tableId: 'PS5-3', label: 'PS5 #3', zoneLabelFa: 'اتاق PS5', seats: 2 },
    { tableId: 'PS5-4', label: 'PS5 #4', zoneLabelFa: 'اتاق PS5', seats: 2 },
  ],
  '100hich': [
    { tableId: '100H-T1', label: 'میز ۱', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 2 },
    { tableId: '100H-T2', label: 'میز ۲', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 2 },
    { tableId: '100H-T3', label: 'میز ۳', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 4 },
    { tableId: '100H-T4', label: 'میز ۴', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 4 },
    { tableId: '100H-T5', label: 'میز ۵', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 4 },
    { tableId: '100H-T6', label: 'میز ۶', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 4 },
    { tableId: '100H-T7', label: 'میز ۷', zoneLabelFa: 'سالن ۱۰۰هیچ', seats: 6 },
    { tableId: '100H-BAR', label: 'کانتر بار', zoneLabelFa: 'بار ۱۰۰هیچ', seats: 4 },
  ],
};

export interface TenantPosSlice {
  readonly tenantId: PosTenantId;
  readonly tables: Readonly<Record<string, PosTableSession>>;
  readonly settledReceipts: readonly SplitSettlementReceipt[];
}

export interface PosStoreState {
  readonly activeTenantId: PosTenantId;
  readonly tenants: Readonly<Record<PosTenantId, TenantPosSlice>>;
}

const POS_STORE_STORAGE_KEY = 'cafeos_pos_store_v1';

function isValidTenantId(value: string): value is PosTenantId {
  return value === '100hich' || value === 'modendo';
}

function isValidTenderMethod(method: string): method is PaymentTenderMethod {
  return method === 'POS_TERMINAL' || method === 'CASH' || method === 'CARD_TRANSFER';
}

function assertIntegerToman(amount: number, label: string): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new Error(`${label} باید عدد صحیح تومان باشد (مقدار نامعتبر: ${String(amount)}).`);
  }
  return amount;
}

function recomputeSessionTotals(
  items: readonly PosTableItem[],
  requestedDiscountToman: number,
  ps5FeeToman: number
): {
  grossAmountToman: number;
  discountToman: number;
  netTotalToman: number;
  ps5FeeToman: number;
} {
  for (const item of items) {
    assertIntegerToman(item.unitPriceSnapshotToman, `قیمت واحد ${item.itemNameSnapshot}`);
    assertIntegerToman(item.quantity, `تعداد ${item.itemNameSnapshot}`);
    assertIntegerToman(item.subtotalToman, `جمع ردیف ${item.itemNameSnapshot}`);
  }
  const cleanDiscountInput = Math.max(0, assertIntegerToman(requestedDiscountToman, 'تخفیف'));
  const cleanPs5Fee = Math.max(0, assertIntegerToman(ps5FeeToman, 'تعرفه PS5'));
  const { grossAmountToman, discountAmountToman, netTotalToman } = calculateOrderTotals(
    items.map((item) => ({
      unitPriceSnapshotToman: item.unitPriceSnapshotToman,
      quantity: item.quantity,
    })),
    cleanDiscountInput
  );

  return {
    grossAmountToman,
    discountToman: discountAmountToman,
    netTotalToman,
    ps5FeeToman: cleanPs5Fee,
  };
}

function resolveTableLabel(tenantId: PosTenantId, tableId: string): string | null {
  const found = TENANT_TABLE_CATALOG[tenantId].find((t) => t.tableId === tableId);
  return found ? found.label : null;
}

function createInitialState(): PosStoreState {
  const empty: PosStoreState = {
    activeTenantId: 'modendo',
    tenants: {
      modendo: { tenantId: 'modendo', tables: {}, settledReceipts: [] },
      '100hich': { tenantId: '100hich', tables: {}, settledReceipts: [] },
    },
  };

  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(POS_STORE_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PosStoreState>;
    const activeTenantId: PosTenantId =
      parsed.activeTenantId && isValidTenantId(parsed.activeTenantId)
        ? parsed.activeTenantId
        : 'modendo';
    return {
      activeTenantId,
      tenants: {
        modendo: parsed.tenants?.modendo ?? empty.tenants.modendo,
        '100hich': parsed.tenants?.['100hich'] ?? empty.tenants['100hich'],
      },
    };
  } catch {
    return empty;
  }
}

type StoreListener = () => void;

class PosStoreManager {
  private state: PosStoreState = createInitialState();
  private listeners: Set<StoreListener> = new Set();

  public getState = (): PosStoreState => this.state;

  public subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(nextState: PosStoreState): void {
    this.state = nextState;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(POS_STORE_STORAGE_KEY, JSON.stringify(nextState));
      } catch (err) {
        console.warn('[posStore] Failed to persist store snapshot:', err);
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public setActiveTenant(tenantId: PosTenantId): void {
    if (!isValidTenantId(tenantId)) {
      throw new Error(`شناسه مجموعه نامعتبر است: ${String(tenantId)}`);
    }
    if (this.state.activeTenantId === tenantId) return;
    this.commit({
      ...this.state,
      activeTenantId: tenantId,
    });
  }

  public getTenantTables(tenantId: PosTenantId): Readonly<Record<string, PosTableSession>> {
    return this.state.tenants[tenantId].tables;
  }

  public getTenantReceipts(tenantId: PosTenantId): readonly SplitSettlementReceipt[] {
    return this.state.tenants[tenantId].settledReceipts;
  }

  public upsertTableSession(session: PosTableSession): PosTableSession {
    if (!isValidTenantId(session.tenantId)) {
      throw new Error(`شناسه مجموعه نامعتبر است: ${String(session.tenantId)}`);
    }
    const totals = recomputeSessionTotals(
      session.items,
      session.discountToman,
      session.ps5FeeToman
    );
    const normalized: PosTableSession = {
      ...session,
      grossAmountToman: totals.grossAmountToman,
      discountToman: totals.discountToman,
      netTotalToman: totals.netTotalToman,
      ps5FeeToman: totals.ps5FeeToman,
    };

    const tenantSlice = this.state.tenants[session.tenantId];
    this.commit({
      ...this.state,
      tenants: {
        ...this.state.tenants,
        [session.tenantId]: {
          ...tenantSlice,
          tables: {
            ...tenantSlice.tables,
            [session.tableId]: normalized,
          },
        },
      },
    });
    return normalized;
  }

  public removeTableSession(tenantId: PosTenantId, tableId: string): void {
    if (!isValidTenantId(tenantId)) return;
    const tenantSlice = this.state.tenants[tenantId];
    if (!tenantSlice.tables[tableId]) return;
    const nextTables: Record<string, PosTableSession> = { ...tenantSlice.tables };
    delete nextTables[tableId];
    this.commit({
      ...this.state,
      tenants: {
        ...this.state.tenants,
        [tenantId]: {
          ...tenantSlice,
          tables: nextTables,
        },
      },
    });
  }

  /**
   * Atomically transfers selected items from sourceTableId to targetTableId
   * within the same tenant boundary ('100hich' or 'modendo').
   */
  public transferTableItems(payload: TableTransferPayload): TransferExecutionResult {
    try {
      if (!isValidTenantId(payload.tenantId)) {
        return {
          ok: false,
          error: 'شناسه مجموعه (tenantId) نامعتبر است.',
          transferredCount: 0,
          transferredAmountToman: 0,
        };
      }

      const sourceId = payload.sourceTableId.trim();
      const targetId = payload.targetTableId.trim();

      if (!sourceId || !targetId) {
        return {
          ok: false,
          error: 'میز مبدأ و میز مقصد هر دو الزامی هستند.',
          transferredCount: 0,
          transferredAmountToman: 0,
        };
      }

      if (sourceId === targetId) {
        return {
          ok: false,
          error: 'میز مبدأ و میز مقصد نمی‌توانند یکسان باشند.',
          transferredCount: 0,
          transferredAmountToman: 0,
        };
      }

      const targetCatalogLabel = resolveTableLabel(payload.tenantId, targetId);
      const tenantSlice = this.state.tenants[payload.tenantId];
      const existingTarget = tenantSlice.tables[targetId];
      if (!targetCatalogLabel && !existingTarget) {
        return {
          ok: false,
          error: `میز مقصد (${targetId}) متعلق به مجموعه ${payload.tenantId} نیست.`,
          transferredCount: 0,
          transferredAmountToman: 0,
        };
      }

      const uniqueItemIds = Array.from(new Set(payload.itemIds.filter((id) => id.trim().length > 0)));
      if (uniqueItemIds.length === 0) {
        return {
          ok: false,
          error: 'حداقل یک آیتم را برای انتقال انتخاب کنید.',
          transferredCount: 0,
          transferredAmountToman: 0,
        };
      }

      const sourceSession = tenantSlice.tables[sourceId];
      if (!sourceSession) {
        return {
          ok: false,
          error: `سفارش فعالی برای میز مبدأ (${sourceId}) یافت نشد.`,
          transferredCount: 0,
          transferredAmountToman: 0,
        };
      }

      // All-or-nothing validation: verify every requested itemId exists on sourceSession
      const sourceItemMap = new Map(sourceSession.items.map((item) => [item.id, item]));
      for (const itemId of uniqueItemIds) {
        if (!sourceItemMap.has(itemId)) {
          return {
            ok: false,
            error: `آیتم با شناسه ${itemId} روی میز مبدأ یافت نشد؛ انتقال لغو شد.`,
            transferredCount: 0,
            transferredAmountToman: 0,
          };
        }
      }

      const moveSet = new Set(uniqueItemIds);
      const itemsToMove: PosTableItem[] = [];
      const remainingItems: PosTableItem[] = [];

      for (const item of sourceSession.items) {
        if (moveSet.has(item.id)) {
          itemsToMove.push(item);
        } else {
          remainingItems.push(item);
        }
      }

      const transferredAmountToman = itemsToMove.reduce(
        (sum, item) => sum + assertIntegerToman(item.subtotalToman, item.itemNameSnapshot),
        0
      );

      // Recompute source session atomically
      const nextTables: Record<string, PosTableSession> = { ...tenantSlice.tables };
      let updatedSourceSession: PosTableSession | null = null;

      if (remainingItems.length === 0 && sourceSession.ps5FeeToman <= 0) {
        delete nextTables[sourceId];
      } else {
        const sourceTotals = recomputeSessionTotals(
          remainingItems,
          sourceSession.discountToman,
          sourceSession.ps5FeeToman
        );
        updatedSourceSession = {
          ...sourceSession,
          items: remainingItems,
          grossAmountToman: sourceTotals.grossAmountToman,
          discountToman: sourceTotals.discountToman,
          netTotalToman: sourceTotals.netTotalToman,
          ps5FeeToman: sourceTotals.ps5FeeToman,
        };
        nextTables[sourceId] = updatedSourceSession;
      }

      // Recompute target session atomically
      const baseTarget: PosTableSession = existingTarget ?? {
        tenantId: payload.tenantId,
        tableId: targetId,
        tableLabel: targetCatalogLabel ?? targetId,
        status: 'OCCUPIED',
        guestCount:
          TENANT_TABLE_CATALOG[payload.tenantId].find((t) => t.tableId === targetId)?.seats ?? 2,
        customerName: '',
        notes: '',
        openedAt: new Date().toISOString(),
        items: [],
        discountToman: 0,
        grossAmountToman: 0,
        netTotalToman: 0,
        ps5FeeToman: 0,
      };

      const mergedTargetItems: PosTableItem[] = [...baseTarget.items, ...itemsToMove];
      const targetTotals = recomputeSessionTotals(
        mergedTargetItems,
        baseTarget.discountToman,
        baseTarget.ps5FeeToman
      );
      const updatedTargetSession: PosTableSession = {
        ...baseTarget,
        status: 'OCCUPIED',
        items: mergedTargetItems,
        grossAmountToman: targetTotals.grossAmountToman,
        discountToman: targetTotals.discountToman,
        netTotalToman: targetTotals.netTotalToman,
        ps5FeeToman: targetTotals.ps5FeeToman,
      };
      nextTables[targetId] = updatedTargetSession;

      // Single atomic commit
      this.commit({
        ...this.state,
        tenants: {
          ...this.state.tenants,
          [payload.tenantId]: {
            ...tenantSlice,
            tables: nextTables,
          },
        },
      });

      return {
        ok: true,
        sourceSession: updatedSourceSession,
        targetSession: updatedTargetSession,
        transferredCount: itemsToMove.length,
        transferredAmountToman,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'خطای نامشخص در انتقال اتمیک اقلام میز',
        transferredCount: 0,
        transferredAmountToman: 0,
      };
    }
  }

  /**
   * Atomically settles an open table order across multiple tenders
   * (POS_TERMINAL + CASH + CARD_TRANSFER) enforcing integer-Toman exact match.
   */
  public settleSplitOrder(payload: SplitSettlementPayload): SplitSettlementResult {
    try {
      if (!isValidTenantId(payload.tenantId)) {
        return { ok: false, error: 'شناسه مجموعه (tenantId) نامعتبر است.' };
      }

      const tenantSlice = this.state.tenants[payload.tenantId];
      const session = tenantSlice.tables[payload.tableId];
      if (!session) {
        return {
          ok: false,
          error: `سفارش فعالی برای میز ${payload.tableId} در مجموعه ${payload.tenantId} وجود ندارد.`,
        };
      }

      const totals = recomputeSessionTotals(
        session.items,
        session.discountToman,
        session.ps5FeeToman
      );
      const totalDueToman = totals.netTotalToman + totals.ps5FeeToman;

      if (!Number.isInteger(totalDueToman) || totalDueToman <= 0) {
        return {
          ok: false,
          error: 'مبلغ قابل تسویه باید عدد صحیح مثبت تومان باشد.',
        };
      }

      if (payload.splits.length === 0) {
        return {
          ok: false,
          error: 'حداقل یک ردیف پرداخت برای تسویه ترکیبی الزامی است.',
        };
      }

      let totalPaidToman = 0;
      const validatedSplits: OrderPaymentSplit[] = [];

      for (const split of payload.splits) {
        if (!isValidTenderMethod(split.method)) {
          return {
            ok: false,
            error: `روش پرداخت نامعتبر است: ${String(split.method)}`,
          };
        }
        if (
          typeof split.amountToman !== 'number' ||
          !Number.isInteger(split.amountToman) ||
          split.amountToman <= 0
        ) {
          return {
            ok: false,
            error: `مبلغ هر ردیف پرداخت باید عدد صحیح مثبت به تومان باشد (${String(split.amountToman)}).`,
          };
        }
        if (
          typeof split.timestamp !== 'number' ||
          !Number.isInteger(split.timestamp) ||
          split.timestamp <= 0
        ) {
          return {
            ok: false,
            error: 'زمان ثبت ردیف پرداخت نامعتبر است.',
          };
        }
        totalPaidToman += split.amountToman;
        validatedSplits.push({
          id: split.id,
          method: split.method,
          amountToman: split.amountToman,
          timestamp: split.timestamp,
        });
      }

      if (totalPaidToman !== totalDueToman) {
        const diff = totalDueToman - totalPaidToman;
        return {
          ok: false,
          error:
            diff > 0
              ? `مجموع پرداخت‌ها (${totalPaidToman.toLocaleString('fa-IR')} تومان) از مبلغ کل (${totalDueToman.toLocaleString('fa-IR')} تومان) کمتر است؛ ${diff.toLocaleString('fa-IR')} تومان باقیمانده.`
              : `مجموع پرداخت‌ها (${totalPaidToman.toLocaleString('fa-IR')} تومان) از مبلغ کل (${totalDueToman.toLocaleString('fa-IR')} تومان) بیشتر است.`,
        };
      }

      const receipt: SplitSettlementReceipt = {
        receiptId: `srec-${payload.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId: payload.tenantId,
        tableId: session.tableId,
        tableLabel: session.tableLabel,
        items: session.items,
        grossAmountToman: totals.grossAmountToman,
        discountToman: totals.discountToman,
        ps5FeeToman: totals.ps5FeeToman,
        totalDueToman,
        totalPaidToman,
        splits: validatedSplits,
        settledAt: Date.now(),
        settledByUserId: payload.settledByUserId,
        settledByUserName: payload.settledByUserName,
      };

      const nextTables: Record<string, PosTableSession> = { ...tenantSlice.tables };
      delete nextTables[payload.tableId];

      this.commit({
        ...this.state,
        tenants: {
          ...this.state.tenants,
          [payload.tenantId]: {
            ...tenantSlice,
            tables: nextTables,
            settledReceipts: [receipt, ...tenantSlice.settledReceipts],
          },
        },
      });

      return {
        ok: true,
        receipt,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'خطای نامشخص در تسویه ترکیبی فاکتور',
      };
    }
  }
}

export const posStore = new PosStoreManager();

export function usePosStore(): PosStoreState {
  return useSyncExternalStore(posStore.subscribe, posStore.getState, posStore.getState);
}
