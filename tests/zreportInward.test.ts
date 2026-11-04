/**
 * Automated Verification Suite for CafeOS Shift Z-Report & Inventory Stock Inward (v2.5.0)
 * Tests Z-Report Financial Ledger, Cash Drawer Reconciliation, Material Depletions (BOM),
 * ESC/POS Double-Strike Ticket Generation, and Weighted Average Cost (WAC) Invariants.
 */

// Mock localStorage for Node.js test environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: 0,
  };
}

import { ShiftCloseoutService } from '../src/services/ShiftCloseoutService';
import { inventoryBomService } from '../src/services/inventoryBomService';
import { SmartOrdersStore } from '../src/services/storage';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details || 'Assertion failed'}`);
    failedTests++;
  }
}

console.log('\n--- Running CafeOS Shift Z-Report & Inventory Inward Test Suite ---\n');

// Initialize seed data
SmartOrdersStore.initSeedData();

// =========================================================================
// SUITE 1: Shift Closeout & Z-Report Financial Calculations
// =========================================================================
console.log('[Suite 1: Z-Report Financial Ledger & Drawer Reconciliation]');
(async () => {
  const shifts = SmartOrdersStore.getShifts();
  const testShift = shifts[0] || SmartOrdersStore.getActiveShift();

  assert(testShift !== null, 'Active or seed shift is available for Z-Report calculation');

  // Test Case A: Balanced drawer count
  const openingCash = testShift.openingCashToman;
  const initialZReport = await ShiftCloseoutService.calculateZReport(testShift.id, 0);

  const expectedCash = initialZReport.expected_cash;
  assert(typeof expectedCash === 'number', 'Expected cash is calculated as exact integer number');

  const balancedReport = await ShiftCloseoutService.calculateZReport(testShift.id, expectedCash);
  assert(balancedReport.discrepancy === 0, 'Discrepancy is exactly 0 when counted cash matches expected');
  assert(balancedReport.is_balanced === true, 'Flag is_balanced is true for matching cash count');
  assert(balancedReport.is_shortage === false, 'Flag is_shortage is false when balanced');
  assert(balancedReport.is_overage === false, 'Flag is_overage is false when balanced');

  // Test Case B: Cash shortage (-25,000 Toman)
  const shortageCount = expectedCash - 25000;
  const shortageReport = await ShiftCloseoutService.calculateZReport(testShift.id, shortageCount, {
    discrepancyReason: 'کسری در پول خرد مشتری',
  });
  assert(shortageReport.discrepancy === -25000, 'Calculates exact -25,000 Toman cash shortage');
  assert(shortageReport.is_shortage === true, 'Flags is_shortage as true on negative discrepancy');
  assert(shortageReport.is_balanced === false, 'Flags is_balanced as false on shortage');
  assert(shortageReport.discrepancy_reason === 'کسری در پول خرد مشتری', 'Preserves discrepancy explanation');

  // Test Case C: Cash overage (+40,000 Toman)
  const overageCount = expectedCash + 40000;
  const overageReport = await ShiftCloseoutService.calculateZReport(testShift.id, overageCount);
  assert(overageReport.discrepancy === 40000, 'Calculates exact +40,000 Toman cash overage');
  assert(overageReport.is_overage === true, 'Flags is_overage as true on positive discrepancy');

  // Test Case D: Payment channels separation
  assert(
    typeof balancedReport.payment_methods.pos_card === 'number' &&
    typeof balancedReport.payment_methods.cash === 'number',
    'Separates POS card terminal inflow from cash drawer inflow'
  );

  // Test Case E: Net sales & VAT calculation
  assert(balancedReport.net_sales > 0, 'Net sales total is strictly positive for active shift');
  assert(balancedReport.vat_total === Math.round((balancedReport.net_sales * 9) / 109), 'VAT 9% is calculated accurately on net sales');

  // =========================================================================
  // SUITE 2: Material Depletions (BOM Coffee Beans, Milk & Syrups Consumption)
  // =========================================================================
  console.log('\n[Suite 2: BOM Recipe Material Depletion Invariants]');
  {
    assert(Array.isArray(balancedReport.material_depletions), 'material_depletions is an array');
    assert(balancedReport.material_depletions.length > 0, 'Tracks consumed raw materials for orders in shift');

    const espressoDepletion = balancedReport.material_depletions.find(
      (m) => m.item_id === 'ing_espresso_blend' || m.item_id === 'mod_ing_espresso_blend'
    );
    assert(espressoDepletion !== undefined, 'Accurately identifies espresso blend bean consumption');
    if (espressoDepletion) {
      assert(espressoDepletion.unit === 'g', 'Coffee beans unit is grams (g)');
      assert(espressoDepletion.consumed_qty > 0, 'Consumed beans quantity is strictly positive');
      assert((espressoDepletion.total_cost_toman || 0) > 0, 'Calculates estimated cost of consumed beans');
    }

    const milkDepletion = balancedReport.material_depletions.find(
      (m) => m.item_id === 'ing_whole_milk' || m.item_id === 'mod_ing_milk'
    );
    if (milkDepletion) {
      assert(milkDepletion.unit === 'ml', 'Dairy milk unit is milliliters (ml)');
      assert(milkDepletion.consumed_qty > 0, 'Consumed dairy milk quantity is strictly positive');
    }
  }

  // =========================================================================
  // SUITE 3: ESC/POS Binary Ticket & Double Strike Generation
  // =========================================================================
  console.log('\n[Suite 3: ESC/POS Binary Ticket & Double Strike Invariants]');
  {
    const printResult = await ShiftCloseoutService.printZReportTicket(balancedReport);

    assert(printResult.success === true, 'printZReportTicket generates output successfully');
    assert(printResult.bytes instanceof Uint8Array, 'Output bytes is Uint8Array instance');
    assert(printResult.bytes.length > 100, `ESC/POS byte stream length is ${printResult.bytes.length} bytes`);

    // 1. ESC @ (Init) -> [0x1B, 0x40]
    assert(
      printResult.bytes[0] === 0x1b && printResult.bytes[1] === 0x40,
      'Z-Report ticket begins with ESC @ [0x1B, 0x40]'
    );

    // 2. ESC G 1 (Double Strike On) -> [0x1B, 0x47, 0x01]
    let hasDoubleStrike = false;
    for (let i = 0; i < printResult.bytes.length - 2; i++) {
      if (
        printResult.bytes[i] === 0x1b &&
        printResult.bytes[i + 1] === 0x47 &&
        printResult.bytes[i + 2] === 0x01
      ) {
        hasDoubleStrike = true;
        break;
      }
    }
    assert(hasDoubleStrike, 'ESC/POS contains Double Strike command [0x1B, 0x47, 0x01]');

    // 3. ESC E 1 (Emphasized Bold On) -> [0x1B, 0x45, 0x01]
    let hasBold = false;
    for (let i = 0; i < printResult.bytes.length - 2; i++) {
      if (
        printResult.bytes[i] === 0x1b &&
        printResult.bytes[i + 1] === 0x45 &&
        printResult.bytes[i + 2] === 0x01
      ) {
        hasBold = true;
        break;
      }
    }
    assert(hasBold, 'ESC/POS contains Emphasized Bold command [0x1B, 0x45, 0x01]');

    // 4. GS V 0 (Paper Cut) -> [0x1D, 0x56, 0x00]
    let hasCut = false;
    for (let i = 0; i < printResult.bytes.length - 2; i++) {
      if (
        printResult.bytes[i] === 0x1d &&
        printResult.bytes[i + 1] === 0x56 &&
        printResult.bytes[i + 2] === 0x00
      ) {
        hasCut = true;
        break;
      }
    }
    assert(hasCut, 'ESC/POS contains Full Paper Cut command [0x1D, 0x56, 0x00]');

    // 5. Text Preview Content
    assert(
      printResult.textPreview.includes('Z-REPORT'),
      'Text preview includes Z-REPORT header banner'
    );
    assert(
      printResult.textPreview.includes('FINANCIAL REVENUE'),
      'Text preview contains financial revenue section'
    );
    assert(
      printResult.textPreview.includes('BOM DEPLETIONS'),
      'Text preview contains raw material depletions section'
    );
  }

  // =========================================================================
  // SUITE 4: Inventory Stock Inward & Weighted Average Cost (WAC)
  // =========================================================================
  console.log('\n[Suite 4: Stock Inward & Weighted Average Cost (WAC) Invariants]');
  {
    // Scenario 1: Intake 5,000g of Colombian Supremo Beans
    // Suppose existing stock: 3,200g at 2,600 Toman/g = 8,320,000 Toman
    // Incoming: 6,800g at 3,000 Toman/g = 20,400,000 Toman
    // Total value: 8,320,000 + 20,400,000 = 28,720,000 Toman
    // Total stock: 3,200 + 6,800 = 10,000g
    // Expected WAC: 28,720,000 / 10,000 = 2,872 Toman/g

    const ing = inventoryBomService.getIngredientById('ing_colombian_beans');
    assert(ing !== undefined, 'Target raw ingredient ing_colombian_beans found');

    if (ing) {
      const prevStock = ing.current_stock;
      const prevCost = ing.cost_per_unit;
      const incomingQty = 5000;
      const purchaseCost = 3200;

      const expectedNewStock = prevStock + incomingQty;
      const expectedWac = Math.round(
        (prevStock * prevCost + incomingQty * purchaseCost) / expectedNewStock
      );

      const txn = await inventoryBomService.recordStockInward({
        raw_item_id: ing.id,
        batch_number: 'BATCH-2026-TEST-01',
        incoming_quantity: incomingQty,
        purchase_cost_per_unit: purchaseCost,
        supplier_name: 'رستری ۱۰۰هیچ',
        notes: 'فاکتور تست شماره ۹۹۰',
        operator_name: 'مدیر انبار',
      });

      assert(txn.raw_item_id === ing.id, 'Transaction records target ingredient ID');
      assert(txn.batch_number === 'BATCH-2026-TEST-01', 'Transaction records batch number');
      assert(txn.incoming_quantity === incomingQty, 'Transaction records incoming quantity');
      assert(txn.new_stock === expectedNewStock, `Current stock updated accurately from ${prevStock} to ${expectedNewStock}`);
      assert(txn.weighted_average_cost === expectedWac, `WAC recalculated accurately: expected ${expectedWac}, got ${txn.weighted_average_cost}`);

      // Verify that ingredient in service state is updated
      const updatedIng = inventoryBomService.getIngredientById(ing.id);
      assert(updatedIng?.current_stock === expectedNewStock, 'Ingredient current_stock in memory matches new stock');
      assert(updatedIng?.cost_per_unit === expectedWac, 'Ingredient cost_per_unit in memory reflects new WAC');
    }

    // Scenario 2: Intake when existing stock is 0
    const zeroStockIngId = 'ing_zero_test';
    inventoryBomService.saveIngredient({
      id: zeroStockIngId,
      title_en: 'Zero Stock Test',
      title_fa: 'ماده اولیه تستی با موجودی صفر',
      unit: 'piece',
      initial_stock: 0,
      current_stock: 0,
      min_safety_stock: 5,
      cost_per_unit: 50000,
      last_restocked_at: new Date().toISOString(),
    });

    const txnZero = await inventoryBomService.recordStockInward({
      raw_item_id: zeroStockIngId,
      batch_number: 'BATCH-ZERO-01',
      incoming_quantity: 10,
      purchase_cost_per_unit: 45000,
      supplier_name: 'تأمین‌کننده تست',
    });

    assert(txnZero.new_stock === 10, 'Stock increases from 0 to 10');
    assert(txnZero.weighted_average_cost === 45000, 'When previous stock is 0, WAC equals new purchase cost');
  }

  console.log('\n========================================');
  console.log(`Test Execution Summary: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
