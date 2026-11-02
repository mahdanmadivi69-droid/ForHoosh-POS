/**
 * Inventory BOM (Bill of Materials) & Raw Ingredient Engine
 * Compliant with antigravity_inventory_tab_spec.json
 * Features:
 *  - Raw ingredient stock management & restock intake
 *  - BOM Recipe associations with grams, milliliters, piece, shot units
 *  - Modifier overrides (replaces ingredient or adds ingredient)
 *  - 3-decimal float precision (FLOAT_DECIMAL_3)
 *  - Low stock warning and out-of-stock gate
 *  - Real-time reactive subscriptions
 *  - Multi-Tenant Data Isolation (Phase 1 Remediation)
 */

import {
  RawIngredient,
  ProductRecipeBOM,
  TabCartItem,
  MenuItemStockStatus,
  IngredientStockAlert,
  IngredientUnit,
} from '../types/inventory-tab';
import { StockInwardTransaction } from '../types/zreport-inventory';
import { db, getCafeDatabase } from '../db/cafeDb';

export const INVENTORY_STORAGE_KEYS = {
  RAW_INGREDIENTS: (tenantId: string) => `cafeos_raw_ingredients_${tenantId}_v2`,
  RECIPES: (tenantId: string) => `cafeos_product_recipes_${tenantId}_v2`,
  LEGACY_RAW_INGREDIENTS: 'cafeos_raw_ingredients_v2',
  LEGACY_RECIPES: 'cafeos_product_recipes_v2',
  MIGRATION_LOG: 'cafeos_inventory_migration_log',
  LEGACY_BACKUP: 'cafeos_raw_ingredients_v2_legacy_backup',
};

// 1. Default seed ingredients for 100 Hich Specialty Coffee Roasters (tenant-100hich-01)
export const SEED_INGREDIENTS_100HICH: RawIngredient[] = [
  {
    id: 'ing_espresso_blend',
    title_en: '100 Hich Signature Espresso Blend',
    title_fa: 'دانه قهوه بِلِند اختصاصی اسپرسو',
    unit: 'g',
    initial_stock: 15000, // 15 kg
    current_stock: 11450,
    min_safety_stock: 2500, // 2.5 kg safety stock
    cost_per_unit: 1800, // 1,800 Toman / g
    last_restocked_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'ing_colombian_beans',
    title_en: 'Single Origin Colombian Supremo Beans',
    title_fa: 'دانه تک‌خاستگاه کلمبیا سوپریمو',
    unit: 'g',
    initial_stock: 8000,
    current_stock: 3200,
    min_safety_stock: 1500,
    cost_per_unit: 2600,
    last_restocked_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'ing_ethiopian_beans',
    title_en: 'Single Origin Ethiopia Yirgacheffe Beans',
    title_fa: 'دانه تک‌خاستگاه اتیوپی یرگاچف',
    unit: 'g',
    initial_stock: 6000,
    current_stock: 1200, // Below safety stock for test scenario
    min_safety_stock: 1500,
    cost_per_unit: 3100,
    last_restocked_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'ing_whole_milk',
    title_en: 'Fresh Whole Dairy Milk 3.5%',
    title_fa: 'شیر تازه پرچرب دامداران ۳.۵٪',
    unit: 'ml',
    initial_stock: 30000, // 30 Liters
    current_stock: 18500,
    min_safety_stock: 5000, // 5 Liters
    cost_per_unit: 65, // 65 Toman / ml
    last_restocked_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'ing_oat_milk',
    title_en: 'Barista Oat Milk (Plant-Based)',
    title_fa: 'شیر جو دوسر باریستا (گیاهی)',
    unit: 'ml',
    initial_stock: 12000,
    current_stock: 4500,
    min_safety_stock: 3000,
    cost_per_unit: 140,
    last_restocked_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'ing_vanilla_syrup',
    title_en: 'Monin Madagascar Vanilla Syrup',
    title_fa: 'سیروپ وانیل ماداگاسکار مونین',
    unit: 'ml',
    initial_stock: 5000,
    current_stock: 2800,
    min_safety_stock: 1000,
    cost_per_unit: 320,
    last_restocked_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'ing_caramel_syrup',
    title_en: 'Monin Salted Caramel Syrup',
    title_fa: 'سیروپ کارامل نمکی مونین',
    unit: 'ml',
    initial_stock: 5000,
    current_stock: 850, // Low stock warning
    min_safety_stock: 1000,
    cost_per_unit: 320,
    last_restocked_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'ing_matcha_powder',
    title_en: 'Ceremonial Grade Uji Matcha',
    title_fa: 'پودر ماچا تشریفاتی اوجی ژاپن',
    unit: 'g',
    initial_stock: 1000,
    current_stock: 650,
    min_safety_stock: 200,
    cost_per_unit: 4500,
    last_restocked_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'ing_butter_croissant',
    title_en: 'French Artisan Butter Croissant',
    title_fa: 'کروسان کره‌ای فرانسوی',
    unit: 'piece',
    initial_stock: 40,
    current_stock: 18,
    min_safety_stock: 8,
    cost_per_unit: 48000,
    last_restocked_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'ing_choco_cookie',
    title_en: 'Double Chocolate Fudge Cookie',
    title_fa: 'کوکی دبل چاکلت فاج بلژیکی',
    unit: 'piece',
    initial_stock: 35,
    current_stock: 5, // Low stock warning
    min_safety_stock: 10,
    cost_per_unit: 35000,
    last_restocked_at: new Date(Date.now() - 43200000).toISOString(),
  },
];

export const SEED_RECIPES_100HICH: ProductRecipeBOM[] = [
  {
    menu_item_id: 'm1_flat_white',
    menu_item_title: 'فلت وایت (Flat White)',
    ingredients: [
      { ingredient_id: 'ing_espresso_blend', amount: 18.0, unit: 'g' },
      { ingredient_id: 'ing_whole_milk', amount: 160.0, unit: 'ml' },
    ],
    modifier_overrides: [
      {
        modifier_key: 'Oat Milk (+0.70)',
        replaces: 'ing_whole_milk',
        with: { ingredient_id: 'ing_oat_milk', amount: 160.0, unit: 'ml' },
      },
      {
        modifier_key: 'شیر جو دوسر',
        replaces: 'ing_whole_milk',
        with: { ingredient_id: 'ing_oat_milk', amount: 160.0, unit: 'ml' },
      },
      {
        modifier_key: 'Triple Shot (+0.90)',
        adds: { ingredient_id: 'ing_espresso_blend', amount: 9.0, unit: 'g' },
      },
      {
        modifier_key: 'شات اضافه',
        adds: { ingredient_id: 'ing_espresso_blend', amount: 9.0, unit: 'g' },
      },
    ],
  },
  {
    menu_item_id: 'm-esp-single',
    menu_item_title: 'اسپرسو سینگل',
    ingredients: [
      { ingredient_id: 'ing_espresso_blend', amount: 9.0, unit: 'g' },
    ],
    modifier_overrides: [
      {
        modifier_key: 'شات اضافه',
        adds: { ingredient_id: 'ing_espresso_blend', amount: 9.0, unit: 'g' },
      },
    ],
  },
  {
    menu_item_id: 'm-esp-double',
    menu_item_title: 'اسپرسو دبل',
    ingredients: [
      { ingredient_id: 'ing_espresso_blend', amount: 18.0, unit: 'g' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'm-americano',
    menu_item_title: 'آمریکانو',
    ingredients: [
      { ingredient_id: 'ing_espresso_blend', amount: 18.0, unit: 'g' },
    ],
    modifier_overrides: [
      {
        modifier_key: 'شات اضافه',
        adds: { ingredient_id: 'ing_espresso_blend', amount: 9.0, unit: 'g' },
      },
    ],
  },
  {
    menu_item_id: 'm-latte',
    menu_item_title: 'کافه لاته',
    ingredients: [
      { ingredient_id: 'ing_espresso_blend', amount: 18.0, unit: 'g' },
      { ingredient_id: 'ing_whole_milk', amount: 220.0, unit: 'ml' },
    ],
    modifier_overrides: [
      {
        modifier_key: 'شیر جو دوسر',
        replaces: 'ing_whole_milk',
        with: { ingredient_id: 'ing_oat_milk', amount: 220.0, unit: 'ml' },
      },
      {
        modifier_key: 'سیروپ وانیل',
        adds: { ingredient_id: 'ing_vanilla_syrup', amount: 20.0, unit: 'ml' },
      },
      {
        modifier_key: 'سیروپ کارامل',
        adds: { ingredient_id: 'ing_caramel_syrup', amount: 20.0, unit: 'ml' },
      },
    ],
  },
  {
    menu_item_id: 'm-cappuccino',
    menu_item_title: 'کاپوچینو',
    ingredients: [
      { ingredient_id: 'ing_espresso_blend', amount: 18.0, unit: 'g' },
      { ingredient_id: 'ing_whole_milk', amount: 150.0, unit: 'ml' },
    ],
    modifier_overrides: [
      {
        modifier_key: 'شیر جو دوسر',
        replaces: 'ing_whole_milk',
        with: { ingredient_id: 'ing_oat_milk', amount: 150.0, unit: 'ml' },
      },
    ],
  },
  {
    menu_item_id: 'm-v60-ethiopia',
    menu_item_title: 'دمی V60 اتیوپی یرگاچف',
    ingredients: [
      { ingredient_id: 'ing_ethiopian_beans', amount: 15.0, unit: 'g' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'm-v60-colombia',
    menu_item_title: 'دمی V60 کلمبیا سوپریمو',
    ingredients: [
      { ingredient_id: 'ing_colombian_beans', amount: 15.0, unit: 'g' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'm-croissant',
    menu_item_title: 'کروسان فرانسوی',
    ingredients: [
      { ingredient_id: 'ing_butter_croissant', amount: 1.0, unit: 'piece' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'm-cookie',
    menu_item_title: 'کوکی دبل چاکلت',
    ingredients: [
      { ingredient_id: 'ing_choco_cookie', amount: 1.0, unit: 'piece' },
    ],
    modifier_overrides: [],
  },
];

// 2. Default seed ingredients for Modendo Boardgame & Gaming Cafe (tenant-modendo-01)
export const SEED_INGREDIENTS_MODENDO: RawIngredient[] = [
  {
    id: 'mod_ing_espresso_blend',
    title_en: 'Modendo Dark Roast Espresso Blend',
    title_fa: 'دانه قهوه دارک رست مودندو',
    unit: 'g',
    initial_stock: 12000,
    current_stock: 9500,
    min_safety_stock: 2000,
    cost_per_unit: 1400,
    last_restocked_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'mod_ing_milk',
    title_en: 'Fresh Whole Milk 3.0%',
    title_fa: 'شیر تازه ۳.۰٪ مودندو',
    unit: 'ml',
    initial_stock: 25000,
    current_stock: 16000,
    min_safety_stock: 4000,
    cost_per_unit: 60,
    last_restocked_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mod_ing_burger_patty',
    title_en: 'Premium Beef Burger Patty 150g',
    title_fa: 'پتی برگر گوشت گوساله ۱۵۰ گرمی',
    unit: 'piece',
    initial_stock: 60,
    current_stock: 35,
    min_safety_stock: 12,
    cost_per_unit: 85000,
    last_restocked_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'mod_ing_burger_bun',
    title_en: 'Brioche Burger Bun',
    title_fa: 'نان برگر فرانسوی بریوش',
    unit: 'piece',
    initial_stock: 60,
    current_stock: 35,
    min_safety_stock: 12,
    cost_per_unit: 12000,
    last_restocked_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'mod_ing_fries',
    title_en: 'Golden Cut French Fries',
    title_fa: 'سیب‌زمینی خلال طلایی مودندو',
    unit: 'g',
    initial_stock: 20000,
    current_stock: 14000,
    min_safety_stock: 3000,
    cost_per_unit: 45,
    last_restocked_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'mod_ing_soda_syrup',
    title_en: 'Craft Cola Soda Syrup',
    title_fa: 'عصاره نوشابه دست‌ساز مودندو',
    unit: 'ml',
    initial_stock: 8000,
    current_stock: 4200,
    min_safety_stock: 1500,
    cost_per_unit: 110,
    last_restocked_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const SEED_RECIPES_MODENDO: ProductRecipeBOM[] = [
  {
    menu_item_id: 'item-mod-burger-classic',
    menu_item_title: 'برگر کلاسیک مودندو',
    ingredients: [
      { ingredient_id: 'mod_ing_burger_patty', amount: 1.0, unit: 'piece' },
      { ingredient_id: 'mod_ing_burger_bun', amount: 1.0, unit: 'piece' },
      { ingredient_id: 'mod_ing_fries', amount: 150.0, unit: 'g' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'mod-burger-classic',
    menu_item_title: 'برگر کلاسیک مودندو',
    ingredients: [
      { ingredient_id: 'mod_ing_burger_patty', amount: 1.0, unit: 'piece' },
      { ingredient_id: 'mod_ing_burger_bun', amount: 1.0, unit: 'piece' },
      { ingredient_id: 'mod_ing_fries', amount: 150.0, unit: 'g' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'mod-espresso',
    menu_item_title: 'اسپرسو مودندو',
    ingredients: [
      { ingredient_id: 'mod_ing_espresso_blend', amount: 18.0, unit: 'g' },
    ],
    modifier_overrides: [],
  },
  {
    menu_item_id: 'mod-latte',
    menu_item_title: 'لاته مودندو',
    ingredients: [
      { ingredient_id: 'mod_ing_espresso_blend', amount: 18.0, unit: 'g' },
      { ingredient_id: 'mod_ing_milk', amount: 200.0, unit: 'ml' },
    ],
    modifier_overrides: [],
  },
];

// Backwards compatibility alias
const SEED_INGREDIENTS = SEED_INGREDIENTS_100HICH;
const SEED_RECIPES = SEED_RECIPES_100HICH;

export interface StockAdjustmentRecord {
  id: string;
  tenantId: string;
  raw_item_id: string;
  adjustment_quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  operator_name?: string;
  timestamp: string;
}

type InventoryChangeListener = (ingredients: RawIngredient[], recipes: ProductRecipeBOM[], tenantId: string) => void;

export class InventoryBomService {
  private tenantIngredients: Map<string, RawIngredient[]> = new Map();
  private tenantRecipes: Map<string, ProductRecipeBOM[]> = new Map();
  private processedOrderDeductions: Map<string, Set<string>> = new Map();
  private stockAdjustments: Map<string, StockAdjustmentRecord[]> = new Map();
  private currentTenantId: string | null = null;
  private listeners: Set<InventoryChangeListener> = new Set();

  constructor() {
    this.migrateLegacyData();
    this.loadStateForTenant(this.getActiveTenantId());
  }

  /**
   * Resolve active tenant ID:
   * 1. Explicit override if provided
   * 2. Injected service context (this.currentTenantId)
   * 3. Ambient storage state (cafeos_active_tenant_id)
   * 4. Default fallback ('tenant-100hich-01')
   */
  public getActiveTenantId(overrideTenantId?: string): string {
    if (overrideTenantId && typeof overrideTenantId === 'string' && overrideTenantId.trim()) {
      return overrideTenantId.trim();
    }
    if (this.currentTenantId) {
      return this.currentTenantId;
    }
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const stored = localStorage.getItem('cafeos_active_tenant_id');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
          }
        }
      } catch {
        // ignore
      }
    }
    return 'tenant-100hich-01';
  }

  public setTenantContext(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') return;
    this.currentTenantId = tenantId.trim();
    this.loadStateForTenant(this.currentTenantId);
    this.notifyListeners(this.currentTenantId);
  }

  /**
   * Load state for a specific tenant into in-memory partition
   */
  private loadStateForTenant(tenantId: string): void {
    if (this.tenantIngredients.has(tenantId) && this.tenantRecipes.has(tenantId)) {
      return;
    }

    const defaultIngredients = tenantId === 'tenant-modendo-01'
      ? [...SEED_INGREDIENTS_MODENDO]
      : tenantId === 'tenant-100hich-01'
        ? [...SEED_INGREDIENTS_100HICH]
        : [];

    const defaultRecipes = tenantId === 'tenant-modendo-01'
      ? [...SEED_RECIPES_MODENDO]
      : tenantId === 'tenant-100hich-01'
        ? [...SEED_RECIPES_100HICH]
        : [];

    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const ingKey = INVENTORY_STORAGE_KEYS.RAW_INGREDIENTS(tenantId);
        const storedIngs = localStorage.getItem(ingKey);
        if (storedIngs) {
          this.tenantIngredients.set(tenantId, JSON.parse(storedIngs));
        } else {
          this.tenantIngredients.set(tenantId, defaultIngredients);
          this.persistIngredients(tenantId);
        }

        const recipeKey = INVENTORY_STORAGE_KEYS.RECIPES(tenantId);
        const storedRecipes = localStorage.getItem(recipeKey);
        if (storedRecipes) {
          this.tenantRecipes.set(tenantId, JSON.parse(storedRecipes));
        } else {
          this.tenantRecipes.set(tenantId, defaultRecipes);
          this.persistRecipes(tenantId);
        }
      } else {
        this.tenantIngredients.set(tenantId, defaultIngredients);
        this.tenantRecipes.set(tenantId, defaultRecipes);
      }
    } catch {
      this.tenantIngredients.set(tenantId, defaultIngredients);
      this.tenantRecipes.set(tenantId, defaultRecipes);
    }
  }

  private persistIngredients(tenantId: string): void {
    try {
      const ings = this.tenantIngredients.get(tenantId) || [];
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(
          INVENTORY_STORAGE_KEYS.RAW_INGREDIENTS(tenantId),
          JSON.stringify(ings)
        );
      }
      this.notifyListeners(tenantId);
      this.syncToDexieDb(tenantId);
    } catch (e) {
      console.error(`Failed to persist raw ingredients for tenant ${tenantId}:`, e);
    }
  }

  private persistRecipes(tenantId: string): void {
    try {
      const recs = this.tenantRecipes.get(tenantId) || [];
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(
          INVENTORY_STORAGE_KEYS.RECIPES(tenantId),
          JSON.stringify(recs)
        );
      }
      this.notifyListeners(tenantId);
    } catch (e) {
      console.error(`Failed to persist recipes for tenant ${tenantId}:`, e);
    }
  }

  private async syncToDexieDb(tenantId: string): Promise<void> {
    try {
      const targetDb = getCafeDatabase(tenantId);
      if (targetDb && targetDb.inventoryItems) {
        const ings = this.tenantIngredients.get(tenantId) || [];
        for (const ing of ings) {
          const existing = await targetDb.inventoryItems.get(ing.id);
          if (existing) {
            await targetDb.inventoryItems.update(ing.id, {
              currentStock: ing.current_stock,
              updatedAt: Date.now(),
            });
          } else {
            await targetDb.inventoryItems.put({
              id: ing.id,
              name: ing.title_fa,
              category: 'raw_materials',
              currentStock: ing.current_stock,
              unit: (ing.unit === 'g' || ing.unit === 'ml' || ing.unit === 'piece') ? ing.unit : 'piece',
              costPerUnit: ing.cost_per_unit,
              minThreshold: ing.min_safety_stock,
              updatedAt: Date.now(),
            });
          }
        }
      }
    } catch {
      // Non-blocking sync
    }
  }

  /**
   * Safe, Idempotent Legacy Migration:
   * Migrates legacy un-scoped `cafeos_raw_ingredients_v2` and `cafeos_product_recipes_v2`.
   * Verified Ownership: Legacy records belong to 100 HICH (tenant-100hich-01).
   * Modendo inventory is never polluted with 100 HICH stock.
   */
  public migrateLegacyData(): {
    migrated: boolean;
    recordCount: number;
    targetTenant: string;
    message: string;
  } {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return {
        migrated: false,
        recordCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'No localStorage available.',
      };
    }

    const legacyIngs = localStorage.getItem(INVENTORY_STORAGE_KEYS.LEGACY_RAW_INGREDIENTS);
    const target100HichKey = INVENTORY_STORAGE_KEYS.RAW_INGREDIENTS('tenant-100hich-01');
    const existing100Hich = localStorage.getItem(target100HichKey);

    // If target already exists, migration was already completed idempotently
    if (existing100Hich) {
      return {
        migrated: false,
        recordCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'Tenant scoped store already initialized; skipping to avoid overwrites.',
      };
    }

    if (!legacyIngs) {
      return {
        migrated: false,
        recordCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'No legacy un-scoped records found.',
      };
    }

    try {
      const parsedLegacy: RawIngredient[] = JSON.parse(legacyIngs);
      if (!Array.isArray(parsedLegacy) || parsedLegacy.length === 0) {
        return {
          migrated: false,
          recordCount: 0,
          targetTenant: 'tenant-100hich-01',
          message: 'Legacy store empty.',
        };
      }

      // 1. Create a safe, permanent backup of legacy data
      localStorage.setItem(INVENTORY_STORAGE_KEYS.LEGACY_BACKUP, legacyIngs);

      // 2. Migrate records into 100 HICH store
      localStorage.setItem(target100HichKey, JSON.stringify(parsedLegacy));
      this.tenantIngredients.set('tenant-100hich-01', parsedLegacy);

      // 3. Migrate legacy recipes if present
      const legacyRecs = localStorage.getItem(INVENTORY_STORAGE_KEYS.LEGACY_RECIPES);
      if (legacyRecs) {
        localStorage.setItem(
          INVENTORY_STORAGE_KEYS.RECIPES('tenant-100hich-01'),
          legacyRecs
        );
      }

      // 4. Log migration audit record
      const migrationLog = {
        timestamp: new Date().toISOString(),
        legacyCount: parsedLegacy.length,
        targetTenant: 'tenant-100hich-01',
        status: 'SUCCESS',
      };
      localStorage.setItem(
        INVENTORY_STORAGE_KEYS.MIGRATION_LOG,
        JSON.stringify(migrationLog)
      );

      return {
        migrated: true,
        recordCount: parsedLegacy.length,
        targetTenant: 'tenant-100hich-01',
        message: `Successfully migrated ${parsedLegacy.length} raw ingredients to tenant-100hich-01.`,
      };
    } catch (err: any) {
      console.error('Failed to migrate legacy inventory BOM data:', err);
      return {
        migrated: false,
        recordCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: `Migration failed: ${err?.message}`,
      };
    }
  }

  /**
   * Rollback legacy migration: restores legacy un-scoped state from backup
   */
  public rollbackLegacyMigration(): boolean {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    try {
      const backup = localStorage.getItem(INVENTORY_STORAGE_KEYS.LEGACY_BACKUP);
      if (backup) {
        localStorage.setItem(INVENTORY_STORAGE_KEYS.LEGACY_RAW_INGREDIENTS, backup);
        localStorage.removeItem(INVENTORY_STORAGE_KEYS.RAW_INGREDIENTS('tenant-100hich-01'));
        this.tenantIngredients.delete('tenant-100hich-01');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public subscribe(listener: InventoryChangeListener): () => void {
    this.listeners.add(listener);
    const tenantId = this.getActiveTenantId();
    this.loadStateForTenant(tenantId);
    listener(
      this.tenantIngredients.get(tenantId) || [],
      this.tenantRecipes.get(tenantId) || [],
      tenantId
    );
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(tenantId: string) {
    const ings = this.tenantIngredients.get(tenantId) || [];
    const recs = this.tenantRecipes.get(tenantId) || [];
    this.listeners.forEach((fn) => {
      try {
        fn(ings, recs, tenantId);
      } catch (e) {
        console.error('Error notifying inventory listener:', e);
      }
    });
  }

  public getAllIngredients(tenantId?: string): RawIngredient[] {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    return [...(this.tenantIngredients.get(tId) || [])];
  }

  public getIngredientById(id: string, tenantId?: string): RawIngredient | undefined {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    return (this.tenantIngredients.get(tId) || []).find((i) => i.id === id);
  }

  public getAllRecipes(tenantId?: string): ProductRecipeBOM[] {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    return [...(this.tenantRecipes.get(tId) || [])];
  }

  public getRecipeForMenuItem(menuItemId: string, itemTitle?: string, tenantId?: string): ProductRecipeBOM | undefined {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const recipes = this.tenantRecipes.get(tId) || [];

    // 1. Direct or substring match on ID
    let recipe = recipes.find(
      (r) =>
        r.menu_item_id === menuItemId ||
        menuItemId.includes(r.menu_item_id) ||
        r.menu_item_id.includes(menuItemId)
    );
    if (recipe) return recipe;

    // 2. Abbreviation match (e.g. 'item-esp-50', 'item-lat-100', 'item-ame-50')
    const normalizedId = menuItemId.toLowerCase();
    if (normalizedId.includes('esp')) {
      recipe = recipes.find((r) => r.menu_item_id.includes('esp'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('lat')) {
      recipe = recipes.find((r) => r.menu_item_id.includes('lat'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('ame')) {
      recipe = recipes.find((r) => r.menu_item_id.includes('ame'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('cap')) {
      recipe = recipes.find((r) => r.menu_item_id.includes('cap'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('burger')) {
      recipe = recipes.find((r) => r.menu_item_id.includes('burger'));
      if (recipe) return recipe;
    }

    // 3. Match by item title if supplied
    if (itemTitle) {
      const cleanTitle = itemTitle.trim().toLowerCase();
      recipe = recipes.find(
        (r) =>
          (r.menu_item_title && cleanTitle.includes(r.menu_item_title.toLowerCase())) ||
          (r.menu_item_title && r.menu_item_title.toLowerCase().includes(cleanTitle))
      );
      if (recipe) return recipe;

      if (cleanTitle.includes('اسپرسو')) return recipes.find((r) => r.menu_item_id.includes('esp'));
      if (cleanTitle.includes('لاته') || cleanTitle.includes('latte')) return recipes.find((r) => r.menu_item_id.includes('lat'));
      if (cleanTitle.includes('آمریکانو') || cleanTitle.includes('americano')) return recipes.find((r) => r.menu_item_id.includes('ame'));
      if (cleanTitle.includes('کاپوچینو') || cleanTitle.includes('cappuccino')) return recipes.find((r) => r.menu_item_id.includes('cap'));
      if (cleanTitle.includes('کروسان')) return recipes.find((r) => r.menu_item_id.includes('cro'));
      if (cleanTitle.includes('برگر') || cleanTitle.includes('burger')) return recipes.find((r) => r.menu_item_id.includes('burger'));
    }

    return undefined;
  }

  /**
   * Helper: Float rounding with 3 decimal precision
   */
  public roundTo3Decimals(val: number): number {
    return Math.round(val * 1000) / 1000;
  }

  /**
   * Calculate required ingredient consumption for a cart item including modifiers
   */
  public calculateItemConsumption(
    menuItemId: string,
    quantity: number,
    modifiers: Array<{ nameFa?: string; title?: string }> = [],
    itemTitle?: string,
    tenantId?: string
  ): Map<string, number> {
    const consumption = new Map<string, number>();
    const recipe = this.getRecipeForMenuItem(menuItemId, itemTitle, tenantId);
    if (!recipe || !recipe.ingredients) return consumption;

    // Start with base recipe
    for (const base of recipe.ingredients) {
      consumption.set(base.ingredient_id, base.amount * quantity);
    }

    // Apply modifier overrides if present
    if (recipe.modifier_overrides && modifiers.length > 0) {
      for (const mod of modifiers) {
        const modKey = (mod.nameFa || mod.title || '').trim().toLowerCase();
        for (const override of recipe.modifier_overrides) {
          const matchKey = override.modifier_key.trim().toLowerCase();
          if (modKey.includes(matchKey) || matchKey.includes(modKey)) {
            // Check replacement
            if (override.replaces && override.with) {
              consumption.delete(override.replaces);
              const current = consumption.get(override.with.ingredient_id) || 0;
              consumption.set(
                override.with.ingredient_id,
                current + override.with.amount * quantity
              );
            }
            // Check addition
            if (override.adds) {
              const current = consumption.get(override.adds.ingredient_id) || 0;
              consumption.set(
                override.adds.ingredient_id,
                current + override.adds.amount * quantity
              );
            }
          }
        }
      }
    }

    return consumption;
  }

  /**
   * Check stock health for a specific menuItem
   */
  public evaluateMenuItemStock(menuItemId: string, tenantId?: string): MenuItemStockStatus {
    const tId = this.getActiveTenantId(tenantId);
    const recipe = this.getRecipeForMenuItem(menuItemId, undefined, tId);
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      return {
        menuItemId,
        isAvailable: true,
        hasLowStockIngredients: false,
        isOutOfStock: false,
        limitingIngredients: [],
      };
    }

    const limitingAlerts: IngredientStockAlert[] = [];
    let isOutOfStock = false;
    let hasLowStock = false;

    for (const item of recipe.ingredients) {
      const ing = this.getIngredientById(item.ingredient_id, tId);
      if (!ing) continue;

      if (ing.current_stock < item.amount) {
        isOutOfStock = true;
        limitingAlerts.push({
          ingredientId: ing.id,
          titleFa: ing.title_fa,
          titleEn: ing.title_en,
          currentStock: ing.current_stock,
          minSafetyStock: ing.min_safety_stock,
          unit: ing.unit,
          level: 'OUT_OF_STOCK',
        });
      } else if (ing.current_stock <= ing.min_safety_stock) {
        hasLowStock = true;
        limitingAlerts.push({
          ingredientId: ing.id,
          titleFa: ing.title_fa,
          titleEn: ing.title_en,
          currentStock: ing.current_stock,
          minSafetyStock: ing.min_safety_stock,
          unit: ing.unit,
          level: 'LOW_STOCK',
        });
      }
    }

    return {
      menuItemId,
      isAvailable: !isOutOfStock,
      hasLowStockIngredients: hasLowStock,
      isOutOfStock,
      limitingIngredients: limitingAlerts,
    };
  }

  /**
   * Execute real-time automatic deduction of ingredients upon item delivery or order dispatch
   * Strictly scoped to the specified or active tenant context.
   */
  public deductForItems(
    items: TabCartItem[],
    tenantId?: string
  ): { success: boolean; deductions: Array<{ ingredientId: string; amount: number; remaining: number }> } {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);

    const totalDeductions = new Map<string, number>();

    // Aggregate consumption
    for (const item of items) {
      const itemMap = this.calculateItemConsumption(
        item.menuItemId,
        item.quantity,
        item.modifiers || [],
        item.title,
        tId
      );
      itemMap.forEach((amt, ingId) => {
        const curr = totalDeductions.get(ingId) || 0;
        totalDeductions.set(ingId, curr + amt);
      });
    }

    const deductionsSummary: Array<{ ingredientId: string; amount: number; remaining: number }> = [];
    const currentList = this.tenantIngredients.get(tId) || [];

    // Deduct with 3 decimal precision strictly within this tenant's store
    const updatedIngredients = currentList.map((ing) => {
      const needed = totalDeductions.get(ing.id);
      if (needed !== undefined && needed > 0) {
        const newStock = this.roundTo3Decimals(Math.max(0, ing.current_stock - needed));
        deductionsSummary.push({
          ingredientId: ing.id,
          amount: needed,
          remaining: newStock,
        });
        return {
          ...ing,
          current_stock: newStock,
        };
      }
      return ing;
    });

    this.tenantIngredients.set(tId, updatedIngredients);
    this.persistIngredients(tId);
    return { success: true, deductions: deductionsSummary };
  }

  /**
   * Restock or intake raw ingredient inventory with Weighted Average Cost (WAC) recalculation
   * Compliant with CafeOS-Shift-ZReport-InventoryInward (v2.5.0)
   */
  public async recordStockInward(params: {
    raw_item_id: string;
    batch_number: string;
    incoming_quantity: number;
    purchase_cost_per_unit: number;
    supplier_name: string;
    notes?: string;
    operator_name?: string;
    tenantId?: string;
  }): Promise<StockInwardTransaction> {
    const tId = this.getActiveTenantId(params.tenantId);
    const ing = this.getIngredientById(params.raw_item_id, tId);
    if (!ing) throw new Error('ماده اولیه انتخاب‌شده یافت نشد.');

    const previousStock = ing.current_stock;
    const previousCost = ing.cost_per_unit;
    const incomingQty = this.roundTo3Decimals(params.incoming_quantity);
    const purchaseCost = Math.round(params.purchase_cost_per_unit);

    const newStock = this.roundTo3Decimals(previousStock + incomingQty);

    // Recalculate Weighted Average Cost (WAC / میانگین موزون متحرک)
    let weightedAverageCost = purchaseCost;
    if (previousStock > 0 && newStock > 0) {
      const prevVal = previousStock * previousCost;
      const incomingVal = incomingQty * purchaseCost;
      weightedAverageCost = Math.round((prevVal + incomingVal) / (previousStock + incomingQty));
    }

    // Update ingredient stock & cost
    const updatedIng: RawIngredient = {
      ...ing,
      current_stock: newStock,
      cost_per_unit: weightedAverageCost,
      last_restocked_at: new Date().toISOString(),
    };

    this.saveIngredient(updatedIng, tId);

    const transaction: StockInwardTransaction = {
      id: `inward-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      raw_item_id: params.raw_item_id,
      raw_item_name: ing.title_fa,
      batch_number: params.batch_number.trim(),
      incoming_quantity: incomingQty,
      unit: ing.unit,
      previous_stock: previousStock,
      new_stock: newStock,
      purchase_cost_per_unit: purchaseCost,
      previous_cost_per_unit: previousCost,
      weighted_average_cost: weightedAverageCost,
      total_invoice_cost: Math.round(incomingQty * purchaseCost),
      supplier_name: params.supplier_name.trim(),
      notes: params.notes?.trim(),
      timestamp: new Date().toISOString(),
      operator_name: params.operator_name || 'مسئول انبار',
    };

    // Persist transaction in Dexie scoped database
    try {
      const targetDb = getCafeDatabase(tId);
      await targetDb.stockInwardTransactions.put(transaction);
    } catch (err) {
      console.warn('[InventoryBOM] Failed to persist inward transaction in Dexie:', err);
    }

    return transaction;
  }

  /**
   * Retrieves all inward transactions from Dexie for the given tenant
   */
  public async getStockInwardTransactions(limit = 50, tenantId?: string): Promise<StockInwardTransaction[]> {
    const tId = this.getActiveTenantId(tenantId);
    try {
      const targetDb = getCafeDatabase(tId);
      return await targetDb.stockInwardTransactions
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
    } catch {
      const targetDb = getCafeDatabase(tId);
      return targetDb.stockInwardTransactions.toArray();
    }
  }

  /**
   * Restock or intake raw ingredient inventory
   */
  public restockIngredient(
    ingredientId: string,
    quantityToAdd: number,
    costPerUnit?: number,
    tenantId?: string
  ): RawIngredient | null {
    if (quantityToAdd <= 0) return null;
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);

    let target: RawIngredient | null = null;
    const currentList = this.tenantIngredients.get(tId) || [];
    const updated = currentList.map((ing) => {
      if (ing.id === ingredientId) {
        const newStock = this.roundTo3Decimals(ing.current_stock + quantityToAdd);
        target = {
          ...ing,
          current_stock: newStock,
          cost_per_unit: costPerUnit !== undefined && costPerUnit > 0 ? costPerUnit : ing.cost_per_unit,
          last_restocked_at: new Date().toISOString(),
        };
        return target;
      }
      return ing;
    });

    if (target) {
      this.tenantIngredients.set(tId, updated);
      this.persistIngredients(tId);
    }
    return target;
  }

  /**
   * Create or update a raw ingredient for a tenant
   */
  public saveIngredient(ingredient: RawIngredient, tenantId?: string): void {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const currentList = this.tenantIngredients.get(tId) || [];

    const exists = currentList.some((i) => i.id === ingredient.id);
    let updated: RawIngredient[];
    if (exists) {
      updated = currentList.map((i) =>
        i.id === ingredient.id ? { ...ingredient } : i
      );
    } else {
      updated = [
        ...currentList,
        {
          ...ingredient,
          current_stock: this.roundTo3Decimals(ingredient.current_stock),
          last_restocked_at: ingredient.last_restocked_at || new Date().toISOString(),
        },
      ];
    }
    this.tenantIngredients.set(tId, updated);
    this.persistIngredients(tId);
  }

  /**
   * Delete a raw ingredient for a tenant
   */
  public deleteIngredient(id: string, tenantId?: string): void {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const currentList = this.tenantIngredients.get(tId) || [];
    const filtered = currentList.filter((i) => i.id !== id);
    this.tenantIngredients.set(tId, filtered);
    this.persistIngredients(tId);
  }

  /**
   * Save or update a product recipe BOM for a tenant
   */
  public saveRecipe(recipe: ProductRecipeBOM, tenantId?: string): void {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const currentList = [...(this.tenantRecipes.get(tId) || [])];

    const index = currentList.findIndex((r) => r.menu_item_id === recipe.menu_item_id);
    if (index >= 0) {
      currentList[index] = { ...recipe };
    } else {
      currentList.push({ ...recipe });
    }
    this.tenantRecipes.set(tId, currentList);
    this.persistRecipes(tId);
  }

  /**
   * Delete a product recipe BOM for a tenant
   */
  public deleteRecipe(menuItemId: string, tenantId?: string): void {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const currentList = this.tenantRecipes.get(tId) || [];
    const filtered = currentList.filter((r) => r.menu_item_id !== menuItemId);
    this.tenantRecipes.set(tId, filtered);
    this.persistRecipes(tId);
  }

  /**
   * Reset to default initial seeds for a tenant
   */
  public resetToSeeds(tenantId?: string): void {
    const tId = this.getActiveTenantId(tenantId);
    const seedIngs = tId === 'tenant-modendo-01'
      ? [...SEED_INGREDIENTS_MODENDO]
      : tId === 'tenant-100hich-01'
        ? [...SEED_INGREDIENTS_100HICH]
        : [];
    const seedRecs = tId === 'tenant-modendo-01'
      ? [...SEED_RECIPES_MODENDO]
      : tId === 'tenant-100hich-01'
        ? [...SEED_RECIPES_100HICH]
        : [];

    this.tenantIngredients.set(tId, seedIngs);
    this.tenantRecipes.set(tId, seedRecs);
    this.persistIngredients(tId);
    this.persistRecipes(tId);
  }

  /**
   * Idempotently deduct stock for an order.
   * Guarantees that repeated synchronizations or retries of the same order
   * will never deduct inventory more than once for a given tenant.
   */
  public deductForOrder(
    orderId: string,
    items: TabCartItem[],
    tenantId?: string
  ): {
    success: boolean;
    isIdempotentReplay: boolean;
    deductions: Array<{ ingredientId: string; amount: number; remaining: number }>;
  } {
    const tId = this.getActiveTenantId(tenantId);
    let tenantOrders = this.processedOrderDeductions.get(tId);
    if (!tenantOrders) {
      tenantOrders = new Set<string>();
      this.processedOrderDeductions.set(tId, tenantOrders);
    }

    if (tenantOrders.has(orderId)) {
      return {
        success: true,
        isIdempotentReplay: true,
        deductions: [],
      };
    }

    const result = this.deductForItems(items, tId);
    if (result.success) {
      tenantOrders.add(orderId);
    }
    return {
      success: result.success,
      isIdempotentReplay: false,
      deductions: result.deductions,
    };
  }

  /**
   * Record a manual stock adjustment with full audit traceability
   */
  public recordStockAdjustment(params: {
    raw_item_id: string;
    adjustment_quantity: number;
    reason: string;
    operator_name?: string;
    tenantId?: string;
  }): { success: boolean; record?: StockAdjustmentRecord; error?: string } {
    const tId = this.getActiveTenantId(params.tenantId);
    this.loadStateForTenant(tId);

    const ing = this.getIngredientById(params.raw_item_id, tId);
    if (!ing) {
      return { success: false, error: `ماده اولیه با شناسه ${params.raw_item_id} در تننت ${tId} یافت نشد.` };
    }

    const prevStock = ing.current_stock;
    const newStock = this.roundTo3Decimals(Math.max(0, prevStock + params.adjustment_quantity));

    const currentList = this.tenantIngredients.get(tId) || [];
    const updated = currentList.map((item) =>
      item.id === params.raw_item_id
        ? { ...item, current_stock: newStock, last_restocked_at: new Date().toISOString() }
        : item
    );
    this.tenantIngredients.set(tId, updated);
    this.persistIngredients(tId);

    const record: StockAdjustmentRecord = {
      id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: tId,
      raw_item_id: params.raw_item_id,
      adjustment_quantity: params.adjustment_quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      reason: params.reason,
      operator_name: params.operator_name || 'اپراتور انبار',
      timestamp: new Date().toISOString(),
    };

    let adjList = this.stockAdjustments.get(tId);
    if (!adjList) {
      adjList = [];
      this.stockAdjustments.set(tId, adjList);
    }
    adjList.unshift(record);

    return { success: true, record };
  }

  public getStockAdjustmentHistory(tenantId?: string): StockAdjustmentRecord[] {
    const tId = this.getActiveTenantId(tenantId);
    return [...(this.stockAdjustments.get(tId) || [])];
  }

  public clearForTest(): void {
    this.tenantIngredients.clear();
    this.tenantRecipes.clear();
    this.processedOrderDeductions.clear();
    this.stockAdjustments.clear();
    this.loadStateForTenant(this.getActiveTenantId());
  }
}

export const inventoryBomService = new InventoryBomService();
