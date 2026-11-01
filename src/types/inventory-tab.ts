/**
 * AntiGravity Inventory & Open Tabs Specification Schema
 * Compliant with antigravity_inventory_tab_spec.json (v2.1.0)
 */

// -----------------------------------------------------------------------------
// 1. RAW INGREDIENT DATA CONTRACT
// -----------------------------------------------------------------------------
export type IngredientUnit = 'g' | 'ml' | 'piece' | 'shot';

export interface RawIngredient {
  id: string; // e.g. 'ing_espresso_blend', 'ing_whole_milk'
  title_en: string;
  title_fa: string;
  unit: IngredientUnit;
  initial_stock: number;
  current_stock: number;
  min_safety_stock: number;
  cost_per_unit: number; // Toman per unit
  last_restocked_at: string; // ISO 8601
}

// -----------------------------------------------------------------------------
// 2. PRODUCT RECIPE BILL OF MATERIALS (BOM) DATA CONTRACT
// -----------------------------------------------------------------------------
export interface RecipeIngredientItem {
  ingredient_id: string;
  amount: number; // e.g. 18.0 for 18g espresso
  unit: IngredientUnit;
}

export interface ModifierBOMOverride {
  modifier_key: string; // e.g. 'Oat Milk (+0.70)' or 'شیر جو دوسر'
  replaces?: string; // ingredient_id to replace (e.g. 'ing_whole_milk')
  with?: {
    ingredient_id: string;
    amount: number;
    unit: IngredientUnit;
  };
  adds?: {
    ingredient_id: string;
    amount: number;
    unit: IngredientUnit;
  };
}

export interface ProductRecipeBOM {
  menu_item_id: string;
  menu_item_title?: string;
  ingredients: RecipeIngredientItem[];
  modifier_overrides: ModifierBOMOverride[];
}

// -----------------------------------------------------------------------------
// 3. TABLE SESSION OPEN TAB DATA CONTRACT & STATE MACHINE
// -----------------------------------------------------------------------------
export type TableTabStatus = 'open' | 'printed' | 'settled';

export type TableLifecycleState =
  | 'idle_empty'
  | 'active_open_tab'
  | 'awaiting_checkout'
  | 'reserved';

export interface TabCartItemModifier {
  id?: string;
  nameFa: string;
  priceDelta: number;
}

export interface TabCartItem {
  id: string;
  menuItemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  modifiers?: TabCartItemModifier[];
  subtotal: number;
  notes?: string;
  station?: 'BAR' | 'KITCHEN';
  status?: 'PENDING_DISPATCH' | 'DISPATCHED' | 'PREPARING' | 'SERVED' | 'SETTLED';
  dispatchedAt?: string;
  delivered?: boolean;
}

export interface TabRound {
  round_number: number;
  dispatched_at: string; // ISO 8601
  items: TabCartItem[];
  inventory_deducted: boolean;
  status: 'sent_to_bar' | 'delivered';
}

export interface TableSessionTab {
  tab_id: string; // UUID
  table_id: string; // e.g. 'T1', 'T2', 'BAR-1'
  table_label: string; // e.g. 'میز ۲'
  server_name: string;
  guest_count: number;
  status: TableTabStatus;
  opened_at: string; // ISO 8601
  rounds: TabRound[];
  subtotal: number;
  vat: number; // VAT or tax if applicable
  discount: number;
  total_due: number;
  notes?: string;
  settled_at?: string;
  settlement_method?: 'CARD' | 'CASH' | 'SPLIT';
}

// -----------------------------------------------------------------------------
// 4. INVENTORY STOCK STATUS EVALUATION
// -----------------------------------------------------------------------------
export type IngredientStockLevel = 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface IngredientStockAlert {
  ingredientId: string;
  titleFa: string;
  titleEn: string;
  currentStock: number;
  minSafetyStock: number;
  unit: IngredientUnit;
  level: IngredientStockLevel;
}

export interface MenuItemStockStatus {
  menuItemId: string;
  isAvailable: boolean;
  hasLowStockIngredients: boolean;
  isOutOfStock: boolean;
  limitingIngredients: IngredientStockAlert[];
}
