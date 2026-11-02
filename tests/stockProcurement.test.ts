/**
 * CODA Phase P3 — Stock & Procurement Verification Suite
 * Agent: A10-STOCK & A05-SENTINEL
 *
 * Requirements Tested:
 * 1. Strict multi-tenant isolation for ingredients, recipes (BOM), and stock movements.
 * 2. Independent inventory consumption for 100 HICH and Modendo.
 * 3. Correct BOM deduction during order completion.
 * 4. Idempotent stock consumption (deductForOrder) preventing duplicate deductions on sync retry.
 * 5. Stock adjustment ledger and traceability (recordStockAdjustment, getStockAdjustmentHistory).
 * 6. Prevention of negative stock underflow (floor at 0).
 * 7. Regression Invariants:
 *    - Modendo order never consumes 100 HICH ingredients.
 *    - 100 HICH order never consumes Modendo ingredients.
 *    - Retail beans and gaming items do not consume kitchen/bar raw materials.
 *    - Repeated order synchronizations deduct inventory exactly once.
 */

// Mock localStorage for Node test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

import {
  inventoryBomService,
  SEED_INGREDIENTS_100HICH,
  SEED_INGREDIENTS_MODENDO,
} from '../src/services/inventoryBomService';
import { TabCartItem } from '../src/types/inventory-tab';
import { StationRouter } from '../src/services/StationRouter';

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
  assert(
    actual === expected,
    testName,
    `Expected "${expected}", but received "${actual}"`
  );
}

async function runSuite() {
  console.log('\n--- Running CODA P3 Stock & Procurement Verification Suite ---');

  // ============================================================================
  // Suite 1: Independent Inventory Foundations & Partitioning
  // ============================================================================
  console.log('\n[Suite 1: Independent Inventory Foundations & Partitioning]');
  inventoryBomService.clearForTest();

  const hichIngredients = inventoryBomService.getAllIngredients('tenant-100hich-01');
  const modendoIngredients = inventoryBomService.getAllIngredients('tenant-modendo-01');

  assert(hichIngredients.length >= 10, '100 HICH initialized with specialty coffee ingredients (>= 10)');
  assert(modendoIngredients.length >= 6, 'Modendo initialized with gaming cafe ingredients (>= 6)');

  // Cross-tenant item absence
  const modHasHichBlend = modendoIngredients.some((i) => i.id === 'ing_espresso_blend');
  const hichHasModPatty = hichIngredients.some((i) => i.id === 'mod_ing_burger_patty');

  assertEqual(modHasHichBlend, false, 'Modendo store NEVER contains 100 HICH espresso blend');
  assertEqual(hichHasModPatty, false, '100 HICH store NEVER contains Modendo burger patty');

  // ============================================================================
  // Suite 2: Independent BOM Deduction (100 HICH vs Modendo)
  // ============================================================================
  console.log('\n[Suite 2: Independent BOM Deduction]');

  const initialHichEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock || 0;
  const initialHichMilk = inventoryBomService.getIngredientById('ing_whole_milk', 'tenant-100hich-01')?.current_stock || 0;
  const initialModPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')?.current_stock || 0;
  const initialModFries = inventoryBomService.getIngredientById('mod_ing_fries', 'tenant-modendo-01')?.current_stock || 0;

  // 1. Order in Modendo: 2 Classic Burgers
  // BOM per burger: 1 patty, 1 bun, 150g fries
  const modendoItems: TabCartItem[] = [
    {
      id: 'cart-mod-1',
      menuItemId: 'item-mod-burger-classic',
      title: 'برگر کلاسیک مودندو',
      price: 185000,
      quantity: 2,
      station: 'KITCHEN',
    },
  ];

  const modDeduction = inventoryBomService.deductForItems(modendoItems, 'tenant-modendo-01');
  assertEqual(modDeduction.success, true, 'Modendo BOM deduction succeeded');

  const afterModPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')?.current_stock || 0;
  const afterModFries = inventoryBomService.getIngredientById('mod_ing_fries', 'tenant-modendo-01')?.current_stock || 0;

  assertEqual(afterModPatty, initialModPatty - 2, 'Modendo burger patty deducted exactly 2 pieces');
  assertEqual(afterModFries, initialModFries - 300, 'Modendo fries deducted exactly 300g (2 x 150g)');

  // Verify 100 HICH ingredients remained 100% untouched
  const currentHichEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock;
  const currentHichMilk = inventoryBomService.getIngredientById('ing_whole_milk', 'tenant-100hich-01')?.current_stock;

  assertEqual(currentHichEspresso, initialHichEspresso, 'INVARIANT: 100 HICH espresso is UNTOUCHED by Modendo order');
  assertEqual(currentHichMilk, initialHichMilk, 'INVARIANT: 100 HICH milk is UNTOUCHED by Modendo order');

  // 2. Order in 100 HICH: 2 Flat Whites
  // BOM per flat white: 18g espresso blend, 160ml milk
  const hichItems: TabCartItem[] = [
    {
      id: 'cart-hich-1',
      menuItemId: 'm1_flat_white',
      title: 'فلت وایت',
      price: 65000,
      quantity: 2,
      station: 'BAR',
    },
  ];

  const hichDeduction = inventoryBomService.deductForItems(hichItems, 'tenant-100hich-01');
  assertEqual(hichDeduction.success, true, '100 HICH BOM deduction succeeded');

  const afterHichEspresso = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock || 0;
  const afterHichMilk = inventoryBomService.getIngredientById('ing_whole_milk', 'tenant-100hich-01')?.current_stock || 0;

  assertEqual(afterHichEspresso, initialHichEspresso - 36, '100 HICH espresso deducted exactly 36g (2 x 18g)');
  assertEqual(afterHichMilk, initialHichMilk - 320, '100 HICH milk deducted exactly 320ml (2 x 160ml)');

  // Verify Modendo ingredients remained untouched by 100 HICH order
  const checkModPatty = inventoryBomService.getIngredientById('mod_ing_burger_patty', 'tenant-modendo-01')?.current_stock;
  assertEqual(checkModPatty, afterModPatty, 'INVARIANT: Modendo patty is UNTOUCHED by 100 HICH order');

  // ============================================================================
  // Suite 3: Idempotent Stock Consumption (deductForOrder)
  // ============================================================================
  console.log('\n[Suite 3: Idempotent Stock Consumption (deductForOrder)]');

  const orderId = 'ord-sync-idempotent-999';
  const orderItems: TabCartItem[] = [
    {
      id: 'item-deduct-1',
      menuItemId: 'm1_flat_white',
      title: 'فلت وایت',
      price: 65000,
      quantity: 1,
      station: 'BAR',
    },
  ];

  const stockBeforeFirst = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock || 0;

  // First sync attempt: Must deduct
  const firstDeduct = inventoryBomService.deductForOrder(orderId, orderItems, 'tenant-100hich-01');
  assertEqual(firstDeduct.success, true, 'First deductForOrder call succeeded');
  assertEqual(firstDeduct.isIdempotentReplay, false, 'isIdempotentReplay is false on initial order deduction');
  assert(firstDeduct.deductions.length > 0, 'Deductions recorded on first call');

  const stockAfterFirst = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock || 0;
  assertEqual(stockAfterFirst, stockBeforeFirst - 18, 'Stock depleted by 18g on first call');

  // Second sync attempt (Replay with same order ID)
  const replayDeduct = inventoryBomService.deductForOrder(orderId, orderItems, 'tenant-100hich-01');
  assertEqual(replayDeduct.success, true, 'Replay deductForOrder returns success');
  assertEqual(replayDeduct.isIdempotentReplay, true, 'CRITICAL INVARIANT: Replay detected (isIdempotentReplay: true)');
  assertEqual(replayDeduct.deductions.length, 0, 'Zero deductions applied on replay');

  const stockAfterReplay = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock || 0;
  assertEqual(stockAfterReplay, stockAfterFirst, 'Stock level remains strictly identical after repeated sync attempt');

  // Third sync attempt in Modendo with same order ID: Must NOT block Modendo!
  const modendoReplay = inventoryBomService.deductForOrder(orderId, modendoItems, 'tenant-modendo-01');
  assertEqual(modendoReplay.isIdempotentReplay, false, 'Tenant isolation: Same orderId in Modendo is NOT blocked by 100 HICH deduction');

  // ============================================================================
  // Suite 4: NO_PREP Exclusion & Zero Ingredient Consumption
  // ============================================================================
  console.log('\n[Suite 4: NO_PREP Exclusion & Zero Ingredient Consumption]');

  // Pure retail / gaming merchandise items
  const retailBeansItem: TabCartItem = {
    id: 'cart-beans-1',
    menuItemId: 'm_retail_ethiopia_250g',
    title: 'بسته ۲۵۰ گرمی دانه قهوه اتیوپی یرگاچف',
    price: 450000,
    quantity: 3,
    station: 'NO_PREP',
  };

  const gamingPassItem: TabCartItem = {
    id: 'cart-game-1',
    menuItemId: 'm_ps5_gaming_pass_1hr',
    title: 'ووچر ۱ ساعت بازی پلی‌استیشن ۵',
    price: 120000,
    quantity: 2,
    station: 'NO_PREP',
  };

  // StationRouter confirms they are NO_PREP
  const beansStation = StationRouter.resolveStation({
    title: retailBeansItem.title,
    categoryId: 'cat-retail-beans',
    categoryName: 'دانه‌های بسته‌بندی برشته‌کاری',
  });
  const gamingStation = StationRouter.resolveStation({
    title: gamingPassItem.title,
    categoryId: 'cat-mod-gaming',
    categoryName: 'گیمینگ و کنسول',
  });

  assertEqual(beansStation, 'NO_PREP', 'StationRouter routes retail beans to NO_PREP');
  assertEqual(gamingStation, 'NO_PREP', 'StationRouter routes gaming pass to NO_PREP');

  // Consumption check: NO_PREP items without BOM have 0 consumption
  const beansConsumption = inventoryBomService.calculateItemConsumption(
    retailBeansItem.menuItemId,
    retailBeansItem.quantity,
    [],
    retailBeansItem.title,
    'tenant-100hich-01'
  );
  assertEqual(beansConsumption.size, 0, 'Retail beans item has size 0 ingredient consumption');

  const gamingConsumption = inventoryBomService.calculateItemConsumption(
    gamingPassItem.menuItemId,
    gamingPassItem.quantity,
    [],
    gamingPassItem.title,
    'tenant-modendo-01'
  );
  assertEqual(gamingConsumption.size, 0, 'Gaming pass item has size 0 ingredient consumption');

  // ============================================================================
  // Suite 5: Stock Adjustment Ledger & Audit Traceability
  // ============================================================================
  console.log('\n[Suite 5: Stock Adjustment Ledger & Audit Traceability]');

  const stockBeforeAdj = inventoryBomService.getIngredientById('ing_espresso_blend', 'tenant-100hich-01')?.current_stock || 0;

  // Add 500g adjustment (Positive)
  const adjResult1 = inventoryBomService.recordStockAdjustment({
    raw_item_id: 'ing_espresso_blend',
    adjustment_quantity: 500,
    reason: 'شارژ اضطراری رست‌باکس',
    operator_name: 'امیر کارشناس انبار',
    tenantId: 'tenant-100hich-01',
  });

  assertEqual(adjResult1.success, true, 'Positive stock adjustment succeeded');
  assertEqual(adjResult1.record?.previous_stock, stockBeforeAdj, 'Previous stock accurately captured');
  assertEqual(adjResult1.record?.new_stock, stockBeforeAdj + 500, 'New stock accurately computed');
  assertEqual(adjResult1.record?.tenantId, 'tenant-100hich-01', 'Adjustment tenantId is tenant-100hich-01');

  // Deduct 150g adjustment (Negative / Spoilage)
  const adjResult2 = inventoryBomService.recordStockAdjustment({
    raw_item_id: 'ing_espresso_blend',
    adjustment_quantity: -150,
    reason: 'کالیبراسیون آسیاب صبحگاهی و دورریز',
    operator_name: 'امیر باریستا',
    tenantId: 'tenant-100hich-01',
  });

  assertEqual(adjResult2.success, true, 'Negative stock adjustment succeeded');
  assertEqual(adjResult2.record?.new_stock, stockBeforeAdj + 350, 'Net stock adjusted down by 150g');

  // Traceability history check
  const hichHistory = inventoryBomService.getStockAdjustmentHistory('tenant-100hich-01');
  assertEqual(hichHistory.length, 2, 'Exactly 2 adjustment records tracked for 100 HICH');
  assertEqual(hichHistory[0].reason, 'کالیبراسیون آسیاب صبحگاهی و دورریز', 'Most recent adjustment is first');

  // Modendo history remains empty (Tenant isolation of adjustment ledger)
  const modendoHistory = inventoryBomService.getStockAdjustmentHistory('tenant-modendo-01');
  assertEqual(modendoHistory.length, 0, 'Modendo adjustment history is isolated (0 records)');

  // ============================================================================
  // Suite 6: Underflow Floor Protection (Stock never negative)
  // ============================================================================
  console.log('\n[Suite 6: Underflow Floor Protection]');

  const currentCroissant = inventoryBomService.getIngredientById('ing_butter_croissant', 'tenant-100hich-01')?.current_stock || 0;

  // Attempt to deduct massive amount beyond available stock (-999,999)
  const underflowAdj = inventoryBomService.recordStockAdjustment({
    raw_item_id: 'ing_butter_croissant',
    adjustment_quantity: -999999,
    reason: 'آزمون خطای منفی شدن موجودی',
    tenantId: 'tenant-100hich-01',
  });

  assertEqual(underflowAdj.success, true, 'Underflow adjustment handled gracefully');
  assertEqual(underflowAdj.record?.new_stock, 0, 'CRITICAL: Stock floored at 0 (never negative)');

  console.log(`\n========================================`);
  console.log(`Stock & Procurement Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
