import React, { useState } from 'react';
import { Clock, X, Check, AlertTriangle, ShieldCheck, DollarSign, Printer } from 'lucide-react';
import { Shift, User, Order, Payment, Expense, Tenant } from '../types/domain';
import {
  formatToman,
  calculateExpectedCash,
  calculateCashDiscrepancy,
  safeInt,
} from '../services/financialMath';
import { ShiftSummaryReceipt } from './ShiftSummaryReceipt';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant?: Tenant;
  activeShift: Shift | null;
  activeUser: User;
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  onOpenShift: (openingCashToman: number, notes?: string) => void;
  onCloseShift: (
    shiftId: string,
    actualCountedCashToman: number,
    expectedCashToman: number,
    discrepancyReason?: string,
    notes?: string
  ) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  tenant,
  activeShift,
  activeUser,
  orders,
  payments,
  expenses,
  onOpenShift,
  onCloseShift,
}) => {
  // Opening state
  const [openingCashInput, setOpeningCashInput] = useState<number>(500000);
  const [openingNotes, setOpeningNotes] = useState<string>('');

  // Closing state
  const [actualCountedCashInput, setActualCountedCashInput] = useState<number>(0);
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showSummaryReceipt, setShowSummaryReceipt] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calculate live expected cash if active shift exists
  let cashReceived = 0;
  let cardReceived = 0;
  let cashExpenses = 0;
  let expectedCash = 0;

  if (activeShift) {
    const shiftPayments = payments.filter(
      (p) => p.shiftId === activeShift.id && p.status === 'SUCCESSFUL'
    );
    cashReceived = shiftPayments
      .filter((p) => p.paymentMethod === 'CASH')
      .reduce((sum, p) => sum + p.amountToman, 0);
    cardReceived = shiftPayments
      .filter((p) => p.paymentMethod === 'CARD_MANUAL')
      .reduce((sum, p) => sum + p.amountToman, 0);

    const shiftExpenses = expenses.filter((e) => e.shiftId === activeShift.id);
    cashExpenses = shiftExpenses
      .filter((e) => e.isPaidFromCashDrawer)
      .reduce((sum, e) => sum + e.amountToman, 0);

    expectedCash = calculateExpectedCash(
      activeShift.openingCashToman,
      cashReceived,
      cashExpenses
    );
  }

  const { discrepancyToman, isShortage, isOverage, isBalanced } = calculateCashDiscrepancy(
    actualCountedCashInput,
    expectedCash
  );

  const handleOpenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (openingCashInput < 0) {
      setErrorMsg('موجودی اولیه نمی‌تواند منفی باشد.');
      return;
    }
    onOpenShift(openingCashInput, openingNotes.trim() || undefined);
    onClose();
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    if (!isBalanced && !discrepancyReason.trim()) {
      setErrorMsg('در صورت وجود مغایرت در صندوق، درج علت مغایرت الزامی است.');
      return;
    }

    onCloseShift(
      activeShift.id,
      actualCountedCashInput,
      expectedCash,
      discrepancyReason.trim() || undefined,
      closingNotes.trim() || undefined
    );
    onClose();
  };

  const handlePrintShiftSummary = () => {
    setShowSummaryReceipt(true);
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 print:hidden">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-stone-100 text-base">
              {activeShift ? 'بستن و تسویه نهایی شیفت کاری' : 'بازگشایی شیفت کاری جدید'}
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-xs p-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!activeShift ? (
          /* FORM: OPEN SHIFT */
          <form onSubmit={handleOpenSubmit} className="flex flex-col gap-4 text-xs">
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex flex-col gap-1.5">
              <span className="text-stone-400">اپراتور بازکننده شیفت:</span>
              <span className="text-stone-100 font-semibold text-sm">{activeUser.fullName}</span>
              <span className="text-[11px] text-stone-400">
                زمان: {new Date().toLocaleDateString('fa-IR')} ساعت {new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-300 font-medium">
                موجودی اولیه صندوق نقد (تومان) - پول خرد داخل کشو:
              </label>
              <input
                type="number"
                step="5000"
                min="0"
                value={openingCashInput || ''}
                onChange={(e) => {
                  setErrorMsg('');
                  setOpeningCashInput(safeInt(e.target.value));
                }}
                className="bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-bold text-base text-center focus:outline-none focus:border-amber-500"
                placeholder="مثلاً: ۵۰۰,۰۰۰"
                required
              />
              <span className="text-[11px] text-amber-400 text-center font-medium">
                معادل: {formatToman(openingCashInput)} تومان
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-300 font-medium">توضیحات یا یادداشت تحویل شیفت (اختیاری):</label>
              <textarea
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                rows={2}
                placeholder="یادداشت‌های مربوط به کسری احتمالی قبل، موجودی سکه یا اسکناس خاص..."
                className="bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl font-medium"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="flex-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold shadow transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تأیید و شروع شیفت کاری</span>
              </button>
            </div>
          </form>
        ) : (
          /* FORM: CLOSE SHIFT WITH RECONCILIATION */
          <form onSubmit={handleCloseSubmit} className="flex flex-col gap-4 text-xs">
            {/* Live reconciliation breakdown box */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex flex-col gap-2">
              <div className="flex justify-between items-center text-stone-400">
                <span>موجودی اولیه صندوق نقد:</span>
                <span className="font-semibold text-stone-200">
                  {formatToman(activeShift.openingCashToman)} تومان
                </span>
              </div>
              <div className="flex justify-between items-center text-stone-400">
                <span>مجموع دریافت نقد در شیفت:</span>
                <span className="font-semibold text-emerald-400">
                  + {formatToman(cashReceived)} تومان
                </span>
              </div>
              <div className="flex justify-between items-center text-stone-400">
                <span>هزینه‌های پرداخت‌شده از کشوی نقد:</span>
                <span className="font-semibold text-rose-400">
                  - {formatToman(cashExpenses)} تومان
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-stone-800 font-bold text-sm text-stone-100">
                <span>موجودی نقد مورد انتظار صندوق (سیستم):</span>
                <span className="text-amber-400">{formatToman(expectedCash)} تومان</span>
              </div>
              <div className="text-[11px] text-stone-400 pt-1">
                (تراکنش‌های پوز بانکی: {formatToman(cardReceived)} تومان مستقیماً به حساب بانکی واریز شده و جزو کشوی نقد نیست.)
              </div>
            </div>

            {/* Input actual counted cash */}
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-200 font-semibold">
                شمارش نقد فیزیکی کشو در پایان شیفت (تومان):
              </label>
              <input
                type="number"
                step="5000"
                min="0"
                value={actualCountedCashInput || ''}
                onChange={(e) => {
                  setErrorMsg('');
                  setActualCountedCashInput(safeInt(e.target.value));
                }}
                className="bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-black text-lg text-center focus:outline-none focus:border-amber-500"
                placeholder="مبلغ شمرده‌شده را وارد کنید"
                required
              />
              <span className="text-[11px] text-stone-400 text-center">
                معادل: {formatToman(actualCountedCashInput)} تومان
              </span>
            </div>

            {/* Discrepancy indicator */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                isBalanced
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : isShortage
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                  : 'bg-amber-950/40 border-amber-800 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isBalanced ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>
                  {isBalanced
                    ? 'صندوق کاملاً تراز است (بدون مغایرت)'
                    : isShortage
                    ? 'کسری صندوق نقد (Shortage)'
                    : 'مازاد صندوق نقد (Overage)'}
                </span>
              </div>
              <span className="font-mono text-sm">
                {isBalanced ? '۰ تومان' : `${formatToman(Math.abs(discrepancyToman))} تومان ${isShortage ? 'کسری' : 'اضافی'}`}
              </span>
            </div>

            {/* Required reason if discrepancy */}
            {!isBalanced && (
              <div className="flex flex-col gap-1.5">
                <label className="text-rose-300 font-semibold">
                  * علت یا شرح مغایرت صندوق (الزامی):
                </label>
                <input
                  type="text"
                  value={discrepancyReason}
                  onChange={(e) => {
                    setErrorMsg('');
                    setDiscrepancyReason(e.target.value);
                  }}
                  placeholder="مثلاً: خطای خرد کردن پول مشتری، افتادن سکه..."
                  className="bg-stone-950 border border-rose-800/80 rounded-xl p-2.5 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400">یادداشت نهایی برای مدیر (اختیاری):</label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={2}
                placeholder="یادداشت‌های پایانی..."
                className="bg-stone-950 border border-stone-800 rounded-xl p-2 text-stone-200 text-xs placeholder-stone-500 focus:outline-none"
              />
            </div>

            <div className="pt-1">
              <button
                type="button"
                id="print-shift-summary-btn"
                data-testid="print-shift-summary-btn"
                aria-label="Print Shift Summary"
                title="Print Shift Summary"
                onClick={handlePrintShiftSummary}
                className="w-full bg-stone-800 hover:bg-stone-750 active:scale-[0.99] text-amber-400 hover:text-amber-300 border border-stone-700 hover:border-amber-500/50 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm text-xs"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>چاپ صورت‌جلسه شیفت</span>
                <span className="font-mono text-[11px] opacity-90">(Print Shift Summary)</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl font-medium cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="flex-2 bg-rose-700 hover:bg-rose-600 text-white py-2.5 rounded-xl font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>ثبت نهایی و بستن شیفت</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Printer-Friendly Shift Summary Receipt Report (#printable-shift-summary) */}
      {activeShift && (
        <div className={showSummaryReceipt ? 'block' : 'hidden print:block'}>
          <ShiftSummaryReceipt
            shift={activeShift}
            tenant={tenant}
            orders={orders}
            payments={payments}
            expenses={expenses}
            actualCountedCashToman={
              actualCountedCashInput > 0
                ? actualCountedCashInput
                : (activeShift.actualCountedCashToman ?? expectedCash)
            }
            discrepancyReason={discrepancyReason}
            notes={closingNotes}
            activeUser={activeUser}
            onClose={() => setShowSummaryReceipt(false)}
          />
        </div>
      )}
    </div>
  );
};
