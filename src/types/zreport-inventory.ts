/**
 * Types & Interfaces for Shift Z-Report & Inventory Stock Inward (v2.5.0)
 * Compliant with CafeOS-Shift-ZReport-InventoryInward
 */

export interface MaterialDepletionItem {
  item_id: string;
  name: string;
  consumed_qty: number;
  depleted_amount?: number; // Supported alias for consumed_qty
  unit: string;
  total_cost_toman?: number;
}

export interface ZReportData {
  id: string;
  shift_id: string;
  tenant_id?: string;
  tenantId?: string;
  opened_at: string;
  closed_at: string;
  opened_by: string;
  closed_by: string;
  opening_cash: number;
  opening_cash_float?: number; // Supported alias
  openingCash?: number; // Supported alias
  openingCashToman?: number; // Supported alias
  counted_cash_float: number;
  actual_cash_counted?: number; // Supported alias for counted_cash_float
  expected_cash: number;
  discrepancy: number;
  is_shortage: boolean;
  is_overage: boolean;
  is_balanced: boolean;
  discrepancy_reason?: string;
  notes?: string;
  gross_sales: number;
  discounts_total: number;
  net_sales: number;
  vat_total: number;
  expenses_total: number;
  expenses_cash_drawer: number;
  order_count: number;
  payment_methods: {
    pos_card: number;
    cash: number;
  };
  material_depletions: MaterialDepletionItem[];
  timestamp: string;
}

export interface StockInwardTransaction {
  id: string;
  raw_item_id: string;
  raw_item_name: string;
  batch_number: string;
  incoming_quantity: number;
  unit: string;
  previous_stock: number;
  new_stock: number;
  purchase_cost_per_unit: number;
  previous_cost_per_unit: number;
  weighted_average_cost: number;
  total_invoice_cost: number;
  supplier_name: string;
  notes?: string;
  timestamp: string;
  operator_name: string;
}
