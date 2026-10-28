import { printThermalReceipt } from '../services/receiptPrinter';
import React from 'react';
import { Printer, X, Clock, Coffee, ShieldCheck, AlertTriangle, UserCheck } from 'lucide-react';
import { Shift, Tenant, Order, Payment, Expense, User } from '../types/domain';
import { formatToman, calculateExpectedCash, calculateCashDiscrepancy } from '../services/financialMath';

interface ShiftSummaryReceiptProps {
  shift: Shift;
  tenant?: Tenant;
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  actualCountedCashToman?: number;
  discrepancyReason?: string;
  notes?: string;
  activeUser: User;
  onClose: () => void;
}

export const ShiftSummaryReceipt: React.FC<ShiftSummaryReceiptProps> = ({
  shift,
  tenant = { id: 't1', name: 'کافه نارنج (Naranj Coffee)', currency: 'TOMAN', phone: '۰۲۱-۸۸۹۹۷۷۶۶', address: 'تهران، ولیعصر' },
  orders,
  payments,
  expenses,
  actualCountedCashToman,
  discrepancyReason,
  notes,
  activeUser,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  // Filter payments belonging to this shift
  const shiftPayments = payments.filter(
    (p) => p.shiftId === shift.id && p.status === 'SUCCESSFUL'
  );

  const cashReceived = shiftPayments
    .filter((p) => p.paymentMethod === 'CASH')
    .reduce((sum, p) => sum + p.amountToman, 0);

  const cardReceived = shiftPayments
    .filter((p) => p.paymentMethod === 'CARD_MANUAL')
    .reduce((sum, p) => sum + p.amountToman, 0);

  const otherReceived = shiftPayments
    .filter((p) => p.paymentMethod === 'OTHER')
    .reduce((sum, p) => sum + p.amountToman, 0);

  const totalCollected = cashReceived + cardReceived + otherReceived;

  // Filter expenses
  const shiftExpenses = expenses.filter((e) => e.shiftId === shift.id);
  const cashExpenses = shiftExpenses
    .filter((e) => e.isPaidFromCashDrawer)
    .reduce((sum, e) => sum + e.amountToman, 0);
  const otherExpenses = shiftExpenses
    .filter((e) => !e.isPaidFromCashDrawer)
    .reduce((sum, e) => sum + e.amountToman, 0);
  const totalExpenses = cashExpenses + otherExpenses;

  // Filter orders
  const shiftOrders = orders.filter((o) => o.shiftId === shift.id);
  const completedOrders = shiftOrders.filter((o) => o.status === 'COMPLETED');
  const cancelledOrders = shiftOrders.filter((o) => o.status === 'CANCELLED');
  const grossSales = completedOrders.reduce((sum, o) => sum + o.grossAmountToman, 0);
  const discounts = completedOrders.reduce((sum, o) => sum + o.discountAmountToman, 0);
  const netSales = completedOrders.reduce((sum, o) => sum + o.netTotalToman, 0);

  // Calculation of cash drawer
  const openingCash = shift.openingCashToman;
  const expectedCash = calculateExpectedCash(openingCash, cashReceived, cashExpenses);

  // If actual cash is provided via props (e.g. from closing input in modal) use that, otherwise use shift's stored count
  const effectiveActualCash =
    actualCountedCashToman !== undefined
      ? actualCountedCashToman
      : shift.actualCountedCashToman ?? expectedCash;

  const { discrepancyToman, isShortage, isOverage, isBalanced } = calculateCashDiscrepancy(
    effectiveActualCash,
    expectedCash
  );

  const effectiveReason = discrepancyReason || shift.discrepancyReason || '';
  const effectiveNotes = notes || shift.notes || '';

  const openedDate = new Date(shift.openedAt);
  const closedDate = shift.closedAt ? new Date(shift.closedAt) : new Date();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-4 shadow-2xl flex flex-col gap-3 print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:bg-white">
        
        {/* Modal Top Actions (Hidden in print) */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-800 print:hidden">
          <div className="flex items-center gap-2 text-stone-200 font-bold text-sm">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>پیش‌نمایش صورت‌جلسه تسویه شیفت</span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1 rounded-lg"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Printable Paper Sheet / Thermal Ticket */}
        <div
          id="printable-shift-summary"
          className="bg-white text-stone-900 p-5 rounded-2xl shadow-inner font-sans text-xs border border-stone-200 flex flex-col gap-2.5 print:rounded-none print:border-none print:p-2 print:shadow-none"
          style={{ width: '100%', maxWidth: '340px', margin: '0 auto' }}
        >
          {/* Header Brand */}
          <div className="text-center pb-2 border-b border-dashed border-stone-300">
            <div className="flex justify-center mb-1">
              <Coffee className="w-5 h-5 text-stone-900" />
            </div>
            <h2 className="font-extrabold text-base tracking-tight text-stone-900">{tenant.name}</h2>
            <div className="text-[11px] font-black mt-1 text-stone-800 bg-stone-100 py-1 rounded">
              صورت‌جلسه تسویه صندوق و پایان شیفت
            </div>
            {tenant.phone && (
              <p className="text-[10px] text-stone-600 mt-1 font-mono" dir="ltr">
                تلفن: {tenant.phone}
              </p>
            )}
          </div>

          {/* Shift Metadata */}
          <div className="flex flex-col gap-1 text-[11px] text-stone-700 pb-2 border-b border-stone-200">
            <div className="flex justify-between items-center">
              <span>شناسه شیفت:</span>
              <span className="font-mono text-[10px] text-stone-900 font-semibold">{shift.id.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between items-center">
              <span>اپراتور بازکننده:</span>
              <span className="font-semibold text-stone-900">{shift.openedByUserName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>زمان بازگشایی:</span>
              <span className="font-mono text-[10px]">
                {openedDate.toLocaleDateString('fa-IR')} - {openedDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>تسویه‌کننده / اپراتور فعلی:</span>
              <span className="font-semibold text-stone-900">{shift.closedByUserName || activeUser.fullName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>زمان ثبت تسویه:</span>
              <span className="font-mono text-[10px]">
                {closedDate.toLocaleDateString('fa-IR')} - {closedDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Shift Order Statistics */}
          <div className="flex flex-col gap-1 text-[11px] pb-2 border-b border-stone-200">
            <div className="text-[10px] font-bold text-stone-500">خلاصه آماری سفارشات:</div>
            <div className="flex justify-between">
              <span>تعداد کل سفارشات:</span>
              <span className="font-mono font-bold">{shiftOrders.length} فاکتور</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>سفارشات موفق / تسویه شده:</span>
              <span className="font-mono font-semibold text-emerald-800">{completedOrders.length} فاکتور</span>
            </div>
            {cancelledOrders.length > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>سفارشات ابطال شده:</span>
                <span className="font-mono font-semibold">{cancelledOrders.length} فاکتور</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-dotted border-stone-200">
              <span>فروش ناخالص (Gross):</span>
              <span className="font-mono">{formatToman(grossSales, false)} تومان</span>
            </div>
            {discounts > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>مجموع تخفیفات:</span>
                <span className="font-mono">- {formatToman(discounts, false)} تومان</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-900">
              <span>فروش خالص شیفت:</span>
              <span className="font-mono font-black">{formatToman(netSales, false)} تومان</span>
            </div>
          </div>

          {/* Payment Collection Channels */}
          <div className="flex flex-col gap-1 text-[11px] pb-2 border-b border-stone-200">
            <div className="text-[10px] font-bold text-stone-500">تفکیک دریافت‌ها بر اساس روش پرداخت:</div>
            <div className="flex justify-between items-center">
              <span>نقد دریافتی مشتریان:</span>
              <span className="font-mono font-bold text-emerald-800">{formatToman(cashReceived, false)} تومان</span>
            </div>
            <div className="flex justify-between items-center">
              <span>کارتخوان بانکی (POS):</span>
              <span className="font-mono font-bold text-blue-800">{formatToman(cardReceived, false)} تومان</span>
            </div>
            {otherReceived > 0 && (
              <div className="flex justify-between items-center">
                <span>سایر دریافت‌ها:</span>
                <span className="font-mono">{formatToman(otherReceived, false)} تومان</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 border-t border-dotted border-stone-200">
              <span>مجموع وجوه وصول‌شده:</span>
              <span className="font-mono text-stone-900">{formatToman(totalCollected, false)} تومان</span>
            </div>
          </div>

          {/* Cash Drawer Expenses Itemization */}
          {shiftExpenses.length > 0 && (
            <div className="flex flex-col gap-1 text-[11px] pb-2 border-b border-stone-200">
              <div className="text-[10px] font-bold text-stone-500">هزینه‌های تنخواه کشوی نقد:</div>
              {shiftExpenses
                .filter((e) => e.isPaidFromCashDrawer)
                .map((e) => (
                  <div key={e.id} className="flex justify-between text-[10px] text-stone-700">
                    <span className="truncate max-w-[170px]">{e.category} ({e.description})</span>
                    <span className="font-mono text-rose-700">- {formatToman(e.amountToman, false)}</span>
                  </div>
                ))}
              <div className="flex justify-between font-semibold pt-1 border-t border-dotted border-stone-200 text-stone-800">
                <span>مجموع پرداختی از کشوی نقد:</span>
                <span className="font-mono text-rose-700">- {formatToman(cashExpenses, false)} تومان</span>
              </div>
            </div>
          )}

          {/* Cash Reconciliation Calculation (The Golden Formula) */}
          <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex flex-col gap-1.5 text-[11px]">
            <div className="text-[10px] font-black text-stone-800 text-center pb-1 border-b border-stone-200">
              فرمول تراز کشوی نقد (Cash Reconciliation)
            </div>
            <div className="flex justify-between text-stone-700">
              <span>موجودی اولیه صندوق:</span>
              <span className="font-mono font-semibold">{formatToman(openingCash, false)} تومان</span>
            </div>
            <div className="flex justify-between text-stone-700">
              <span>+ نقد دریافتی از سفارشات:</span>
              <span className="font-mono font-semibold text-emerald-800">+ {formatToman(cashReceived, false)} تومان</span>
            </div>
            <div className="flex justify-between text-stone-700">
              <span>- هزینه‌های نقدی تنخواه:</span>
              <span className="font-mono font-semibold text-rose-700">- {formatToman(cashExpenses, false)} تومان</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-dashed border-stone-300 font-bold text-stone-900">
              <span>موجودی نقد مورد انتظار سیستم:</span>
              <span className="font-mono text-sm">{formatToman(expectedCash, false)} تومان</span>
            </div>
            <div className="flex justify-between font-bold text-stone-900 pt-0.5">
              <span>موجودی شمرده‌شده فیزیکی:</span>
              <span className="font-mono text-sm">{formatToman(effectiveActualCash, false)} تومان</span>
            </div>

            {/* Discrepancy Box */}
            <div
              className={`p-1.5 rounded-lg border text-center font-bold text-[11px] mt-1 ${
                isBalanced
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : isShortage
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              {isBalanced ? (
                <span>✓ صندوق کاملاً تراز است (بدون مغایرت)</span>
              ) : isShortage ? (
                <span>⚠ کسری صندوق نقد: {formatToman(Math.abs(discrepancyToman), false)} تومان</span>
              ) : (
                <span>ℹ مازاد صندوق نقد: {formatToman(Math.abs(discrepancyToman), false)} تومان</span>
              )}
            </div>

            {effectiveReason && (
              <div className="text-[10px] text-stone-700 pt-1">
                <span className="font-bold text-stone-900">علت ثبت‌شده مغایرت:</span> {effectiveReason}
              </div>
            )}

            {effectiveNotes && (
              <div className="text-[10px] text-stone-600 pt-0.5">
                <span className="font-bold text-stone-900">یادداشت تحویل:</span> {effectiveNotes}
              </div>
            )}
          </div>

          {/* Signatures & Approvals Section for Legal/Audit Record */}
          <div className="pt-3 pb-1 border-t border-stone-300 flex justify-between gap-4 text-[10px] text-stone-800">
            <div className="w-1/2 flex flex-col items-center border border-dashed border-stone-300 rounded-lg p-2 min-h-[60px] justify-between">
              <span className="font-semibold">امضای صندوق‌دار / تحویل‌دهنده</span>
              <span className="text-[9px] text-stone-400 mt-4">(محل امضا و اثر انگشت)</span>
            </div>
            <div className="w-1/2 flex flex-col items-center border border-dashed border-stone-300 rounded-lg p-2 min-h-[60px] justify-between">
              <span className="font-semibold">امضای مدیر / تحویل‌گیرنده</span>
              <span className="text-[9px] text-stone-400 mt-4">(محل امضا و تأیید)</span>
            </div>
          </div>

          {/* Footer Watermark */}
          <div className="text-center pt-1 text-[8px] text-stone-400 font-mono flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>SmartOrders POS Financial Audit System</span>
          </div>
        </div>

        {/* Bottom Actions Bar (Hidden in print) */}
        <div className="flex items-center gap-2 pt-1 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            بستن پنجره
          </button>
          <button
            onClick={handlePrint}
            className="flex-2 bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ گزارش (Print Summary)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
