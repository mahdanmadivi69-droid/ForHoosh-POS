/**
 * CAFE OS — Decomposed Dexie POS Database Schema with Compound Tenant Indices
 * Path: src/db/DexiePOSDatabase.ts
 *
 * Implements:
 * 1. Normalized, decomposed table entities with mandatory tenant scoping.
 * 2. Compound indexing syntax ([tenantId+field]) for performant multi-tenant offline queries.
 * 3. Dexie v2/v3/v4 schema migrations with backward compatibility.
 * 4. Strongly typed repository accessors scoped to active tenant.
 * 5. Dedicated venue floor layouts, zones, and 4 PS5 stations for Modendo.
 * 6. Dual-mode takeaway ordering support (Instant Pay vs Open Tab for regulars).
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
  takeawayBillingMode?: 'INSTANT_PAY' | 'OPEN_TAB_REGULAR';
  isRegularCustomerTab?: boolean;
  status: 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'VOIDED';
  grossAmountToman: number;
  discountAmountToman: number;
  netTotalToman: number;
  paidAmountToman: number;
  vatTotalToman: number;
  customerName?: string;
  customerPhone?: string;
  /** Daily receipt sequence number (per tenant + local day, 1-based → #001). */
  dailyReceiptNumber?: number;
  /** Local calendar date key (YYYY-MM-DD) the daily receipt sequence belongs to. */
  receiptDateKey?: string;
  synced: 0 | 1;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DecomposedPaymentRecord {
  id: string;
  clientGeneratedId: string;
  orderId: string;
  tenantId: string;
  shiftId: string;
  receivedByUserId: string;
  receivedByUserName: string;
  amountToman: number;
  paymentMethod: 'CASH' | 'CARD_MANUAL' | 'OTHER';
  referenceCode?: string;
  terminalName?: string;
  cashTenderedToman?: number;
  changeDueToman?: number;
  splitDetails?: {
    partAMethod: string;
    partAAmountToman: number;
    partBMethod: string;
    partBAmountToman: number;
  };
  status: 'SUCCESSFUL' | 'VOIDED';
  createdAt: string;
}

export type PrintQueueStatus = 'pending' | 'printing' | 'failed' | 'printed';

export interface DecomposedPrintQueueRecord {
  id: string;
  tenantId: string;
  orderId: string;
  kind: 'CUSTOMER_RECEIPT' | 'BAR_TICKET' | 'Z_REPORT';
  /** Raw ESC/POS byte stream: ESC @ init → body (Persian raster / shaped text) → GS V paper cut. */
  payload: ArrayBuffer;
  status: PrintQueueStatus;
  attempts: number;
  lastError?: string;
  /** Timestamp (ms) before which this job must not be retried (short backoff window). */
  nextAttemptAt?: number;
  /** Item line count baked into the payload (payload verification aid). */
  itemCount: number;
  /** Receipt number printed on the ticket (payload verification aid). */
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
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
  /** Immutable lock — set when the shift is closed; locked records must never be mutated. */
  locked?: boolean;
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

export interface DecomposedVenueZoneRecord {
  id: string;
  tenantId: string;
  nameFa: string;
  nameEn: string;
  zoneType: 'COUNTER' | 'HALL' | 'GAMING_PS5' | 'VIP_BOARDGAME' | 'RETAIL' | 'TERRACE' | 'TAKEAWAY';
  sortOrder: number;
  isActive: boolean;
}

export interface DecomposedVenueTableRecord {
  id: string;
  tenantId: string;
  zoneId: string;
  tableNumber: string | number;
  label: string;
  capacity: number;
  isPs5Station?: boolean;
  ps5StationNumber?: number; // 1, 2, 3, 4
  hourlyRateToman?: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  currentSessionId?: string;
  currentOrderId?: string;
  updatedAt: string;
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

export interface DecomposedCustomerRecord {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  createdAt: number | string;
  updatedAt?: number | string;
}

// =============================================================================
// Dexie POS Database Class
// =============================================================================

export class DexiePOSDatabase extends Dexie {
  public orders!: Table<DecomposedOrderRecord, string>;
  public orderItems!: Table<DecomposedOrderItemRecord, string>;
  public payments!: Table<DecomposedPaymentRecord, string>;
  public printQueue!: Table<DecomposedPrintQueueRecord, string>;
  public shifts!: Table<DecomposedShiftRecord, string>;
  public inventoryItems!: Table<DecomposedInventoryItemRecord, string>;
  public menuItems!: Table<DecomposedMenuItemRecord, string>;
  public tableTabs!: Table<DecomposedTableTabRecord, string>;
  public venueZones!: Table<DecomposedVenueZoneRecord, string>;
  public venueTables!: Table<DecomposedVenueTableRecord, string>;
  public zReports!: Table<DecomposedZReportRecord, string>;
  public stockInward!: Table<DecomposedStockInwardRecord, string>;
  public syncQueue!: Table<DecomposedSyncQueueRecord, string>;
  public auditLogs!: Table<DecomposedAuditLogRecord, string>;
  public customers!: Table<DecomposedCustomerRecord, string>;

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

    // Version 4: Dedicated Venue Floor Layouts, Zones, and Stations
    this.version(4).stores({
      venueZones:
        'id, tenantId, zoneType, sortOrder, [tenantId+id], [tenantId+zoneType], [tenantId+sortOrder]',
      venueTables:
        'id, tenantId, zoneId, status, [tenantId+id], [tenantId+zoneId], [tenantId+status]',
      orders:
        'id, clientGeneratedId, tenantId, shiftId, status, createdAt, synced, tableSessionId, flowType, takeawayBillingMode, [tenantId+id], [tenantId+status], [tenantId+createdAt], [tenantId+shiftId], [tenantId+synced], [tenantId+tableSessionId], [tenantId+flowType], [tenantId+takeawayBillingMode]',
    });

    // Version 5: Normalized Customers Table with Multi-Tenant Compound Indices
    this.version(5).stores({
      customers:
        'id, tenantId, phone, name, createdAt, [tenantId+id], [tenantId+phone], [tenantId+name]',
    });

    // Version 6: Atomic Fast-Checkout Write Set — dedicated payments table + daily receipt sequence indices
    this.version(6).stores({
      orders:
        'id, clientGeneratedId, tenantId, shiftId, status, createdAt, synced, tableSessionId, flowType, takeawayBillingMode, receiptDateKey, [tenantId+id], [tenantId+status], [tenantId+createdAt], [tenantId+shiftId], [tenantId+synced], [tenantId+tableSessionId], [tenantId+flowType], [tenantId+takeawayBillingMode], [tenantId+receiptDateKey]',
      payments:
        'id, orderId, tenantId, status, createdAt, [tenantId+orderId], [tenantId+createdAt]',
    });

    // Version 7: Bulletproof ESC/POS Thermal Print Queue — persistent, offline-tolerant, auto-retry
    this.version(7).stores({
      printQueue:
        'id, orderId, tenantId, status, createdAt, updatedAt, [tenantId+status], [tenantId+orderId]',
    });
  }

  // ===========================================================================
  // Tenant-Scoped Fast Query Accessors (Compound Index Accelerated)
  // ===========================================================================

  public getCustomersByTenant(tenantId: string) {
    return this.customers.where('[tenantId+name]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]);
  }

  public getCustomerByPhone(tenantId: string, phone: string) {
    return this.customers.where('[tenantId+phone]').equals([tenantId, phone]).first();
  }

  public getOrdersByTenant(tenantId: string) {
    return this.orders.where('[tenantId+status]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]);
  }

  public getOrdersByTableSession(tenantId: string, tableSessionId: string) {
    return this.orders.where('[tenantId+tableSessionId]').equals([tenantId, tableSessionId]);
  }

  public getOrdersByFlowType(tenantId: string, flowType: NonNullable<DecomposedOrderRecord['flowType']>) {
    return this.orders.where('[tenantId+flowType]').equals([tenantId, flowType]);
  }

  public getTakeawayOrders(tenantId: string) {
    return this.orders.where('[tenantId+status]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]).filter((o) => o.orderType === 'TAKEAWAY');
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

  // ===========================================================================
  // Venue Layout & Station Accessors
  // ===========================================================================

  public getVenueZonesByTenant(tenantId: string) {
    return this.venueZones.where('[tenantId+sortOrder]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]);
  }

  public getVenueTablesByTenant(tenantId: string) {
    return this.venueTables.where('[tenantId+zoneId]').between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey]);
  }

  public getVenueTablesByZone(tenantId: string, zoneId: string) {
    return this.venueTables.where('[tenantId+zoneId]').equals([tenantId, zoneId]);
  }

  public async getPs5StationsByTenant(tenantId: string): Promise<DecomposedVenueTableRecord[]> {
    const allTables = await this.venueTables
      .where('[tenantId+zoneId]')
      .between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey])
      .toArray();
    return allTables.filter((t) => Boolean(t.isPs5Station));
  }

  /**
   * Seeds default floor layouts and stations into Dexie for a given tenant if not already present.
   */
  public async seedVenueLayout(tenantId: string): Promise<void> {
    const existingCount = await this.venueZones
      .where('[tenantId+zoneType]')
      .between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey])
      .count();

    if (existingCount > 0) return;

    if (tenantId.includes('modendo')) {
      // Modendo Layout (Hall + 4 PS5 Stations + VIP)
      const zones: DecomposedVenueZoneRecord[] = [
        {
          id: `zone-${tenantId}-hall`,
          tenantId,
          nameFa: 'سالن اصلی بردگیم',
          nameEn: 'Main Boardgame Hall',
          zoneType: 'HALL',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: `zone-${tenantId}-ps5`,
          tenantId,
          nameFa: 'ایستگاه‌های کنسول PS5',
          nameEn: 'PS5 Gaming Pods',
          zoneType: 'GAMING_PS5',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: `zone-${tenantId}-vip`,
          tenantId,
          nameFa: 'اتاق VIP بردگیم',
          nameEn: 'VIP Boardgame Suite',
          zoneType: 'VIP_BOARDGAME',
          sortOrder: 3,
          isActive: true,
        },
      ];
      await this.venueZones.bulkPut(zones);

      const tables: DecomposedVenueTableRecord[] = [
        ...[1, 2, 3, 4, 5, 6].map((num) => ({
          id: `tbl-${tenantId}-hall-${num}`,
          tenantId,
          zoneId: `zone-${tenantId}-hall`,
          tableNumber: `T${num}`,
          label: `میز کافه T${num}`,
          capacity: num % 2 === 0 ? 6 : 4,
          status: 'AVAILABLE' as const,
          updatedAt: new Date().toISOString(),
        })),
        ...[1, 2, 3, 4].map((stationNum) => ({
          id: `tbl-${tenantId}-ps5-${stationNum}`,
          tenantId,
          zoneId: `zone-${tenantId}-ps5`,
          tableNumber: `PS5-${stationNum}`,
          label: `پاد PS5 شماره ${stationNum}`,
          capacity: stationNum <= 2 ? 2 : 4,
          isPs5Station: true,
          ps5StationNumber: stationNum,
          hourlyRateToman: 90000,
          status: 'AVAILABLE' as const,
          updatedAt: new Date().toISOString(),
        })),
        {
          id: `tbl-${tenantId}-vip-1`,
          tenantId,
          zoneId: `zone-${tenantId}-vip`,
          tableNumber: 'VIP-1',
          label: 'غرفه VIP گیمینگ ۱',
          capacity: 8,
          hourlyRateToman: 150000,
          status: 'AVAILABLE' as const,
          updatedAt: new Date().toISOString(),
        },
        {
          id: `tbl-${tenantId}-vip-2`,
          tenantId,
          zoneId: `zone-${tenantId}-vip`,
          tableNumber: 'VIP-2',
          label: 'غرفه VIP گیمینگ ۲',
          capacity: 8,
          hourlyRateToman: 150000,
          status: 'AVAILABLE' as const,
          updatedAt: new Date().toISOString(),
        },
      ];
      await this.venueTables.bulkPut(tables);
    } else {
      // 100 HICH Layout (Counter + Retail Tasting Tables)
      const zones: DecomposedVenueZoneRecord[] = [
        {
          id: `zone-${tenantId}-counter`,
          tenantId,
          nameFa: 'کانتر و بار اکسپرس',
          nameEn: 'Express Bar & Counter',
          zoneType: 'COUNTER',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: `zone-${tenantId}-retail`,
          tenantId,
          nameFa: 'میزهای تست و خرده‌فروشی دان',
          nameEn: 'Coffee Tasting & Retail Tables',
          zoneType: 'RETAIL',
          sortOrder: 2,
          isActive: true,
        },
      ];
      await this.venueZones.bulkPut(zones);

      const tables: DecomposedVenueTableRecord[] = [
        {
          id: `tbl-${tenantId}-c1`,
          tenantId,
          zoneId: `zone-${tenantId}-counter`,
          tableNumber: 'C1',
          label: 'پیشخوان ۱ (سفارش سریع)',
          capacity: 1,
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
        {
          id: `tbl-${tenantId}-c2`,
          tenantId,
          zoneId: `zone-${tenantId}-counter`,
          tableNumber: 'C2',
          label: 'پیشخوان ۲ (بار دم‌آوری)',
          capacity: 1,
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
        {
          id: `tbl-${tenantId}-b1`,
          tenantId,
          zoneId: `zone-${tenantId}-counter`,
          tableNumber: 'B1',
          label: 'صندلی بار ۱',
          capacity: 1,
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
        {
          id: `tbl-${tenantId}-b2`,
          tenantId,
          zoneId: `zone-${tenantId}-counter`,
          tableNumber: 'B2',
          label: 'صندلی بار ۲',
          capacity: 1,
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
        {
          id: `tbl-${tenantId}-r1`,
          tenantId,
          zoneId: `zone-${tenantId}-retail`,
          tableNumber: 'R1',
          label: 'میز تست و کاپینگ ۱',
          capacity: 4,
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
        {
          id: `tbl-${tenantId}-r2`,
          tenantId,
          zoneId: `zone-${tenantId}-retail`,
          tableNumber: 'R2',
          label: 'میز مشاوره دان و دم‌آوری ۲',
          capacity: 4,
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
      ];
      await this.venueTables.bulkPut(tables);
    }
  }

  // ===========================================================================
  // Atomic Fast-Checkout Write (100 HICH Fast Checkout)
  // One rw transaction covering: order creation, payment record and packaged
  // retail/inventory stock deduction. Power loss or refresh mid-write rolls the
  // whole checkout back — never a partial order. The daily receipt number
  // (#001, #002, …) is allocated inside the same transaction: IndexedDB
  // serializes overlapping rw transactions so rapid consecutive orders can
  // never collide, and a rolled-back checkout never consumes a number (no gaps).
  // ===========================================================================

  public async persistPaidCheckoutAtomically(params: {
    tenantId: string;
    clientGeneratedId: string;
    receiptDateKey: string;
    order: {
      id: string;
      orderNumber: number;
      shiftId: string;
      orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
      tableLabel?: string;
      customerName?: string;
      customerPhone?: string;
      grossAmountToman: number;
      discountAmountToman: number;
      netTotalToman: number;
      createdByUserId: string;
      createdByUserName: string;
      createdAt: string;
      updatedAt: string;
    };
    items: Array<{
      id: string;
      menuItemId: string;
      itemNameSnapshot: string;
      unitPriceSnapshotToman: number;
      quantity: number;
      subtotalToman: number;
      notes?: string;
    }>;
    payment: {
      id: string;
      amountToman: number;
      paymentMethod: 'CASH' | 'CARD_MANUAL' | 'OTHER';
      referenceCode?: string;
      terminalName?: string;
      receivedByUserId: string;
      receivedByUserName: string;
      cashTenderedToman?: number;
      changeDueToman?: number;
      splitDetails?: {
        partAMethod: string;
        partAAmountToman: number;
        partBMethod: string;
        partBAmountToman: number;
      };
      createdAt: string;
    };
  }): Promise<{
    dailyReceiptNumber: number;
    stockDeductions: Array<{ inventoryItemId: string; deducted: number; remaining: number }>;
  }> {
    const { tenantId, clientGeneratedId, receiptDateKey, order, items, payment } = params;

    // Integer Rial/Toman invariant: every monetary value entering the transaction is a whole Toman.
    const gross = Math.round(order.grossAmountToman);
    const discount = Math.max(0, Math.min(gross, Math.round(order.discountAmountToman)));
    const net = gross - discount;

    const paymentRecord: DecomposedPaymentRecord = {
      id: payment.id,
      clientGeneratedId,
      orderId: order.id,
      tenantId,
      shiftId: order.shiftId,
      receivedByUserId: payment.receivedByUserId,
      receivedByUserName: payment.receivedByUserName,
      amountToman: Math.round(payment.amountToman),
      paymentMethod: payment.paymentMethod,
      referenceCode: payment.referenceCode,
      terminalName: payment.terminalName,
      cashTenderedToman:
        payment.cashTenderedToman !== undefined ? Math.round(payment.cashTenderedToman) : undefined,
      changeDueToman:
        payment.changeDueToman !== undefined ? Math.round(payment.changeDueToman) : undefined,
      splitDetails: payment.splitDetails,
      status: 'SUCCESSFUL',
      createdAt: payment.createdAt,
    };

    return await this.transaction(
      'rw',
      [this.orders, this.orderItems, this.payments, this.inventoryItems, this.auditLogs],
      async () => {
        // 1. Idempotent replay guard — a retried checkout must not double-allocate or double-deduct.
        const existingOrder = await this.orders.get(order.id);
        if (existingOrder) {
          const existingPayment = await this.payments
            .where('[tenantId+orderId]')
            .equals([tenantId, order.id])
            .first();
          if (!existingPayment) {
            await this.payments.put(paymentRecord);
          }
          return {
            dailyReceiptNumber: existingOrder.dailyReceiptNumber ?? order.orderNumber,
            stockDeductions: [],
          };
        }

        // 2. Sequential daily receipt number — allocated inside the transaction (see docblock).
        const todaysReceiptedOrders = await this.orders
          .where('[tenantId+receiptDateKey]')
          .equals([tenantId, receiptDateKey])
          .toArray();
        const maxDailyReceiptNumber = todaysReceiptedOrders.reduce(
          (max, o) =>
            typeof o.dailyReceiptNumber === 'number' && o.dailyReceiptNumber > max
              ? o.dailyReceiptNumber
              : max,
          0
        );
        const dailyReceiptNumber = maxDailyReceiptNumber + 1;

        // 3. Order record (PAID snapshot)
        const orderRecord: DecomposedOrderRecord = {
          id: order.id,
          clientGeneratedId,
          tenantId,
          shiftId: order.shiftId,
          orderNumber: order.orderNumber,
          dailyReceiptNumber,
          receiptDateKey,
          orderType: order.orderType,
          tableLabel: order.tableLabel,
          status: 'PAID',
          grossAmountToman: gross,
          discountAmountToman: discount,
          netTotalToman: net,
          paidAmountToman: Math.round(payment.amountToman),
          vatTotalToman: 0,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          synced: 0,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };
        await this.orders.add(orderRecord);

        // 4. Decomposed order line items
        if (items.length > 0) {
          await this.orderItems.bulkPut(
            items.map((it) => ({
              id: `${order.id}::item::${it.id}`,
              orderId: order.id,
              tenantId,
              menuItemId: it.menuItemId,
              itemNameSnapshot: it.itemNameSnapshot,
              unitPriceSnapshotToman: Math.round(it.unitPriceSnapshotToman),
              quantity: Math.max(0, Math.round(it.quantity)),
              subtotalToman: Math.round(it.subtotalToman),
              notes: it.notes,
            }))
          );
        }

        // 5. Payment record (split Cash + Card parts preserved verbatim)
        await this.payments.put(paymentRecord);

        // 6. Packaged retail / inventory stock deduction — integer-only, same atomic scope.
        //    Deducts from mirrored decomposed inventory records when present; stock for
        //    non-mirrored items stays under the legacy store's own deduction path.
        const stockDeductions: Array<{ inventoryItemId: string; deducted: number; remaining: number }> = [];
        for (const it of items) {
          const qty = Math.round(it.quantity);
          if (!it.menuItemId || qty <= 0) continue;
          const invRecord = await this.inventoryItems.get(it.menuItemId);
          if (invRecord && typeof invRecord.currentStock === 'number') {
            const previous = Math.round(invRecord.currentStock);
            const remaining = Math.max(0, previous - qty);
            await this.inventoryItems.update(invRecord.id, {
              currentStock: remaining,
              updatedAt: order.updatedAt,
            });
            stockDeductions.push({ inventoryItemId: invRecord.id, deducted: previous - remaining, remaining });
          }
        }

        // 7. Audit trail inside the same transaction
        await this.auditLogs.add({
          id: `audit-${order.id}-checkout`,
          tenantId,
          userId: order.createdByUserId,
          userName: order.createdByUserName,
          action: 'CHECKOUT_ATOMIC_COMMIT',
          targetId: order.id,
          details: `ثبت اتمیک تسویه: سفارش #${order.orderNumber} (فیش روزانه #${String(dailyReceiptNumber).padStart(3, '0')}) مبلغ ${net} تومان — اقلام: ${items.length}، کسور موجودی: ${stockDeductions.length}`,
          timestamp: order.updatedAt,
        });

        return { dailyReceiptNumber, stockDeductions };
      }
    );
  }

  // ===========================================================================
  // Persistent Print Queue (ESC/POS Thermal)
  // Enqueue is fire-and-forget: saving the order NEVER waits on the printer.
  // Failed jobs retry up to 3 attempts with short backoff, then surface to the
  // barista for a 1-click reprint from the POS bar.
  // ===========================================================================

  public async enqueuePrintJob(job: DecomposedPrintQueueRecord): Promise<void> {
    await this.transaction('rw', this.printQueue, async () => {
      // Idempotency: never queue the same order + kind twice while a job is still active.
      const existing = await this.printQueue
        .where('[tenantId+orderId]')
        .equals([job.tenantId, job.orderId])
        .filter((j) => j.kind === job.kind && (j.status === 'pending' || j.status === 'printing'))
        .first();
      if (existing) return;
      await this.printQueue.put(job);
    });
  }

  /** Claims pending jobs whose backoff window has elapsed and flips them to 'printing'. */
  public async claimPendingPrintJobs(tenantId: string, limit: number = 3): Promise<DecomposedPrintQueueRecord[]> {
    const now = Date.now();
    const candidates = await this.printQueue
      .where('[tenantId+status]')
      .equals([tenantId, 'pending'])
      .filter((j) => j.nextAttemptAt === undefined || j.nextAttemptAt <= now)
      .sortBy('createdAt');
    const batch = candidates.slice(0, limit);
    await Promise.all(
      batch.map((j) =>
        this.printQueue.update(j.id, { status: 'printing' as const, updatedAt: new Date().toISOString() })
      )
    );
    return batch.map((j) => ({ ...j, status: 'printing' as const }));
  }

  public async markPrintJobPrinted(id: string): Promise<void> {
    await this.printQueue.update(id, {
      status: 'printed' as const,
      lastError: undefined,
      printedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /** Increments attempts; retries with short backoff below maxAttempts, else parks as 'failed'. */
  public async markPrintJobFailed(id: string, error: string, maxAttempts: number = 3): Promise<'pending' | 'failed'> {
    return await this.transaction('rw', this.printQueue, async () => {
      const job = await this.printQueue.get(id);
      if (!job) return 'failed' as const;
      const attempts = job.attempts + 1;
      if (attempts >= maxAttempts) {
        await this.printQueue.update(id, {
          status: 'failed' as const,
          attempts,
          lastError: error,
          updatedAt: new Date().toISOString(),
        });
        return 'failed' as const;
      }
      // Short exponential backoff: 2s after the 1st failure, 4s after the 2nd.
      await this.printQueue.update(id, {
        status: 'pending' as const,
        attempts,
        lastError: error,
        nextAttemptAt: Date.now() + (attempts === 1 ? 2000 : 4000),
        updatedAt: new Date().toISOString(),
      });
      return 'pending' as const;
    });
  }

  /** 1-Click reprint: resets every failed job back to pending and returns the count. */
  public async requeueFailedPrintJobs(tenantId: string): Promise<number> {
    const failedJobs = await this.printQueue
      .where('[tenantId+status]')
      .equals([tenantId, 'failed'])
      .toArray();
    if (failedJobs.length === 0) return 0;
    await this.printQueue.bulkPut(
      failedJobs.map((j) => ({
        ...j,
        status: 'pending' as const,
        attempts: 0,
        lastError: undefined,
        nextAttemptAt: undefined,
        updatedAt: new Date().toISOString(),
      }))
    );
    return failedJobs.length;
  }

  public async getPrintQueueStats(tenantId: string): Promise<Record<PrintQueueStatus, number>> {
    const [pending, printing, failed, printed] = await Promise.all([
      this.printQueue.where('[tenantId+status]').equals([tenantId, 'pending']).count(),
      this.printQueue.where('[tenantId+status]').equals([tenantId, 'printing']).count(),
      this.printQueue.where('[tenantId+status]').equals([tenantId, 'failed']).count(),
      this.printQueue.where('[tenantId+status]').equals([tenantId, 'printed']).count(),
    ]);
    return { pending, printing, failed, printed };
  }

  /**
   * Immutable shift lock: persists the CLOSED shift snapshot into Dexie. A record
   * that is already closed/locked is rejected — closed shift numbers can never be
   * mutated retroactively through this path.
   */
  public async persistClosedShiftImmutable(record: DecomposedShiftRecord): Promise<void> {
    await this.transaction('rw', this.shifts, async () => {
      const existing = await this.shifts.get(record.id);
      if (existing && (existing.locked || existing.status === 'CLOSED')) {
        throw new Error('این شیفت در پایگاه‌داده قفل شده است و قابل تغییر نیست.');
      }
      await this.shifts.put({ ...record, status: 'CLOSED', locked: true });
    });
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
  const resolved = tenantId.trim();
  const dbName = (resolved === 'tenant-100hich-01' || resolved === '100hich')
    ? 'KarWand_DB_100HICH'
    : `CafeOS_POS_${resolved}`;
  if (!posDbRegistry.has(dbName)) {
    posDbRegistry.set(dbName, new DexiePOSDatabase(dbName));
  }
  return posDbRegistry.get(dbName)!;
}
