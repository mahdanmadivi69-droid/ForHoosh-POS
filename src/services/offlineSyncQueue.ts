/**
 * CAFE OS — Offline Synchronization Queue Engine
 * Module: src/services/offlineSyncQueue.ts
 * Owner: A08-PULSE (POS and Offline Synchronization Engineer)
 *
 * Implements:
 * 1. Immutable original tenant binding (order.tenantId is strictly preserved and never mutated).
 * 2. Stable idempotency keys (clientGeneratedId) across retries and restarts.
 * 3. Exponential backoff and retry scheduling for transient network errors.
 * 4. HTTP 401 handling: pause synchronization without incrementing retry count or failing.
 * 5. HTTP 403 handling: quarantine operation (QUARANTINED) due to authorization or tenant mismatch.
 * 6. HTTP 409 handling: resolve idempotently as success if order was already recorded, or quarantine if conflict mismatch.
 * 7. Tenant switching & logout safety: pending orders in local storage are NEVER deleted or reassigned.
 */

import { OrderAggregate } from '../types/order-domain';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'PAUSED' | 'QUARANTINED';

export interface QueuedOrderRecord {
  clientGeneratedId: string;
  order: OrderAggregate;
  originalTenantId: string; // Immutable tenant binding
  enqueuedAt: number;
  syncStatus: SyncStatus;
  retryCount: number;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
  errorMessage?: string;
  quarantineReason?: string;
}

export interface SyncEngineOptions {
  apiBaseUrl: string;
  maxRetries?: number;
  syncIntervalMs?: number;
  tenantId?: string;
  getAuthToken?: () => Promise<string | null>;
  onSyncSuccess?: (clientGeneratedId: string, order: OrderAggregate) => void;
  onSyncFailure?: (clientGeneratedId: string, error: string) => void;
}

export type QueueStats = {
  total: number;
  pending: number;
  failed: number;
  paused: number;
  quarantined: number;
};

type QueueListener = (stats: QueueStats) => void;

export class OfflineSyncQueue {
  private static readonly DB_NAME_PREFIX = 'CafeOS_OfflineDB';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'order_queue';
  private readonly tenantId: string;
  private readonly dbName: string;

  private db: IDBDatabase | null = null;
  private isSyncing = false;
  private isAuthPaused = false;
  private syncTimer: number | null = null;
  private readonly maxRetries: number;
  private readonly syncIntervalMs: number;
  private readonly apiBaseUrl: string;
  private readonly getAuthToken?: () => Promise<string | null>;
  private readonly onSyncSuccess?: (clientGeneratedId: string, order: OrderAggregate) => void;
  private readonly onSyncFailure?: (clientGeneratedId: string, error: string) => void;
  private listeners: Set<QueueListener> = new Set();

  constructor(options: SyncEngineOptions) {
    this.apiBaseUrl = options.apiBaseUrl;
    this.maxRetries = options.maxRetries ?? 5;
    this.syncIntervalMs = options.syncIntervalMs ?? 15000;
    this.getAuthToken = options.getAuthToken;
    this.onSyncSuccess = options.onSyncSuccess;
    this.onSyncFailure = options.onSyncFailure;

    const resolvedTenant =
      options.tenantId ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('cafeos_active_tenant_id')
        ? JSON.parse(localStorage.getItem('cafeos_active_tenant_id') || '""')
        : '') ||
      'tenant-100hich-01';

    this.tenantId = resolvedTenant;
    this.dbName = `CafeOS_OfflineDB_${resolvedTenant}`;

    this.initNetworkListeners();
  }

  // -------------------------------------------------------------
  // ۱. راه‌اندازی و باز کردن IndexedDB
  // -------------------------------------------------------------
  public async init(): Promise<void> {
    if (this.db) return;

    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB is not available in this environment.');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, OfflineSyncQueue.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(OfflineSyncQueue.STORE_NAME)) {
          const store = db.createObjectStore(OfflineSyncQueue.STORE_NAME, {
            keyPath: 'clientGeneratedId',
          });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('enqueuedAt', 'enqueuedAt', { unique: false });
          store.createIndex('originalTenantId', 'originalTenantId', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.startPeriodicSync();
        this.notifyListeners();
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });
  }

  // -------------------------------------------------------------
  // ۲. افزودن سفارش به صف لوکال با پیوند تننت تغییرناپذیر
  // -------------------------------------------------------------
  public async enqueue(order: OrderAggregate): Promise<void> {
    await this.ensureReady();

    // Immutable original tenant binding
    const originalTenantId = order.tenantId || this.tenantId;
    const clientGeneratedId = order.clientGeneratedId || order.id || (order as any).lifecycle?.orderId || `ord_${Date.now()}`;

    const record: QueuedOrderRecord = {
      clientGeneratedId,
      order: {
        ...order,
        clientGeneratedId,
        tenantId: originalTenantId, // Guarantees original tenant binding
      },
      originalTenantId,
      enqueuedAt: Date.now(),
      syncStatus: 'PENDING',
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readwrite');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
        // تلاش فوری برای سینک اگر آنلاین باشیم و احراز هویت متوقف نشده باشد
        if (typeof navigator !== 'undefined' && navigator.onLine && !this.isAuthPaused) {
          this.triggerSync();
        }
      };

      request.onerror = () => {
        reject(new Error(`Enqueue failed: ${request.error?.message}`));
      };
    });
  }

  // -------------------------------------------------------------
  // ۳. هستهٔ همگام‌سازی (Sync Loop)
  // -------------------------------------------------------------
  public async triggerSync(): Promise<void> {
    if (this.isSyncing) return;
    if (this.isAuthPaused) return; // Paused on 401
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    await this.ensureReady();

    this.isSyncing = true;

    try {
      const pendingItems = await this.getPendingOrders();
      if (pendingItems.length === 0) {
        return;
      }

      const now = Date.now();
      for (const item of pendingItems) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        if (this.isAuthPaused) break;

        // Skip quarantined or failed orders
        if (item.syncStatus === 'QUARANTINED' || item.syncStatus === 'FAILED') continue;

        // Respect exponential backoff scheduling
        if (item.nextAttemptAt && item.nextAttemptAt > now) {
          continue;
        }

        if (item.retryCount >= this.maxRetries) {
          continue;
        }

        await this.syncSingleOrder(item);
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  // -------------------------------------------------------------
  // ۴. ارسال تک‌سفارش با مدیریت تخصصی کدهای وضعیت HTTP
  // -------------------------------------------------------------
  public async syncSingleOrder(record: QueuedOrderRecord): Promise<void> {
    await this.updateRecordStatus(record.clientGeneratedId, 'SYNCING');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Tenant-Id': record.originalTenantId,
        'Idempotency-Key': record.clientGeneratedId,
      };

      if (this.getAuthToken) {
        const token = await this.getAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.apiBaseUrl}/api/v1/orders/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source: 'POS',
          clientGeneratedId: record.clientGeneratedId,
          order: record.order,
        }),
      });

      // 1. HTTP 401: Pause sync without consuming retries or deleting
      if (response.status === 401) {
        this.isAuthPaused = true;
        await this.updateRecordFailure(record.clientGeneratedId, {
          syncStatus: 'PAUSED',
          retryCount: record.retryCount, // Does not consume retry count!
          errorMessage: 'HTTP 401: Authentication required. Synchronization paused.',
        });
        this.onSyncFailure?.(record.clientGeneratedId, 'HTTP 401: Authentication required. Synchronization paused.');
        return;
      }

      // 2. HTTP 403: Quarantine operation due to forbidden / cross-tenant access
      if (response.status === 403) {
        await this.quarantineRecord(
          record.clientGeneratedId,
          'HTTP 403: Forbidden. Quarantined due to cross-tenant or permission mismatch.'
        );
        this.onSyncFailure?.(record.clientGeneratedId, 'HTTP 403: Quarantined.');
        return;
      }

      // 3. HTTP 409: Idempotency conflict resolution
      if (response.status === 409) {
        let conflictBody: any = null;
        try {
          conflictBody = await response.json();
        } catch {
          // ignore
        }

        // If server confirms order was already synced / recorded with matching idempotency
        if (conflictBody?.isIdempotentReplay || conflictBody?.status === 'ALREADY_SYNCED' || conflictBody?.success) {
          await this.removeRecord(record.clientGeneratedId);
          this.onSyncSuccess?.(record.clientGeneratedId, record.order);
          return;
        }

        // Unresolvable conflict mismatch: quarantine for inspection
        await this.quarantineRecord(
          record.clientGeneratedId,
          `HTTP 409 Conflict: Payload mismatch with existing server record: ${conflictBody?.error || 'Conflict'}`
        );
        this.onSyncFailure?.(record.clientGeneratedId, 'HTTP 409: Conflict quarantined.');
        return;
      }

      // 4. Other HTTP errors (5xx, 400, etc.)
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      // Success (200 / 201)
      await this.removeRecord(record.clientGeneratedId);
      this.onSyncSuccess?.(record.clientGeneratedId, record.order);
    } catch (err: any) {
      // Exponential backoff calculation
      const nextRetry = record.retryCount + 1;
      const delayMs = Math.min(1000 * Math.pow(2, record.retryCount), 60000); // 1s, 2s, 4s, 8s, up to 60s
      const status: SyncStatus = nextRetry >= this.maxRetries ? 'FAILED' : 'PENDING';
      const errorMessage = err?.message || 'Network sync error';

      await this.updateRecordFailure(record.clientGeneratedId, {
        syncStatus: status,
        retryCount: nextRetry,
        errorMessage,
        nextAttemptAt: Date.now() + delayMs,
      });

      this.onSyncFailure?.(record.clientGeneratedId, errorMessage);
    }
  }

  // -------------------------------------------------------------
  // ۵. مدیریت حالت وقفه و قرنطینه
  // -------------------------------------------------------------
  public resumeAuth(): void {
    this.isAuthPaused = false;
    this.triggerSync();
  }

  public isPaused(): boolean {
    return this.isAuthPaused;
  }

  public async quarantineRecord(clientGeneratedId: string, reason: string): Promise<void> {
    const record = await this.getRecord(clientGeneratedId);
    if (!record) return;

    record.syncStatus = 'QUARANTINED';
    record.quarantineReason = reason;
    record.errorMessage = reason;
    record.lastAttemptAt = Date.now();
    await this.saveRecord(record);
    this.notifyListeners();
  }

  public async getPendingOrders(): Promise<QueuedOrderRecord[]> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readonly');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as QueuedOrderRecord[]) || [];
        const pending = results
          .filter((r) => r.syncStatus === 'PENDING' || r.syncStatus === 'PAUSED' || r.syncStatus === 'FAILED')
          .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
        resolve(pending);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async getQuarantinedOrders(): Promise<QueuedOrderRecord[]> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readonly');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as QueuedOrderRecord[]) || [];
        resolve(results.filter((r) => r.syncStatus === 'QUARANTINED'));
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async getQueueCount(): Promise<QueueStats> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve({ total: 0, pending: 0, failed: 0, paused: 0, quarantined: 0 });
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readonly');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = (request.result as QueuedOrderRecord[]) || [];
        resolve({
          total: all.length,
          pending: all.filter((r) => r.syncStatus === 'PENDING' || r.syncStatus === 'SYNCING').length,
          failed: all.filter((r) => r.syncStatus === 'FAILED').length,
          paused: all.filter((r) => r.syncStatus === 'PAUSED').length,
          quarantined: all.filter((r) => r.syncStatus === 'QUARANTINED').length,
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async updateRecordStatus(clientGeneratedId: string, status: SyncStatus): Promise<void> {
    const record = await this.getRecord(clientGeneratedId);
    if (!record) return;

    record.syncStatus = status;
    record.lastAttemptAt = Date.now();
    await this.saveRecord(record);
    this.notifyListeners();
  }

  private async updateRecordFailure(
    clientGeneratedId: string,
    meta: { syncStatus: SyncStatus; retryCount: number; errorMessage: string; nextAttemptAt?: number }
  ): Promise<void> {
    const record = await this.getRecord(clientGeneratedId);
    if (!record) return;

    record.syncStatus = meta.syncStatus;
    record.retryCount = meta.retryCount;
    record.errorMessage = meta.errorMessage;
    record.lastAttemptAt = Date.now();
    record.nextAttemptAt = meta.nextAttemptAt;
    await this.saveRecord(record);
    this.notifyListeners();
  }

  public async removeRecord(clientGeneratedId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readwrite');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.delete(clientGeneratedId);

      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async getRecord(clientGeneratedId: string): Promise<QueuedOrderRecord | undefined> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(undefined);
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readonly');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.get(clientGeneratedId);

      request.onsuccess = () => resolve(request.result as QueuedOrderRecord | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  public async saveRecord(record: QueuedOrderRecord): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readwrite');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureReady(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  private initNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.triggerSync();
      });
    }
  }

  private startPeriodicSync(): void {
    if (typeof window !== 'undefined' && !this.syncTimer) {
      this.syncTimer = window.setInterval(() => {
        if (navigator.onLine && !this.isSyncing && !this.isAuthPaused) {
          this.triggerSync();
        }
      }, this.syncIntervalMs);
    }
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    this.getQueueCount().then((stats) => listener(stats)).catch(() => {});
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.getQueueCount()
      .then((stats) => {
        for (const listener of this.listeners) {
          try {
            listener(stats);
          } catch (e) {
            console.error('Error in queue listener:', e);
          }
        }
      })
      .catch(() => {});
  }

  public destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.listeners.clear();
  }

  public getDatabaseName(): string {
    return this.dbName;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public async clearForTest(): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(OfflineSyncQueue.STORE_NAME, 'readwrite');
      const store = tx.objectStore(OfflineSyncQueue.STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const tenantQueueRegistry = new Map<string, OfflineSyncQueue>();

export function getOfflineSyncQueueForTenant(
  tenantId: string,
  options?: Partial<SyncEngineOptions>
): OfflineSyncQueue {
  if (!tenantQueueRegistry.has(tenantId)) {
    tenantQueueRegistry.set(
      tenantId,
      new OfflineSyncQueue({
        apiBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
        maxRetries: 5,
        syncIntervalMs: 12000,
        ...options,
        tenantId,
      })
    );
  }
  return tenantQueueRegistry.get(tenantId)!;
}

// Singleton instance for client app
export const globalOfflineSyncQueue = new OfflineSyncQueue({
  apiBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  maxRetries: 5,
  syncIntervalMs: 12000,
});
