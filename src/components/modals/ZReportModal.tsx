/**
 * CAFE OS — Shift Z-Report & Cash Drawer Closeout Modal (ZReportModal.tsx)
 * Industrial Dark UI with Real-Time Discrepancy Reconciliation,
 * Material Depletions Breakdown & Direct ESC/POS Thermal Printing
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Printer,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  Coins,
  Coffee,
  Package,
  Layers,
  Sparkles,
  HelpCircle,
  TrendingDown,
  Check,
  Scale,
} from 'lucide-react';
import { Shift, User } from '../../types/domain';
import { ZReportData } from '../../types/zreport-inventory';
import { ShiftCloseoutService } from '../../services/ShiftCloseoutService';
import { formatToman } from '../../services/financialMath';
import { audioFeedback } from '../../services/audioFeedback';

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: Shift | null;
  activeUser: User;
  onConfirmCloseShift: (
    shiftId: string,
    countedCash: number,
    expectedCash: number,
    discrepancyReason?: string,
    notes?: string
  ) => void;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  activeUser,
  onConfirmCloseShift,
}) => {
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [zReport, setZReport] = useState<ZReportData | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'financial' | 'materials' | 'ticket_preview'>('financial');

  // Initialize or recompute Z-Report whenever activeShift or countedCashInput changes
  useEffect(() => {
    if (!isOpen || !activeShift) return;

    const runCalculation = async () => {
      try {
        const report = await ShiftCloseoutService.calculateZReport(
          activeShift.id,
          countedCashInput,
          {
            closedBy: activeUser.fullName,
            discrepancyReason: discrepancyReason.trim() || undefined,
            notes: closingNotes.trim() || undefined,
          }
        );
        setZReport(report);
      } catch (err) {
        console.error('Error calculating Z-Report:', err);
      }
    };

    runCalculation();
  }, [isOpen, activeShift, countedCashInput, activeUser.fullName, discrepancyReason, closingNotes]);

  // Set initial counted cash to expected cash for user convenience on first open
  useEffect(() => {
    if (isOpen && activeShift) {
      // Run once with 0 to get expected cash, then initialize if needed
      ShiftCloseoutService.calculateZReport(activeShift.id, 0).then((rep) => {
        setCountedCashInput(rep.expected_cash);
      });
    }
  }, [isOpen, activeShift]);

  if (!isOpen || !activeShift) return null;

  const handlePrint = async () => {
    if (!zReport) return;
    setIsPrinting(true);
    setPrintSuccessMsg(null);
    try {
      const result = await ShiftCloseoutService.printZReportTicket(zReport);
      setPrintSuccessMsg(result.message);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`خطا در ارسال به پرینتر: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleFinalClose = () => {
    if (!zReport) return;

    if (!zReport.is_balanced && !discrepancyReason.trim()) {
      audioFeedback.playError();
      alert('در صورت وجود مغایرت در صندوق، درج علت مغایرت الزامی است.');
      return;
    }

    audioFeedback.playSuccess();
    onConfirmCloseShift(
      activeShift.id,
      countedCashInput,
      zReport.expected_cash,
      discrepancyReason.trim() || undefined,
      closingNotes.trim() || undefined
    );
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-4 backdrop-blur-sm bg-black/80 select-none overflow-y-auto">
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          data-tenant={zReport?.tenant_id || activeShift.tenantId || 'tenant-100hich-01'}
          className="relative w-full max-w-3xl bg-[var(--color-surface-card,#1F242C)] rounded-2xl border border-[var(--color-surface-border,rgba(255,255,255,0.1))] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
          dir="rtl"
        >
          {/* Header Bar */}
          <div className="bg-[#161A1F] border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary-light,rgba(215,25,33,0.15))] border border-[var(--color-brand-primary-border,rgba(215,25,33,0.3))] flex items-center justify-center text-[var(--color-brand-primary,#D71921)]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>گزارش رسمی Z-Report و تسویه پایان شیفت</span>
                  <span className="text-[10px] bg-[var(--color-brand-primary,#D71921)] text-white px-1.5 py-0.5 rounded font-mono font-bold">
                    ESC/POS V2.5
                  </span>
                </h3>
                <p className="text-xs text-[#9EACB8]">
                  مغایرت‌سنجی نقدینگی، تفکیک کارتخوان و محاسبه خودکار مصرف دانه‌ها و شیرها
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] text-[#9EACB8] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtabs Selector */}
          <div className="bg-[#161A1F]/70 border-b border-white/5 px-4 pt-2 flex items-center gap-2 text-xs font-bold">
            <button
              onClick={() => {
                audioFeedback.playTap();
                setActiveTab('financial');
              }}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'financial'
                  ? 'border-[var(--color-brand-primary,#D71921)] text-white'
                  : 'border-transparent text-[#9EACB8] hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>تسویه نقد و کارتخوان (مالی)</span>
            </button>

            <button
              onClick={() => {
                audioFeedback.playTap();
                setActiveTab('materials');
              }}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'materials'
                  ? 'border-[var(--color-brand-primary,#D71921)] text-white'
                  : 'border-transparent text-[#9EACB8] hover:text-white'
              }`}
            >
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>مصرف دانه‌ها و مواد انبار (BOM)</span>
              {zReport && (
                <span className="text-[10px] bg-[#1F242C] text-gray-300 px-1.5 py-0.2 rounded-full border border-white/10 font-mono">
                  {zReport.material_depletions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                audioFeedback.playTap();
                setActiveTab('ticket_preview');
              }}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ticket_preview'
                  ? 'border-[var(--color-brand-primary,#D71921)] text-white'
                  : 'border-transparent text-[#9EACB8] hover:text-white'
              }`}
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>پیش‌نمایش فیش چاپی ۸۰mm</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* TAB 1: Financial & Drawer Reconciliation */}
            {activeTab === 'financial' && zReport && (
              <div className="space-y-4">
                {/* Physical Cash Input Box */}
                <div className="bg-[#161A1F] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-white flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>مبلغ نقد فیزیکی شمارش‌شده در کشوی صندوق (تومان):</span>
                    </label>
                    <span className="text-[11px] text-[#9EACB8]">
                      موجودی اولیه: {formatToman(zReport.opening_cash)} ت
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={countedCashInput || ''}
                      onChange={(e) => setCountedCashInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="مبلغ نقد شمرده‌شده را وارد کنید..."
                      className="w-full bg-[#1F242C] border border-white/10 rounded-xl px-4 py-3 text-base font-black text-white font-mono focus:border-[#D71921] focus:outline-none pl-14"
                      dir="ltr"
                    />
                    <span className="absolute left-4 top-3.5 text-xs text-gray-400 font-bold">تومان</span>
                  </div>

                  {/* Quick Add buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[100000, 200000, 500000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          audioFeedback.playTap();
                          setCountedCashInput((prev) => prev + amt);
                        }}
                        className="px-2.5 py-1 rounded bg-[#1F242C] hover:bg-[#282F3A] text-[11px] text-gray-300 border border-white/5 font-mono cursor-pointer"
                      >
                        +{amt.toLocaleString('fa-IR')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        audioFeedback.playTap();
                        setCountedCashInput(zReport.expected_cash);
                      }}
                      className="px-2.5 py-1 rounded bg-[#D71921]/15 hover:bg-[#D71921]/25 text-[#D71921] border border-[#D71921]/30 text-[11px] font-bold cursor-pointer mr-auto"
                    >
                      تطابق با موجودی سیستمی ({formatToman(zReport.expected_cash)})
                    </button>
                  </div>
                </div>

                {/* Discrepancy Status Card */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    zReport.is_balanced
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : zReport.is_shortage
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {zReport.is_balanced ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-[#D71921] shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-black">
                        {zReport.is_balanced
                          ? 'صندوق کاملاً تراز است'
                          : zReport.is_shortage
                          ? `کسری نقدینگی صندوق: ${formatToman(Math.abs(zReport.discrepancy))} تومان`
                          : `مازاد نقدینگی صندوق: ${formatToman(zReport.discrepancy)} تومان`}
                      </div>
                      <div className="text-xs text-[#9EACB8] mt-0.5 font-mono">
                        مورد انتظار: {formatToman(zReport.expected_cash)} ت | شمرده‌شده:{' '}
                        {formatToman(zReport.counted_cash_float)} ت
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-black/40 border border-white/10">
                    {zReport.is_balanced ? 'تراز (0)' : `${zReport.discrepancy > 0 ? '+' : ''}${formatToman(zReport.discrepancy)} ت`}
                  </span>
                </div>

                {!zReport.is_balanced && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">
                      علت مغایرت صندوق (درج علت الزامی است):
                    </label>
                    <input
                      type="text"
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      placeholder="علت کسری یا مازاد (مثلاً اشتباه در پول خرد مشتری)..."
                      className="w-full bg-[#161A1F] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* Financial Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#161A1F] p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] text-[#9EACB8]">فروش ناخالص (Gross)</div>
                    <div className="text-sm font-black text-white mt-1 font-mono">
                      {formatToman(zReport.gross_sales)} ت
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1">{zReport.order_count} سفارش موفق</div>
                  </div>

                  <div className="bg-[#161A1F] p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] text-[#9EACB8]">فروش خالص (Net Sales)</div>
                    <div className="text-sm font-black text-emerald-400 mt-1 font-mono">
                      {formatToman(zReport.net_sales)} ت
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1">تخفیف: {formatToman(zReport.discounts_total)} ت</div>
                  </div>

                  <div className="bg-[#161A1F] p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] text-[#9EACB8]">کارتخوان متصل (POS)</div>
                    <div className="text-sm font-black text-blue-400 mt-1 font-mono">
                      {formatToman(zReport.payment_methods.pos_card)} ت
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1">مستقیم به حساب بانکی</div>
                  </div>

                  <div className="bg-[#161A1F] p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] text-[#9EACB8]">نقد دریافتی (Cash)</div>
                    <div className="text-sm font-black text-amber-400 mt-1 font-mono">
                      {formatToman(zReport.payment_methods.cash)} ت
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1">تنخواه: {formatToman(zReport.expenses_cash_drawer)} ت</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Materials Depletions (Beans, Milk, Syrups) */}
            {activeTab === 'materials' && zReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-300 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-[#D71921]" />
                    <span>گزارش مصارف مواد اولیه و دانه‌های قهوه در این شیفت:</span>
                  </div>
                  <span className="text-[11px] text-[#9EACB8]">
                    محاسبه‌شده بر پایه فرمولاسیون رسپی (BOM) و مودیفایرها
                  </span>
                </div>

                {zReport.material_depletions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-[#161A1F] rounded-xl border border-white/5 text-xs">
                    هیچ مصرف دانه‌ای در این شیفت ثبت نشده است.
                  </div>
                ) : (
                  <div className="bg-[#161A1F] rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-[#121417] text-gray-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="p-3">ماده اولیه / دانه قهوه</th>
                          <th className="p-3">میزان مصرف در شیفت</th>
                          <th className="p-3">واحد سنجش</th>
                          <th className="p-3 text-left">بهای تمام‌شده تخمینی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {zReport.material_depletions.map((mat) => {
                          const isBean = mat.unit === 'g';
                          const isMilk = mat.unit === 'ml';

                          return (
                            <tr key={mat.item_id} className="hover:bg-white/5 transition-colors">
                              <td className="p-3 font-bold text-white flex items-center gap-2">
                                {isBean ? (
                                  <Coffee className="w-4 h-4 text-amber-500" />
                                ) : isMilk ? (
                                  <Scale className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <Package className="w-4 h-4 text-emerald-400" />
                                )}
                                <span>{mat.name}</span>
                              </td>
                              <td className="p-3 font-mono font-black text-amber-300">
                                {mat.consumed_qty.toLocaleString('fa-IR')}
                              </td>
                              <td className="p-3 text-[#9EACB8] font-mono">
                                {mat.unit === 'g' ? 'گرم (g)' : mat.unit === 'ml' ? 'میلی‌لیتر (ml)' : mat.unit}
                              </td>
                              <td className="p-3 text-left font-mono text-gray-300">
                                {formatToman(mat.total_cost_toman || 0)} تومان
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Ticket Preview (Monospace) */}
            {activeTab === 'ticket_preview' && (
              <div className="bg-[#0D0F12] p-4 rounded-xl border border-white/5 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[380px] leading-relaxed whitespace-pre" dir="ltr">
                {/* Simulated live ticket plain text */}
                <pre>{`*** 100 HICH SPECIALTY COFFEE ***
OFFICIAL SHIFT Z-REPORT (ESC/POS)
==========================================
SHIFT ID: #${activeShift.id.slice(-6)}
ORDERS:   ${zReport?.order_count || 0}
OPERATOR: ${activeUser.fullName}
------------------------------------------
GROSS SALES: ${formatToman(zReport?.gross_sales || 0)} T
NET SALES:   ${formatToman(zReport?.net_sales || 0)} T
VAT (9%):    ${formatToman(zReport?.vat_total || 0)} T
------------------------------------------
POS CARD:    ${formatToman(zReport?.payment_methods.pos_card || 0)} T
CASH IN:     ${formatToman(zReport?.payment_methods.cash || 0)} T
EXPENSES:    ${formatToman(zReport?.expenses_cash_drawer || 0)} T
------------------------------------------
EXPECTED:    ${formatToman(zReport?.expected_cash || 0)} T
COUNTED:     ${formatToman(countedCashInput)} T
DISCREPANCY: ${zReport?.is_balanced ? 'BALANCED' : `${zReport?.discrepancy} T`}
==========================================
RAW MATERIALS DEPLETED:
${zReport?.material_depletions.map((m) => `- ${m.name}: ${m.consumed_qty} ${m.unit}`).join('\n') || 'None'}
==========================================
ESC/POS Double Strike: [0x1B, 0x47, 0x01]
Full Cut Paper:        [0x1D, 0x56, 0x00]`}</pre>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="bg-[#161A1F] border-t border-white/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-4 py-2.5 rounded-xl bg-[#1F242C] hover:bg-[#2A313C] text-xs font-bold text-white border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-purple-400" />
                <span>{isPrinting ? 'در حال ارسال...' : 'چاپ فیش حرارتی Z-Report (ESC/POS)'}</span>
              </button>

              {printSuccessMsg && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                  <Check className="w-3.5 h-3.5" />
                  <span>{printSuccessMsg}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-[#1F242C] hover:bg-[#2A313C] text-xs font-bold text-[#9EACB8] hover:text-white transition-all cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleFinalClose}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand-primary,#D71921)] hover:bg-[var(--color-brand-primary-hover,#B3141B)] text-xs font-black text-white flex items-center gap-2 shadow-[0_0_15px_-2px_var(--color-brand-primary-light,rgba(215,25,33,0.5))] transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید صورت‌جلسه و بستن نهایی شیفت</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
