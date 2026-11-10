import Dexie, { Table } from 'dexie';
import { InventoryItem, MenuItem, Order, AuditLog } from '../types/db';
import {
  AuthUserRecord,
  AppSettingRecord,
  HardwareDeviceProfile,
  ElevationAuditLog,
} from '../types/rbac-settings';
import {
  ZReportData,
  StockInwardTransaction,
} from '../types/zreport-inventory';

export class CafeDatabase extends Dexie {
  inventoryItems!: Table<InventoryItem, string>;
  menuItems!: Table<MenuItem, string>;
  orders!: Table<Order, string>;
  auditLogs!: Table<AuditLog, string>;

  // CafeOS RBAC, Settings & Hardware Hub (v2.4.0)
  authUsers!: Table<AuthUserRecord, string>;
  appSettings!: Table<AppSettingRecord, string>;
  printerProfiles!: Table<HardwareDeviceProfile, string>;
  elevationAuditLogs!: Table<ElevationAuditLog, string>;

  // CafeOS Shift Z-Report & Inventory Inward (v2.5.0)
  zReports!: Table<ZReportData, string>;
  stockInwardTransactions!: Table<StockInwardTransaction, string>;

  // CafeOS Customer CRM (v2.6.0)
  customers!: Table<{
    id: string;
    phone: string;
    name: string;
    tenantId: string;
    createdAt: number;
  }, string>;

  constructor(dbName: string = 'CafeOS_LocalDB') {
    super(dbName);
    this.version(1).stores({
      inventoryItems: 'id, name, category, currentStock',
      menuItems: 'id, categoryId, title, isAvailable',
      orders: 'id, orderNumber, tableId, status, createdAt, synced',
      auditLogs: 'id, orderId, action, timestamp',
    });

    this.version(2).stores({
      inventoryItems: 'id, name, category, currentStock',
      menuItems: 'id, categoryId, title, isAvailable',
      orders: 'id, orderNumber, tableId, status, createdAt, synced',
      auditLogs: 'id, orderId, action, timestamp',
      authUsers: 'id, username, role, isActive',
      appSettings: 'key, updatedAt',
      printerProfiles: 'id, alias, station, connection_type, paper_width_mm, isDefault',
      elevationAuditLogs: 'id, action_type, requested_by_user, authorized_by_manager, timestamp, status',
    });

    this.version(3).stores({
      inventoryItems: 'id, name, category, currentStock',
      menuItems: 'id, categoryId, title, isAvailable',
      orders: 'id, orderNumber, tableId, status, createdAt, synced',
      auditLogs: 'id, orderId, action, timestamp',
      authUsers: 'id, username, role, isActive',
      appSettings: 'key, updatedAt',
      printerProfiles: 'id, alias, station, connection_type, paper_width_mm, isDefault',
      elevationAuditLogs: 'id, action_type, requested_by_user, authorized_by_manager, timestamp, status',
      zReports: 'id, shift_id, timestamp, opened_by, closed_by',
      stockInwardTransactions: 'id, raw_item_id, batch_number, timestamp, supplier_name',
      customers: 'id, phone, name, tenantId, createdAt',
    });
  }
}

// -----------------------------------------------------------------------------
// Multi-Tenant Isolated Database Registry & Resolvers (Phase 1 Remediation)
// -----------------------------------------------------------------------------

const dbRegistry = new Map<string, CafeDatabase>();

function resolveActiveTenantId(): string {
  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      const stored = localStorage.getItem('cafeos_active_tenant_id');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'string' && parsed.trim()) {
          return parsed.trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return 'tenant-100hich-01';
}

export function getTenantDatabaseName(tenantId?: string): string {
  const resolved = tenantId && tenantId.trim() ? tenantId.trim() : resolveActiveTenantId();
  return `CafeOS_LocalDB_${resolved}`;
}

/**
 * Returns an isolated CafeDatabase instance strictly scoped to the specified tenant.
 */
export function getCafeDatabase(tenantId?: string): CafeDatabase {
  const dbName = getTenantDatabaseName(tenantId);
  if (!dbRegistry.has(dbName)) {
    dbRegistry.set(dbName, new CafeDatabase(dbName));
  }
  return dbRegistry.get(dbName)!;
}

/**
 * Dynamic Proxy providing backward-compatible access to the active tenant's database.
 * Every access (e.g. db.orders, db.inventoryItems, db.transaction) delegates to getCafeDatabase().
 */
export const db: CafeDatabase = new Proxy({} as CafeDatabase, {
  get(_target, prop: string | symbol) {
    const activeDb = getCafeDatabase();
    const val = (activeDb as any)[prop];
    if (typeof val === 'function') {
      return val.bind(activeDb);
    }
    return val;
  },
  set(_target, prop: string | symbol, value: any) {
    const activeDb = getCafeDatabase();
    (activeDb as any)[prop] = value;
    return true;
  },
});

/**
 * Idempotent, non-destructive legacy IndexedDB migration.
 * Inspects legacy 'CafeOS_LocalDB', copies records to 'CafeOS_LocalDB_tenant-100hich-01',
 * and leaves the legacy database intact for rollback safety.
 */
export async function migrateLegacyCafeDatabase(): Promise<{
  migrated: boolean;
  recordsMigrated: Record<string, number>;
  targetDatabase: string;
  message: string;
}> {
  const targetDb = getCafeDatabase('tenant-100hich-01');
  const legacyDb = new CafeDatabase('CafeOS_LocalDB');

  const recordsMigrated: Record<string, number> = {};
  let totalCount = 0;

  try {
    // 1. Check if target database already has records
    const targetOrderCount = await targetDb.orders.count();
    const targetInvCount = await targetDb.inventoryItems.count();
    if (targetOrderCount > 0 || targetInvCount > 0) {
      return {
        migrated: false,
        recordsMigrated: {},
        targetDatabase: targetDb.name,
        message: 'Target database already populated; migration skipped to preserve integrity.',
      };
    }

    // 2. Read from legacy database
    const legacyOrders = await legacyDb.orders.toArray();
    const legacyInventory = await legacyDb.inventoryItems.toArray();
    const legacyMenuItems = await legacyDb.menuItems.toArray();
    const legacySettings = await legacyDb.appSettings.toArray();
    const legacyPrinters = await legacyDb.printerProfiles.toArray();
    const legacyUsers = await legacyDb.authUsers.toArray();

    if (legacyOrders.length > 0) {
      await targetDb.orders.bulkPut(legacyOrders);
      recordsMigrated.orders = legacyOrders.length;
      totalCount += legacyOrders.length;
    }
    if (legacyInventory.length > 0) {
      await targetDb.inventoryItems.bulkPut(legacyInventory);
      recordsMigrated.inventoryItems = legacyInventory.length;
      totalCount += legacyInventory.length;
    }
    if (legacyMenuItems.length > 0) {
      await targetDb.menuItems.bulkPut(legacyMenuItems);
      recordsMigrated.menuItems = legacyMenuItems.length;
      totalCount += legacyMenuItems.length;
    }
    if (legacySettings.length > 0) {
      await targetDb.appSettings.bulkPut(legacySettings);
      recordsMigrated.appSettings = legacySettings.length;
      totalCount += legacySettings.length;
    }
    if (legacyPrinters.length > 0) {
      await targetDb.printerProfiles.bulkPut(legacyPrinters);
      recordsMigrated.printerProfiles = legacyPrinters.length;
      totalCount += legacyPrinters.length;
    }
    if (legacyUsers.length > 0) {
      await targetDb.authUsers.bulkPut(legacyUsers);
      recordsMigrated.authUsers = legacyUsers.length;
      totalCount += legacyUsers.length;
    }

    return {
      migrated: totalCount > 0,
      recordsMigrated,
      targetDatabase: targetDb.name,
      message: totalCount > 0
        ? `Successfully migrated ${totalCount} records from legacy CafeOS_LocalDB to ${targetDb.name}`
        : 'Legacy database was empty; no records to migrate.',
    };
  } catch (err: any) {
    return {
      migrated: false,
      recordsMigrated,
      targetDatabase: targetDb.name,
      message: `IndexedDB migration non-fatal notice: ${err?.message}`,
    };
  }
}
