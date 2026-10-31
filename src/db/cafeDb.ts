import Dexie, { Table } from 'dexie';
import { InventoryItem, MenuItem, Order, AuditLog } from '../types/db';

export class CafeDatabase extends Dexie {
  inventoryItems!: Table<InventoryItem, string>;
  menuItems!: Table<MenuItem, string>;
  orders!: Table<Order, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('CafeOS_LocalDB');
    this.version(1).stores({
      inventoryItems: 'id, name, category, currentStock',
      menuItems: 'id, categoryId, title, isAvailable',
      orders: 'id, orderNumber, tableId, status, createdAt, synced',
      auditLogs: 'id, orderId, action, timestamp'
    });
  }
}

export const db = new CafeDatabase();
