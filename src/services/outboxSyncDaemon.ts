import type { CafeDatabase } from '../db/cafeDb';
import type { Order } from '../types/db';
import type { SyncOrder } from '../../central-framework/types/officeAgentTypes';
import { CentralSyncBridge, type SyncEngineStatus } from './centralSyncBridge';

export interface OutboxDaemonOptions {
  db: CafeDatabase;
  tenantId: string;
  terminalId?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  onStatusChange?: (status: SyncEngineStatus) => void;
}

export class OutboxSyncDaemon {
  private db: CafeDatabase;
  private bridge: CentralSyncBridge;
  private pollIntervalMs: number;
  private batchSize: number;
  private timer: any = null;
  private isRunning = false;
  private onStatusChange?: (status: SyncEngineStatus) => void;

  constructor(options: OutboxDaemonOptions) {
    this.db = options.db;
    this.bridge = new CentralSyncBridge(
      options.tenantId,
      options.terminalId || 'POS_MAIN_01',
      options.baseUrl || ''
    );
    this.pollIntervalMs = options.pollIntervalMs || 30000;
    this.batchSize = options.batchSize || 25;
    this.onStatusChange = options.onStatusChange;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Trigger immediate flush, then establish recurring interval
    this.flush();
    this.timer = setInterval(() => this.flush(), this.pollIntervalMs);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }
  }

  private handleOnline = (): void => {
    console.log('[OutboxSyncDaemon] Network online detected. Triggering immediate sync.');
    this.flush();
  };

  public async getPendingCount(): Promise<number> {
    try {
      return await this.db.orders.where('synced').equals(0).count();
    } catch {
      return 0;
    }
  }

  public notifyStatus(pendingCount: number): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.bridge.getStatus(pendingCount));
    }
  }

  public async flush(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pending = await this.getPendingCount();
      this.notifyStatus(pending);
      return;
    }

    try {
      // 1. Fetch pending unsynced records
      const pendingOrders: Order[] = await this.db.orders
        .where('synced')
        .equals(0)
        .limit(this.batchSize)
        .toArray();

      const totalPending = await this.getPendingCount();
      this.notifyStatus(totalPending);

      if (pendingOrders.length === 0) {
        return;
      }

      // 2. Transform into Central Office SyncOrder contract
      const syncOrders: SyncOrder[] = pendingOrders.map((o) => ({
        clientGeneratedId: o.id,
        orderNumber: String(o.orderNumber),
        totalAmount: Math.round(o.total),
        taxAmount: 0,
        createdAt: o.createdAt || Date.now(),
        paymentMethod: o.paymentMethod || 'CASH',
        state: o.status === 'settled' ? 'COMPLETED' : 'PAID',
        tableNumber: o.tableId,
        items: (o.items || []).map((it) => ({
          id: it.menuItemId || it.id || 'item',
          name: it.title || it.name || 'Unknown Item',
          quantity: it.quantity || 1,
          unitPrice: Math.round(it.unitPrice || it.price || 0),
          totalPrice: Math.round((it.unitPrice || it.price || 0) * (it.quantity || 1)),
        })),
      }));

      // 3. Dispatch batch to Central Sync Gateway
      const response = await this.bridge.dispatchBatch(syncOrders);

      if (response && (response.status === 'success' || response.status === 'partial')) {
        // Collect IDs to mark as synced (both newly reconciled and idempotency duplicates)
        const acknowledgedIds = new Set([
          ...(response.processedIds || []),
          ...(response.duplicateIds || []),
        ]);

        if (acknowledgedIds.size > 0) {
          await this.db.transaction('rw', this.db.orders, async () => {
            for (const id of acknowledgedIds) {
              await this.db.orders.update(id, { synced: 1 });
            }
          });
        }
      }

      const remainingPending = await this.getPendingCount();
      this.notifyStatus(remainingPending);
    } catch (err) {
      console.error('[OutboxSyncDaemon] Flush cycle encountered error:', err);
      const pending = await this.getPendingCount();
      this.notifyStatus(pending);
    }
  }
}
