/**
 * CAFE OS — Decomposed Dexie POS Database Schema with Compound Tenant Indices
 * Path: src/db/DexiePOSDatabase.ts
 *
 * Implements:
 * 1. Normalized, decomposed table entities with mandatory tenant scoping.
 * 2. Compound indexing syntax ([tenantId+field]) for performant multi-tenant offline queries.
 * 3. Dexie v2 schema migrations with backward compatibility.
 * 4. Strongly typed repository accessors scoped to active tenant.
 */

import Dexie, { Table } from 'dexie';

// =============================================================================
// Entity Types with Mandatory Multi-Tenant Scoping
// =============================================================================

export interface DecomposedOrderRecord {
  id: string; // Server / Store UUID
  clientGeneratedId: string; // Client UUIDv4
  tenantId: string;
  shiftId: string;
  orderNumber: number;
  tableLabel?: string;
  tableNumber?: string | number;
  tableSessionId?: string;
  flowType?: 'COUNTER_QUICK_PAY' | 'TAB_PAY_LATER' | 'DINE_IN_PAY_BY_ORDER';
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'VOIDED';
  grossAmountToman: number;
  discountAmountToman: number;
  netTotalToman: number;
  paidAmountToman: number;
  vatTotalToman: number;
  customerName?: string;
  customerPhone?: string;
  synced: 0 | 1;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DecomposedOrderItemRecord {
  id: string;
  orderId: string;
  tenantId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPriceSnapshotToman: number;
  quantity: number;
  subtotalToman: number;
  notes?: string;
  station?: 'BAR' | 'KITCHEN' | 'NO_PREP';
  prepStatus?: 'PENDING' | 'IN_PREP' | 'COMPLETED' | 'CANCELLED';
}

export interface DecomposedShiftRecord {
  id: string;
  tenantId: string;
  openedAt: string;
  closedAt?: string;
  openedByUserId: string;
  openedByUserName: string;
  closedByUserId?: string;
  closedByUserName?: string;
  openingCashToman: number;
  expectedClosingCashToman?: number;
  actualCountedCashToman?: number;
  discrepancyToman?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface DecomposedInventoryItemRecord {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  currentStock: number;
  unit: 'g' | 'ml' | 'piece' | 'kg' | 'liter';
  costPerUnitToman: number;
  minThreshold: number;
  updatedAt: string;
}

export interface DecomposedMenuItemRecord {
  id: string;
  tenantId: string;
  categoryId: string;
  title: string;
  priceToman: number;
  taxRatePercent?: number;
  isAvailable: boolean;
  station?: 'BAR' | 'KITCHEN' | 'NO_PREP';
  updatedAt: string;
}

export interface DecomposedTableTabRecord {
  id: string;
  tenantId: string;
  tableId: string;
  tableLabel: string;
  status: 'OPEN' | 'SETTLING' | 'CLOSED';
  currentOrderId?: string;
  openedAt: string;
  totalDueToman: number;
}

export interface DecomposedZReportRecord {
  id: string;
  tenantId: string;
  shiftId: string;
  reportNumber: number;
  netSalesToman: number;
  vatTotalToman: number;
  openingCashToman: number;
  expectedCashToman: number;
  actualCashCountedToman: number;
  discrepancyToman: number;
  isBalanced: boolean;
  timestamp: string;
}

export interface DecomposedStockInwardRecord {
  id: string;
  tenantId: string;
  rawItemId: string;
  rawItemName: string;
  batchNumber: string;
  incomingQuantity: number;
  unit: string;
  previousStock: number;
  newStock: number;
  purchaseCostPerUnitToman: number;
  supplierName: string;
  operatorName: string;
  timestamp: string;
}

export interface DecomposedSyncQueueRecord {
  id: string;
  clientGeneratedId: string;
  tenantId: string;
  syncStatus: 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'PAUSED' | 'QUARANTINED';
  retryCount: number;
  payload: any;
  createdAt: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  errorMessage?: string;
}

export interface DecomposedAuditLogRecord {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  targetId?: string;
  details: string;
  timestamp: string;
}

// =============================================================================
// Dexie POS Database Class
// =============================================================================

export class DexiePOSDatabase extends Dexie {
  public orders!: Table<DecomposedOrderRecord, string>;
  public orderItems!: Table<DecomposedOrderItemRecord, string>;
  public shifts!: Table<DecomposedShiftRecord, string>;
  public inventoryItems!: Table<DecomposedInventoryItemRecord, string>;
  public menuItems!: Table<DecomposedMenuItemRecord, string>;
  public tableTabs!: Table<DecomposedTableTabRecord, string>;
  public zReports!: Table<DecomposedZReportRecord, string>;
  public stockInward!: Table<DecomposedStockInwardRecord, string>;
  public syncQueue!: Table<DecomposedSyncQueueRecord, string>;
  public auditLogs!: Table<DecomposedAuditLogRecord, string>;

  constructor(dbName: string = 'CafeOS_POS_DecomposedDB') {
    super(dbName);

    // Version 1: Baseline schema with primary keys and foreign keys
    this.version(1).stores({
      orders: 'id, clientGeneratedId, tenantId, shiftId, status, createdAt, synced',
      orderItems: 'id, orderId, tenantId, menuItemId',
      shifts: 'id, tenantId, status, openedAt',
      inventoryItems: 'id, tenantId, category, currentStock',
      menuItems: 'id, tenantId, categoryId, isAvailable',
      tableTabs: 'id, tenantId, tableId, status',
      zReports: 'id, tenantId, shiftId, timestamp',
      stockInward: 'id, tenantId, rawItemId, timestamp',
      syncQueue: 'id, clientGeneratedId, tenantId, syncStatus, createdAt',
      auditLogs: 'id, tenantId, userId, timestamp',
    });

    // Version 2: Decomposed Schema with Compound Tenant Indices
    // Compound indices ([tenantId+...]) ensure high performance and fail-closed tenant scoping
    this.version(2).stores({
      orders: 'id, clientGeneratedId, tenantId, shiftId, status, createdAt, synced, [tenantId+id], [tenantId+status], [tenantId+createdAt], [tenantId+shiftId], [tenantId+synced]',
      orderItems: 'id, orderId, tenantId, menuItemId, [tenantId+id], [tenantId+orderId], [tenantId+menuItemId]',
      shifts: 'id, tenantId, status, openedAt, [tenantId+id], [tenantId+status], [tenantId+openedAt]',
      inventoryItems: 'id, tenantId, category, currentStock, [tenantId+id], [tenantId+category], [tenantId+currentStock]',
      menuItems: 'id, tenantId, categoryId, isAvailable, [tenantId+id], [tenantId+categoryId], [tenantId+isAvailable]',
      tableTabs: 'id, tenantId, tableId, status, [tenantId+id], [tenantId+tableId], [tenantId+status]',
      zReports: 'id, tenantId, shiftId, timestamp, [tenantId+id], [tenantId+shiftId], [tenantId+timestamp]',
      stockInward: 'id, tenantId, rawItemId, timestamp, [tenantId+id], [tenantId+rawItemId], [tenantId+timestamp]',
      syncQueue: 'id, clientGeneratedId, tenantId, syncStatus, createdAt, [tenantId+id], [tenantId+syncStatus], [tenantId+createdAt]',
      auditLogs: 'id, tenantId, userId, timestamp, [tenantId+id], [tenantId+timestamp], [tenantId+userId]',
    });

    // Version 3: Multi-Mode Operational Order Fields & Compound Session Indices
    this.version(3).stores({
      orders:
        'id, clientGeneratedId, tenantId, shiftId, status, createdAt, synced, tableSessionId, flowType, [tenantId+id], [tenantId+status], [tenantId+createdAt], [tenantId+shiftId], [tenantId+synced], [tenantId+tableSessionId], [tenantId+flowType]',
    });
  }

  // ===========================================================================
  // Tenant-Scoped Fast Query Accessors (Compound Index Accelerated)
  // ===========================================================================

  public getOrdersByTenant(tenantId: string) {
    return this.orders.where('[tenantId+status]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]);
  }

  public getOrdersByTableSession(tenantId: string, tableSessionId: string) {
    return this.orders.where('[tenantId+tableSessionId]').equals([tenantId, tableSessionId]);
  }

  public getOrdersByFlowType(tenantId: string, flowType: NonNullable<DecomposedOrderRecord['flowType']>) {
    return this.orders.where('[tenantId+flowType]').equals([tenantId, flowType]);
  }

  public getActiveOrdersByTenant(tenantId: string, status: DecomposedOrderRecord['status']) {
    return this.orders.where('[tenantId+status]').equals([tenantId, status]);
  }

  public getUnsyncedOrdersByTenant(tenantId: string) {
    return this.orders.where('[tenantId+synced]').equals([tenantId, 0]);
  }

  public getOrderItemsByOrder(tenantId: string, orderId: string) {
    return this.orderItems.where('[tenantId+orderId]').equals([tenantId, orderId]);
  }

  public getActiveShiftByTenant(tenantId: string) {
    return this.shifts.where('[tenantId+status]').equals([tenantId, 'OPEN']).first();
  }

  public getInventoryByTenant(tenantId: string) {
    return this.inventoryItems.where('[tenantId+category]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]);
  }

  public getAvailableMenuItemsByTenant(tenantId: string) {
    return this.menuItems.where('[tenantId+isAvailable]').equals([tenantId, true as any]);
  }

  public getOpenTabsByTenant(tenantId: string) {
    return this.tableTabs.where('[tenantId+status]').equals([tenantId, 'OPEN']);
  }

  public getPendingSyncQueueByTenant(tenantId: string) {
    return this.syncQueue.where('[tenantId+syncStatus]').equals([tenantId, 'QUEUED']);
  }
}

// =============================================================================
// Registry & Factory Resolvers
// =============================================================================

const posDbRegistry = new Map<string, DexiePOSDatabase>();

/**
 * Returns a decomposed Dexie database instance.
 * Parameterized by tenantId to combine physical partitioning with compound indexing.
 */
export function getDexiePOSDatabase(tenantId: string = 'tenant-100hich-01'): DexiePOSDatabase {
  const dbName = `CafeOS_POS_${tenantId.trim()}`;
  if (!posDbRegistry.has(dbName)) {
    posDbRegistry.set(dbName, new DexiePOSDatabase(dbName));
  }
  return posDbRegistry.get(dbName)!;
}
