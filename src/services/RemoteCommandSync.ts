/**
 * RemoteCommandSync.ts
 * 
 * CafeOS / SmartOrders Multi-Tenant Remote Command Synchronization Client (Phase 2 Stage A)
 * Strictly enforces:
 *  - [TENANT_ISOLATION_MANDATORY]: All remote commands scoped to active tenant database.
 *  - [INTEGER_TOMAN_PRECISION]: Prices validated as non-negative integers; fractional values strictly rejected.
 *  - [NO_DESTRUCTIVE_DDL]: Pure atomic DML transactions via Dexie; zero schema mutation.
 */

import { getCafeDatabase, CafeDatabase } from '../db/cafeDb';

export type RemoteCommandType = 'UPDATE_PRICE' | 'TOGGLE_STOCK';

export interface RemoteCommandPayload {
  productId: string;
  newPriceToman?: number;
  inStock?: boolean;
  reason?: string;
}

export interface RemoteCommand {
  commandId: string;
  tenantId: string;
  seq: number;
  type: RemoteCommandType;
  payload: RemoteCommandPayload;
  issuedAt: number;
}

export interface RemoteCommandPullResponse {
  success: boolean;
  tenantId: string;
  latestSeq: number;
  commands: RemoteCommand[];
  serverTime: number;
}

export interface RemoteCommandSyncStatus {
  tenantId: string;
  isRunning: boolean;
  isPolling: boolean;
  lastPollAt: number | null;
  lastSuccessAt: number | null;
  lastAppliedSeq: number;
  lastError: string | null;
  appliedCount: number;
  rejectedCount: number;
}

export interface RemoteCommandSyncOptions {
  tenantId: string;
  baseUrl?: string;
  pollIntervalMs?: number; // Default 180,000 (3 mins)
  terminalId?: string;
  authToken?: string;
}

export class RemoteCommandSync {
  private tenantId: string;
  private baseUrl: string;
  private pollIntervalMs: number;
  private terminalId: string;
  private authToken?: string;

  private isRunning = false;
  private isPolling = false;
  private lastPollAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private lastAppliedSeq = 0;
  private lastError: string | null = null;
  private appliedCount = 0;
  private rejectedCount = 0;

  private timerId: any = null;

  constructor(options: RemoteCommandSyncOptions) {
    if (!options.tenantId || !options.tenantId.trim()) {
      throw new Error('[RemoteCommandSync] tenantId is strictly required for multi-tenant isolation');
    }
    this.tenantId = options.tenantId.trim();
    this.baseUrl = (options.baseUrl || '').replace(/\/$/, '');
    this.pollIntervalMs = Math.max(10_000, options.pollIntervalMs ?? 180_000);
    this.terminalId = options.terminalId || 'POS_TERMINAL_01';
    this.authToken = options.authToken;

    this.lastAppliedSeq = this.loadStoredSeq();
  }

  private getStorageKey(): string {
    return `cafeos_last_cmd_seq_${this.tenantId}`;
  }

  private loadStoredSeq(): number {
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const stored = localStorage.getItem(this.getStorageKey());
        if (stored) {
          const num = parseInt(stored, 10);
          if (!isNaN(num) && num >= 0) return num;
        }
      } catch {
        // Fallback to in-memory seq
      }
    }
    return 0;
  }

  private saveStoredSeq(seq: number): void {
    this.lastAppliedSeq = seq;
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        localStorage.setItem(this.getStorageKey(), seq.toString());
      } catch {
        // Safe degrade
      }
    }
  }

  public getStatus(): RemoteCommandSyncStatus {
    return {
      tenantId: this.tenantId,
      isRunning: this.isRunning,
      isPolling: this.isPolling,
      lastPollAt: this.lastPollAt,
      lastSuccessAt: this.lastSuccessAt,
      lastAppliedSeq: this.lastAppliedSeq,
      lastError: this.lastError,
      appliedCount: this.appliedCount,
      rejectedCount: this.rejectedCount,
    };
  }

  /**
   * Starts periodic short polling.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextPoll(100); // Immediate initial poll
  }

  /**
   * Stops active polling timer.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleNextPoll(delayMs?: number): void {
    if (!this.isRunning) return;
    if (this.timerId) clearTimeout(this.timerId);

    const delay = delayMs !== undefined ? delayMs : this.pollIntervalMs;
    this.timerId = setTimeout(async () => {
      try {
        await this.pollOnce();
      } finally {
        if (this.isRunning) {
          this.scheduleNextPoll();
        }
      }
    }, delay);
  }

  /**
   * Executes a single pull-and-apply cycle.
   */
  public async pollOnce(fetchFn?: typeof fetch): Promise<RemoteCommand[]> {
    if (this.isPolling) {
      return [];
    }

    this.isPolling = true;
    this.lastPollAt = Date.now();
    this.lastError = null;

    try {
      const commands = await this.fetchPendingCommands(fetchFn);
      if (commands.length > 0) {
        await this.applyCommands(commands);
      }
      this.lastSuccessAt = Date.now();
      return commands;
    } catch (err: any) {
      this.lastError = err?.message || String(err);
      return [];
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Fetches commands from remote cloud server.
   */
  public async fetchPendingCommands(customFetch?: typeof fetch): Promise<RemoteCommand[]> {
    const fetcher = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetcher) {
      throw new Error('[RemoteCommandSync] Global fetch is not available in current environment');
    }

    const endpoint = `${this.baseUrl}/api/v1/sync/pull?tenantId=${encodeURIComponent(this.tenantId)}&lastSeq=${this.lastAppliedSeq}&terminalId=${encodeURIComponent(this.terminalId)}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Tenant-ID': this.tenantId,
      'X-Terminal-ID': this.terminalId,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const res = await fetcher(endpoint, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`[RemoteCommandSync] HTTP ${res.status} ${res.statusText}`);
    }

    const data: RemoteCommandPullResponse = await res.json();
    if (!data || !Array.isArray(data.commands)) {
      return [];
    }

    // Filter to ensure commands belong to this tenant and seq > lastAppliedSeq
    return data.commands
      .filter((cmd) => cmd.tenantId === this.tenantId && cmd.seq > this.lastAppliedSeq)
      .sort((a, b) => a.seq - b.seq);
  }

  /**
   * Applies commands atomically in IndexedDB transaction scoped to this tenant.
   */
  public async applyCommands(commands: RemoteCommand[]): Promise<void> {
    if (commands.length === 0) return;

    const isolatedDb: CafeDatabase = getCafeDatabase(this.tenantId);

    // Run within a Dexie readwrite transaction
    await isolatedDb.transaction('rw', [isolatedDb.menuItems, isolatedDb.auditLogs], async () => {
      for (const cmd of commands) {
        // Enforce strict tenant match
        if (cmd.tenantId !== this.tenantId) {
          this.rejectedCount++;
          console.warn(`[RemoteCommandSync] Cross-tenant command rejected: expected ${this.tenantId}, got ${cmd.tenantId}`);
          continue;
        }

        try {
          if (cmd.type === 'UPDATE_PRICE') {
            await this.handleUpdatePrice(isolatedDb, cmd);
            this.appliedCount++;
          } else if (cmd.type === 'TOGGLE_STOCK') {
            await this.handleToggleStock(isolatedDb, cmd);
            this.appliedCount++;
          } else {
            console.warn(`[RemoteCommandSync] Unrecognized command type: ${(cmd as any).type}`);
            this.rejectedCount++;
            continue;
          }

          // Advance seq if successful
          if (cmd.seq > this.lastAppliedSeq) {
            this.saveStoredSeq(cmd.seq);
          }
        } catch (err: any) {
          this.rejectedCount++;
          console.error(`[RemoteCommandSync] Command ${cmd.commandId} execution failed:`, err);
          throw err; // Rollback transaction on unexpected database failure
        }
      }
    });

    // Dispatch DOM event for reactive UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(`tenantSyncEvent_${this.tenantId}`, {
          detail: {
            tenantId: this.tenantId,
            appliedSeq: this.lastAppliedSeq,
            count: commands.length,
          },
        })
      );
    }
  }

  private async handleUpdatePrice(db: CafeDatabase, cmd: RemoteCommand): Promise<void> {
    const { productId, newPriceToman, reason } = cmd.payload;

    if (!productId || typeof productId !== 'string') {
      throw new Error(`[RemoteCommandSync] Invalid productId for UPDATE_PRICE: ${productId}`);
    }

    // MANDATORY INVARIANT: INTEGER_TOMAN_PRECISION
    if (newPriceToman === undefined || !Number.isInteger(newPriceToman) || newPriceToman < 0) {
      throw new Error(
        `[RemoteCommandSync] Financial Invariant Violation: newPriceToman must be a non-negative integer. Got: ${newPriceToman}`
      );
    }

    const existing = await db.menuItems.get(productId);
    if (!existing) {
      // Product may not exist locally; log audit warning without crashing
      await db.auditLogs.add({
        id: `audit_cmd_${cmd.commandId}_${Date.now()}`,
        orderId: 'REMOTE_COMMAND',
        userId: 'CLOUD_DISPATCHER',
        action: 'edit_items',
        details: `UPDATE_PRICE skipped: Product '${productId}' not found in tenant '${this.tenantId}'. Target price: ${newPriceToman} Toman`,
        timestamp: Date.now(),
      });
      return;
    }

    const previousPrice = existing.price;
    await db.menuItems.update(productId, {
      price: newPriceToman,
    });

    await db.auditLogs.add({
      id: `audit_cmd_${cmd.commandId}_${Date.now()}`,
      orderId: 'REMOTE_COMMAND',
      userId: 'CLOUD_DISPATCHER',
      action: 'edit_items',
      reason: reason || 'Remote cloud price sync',
      details: `UPDATE_PRICE: Product '${productId}' (${existing.title}) changed from ${previousPrice} Toman to ${newPriceToman} Toman. Seq: ${cmd.seq}`,
      timestamp: Date.now(),
    });
  }

  private async handleToggleStock(db: CafeDatabase, cmd: RemoteCommand): Promise<void> {
    const { productId, inStock, reason } = cmd.payload;

    if (!productId || typeof productId !== 'string') {
      throw new Error(`[RemoteCommandSync] Invalid productId for TOGGLE_STOCK: ${productId}`);
    }

    if (typeof inStock !== 'boolean') {
      throw new Error(`[RemoteCommandSync] inStock must be a boolean. Got: ${inStock}`);
    }

    const existing = await db.menuItems.get(productId);
    if (!existing) {
      await db.auditLogs.add({
        id: `audit_cmd_${cmd.commandId}_${Date.now()}`,
        orderId: 'REMOTE_COMMAND',
        userId: 'CLOUD_DISPATCHER',
        action: 'edit_items',
        details: `TOGGLE_STOCK skipped: Product '${productId}' not found in tenant '${this.tenantId}'. Target stock: ${inStock}`,
        timestamp: Date.now(),
      });
      return;
    }

    await db.menuItems.update(productId, {
      isAvailable: inStock,
    });

    await db.auditLogs.add({
      id: `audit_cmd_${cmd.commandId}_${Date.now()}`,
      orderId: 'REMOTE_COMMAND',
      userId: 'CLOUD_DISPATCHER',
      action: 'edit_items',
      reason: reason || 'Remote cloud stock toggle',
      details: `TOGGLE_STOCK: Product '${productId}' (${existing.title}) availability set to ${inStock}. Seq: ${cmd.seq}`,
      timestamp: Date.now(),
    });
  }
}
