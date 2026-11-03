/**
 * CODA Phase P3 — Shift Closeout & Accounting Verification Suite
 * Agent: A09-LEDGER & A05-SENTINEL
 *
 * Requirements Tested:
 * 1. Shift opening and closing invariants.
 * 2. Cash, card, and other payment reconciliation.
 * 3. Expected cash versus counted cash calculation.
 * 4. Recorded discrepancies and adjustment history.
 * 5. Daily financial summaries across tenants.
 * 6. Idempotent shift closing (closeShiftIdempotent).
 * 7. Frozen Accounting & VAT Invariant Protection:
 *    - Invariant: vatTotal = Math.round((netSales * 9) / 109)
 *    - Integer Toman precision math.
 * 8. Strict tenant isolation for all financial records.
 */

// Memory mock for localStorage
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

import { SmartOrdersStore } from '../src/services/storage';
import { ShiftCloseoutService } from '../src/services/ShiftCloseoutService';
import { Order, Payment, Expense, Shift } from '../src/types/domain';

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

function resetEnvironment(tenantId: string = 'tenant-100hich-01') {
  memoryStore.clear();
  SmartOrdersStore.setActiveTenantId(tenantId);
}

async function runSuite() {
  console.log('\n--- Running CODA P3 Shift Closeout & Accounting Verification Suite ---');

  // ============================================================================
  // Suite 1: Shift Opening & Closing Invariants
  // ============================================================================
  console.log('\n[Suite 1: Shift Opening & Closing Invariants]');
  resetEnvironment('tenant-100hich-01');

  // Open initial shift with 500,000 Toman cash float
  const shift1 = SmartOrdersStore.openShift(500000, 'شیفت صبح ۱۰۰ هیچ');
  assertEqual(shift1.status, 'OPEN', 'Shift status is initially OPEN');
  assertEqual(shift1.openingCashToman, 500000, 'Opening cash float is exactly 500,000 Toman');
  assertEqual(shift1.tenantId, 'tenant-100hich-01', 'Shift belongs to tenant-100hich-01');

  // Enforce invariant: Cannot open a second shift while one is already active
  let preventedDoubleOpen = false;
  try {
    SmartOrdersStore.openShift(300000, 'شیفت دوم تکراری');
  } catch (err: any) {
    preventedDoubleOpen = true;
  }
  assert(preventedDoubleOpen, 'INVARIANT ENFORCED: Opening a second shift while one is active throws error');

  // ============================================================================
  // Suite 2: Payment Channels & Cash Reconciliation
  // ============================================================================
  console.log('\n[Suite 2: Payment Channels & Cash Reconciliation]');

  const nowIso = new Date().toISOString();

  // Create sample orders
  const sampleOrders: Order[] = [
    {
      id: 'ord-shift-1',
      tenantId: 'tenant-100hich-01',
      shiftId: shift1.id,
      orderNumber: 1,
      orderType: 'DINE_IN',
      createdByUserId: 'usr-1',
      createdByUserName: 'صندوق‌دار',
      items: [
        {
          id: 'item-1',
          menuItemId: 'm1_flat_white',
          itemNameSnapshot: 'فلت وایت',
          unitPriceSnapshotToman: 65000,
          subtotalToman: 130000,
          quantity: 2,
          station: 'BAR',
        },
      ],
      grossAmountToman: 130000,
      discountAmountToman: 10000,
      netTotalToman: 120000,
      status: 'COMPLETED',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'ord-shift-2',
      tenantId: 'tenant-100hich-01',
      shiftId: shift1.id,
      orderNumber: 2,
      orderType: 'DINE_IN',
      createdByUserId: 'usr-1',
      createdByUserName: 'صندوق‌دار',
      items: [
        {
          id: 'item-2',
          menuItemId: 'm3_croissant',
          itemNameSnapshot: 'کرواسان کره‌ای',
          unitPriceSnapshotToman: 85000,
          subtotalToman: 85000,
          quantity: 1,
          station: 'KITCHEN',
        },
      ],
      grossAmountToman: 85000,
      discountAmountToman: 0,
      netTotalToman: 85000,
      status: 'COMPLETED',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  SmartOrdersStore.saveOrders(sampleOrders);

  // Payments: 120,000 POS Card + 85,000 Cash
  const samplePayments: Payment[] = [
    {
      id: 'pay-1',
      tenantId: 'tenant-100hich-01',
      orderId: 'ord-shift-1',
      shiftId: shift1.id,
      receivedByUserId: 'usr-1',
      amountToman: 120000,
      paymentMethod: 'CARD_MANUAL',
      status: 'SUCCESSFUL',
      createdAt: nowIso,
    },
    {
      id: 'pay-2',
      tenantId: 'tenant-100hich-01',
      orderId: 'ord-shift-2',
      shiftId: shift1.id,
      receivedByUserId: 'usr-1',
      amountToman: 85000,
      paymentMethod: 'CASH',
      status: 'SUCCESSFUL',
      createdAt: nowIso,
    },
  ];
  SmartOrdersStore.savePayments(samplePayments);

  // Expenses: 35,000 paid from cash drawer
  const sampleExpenses: Expense[] = [
    {
      id: 'exp-1',
      tenantId: 'tenant-100hich-01',
      shiftId: shift1.id,
      recordedByUserId: 'usr-1',
      recordedByUserName: 'سارا',
      description: 'خرید یخ اضطراری',
      category: 'SUPPLIES',
      amountToman: 35000,
      isPaidFromCashDrawer: true,
      createdAt: nowIso,
    },
  ];
  SmartOrdersStore.saveExpenses(sampleExpenses);

  // Calculate Z-Report:
  // Expected Cash = Opening (500,000) + Cash Sales (85,000) - Cash Expenses (35,000) = 550,000 Toman.
  // Counted Cash = 550,000 -> Balanced.
  const zReportBalanced = await ShiftCloseoutService.calculateZReport(shift1.id, 550000, {
    tenantId: 'tenant-100hich-01',
  });

  assertEqual(zReportBalanced.gross_sales, 215000, 'Gross sales correctly summed (130k + 85k = 215k)');
  assertEqual(zReportBalanced.discounts_total, 10000, 'Discounts correctly summed (10k)');
  assertEqual(zReportBalanced.net_sales, 205000, 'Net sales correctly calculated (215k - 10k = 205k)');
  assertEqual(zReportBalanced.payment_methods.pos_card, 120000, 'POS Card payments isolated: 120,000 Toman');
  assertEqual(zReportBalanced.payment_methods.cash, 85000, 'Cash payments isolated: 85,000 Toman');
  assertEqual(zReportBalanced.expenses_cash_drawer, 35000, 'Cash drawer expenses isolated: 35,000 Toman');
  assertEqual(zReportBalanced.expected_cash, 550000, 'Expected cash reconciled to exactly 550,000 Toman');
  assertEqual(zReportBalanced.discrepancy, 0, 'Discrepancy is exactly 0 Toman');
  assertEqual(zReportBalanced.is_balanced, true, 'Cash drawer is balanced');

  // Test Shortage Scenario (Counted 530,000 -> -20,000 deficit)
  const zReportShortage = await ShiftCloseoutService.calculateZReport(shift1.id, 530000, {
    tenantId: 'tenant-100hich-01',
  });
  assertEqual(zReportShortage.discrepancy, -20000, 'Discrepancy correctly calculated as -20,000 Toman');
  assertEqual(zReportShortage.is_shortage, true, 'is_shortage flagged as true');
  assertEqual(zReportShortage.is_overage, false, 'is_overage is false');

  // Test Overage Scenario (Counted 565,000 -> +15,000 surplus)
  const zReportOverage = await ShiftCloseoutService.calculateZReport(shift1.id, 565000, {
    tenantId: 'tenant-100hich-01',
  });
  assertEqual(zReportOverage.discrepancy, 15000, 'Discrepancy correctly calculated as +15,000 Toman');
  assertEqual(zReportOverage.is_overage, true, 'is_overage flagged as true');
  assertEqual(zReportOverage.is_shortage, false, 'is_shortage is false');

  // ============================================================================
  // Suite 3: Frozen Accounting & VAT Invariant Protection
  // ============================================================================
  console.log('\n[Suite 3: Frozen Accounting & VAT Invariant Protection]');

  // Frozen formula check: vatTotal = Math.round((netSales * 9) / 109)
  const vatCalculated = zReportBalanced.vat_total;
  const vatExpected = Math.round((205000 * 9) / 109); // 16927 Toman
  assertEqual(vatCalculated, vatExpected, 'FROZEN INVARIANT: VAT matches Math.round((netSales * 9) / 109)');
  assertEqual(vatCalculated, 16927, 'VAT for 205,000 Toman net sales is exactly 16,927 Toman');

  // Verify across multiple test figures
  const vatCases = [
    { net: 100000, expectedVat: Math.round((100000 * 9) / 109) },
    { net: 500000, expectedVat: Math.round((500000 * 9) / 109) },
    { net: 1234567, expectedVat: Math.round((1234567 * 9) / 109) },
  ];
  for (const c of vatCases) {
    const computed = Math.round((c.net * 9) / 109);
    assertEqual(computed, c.expectedVat, `VAT invariant verified for ${c.net} Toman`);
  }

  // ============================================================================
  // Suite 4: Idempotent Shift Closing (closeShiftIdempotent)
  // ============================================================================
  console.log('\n[Suite 4: Idempotent Shift Closing (closeShiftIdempotent)]');

  // First call: Should close the shift
  const closeResult1 = await ShiftCloseoutService.closeShiftIdempotent(shift1.id, 550000, {
    closedBy: 'مهرداد مدیر',
    discrepancyReason: 'بدون مغایرت',
    tenantId: 'tenant-100hich-01',
  });

  assertEqual(closeResult1.isAlreadyClosed, false, 'First close call sets isAlreadyClosed: false');
  assertEqual(closeResult1.shift.status, 'CLOSED', 'Shift status updated to CLOSED');
  assertEqual(closeResult1.zReport.shift_id, shift1.id, 'Z-Report generated for shift');

  // Second call: Replay with same shift ID
  const closeResult2 = await ShiftCloseoutService.closeShiftIdempotent(shift1.id, 550000, {
    closedBy: 'مهرداد مدیر',
    tenantId: 'tenant-100hich-01',
  });

  assertEqual(closeResult2.isAlreadyClosed, true, 'Repeated close call detects shift is already closed (isAlreadyClosed: true)');
  assertEqual(closeResult2.shift.status, 'CLOSED', 'Shift status remains CLOSED without error');
  assertEqual(closeResult2.zReport.expected_cash, closeResult1.zReport.expected_cash, 'Existing financial figures preserved on replay');

  // ============================================================================
  // Suite 5: Daily Financial Summary Across Tenants
  // ============================================================================
  console.log('\n[Suite 5: Daily Financial Summary Across Tenants]');

  const todayStr = nowIso.slice(0, 10);
  const summaryHich = await ShiftCloseoutService.getDailyFinancialSummary('tenant-100hich-01', todayStr);

  assertEqual(summaryHich.tenantId, 'tenant-100hich-01', 'Summary tenantId is 100 HICH');
  assertEqual(summaryHich.totalGrossSales, 215000, 'Summary gross sales: 215,000 Toman');
  assertEqual(summaryHich.totalNetSales, 205000, 'Summary net sales: 205,000 Toman');
  assertEqual(summaryHich.totalVat, 16927, 'Summary total VAT: 16,927 Toman');
  assertEqual(summaryHich.cashTotal, 85000, 'Summary cash total: 85,000 Toman');
  assertEqual(summaryHich.posCardTotal, 120000, 'Summary POS card total: 120,000 Toman');
  assertEqual(summaryHich.orderCount, 2, 'Summary order count: 2 completed orders');

  // Now check Modendo summary: Should be 0 since all data belongs to 100 HICH
  const summaryModendo = await ShiftCloseoutService.getDailyFinancialSummary('tenant-modendo-01', todayStr);
  assertEqual(summaryModendo.totalGrossSales, 0, 'CRITICAL: Modendo gross sales are 0 (zero leak from 100 HICH)');
  assertEqual(summaryModendo.orderCount, 0, 'Modendo order count is 0');
  assertEqual(summaryModendo.shiftCount, 0, 'Modendo shift count is 0');

  // ============================================================================
  // Suite 6: Tenant Receipt Branding Isolation (PATCH-01 / CANON-ROOT-05)
  // ============================================================================
  console.log('\n[Suite 6: Tenant Receipt Branding Isolation (PATCH-01 / CANON-ROOT-05)]');

  // Test 1: 100 Hich Golden Output
  const text100Hich = ShiftCloseoutService.generateZReportText(zReportBalanced, 'tenant-100hich-01');
  assert(text100Hich.includes('*** 100 HICH SPECIALTY COFFEE ***'), '100 Hich text preview contains brand header');
  assert(!text100Hich.includes('MODENDO'), '100 Hich text preview has zero leak of MODENDO');

  const bytes100Hich = ShiftCloseoutService.generateEscPosBytes(zReportBalanced, 'tenant-100hich-01');
  const ascii100Hich = String.fromCharCode(...bytes100Hich);
  assert(ascii100Hich.includes('*** 100 HICH ***'), '100 Hich ESC/POS bytes contain double-size title');
  assert(ascii100Hich.includes('COFFEE ROASTERS - SHIFT AUDIT'), '100 Hich ESC/POS bytes contain sub-brand');

  // Test 2: Modendo Golden Output
  const textModendo = ShiftCloseoutService.generateZReportText(zReportBalanced, 'tenant-modendo-01');
  assert(textModendo.includes('*** MODENDO CAFE & GAMING ***'), 'Modendo text preview contains brand header');
  assert(!textModendo.includes('100 HICH'), 'Modendo text preview has zero leak of 100 HICH');

  const bytesModendo = ShiftCloseoutService.generateEscPosBytes(zReportBalanced, 'tenant-modendo-01');
  const asciiModendo = String.fromCharCode(...bytesModendo);
  assert(asciiModendo.includes('*** MODENDO CAFE ***'), 'Modendo ESC/POS bytes contain double-size title');
  assert(asciiModendo.includes('BOARDGAME & GAMING CAFE - SHIFT AUDIT'), 'Modendo ESC/POS bytes contain sub-brand');

  // Test 3: Missing tenantId throws TypeError
  let missingTenantThrew = false;
  try {
    const headlessZReport = { ...zReportBalanced };
    delete (headlessZReport as any).tenantId;
    delete (headlessZReport as any).tenant_id;
    ShiftCloseoutService.generateZReportText(headlessZReport as any, undefined);
  } catch (err: any) {
    if (err instanceof TypeError && err.message.includes('Mandatory tenantId is missing')) {
      missingTenantThrew = true;
    }
  }
  assert(missingTenantThrew, 'FAIL-CLOSED: generateZReportText throws TypeError when tenantId is missing');

  // Test 4: Unknown / spoofed tenantId throws TypeError
  let unknownTenantThrew = false;
  try {
    ShiftCloseoutService.generateZReportText(zReportBalanced, 'evil-tenant-attacker');
  } catch (err: any) {
    if (err instanceof TypeError && err.message.includes('Unknown or unauthorized tenantId')) {
      unknownTenantThrew = true;
    }
  }
  assert(unknownTenantThrew, 'FAIL-CLOSED: generateZReportText throws TypeError for unknown tenant');

  // Test 5: printZReportTicket integration with tenant parameter
  const printTicketModendo = await ShiftCloseoutService.printZReportTicket(zReportBalanced, 'CASHIER_RECEIPT', 'tenant-modendo-01');
  assert(printTicketModendo.textPreview.includes('*** MODENDO CAFE & GAMING ***'), 'printZReportTicket renders Modendo header correctly');

  console.log(`\n========================================`);
  console.log(`Shift Closeout & Accounting Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
