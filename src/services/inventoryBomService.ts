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
import { db } from '../db/cafeDb';

const STORAGE_KEYS = {
  RAW_INGREDIENTS: 'cafeos_raw_ingredients_v2',
  RECIPES: 'cafeos_product_recipes_v2',
};

// Default seed ingredients for 100 Hich Specialty Coffee Roasters
const SEED_INGREDIENTS: RawIngredient[] = [
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

// Initial Recipes linked to typical menu items
const SEED_RECIPES: ProductRecipeBOM[] = [
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

type InventoryChangeListener = (ingredients: RawIngredient[], recipes: ProductRecipeBOM[]) => void;

class InventoryBomService {
  private ingredients: RawIngredient[] = [];
  private recipes: ProductRecipeBOM[] = [];
  private listeners: Set<InventoryChangeListener> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const storedIngs = localStorage.getItem(STORAGE_KEYS.RAW_INGREDIENTS);
        if (storedIngs) {
          this.ingredients = JSON.parse(storedIngs);
        } else {
          this.ingredients = [...SEED_INGREDIENTS];
          this.persistIngredients();
        }

        const storedRecipes = localStorage.getItem(STORAGE_KEYS.RECIPES);
        if (storedRecipes) {
          this.recipes = JSON.parse(storedRecipes);
        } else {
          this.recipes = [...SEED_RECIPES];
          this.persistRecipes();
        }
      } else {
        this.ingredients = [...SEED_INGREDIENTS];
        this.recipes = [...SEED_RECIPES];
      }
    } catch (e) {
      this.ingredients = [...SEED_INGREDIENTS];
      this.recipes = [...SEED_RECIPES];
    }
  }

  private persistIngredients() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(STORAGE_KEYS.RAW_INGREDIENTS, JSON.stringify(this.ingredients));
      }
      this.notifyListeners();
      this.syncToDexieDb();
    } catch (e) {
      console.error('Failed to persist raw ingredients', e);
    }
  }

  private persistRecipes() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(this.recipes));
      }
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to persist recipes', e);
    }
  }

  private async syncToDexieDb() {
    try {
      if (db && db.inventoryItems) {
        for (const ing of this.ingredients) {
          const existing = await db.inventoryItems.get(ing.id);
          if (existing) {
            await db.inventoryItems.update(ing.id, {
              currentStock: ing.current_stock,
              updatedAt: Date.now(),
            });
          } else {
            await db.inventoryItems.put({
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
    } catch (e) {
      // Non-blocking sync
    }
  }

  public subscribe(listener: InventoryChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.ingredients, this.recipes);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.ingredients, this.recipes);
      } catch (e) {
        console.error('Error notifying inventory listener', e);
      }
    });
  }

  public getAllIngredients(): RawIngredient[] {
    return [...this.ingredients];
  }

  public getIngredientById(id: string): RawIngredient | undefined {
    return this.ingredients.find((i) => i.id === id);
  }

  public getAllRecipes(): ProductRecipeBOM[] {
    return [...this.recipes];
  }

  public getRecipeForMenuItem(menuItemId: string, itemTitle?: string): ProductRecipeBOM | undefined {
    // 1. Direct or substring match on ID
    let recipe = this.recipes.find(
      (r) =>
        r.menu_item_id === menuItemId ||
        menuItemId.includes(r.menu_item_id) ||
        r.menu_item_id.includes(menuItemId)
    );
    if (recipe) return recipe;

    // 2. Abbreviation match (e.g. 'item-esp-50', 'item-lat-100', 'item-ame-50')
    const normalizedId = menuItemId.toLowerCase();
    if (normalizedId.includes('esp')) {
      recipe = this.recipes.find((r) => r.menu_item_id.includes('esp'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('lat')) {
      recipe = this.recipes.find((r) => r.menu_item_id.includes('lat'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('ame')) {
      recipe = this.recipes.find((r) => r.menu_item_id.includes('ame'));
      if (recipe) return recipe;
    }
    if (normalizedId.includes('cap')) {
      recipe = this.recipes.find((r) => r.menu_item_id.includes('cap'));
      if (recipe) return recipe;
    }

    // 3. Match by item title if supplied
    if (itemTitle) {
      const cleanTitle = itemTitle.trim().toLowerCase();
      recipe = this.recipes.find(
        (r) =>
          (r.menu_item_title && cleanTitle.includes(r.menu_item_title.toLowerCase())) ||
          (r.menu_item_title && r.menu_item_title.toLowerCase().includes(cleanTitle))
      );
      if (recipe) return recipe;

      if (cleanTitle.includes('اسپرسو')) return this.recipes.find((r) => r.menu_item_id.includes('esp'));
      if (cleanTitle.includes('لاته') || cleanTitle.includes('latte')) return this.recipes.find((r) => r.menu_item_id.includes('lat'));
      if (cleanTitle.includes('آمریکانو') || cleanTitle.includes('americano')) return this.recipes.find((r) => r.menu_item_id.includes('ame'));
      if (cleanTitle.includes('کاپوچینو') || cleanTitle.includes('cappuccino')) return this.recipes.find((r) => r.menu_item_id.includes('cap'));
      if (cleanTitle.includes('کروسان')) return this.recipes.find((r) => r.menu_item_id.includes('cro'));
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
    itemTitle?: string
  ): Map<string, number> {
    const consumption = new Map<string, number>();
    const recipe = this.getRecipeForMenuItem(menuItemId, itemTitle);
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
  public evaluateMenuItemStock(menuItemId: string): MenuItemStockStatus {
    const recipe = this.getRecipeForMenuItem(menuItemId);
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
      const ing = this.getIngredientById(item.ingredient_id);
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
   */
  public deductForItems(
    items: TabCartItem[]
  ): { success: boolean; deductions: Array<{ ingredientId: string; amount: number; remaining: number }> } {
    const totalDeductions = new Map<string, number>();

    // Aggregate consumption
    for (const item of items) {
      const itemMap = this.calculateItemConsumption(
        item.menuItemId,
        item.quantity,
        item.modifiers || []
      );
      itemMap.forEach((amt, ingId) => {
        const curr = totalDeductions.get(ingId) || 0;
        totalDeductions.set(ingId, curr + amt);
      });
    }

    const deductionsSummary: Array<{ ingredientId: string; amount: number; remaining: number }> = [];

    // Deduct with 3 decimal precision
    this.ingredients = this.ingredients.map((ing) => {
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

    this.persistIngredients();
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
  }): Promise<StockInwardTransaction> {
    const ing = this.getIngredientById(params.raw_item_id);
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

    this.saveIngredient(updatedIng);

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

    // Persist transaction in Dexie
    try {
      await db.stockInwardTransactions.put(transaction);
    } catch (err) {
      console.warn('[InventoryBOM] Failed to persist inward transaction in Dexie:', err);
    }

    return transaction;
  }

  /**
   * Retrieves all inward transactions from Dexie
   */
  public async getStockInwardTransactions(limit = 50): Promise<StockInwardTransaction[]> {
    try {
      return await db.stockInwardTransactions
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
    } catch {
      return db.stockInwardTransactions.toArray();
    }
  }

  /**
   * Restock or intake raw ingredient inventory
   */
  public restockIngredient(
    ingredientId: string,
    quantityToAdd: number,
    costPerUnit?: number
  ): RawIngredient | null {
    if (quantityToAdd <= 0) return null;

    let target: RawIngredient | null = null;
    this.ingredients = this.ingredients.map((ing) => {
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
      this.persistIngredients();
    }
    return target;
  }

  /**
   * Create or update a raw ingredient
   */
  public saveIngredient(ingredient: RawIngredient): void {
    const exists = this.ingredients.some((i) => i.id === ingredient.id);
    if (exists) {
      this.ingredients = this.ingredients.map((i) =>
        i.id === ingredient.id ? { ...ingredient } : i
      );
    } else {
      this.ingredients = [
        ...this.ingredients,
        {
          ...ingredient,
          current_stock: this.roundTo3Decimals(ingredient.current_stock),
          last_restocked_at: ingredient.last_restocked_at || new Date().toISOString(),
        },
      ];
    }
    this.persistIngredients();
  }

  /**
   * Delete a raw ingredient
   */
  public deleteIngredient(id: string): void {
    this.ingredients = this.ingredients.filter((i) => i.id !== id);
    this.persistIngredients();
  }

  /**
   * Save or update a product recipe BOM
   */
  public saveRecipe(recipe: ProductRecipeBOM): void {
    const index = this.recipes.findIndex((r) => r.menu_item_id === recipe.menu_item_id);
    if (index >= 0) {
      this.recipes[index] = { ...recipe };
    } else {
      this.recipes.push({ ...recipe });
    }
    this.persistRecipes();
  }

  /**
   * Delete a product recipe BOM
   */
  public deleteRecipe(menuItemId: string): void {
    this.recipes = this.recipes.filter((r) => r.menu_item_id !== menuItemId);
    this.persistRecipes();
  }

  /**
   * Reset to default initial seeds
   */
  public resetToSeeds(): void {
    this.ingredients = [...SEED_INGREDIENTS];
    this.recipes = [...SEED_RECIPES];
    this.persistIngredients();
    this.persistRecipes();
  }
}

export const inventoryBomService = new InventoryBomService();
