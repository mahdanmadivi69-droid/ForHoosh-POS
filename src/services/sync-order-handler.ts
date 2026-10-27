/**
 * CAFE OS — Offline Order Sync Handler
 * Handles idempotent order ingestion, unconditional financial recording,
 * and inventory overdraft conflict resolution (STOCKOUT_OVERDRAFT).
 */

export interface SyncOrderPayload {
  tenantId: string;
  clientGeneratedId: string;
  source: 'POS' | 'SMART_ORDERS';
  order: {
    items: Array<{ productId: string; quantity: number; name: string }>;
    totalNet: number;
    payments: Array<{ method: string; amount: number; referenceNumber?: string }>;
    createdAt: string;
  };
}

export interface InventoryItemRecord {
  productId: string;
  availableQuantity: number;
}

export interface AuditLogIncident {
  id: string;
  tenantId: string;
  orderId: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  details: {
    productId: string;
    productName: string;
    requested: number;
    availableAtSync: number;
    deficit: number;
    occurredOfflineAt: string;
  };
  createdAt?: string;
}

export interface TransactionContext {
  orders: {
    findByClientId(
      tenantId: string,
      clientGeneratedId: string
    ): Promise<{ id: string; clientGeneratedId: string; [key: string]: any } | null>;
    insert(data: {
      tenantId: string;
      clientGeneratedId: string;
      source: 'POS' | 'SMART_ORDERS';
      status: 'PAID';
      totalNet: number;
      createdAt: Date;
      syncedAt: Date;
    }): Promise<{ id: string; [key: string]: any }>;
  };
  payments: {
    insert(data: {
      orderId: string;
      tenantId: string;
      amount: number;
      method: string;
      referenceNumber?: string;
      status: 'SETTLED';
    }): Promise<{ id: string; [key: string]: any }>;
  };
  inventory: {
    getByProductId(
      tenantId: string,
      productId: string
    ): Promise<InventoryItemRecord | null>;
    decrement(
      tenantId: string,
      productId: string,
      quantity: number,
      options?: { allowNegative?: boolean }
    ): Promise<number>;
  };
  auditLogs: {
    insert(data: {
      tenantId: string;
      orderId: string;
      type: string;
      severity: 'INFO' | 'WARNING' | 'ERROR';
      details: any;
    }): Promise<AuditLogIncident>;
  };
}

export interface DatabaseClient {
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export interface SyncResult {
  status: 'SYNCED_SUCCESSFULLY' | 'ALREADY_SYNCED';
  orderId: string;
  hasInventoryConflicts?: boolean;
  conflicts?: AuditLogIncident[];
}

/**
 * Processes offline order synchronization with guaranteed financial settlement
 * and inventory overdraft handling for barista and warehouse audits.
 */
export async function processOfflineOrderSync(
  db: DatabaseClient,
  payload: SyncOrderPayload
): Promise<SyncResult> {
  return await db.transaction(async (tx) => {
    // ۱. بررسی تکراری نبودن (Idempotency Check)
    const existingOrder = await tx.orders.findByClientId(
      payload.tenantId,
      payload.clientGeneratedId
    );
    if (existingOrder) {
      // سفارش قبلاً ثبت شده (پاسخ مثبت برمیگردانیم تا کلاینت صف خود را پاک کند)
      return { status: 'ALREADY_SYNCED', orderId: existingOrder.id };
    }

    // ۲. ثبت قطعی و بدون قیدوشرط سند مالی و سفارش
    const newOrder = await tx.orders.insert({
      tenantId: payload.tenantId,
      clientGeneratedId: payload.clientGeneratedId,
      source: payload.source,
      status: 'PAID', // پول قبلاً پرداخت شده
      totalNet: payload.order.totalNet,
      createdAt: new Date(payload.order.createdAt),
      syncedAt: new Date(),
    });

    // ثبت پرداختها
    for (const payment of payload.order.payments) {
      await tx.payments.insert({
        orderId: newOrder.id,
        tenantId: payload.tenantId,
        amount: payment.amount,
        method: payment.method,
        referenceNumber: payment.referenceNumber,
        status: 'SETTLED',
      });
    }

    // ۳. مدیریت موجودی و ثبت تضادها (Inventory Allocation)
    const inventoryWarnings: AuditLogIncident[] = [];

    for (const item of payload.order.items) {
      const stock = await tx.inventory.getByProductId(payload.tenantId, item.productId);

      if (!stock || stock.availableQuantity < item.quantity) {
        // --- وقوع تضاد موجودی (Conflict Detected) ---
        const deficit = item.quantity - (stock ? stock.availableQuantity : 0);

        // الف) اجازه منفی شدن موجودی داده میشود تا جریان مالی قطع نشود
        await tx.inventory.decrement(payload.tenantId, item.productId, item.quantity, {
          allowNegative: true,
        });

        // ب) ثبت لاگ مغایرت جهت حسابرسی انباردار
        const incident = await tx.auditLogs.insert({
          tenantId: payload.tenantId,
          orderId: newOrder.id,
          type: 'STOCKOUT_OVERDRAFT',
          severity: 'WARNING',
          details: {
            productId: item.productId,
            productName: item.name,
            requested: item.quantity,
            availableAtSync: stock ? stock.availableQuantity : 0,
            deficit: deficit,
            occurredOfflineAt: payload.order.createdAt,
          },
        });

        inventoryWarnings.push(incident);
      } else {
        // کسر استاندارد موجودی
        await tx.inventory.decrement(payload.tenantId, item.productId, item.quantity, {
          allowNegative: false,
        });
      }
    }

    return {
      status: 'SYNCED_SUCCESSFULLY',
      orderId: newOrder.id,
      hasInventoryConflicts: inventoryWarnings.length > 0,
      conflicts: inventoryWarnings,
    };
  });
}

/**
 * In-Memory / Local Database Client implementation for testing and development environments
 */
export class InMemoryDatabaseClient implements DatabaseClient {
  public ordersMap: Map<string, any> = new Map();
  public paymentsMap: Map<string, any> = new Map();
  public inventoryMap: Map<string, { productId: string; availableQuantity: number }> = new Map();
  public auditLogsList: AuditLogIncident[] = [];

  constructor(initialInventory?: Array<{ productId: string; availableQuantity: number }>) {
    if (initialInventory) {
      for (const item of initialInventory) {
        this.inventoryMap.set(item.productId, { ...item });
      }
    }
  }

  public setStock(productId: string, availableQuantity: number): void {
    this.inventoryMap.set(productId, { productId, availableQuantity });
  }

  public getStock(productId: string): number | undefined {
    return this.inventoryMap.get(productId)?.availableQuantity;
  }

  async transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const tx: TransactionContext = {
      orders: {
        findByClientId: async (tenantId: string, clientGeneratedId: string) => {
          for (const order of this.ordersMap.values()) {
            if (order.tenantId === tenantId && order.clientGeneratedId === clientGeneratedId) {
              return order;
            }
          }
          return null;
        },
        insert: async (data) => {
          const id = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const record = { id, ...data };
          this.ordersMap.set(id, record);
          return record;
        },
      },
      payments: {
        insert: async (data) => {
          const id = `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const record = { id, ...data };
          this.paymentsMap.set(id, record);
          return record;
        },
      },
      inventory: {
        getByProductId: async (_tenantId: string, productId: string) => {
          const item = this.inventoryMap.get(productId);
          return item ? { ...item } : null;
        },
        decrement: async (_tenantId: string, productId: string, quantity: number, options) => {
          const current = this.inventoryMap.get(productId);
          const currentQty = current ? current.availableQuantity : 0;
          const newQty = currentQty - quantity;

          if (!options?.allowNegative && newQty < 0) {
            throw new Error(`Inventory underflow for product ${productId}`);
          }

          this.inventoryMap.set(productId, { productId, availableQuantity: newQty });
          return newQty;
        },
      },
      auditLogs: {
        insert: async (data) => {
          const incident: AuditLogIncident = {
            id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ...data,
            createdAt: new Date().toISOString(),
          };
          this.auditLogsList.push(incident);
          return incident;
        },
      },
    };

    return await callback(tx);
  }
}

export const defaultDatabaseClient = new InMemoryDatabaseClient([
  { productId: 'item-1', availableQuantity: 45 },
  { productId: 'item-2', availableQuantity: 30 },
  { productId: 'item-3', availableQuantity: 25 },
  { productId: 'item-7', availableQuantity: 4 }, // Low stock item
  { productId: 'item-latte', availableQuantity: 10 },
  { productId: 'item-v60', availableQuantity: 2 },
]);
