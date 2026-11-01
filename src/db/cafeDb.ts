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

  constructor() {
    super('CafeOS_LocalDB');
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
    });
  }
}

export const db = new CafeDatabase();
