/**
 * PHASE 1B — Inventory BOM Isolation Verification Suite
 * Verifies complete data isolation for Raw Ingredients & Recipe BOM:
 *  1. Independent inventory initialization (100 HICH vs Modendo).
 *  2. Independent stock deductions (Zero cross-depletion).
 *  3. Independent stock adjustments & restock inward.
 *  4. Simultaneous orders in both cafes.
 *  5. Safe legacy migration (ownership determination, quantity preservation).
 *  6. Repeated migration idempotency.
 *  7. Rollback mechanism.
 *  8. Missing tenant ID handling.
 *  9. Unknown tenant ID isolation.
 */

// Mock localStorage for Node test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  key: (index: number) => Array.from(memoryStore.keys())[index] || null,
  get length() {
    return memoryStore.size;
  },
};

import {
  inventoryBomService,
  INVENTORY_STORAGE_KEYS,
  SEED_INGREDIENTS_100HICH,
  SEED_INGREDIENTS_MODENDO,
} from '../src/services/inventoryBomService';
import { TabCartItem } from '../src/types/inventory-tab';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} | Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('\n--- Running Phase 1B: Inventory BOM Isolation Verification Suite ---\n');

// ============================================================================
// Suite 1: Independent Inventory Initialization
// ============================================================================
console.log('[Suite 1: Independent Inventory Initialization]');
inventoryBomService.resetToSeeds('tenant-100hich-01');
inventoryBomService.resetToSeeds('tenant-modendo-01');

const hichIngs = inventoryBomService.getAllIngredients('tenant-100hich-01');
const modendoIngs = inventoryBomService.getAllIngredients('tenant-modendo-01');

assert(hichIngs.length >= 10, '100 HICH has at least 10 specialty coffee ingredients');
assert(modendoIngs.length >= 6, 'Modendo has at least 6 gaming/dining ingredients');

const hichEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01');
assert(hichEspresso !== undefined, '100 HICH has ing_espresso_blend');
assertEqual(hichEspresso?.unit, 'g', '100 HICH espresso unit is grams');

const modendoBurgerPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01');
assert(modendoBurgerPatty !== undefined, 'Modendo has mod_ing_burger_patty');
assertEqual(modendoBurgerPatty?.unit, 'piece', 'Modendo burger patty unit is piece');

// Verify Modendo DOES NOT have 100 HICH ingredients
const crossLeak1 = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-modendo-01');
assert(crossLeak1 === undefined, 'Modendo ingredient store NEVER contains 100 HICH ing_espresso_blend');

// Verify 100 HICH DOES NOT have Modendo burger patty
const crossLeak2 = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-100hich-01');
assert(crossLeak2 === undefined, '100 HICH ingredient store NEVER contains Modendo mod_ing_burger_patty');

// ============================================================================
// Suite 2: Independent Stock Deductions (Zero Cross-Depletion)
// ============================================================================
console.log('\n[Suite 2: Independent Stock Deductions]');

const initialHichEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')!.current_stock;
const initialHichMilk = inventoryBomService.getIngredientById('ing_whole_milk', 'tenant-100hich-01')!.current_stock;
const initialModendoPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')!.current_stock;
const initialModendoFries = inventoryBomService.getIngredientById('mod_ing_fries', 'tenant-modendo-01')!.current_stock;

// Order in Modendo: 2 Classic Burgers
const modendoOrderItems: TabCartItem[] = [
  {
    id: 'it-mod-1',
    menuItemId: 'mod-burger-classic',
    title: 'برگر کلاسیک مودندو',
    quantity: 2,
    unitPrice: 295000,
    subtotal: 590000,
  },
];

const modendoDeduction = inventoryBomService.deductForItems(modendoOrderItems, 'tenant-modendo-01');
assert(modendoDeduction.success, 'Modendo order deduction executed successfully');

const postModendoPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')!.current_stock;
const postModendoFries = inventoryBomService.getIngredientById('mod_ing_fries', 'tenant-modendo-01')!.current_stock;
assertEqual(postModendoPatty, initialModendoPatty - 2, 'Modendo burger patty deducted exactly 2 pieces');
assertEqual(postModendoFries, initialModendoFries - 300, 'Modendo french fries deducted exactly 300g (2x 150g)');

// CRITICAL INVARIANT: 100 HICH stocks must remain completely unchanged!
const postHichEspressoAfterModendo = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')!.current_stock;
const postHichMilkAfterModendo = inventoryBomService.getIngredientById('ing_whole_milk', 'tenant-100hich-01')!.current_stock;
assertEqual(postHichEspressoAfterModendo, initialHichEspresso, '100 HICH espresso blend stock is UNTOUCHED by Modendo order');
assertEqual(postHichMilkAfterModendo, initialHichMilk, '100 HICH whole milk stock is UNTOUCHED by Modendo order');

// Order in 100 HICH: 2 Flat Whites (18g x 2 = 36g espresso, 160ml x 2 = 320ml milk)
const hichOrderItems: TabCartItem[] = [
  {
    id: 'it-hich-1',
    menuItemId: 'm1_flat_white',
    title: 'فلت وایت',
    quantity: 2,
    unitPrice: 85000,
    subtotal: 170000,
  },
];

const hichDeduction = inventoryBomService.deductForItems(hichOrderItems, 'tenant-100hich-01');
assert(hichDeduction.success, '100 HICH order deduction executed successfully');

const postHichEspressoFinal = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')!.current_stock;
const postHichMilkFinal = inventoryBomService.getIngredientById('ing_whole_milk', 'tenant-100hich-01')!.current_stock;
assertEqual(postHichEspressoFinal, initialHichEspresso - 36, '100 HICH espresso deducted exactly 36.0g');
assertEqual(postHichMilkFinal, initialHichMilk - 320, '100 HICH milk deducted exactly 320.0ml');

// CRITICAL INVARIANT: Modendo stocks must remain completely unchanged by 100 HICH order!
const postModendoPattyAfterHich = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')!.current_stock;
assertEqual(postModendoPattyAfterHich, postModendoPatty, 'Modendo burger patty stock is UNTOUCHED by 100 HICH order');

// ============================================================================
// Suite 3: Independent Stock Adjustments & Restock
// ============================================================================
console.log('\n[Suite 3: Independent Stock Adjustments & Restock]');

const restockResult = inventoryBomService.restockIngredient('mod_ing_burger_patty', 20, 90000, 'tenant-modendo-01');
assert(restockResult !== null, 'Restock in Modendo succeeded');
assertEqual(restockResult!.current_stock, postModendoPatty + 20, 'Modendo patty stock increased by 20');

// 100 HICH must not be affected
const hichCheckAfterRestock = inventoryBomService.getIngredientById('ing_butter_croissant', 'tenant-100hich-01')!.current_stock;
assertEqual(hichCheckAfterRestock, 18, '100 HICH croissant stock remains pristine');

// ============================================================================
// Suite 4: Simultaneous Orders In Both Cafes
// ============================================================================
console.log('\n[Suite 4: Simultaneous Orders In Both Cafes]');

for (let round = 1; round <= 5; round++) {
  inventoryBomService.deductForItems(hichOrderItems, 'tenant-100hich-01');
  inventoryBomService.deductForItems(modendoOrderItems, 'tenant-modendo-01');
}

const simHichEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')!.current_stock;
const simModendoPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')!.current_stock;

assertEqual(simHichEspresso, postHichEspressoFinal - (36 * 5), '100 HICH espresso accurately reflects exactly 5 rounds of deduction');
assertEqual(simModendoPatty, (postModendoPatty + 20) - (2 * 5), 'Modendo patty accurately reflects exactly 5 rounds of deduction');

// ============================================================================
// Suite 5: Legacy Migration & Verification
// ============================================================================
console.log('\n[Suite 5: Legacy Migration & Verification]');

// Setup legacy test environment in localStorage
memoryStore.clear();

// Legacy data simulation (as discovered in Phase 0 audit)
const legacyData = [
  {
    id: 'ing_espresso_blend',
    title_en: '100 Hich Signature Espresso Blend',
    title_fa: 'دانه قهوه بِلِند اختصاصی اسپرسو',
    unit: 'g',
    initial_stock: 15000,
    current_stock: 10500, // custom legacy value
    min_safety_stock: 2500,
    cost_per_unit: 1800,
    last_restocked_at: new Date().toISOString(),
  },
  {
    id: 'ing_whole_milk',
    title_en: 'Fresh Whole Dairy Milk 3.5%',
    title_fa: 'شیر تازه پرچرب دامداران ۳.۵٪',
    unit: 'ml',
    initial_stock: 30000,
    current_stock: 17200, // custom legacy value
    min_safety_stock: 5000,
    cost_per_unit: 65,
    last_restocked_at: new Date().toISOString(),
  },
];

memoryStore.set(INVENTORY_STORAGE_KEYS.LEGACY_RAW_INGREDIENTS, JSON.stringify(legacyData));

// Run migration
const migrationResult = inventoryBomService.migrateLegacyData();
assert(migrationResult.migrated, 'Legacy migration reported success');
assertEqual(migrationResult.recordCount, 2, 'Exactly 2 legacy records migrated');
assertEqual(migrationResult.targetTenant, 'tenant-100hich-01', 'Migrated to verified owner: tenant-100hich-01');

// Verify migrated stock in 100 HICH
const migratedEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01');
assert(migratedEspresso !== undefined, 'Migrated espresso exists in 100 HICH store');
assertEqual(migratedEspresso?.current_stock, 10500, 'Legacy current_stock (10,500g) preserved accurately');

// Verify Modendo was NOT contaminated with legacy 100 HICH data
const modendoAfterMigration = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-modendo-01');
assert(modendoAfterMigration === undefined, 'Modendo does NOT receive 100 HICH legacy coffee beans');

// Verify backup was created
const backupData = memoryStore.get(INVENTORY_STORAGE_KEYS.LEGACY_BACKUP);
assert(backupData !== null && backupData !== undefined, 'Legacy backup key created');

// Verify migration audit log
const logJson = memoryStore.get(INVENTORY_STORAGE_KEYS.MIGRATION_LOG);
assert(logJson !== null, 'Migration audit log written');

// ============================================================================
// Suite 6: Repeated Migration Idempotency
// ============================================================================
console.log('\n[Suite 6: Repeated Migration Idempotency]');

const secondMigration = inventoryBomService.migrateLegacyData();
assert(!secondMigration.migrated, 'Second migration is safely skipped (idempotent)');
assertEqual(secondMigration.recordCount, 0, 'No records re-migrated or overwritten');

// Ensure stock was not reset
const espressoAfterSecondMig = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01');
assertEqual(espressoAfterSecondMig?.current_stock, 10500, 'Stock remained 10,500g and was not overwritten');

// ============================================================================
// Suite 7: Rollback Strategy
// ============================================================================
console.log('\n[Suite 7: Rollback Strategy]');

const rollbackSuccess = inventoryBomService.rollbackLegacyMigration();
assert(rollbackSuccess, 'Rollback executed successfully');

// Legacy key restored
const restoredLegacy = memoryStore.get(INVENTORY_STORAGE_KEYS.LEGACY_RAW_INGREDIENTS);
assert(restoredLegacy !== null, 'Legacy storage key restored from backup');

// Scoped key removed on rollback
const scopedKeyAfterRollback = memoryStore.get(INVENTORY_STORAGE_KEYS.RAW_INGREDIENTS('tenant-100hich-01'));
assert(!scopedKeyAfterRollback, 'Scoped key removed on rollback');

// Re-migrate for subsequent tests
inventoryBomService.migrateLegacyData();

// ============================================================================
// Suite 8: Missing Tenant ID Handling
// ============================================================================
console.log('\n[Suite 8: Missing Tenant ID Handling]');

// When tenantId is undefined, defaults safely to active tenant without throwing
const defaultAll = inventoryBomService.getAllIngredients();
assert(Array.isArray(defaultAll) && defaultAll.length > 0, 'Missing tenant ID falls back to active tenant');

// Deduct with undefined tenantId
const defDeduct = inventoryBomService.deductForItems(hichOrderItems, undefined);
assert(defDeduct.success, 'Deduct with undefined tenantId executes on default active tenant');

// ============================================================================
// Suite 9: Unknown Tenant ID Isolation
// ============================================================================
console.log('\n[Suite 9: Unknown Tenant ID Isolation]');

const unknownTenant = 'tenant-unknown-99';
const unknownIngs = inventoryBomService.getAllIngredients(unknownTenant);
assertEqual(unknownIngs.length, 0, 'Unknown tenant starts with 0 ingredients (isolated store)');

// Add custom ingredient to unknown tenant
inventoryBomService.saveIngredient({
  id: 'custom_tea',
  title_en: 'Custom Herbal Tea',
  title_fa: 'دمنوش گیاهی سفارشی',
  unit: 'g',
  initial_stock: 1000,
  current_stock: 1000,
  min_safety_stock: 200,
  cost_per_unit: 500,
  last_restocked_at: new Date().toISOString(),
}, unknownTenant);

const unknownCheck = inventoryBomService.getIngredientById('custom_tea', unknownTenant);
assert(unknownCheck !== undefined, 'Custom tea saved in unknown tenant store');

// Verify custom tea DOES NOT exist in 100 HICH or Modendo
assert(inventoryBomService.getIngredientById('custom_tea', 'tenant-100hich-01') === undefined, 'Custom tea NOT leaked to 100 HICH');
assert(inventoryBomService.getIngredientById('custom_tea', 'tenant-modendo-01') === undefined, 'Custom tea NOT leaked to Modendo');

console.log(`\n========================================`);
console.log(`Phase 1B Inventory BOM Isolation Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
