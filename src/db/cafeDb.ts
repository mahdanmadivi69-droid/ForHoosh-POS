import Dexie, { Table } from 'dexie';
import { InventoryItem, MenuItem, Order, AuditLog } from '../types/db';
import type { Order as DomainOrder } from '../types/domain';

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

  constructor() {
    super('CafeOS_LocalDB');
    this.version(1).stores({
      inventoryItems: 'id, name, category, currentStock',
      menuItems: 'id, categoryId, title, isAvailable',
      orders: 'id, orderNumber, tableId, status, createdAt, synced',
      auditLogs: 'id, orderId, action, timestamp'
    });

    // P0-2: additive upgrade — only adds `posOrders`; all v1 tables and their
    // existing rows are preserved by Dexie.
    this.version(2).stores({
      posOrders: 'id, orderNumber, shiftId, status, createdAt'
    });
  }
}

export const db = new CafeDatabase();
