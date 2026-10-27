/**
 * Financial Calculation Engine for SmartOrders
 * Enforces zero-floating-point calculations, exact integer arithmetic,
 * and strict separation between Revenue, Cash Inflow, Card Inflow, Expenses, and Cash Drawer Balances.
 */

import { Order, Payment, Expense, Shift, ShiftReportSummary } from '../types/domain';

/**
 * Format a Toman amount with Persian comma grouping
 * e.g., 145000 -> "۱۴۵,۰۰۰" or "145,000"
 */
export function formatToman(amount: number, usePersianDigits = true): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('en-US').format(rounded);
  if (!usePersianDigits) return formatted;
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return formatted.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

/**
 * Parse an integer amount safely
 */
export function safeInt(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const cleanStr = val.toString().replace(/[^\d-]/g, '');
  const parsed = parseInt(cleanStr, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate item subtotal
 */
export function calculateItemSubtotal(unitPriceToman: number, quantity: number): number {
  const cleanPrice = Math.max(0, Math.round(unitPriceToman));
  const cleanQty = Math.max(1, Math.round(quantity));
  return cleanPrice * cleanQty;
}

/**
 * Calculate order financial totals
 */
export function calculateOrderTotals(
  items: Array<{ unitPriceSnapshotToman: number; quantity: number }>,
  discountToman: number = 0
): { grossAmountToman: number; discountAmountToman: number; netTotalToman: number } {
  const grossAmountToman = items.reduce(
    (sum, item) => sum + calculateItemSubtotal(item.unitPriceSnapshotToman, item.quantity),
    0
  );

  const cleanDiscount = Math.max(0, Math.min(grossAmountToman, Math.round(discountToman)));
  const netTotalToman = grossAmountToman - cleanDiscount;

  return {
    grossAmountToman,
    discountAmountToman: cleanDiscount,
    netTotalToman,
  };
}

/**
 * Calculate expected cash in drawer for a shift
 * Expected = Opening Cash + Cash Received from Orders - Cash Drawer Expenses
 */
export function calculateExpectedCash(
  openingCashToman: number,
  cashReceivedToman: number,
  cashDrawerExpensesToman: number
): number {
  const openCash = Math.round(openingCashToman);
  const cashIn = Math.round(cashReceivedToman);
  const cashOut = Math.round(cashDrawerExpensesToman);
  return openCash + cashIn - cashOut;
}

/**
 * Calculate cash discrepancy
 * Discrepancy = Actual Counted Cash - Expected Cash
 * (Negative = Shortage/کسری, Positive = Overage/مازاد, 0 = Balanced)
 */
export function calculateCashDiscrepancy(
  actualCountedCashToman: number,
  expectedCashToman: number
): {
  discrepancyToman: number;
  isShortage: boolean;
  isOverage: boolean;
  isBalanced: boolean;
} {
  const actual = Math.round(actualCountedCashToman);
  const expected = Math.round(expectedCashToman);
  const diff = actual - expected;

  return {
    discrepancyToman: diff,
    isShortage: diff < 0,
    isOverage: diff > 0,
    isBalanced: diff === 0,
  };
}

/**
 * Generate comprehensive Shift and Daily Report Summary
 * Clearly distinguishes Revenue, Collected Payments, Expenses, and Cash Drawer Reconciliation.
 */
export function compileShiftReport(
  shift: Shift,
  orders: Order[],
  payments: Payment[],
  expenses: Expense[]
): ShiftReportSummary {
  const shiftOrders = orders.filter((o) => o.shiftId === shift.id);
  const completedOrders = shiftOrders.filter((o) => o.status === 'COMPLETED');
  const cancelledOrders = shiftOrders.filter((o) => o.status === 'CANCELLED');

  // Revenue calculation from completed orders
  const grossSalesToman = completedOrders.reduce((sum, o) => sum + o.grossAmountToman, 0);
  const discountsToman = completedOrders.reduce((sum, o) => sum + o.discountAmountToman, 0);
  const netRevenueToman = grossSalesToman - discountsToman;

  // Payments received for this shift
  const shiftPayments = payments.filter((p) => p.shiftId === shift.id && p.status === 'SUCCESSFUL');
  const cashReceivedToman = shiftPayments
    .filter((p) => p.paymentMethod === 'CASH')
    .reduce((sum, p) => sum + p.amountToman, 0);
  const cardReceivedToman = shiftPayments
    .filter((p) => p.paymentMethod === 'CARD_MANUAL')
    .reduce((sum, p) => sum + p.amountToman, 0);
  const otherReceivedToman = shiftPayments
    .filter((p) => p.paymentMethod === 'OTHER')
    .reduce((sum, p) => sum + p.amountToman, 0);
  const totalCollectedToman = cashReceivedToman + cardReceivedToman + otherReceivedToman;

  // Expenses recorded in this shift
  const shiftExpenses = expenses.filter((e) => e.shiftId === shift.id);
  const cashDrawerExpensesToman = shiftExpenses
    .filter((e) => e.isPaidFromCashDrawer)
    .reduce((sum, e) => sum + e.amountToman, 0);
  const otherExpensesToman = shiftExpenses
    .filter((e) => !e.isPaidFromCashDrawer)
    .reduce((sum, e) => sum + e.amountToman, 0);
  const totalExpensesToman = cashDrawerExpensesToman + otherExpensesToman;

  // Cash drawer formula
  const expectedCashToman = calculateExpectedCash(
    shift.openingCashToman,
    cashReceivedToman,
    cashDrawerExpensesToman
  );

  const actualCashToman = shift.actualCountedCashToman;
  const discrepancyToman =
    actualCashToman !== undefined ? actualCashToman - expectedCashToman : undefined;

  return {
    shiftId: shift.id,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    status: shift.status,
    openedBy: shift.openedByUserName,
    closedBy: shift.closedByUserName,
    orderCount: shiftOrders.length,
    completedOrderCount: completedOrders.length,
    cancelledOrderCount: cancelledOrders.length,
    grossSalesToman,
    discountsToman,
    netRevenueToman,
    cashReceivedToman,
    cardReceivedToman,
    otherReceivedToman,
    totalCollectedToman,
    cashDrawerExpensesToman,
    otherExpensesToman,
    totalExpensesToman,
    openingCashToman: shift.openingCashToman,
    expectedCashToman,
    actualCashToman,
    discrepancyToman,
    discrepancyReason: shift.discrepancyReason,
  };
}

/**
 * Calculates operational profit for a shift by subtracting total recorded expenses
 * from net order revenue. Strictly adheres to integer Toman invariants.
 */
export function calculateShiftProfit(
  netRevenueToman: number,
  totalExpensesToman: number
): {
  profitToman: number;
  isProfitable: boolean;
  profitMarginPercent: number;
} {
  const safeNet = Math.round(Number(netRevenueToman) || 0);
  const safeExp = Math.round(Number(totalExpensesToman) || 0);
  const profitToman = safeNet - safeExp;
  const isProfitable = profitToman >= 0;
  const profitMarginPercent = safeNet > 0
    ? Math.round((profitToman / safeNet) * 100)
    : 0;

  return {
    profitToman,
    isProfitable,
    profitMarginPercent,
  };
}

export interface DailyRevenueDataPoint {
  dateKey: string;
  dateLabel: string;
  fullDateFa: string;
  revenue: number;
  grossSales: number;
  discounts: number;
  orderCount: number;
}

export interface RevenueTrendsSummary {
  dataPoints: DailyRevenueDataPoint[];
  totalRevenueToman: number;
  averageDailyRevenueToman: number;
  peakDailyRevenueToman: number;
  peakDateLabel: string;
  totalCompletedOrders: number;
}

/**
 * Compute daily revenue trends for a continuous window of N days (default 30 days)
 * strictly aggregating COMPLETED orders and filling zero-revenue days.
 */
export function computeDailyRevenueTrends(
  orders: Order[],
  days: number = 30,
  referenceDate: Date = new Date()
): RevenueTrendsSummary {
  const dataPoints: DailyRevenueDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const target = new Date(referenceDate);
    target.setDate(target.getDate() - i);
    const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999).getTime();

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    const dateLabel = target.toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' });
    const fullDateFa = target.toLocaleDateString('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dayOrders = orders.filter((o) => {
      if (o.status !== 'COMPLETED') return false;
      const orderTime = new Date(o.createdAt).getTime();
      return orderTime >= startOfDay && orderTime <= endOfDay;
    });

    const revenue = dayOrders.reduce((sum, o) => sum + o.netTotalToman, 0);
    const grossSales = dayOrders.reduce((sum, o) => sum + o.grossAmountToman, 0);
    const discounts = dayOrders.reduce((sum, o) => sum + o.discountAmountToman, 0);

    dataPoints.push({
      dateKey,
      dateLabel,
      fullDateFa,
      revenue,
      grossSales,
      discounts,
      orderCount: dayOrders.length,
    });
  }

  const totalRevenueToman = dataPoints.reduce((sum, p) => sum + p.revenue, 0);
  const totalCompletedOrders = dataPoints.reduce((sum, p) => sum + p.orderCount, 0);
  const averageDailyRevenueToman = days > 0 ? Math.round(totalRevenueToman / days) : 0;

  let peakDailyRevenueToman = 0;
  let peakDateLabel = '-';
  for (const p of dataPoints) {
    if (p.revenue >= peakDailyRevenueToman) {
      peakDailyRevenueToman = p.revenue;
      peakDateLabel = p.dateLabel;
    }
  }

  return {
    dataPoints,
    totalRevenueToman,
    averageDailyRevenueToman,
    peakDailyRevenueToman,
    peakDateLabel,
    totalCompletedOrders,
  };
}

/**
 * Escapes a cell value conforming to RFC 4180 CSV standard.
 * Numbers remain unquoted so spreadsheet applications parse them as raw numeric values.
 * Strings are properly escaped and wrapped in double quotes.
 */
export function escapeCSVCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '""';
  }
  const str =
    typeof val === 'number'
      ? isNaN(val)
        ? '0'
        : Math.round(val).toString()
      : String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates an RFC 4180 compliant CSV string representing a list of orders.
 * Includes UTF-8 BOM (\uFEFF) to guarantee correct rendering of Persian (Farsi) text in Microsoft Excel.
 */
export function generateOrdersCSV(orders: Order[]): string {
  const BOM = '\uFEFF';

  const headers = [
    'شماره فاکتور',
    'تاریخ و زمان شمسی',
    'تاریخ و زمان میلادی',
    'نوع سفارش',
    'میز / مشتری',
    'وضعیت',
    'صندوق‌دار / ثبت‌کننده',
    'تعداد اقلام',
    'شرح اقلام سفارش',
    'مبلغ ناخالص (تومان)',
    'مبلغ تخفیف (تومان)',
    'مبلغ خالص پرداختی (تومان)',
    'علت لغو',
  ];

  const lines: string[] = [headers.map((h) => escapeCSVCell(h)).join(',')];

  for (const order of orders) {
    const totalItemsInOrder = (order.items || []).reduce(
      (sum, item) => sum + Math.max(0, Math.round(item.quantity)),
      0
    );

    const itemsSummary = (order.items || [])
      .map((i) => `${i.itemNameSnapshot} (${i.quantity} عدد)`)
      .join(' | ');

    let dateFa = '-';
    let timeFa = '-';
    try {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) {
        dateFa = d.toLocaleDateString('fa-IR');
        timeFa = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // fallback
    }
    const persianDateTime = `${dateFa} ${timeFa}`;

    const orderTypeFa =
      order.orderType === 'DINE_IN'
        ? 'سالن'
        : order.orderType === 'TAKEAWAY'
        ? 'بیرون‌بر'
        : order.orderType === 'DELIVERY'
        ? 'ارسال با پیک'
        : String(order.orderType || '-');

    const customerOrTable =
      order.orderType === 'DINE_IN'
        ? order.tableLabel || 'بدون مشخصات میز'
        : order.customerName
        ? `بیرون‌بر (${order.customerName})`
        : 'بیرون‌بر (عمومی)';

    const statusFa =
      order.status === 'COMPLETED'
        ? 'تکمیل شده (تسویه)'
        : order.status === 'CANCELLED'
        ? 'لغو شده'
        : order.status === 'PREPARING'
        ? 'در حال آماده‌سازی'
        : order.status === 'DRAFT'
        ? 'پیش‌نویس'
        : String(order.status || '-');

    const row = [
      escapeCSVCell(order.orderNumber),
      escapeCSVCell(persianDateTime),
      escapeCSVCell(order.createdAt),
      escapeCSVCell(orderTypeFa),
      escapeCSVCell(customerOrTable),
      escapeCSVCell(statusFa),
      escapeCSVCell(order.createdByUserName || 'نامشخص'),
      escapeCSVCell(totalItemsInOrder),
      escapeCSVCell(itemsSummary),
      escapeCSVCell(order.grossAmountToman),
      escapeCSVCell(order.discountAmountToman),
      escapeCSVCell(order.netTotalToman),
      escapeCSVCell(order.cancellationReason || ''),
    ];

    lines.push(row.join(','));
  }

  // Summary row at the bottom if orders exist
  if (orders.length > 0) {
    const totalItems = orders.reduce(
      (sum, o) => sum + (o.items || []).reduce((iSum, i) => iSum + i.quantity, 0),
      0
    );
    const sumGross = orders.reduce((sum, o) => sum + o.grossAmountToman, 0);
    const sumDiscount = orders.reduce((sum, o) => sum + o.discountAmountToman, 0);
    const sumNet = orders.reduce((sum, o) => sum + o.netTotalToman, 0);

    const summaryRow = [
      escapeCSVCell(`مجموع کل (${orders.length} فاکتور)`),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(totalItems),
      escapeCSVCell(''),
      escapeCSVCell(sumGross),
      escapeCSVCell(sumDiscount),
      escapeCSVCell(sumNet),
      escapeCSVCell(''),
    ];
    lines.push(summaryRow.join(','));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Triggers a browser file download of the orders CSV with proper filename and UTF-8 encoding.
 */
export function downloadOrdersCSV(orders: Order[], filename?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const csvContent = generateOrdersCSV(orders);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const safeFilename = filename || `smartorders-report-${dateStr}.csv`;
  link.setAttribute('download', safeFilename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Generates an RFC 4180 compliant CSV string representing a list of expenses.
 * Includes UTF-8 BOM (\uFEFF) to guarantee correct rendering of Persian (Farsi) text in Microsoft Excel.
 */
export function generateExpensesCSV(expenses: Expense[]): string {
  const BOM = '\uFEFF';

  const headers = [
    'ردیف',
    'شناسه ثبت',
    'تاریخ و زمان شمسی',
    'تاریخ و زمان میلادی',
    'دسته‌بندی هزینه',
    'شرح و جزئیات هزینه',
    'مبلغ هزینه (تومان)',
    'نحوه پرداخت',
    'کاربر ثبت‌کننده',
    'شناسه شیفت',
  ];

  const lines: string[] = [headers.map((h) => escapeCSVCell(h)).join(',')];

  for (let idx = 0; idx < expenses.length; idx++) {
    const expense = expenses[idx];

    let dateFa = '-';
    let timeFa = '-';
    try {
      const d = new Date(expense.createdAt);
      if (!isNaN(d.getTime())) {
        dateFa = d.toLocaleDateString('fa-IR');
        timeFa = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // fallback
    }
    const persianDateTime = `${dateFa} ${timeFa}`;

    const paymentSourceFa = expense.isPaidFromCashDrawer
      ? 'کسر از کشوی نقد (صندوق)'
      : 'پرداخت متفرقه / حساب بانکی';

    const row = [
      escapeCSVCell(idx + 1),
      escapeCSVCell(expense.id),
      escapeCSVCell(persianDateTime),
      escapeCSVCell(expense.createdAt),
      escapeCSVCell(expense.category || 'متفرقه'),
      escapeCSVCell(expense.description || ''),
      escapeCSVCell(expense.amountToman),
      escapeCSVCell(paymentSourceFa),
      escapeCSVCell(expense.recordedByUserName || 'نامشخص'),
      escapeCSVCell(expense.shiftId || '-'),
    ];

    lines.push(row.join(','));
  }

  // Summary row at the bottom if expenses exist
  if (expenses.length > 0) {
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amountToman || 0), 0);
    const cashDrawerAmount = expenses
      .filter((e) => e.isPaidFromCashDrawer)
      .reduce((sum, e) => sum + (e.amountToman || 0), 0);
    const nonCashAmount = expenses
      .filter((e) => !e.isPaidFromCashDrawer)
      .reduce((sum, e) => sum + (e.amountToman || 0), 0);

    const summaryRow = [
      escapeCSVCell(`مجموع کل (${expenses.length} ردیف)`),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(`نقدی: ${cashDrawerAmount} | غیرنقدی: ${nonCashAmount}`),
      escapeCSVCell(totalAmount),
      escapeCSVCell(''),
      escapeCSVCell(''),
      escapeCSVCell(''),
    ];
    lines.push(summaryRow.join(','));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Triggers a browser file download of the expenses CSV with proper filename and UTF-8 encoding.
 */
export function downloadExpensesCSV(expenses: Expense[], filename?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const csvContent = generateExpensesCSV(expenses);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const safeFilename = filename || `smartorders-expenses-${dateStr}.csv`;
  link.setAttribute('download', safeFilename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Stock Status categories for cafe inventory management
 */
export type StockStatus = 'OK' | 'LOW' | 'OUT_OF_STOCK';

export interface ItemStockAnalysis {
  status: StockStatus;
  isLowStock: boolean;
  isOutOfStock: boolean;
  effectiveThreshold: number;
  currentStock: number;
  deficit: number;
}

/**
 * Calculates effective threshold for an item: uses item's custom lowStockThreshold if set,
 * otherwise falls back to the configurable default threshold.
 */
export function getEffectiveThreshold(
  itemThreshold: number | undefined | null,
  defaultThreshold: number = 5
): number {
  if (itemThreshold !== undefined && itemThreshold !== null && !isNaN(itemThreshold) && itemThreshold >= 0) {
    return Math.round(itemThreshold);
  }
  return Math.max(0, Math.round(defaultThreshold));
}

/**
 * Evaluates stock level against configurable threshold.
 * - Out of Stock: currentStock === 0
 * - Low Stock: 0 < currentStock <= threshold
 * - Normal: currentStock > threshold
 */
export function evaluateStockStatus(
  currentStock: number | undefined | null,
  itemThreshold: number | undefined | null,
  defaultThreshold: number = 5
): ItemStockAnalysis {
  const stock = currentStock !== undefined && currentStock !== null && !isNaN(currentStock)
    ? Math.max(0, Math.round(currentStock))
    : 0;
  const effectiveThreshold = getEffectiveThreshold(itemThreshold, defaultThreshold);

  if (stock === 0) {
    return {
      status: 'OUT_OF_STOCK',
      isLowStock: true,
      isOutOfStock: true,
      effectiveThreshold,
      currentStock: stock,
      deficit: effectiveThreshold,
    };
  }

  if (stock <= effectiveThreshold) {
    return {
      status: 'LOW',
      isLowStock: true,
      isOutOfStock: false,
      effectiveThreshold,
      currentStock: stock,
      deficit: effectiveThreshold - stock,
    };
  }

  return {
    status: 'OK',
    isLowStock: false,
    isOutOfStock: false,
    effectiveThreshold,
    currentStock: stock,
    deficit: 0,
  };
}

/**
 * Summarizes inventory stock alert counts across a collection of menu items.
 */
export function countStockAlerts(
  items: Array<{ currentStock?: number; lowStockThreshold?: number }>,
  defaultThreshold: number = 5
): { totalLowStock: number; outOfStockCount: number; warningCount: number; healthyCount: number } {
  let totalLowStock = 0;
  let outOfStockCount = 0;
  let warningCount = 0;
  let healthyCount = 0;

  for (const item of items) {
    const analysis = evaluateStockStatus(item.currentStock, item.lowStockThreshold, defaultThreshold);
    if (analysis.status === 'OUT_OF_STOCK') {
      outOfStockCount++;
      totalLowStock++;
    } else if (analysis.status === 'LOW') {
      warningCount++;
      totalLowStock++;
    } else {
      healthyCount++;
    }
  }

  return { totalLowStock, outOfStockCount, warningCount, healthyCount };
}


