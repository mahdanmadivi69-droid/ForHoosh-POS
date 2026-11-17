import Dexie, { Table } from 'dexie';
import { InventoryItem, MenuItem, Order, AuditLog } from '../types/db';
import type { Order as DomainOrder } from '../types/domain';
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
  /** Legacy `types/db` order shape used only by the orphaned `orderService.ts`. */
  orders!: Table<Order, string>;
  auditLogs!: Table<AuditLog, string>;
  /**
   * P0-2 order ledger mirror. Stores the *domain* order shape used by
   * `src/services/storage.ts` (ISO `createdAt`, `netTotalToman`, ...) without
   * touching the legacy `orders` table or the localStorage data shape.
   */
  posOrders!: Table<DomainOrder, string>;

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

  // CafeOS Offline Synchronization Queue (v2.7.0)
  syncQueue!: Table<{
    id: string;
    clientGeneratedId: string;
    tenantId: string;
    syncStatus: string;
    retryCount: number;
    payload: any;
    createdAt: string;
    lastAttemptAt?: string;
    nextAttemptAt?: string;
    errorMessage?: string;
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
      syncQueue: 'id, clientGeneratedId, tenantId, syncStatus, createdAt',
      posOrders: 'id, orderNumber, shiftId, status, createdAt',
    });

    this.version(4).stores({
      posOrders: 'id, orderNumber, shiftId, status, createdAt',
    });
  }
}

// -----------------------------------------------------------------------------
// Multi-Tenant Isolated Database Registry & Resolvers
// -----------------------------------------------------------------------------

const dbRegistry = new Map<string, CafeDatabase>();

export const MODENDO_STORE_METADATA = {
  name_fa: 'کافه گیمینگ مودندو',
  name_en: 'Modendo Gaming Lounge',
  address: 'تهران، خیابان شریعتی، مجتمع مودندو، منفی ۱',
  phone: '021-88994455',
  tax_registration_no: '14009876543',
};

export const MODENDO_RECEIPT_METADATA = {
  header_lines: [
    '*** کافه گیمینگ مودندو ***',
    'مرکز بازی‌های رومیزی و اتاق کنسول PS5',
  ],
  footer_lines: [
    'لحظاتی خوش و ماندگار در کافه گیمینگ مودندو',
    'Wi-Fi: Modendo-Guest / Pass: modendo2026',
    'اینستاگرام: @modendo.cafe',
  ],
  print_qr_invoice_link: true,
};

export const MODENDO_DEFAULT_INVENTORY: Array<{
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  costPerUnit: number;
  minThreshold: number;
}> = [
  {
    id: 'mod_ing_espresso_blend',
    name: 'دانه قهوه دارک رست مودندو',
    category: 'raw_materials',
    currentStock: 9500,
    unit: 'g',
    costPerUnit: 1400,
    minThreshold: 2000,
  },
  {
    id: 'mod_ing_milk',
    name: 'شیر تازه ۳.۰٪ مودندو',
    category: 'raw_materials',
    currentStock: 16000,
    unit: 'ml',
    costPerUnit: 60,
    minThreshold: 4000,
  },
  {
    id: 'mod_ing_burger_patty',
    name: 'پتی برگر گوشت گوساله ۱۵۰ گرمی',
    category: 'raw_materials',
    currentStock: 35,
    unit: 'piece',
    costPerUnit: 85000,
    minThreshold: 12,
  },
  {
    id: 'mod_ing_burger_bun',
    name: 'نان همبرگر بریوش مودندو',
    category: 'raw_materials',
    currentStock: 40,
    unit: 'piece',
    costPerUnit: 18000,
    minThreshold: 15,
  },
  {
    id: 'mod_ing_fries',
    name: 'سیب‌زمینی نیمه‌آماده منجمد مودندو',
    category: 'raw_materials',
    currentStock: 25000,
    unit: 'g',
    costPerUnit: 110,
    minThreshold: 5000,
  },
  {
    id: 'mod_ing_cheddar',
    name: 'پنیر چدار ورقه‌ای مودندو',
    category: 'raw_materials',
    currentStock: 60,
    unit: 'piece',
    costPerUnit: 9000,
    minThreshold: 20,
  },
];

export function resolveActiveTenantId(): string {
  // Check build-time or runtime environment variables first
  const envTenant =
    (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_TENANT_ID || (import.meta as any).env?.VITE_ACTIVE_TENANT)) ||
    (typeof process !== 'undefined' && (process.env?.VITE_TENANT_ID || process.env?.VITE_ACTIVE_TENANT)) ||
    '';
  const envMode =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE) ||
    (typeof process !== 'undefined' && (process.env?.NODE_ENV || process.env?.MODE)) ||
    '';

  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      const stored = localStorage.getItem('cafeos_active_tenant_id');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'string' && parsed.trim()) {
          const val = parsed.trim();
          if (val === 'modendo') return 'tenant-modendo-01';
          if (val === '100hich') return 'tenant-100hich-01';
          return val;
        }
      }
    } catch {
      // ignore
    }
  }

  if (envTenant) {
    if (/modendo/i.test(envTenant)) return 'tenant-modendo-01';
    if (/100hich/i.test(envTenant)) return 'tenant-100hich-01';
    return envTenant;
  }

  if (envMode === 'modendo' || /modendo/i.test(envMode)) {
    return 'tenant-modendo-01';
  }

  return 'tenant-100hich-01';
}

export function getTenantDatabaseName(tenantId?: string): string {
  let resolved = tenantId && tenantId.trim() ? tenantId.trim() : resolveActiveTenantId();
  if (resolved === 'modendo') resolved = 'tenant-modendo-01';
  if (resolved === '100hich') resolved = 'tenant-100hich-01';
  if (resolved.startsWith('CafeOS_LocalDB_')) return resolved;
  return `CafeOS_LocalDB_${resolved}`;
}

export async function seedTenantDatabaseDefaults(targetDb: CafeDatabase, tenantId: string): Promise<void> {
  const isModendo =
    tenantId.includes('modendo') ||
    (typeof import.meta !== 'undefined' &&
      ((import.meta as any).env?.VITE_TENANT_ID?.includes('modendo') ||
        (import.meta as any).env?.MODE === 'modendo')) ||
    (typeof process !== 'undefined' &&
      (process.env?.VITE_TENANT_ID?.includes('modendo') || process.env?.MODE === 'modendo'));

  if (isModendo) {
    // 1. Seed pure Modendo store profile without 100hich strings
    const existingStore = await targetDb.appSettings.get('store_profile').catch(() => null);
    const storeHas100Hich =
      !existingStore ||
      (existingStore.value?.name_fa &&
        (existingStore.value.name_fa.includes('۱۰۰') || existingStore.value.name_fa.includes('100')));
    if (storeHas100Hich) {
      await targetDb.appSettings.put({
        key: 'store_profile',
        value: MODENDO_STORE_METADATA,
        updatedAt: Date.now(),
      });
    }

    // 2. Seed pure Modendo receipt template
    const existingReceipt = await targetDb.appSettings.get('receipt_template').catch(() => null);
    const receiptHas100Hich =
      !existingReceipt ||
      (existingReceipt.value?.header_lines &&
        existingReceipt.value.header_lines.some((l: string) => l.includes('۱۰۰') || l.includes('100')));
    if (receiptHas100Hich) {
      await targetDb.appSettings.put({
        key: 'receipt_template',
        value: MODENDO_RECEIPT_METADATA,
        updatedAt: Date.now(),
      });
    }

    // 3. Clean inventory: purge 100hich-specific items and populate Modendo default inventory
    const existingInv = await targetDb.inventoryItems.toArray().catch(() => []);
    const has100Hich = existingInv.some(
      (item) =>
        item.name?.includes('۱۰۰') ||
        item.name?.includes('100') ||
        item.name?.includes('بلند اختصاصی اسپرسو')
    );
    if (has100Hich || existingInv.length === 0) {
      for (const item of existingInv) {
        if (
          item.name?.includes('۱۰۰') ||
          item.name?.includes('100') ||
          item.name?.includes('بلند اختصاصی اسپرسو')
        ) {
          await targetDb.inventoryItems.delete(item.id);
        }
      }
      for (const inv of MODENDO_DEFAULT_INVENTORY) {
        const itemExists = await targetDb.inventoryItems.get(inv.id);
        if (!itemExists) {
          await targetDb.inventoryItems.put({
            ...inv,
            updatedAt: Date.now(),
          } as any);
        }
      }
    }

    // 4. Sanitize staff accounts: guarantee test username is replaced with production admin
    const existingUsers = await targetDb.authUsers.toArray().catch(() => []);
    for (const u of existingUsers) {
      if (u.fullName && (u.fullName.includes('مهدان') || u.fullName.includes('Mahdan'))) {
        await targetDb.authUsers.update(u.id, {
          fullName: 'مدیر سیستم',
          updatedAt: Date.now(),
        });
      }
    }
  }
}

/**
 * Returns an isolated CafeDatabase instance strictly scoped to the specified tenant.
 */
export function getCafeDatabase(tenantId?: string): CafeDatabase {
  const dbName = getTenantDatabaseName(tenantId);
  if (!dbRegistry.has(dbName)) {
    const instance = new CafeDatabase(dbName);
    dbRegistry.set(dbName, instance);
    seedTenantDatabaseDefaults(instance, dbName).catch(() => {});
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

    const legacyCustomers = await legacyDb.customers?.toArray().catch(() => []);
    if (legacyCustomers && legacyCustomers.length > 0) {
      await targetDb.customers.bulkPut(legacyCustomers);
      recordsMigrated.customers = legacyCustomers.length;
      totalCount += legacyCustomers.length;
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
