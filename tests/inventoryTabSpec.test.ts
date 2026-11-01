/**
 * AntiGravity Inventory & Open Tabs Specification Verification Suite
 * Verifies all requirements of antigravity_inventory_tab_spec.json (v2.1.0)
 */

import { inventoryBomService } from '../src/services/inventoryBomService';
import { openTabService, DEFAULT_TABLES } from '../src/services/openTabService';
import {
  RawIngredient,
  ProductRecipeBOM,
  TabCartItem,
  TableSessionTab,
} from '../src/types/inventory-tab';
import fs from 'fs';
import path from 'path';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failedCount++;
  }
}

function assertEqual<T>(actual: T, expected: T, description: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${description}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${description} | Expected "${expected}", got "${actual}"`);
    failedCount++;
  }
}

console.log('\n--- Running AntiGravity Inventory & Open Tabs Specification Test Suite ---\n');

// =========================================================================
// Suite 1: Spec File Integrity & Schema Compliance
// =========================================================================
console.log('[Suite 1: Spec File Integrity & Schema Compliance]');

const specPath = path.resolve(process.cwd(), 'antigravity_inventory_tab_spec.json');
assert(fs.existsSync(specPath), 'Spec file antigravity_inventory_tab_spec.json exists on disk');

const specContent = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
assertEqual(specContent.project, 'CafeOS-Core-Extension', 'Spec project is CafeOS-Core-Extension');
assertEqual(specContent.version, '2.1.0', 'Spec version is 2.1.0');
assert(Array.isArray(specContent.objectives) && specContent.objectives.length === 3, 'Spec defines 3 key objectives');
assertEqual(specContent.system_architecture.state_machine.inventory_deduction_engine.precision_unit, 'FLOAT_DECIMAL_3', 'Deduction precision is FLOAT_DECIMAL_3');

// =========================================================================
// Suite 2: Raw Ingredients & 3-Decimal Precision (FLOAT_DECIMAL_3)
// =========================================================================
console.log('\n[Suite 2: Raw Ingredients & 3-Decimal Precision (FLOAT_DECIMAL_3)]');

// Reset to seeds for clean test environment
inventoryBomService.resetToSeeds();

const espressoBeans = inventoryBomService.getIngredientById('ing_espresso_blend');
assert(espressoBeans !== undefined, 'Espresso blend seed ingredient exists');
assertEqual(espressoBeans?.unit, 'g', 'Coffee beans unit is grams (g)');
assert(espressoBeans!.current_stock > espressoBeans!.min_safety_stock, 'Initial espresso beans stock exceeds safety stock');

// Test 3-decimal rounding
assertEqual(inventoryBomService.roundTo3Decimals(18.0004), 18, 'Rounds float to 3 decimal places (18.0004 -> 18)');
assertEqual(inventoryBomService.roundTo3Decimals(12.3456), 12.346, 'Rounds float to 3 decimal places (12.3456 -> 12.346)');

// Test restock intake
const prevStock = espressoBeans!.current_stock;
const restocked = inventoryBomService.restockIngredient('ing_espresso_blend', 500, 1900);
assert(restocked !== null, 'Restock operation resolves successfully');
assertEqual(restocked!.current_stock, prevStock + 500, 'Restocked quantity added accurately');
assertEqual(restocked!.cost_per_unit, 1900, 'Cost per unit updated');

// =========================================================================
// Suite 3: BOM Recipe Consumption & Modifier Overrides
// =========================================================================
console.log('\n[Suite 3: BOM Recipe Consumption & Modifier Overrides]');

// Test standard Flat White consumption: 18g espresso blend + 160ml whole milk
const standardConsumption = inventoryBomService.calculateItemConsumption('m1_flat_white', 1, []);
assertEqual(standardConsumption.get('ing_espresso_blend'), 18.0, 'Flat White consumes 18.0g of espresso blend');
assertEqual(standardConsumption.get('ing_whole_milk'), 160.0, 'Flat White consumes 160.0ml of whole milk');

// Test 2x quantity
const doubleConsumption = inventoryBomService.calculateItemConsumption('m1_flat_white', 2, []);
assertEqual(doubleConsumption.get('ing_espresso_blend'), 36.0, '2x Flat White consumes 36.0g of espresso blend');
assertEqual(doubleConsumption.get('ing_whole_milk'), 320.0, '2x Flat White consumes 320.0ml of whole milk');

// Test Modifier Replacement Override: Oat Milk replaces Whole Milk
const oatMilkConsumption = inventoryBomService.calculateItemConsumption('m1_flat_white', 1, [
  { nameFa: 'شیر جو دوسر (Oat Milk)' },
]);
assertEqual(oatMilkConsumption.get('ing_whole_milk'), undefined, 'Whole milk is replaced and removed from consumption');
assertEqual(oatMilkConsumption.get('ing_oat_milk'), 160.0, 'Oat milk is consumed at 160.0ml');
assertEqual(oatMilkConsumption.get('ing_espresso_blend'), 18.0, 'Espresso blend consumption preserved');

// Test Modifier Addition Override: Triple Shot (+0.90) / شات اضافه
const extraShotConsumption = inventoryBomService.calculateItemConsumption('m1_flat_white', 1, [
  { nameFa: 'شات اضافه (Triple Shot)' },
]);
assertEqual(extraShotConsumption.get('ing_espresso_blend'), 27.0, 'Espresso blend increases from 18g to 27g with extra shot');
assertEqual(extraShotConsumption.get('ing_whole_milk'), 160.0, 'Milk remains 160ml');

// Compound Modifier: Oat Milk AND Triple Shot
const compoundConsumption = inventoryBomService.calculateItemConsumption('m1_flat_white', 1, [
  { nameFa: 'شیر جو دوسر' },
  { nameFa: 'شات اضافه' },
]);
assertEqual(compoundConsumption.get('ing_whole_milk'), undefined, 'Whole milk replaced in compound modifier');
assertEqual(compoundConsumption.get('ing_oat_milk'), 160.0, 'Oat milk used in compound modifier');
assertEqual(compoundConsumption.get('ing_espresso_blend'), 27.0, 'Extra espresso blend added in compound modifier');

// =========================================================================
// Suite 4: Low Stock Warnings & Out of Stock Gates
// =========================================================================
console.log('\n[Suite 4: Low Stock Warnings & Out of Stock Gates]');

// Test healthy item evaluation
const flatWhiteHealth = inventoryBomService.evaluateMenuItemStock('m1_flat_white');
assert(flatWhiteHealth.isAvailable, 'Flat White is available with sufficient stock');
assert(!flatWhiteHealth.isOutOfStock, 'Flat White is not out of stock');

// Artificially deplete whole milk to trigger out-of-stock gate
inventoryBomService.saveIngredient({
  id: 'ing_whole_milk',
  title_en: 'Fresh Whole Dairy Milk',
  title_fa: 'شیر تازه',
  unit: 'ml',
  initial_stock: 30000,
  current_stock: 50, // Only 50ml, but Flat White requires 160ml
  min_safety_stock: 5000,
  cost_per_unit: 65,
  last_restocked_at: new Date().toISOString(),
});

const depletedHealth = inventoryBomService.evaluateMenuItemStock('m1_flat_white');
assert(depletedHealth.isOutOfStock, 'Flat White flagged as out of stock due to insufficient milk');
assert(!depletedHealth.isAvailable, 'Item availability gate blocked');
assertEqual(depletedHealth.limitingIngredients[0]?.ingredientId, 'ing_whole_milk', 'Limiting ingredient correctly identifies milk');

// Restore milk to safety warning level: 2000ml (below safety threshold 5000ml, but above required 160ml)
inventoryBomService.saveIngredient({
  id: 'ing_whole_milk',
  title_en: 'Fresh Whole Dairy Milk',
  title_fa: 'شیر تازه',
  unit: 'ml',
  initial_stock: 30000,
  current_stock: 2000,
  min_safety_stock: 5000,
  cost_per_unit: 65,
  last_restocked_at: new Date().toISOString(),
});

const warningHealth = inventoryBomService.evaluateMenuItemStock('m1_flat_white');
assert(warningHealth.isAvailable, 'Item remains available when above single recipe requirement');
assert(warningHealth.hasLowStockIngredients, 'Low stock warning triggered when current <= safety stock');
assertEqual(warningHealth.limitingIngredients[0]?.level, 'LOW_STOCK', 'Stock level classified as LOW_STOCK');

// =========================================================================
// Suite 5: Table Order Lifecycle State Machine
// =========================================================================
console.log('\n[Suite 5: Table Order Lifecycle State Machine]');

// Reset table for test
openTabService.voidTab('test-tab-t3');

// 1. Initial State: idle_empty
const initialLifeState = openTabService.getTableLifecycleState('t3');
assertEqual(initialLifeState, 'idle_empty', 'Table 3 initial state is idle_empty');

// 2. Transition: idle_empty -> (OPEN_TAB) -> active_open_tab
const openedTab = openTabService.openTab('t3', 'میز ۳', 'سارا رضایی', 3, [
  {
    id: 'it-1',
    menuItemId: 'm-esp-double',
    title: 'اسپرسو دبل',
    quantity: 2,
    unitPrice: 55000,
    subtotal: 110000,
  },
]);
assert(openedTab.tab_id.length > 0, 'Tab created with unique ID');
assertEqual(openedTab.status, 'open', 'Tab status is open');
assertEqual(openedTab.rounds.length, 1, 'Initial Round 1 created');
assertEqual(openedTab.total_due, 110000, 'Initial total due matches items subtotal');
assertEqual(openTabService.getTableLifecycleState('t3'), 'active_open_tab', 'Table state advanced to active_open_tab');

// 3. Transition: active_open_tab -> (ADD_ROUND) -> active_open_tab
const updatedTab = openTabService.addRoundToTab(openedTab.tab_id, [
  {
    id: 'it-2',
    menuItemId: 'm-croissant',
    title: 'کروسان فرانسوی',
    quantity: 1,
    unitPrice: 75000,
    subtotal: 75000,
  },
]);
assert(updatedTab !== null, 'Round 2 appended successfully');
assertEqual(updatedTab!.rounds.length, 2, 'Tab now contains 2 dispatched rounds');
assertEqual(updatedTab!.subtotal, 185000, 'Subtotal reflects sum of both rounds (110k + 75k = 185k)');
assertEqual(updatedTab!.total_due, 185000, 'Total due updated dynamically');
assertEqual(openTabService.getTableLifecycleState('t3'), 'active_open_tab', 'Table state remains active_open_tab after round addition');

// 4. Transition: active_open_tab -> (MARK_DELIVERED) -> active_open_tab
const deliveredTab = openTabService.markRoundDelivered(openedTab.tab_id, 2);
assert(deliveredTab !== null, 'Round marked delivered');
assertEqual(deliveredTab!.rounds[1].status, 'delivered', 'Round 2 status is delivered');
assert(deliveredTab!.rounds[1].inventory_deducted, 'BOM inventory deduction marked complete');

// 5. Transition: active_open_tab -> (REQUEST_BILL) -> awaiting_checkout
const billedTab = openTabService.requestBill(openedTab.tab_id);
assert(billedTab !== null, 'Bill requested');
assertEqual(billedTab!.status, 'printed', 'Tab status is printed');
assertEqual(openTabService.getTableLifecycleState('t3'), 'awaiting_checkout', 'Table state transitioned to awaiting_checkout');

// 6. Transition: awaiting_checkout -> (COMPLETE_SETTLEMENT) -> idle_empty
const settlementResult = openTabService.settleTab(openedTab.tab_id, {
  paymentMethod: 'CARD',
  terminalName: 'پوز ۱ (بانک سامان)',
  referenceCode: '998877',
});
assert(settlementResult.success, 'Settlement completed');
assertEqual(settlementResult.closedTab.status, 'settled', 'Closed tab status is settled');
assertEqual(openTabService.getTableLifecycleState('t3'), 'idle_empty', 'Table 3 immediately freed and reset to idle_empty');

// =========================================================================
// Suite 6: Split Check Financial Invariants
// =========================================================================
console.log('\n[Suite 6: Split Check Financial Invariants]');

const tabTotal = 185000;
const splitGuestCount = 3;
const perPersonSplit = Math.ceil(tabTotal / splitGuestCount);
assertEqual(perPersonSplit, 61667, 'Split per person rounded to integer ceiling Toman');
assert(perPersonSplit * splitGuestCount >= tabTotal, 'Sum of split parts guarantees 100% bill coverage without deficit');

// Test 2-person split
const evenSplit = Math.ceil(tabTotal / 2);
assertEqual(evenSplit, 92500, '2-person even split is exactly 92,500 Toman');
assertEqual(evenSplit * 2, tabTotal, '2-person split perfectly equals total');

// =========================================================================
// Suite 7: Design System & Theme Alignment
// =========================================================================
console.log('\n[Suite 7: Design System & Theme Alignment]');

const theme = specContent.ui_ux_implementation_requirements.theme_alignment;
assertEqual(theme.base_bg, '#0D1015', 'Theme base background is #0D1015');
assertEqual(theme.surface_elevated, '#151B25', 'Theme surface elevated is #151B25');
assertEqual(theme.accent_color, '#D71921', 'Theme accent color is signature KarWand Crimson #D71921');
assertEqual(theme.status_colors.occupied_eating, '#10B981', 'Occupied eating status color is #10B981 (Emerald)');
assertEqual(theme.status_colors.awaiting_bill, '#F59E0B', 'Awaiting bill status color is #F59E0B (Amber)');
assertEqual(theme.status_colors.low_stock_warning, '#EF4444', 'Low stock warning color is #EF4444 (Red/Rose)');
assertEqual(theme.status_colors.reserved, '#3B82F6', 'Reserved table status color is #3B82F6 (Blue)');

// Cleanup test tab
openTabService.voidTab(openedTab.tab_id);

console.log(`\n========================================`);
console.log(`Test Execution Summary: ${passedCount} Passed, ${failedCount} Failed`);
console.log(`========================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
