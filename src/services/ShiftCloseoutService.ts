/**
 * CAFE OS — Shift Closeout & Z-Report Service (v2.5.0)
 * Compliant with CafeOS-Shift-ZReport-InventoryInward
 * 
 * Features:
 *  - Calculates comprehensive Z-Report financial ledger & cash drawer discrepancy
 *  - Aggregates real-time material depletions (coffee beans, milk, syrups) via BOM engine
 *  - Generates official ESC/POS binary ticket with Double Strike [0x1B, 0x47, 0x01]
 *  - Stores Z-Report records in IndexedDB (zReports)
 */

import { SmartOrdersStore } from './storage';
import { inventoryBomService } from './inventoryBomService';
import { db, getCafeDatabase } from '../db/cafeDb';
import { Shift } from '../types/domain';
import {
  ZReportData,
  MaterialDepletionItem,
} from '../types/zreport-inventory';
import { EscPosGenerator, PrinterHardwareDispatcher } from './escposGenerator';
import { audioFeedback } from './audioFeedback';
import { formatToman } from './financialMath';

export class ShiftCloseoutService {
  /**
   * Calculates comprehensive Z-Report metrics for an active or closed shift
   */
  public static async calculateZReport(
    shiftId: string,
    countedCashFloat: number,
    options?: {
      closedBy?: string;
      discrepancyReason?: string;
      notes?: string;
      tenantId?: string;
    }
  ): Promise<ZReportData> {
    const tId = options?.tenantId || SmartOrdersStore.getActiveTenantId();
    const shifts = SmartOrdersStore.getShifts();
    const shift = shifts.find((s) => s.id === shiftId) || SmartOrdersStore.getActiveShift();

    if (!shift) {
      throw new Error(`شیفت کاری با شناسه ${shiftId} یافت نشد.`);
    }

    const allOrders = SmartOrdersStore.getOrders();
    const allPayments = SmartOrdersStore.getPayments();
    const allExpenses = SmartOrdersStore.getExpenses();

    // 1. Orders in this shift (Completed orders only)
    const shiftOrders = allOrders.filter(
      (o) => o.shiftId === shift.id && o.status === 'COMPLETED'
    );

    // 2. Payments in this shift
    const shiftPayments = allPayments.filter(
      (p) => p.shiftId === shift.id && p.status === 'SUCCESSFUL'
    );

    let posCardTotal = 0;
    let cashTotal = 0;

    for (const p of shiftPayments) {
      if (p.paymentMethod === 'CARD_MANUAL') {
        posCardTotal += p.amountToman;
      } else if (p.paymentMethod === 'CASH') {
        cashTotal += p.amountToman;
      } else {
        // Fallback: Card/Terminal
        posCardTotal += p.amountToman;
      }
    }

    // 3. Expenses in this shift
    const shiftExpenses = allExpenses.filter((e) => e.shiftId === shift.id);
    const totalExpenses = shiftExpenses.reduce((sum, e) => sum + e.amountToman, 0);
    const cashExpenses = shiftExpenses
      .filter((e) => e.isPaidFromCashDrawer)
      .reduce((sum, e) => sum + e.amountToman, 0);

    // 4. Sales metrics
    const grossSales = shiftOrders.reduce((sum, o) => sum + (o.grossAmountToman || o.netTotalToman || 0), 0);
    const discountsTotal = shiftOrders.reduce((sum, o) => sum + (o.discountAmountToman || 0), 0);
    const netSales = shiftOrders.reduce((sum, o) => sum + (o.netTotalToman || 0), 0);

    // Standard VAT calculation (9% VAT standard in CafeOS fiscal settings)
    const vatTotal = Math.round((netSales * 9) / 109);

    // 5. Cash drawer reconciliation
    const openingCash = shift.openingCashToman || 0;
    const expectedCash = openingCash + cashTotal - cashExpenses;
    const discrepancy = countedCashFloat - expectedCash;
    const isShortage = discrepancy < 0;
    const isOverage = discrepancy > 0;
    const isBalanced = discrepancy === 0;

    // 6. Material Depletions (Beans, Milk, Syrups consumption)
    const depletionMap = new Map<string, number>();

    for (const order of shiftOrders) {
      for (const item of order.items) {
        const consumed = inventoryBomService.calculateItemConsumption(
          item.menuItemId,
          item.quantity,
          (item.modifiers || []).map((m) => ({ nameFa: m.nameFa, title: m.nameFa })),
          item.itemNameSnapshot,
          tId
        );

        consumed.forEach((qty, ingId) => {
          const current = depletionMap.get(ingId) || 0;
          depletionMap.set(ingId, current + qty);
        });
      }
    }

    const materialDepletions: MaterialDepletionItem[] = [];
    depletionMap.forEach((qty, ingId) => {
      const ing = inventoryBomService.getIngredientById(ingId, tId);
      const roundedQty = inventoryBomService.roundTo3Decimals(qty);
      const unitCost = ing?.cost_per_unit || 0;

      materialDepletions.push({
        item_id: ingId,
        name: ing ? ing.title_fa : ingId,
        consumed_qty: roundedQty,
        unit: ing ? ing.unit : 'واحد',
        total_cost_toman: Math.round(roundedQty * unitCost),
      });
    });

    // Sort: Coffee beans first, then milk, then syrups
    materialDepletions.sort((a, b) => {
      if (a.unit === 'g' && b.unit !== 'g') return -1;
      if (a.unit !== 'g' && b.unit === 'g') return 1;
      return b.consumed_qty - a.consumed_qty;
    });

    const nowIso = new Date().toISOString();
    const closedBy = options?.closedBy || shift.closedByUserName || 'اپراتور شیفت';

    const zReport: ZReportData = {
      id: `zrep-${shift.id}-${Date.now()}`,
      shift_id: shift.id,
      opened_at: shift.openedAt,
      closed_at: nowIso,
      opened_by: shift.openedByUserName,
      closed_by: closedBy,
      opening_cash: openingCash,
      counted_cash_float: countedCashFloat,
      expected_cash: expectedCash,
      discrepancy,
      is_shortage: isShortage,
      is_overage: isOverage,
      is_balanced: isBalanced,
      discrepancy_reason: options?.discrepancyReason,
      notes: options?.notes,
      gross_sales: grossSales,
      discounts_total: discountsTotal,
      net_sales: netSales,
      vat_total: vatTotal,
      expenses_total: totalExpenses,
      expenses_cash_drawer: cashExpenses,
      order_count: shiftOrders.length,
      payment_methods: {
        pos_card: posCardTotal,
        cash: cashTotal,
      },
      material_depletions: materialDepletions,
      timestamp: nowIso,
    };

    // Persist to IndexedDB
    try {
      const targetDb = tId ? getCafeDatabase(tId) : db;
      await targetDb.zReports.put(zReport);
    } catch (err) {
      console.warn('[ShiftCloseoutService] Failed to persist Z-Report in IndexedDB:', err);
    }

    return zReport;
  }

  /**
   * Generates ESC/POS Binary Stream + Double Strike for Thermal Z-Report Receipt
   */
  public static async printZReportTicket(
    zReport: ZReportData,
    printerTarget: 'CASHIER_RECEIPT' | 'BAR_KDS' = 'CASHIER_RECEIPT'
  ): Promise<{
    success: boolean;
    bytes: Uint8Array;
    hexDump: string;
    textPreview: string;
    message: string;
  }> {
    audioFeedback.playPrinterChirp();

    const charWidth = 42;
    const ruleLine = '-'.repeat(charWidth);
    const doubleRule = '='.repeat(charWidth);

    const openDate = new Date(zReport.opened_at).toLocaleDateString('fa-IR');
    const openTime = new Date(zReport.opened_at).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const closeDate = new Date(zReport.closed_at).toLocaleDateString('fa-IR');
    const closeTime = new Date(zReport.closed_at).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const formatCols = (left: string, right: string) => {
      const space = Math.max(1, charWidth - (left.length + right.length));
      return left + ' '.repeat(space) + right;
    };

    const textLines: string[] = [
      '*** 100 HICH SPECIALTY COFFEE ***',
      '*** OFFICIAL SHIFT Z-REPORT ***',
      'صورت‌جلسه تسویه حساب و پایان شیفت کاری',
      doubleRule,
      formatCols(`SHIFT ID: #${zReport.shift_id.slice(-6)}`, `ORDERS: ${zReport.order_count}`),
      formatCols(`OPENED:  ${openDate} ${openTime}`, `BY: ${zReport.opened_by}`),
      formatCols(`CLOSED:  ${closeDate} ${closeTime}`, `BY: ${zReport.closed_by}`),
      ruleLine,
      'خلاصه عملکرد فروش و درآمد (FINANCIAL REVENUE):',
      formatCols('فروش ناخالص (Gross Sales):', `${formatToman(zReport.gross_sales)} ت`),
      formatCols('مجموع تخفیف‌ها (Discounts):', `${formatToman(zReport.discounts_total)} ت`),
      formatCols('فروش خالص (Net Sales):', `${formatToman(zReport.net_sales)} ت`),
      formatCols('مالیات بر ارزش افزوده (VAT 9%):', `${formatToman(zReport.vat_total)} ت`),
      ruleLine,
      'تفکیک درگاه‌های دریافتی (PAYMENT CHANNELS):',
      formatCols('کارتخوان متصل (POS Terminal):', `${formatToman(zReport.payment_methods.pos_card)} ت`),
      formatCols('نقد دریافتی صندوق (Cash In):', `${formatToman(zReport.payment_methods.cash)} ت`),
      formatCols('هزینه‌های تنخواه نقدی:', `${formatToman(zReport.expenses_cash_drawer)} ت`),
      ruleLine,
      'مغایرت‌سنجی صندوق فیزیکی (CASH RECONCILIATION):',
      formatCols('موجودی اولیه صندوق:', `${formatToman(zReport.opening_cash)} ت`),
      formatCols('موجودی سیستمی مورد انتظار:', `${formatToman(zReport.expected_cash)} ت`),
      formatCols('موجودی فیزیکی شمارش‌شده:', `${formatToman(zReport.counted_cash_float)} ت`),
      formatCols(
        'وضعیت نهایی مغایرت:',
        zReport.is_balanced
          ? '✓ صندوق کاملاً تراز است (۰ ت)'
          : zReport.is_shortage
          ? `✗ کسری صندوق: ${formatToman(Math.abs(zReport.discrepancy))} ت`
          : `+ مازاد صندوق: ${formatToman(zReport.discrepancy)} ت`
      ),
    ];

    if (zReport.discrepancy_reason) {
      textLines.push(`علت مغایرت: ${zReport.discrepancy_reason}`);
    }

    // Material Depletions
    textLines.push(doubleRule);
    textLines.push('گزارش مصرف دانه‌ها و مواد اولیه (BOM DEPLETIONS):');

    if (zReport.material_depletions.length === 0) {
      textLines.push('هیچ مصرف ماده اولیه‌ای در این شیفت ثبت نشده است.');
    } else {
      for (const mat of zReport.material_depletions) {
        const unitFa = mat.unit === 'g' ? 'گرم' : mat.unit === 'ml' ? 'میلی‌لیتر' : mat.unit;
        textLines.push(
          formatCols(
            mat.name,
            `${mat.consumed_qty.toLocaleString('fa-IR')} ${unitFa}`
          )
        );
      }
    }

    textLines.push(doubleRule);
    textLines.push('امضای تحویل‌گیرنده شیفت: _________________');
    textLines.push('امضای سرپرست / مدیر:   _________________');
    textLines.push('Zero-Cloud Latency Thermal Node - CafeOS');

    const textPreview = textLines.join('\n');

    // Build ESC/POS Byte Chunks
    const byteChunks: number[] = [];

    // 1. ESC @ (Initialize) -> [0x1B, 0x40]
    byteChunks.push(0x1b, 0x40);

    // 2. ESC G 1 (Double Strike On) -> [0x1B, 0x47, 0x01]
    byteChunks.push(0x1b, 0x47, 0x01);

    // 3. ESC E 1 (Emphasized / Bold On) -> [0x1B, 0x45, 0x01]
    byteChunks.push(0x1b, 0x45, 0x01);

    // 4. Center Alignment -> [0x1B, 0x61, 0x01]
    byteChunks.push(0x1b, 0x61, 0x01);

    // Double Size Title Header -> [0x1D, 0x21, 0x11]
    byteChunks.push(0x1d, 0x21, 0x11);
    this.appendAscii(byteChunks, '*** 100 HICH ***\n');
    this.appendAscii(byteChunks, 'Z-REPORT CLOSEOUT\n\n');

    // Normal text size -> [0x1D, 0x21, 0x00]
    byteChunks.push(0x1d, 0x21, 0x00);
    this.appendAscii(byteChunks, 'COFFEE ROASTERS - SHIFT AUDIT\n');

    // 5. Left Align -> [0x1B, 0x61, 0x00]
    byteChunks.push(0x1b, 0x61, 0x00);
    this.appendAscii(byteChunks, doubleRule + '\n');
    this.appendAscii(byteChunks, `SHIFT ID: #${zReport.shift_id.slice(-6)}\n`);
    this.appendAscii(byteChunks, `ORDERS:   ${zReport.order_count}\n`);
    this.appendAscii(byteChunks, `OPEN:     ${openDate} ${openTime}\n`);
    this.appendAscii(byteChunks, `CLOSE:    ${closeDate} ${closeTime}\n`);
    this.appendAscii(byteChunks, `OPERATOR: ${zReport.closed_by}\n`);
    this.appendAscii(byteChunks, ruleLine + '\n');

    this.appendAscii(byteChunks, `GROSS:    ${zReport.gross_sales.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, `DISCOUNT: ${zReport.discounts_total.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, `NET REV:  ${zReport.net_sales.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, `VAT 9%:   ${zReport.vat_total.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, ruleLine + '\n');

    this.appendAscii(byteChunks, `POS CARD: ${zReport.payment_methods.pos_card.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, `CASH IN:  ${zReport.payment_methods.cash.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, `EXPENSES: ${zReport.expenses_cash_drawer.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, ruleLine + '\n');

    this.appendAscii(byteChunks, `EXPECTED: ${zReport.expected_cash.toLocaleString()} Toman\n`);
    this.appendAscii(byteChunks, `COUNTED:  ${zReport.counted_cash_float.toLocaleString()} Toman\n`);
    this.appendAscii(
      byteChunks,
      `STATUS:   ${
        zReport.is_balanced
          ? 'BALANCED (0)'
          : zReport.is_shortage
          ? `SHORTAGE (-${Math.abs(zReport.discrepancy).toLocaleString()})`
          : `OVERAGE (+${zReport.discrepancy.toLocaleString()})`
      }\n`
    );
    this.appendAscii(byteChunks, doubleRule + '\n');

    this.appendAscii(byteChunks, 'RAW MATERIALS & BEANS DEPLETED:\n');
    for (const mat of zReport.material_depletions) {
      this.appendAscii(byteChunks, `- ${mat.name}: ${mat.consumed_qty} ${mat.unit}\n`);
    }
    this.appendAscii(byteChunks, doubleRule + '\n');

    // Double strike off & bold off
    byteChunks.push(0x1b, 0x47, 0x00);
    byteChunks.push(0x1b, 0x45, 0x00);

    // Center alignment for footer
    byteChunks.push(0x1b, 0x61, 0x01);
    this.appendAscii(byteChunks, 'SIGNATURE: ____________________\n');
    this.appendAscii(byteChunks, 'End of Official Z-Report\n');
    this.appendAscii(byteChunks, '\n\n\n\n\n');

    // 6. Cut Paper -> [0x1D, 0x56, 0x00]
    byteChunks.push(0x1d, 0x56, 0x00);

    const uint8Bytes = new Uint8Array(byteChunks);
    const hexDump = Array.from(uint8Bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    return {
      success: true,
      bytes: uint8Bytes,
      hexDump,
      textPreview,
      message: 'گزارش پایان شیفت (Z-Report) با فرمت باینری ESC/POS آماده چاپ گردید.',
    };
  }

  private static appendAscii(target: number[], str: string) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      target.push(code < 128 ? code : 0x3f);
    }
  }

  /**
   * Idempotently close a shift.
   * If the shift is already CLOSED:
   *   - Returns existing closed shift and existing ZReport if found.
   *   - Guarantees isAlreadyClosed: true without altering historical records or duplicating logs.
   * If the shift is OPEN:
   *   - Calculates ZReport, marks shift CLOSED in SmartOrdersStore, persists ZReport, and returns isAlreadyClosed: false.
   */
  public static async closeShiftIdempotent(
    shiftId: string,
    countedCashFloat: number,
    options?: {
      closedBy?: string;
      discrepancyReason?: string;
      notes?: string;
      tenantId?: string;
    }
  ): Promise<{
    shift: Shift;
    zReport: ZReportData;
    isAlreadyClosed: boolean;
  }> {
    const shifts = SmartOrdersStore.getShifts();
    const shift = shifts.find((s) => s.id === shiftId);

    if (!shift) {
      throw new Error(`شیفت کاری با شناسه ${shiftId} یافت نشد.`);
    }

    const tId = options?.tenantId || shift.tenantId;
    const targetDb = tId ? getCafeDatabase(tId) : db;

    if (shift.status === 'CLOSED') {
      let existingZReport: ZReportData | undefined;
      try {
        existingZReport = await targetDb.zReports.where('shift_id').equals(shift.id).first();
      } catch {
        // Fallback if IndexedDB search fails
      }

      if (!existingZReport) {
        existingZReport = await this.calculateZReport(shift.id, shift.actualCountedCashToman || countedCashFloat, {
          ...options,
          tenantId: tId,
        });
      }

      return {
        shift,
        zReport: existingZReport,
        isAlreadyClosed: true,
      };
    }

    // Shift is OPEN -> calculate report and close shift
    const zReport = await this.calculateZReport(shift.id, countedCashFloat, {
      ...options,
      tenantId: tId,
    });

    const updatedShift = SmartOrdersStore.closeShift(
      shift.id,
      countedCashFloat,
      zReport.expected_cash,
      options?.discrepancyReason,
      options?.notes
    );

    return {
      shift: updatedShift,
      zReport,
      isAlreadyClosed: false,
    };
  }

  /**
   * Aggregate daily financial summary for a given tenant and date
   * Strictly respects tenant isolation and integer Toman calculations
   * Preserves frozen VAT calculation Math.round((netSales * 9) / 109)
   */
  public static async getDailyFinancialSummary(
    tenantId?: string,
    dateStr?: string
  ): Promise<{
    date: string;
    tenantId: string;
    totalGrossSales: number;
    totalNetSales: number;
    totalVat: number;
    totalDiscounts: number;
    totalExpenses: number;
    cashTotal: number;
    posCardTotal: number;
    shiftCount: number;
    orderCount: number;
  }> {
    const tId = tenantId || SmartOrdersStore.getActiveTenantId();
    const targetDate = dateStr ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10);

    const allOrders = SmartOrdersStore.getOrders();
    const allShifts = SmartOrdersStore.getShifts();
    const allPayments = SmartOrdersStore.getPayments();
    const allExpenses = SmartOrdersStore.getExpenses();

    // Filter by tenant and date
    const dayOrders = allOrders.filter((o) => {
      const matchTenant = !o.tenantId || o.tenantId === tId;
      const matchDate = (o.createdAt || '').slice(0, 10) === targetDate;
      const isCompleted = o.status === 'COMPLETED';
      return matchTenant && matchDate && isCompleted;
    });

    const dayShifts = allShifts.filter((s) => {
      const matchTenant = !s.tenantId || s.tenantId === tId;
      const matchDate = (s.openedAt || '').slice(0, 10) === targetDate;
      return matchTenant && matchDate;
    });

    const dayPayments = allPayments.filter((p) => {
      const matchDate = (p.createdAt || '').slice(0, 10) === targetDate;
      const isSuccess = p.status === 'SUCCESSFUL';
      return matchDate && isSuccess;
    });

    const dayExpenses = allExpenses.filter((e) => {
      const matchDate = (e.createdAt || '').slice(0, 10) === targetDate;
      return matchDate;
    });

    const totalGrossSales = dayOrders.reduce((sum, o) => sum + (o.grossAmountToman || o.netTotalToman || 0), 0);
    const totalDiscounts = dayOrders.reduce((sum, o) => sum + (o.discountAmountToman || 0), 0);
    const totalNetSales = dayOrders.reduce((sum, o) => sum + (o.netTotalToman || 0), 0);
    const totalVat = Math.round((totalNetSales * 9) / 109);
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amountToman, 0);

    let posCardTotal = 0;
    let cashTotal = 0;
    for (const p of dayPayments) {
      if (p.paymentMethod === 'CARD_MANUAL') {
        posCardTotal += p.amountToman;
      } else if (p.paymentMethod === 'CASH') {
        cashTotal += p.amountToman;
      } else {
        posCardTotal += p.amountToman;
      }
    }

    return {
      date: targetDate,
      tenantId: tId,
      totalGrossSales: Math.round(totalGrossSales),
      totalNetSales: Math.round(totalNetSales),
      totalVat,
      totalDiscounts: Math.round(totalDiscounts),
      totalExpenses: Math.round(totalExpenses),
      cashTotal: Math.round(cashTotal),
      posCardTotal: Math.round(posCardTotal),
      shiftCount: dayShifts.length,
      orderCount: dayOrders.length,
    };
  }
}
