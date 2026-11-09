/**
 * src/db/schema.ts
 * 
 * KarWand POS — 100 HICH Core & Sensory Lab Schema
 * Offline-First SQLite / IndexedDB Schema Definition
 * 
 * Tables:
 *  1. orders: Strict Integer Toman only (`subtotal_toman`, `final_total_toman`, `discount_toman`), `synced_to_cloud` flag.
 *  2. order_items: Line-item breakdown linking to `order_id` with `bom_grams_deducted` (REAL).
 *  3. open_tabs: Managing active shift tables (`tab_id`, `table_or_customer`, `raw_cart_json`, `total_toman`, status).
 *  4. inventory_grain_ledger: Auto-log grain deductions by silo (`silo_id`, `batch_roast_code`, `grams_delta`, `reason`).
 */

export interface OrderRecord {
  id: string; // UUID / Primary Key
  tenant_id: string;
  order_number: number;
  subtotal_toman: number; // Integer Toman Invariant
  discount_toman: number; // Integer Toman Invariant
  final_total_toman: number; // Integer Toman Invariant
  synced_to_cloud: 0 | 1;
  status: 'COMPLETED' | 'VOIDED' | 'REFUNDED';
  table_or_customer?: string;
  created_at: number; // Unix timestamp ms
  updated_at: number;
}

export interface OrderItemRecord {
  id: string; // UUID
  order_id: string; // Foreign Key -> orders.id
  menu_item_id: string;
  item_name: string;
  selected_bean?: 'arabica' | 'blend' | null;
  quantity: number;
  unit_price_toman: number; // Integer Toman Invariant
  total_price_toman: number; // Integer Toman Invariant
  bom_grams_deducted: number; // REAL: Grams deducted for roastery BOM
  notes?: string;
}

export interface OpenTabRecord {
  tab_id: string; // Primary Key
  tabId?: string; // Ergonomic alias
  tenant_id: string;
  table_or_customer: string;
  tableOrCustomer?: string; // Ergonomic alias
  raw_cart_json: string; // Serialized JSON cart
  total_toman: number; // Integer Toman Invariant
  totalToman?: number; // Ergonomic alias
  status: 'OPEN' | 'CLOSED' | 'VOID';
  opened_at: number;
  closed_at?: number;
}

export interface InventoryGrainLedgerRecord {
  id: string; // Primary Key
  tenant_id: string;
  silo_id: string; // e.g. 'SILO_ARABICA_01', 'SILO_BLEND_02'
  siloId?: string; // Ergonomic alias
  batch_roast_code: string; // e.g. 'ROAST-ETH-2026'
  batchRoastCode?: string; // Ergonomic alias
  grams_delta: number; // REAL: negative for deductions, e.g. -18.0
  gramsDelta?: number; // Ergonomic alias
  reason: string; // 'ORDER_PREP_ARABICA', 'ORDER_PREP_BLEND', etc.
  order_id?: string;
  orderId?: string; // Ergonomic alias
  timestamp: number;
}

// -----------------------------------------------------------------------------
// Offline-First SQLite Migration DDL Statements
// -----------------------------------------------------------------------------

export const SQLITE_SCHEMA_DDL = `
-- Table 1: orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number INTEGER NOT NULL,
  subtotal_toman INTEGER NOT NULL,
  discount_toman INTEGER NOT NULL DEFAULT 0,
  final_total_toman INTEGER NOT NULL,
  synced_to_cloud INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  table_or_customer TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(synced_to_cloud);

-- Table 2: order_items
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  selected_bean TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_toman INTEGER NOT NULL,
  total_price_toman INTEGER NOT NULL,
  bom_grams_deducted REAL NOT NULL DEFAULT 0.0,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Table 3: open_tabs
CREATE TABLE IF NOT EXISTS open_tabs (
  tab_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  table_or_customer TEXT NOT NULL,
  raw_cart_json TEXT NOT NULL,
  total_toman INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED', 'VOID')) DEFAULT 'OPEN',
  opened_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_open_tabs_tenant_status ON open_tabs(tenant_id, status);

-- Table 4: inventory_grain_ledger
CREATE TABLE IF NOT EXISTS inventory_grain_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  silo_id TEXT NOT NULL,
  batch_roast_code TEXT NOT NULL,
  grams_delta REAL NOT NULL,
  reason TEXT NOT NULL,
  order_id TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_grain_ledger_silo ON inventory_grain_ledger(silo_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_grain_ledger_tenant ON inventory_grain_ledger(tenant_id);
`;

/**
 * Validates that an order amount strictly adheres to the Integer Toman Invariant.
 */
export function assertIntegerToman(amount: number, fieldName: string): number {
  if (typeof amount !== 'number' || isNaN(amount) || !Number.isInteger(amount) || amount < 0) {
    throw new Error(
      `[Integer Toman Invariant Violation] ${fieldName} must be a non-negative integer. Got: ${amount}`
    );
  }
  return amount;
}
