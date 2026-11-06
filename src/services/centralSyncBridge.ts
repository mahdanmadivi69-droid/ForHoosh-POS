import type { IncomingSyncPayload, BatchSyncResponse, SyncOrder } from '../../central-framework/types/officeAgentTypes';

export interface SyncEngineStatus {
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  pendingCount: number;
  isLockedOut: boolean;
}

export class CentralSyncBridge {
  private tenantId: string;
  private terminalId: string;
  private baseUrl: string;
  private isSyncing = false;
  private isLockedOut = false;
  private lastSyncAt: number | null = null;
  private lastError: string | null = null;

  constructor(tenantId: string, terminalId = 'POS_MAIN_01', baseUrl = '') {
    this.tenantId = tenantId;
    this.terminalId = terminalId;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public getStatus(pendingCount = 0): SyncEngineStatus {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      pendingCount,
      isLockedOut: this.isLockedOut,
    };
  }

  public async dispatchBatch(orders: SyncOrder[]): Promise<BatchSyncResponse | null> {
    if (!orders || orders.length === 0) return null;
    if (this.isSyncing) return null;

    this.isSyncing = true;
    this.lastError = null;

    const payload: IncomingSyncPayload = {
      tenantId: this.tenantId,
      terminalId: this.terminalId,
      batchId: `BATCH_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      orders: orders.map((o) => ({
        clientGeneratedId: o.clientGeneratedId,
        orderNumber: o.orderNumber,
        totalAmount: Math.round(o.totalAmount),
        taxAmount: Math.round(o.taxAmount || 0),
        items: o.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice),
          totalPrice: Math.round(item.totalPrice),
        })),
        createdAt: o.createdAt || Date.now(),
        paymentMethod: o.paymentMethod || 'CASH',
        state: o.state || 'COMPLETED',
        tableNumber: o.tableNumber,
      })),
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/central/agents/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': this.tenantId,
          'X-Terminal-ID': this.terminalId,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 403) {
        this.isLockedOut = true;
        this.lastError = 'Subscription suspended: Cloud sync rejected by central gate.';
        console.warn(`[CentralSyncBridge] Tenant ${this.tenantId} POS sync feature flag disabled.`);
        return null;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Sync HTTP error ${response.status}: ${errText}`);
      }

      const result: BatchSyncResponse = await response.json();
      this.lastSyncAt = result.serverTimestamp || Date.now();
      this.isLockedOut = false;
      return result;
    } catch (err: any) {
      this.lastError = err?.message || 'Network sync error';
      console.error('[CentralSyncBridge] Batch dispatch failed:', err);
      return null;
    } finally {
      this.isSyncing = false;
    }
  }
}
