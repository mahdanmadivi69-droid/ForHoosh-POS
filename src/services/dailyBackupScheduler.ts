/**
 * CAFE OS — Client Daily Backup & Cloud Queue Scheduler
 * Automatically orchestrates periodic sync of OfflineSyncQueue,
 * compiles daily financial snapshots, and persists to Cloud PostgreSQL.
 */

import { globalOfflineSyncQueue, QueueStats } from './offlineSyncQueue';
import { SmartOrdersStore } from './storage';

export interface CloudSyncStatus {
  isCloudConnected: boolean;
  provider: string;
  database?: string;
  latencyMs?: number;
  lastBackupAt: string | null;
  queueStats: QueueStats;
  isSyncing: boolean;
  errorMessage?: string;
}

export type CloudSyncListener = (status: CloudSyncStatus) => void;

class DailyBackupSchedulerClass {
  private syncIntervalTimer: any = null;
  private listeners: Set<CloudSyncListener> = new Set();
  private status: CloudSyncStatus = {
    isCloudConnected: false,
    provider: 'Checking...',
    lastBackupAt: null,
    queueStats: { total: 0, pending: 0, failed: 0 },
    isSyncing: false,
  };

  constructor() {
    this.init();
  }

  public init(): void {
    if (typeof window === 'undefined') return;

    // 1. Subscribe to OfflineSyncQueue changes
    globalOfflineSyncQueue.subscribe((stats) => {
      this.status.queueStats = stats;
      this.notify();
    });

    // 2. Initialize Queue
    globalOfflineSyncQueue.init().catch(console.error);

    // 3. Network listeners for instant sync on reconnection
    window.addEventListener('online', () => {
      console.log('🌐 [DailyBackupScheduler] Network reconnected, triggering instant queue sync...');
      this.triggerQueueSync();
      this.checkCloudStatus();
    });

    // 4. Start periodic 15-second queue sync
    this.syncIntervalTimer = setInterval(() => {
      if (navigator.onLine) {
        this.triggerQueueSync();
      }
    }, 15000);

    // 5. Initial status check
    this.checkCloudStatus();

    // 6. Check if daily backup is needed on launch
    this.evaluateDailyBackup();
  }

  /**
   * Check connection status with backend cloud database
   */
  public async checkCloudStatus(): Promise<CloudSyncStatus> {
    if (typeof window === 'undefined') return this.status;

    try {
      const activeTenantId = SmartOrdersStore.getActiveTenantId();
      const res = await fetch(`${window.location.origin}/api/v1/cloud-backup/status`, {
        headers: { 'X-Tenant-Id': activeTenantId },
      });
      if (res.ok) {
        const data = await res.json();
        this.status.isCloudConnected = data.connected;
        this.status.provider = data.provider || 'PostgreSQL-Cloud';
        this.status.database = data.database;
        this.status.latencyMs = data.latencyMs;
        if (data.lastBackupAt) {
          this.status.lastBackupAt = data.lastBackupAt;
        }
      }
    } catch (e: any) {
      this.status.isCloudConnected = false;
      this.status.provider = 'Standby-Offline';
      this.status.errorMessage = e.message;
    }

    // Load last local backup timestamp
    const tenantId = SmartOrdersStore.getActiveTenantId();
    const storedLastBackup = localStorage.getItem(`smartorders_last_cloud_backup_${tenantId}`);
    if (storedLastBackup && !this.status.lastBackupAt) {
      this.status.lastBackupAt = storedLastBackup;
    }

    this.notify();
    return { ...this.status };
  }

  /**
   * Manually or periodically trigger sync of pending orders
   */
  public async triggerQueueSync(): Promise<void> {
    this.status.isSyncing = true;
    this.notify();
    try {
      await globalOfflineSyncQueue.triggerSync();
    } finally {
      this.status.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Evaluates if 24 hours have passed since last cloud backup, and triggers if needed
   */
  public async evaluateDailyBackup(): Promise<void> {
    const tenantId = SmartOrdersStore.getActiveTenantId();
    const lastBackupKey = `smartorders_last_cloud_backup_${tenantId}`;
    const lastBackupIso = localStorage.getItem(lastBackupKey);

    const now = new Date();
    const todayYmd = now.toISOString().slice(0, 10);

    if (lastBackupIso) {
      const lastDate = lastBackupIso.slice(0, 10);
      if (lastDate === todayYmd) {
        // Already backed up today
        return;
      }
    }

    // If online and shifts exist, trigger daily backup
    if (navigator.onLine && SmartOrdersStore.getShifts().length > 0) {
      console.log('📦 [DailyBackupScheduler] New day detected. Executing automated daily cloud backup...');
      await this.triggerDailyBackup();
    }
  }

  /**
   * Compiles full tenant state and saves to Cloud PostgreSQL
   */
  public async triggerDailyBackup(): Promise<{ success: boolean; message: string; record?: any }> {
    if (typeof window === 'undefined') {
      return { success: false, message: 'Window not available' };
    }

    this.status.isSyncing = true;
    this.notify();

    try {
      const tenant = SmartOrdersStore.getTenant();
      const shifts = SmartOrdersStore.getShifts();
      const orders = SmartOrdersStore.getOrders();
      const payments = SmartOrdersStore.getPayments();
      const expenses = SmartOrdersStore.getExpenses();
      const menuItems = SmartOrdersStore.getMenuItems();
      const categories = SmartOrdersStore.getCategories();
      const auditLogs = SmartOrdersStore.getAuditLogs();
      const activeUser = SmartOrdersStore.getActiveUser();

      const todayYmd = new Date().toISOString().slice(0, 10);

      const totalRevenueToman = orders
        .filter((o) => o.status === 'COMPLETED')
        .reduce((sum, o) => sum + (o.netTotalToman || 0), 0);
      const totalExpensesToman = expenses.reduce((sum, e) => sum + (e.amountToman || 0), 0);

      const payload = {
        tenantId: tenant.id,
        backupDate: todayYmd,
        tenant,
        categories,
        menuItems,
        shifts,
        orders,
        payments,
        expenses,
        auditLogs,
        metadata: {
          totalOrders: orders.length,
          totalRevenueToman,
          totalExpensesToman,
          exportedBy: activeUser.fullName,
        },
      };

      const res = await fetch(`${window.location.origin}/api/v1/cloud-backup/daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenant.id,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const result = await res.json();
      const nowIso = new Date().toISOString();

      localStorage.setItem(`smartorders_last_cloud_backup_${tenant.id}`, nowIso);
      this.status.lastBackupAt = nowIso;
      this.status.isCloudConnected = true;

      SmartOrdersStore.addAuditLog(
        'CLOUD_BACKUP_COMPLETED',
        'System',
        tenant.id,
        `بک‌آپ روزانه ابری در تاریخ ${todayYmd} با ${orders.length} فاکتور با موفقیت به دیتابیس ابری ارسال شد.`
      );

      return {
        success: true,
        message: `بک‌آپ ابری روزانه با موفقیت ثبت شد (${orders.length} سفارش).`,
        record: result.record,
      };
    } catch (err: any) {
      console.error('[DailyBackupScheduler] Cloud backup failed:', err);
      return {
        success: false,
        message: `خطا در ارسال بک‌آپ به سرور ابری: ${err.message}`,
      };
    } finally {
      this.status.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Fetch backup history from cloud
   */
  public async getCloudBackupHistory(): Promise<any[]> {
    if (typeof window === 'undefined') return [];
    try {
      const activeTenantId = SmartOrdersStore.getActiveTenantId();
      const res = await fetch(`${window.location.origin}/api/v1/cloud-backup/history`, {
        headers: { 'X-Tenant-Id': activeTenantId },
      });
      if (res.ok) {
        const data = await res.json();
        return data.backups || [];
      }
    } catch (e) {
      console.warn('[DailyBackupScheduler] Failed to fetch cloud backup history:', e);
    }
    return [];
  }

  public subscribe(listener: CloudSyncListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.status });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = { ...this.status };
    this.listeners.forEach((l) => {
      try {
        l(current);
      } catch (e) {
        console.error('Error in listener:', e);
      }
    });
  }

  public destroy(): void {
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer);
      this.syncIntervalTimer = null;
    }
    this.listeners.clear();
  }
}

export const dailyBackupScheduler = new DailyBackupSchedulerClass();
