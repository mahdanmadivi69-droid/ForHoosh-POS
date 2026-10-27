import { OrderAggregate } from '../types/order-domain';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface QueuedOrderRecord {
  clientGeneratedId: string;
  order: OrderAggregate;
  enqueuedAt: number;
  syncStatus: SyncStatus;
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
}

export interface SyncEngineOptions {
  apiBaseUrl: string;
  maxRetries?: number;
  syncIntervalMs?: number;
  getAuthToken?: () => Promise<string | null>;
  onSyncSuccess?: (clientGeneratedId: string, order: OrderAggregate) => void;
  onSyncFailure?: (clientGeneratedId: string, error: string) => void;
}

export type QueueStats = { total: number; pending: number; failed: number };
type QueueListener = (stats: QueueStats) => void;

export class OfflineSyncQueue {
  private static readonly DB_NAME = 'CafeOS_OfflineDB';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'order_queue';

  private db: IDBDatabase | null = null;
  private isSyncing = false;
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
      const request = indexedDB.open(OfflineSyncQueue.DB_NAME, OfflineSyncQueue.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(OfflineSyncQueue.STORE_NAME)) {
          const store = db.createObjectStore(OfflineSyncQueue.STORE_NAME, {
            keyPath: 'clientGeneratedId',
          });
          // ایندکس‌ها برای کوئری‌های سریع روی وضعیت سفارش‌ها
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('enqueuedAt', 'enqueuedAt', { unique: false });
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
  // ۲. افزودن سفارش به صف لوکال
  // -------------------------------------------------------------
  public async enqueue(order: OrderAggregate): Promise<void> {
    await this.ensureReady();

    const record: QueuedOrderRecord = {
      clientGeneratedId: order.clientGeneratedId,
      order,
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
        // تلاش فوری برای سینک اگر آنلاین باشیم
        if (typeof navigator !== 'undefined' && navigator.onLine) {
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    await this.ensureReady();

    this.isSyncing = true;

    try {
      const pendingItems = await this.getPendingOrders();
      if (pendingItems.length === 0) {
        return;
      }

      for (const item of pendingItems) {
        // اگر دستگاه در حین عملیات آفلاین شد، حلقه را متوقف کن
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;

        // رد کردن مواردی که به سقف تلاش رسیده‌اند
        if (item.retryCount >= this.maxRetries) continue;

        await this.syncSingleOrder(item);
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  // -------------------------------------------------------------
  // ۴. ارسال تک‌سفارش به بک‌اند با لاجیک Idempotent
  // -------------------------------------------------------------
  private async syncSingleOrder(record: QueuedOrderRecord): Promise<void> {
    await this.updateRecordStatus(record.clientGeneratedId, 'SYNCING');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Tenant-Id': record.order.tenantId,
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

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      // با موفقیت ثبت شد: پاکسازی از صف آفلاین لوکال
      await this.removeRecord(record.clientGeneratedId);
      if (this.onSyncSuccess) {
        this.onSyncSuccess(record.clientGeneratedId, record.order);
      }
    } catch (err: any) {
      const nextRetry = record.retryCount + 1;
      const status: SyncStatus = nextRetry >= this.maxRetries ? 'FAILED' : 'PENDING';
      const errorMessage = err?.message || 'Network sync error';

      await this.updateRecordFailure(record.clientGeneratedId, {
        syncStatus: status,
        retryCount: nextRetry,
        errorMessage,
      });

      if (this.onSyncFailure) {
        this.onSyncFailure(record.clientGeneratedId, errorMessage);
      }
    }
  }

  // -------------------------------------------------------------
  // ۵. متدهای دسترسی مستقیم به داده‌های لوکال (CRUD)
  // -------------------------------------------------------------
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
        // فیلتر کردن موارد معلق و مرتب‌سازی به صورت FIFO
        const pending = results
          .filter((r) => r.syncStatus === 'PENDING' || r.syncStatus === 'FAILED')
          .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
        resolve(pending);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async getQueueCount(): Promise<QueueStats> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve({ total: 0, pending: 0, failed: 0 });
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
    meta: { syncStatus: SyncStatus; retryCount: number; errorMessage: string }
  ): Promise<void> {
    const record = await this.getRecord(clientGeneratedId);
    if (!record) return;

    record.syncStatus = meta.syncStatus;
    record.retryCount = meta.retryCount;
    record.errorMessage = meta.errorMessage;
    record.lastAttemptAt = Date.now();
    await this.saveRecord(record);
    this.notifyListeners();
  }

  private async removeRecord(clientGeneratedId: string): Promise<void> {
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

  private async getRecord(clientGeneratedId: string): Promise<QueuedOrderRecord | undefined> {
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

  private async saveRecord(record: QueuedOrderRecord): Promise<void> {
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
        if (navigator.onLine && !this.isSyncing) {
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
}

// Singleton instance for client app
export const globalOfflineSyncQueue = new OfflineSyncQueue({
  apiBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  maxRetries: 5,
  syncIntervalMs: 12000,
});
