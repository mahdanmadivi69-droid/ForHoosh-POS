/**
 * Automated Verification Suite for SmartOrders Financial & Domain Logic
 * Enforces zero float error invariants, cash reconciliation, idempotency, and audit trails.
 */

import {
  calculateItemSubtotal,
  calculateOrderTotals,
  calculateExpectedCash,
  calculateCashDiscrepancy,
  compileShiftReport,
  formatToman,
  computeDailyRevenueTrends,
  escapeCSVCell,
  generateOrdersCSV,
  generateExpensesCSV,
  evaluateStockStatus,
  getEffectiveThreshold,
  countStockAlerts,
  calculateShiftProfit,
} from '../src/services/financialMath';
import { Shift, Order, Payment, Expense } from '../src/types/domain';

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

console.log('\n--- Running SmartOrders Financial Invariants Test Suite ---\n');

// TEST SUITE 1: Precision Arithmetic & Item Calculations
console.log('[Suite 1: Precision Arithmetic & Item Subtotals]');
{
  const subtotal1 = calculateItemSubtotal(65000, 3);
  assert(subtotal1 === 195000, 'Integer multiplication without float precision issues');

  const subtotal2 = calculateItemSubtotal(95500.8, 2);
  assert(subtotal2 === 191002, 'Rounds non-integer inputs safely to integer Toman');

  const subtotalZero = calculateItemSubtotal(-50000, 2);
  assert(subtotalZero === 0, 'Negative prices are clamped to 0');
}

// TEST SUITE 2: Order Totals & Discount Rules
console.log('\n[Suite 2: Order Totals & Discount Boundaries]');
{
  const items = [
    { unitPriceSnapshotToman: 65000, quantity: 2 }, // 130,000
    { unitPriceSnapshotToman: 95000, quantity: 1 }, // 95,000
  ];
  // Gross = 225,000
  const totals = calculateOrderTotals(items, 25000);
  assert(totals.grossAmountToman === 225000, 'Gross amount equals sum of item snapshots');
  assert(totals.discountAmountToman === 25000, 'Discount matches requested valid amount');
  assert(totals.netTotalToman === 200000, 'Net total equals gross minus discount');

  // Test discount exceeding gross amount (must clamp to gross amount, net cannot be negative)
  const excessiveDiscount = calculateOrderTotals(items, 500000);
  assert(excessiveDiscount.discountAmountToman === 225000, 'Excessive discount capped at gross total');
  assert(excessiveDiscount.netTotalToman === 0, 'Net total never negative when discount is excessive');
}

// TEST SUITE 3: Cash Drawer Reconciliation Formula
console.log('\n[Suite 3: Cash Drawer Reconciliation Formula]');
{
  const openingCash = 500000;
  const cashReceived = 350000;
  const cashDrawerExpenses = 60000;

  const expected = calculateExpectedCash(openingCash, cashReceived, cashDrawerExpenses);
  assert(expected === 790000, 'Expected cash = Opening (500k) + CashIn (350k) - CashOut (60k)');

  // Test Discrepancy - Balanced
  const balanced = calculateCashDiscrepancy(790000, expected);
  assert(balanced.isBalanced && balanced.discrepancyToman === 0, 'Exact count produces balanced state');

  // Test Discrepancy - Shortage (کسری)
  const shortage = calculateCashDiscrepancy(780000, expected);
  assert(shortage.isShortage && shortage.discrepancyToman === -10000, 'Count lower than expected flags shortage (-10k Toman)');

  // Test Discrepancy - Overage (مازاد)
  const overage = calculateCashDiscrepancy(805000, expected);
  assert(overage.isOverage && overage.discrepancyToman === 15000, 'Count higher than expected flags overage (+15k Toman)');
}

// TEST SUITE 4: Shift Report Comprehensive Compilation
console.log('\n[Suite 4: Shift Report Financial Separation]');
{
  const dummyShift: Shift = {
    id: 'test-shift-1',
    tenantId: 'tenant-1',
    openedByUserId: 'u1',
    openedByUserName: 'مدیر آزمایشی',
    openedAt: '2026-10-25T08:00:00Z',
    openingCashToman: 500000,
    expectedClosingCashToman: 500000,
    status: 'OPEN',
  };

  const dummyOrders: Order[] = [
    // Completed order 1 (Cash)
    {
      id: 'o1',
      tenantId: 'tenant-1',
      shiftId: 'test-shift-1',
      createdByUserId: 'u1',
      createdByUserName: 'صندوق‌دار',
      orderNumber: 1,
      orderType: 'DINE_IN',
      status: 'COMPLETED',
      items: [{ id: 'it1', menuItemId: 'm1', itemNameSnapshot: 'لاته', unitPriceSnapshotToman: 95000, quantity: 2, subtotalToman: 190000 }],
      grossAmountToman: 190000,
      discountAmountToman: 10000,
      netTotalToman: 180000,
      createdAt: '2026-10-25T08:30:00Z',
      updatedAt: '2026-10-25T08:30:00Z',
    },
    // Completed order 2 (Card)
    {
      id: 'o2',
      tenantId: 'tenant-1',
      shiftId: 'test-shift-1',
      createdByUserId: 'u1',
      createdByUserName: 'صندوق‌دار',
      orderNumber: 2,
      orderType: 'TAKEAWAY',
      status: 'COMPLETED',
      items: [{ id: 'it2', menuItemId: 'm2', itemNameSnapshot: 'چیزکیک', unitPriceSnapshotToman: 145000, quantity: 1, subtotalToman: 145000 }],
      grossAmountToman: 145000,
      discountAmountToman: 0,
      netTotalToman: 145000,
      createdAt: '2026-10-25T09:00:00Z',
      updatedAt: '2026-10-25T09:00:00Z',
    },
    // Cancelled order (must not contribute to revenue)
    {
      id: 'o3',
      tenantId: 'tenant-1',
      shiftId: 'test-shift-1',
      createdByUserId: 'u1',
      createdByUserName: 'صندوق‌دار',
      orderNumber: 3,
      orderType: 'DINE_IN',
      status: 'CANCELLED',
      cancellationReason: 'مشتری منصرف شد',
      items: [{ id: 'it3', menuItemId: 'm1', itemNameSnapshot: 'لاته', unitPriceSnapshotToman: 95000, quantity: 1, subtotalToman: 95000 }],
      grossAmountToman: 95000,
      discountAmountToman: 0,
      netTotalToman: 95000,
      createdAt: '2026-10-25T09:30:00Z',
      updatedAt: '2026-10-25T09:30:00Z',
    },
  ];

  const dummyPayments: Payment[] = [
    {
      id: 'p1',
      tenantId: 'tenant-1',
      orderId: 'o1',
      shiftId: 'test-shift-1',
      receivedByUserId: 'u1',
      amountToman: 180000,
      paymentMethod: 'CASH',
      status: 'SUCCESSFUL',
      createdAt: '2026-10-25T08:30:00Z',
    },
    {
      id: 'p2',
      tenantId: 'tenant-1',
      orderId: 'o2',
      shiftId: 'test-shift-1',
      receivedByUserId: 'u1',
      amountToman: 145000,
      paymentMethod: 'CARD_MANUAL',
      referenceCode: '9928172',
      status: 'SUCCESSFUL',
      createdAt: '2026-10-25T09:00:00Z',
    },
  ];

  const dummyExpenses: Expense[] = [
    // Paid from cash drawer
    {
      id: 'e1',
      tenantId: 'tenant-1',
      shiftId: 'test-shift-1',
      recordedByUserId: 'u1',
      recordedByUserName: 'مدیر',
      category: 'خرید شیر',
      amountToman: 50000,
      isPaidFromCashDrawer: true,
      description: 'خرید شیر از سوپرمارکت',
      createdAt: '2026-10-25T09:15:00Z',
    },
    // Paid from outside (not from cash drawer)
    {
      id: 'e2',
      tenantId: 'tenant-1',
      shiftId: 'test-shift-1',
      recordedByUserId: 'u1',
      recordedByUserName: 'مدیر',
      category: 'تعمیر دستگاه',
      amountToman: 200000,
      isPaidFromCashDrawer: false,
      description: 'واریز کارت به کارت تعمیرکار',
      createdAt: '2026-10-25T09:20:00Z',
    },
  ];

  const report = compileShiftReport(dummyShift, dummyOrders, dummyPayments, dummyExpenses);

  assert(report.completedOrderCount === 2, 'Completed order count excludes cancelled orders');
  assert(report.cancelledOrderCount === 1, 'Cancelled order count tracked separately');
  assert(report.grossSalesToman === 335000, 'Gross sales is sum of completed orders only (190k + 145k)');
  assert(report.discountsToman === 10000, 'Discounts tracked accurately');
  assert(report.netRevenueToman === 325000, 'Net revenue = 335k - 10k = 325k Toman');

  assert(report.cashReceivedToman === 180000, 'Cash inflow separated from card inflow');
  assert(report.cardReceivedToman === 145000, 'Card inflow tracked separately');
  assert(report.totalCollectedToman === 325000, 'Total collected equals total of all successful payments');

  assert(report.cashDrawerExpensesToman === 50000, 'Only cash drawer expenses reduce expected cash');
  assert(report.otherExpensesToman === 200000, 'Non-cash expenses tracked without altering drawer balance');
  assert(report.totalExpensesToman === 250000, 'Total expenses sum all categories');

  // Expected cash = 500,000 (opening) + 180,000 (cash in) - 50,000 (cash expense) = 630,000
  assert(report.expectedCashToman === 630000, 'Expected cash matches strict invariant (500k + 180k - 50k = 630k)');
}

// TEST SUITE 5: Formatting Output
console.log('\n[Suite 5: Persian Currency Formatting]');
{
  const formattedEn = formatToman(145000, false);
  assert(formattedEn === '145,000', 'Standard digit format with comma grouping');

  const formattedFa = formatToman(145000, true);
  assert(formattedFa === '۱۴۵,۰۰۰', 'Persian digit format with comma grouping');
}

// TEST SUITE 6: Printable Shift Summary Reconciliation Scenarios
console.log('\n[Suite 6: Printable Shift Summary Reconciliation Scenarios]');
{
  // Test case 1: Balanced shift summary
  const expectedCash = calculateExpectedCash(500000, 250000, 30000); // 720,000
  const balanced = calculateCashDiscrepancy(720000, expectedCash);
  assert(balanced.isBalanced, 'Shift summary report marks balanced when actual count equals expected cash');
  assert(balanced.discrepancyToman === 0, 'Discrepancy amount is 0 when balanced');

  // Test case 2: Shift summary with cash shortage (کسری)
  const shortage = calculateCashDiscrepancy(710000, expectedCash);
  assert(shortage.isShortage, 'Shift summary report identifies shortage');
  assert(shortage.discrepancyToman === -10000, 'Shift summary calculates exact -10,000 shortage');

  // Test case 3: Shift summary with cash overage (مازاد)
  const overage = calculateCashDiscrepancy(735000, expectedCash);
  assert(overage.isOverage, 'Shift summary report identifies overage');
  assert(overage.discrepancyToman === 15000, 'Shift summary calculates exact +15,000 overage');
}

// TEST SUITE 7: 30-Day Daily Revenue Trends Calculation Invariants
console.log('\n[Suite 7: 30-Day Daily Revenue Trends Invariants]');
{
  const refDate = new Date('2026-03-30T12:00:00');
  const sampleOrders: Order[] = [
    {
      id: 'o-1',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      orderNumber: 1,
      createdByUserId: 'u-1',
      createdByUserName: 'Ali',
      orderType: 'DINE_IN',
      status: 'COMPLETED',
      items: [],
      grossAmountToman: 200000,
      discountAmountToman: 20000,
      netTotalToman: 180000,
      createdAt: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 10, 0, 0).toISOString(),
      updatedAt: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 10, 0, 0).toISOString(),
    },
    {
      id: 'o-2',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      orderNumber: 2,
      createdByUserId: 'u-1',
      createdByUserName: 'Ali',
      orderType: 'TAKEAWAY',
      status: 'COMPLETED',
      items: [],
      grossAmountToman: 100000,
      discountAmountToman: 0,
      netTotalToman: 100000,
      createdAt: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 11, 0, 0).toISOString(),
      updatedAt: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 11, 0, 0).toISOString(),
    },
    {
      id: 'o-3',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      orderNumber: 3,
      createdByUserId: 'u-1',
      createdByUserName: 'Ali',
      orderType: 'DINE_IN',
      status: 'CANCELLED', // Cancelled order must be ignored
      items: [],
      grossAmountToman: 500000,
      discountAmountToman: 0,
      netTotalToman: 500000,
      createdAt: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 9, 0, 0).toISOString(),
      updatedAt: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 9, 0, 0).toISOString(),
    },
    {
      id: 'o-4',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      orderNumber: 4,
      createdByUserId: 'u-1',
      createdByUserName: 'Ali',
      orderType: 'TAKEAWAY',
      status: 'COMPLETED',
      items: [],
      grossAmountToman: 150000,
      discountAmountToman: 10000,
      netTotalToman: 140000,
      createdAt: new Date(refDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days prior
      updatedAt: new Date(refDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const trends = computeDailyRevenueTrends(sampleOrders, 30, refDate);
  assert(trends.dataPoints.length === 30, 'Generates exactly 30 continuous daily data points');
  assert(trends.totalCompletedOrders === 3, 'Counts only completed orders and excludes cancelled orders');
  assert(trends.totalRevenueToman === 180000 + 100000 + 140000, 'Total 30-day revenue accurately matches sum of netTotalToman');
  assert(trends.averageDailyRevenueToman === Math.round((180000 + 100000 + 140000) / 30), 'Average daily revenue calculated with integer rounding');
  assert(trends.peakDailyRevenueToman === 280000, 'Peak daily revenue reflects highest revenue day (180k + 100k = 280k on refDate)');

  // Verify non-order days are filled with zero values
  const fiveDaysAgoTarget = new Date(refDate.getTime() - 2 * 24 * 60 * 60 * 1000);
  const y = fiveDaysAgoTarget.getFullYear();
  const m = String(fiveDaysAgoTarget.getMonth() + 1).padStart(2, '0');
  const d = String(fiveDaysAgoTarget.getDate()).padStart(2, '0');
  const zeroDay = trends.dataPoints.find((p) => p.dateKey === `${y}-${m}-${d}`);
  assert(zeroDay !== undefined && zeroDay.revenue === 0 && zeroDay.orderCount === 0, 'Zero-order days are safely initialized with 0 revenue and 0 orders');
}

// TEST SUITE 8: CSV Export & Formatting Invariants
console.log('\n[Suite 8: CSV Export Invariants & Persian UTF-8 Encoding]');
{
  // Test cell escaping
  assert(escapeCSVCell(145000) === '"145000"', 'Numbers are enclosed in quotes per RFC 4180');
  assert(escapeCSVCell('سلام') === '"سلام"', 'Strings are wrapped in quotes');
  assert(escapeCSVCell('چای، قند پهلو') === '"چای، قند پهلو"', 'Strings with commas are safely quoted');
  assert(escapeCSVCell('کیک "شکلاتی"') === '"کیک ""شکلاتی"""', 'Quotes inside strings are escaped to double quotes');
  assert(escapeCSVCell(null) === '""', 'Null values are safe empty strings');

  // Test CSV output with realistic orders
  const testOrders: Order[] = [
    {
      id: 'ord-csv-1',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      orderNumber: 101,
      createdByUserId: 'u1',
      createdByUserName: 'سارا رضایی',
      orderType: 'DINE_IN',
      tableLabel: 'میز ۴',
      status: 'COMPLETED',
      items: [
        {
          id: 'item-1',
          menuItemId: 'm1',
          itemNameSnapshot: 'لاته آرت',
          unitPriceSnapshotToman: 65000,
          quantity: 2,
          subtotalToman: 130000,
        },
        {
          id: 'item-2',
          menuItemId: 'm2',
          itemNameSnapshot: 'چیزکیک نیویورکی',
          unitPriceSnapshotToman: 85000,
          quantity: 1,
          subtotalToman: 85000,
        },
      ],
      grossAmountToman: 215000,
      discountAmountToman: 15000,
      netTotalToman: 200000,
      createdAt: '2026-10-25T14:30:00.000Z',
      updatedAt: '2026-10-25T14:35:00.000Z',
    },
    {
      id: 'ord-csv-2',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      orderNumber: 102,
      createdByUserId: 'u2',
      createdByUserName: 'علی محمدی',
      orderType: 'TAKEAWAY',
      customerName: 'آقای احمدی',
      status: 'CANCELLED',
      cancellationReason: 'انصراف مشتری از سفارش',
      items: [
        {
          id: 'item-3',
          menuItemId: 'm3',
          itemNameSnapshot: 'آمریکانو',
          unitPriceSnapshotToman: 50000,
          quantity: 1,
          subtotalToman: 50000,
        },
      ],
      grossAmountToman: 50000,
      discountAmountToman: 0,
      netTotalToman: 50000,
      createdAt: '2026-10-25T15:00:00.000Z',
      updatedAt: '2026-10-25T15:10:00.000Z',
    },
  ];

  const csv = generateOrdersCSV(testOrders);

  // Invariant 1: Starts with UTF-8 BOM
  assert(csv.charCodeAt(0) === 0xFEFF, 'CSV output begins with UTF-8 BOM character (\\uFEFF) for Excel compatibility');

  // Invariant 2: Rows count (BOM + Header + 2 data rows + 1 summary row = 4 lines)
  const lines = csv.substring(1).trim().split('\r\n');
  assert(lines.length === 4, `CSV contains exactly 4 lines (header + 2 rows + summary), found ${lines.length}`);

  // Invariant 3: Headers include Persian descriptions
  assert(lines[0].includes('شماره فاکتور') && lines[0].includes('مبلغ خالص پرداختی (تومان)'), 'Header row contains correct Persian column titles');

  // Invariant 4: First order data row contains table, customer, and exact integer sums
  assert(lines[1].includes('101'), 'Row 1 includes order number 101');
  assert(lines[1].includes('میز ۴'), 'Row 1 includes table label میز ۴');
  assert(lines[1].includes('تکمیل شده (تسویه)'), 'Row 1 includes Persian status translation');
  assert(lines[1].includes('215000') && lines[1].includes('15000') && lines[1].includes('200000'), 'Row 1 contains exact numeric Toman amounts');
  assert(lines[1].includes('لاته آرت (2 عدد)'), 'Row 1 includes formatted item snapshots');

  // Invariant 5: Cancelled order row contains cancellation reason and takeaway tag
  assert(lines[2].includes('102') && lines[2].includes('لغو شده'), 'Row 2 indicates cancelled order');
  assert(lines[2].includes('انصراف مشتری از سفارش'), 'Row 2 includes cancellation reason');
  assert(lines[2].includes('آقای احمدی'), 'Row 2 includes takeaway customer name');

  // Invariant 6: Summary row aggregates numeric values accurately
  const summaryLine = lines[3];
  assert(summaryLine.includes('مجموع کل (2 فاکتور)'), 'Summary row accurately displays total order count label');
  assert(summaryLine.includes('265000'), 'Summary row accurately sums gross sales (215000 + 50000 = 265000)');
  assert(summaryLine.includes('15000'), 'Summary row accurately sums discounts (15000 + 0 = 15000)');
  assert(summaryLine.includes('250000'), 'Summary row accurately sums net sales (200000 + 50000 = 250000)');

  // Invariant 7: Empty list produces valid header without crashing
  const emptyCsv = generateOrdersCSV([]);
  assert(emptyCsv.charCodeAt(0) === 0xFEFF, 'Empty list CSV starts with BOM');
  const emptyLines = emptyCsv.substring(1).trim().split('\r\n');
  assert(emptyLines.length === 1, 'Empty list CSV contains only header line without throwing');

  // Invariant 8: Expenses CSV generation, UTF-8 BOM, Persian headers, and calculations
  const testExpenses: Expense[] = [
    {
      id: 'exp-1',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      recordedByUserId: 'u1',
      recordedByUserName: 'مهدان مددی',
      category: 'شیر و لبنیات',
      amountToman: 45000,
      isPaidFromCashDrawer: true,
      description: 'خرید ۳ بطری شیر تازه پگاه',
      createdAt: '2026-10-25T11:00:00.000Z',
    },
    {
      id: 'exp-2',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      recordedByUserId: 'u2',
      recordedByUserName: 'سارا رضایی',
      category: 'کرایه پیک',
      amountToman: 20000,
      isPaidFromCashDrawer: false,
      description: 'کرایه ارسال پیک موتوری اسنپ',
      createdAt: '2026-10-25T12:30:00.000Z',
    },
  ];

  const expCsv = generateExpensesCSV(testExpenses);
  assert(expCsv.charCodeAt(0) === 0xFEFF, 'Expenses CSV output begins with UTF-8 BOM character (\\uFEFF) for Excel compatibility');

  const expLines = expCsv.substring(1).trim().split('\r\n');
  assert(expLines.length === 4, `Expenses CSV contains 4 lines (header + 2 rows + summary), found ${expLines.length}`);
  assert(expLines[0].includes('دسته‌بندی هزینه') && expLines[0].includes('مبلغ هزینه (تومان)'), 'Expenses CSV header contains Persian titles');

  // Row 1: cash drawer expense
  assert(expLines[1].includes('شیر و لبنیات') && expLines[1].includes('45000'), 'Row 1 contains category and exact integer amount');
  assert(expLines[1].includes('کسر از کشوی نقد (صندوق)'), 'Row 1 correctly identifies cash drawer deduction');
  assert(expLines[1].includes('مهدان مددی'), 'Row 1 includes recorded user name');

  // Row 2: non-cash expense
  assert(expLines[2].includes('کرایه پیک') && expLines[2].includes('20000'), 'Row 2 contains category and exact integer amount');
  assert(expLines[2].includes('پرداخت متفرقه / حساب بانکی'), 'Row 2 correctly identifies non-cash payment');

  // Summary row
  const expSummary = expLines[3];
  assert(expSummary.includes('مجموع کل (2 ردیف)'), 'Expenses summary includes row count');
  assert(expSummary.includes('65000'), 'Expenses summary accurately sums amounts (45000 + 20000 = 65000)');
  assert(expSummary.includes('نقدی: 45000'), 'Expenses summary separates cash drawer expenses');
  assert(expSummary.includes('غیرنقدی: 20000'), 'Expenses summary separates non-cash expenses');

  // Empty expenses list
  const emptyExpCsv = generateExpensesCSV([]);
  assert(emptyExpCsv.charCodeAt(0) === 0xFEFF, 'Empty expenses CSV starts with BOM');
  const emptyExpLines = emptyExpCsv.substring(1).trim().split('\r\n');
  assert(emptyExpLines.length === 1, 'Empty expenses CSV contains header line only');
}

// TEST SUITE 9: Inventory Stock Status & Configurable Thresholds
console.log('\n[Suite 9: Inventory Stock Status & Configurable Thresholds]');
{
  // 1. Effective threshold resolution
  assert(getEffectiveThreshold(undefined, 5) === 5, 'Fallback to default threshold when itemThreshold is undefined');
  assert(getEffectiveThreshold(null, 5) === 5, 'Fallback to default threshold when itemThreshold is null');
  assert(getEffectiveThreshold(8, 5) === 8, 'Custom item threshold overrides default threshold');
  assert(getEffectiveThreshold(0, 5) === 0, 'Custom item threshold of 0 is respected');

  // 2. Out of Stock evaluation (stock === 0)
  const oos1 = evaluateStockStatus(0, undefined, 5);
  assert(oos1.status === 'OUT_OF_STOCK', '0 stock is categorized as OUT_OF_STOCK');
  assert(oos1.isOutOfStock === true, 'isOutOfStock flag is true');
  assert(oos1.isLowStock === true, 'isLowStock flag is true for out of stock');
  assert(oos1.currentStock === 0, 'currentStock is 0');
  assert(oos1.deficit === 5, 'deficit equals full threshold for 0 stock');

  // 3. Low stock evaluation (0 < stock <= threshold)
  const low1 = evaluateStockStatus(3, undefined, 5);
  assert(low1.status === 'LOW', 'Stock of 3 with threshold 5 is categorized as LOW');
  assert(low1.isLowStock === true, 'isLowStock is true');
  assert(low1.isOutOfStock === false, 'isOutOfStock is false');
  assert(low1.deficit === 2, 'deficit is 2 (5 - 3)');

  // 4. Exact threshold boundary (stock === threshold)
  const exactThreshold = evaluateStockStatus(5, undefined, 5);
  assert(exactThreshold.status === 'LOW', 'Stock exactly at threshold is flagged as LOW (needs replenishment)');
  assert(exactThreshold.deficit === 0, 'Deficit is 0 at exact threshold');

  // 5. Healthy stock (stock > threshold)
  const healthy = evaluateStockStatus(6, undefined, 5);
  assert(healthy.status === 'OK', 'Stock of 6 with threshold 5 is OK');
  assert(healthy.isLowStock === false, 'isLowStock is false for healthy stock');
  assert(healthy.deficit === 0, 'deficit is 0 for healthy stock');

  // 6. Custom threshold per-item overrides global default
  const customLow = evaluateStockStatus(7, 10, 5); // Global 5, item 10 -> stock 7 is LOW
  assert(customLow.status === 'LOW', 'Item with custom threshold 10 is LOW when stock is 7, despite global threshold 5');
  assert(customLow.effectiveThreshold === 10, 'effectiveThreshold is 10');
  assert(customLow.deficit === 3, 'deficit is 3');

  const customOk = evaluateStockStatus(4, 3, 5); // Global 5, item 3 -> stock 4 is OK
  assert(customOk.status === 'OK', 'Item with custom threshold 3 is OK when stock is 4, despite global threshold 5');

  // 7. Resilient edge cases (negative stock clamped to 0, null/undefined inputs)
  const negStock = evaluateStockStatus(-3, undefined, 5);
  assert(negStock.currentStock === 0 && negStock.status === 'OUT_OF_STOCK', 'Negative stock clamped to 0 OUT_OF_STOCK');

  const nullStock = evaluateStockStatus(null, undefined, 5);
  assert(nullStock.currentStock === 0 && nullStock.status === 'OUT_OF_STOCK', 'Null stock treated safely as 0 OUT_OF_STOCK');

  // 8. Aggregation with countStockAlerts
  const sampleItems = [
    { currentStock: 25, lowStockThreshold: 5 }, // OK
    { currentStock: 3, lowStockThreshold: 5 },  // LOW
    { currentStock: 0, lowStockThreshold: 5 },  // OUT_OF_STOCK
    { currentStock: 2, lowStockThreshold: 5 },  // LOW
    { currentStock: 4, lowStockThreshold: 6 },  // LOW
    { currentStock: 12, lowStockThreshold: 5 }, // OK
  ];

  const counts = countStockAlerts(sampleItems, 5);
  assert(counts.totalLowStock === 4, `totalLowStock is 4 (3 low + 1 out of stock), got ${counts.totalLowStock}`);
  assert(counts.outOfStockCount === 1, `outOfStockCount is 1, got ${counts.outOfStockCount}`);
  assert(counts.warningCount === 3, `warningCount is 3, got ${counts.warningCount}`);
  assert(counts.healthyCount === 2, `healthyCount is 2, got ${counts.healthyCount}`);
}

// TEST SUITE 9: Phase 4 OrderAggregate, Multi-Tenant RLS & Idempotent Persistence
console.log('\n[Suite 9: Phase 4 Domain, Multi-Tenant RLS & Idempotency]');
{
  const { validateOrderAggregate } = await import('../src/types/order-domain');
  const { insertOrderAggregateAtomic } = await import('../src/services/dbOrderService');

  const validOrder: any = {
    clientGeneratedId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'ord-test-01',
    tenantId: 'tenant-100hich-01',
    shiftId: 'shift-01',
    orderNumber: 101,
    orderType: 'DINE_IN',
    state: 'PAID',
    items: [
      {
        id: 'item-1',
        menuItemId: 'item-espresso',
        itemNameSnapshot: 'اسپرسو دوبل',
        unitPriceSnapshotToman: 65000,
        quantity: 2,
        modifiers: [
          { id: 'mod-oat', nameFa: 'شیر جو دوسر', priceDeltaToman: 25000 },
        ],
        modifiersDeltaToman: 50000,
        subtotalToman: 180000, // (65000 + 25000) * 2 = 180,000
      },
    ],
    grossAmountToman: 180000,
    grossAmount: 180000,
    discountAmountToman: 10000,
    discountAmount: 10000,
    netTotalToman: 170000,
    totalNet: 170000,
    payments: [
      {
        id: 'pay-01',
        tenantId: 'tenant-100hich-01',
        orderId: 'ord-test-01',
        clientGeneratedId: '550e8400-e29b-41d4-a716-446655440000',
        shiftId: 'shift-01',
        receivedByUserId: 'user-01',
        amountToman: 170000,
        paymentMethod: 'CARD_MANUAL',
        status: 'SUCCESSFUL',
        createdAt: new Date().toISOString(),
      },
    ],
    paidAmountToman: 170000,
    paidAmount: 170000,
    createdByUserId: 'user-01',
    createdByUserName: 'مهدان مددی',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Valid Order passes domain checks
  const v1 = validateOrderAggregate(validOrder);
  assert(v1.isValid === true, 'OrderAggregate passes domain integer & invariant validation');

  // 2. Reject float money
  const floatOrder = { ...validOrder, netTotalToman: 170000.5 };
  const v2 = validateOrderAggregate(floatOrder);
  assert(v2.isValid === false, 'Rejects floating point net total');

  // 3. Atomic insertion into DB service
  const res1 = await insertOrderAggregateAtomic('tenant-100hich-01', validOrder);
  assert(res1.success === true && res1.isIdempotentReplay === false, 'Atomic order inserted successfully');

  // 4. Idempotent replay with same clientGeneratedId returns existing without duplicate
  const res2 = await insertOrderAggregateAtomic('tenant-100hich-01', validOrder);
  assert(res2.success === true && res2.isIdempotentReplay === true, 'Duplicate submission with same clientGeneratedId is recognized as idempotent replay');

  // 5. Cross-tenant RLS isolation check
  let rlsCaught = false;
  try {
    await insertOrderAggregateAtomic('tenant-other-99', validOrder);
  } catch (err: any) {
    rlsCaught = true;
  }
  assert(rlsCaught === true, 'Cross-tenant insertion is blocked by Multi-Tenant RLS isolation rule');
}

// TEST SUITE 10: OrderDomainService State Machine & toToman Invariants
console.log('\n[Suite 10: OrderDomainService Lifecycle & toToman]');
{
  const { OrderDomainService, toToman } = await import('../src/types/order-domain');

  // 1. toToman rounding and clamping
  assert(toToman(95000.4) === 95000, 'toToman rounds down float values safely');
  assert(toToman(95000.7) === 95001, 'toToman rounds up float values safely');
  assert(toToman(-500) === 0, 'toToman clamps negative to 0');
  assert(toToman(NaN) === 0, 'toToman converts NaN to 0');

  // 2. createDraft
  const clientUUID = '990e8400-e29b-41d4-a716-446655449999';
  let order = OrderDomainService.createDraft({
    tenantId: 'tenant_100hich',
    clientGeneratedId: clientUUID,
  });
  assert(order.state === 'DRAFT', 'createDraft initializes order in DRAFT state');
  assert(order.totalNet === 0, 'initial draft with no items has 0 totalNet');
  assert(order.netTotalToman === 0, 'netTotalToman alias equals 0');

  // 3. addItem with modifier
  order = OrderDomainService.addItem(order, {
    menuItemId: 'item-latte',
    itemNameSnapshot: 'کافه لاته',
    unitPriceSnapshotToman: 95000,
    quantity: 2,
    modifiers: [{ id: 'mod-oat', nameFa: 'شیر جو دوسر', priceDeltaToman: 25000 }],
  });
  // subtotal = (95000 + 25000) * 2 = 240,000
  assert(order.grossAmount === 240000, 'grossAmount reflects item and modifier additions');
  assert(order.totalNet === 240000, 'totalNet equals 240,000');

  // 4. placeOrder locks items
  order = OrderDomainService.placeOrder(order);
  assert(order.state === 'PLACED', 'placeOrder transitions order to PLACED state');

  // Cannot add items after PLACED
  let itemAddBlocked = false;
  try {
    OrderDomainService.addItem(order, {
      menuItemId: 'item-x',
      itemNameSnapshot: 'چیز اضافه',
      unitPriceSnapshotToman: 10000,
      quantity: 1,
    });
  } catch (err: any) {
    itemAddBlocked = true;
  }
  assert(itemAddBlocked === true, 'Cannot add items to a PLACED order');

  // 5. applyPayment
  order = OrderDomainService.applyPayment(order, {
    method: 'POS_TERMINAL',
    amount: order.totalNet,
    referenceNumber: 'TRACE-123456',
  });
  assert(order.state === 'PAID', 'Full payment transitions order to PAID state');
  assert(order.paidAmount === 240000, 'paidAmount matches full totalNet');
  assert(order.payments.length === 1, 'Payment record was attached');
  assert(order.payments[0].method === 'POS_TERMINAL', 'Payment method is POS_TERMINAL');

  // 6. fulfillOrder
  order = OrderDomainService.fulfillOrder(order);
  assert(order.state === 'FULFILLED', 'fulfillOrder transitions order to FULFILLED state');
  assert(!!order.fulfilledAt, 'fulfilledAt timestamp is recorded');

  // 7. voidOrder
  const draftForVoid = OrderDomainService.createDraft({
    tenantId: 'tenant_100hich',
  });
  const voided = OrderDomainService.voidOrder(draftForVoid, 'انصراف مشتری از خرید');
  assert(voided.state === 'VOIDED', 'voidOrder transitions order to VOIDED state');
  assert(voided.voidReason === 'انصراف مشتری از خرید', 'voidReason is preserved');
}

// TEST SUITE 11: Offline Order Sync & Inventory Overdraft Conflict Handling
console.log('\n[Suite 11: Offline Order Sync & Inventory Overdraft]');
{
  const {
    processOfflineOrderSync,
    InMemoryDatabaseClient,
  } = await import('../src/services/sync-order-handler');

  const db = new InMemoryDatabaseClient([
    { productId: 'prod-beans-ethiopia', availableQuantity: 5 },
    { productId: 'prod-milk-oat', availableQuantity: 1 },
  ]);

  const payloadNormal: any = {
    tenantId: 'tenant_100hich',
    clientGeneratedId: 'sync-uuid-1111',
    source: 'POS',
    order: {
      items: [{ productId: 'prod-beans-ethiopia', quantity: 2, name: 'دانه اتیوپی' }],
      totalNet: 190000,
      payments: [{ method: 'POS_TERMINAL', amount: 190000, referenceNumber: 'REF-111' }],
      createdAt: new Date().toISOString(),
    },
  };

  // 1. First sync with sufficient stock
  const res1 = await processOfflineOrderSync(db, payloadNormal);
  assert(res1.status === 'SYNCED_SUCCESSFULLY', 'First sync succeeds without conflict');
  assert(res1.hasInventoryConflicts === false, 'hasInventoryConflicts is false when stock is sufficient');
  assert(db.getStock('prod-beans-ethiopia') === 3, 'Inventory was decremented from 5 to 3');

  // 2. Idempotency on repeated sync
  const res2 = await processOfflineOrderSync(db, payloadNormal);
  assert(res2.status === 'ALREADY_SYNCED', 'Subsequent sync returns ALREADY_SYNCED');
  assert(db.getStock('prod-beans-ethiopia') === 3, 'Idempotent replay does not double-decrement stock');

  // 3. Stockout overdraft (Conflict Detection with allowNegative: true)
  const payloadOverdraft: any = {
    tenantId: 'tenant_100hich',
    clientGeneratedId: 'sync-uuid-2222',
    source: 'POS',
    order: {
      items: [{ productId: 'prod-milk-oat', quantity: 4, name: 'شیر جو دوسر' }], // Available is 1, requested is 4 -> deficit 3
      totalNet: 100000,
      payments: [{ method: 'POS_TERMINAL', amount: 100000, referenceNumber: 'REF-222' }],
      createdAt: new Date().toISOString(),
    },
  };

  const res3 = await processOfflineOrderSync(db, payloadOverdraft);
  assert(res3.status === 'SYNCED_SUCCESSFULLY', 'Offline order sync still succeeds financially during stock shortage');
  assert(res3.hasInventoryConflicts === true, 'Flags inventory conflict');
  assert(res3.conflicts?.length === 1, 'Records exactly 1 inventory overdraft incident');
  assert(res3.conflicts![0].type === 'STOCKOUT_OVERDRAFT', 'Incident type is STOCKOUT_OVERDRAFT');
  assert(res3.conflicts![0].details.deficit === 3, 'Recorded deficit is 3 (requested 4 - available 1)');
  assert(db.getStock('prod-milk-oat') === -3, 'Inventory is allowed to be negative (-3) to reflect physical reality');
}

// TEST SUITE 12: StockAlert Severity & Inventory Alert Banner Rules
console.log('\n[Suite 12: StockAlert Severity & Banner Rules]');
{
  const { evaluateStockStatus } = await import('../src/services/financialMath');

  // Critical alert rule: stock <= 0
  const zeroStock = evaluateStockStatus(0, 5, 5);
  assert(zeroStock.status === 'OUT_OF_STOCK', '0 stock is OUT_OF_STOCK');
  const severityZero = zeroStock.status === 'OUT_OF_STOCK' ? 'CRITICAL' : 'WARNING';
  assert(severityZero === 'CRITICAL', '0 stock produces CRITICAL banner severity');

  // Warning alert rule: 0 < stock <= threshold
  const lowStock = evaluateStockStatus(3, 5, 5);
  assert(lowStock.status === 'LOW', 'Stock of 3 is LOW with threshold 5');
  const severityLow = lowStock.status === 'OUT_OF_STOCK' ? 'CRITICAL' : 'WARNING';
  assert(severityLow === 'WARNING', 'Sub-threshold stock produces WARNING banner severity');

  // Healthy stock: stock > threshold -> no alert
  const healthyStock = evaluateStockStatus(15, 5, 5);
  assert(healthyStock.status === 'OK', 'Stock of 15 is OK with threshold 5');
  assert(!healthyStock.isLowStock && !healthyStock.isOutOfStock, 'Healthy item does not generate banner alert');
}

// TEST SUITE 13: Sync Controller & Real-Time WebSocket Multi-Tenant Broadcasts
console.log('\n[Suite 13: Sync Controller & WebSocket Broadcasts]');
{
  const { websocketServer } = await import('../src/services/websocket-server');
  const { handleOrderSync, db } = await import('../src/services/sync-controller');

  // 1. broadcastToTenant & 2. broadcastToRole
  const flags = { tenantMsgReceived: false, managerMsgReceived: false };
  const unsubTenant = websocketServer.subscribe((msg) => {
    if (msg.event === 'INVENTORY_STOCKOUT_ALERT' && msg.tenantId === 'tenant_100hich') {
      flags.tenantMsgReceived = true;
    }
  });

  const unsubRole = websocketServer.subscribe((msg) => {
    if (msg.event === 'AUDIT_DISCREPANCY_CREATED' && msg.role === 'MANAGER') {
      flags.managerMsgReceived = true;
    }
  });

  // Ensure stock is 0 for testing overdraft
  (db as any).setStock('prod-v60-limited', 0);

  // Mock Request & Response
  let responseStatus = 0;
  let responseData: any = null;

  const mockReq: any = {
    headers: { 'x-tenant-id': 'tenant_100hich' },
    body: {
      clientGeneratedId: 'test-ctrl-uuid-9999',
      source: 'POS',
      order: {
        items: [{ productId: 'prod-v60-limited', quantity: 2, name: 'قهوه V60 محدود' }],
        totalNet: 145000,
        payments: [{ method: 'POS_TERMINAL', amount: 145000 }],
        createdAt: new Date().toISOString(),
      },
    },
  };

  const mockRes: any = {
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
  };

  await handleOrderSync(mockReq, mockRes);

  assert(responseStatus === 200, 'handleOrderSync returns HTTP 200');
  assert(responseData?.success === true, 'Response JSON includes success: true');
  assert(responseData?.warnings?.length === 1, 'Response includes overdraft warning');
  assert(flags.tenantMsgReceived === true, 'Websocket broadcasts INVENTORY_STOCKOUT_ALERT to tenant');
  assert(flags.managerMsgReceived === true, 'Websocket broadcasts AUDIT_DISCREPANCY_CREATED to MANAGER');

  unsubTenant();
  unsubRole();
}

// TEST SUITE 14: Shift Profit Summary (Net Order Revenue - Total Expenses)
console.log('\n[Suite 14: Shift Profit Summary Invariants]');
{
  // 1. Standard profitable shift: Net revenue 450,000 - Expenses 120,000 = Profit 330,000
  const p1 = calculateShiftProfit(450000, 120000);
  assert(p1.profitToman === 330000, 'Profit equals net revenue minus total expenses (450k - 120k = 330k)');
  assert(p1.isProfitable === true, 'isProfitable is true when revenue exceeds expenses');
  assert(p1.profitMarginPercent === 73, `Profit margin is 73% (330k / 450k), got ${p1.profitMarginPercent}%`);

  // 2. Break-even shift: Net revenue 200,000 - Expenses 200,000 = Profit 0
  const p2 = calculateShiftProfit(200000, 200000);
  assert(p2.profitToman === 0, 'Break-even profit equals exactly 0');
  assert(p2.isProfitable === true, 'Break-even is considered profitable (non-negative)');
  assert(p2.profitMarginPercent === 0, 'Break-even margin is 0%');

  // 3. Loss-making shift: Net revenue 100,000 - Expenses 180,000 = Loss -80,000
  const p3 = calculateShiftProfit(100000, 180000);
  assert(p3.profitToman === -80000, 'Operating loss reflects negative profit (-80k)');
  assert(p3.isProfitable === false, 'isProfitable is false when expenses exceed revenue');
  assert(p3.profitMarginPercent === -80, 'Margin reflects -80% loss');

  // 4. Zero revenue with expenses: Net revenue 0 - Expenses 50,000 = Loss -50,000
  const p4 = calculateShiftProfit(0, 50000);
  assert(p4.profitToman === -50000, 'Zero revenue with expenses yields exact negative expenses');
  assert(p4.profitMarginPercent === 0, 'Zero revenue safely defaults margin to 0% without division by zero');

  // 5. Zero revenue and zero expenses
  const p5 = calculateShiftProfit(0, 0);
  assert(p5.profitToman === 0, 'Zero revenue and zero expenses yields 0 profit');
  assert(p5.isProfitable === true, 'Zero net shift is non-negative');
}

console.log(`\n========================================`);
console.log(`Test Execution Summary: ${passedTests} Passed, ${failedTests} Failed`);
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
