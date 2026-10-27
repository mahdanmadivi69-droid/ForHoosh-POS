/**
 * CAFE OS — Multi-Tenant PostgreSQL Atomic Order & Payment Persistence Service
 * Enforces PostgreSQL Row-Level Security (RLS), Integer-Only Toman Arithmetic, and Idempotency.
 */

import {
  OrderAggregate,
  PaymentRecord,
  validateOrderAggregate,
} from '../types/order-domain';

export interface DbSyncResult {
  success: boolean;
  isIdempotentReplay: boolean;
  orderId: string;
  orderNumber: number;
  message?: string;
}

/**
 * PostgreSQL DDL Schema with Row-Level Security (RLS) policies
 * Ready to be executed in PostgreSQL or Cloud SQL migrations.
 */
export const POSTGRES_RLS_SCHEMA_DDL = `
-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(16) DEFAULT 'TOMAN',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Orders Table with RLS
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  client_generated_id UUID NOT NULL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  shift_id VARCHAR(64) NOT NULL,
  order_number INT NOT NULL,
  order_type VARCHAR(32) NOT NULL DEFAULT 'DINE_IN',
  state VARCHAR(32) NOT NULL DEFAULT 'PLACED',
  table_label VARCHAR(64),
  customer_name VARCHAR(128),
  customer_phone VARCHAR(32),
  gross_amount_toman BIGINT NOT NULL CHECK (gross_amount_toman >= 0),
  discount_amount_toman BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount_toman >= 0),
  net_total_toman BIGINT NOT NULL CHECK (net_total_toman >= 0),
  paid_amount_toman BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_toman >= 0),
  void_reason TEXT,
  created_by_user_id VARCHAR(64) NOT NULL,
  created_by_user_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_generated_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_isolation ON orders;
CREATE POLICY orders_tenant_isolation ON orders
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 4. Order Items Table with RLS
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  menu_item_id VARCHAR(64) NOT NULL,
  item_name_snapshot VARCHAR(255) NOT NULL,
  unit_price_snapshot_toman BIGINT NOT NULL CHECK (unit_price_snapshot_toman >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  modifiers_delta_toman BIGINT NOT NULL DEFAULT 0,
  subtotal_toman BIGINT NOT NULL CHECK (subtotal_toman >= 0),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_tenant_isolation ON order_items;
CREATE POLICY order_items_tenant_isolation ON order_items
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 5. Payments Table with RLS
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  client_generated_id UUID NOT NULL,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  shift_id VARCHAR(64) NOT NULL,
  received_by_user_id VARCHAR(64) NOT NULL,
  received_by_user_name VARCHAR(128),
  amount_toman BIGINT NOT NULL CHECK (amount_toman > 0),
  payment_method VARCHAR(32) NOT NULL,
  reference_code VARCHAR(128),
  terminal_name VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'SUCCESSFUL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 6. Idempotency Registry Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  response_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_tenant ON idempotency_keys(tenant_id);
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idempotency_keys_tenant_isolation ON idempotency_keys;
CREATE POLICY idempotency_keys_tenant_isolation ON idempotency_keys
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
`;

/**
 * In-Memory Database Store for environments where external PostgreSQL is mocked or offline
 */
class InMemoryPgStore {
  private orders: Map<string, OrderAggregate> = new Map();
  private idempotencyKeys: Map<string, { tenantId: string; orderId: string; orderNumber: number }> = new Map();
  private orderCounter = 1000;

  public async insertAtomic(
    tenantId: string,
    order: OrderAggregate
  ): Promise<DbSyncResult> {
    // 1. Multi-Tenant RLS Check: tenantId must match session tenant
    if (!order.tenantId || order.tenantId !== tenantId) {
      throw new Error(`RLS Violation: Order tenantId (${order.tenantId}) does not match session tenantId (${tenantId})`);
    }

    // 2. Idempotency Key check using clientGeneratedId
    const existing = this.idempotencyKeys.get(order.clientGeneratedId);
    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new Error('RLS Violation: Cross-tenant idempotency conflict detected.');
      }
      return {
        success: true,
        isIdempotentReplay: true,
        orderId: existing.orderId,
        orderNumber: existing.orderNumber,
        message: 'Order already processed idempotently.',
      };
    }

    // 3. Domain validation (Integer math invariants)
    const validation = validateOrderAggregate(order);
    if (!validation.isValid) {
      throw new Error(`Order Aggregate Validation Failed: ${validation.errors.join('; ')}`);
    }

    // 4. Generate order ID and auto-increment number if not present
    this.orderCounter += 1;
    const finalOrderNumber = order.orderNumber > 0 ? order.orderNumber : this.orderCounter;
    const finalOrderId = order.id || `ord-pg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const savedOrder: OrderAggregate = {
      ...order,
      id: finalOrderId,
      orderNumber: finalOrderNumber,
      updatedAt: new Date().toISOString(),
    };

    // 5. Atomic persistence
    this.orders.set(finalOrderId, savedOrder);
    this.idempotencyKeys.set(order.clientGeneratedId, {
      tenantId,
      orderId: finalOrderId,
      orderNumber: finalOrderNumber,
    });

    return {
      success: true,
      isIdempotentReplay: false,
      orderId: finalOrderId,
      orderNumber: finalOrderNumber,
    };
  }

  public getOrder(tenantId: string, orderId: string): OrderAggregate | undefined {
    const order = this.orders.get(orderId);
    if (order && order.tenantId === tenantId) {
      return order;
    }
    return undefined;
  }

  public listOrders(tenantId: string): OrderAggregate[] {
    return Array.from(this.orders.values()).filter((o) => o.tenantId === tenantId);
  }
}

export const inMemoryPgStore = new InMemoryPgStore();

/**
 * Service to execute atomic insertion of OrderAggregate and PaymentRecord
 * Supports both PostgreSQL pool clients and in-memory mock fallback.
 */
export async function insertOrderAggregateAtomic(
  tenantId: string,
  order: OrderAggregate,
  pgClient?: any
): Promise<DbSyncResult> {
  // If an active PostgreSQL pgClient is provided:
  if (pgClient && typeof pgClient.query === 'function') {
    try {
      await pgClient.query('BEGIN');

      // 1. Set multi-tenant RLS session context
      await pgClient.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      // 2. Check idempotency
      const idemRes = await pgClient.query(
        'SELECT entity_id, response_payload FROM idempotency_keys WHERE key = $1 AND tenant_id = $2',
        [order.clientGeneratedId, tenantId]
      );

      if (idemRes.rows && idemRes.rows.length > 0) {
        await pgClient.query('COMMIT');
        const payload = idemRes.rows[0].response_payload || {};
        return {
          success: true,
          isIdempotentReplay: true,
          orderId: idemRes.rows[0].entity_id,
          orderNumber: payload.orderNumber || 0,
          message: 'Order already persisted (Idempotent response)',
        };
      }

      // 3. Domain Invariants Validation
      const validation = validateOrderAggregate(order);
      if (!validation.isValid) {
        throw new Error(`Domain invariant error: ${validation.errors.join('; ')}`);
      }

      // 4. Calculate auto-increment order number
      const numRes = await pgClient.query(
        'SELECT COALESCE(MAX(order_number), 1000) + 1 AS next_num FROM orders WHERE tenant_id = $1',
        [tenantId]
      );
      const nextOrderNumber = order.orderNumber > 0 ? order.orderNumber : Number(numRes.rows[0].next_num);
      const orderId = order.id || `ord-${order.clientGeneratedId.slice(0, 8)}`;

      // 5. Insert order
      await pgClient.query(
        `INSERT INTO orders (
          id, client_generated_id, tenant_id, shift_id, order_number, order_type,
          state, table_label, customer_name, customer_phone, gross_amount_toman,
          discount_amount_toman, net_total_toman, paid_amount_toman, void_reason,
          created_by_user_id, created_by_user_name, created_at, updated_at, fulfilled_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )`,
        [
          orderId,
          order.clientGeneratedId,
          tenantId,
          order.shiftId,
          nextOrderNumber,
          order.orderType,
          order.state,
          order.tableLabel || null,
          order.customerName || null,
          order.customerPhone || null,
          order.grossAmountToman,
          order.discountAmountToman,
          order.netTotalToman,
          order.paidAmountToman || order.netTotalToman,
          order.voidReason || null,
          order.createdByUserId,
          order.createdByUserName,
          order.createdAt || new Date().toISOString(),
          new Date().toISOString(),
          order.fulfilledAt || null,
        ]
      );

      // 6. Insert Order Items & Modifiers
      for (const item of order.items) {
        await pgClient.query(
          `INSERT INTO order_items (
            id, order_id, tenant_id, menu_item_id, item_name_snapshot,
            unit_price_snapshot_toman, quantity, modifiers_delta_toman, subtotal_toman, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            item.id,
            orderId,
            tenantId,
            item.menuItemId,
            item.itemNameSnapshot,
            item.unitPriceSnapshotToman,
            item.quantity,
            item.modifiersDeltaToman || 0,
            item.subtotalToman,
            item.notes || null,
          ]
        );
      }

      // 7. Insert Payments
      for (const pay of order.payments) {
        await pgClient.query(
          `INSERT INTO payments (
            id, order_id, client_generated_id, tenant_id, shift_id,
            received_by_user_id, received_by_user_name, amount_toman,
            payment_method, reference_code, terminal_name, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            pay.id,
            orderId,
            order.clientGeneratedId,
            tenantId,
            pay.shiftId,
            pay.receivedByUserId,
            pay.receivedByUserName || null,
            pay.amountToman,
            pay.paymentMethod,
            pay.referenceCode || null,
            pay.terminalName || null,
            pay.status,
            pay.createdAt || new Date().toISOString(),
          ]
        );
      }

      // 8. Register Idempotency Key
      await pgClient.query(
        `INSERT INTO idempotency_keys (key, tenant_id, entity_type, entity_id, response_payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.clientGeneratedId,
          tenantId,
          'ORDER',
          orderId,
          JSON.stringify({ orderNumber: nextOrderNumber, state: order.state }),
        ]
      );

      await pgClient.query('COMMIT');

      return {
        success: true,
        isIdempotentReplay: false,
        orderId,
        orderNumber: nextOrderNumber,
      };
    } catch (err: any) {
      await pgClient.query('ROLLBACK');
      throw err;
    }
  }

  // Fallback: In-memory store
  return inMemoryPgStore.insertAtomic(tenantId, order);
}
