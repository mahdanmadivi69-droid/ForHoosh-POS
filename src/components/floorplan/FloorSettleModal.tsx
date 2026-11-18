/**
 * src/components/floorplan/FloorSettleModal.tsx
 * 
 * Modendo POS — Comprehensive Floor Plan Settlement Modal
 * Features:
 *  - Full Payment Methods: CARD (پوز بانکی), CASH (وجه نقد), SPLIT (به ایرانی / دنگی)
 *  - Banknote Quick Tender & Change Due calculation for Cash
 *  - Guest Count & Per-Person Split calculation for دنگی
 *  - Itemized Receipt Preview before confirming
 *  - Proforma Print ("چاپ پیش‌فاکتور")
 *  - Thermal Receipt Print on Final Confirmation
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Banknote,
  Users,
  Printer,
  X,
  Receipt,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Eye,
  Percent,
} from 'lucide-react';
import { FloorNode, TableSession } from './FloorPlanCanvas';
import { formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';

interface FloorSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNode: FloorNode;
  activeTableSession?: TableSession;
  sessionTotal: number;
  ps5Fee?: number;
  onConfirmSettlement: (paymentData: {
    paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
    terminalName: string;
    referenceCode?: string;
    cashTendered?: number;
    splitCount?: number;
    splitAmountPerPerson?: number;
  }) => void;
  onPrintProforma?: () => void;
}

const BANKNOTES_TOMAN = [50000, 100000, 200000, 500000, 1000000, 2000000];

export const FloorSettleModal: React.FC<FloorSettleModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
  activeTableSession,
  sessionTotal,
  ps5Fee = 0,
  onConfirmSettlement,
  onPrintProforma,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH' | 'SPLIT'>('CARD');
  const [terminalName, setTerminalName] = useState<string>('پوز ۱ (بانک سامان)');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<number>(sessionTotal);
  const [splitCount, setSplitCount] = useState<number>(Math.max(2, activeTableSession?.guestCount || 2));
  const [showReceiptPreview, setShowReceiptPreview] = useState<boolean>(true);

  const changeDue = Math.max(0, cashTendered - sessionTotal);
  const splitAmountPerPerson = Math.ceil(sessionTotal / splitCount);

  const items = useMemo(() => {
    return activeTableSession?.cartItems || [];
  }, [activeTableSession?.cartItems]);

  const grossAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.subtotalToman || 0), 0) + ps5Fee;
  }, [items, ps5Fee]);

  const discountAmount = activeTableSession?.discountToman || 0;

  if (!isOpen) return null;

  const handleFinalConfirm = () => {
    playPosBeep('click');
    onConfirmSettlement({
      paymentMethod,
      terminalName,
      referenceCode: referenceCode.trim() || undefined,
      cashTendered: paymentMethod === 'CASH' ? cashTendered : undefined,
      splitCount: paymentMethod === 'SPLIT' ? splitCount : undefined,
      splitAmountPerPerson: paymentMethod === 'SPLIT' ? splitAmountPerPerson : undefined,
    });
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
          className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[28px] bg-[#0c1411]/95 border border-emerald-500/30 backdrop-blur-2xl shadow-2xl overflow-hidden text-right"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 bg-[#06120F]/90 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  تسویه و صدور فیش میز {selectedNode.label}
                </h3>
                <span className="text-[11px] text-[#94A3B8]">
                  {selectedNode.titleFa} {activeTableSession?.customerName ? `• ${activeTableSession.customerName}` : ''}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                playPosBeep('click');
                onClose();
              }}
              className="p-1.5 rounded-full text-white/50 hover:text-white cursor-pointer hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain">
            {/* Total Balance Summary Header */}
            <div className="liquid-glass-well rounded-2xl p-4 flex items-center justify-between border border-emerald-500/30 shadow-inner">
              <div>
                <span className="text-xs text-[#94A3B8] block">مبلغ کل قابل پرداخت</span>
                <span className="text-2xl font-black text-emerald-300 font-mono tracking-tight">
                  {formatToman(sessionTotal)} تومان
                </span>
              </div>

              {onPrintProforma && (
                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    onPrintProforma();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Printer className="w-4 h-4 text-emerald-300" />
                  <span>چاپ پیش‌فاکتور</span>
                </button>
              )}
            </div>

            {/* Payment Method Selector (CARD / CASH / SPLIT) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#94A3B8]">روش تسویه فاکتور:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('CARD');
                  }}
                  className={`py-3 px-2 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-white/5 border-white/10 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>دستگاه پوز بانکی</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('CASH');
                  }}
                  className={`py-3 px-2 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-white/5 border-white/10 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-400" />
                  <span>پرداخت نقدی</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('SPLIT');
                  }}
                  className={`py-3 px-2 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                    paymentMethod === 'SPLIT'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : 'bg-white/5 border-white/10 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>به ایرانی (دنگی)</span>
                </button>
              </div>
            </div>

            {/* Dynamic Option Panels */}
            {paymentMethod === 'CARD' && (
              <div className="liquid-glass-well rounded-2xl p-4 space-y-3 text-xs border border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#94A3B8] mb-1 font-bold">دستگاه پوز انتخابی:</label>
                    <select
                      value={terminalName}
                      onChange={(e) => setTerminalName(e.target.value)}
                      className="w-full bg-[#0a1813] border border-white/15 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-emerald-400"
                    >
                      <option value="پوز ۱ (بانک سامان)">پوز ۱ (بانک سامان)</option>
                      <option value="پوز ۲ (بانک ملت)">پوز ۲ (بانک ملت)</option>
                      <option value="پوز ۳ (بانک پاسارگاد)">پوز ۳ (بانک پاسارگاد)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#94A3B8] mb-1 font-bold">شماره پیگیری / ارجاع:</label>
                    <input
                      type="text"
                      value={referenceCode}
                      onChange={(e) => setReferenceCode(e.target.value)}
                      placeholder="مثال: ۸۷۶۵۴۳۲۱"
                      className="w-full bg-[#0a1813] border border-white/15 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-400"
                    >
                    </input>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <div className="liquid-glass-well rounded-2xl p-4 space-y-3 text-xs border border-white/10">
                <div>
                  <label className="block text-[#94A3B8] mb-1 font-bold">مبلغ وجه نقد دریافتی (تومان):</label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#0a1813] border border-white/15 rounded-xl px-3 py-2 text-white font-mono text-base font-bold outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Quick Banknote Injections */}
                <div className="flex gap-1.5 flex-wrap">
                  {BANKNOTES_TOMAN.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setCashTendered((prev) => prev + note)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 border border-white/10 font-mono text-[11px] hover:text-white hover:border-emerald-500 cursor-pointer"
                    >
                      +{formatToman(note)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashTendered(sessionTotal)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[11px] font-bold cursor-pointer"
                  >
                    مبلغ دقیق
                  </button>
                </div>

                {changeDue > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs">
                    <span>مبلغ بازگردانده به مشتری (باقیمانده):</span>
                    <span className="font-mono font-black text-sm">{formatToman(changeDue)} تومان</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'SPLIT' && (
              <div className="liquid-glass-well rounded-2xl p-4 space-y-3 text-xs border border-amber-500/30">
                <div>
                  <label className="block text-[#94A3B8] mb-1 font-bold">تعداد نفرات برای تقسیم دنگی:</label>
                  <div className="flex gap-1.5">
                    {[2, 3, 4, 5, 6, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSplitCount(num)}
                        className={`flex-1 py-2 rounded-xl font-bold font-mono text-xs transition cursor-pointer ${
                          splitCount === num
                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                            : 'bg-white/5 text-white border border-white/10 hover:border-amber-400/40'
                        }`}
                      >
                        {num} نفر
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between">
                  <span className="text-amber-200 font-bold">سهم هر نفر (برای {splitCount} نفر):</span>
                  <span className="text-base font-black text-amber-300 font-mono">
                    {formatToman(splitAmountPerPerson)} تومان
                  </span>
                </div>
              </div>
            )}

            {/* Receipt Preview Accordion */}
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0a1813]/60">
              <button
                type="button"
                onClick={() => setShowReceiptPreview((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-[#94A3B8] hover:text-white bg-white/5 cursor-pointer transition"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>پیش‌نمایش اقلام فاکتور ({items.length + (ps5Fee > 0 ? 1 : 0)} قلم)</span>
                </div>
                {showReceiptPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showReceiptPreview && (
                <div className="p-4 space-y-2 border-t border-white/10 text-xs">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <div>
                        <span className="text-white font-bold">{it.itemNameSnapshot}</span>
                        <span className="text-[#94A3B8] font-mono text-[11px] mr-2">× {it.quantity}</span>
                      </div>
                      <span className="text-white font-mono tabular-nums">{formatToman(it.subtotalToman)} ت</span>
                    </div>
                  ))}

                  {ps5Fee > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04] text-sky-300">
                      <span>تعرفه بازی و کنسول PS5 ({selectedNode.label})</span>
                      <span className="font-mono tabular-nums">{formatToman(ps5Fee)} ت</span>
                    </div>
                  )}

                  <div className="pt-2 space-y-1 font-mono text-[11px] text-[#94A3B8]">
                    <div className="flex justify-between">
                      <span>جمع ناخالص:</span>
                      <span className="text-white">{formatToman(grossAmount)} تومان</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-rose-300">
                        <span>کسر تخفیف:</span>
                        <span>-{formatToman(discountAmount)} تومان</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-emerald-300 pt-1 border-t border-white/10">
                      <span className="font-sans">مبلغ نهایی:</span>
                      <span>{formatToman(sessionTotal)} تومان</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-[#06120F]/90 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white hover:bg-white/10 cursor-pointer transition"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={handleFinalConfirm}
              className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer transition"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>تایید نهایی تسویه و چاپ فیش</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
