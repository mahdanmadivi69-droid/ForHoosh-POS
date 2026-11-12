/**
 * src/components/LiquidGlassPaymentSheet.tsx
 * 
 * KarWand POS — 100 HICH Sensory Lab & CafeOS
 * Liquid Glass Payment Sheet (Zero-G Spec 2.0)
 * 
 * Features:
 *  - Ultra-clean, minimal settlement modal with zero visual clutter.
 *  - 4 Payment Methods: POS, CASH, TRANSFER, and SPLIT.
 *  - Strict Integer Toman arithmetic invariant (no floating-point currency).
 *  - In SPLIT mode: Part A + Part B must mathematically equal total balance.
 *  - Pure Apple Liquid Glass shader styling with Pinar/Vazirmatn typography.
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Banknote,
  Send,
  Split,
  CheckCircle2,
  X,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { formatToman, safeInt } from '../services/financialMath';
import { assertIntegerToman } from '../db/schema';
import { playPosBeep } from '../services/soundEffects';

export type SettlementPaymentMethod = 'POS' | 'CASH' | 'TRANSFER' | 'SPLIT';

export interface SplitSettlementDetails {
  partAMethod: 'POS' | 'CASH' | 'TRANSFER';
  partAAmountToman: number;
  partBMethod: 'POS' | 'CASH' | 'TRANSFER';
  partBAmountToman: number;
}

export interface SettlementResult {
  paymentMethod: SettlementPaymentMethod;
  terminalName: string;
  referenceCode?: string;
  cashTendered?: number;
  changeDue?: number;
  splitDetails?: SplitSettlementDetails;
}

interface LiquidGlassPaymentSheetProps {
  isOpen: boolean;
  totalBalanceToman: number;
  onClose: () => void;
  onConfirm: (result: SettlementResult) => void;
  tableOrCustomerLabel?: string;
  isSubmitting?: boolean;
}

const COMMON_BANKNOTES_TOMAN = [50000, 100000, 200000, 500000, 1000000, 2000000];

export const LiquidGlassPaymentSheet: React.FC<LiquidGlassPaymentSheetProps> = ({
  isOpen,
  totalBalanceToman,
  onClose,
  onConfirm,
  tableOrCustomerLabel,
  isSubmitting = false,
}) => {
  // Validate total adheres to Integer Toman
  const total = Math.round(Number(totalBalanceToman) || 0);

  const [method, setMethod] = useState<SettlementPaymentMethod>('POS');
  const [terminalName, setTerminalName] = useState<string>('پوز ۱ (بانک سامان)');
  const [referenceCode, setReferenceCode] = useState<string>('');

  // Cash state
  const [cashTendered, setCashTendered] = useState<number>(total);

  // Split state
  const [splitPartAMethod, setSplitPartAMethod] = useState<'POS' | 'CASH' | 'TRANSFER'>('POS');
  const [splitPartBMethod, setSplitPartBMethod] = useState<'POS' | 'CASH' | 'TRANSFER'>('POS');
  const [partAAmount, setPartAAmount] = useState<number>(() => Math.floor(total / 2));
  const [partBAmount, setPartBAmount] = useState<number>(() => total - Math.floor(total / 2));

  // Sync state whenever total changes or sheet opens
  useEffect(() => {
    if (isOpen) {
      setCashTendered(total);
      const half = Math.floor(total / 2);
      setPartAAmount(half);
      setPartBAmount(total - half);
      setReferenceCode('');
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  // Split calculations & invariant checks
  const handlePartAChange = (valStr: string) => {
    const rawVal = safeInt(valStr);
    const clampedPartA = Math.max(0, Math.min(total, rawVal));
    setPartAAmount(clampedPartA);
    setPartBAmount(total - clampedPartA);
  };

  const handleApply5050Split = () => {
    playPosBeep('click');
    const half = Math.floor(total / 2);
    setPartAAmount(half);
    setPartBAmount(total - half);
  };

  // Validation invariant: Part A + Part B === total
  const isSplitValid =
    method !== 'SPLIT' ||
    (Number.isInteger(partAAmount) &&
      Number.isInteger(partBAmount) &&
      partAAmount >= 0 &&
      partBAmount >= 0 &&
      partAAmount + partBAmount === total);

  // Cash validation
  const changeDue = Math.max(0, cashTendered - total);
  const isCashValid = method !== 'CASH' || cashTendered >= total;

  const canConfirm = isSplitValid && isCashValid && total > 0;

  const handleFinalConfirm = () => {
    if (!canConfirm || isSubmitting) {
      playPosBeep('delete');
      return;
    }

    playPosBeep('success');

    // Assert integer arithmetic invariants before dispatch
    assertIntegerToman(total, 'Total Settlement');

    if (method === 'SPLIT') {
      assertIntegerToman(partAAmount, 'Split Part A');
      assertIntegerToman(partBAmount, 'Split Part B');
      if (partAAmount + partBAmount !== total) {
        throw new Error(`[SPLIT Invariant Violation] Part A (${partAAmount}) + Part B (${partBAmount}) !== Total (${total})`);
      }
    }

    onConfirm({
      paymentMethod: method,
      terminalName:
        method === 'POS'
          ? terminalName
          : method === 'CASH'
          ? 'صندوق نقدی'
          : method === 'TRANSFER'
          ? 'حواله کارت‌به‌کارت'
          : `تفکیکی (${splitPartAMethod} + ${splitPartBMethod})`,
      referenceCode: referenceCode.trim() || undefined,
      cashTendered: method === 'CASH' ? cashTendered : undefined,
      changeDue: method === 'CASH' ? changeDue : undefined,
      splitDetails:
        method === 'SPLIT'
          ? {
              partAMethod: splitPartAMethod,
              partAAmountToman: partAAmount,
              partBMethod: splitPartBMethod,
              partBAmountToman: partBAmount,
            }
          : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none">
      <div
        className="liquid-glass-panel w-full max-w-lg p-6 flex flex-col text-right relative"
        style={{
          boxShadow: undefined,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#8C1318] shadow-[0_0_10px_#8C1318]"></span>
            <span className="text-xs font-black tracking-wide uppercase text-[#90D2ED]">
              تسویه حساب سفارش ۱۰۰ هیچ
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Minimal High-Contrast Balance Banner */}
        <div className="my-4 p-4 rounded-2xl bg-[radial-gradient(120%_120%_at_50%_0%,rgba(140,19,24,0.3)_0%,rgba(12,25,48,0.6)_100%)] border border-white/10 text-center relative overflow-hidden">
          <span className="text-xs font-semibold text-slate-300 block mb-1">
            {tableOrCustomerLabel ? `مبلغ قابل تسویه (${tableOrCustomerLabel}):` : 'مبلغ کل فاکتور:'}
          </span>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight text-float-shadow">
              {formatToman(total)}
            </span>
            <span className="text-sm font-bold text-[#F5E8D0]">تومان</span>
          </div>
        </div>

        {/* 4 Distinct Payment Methods Segmented Control */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-400 block mb-2">
            روش پرداخت مورد نظر را انتخاب نمایید:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {/* POS */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setMethod('POS');
              }}
              className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                method === 'POS'
                  ? 'bg-gradient-to-b from-[rgba(140,19,24,0.9)] to-[rgba(100,12,16,0.9)] text-white border-[rgba(144,210,237,0.5)] shadow-[0_4px_16px_rgba(140,19,24,0.6)]'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs font-black">پوز / POS</span>
            </button>

            {/* CASH */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setMethod('CASH');
              }}
              className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                method === 'CASH'
                  ? 'bg-gradient-to-b from-[rgba(140,19,24,0.9)] to-[rgba(100,12,16,0.9)] text-white border-[rgba(144,210,237,0.5)] shadow-[0_4px_16px_rgba(140,19,24,0.6)]'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-xs font-black">نقدی / CASH</span>
            </button>

            {/* TRANSFER */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setMethod('TRANSFER');
              }}
              className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                method === 'TRANSFER'
                  ? 'bg-gradient-to-b from-[rgba(140,19,24,0.9)] to-[rgba(100,12,16,0.9)] text-white border-[rgba(144,210,237,0.5)] shadow-[0_4px_16px_rgba(140,19,24,0.6)]'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Send className="w-5 h-5" />
              <span className="text-xs font-black">کارت‌به‌کارت</span>
            </button>

            {/* SPLIT */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setMethod('SPLIT');
              }}
              className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                method === 'SPLIT'
                  ? 'bg-gradient-to-b from-[rgba(140,19,24,0.9)] to-[rgba(100,12,16,0.9)] text-white border-[rgba(144,210,237,0.5)] shadow-[0_4px_16px_rgba(140,19,24,0.6)]'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Split className="w-5 h-5" />
              <span className="text-xs font-black">تفکیکی / دونگی</span>
            </button>
          </div>
        </div>

        {/* Method Detail Panels */}
        <div className="mb-4">
          {/* 1. POS Terminal Panel */}
          {method === 'POS' && (
            <div className="space-y-3 bg-[rgba(8,16,32,0.6)] p-3.5 rounded-2xl border border-white/10">
              <label className="text-xs text-slate-300 font-bold block">
                دستگاه کارتخوان فعال:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTerminalName('پوز ۱ (بانک سامان)')}
                  className={`p-2.5 rounded-xl border text-right transition cursor-pointer text-xs ${
                    terminalName === 'پوز ۱ (بانک سامان)'
                      ? 'border-[#90D2ED] bg-[rgba(144,210,237,0.15)] text-white font-bold'
                      : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-white">پوز ۱ (بانک سامان)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">کانتر بار اصلی</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTerminalName('پوز ۲ (بانک ملت)')}
                  className={`p-2.5 rounded-xl border text-right transition cursor-pointer text-xs ${
                    terminalName === 'پوز ۲ (بانک ملت)'
                      ? 'border-[#90D2ED] bg-[rgba(144,210,237,0.15)] text-white font-bold'
                      : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-white">پوز ۲ (بانک ملت)</span>
                  <span className="text-[10px] text-slate-400 font-mono">سیار شوروم</span>
                </button>
              </div>

              {/* Reference ID */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">شناسه پیگیری فیش کارتخوان:</span>
                <input
                  type="text"
                  placeholder="مثال: ۸۴۹۲۳۱"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-lg px-2.5 py-1 text-white font-mono text-center text-xs focus:outline-none focus:border-[#90D2ED]"
                />
              </div>
            </div>
          )}

          {/* 2. CASH Panel */}
          {method === 'CASH' && (
            <div className="space-y-3 bg-[rgba(8,16,32,0.6)] p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-bold">مبلغ وجه دریافتی نقد (تومان):</label>
                <input
                  type="number"
                  value={cashTendered || ''}
                  onChange={(e) => setCashTendered(safeInt(e.target.value))}
                  className="bg-black/50 border border-white/20 rounded-xl px-3 py-1.5 text-white font-mono font-bold text-center text-sm w-36 focus:outline-none focus:border-[#90D2ED]"
                />
              </div>

              {/* Banknotes chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCashTendered(total)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#F5E8D0] text-[11px] font-bold border border-white/10 transition cursor-pointer"
                >
                  دقیقاً {formatToman(total)}
                </button>
                {COMMON_BANKNOTES_TOMAN.map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setCashTendered(note)}
                    className="px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-slate-300 text-[10px] font-mono border border-white/10 transition cursor-pointer"
                  >
                    {formatToman(note)} ت
                  </button>
                ))}
              </div>

              {/* Change due calculation */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">پول خرد برگشتی به مشتری (Change):</span>
                <span className={`font-mono font-black text-sm ${cashTendered >= total ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {cashTendered >= total
                    ? `${formatToman(changeDue)} تومان`
                    : 'وجه دریافتی ناکافی است'}
                </span>
              </div>
            </div>
          )}

          {/* 3. TRANSFER Panel */}
          {method === 'TRANSFER' && (
            <div className="space-y-3 bg-[rgba(8,16,32,0.6)] p-3.5 rounded-2xl border border-white/10">
              <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>حساب مقصد ۱۰۰ هیچ:</span>
                  <span className="text-[#90D2ED] font-mono">بانک سامان · شعبه مرکزی</span>
                </div>
                <div className="flex items-center justify-between text-white font-mono text-[11px]">
                  <span>شماره کارت:</span>
                  <span className="font-bold tracking-wider">۶۲۱۹-۸۶۱۰-۴۳۲۱-۹۸۷۶</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">شماره ارجاع / پیگیری حواله:</span>
                <input
                  type="text"
                  placeholder="مثال: ۹۳۸۴۷۱۲۹"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  className="bg-black/50 border border-white/20 rounded-xl px-3 py-1.5 text-white font-mono text-center text-xs w-40 focus:outline-none focus:border-[#90D2ED]"
                />
              </div>
            </div>
          )}

          {/* 4. SPLIT Panel */}
          {method === 'SPLIT' && (
            <div className="space-y-3 bg-[rgba(8,16,32,0.6)] p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">تفکیک حساب به دو بخش (دونگ):</span>
                <button
                  type="button"
                  onClick={handleApply5050Split}
                  className="px-2.5 py-1 rounded-lg bg-[rgba(140,19,24,0.3)] hover:bg-[rgba(140,19,24,0.5)] border border-[rgba(140,19,24,0.6)] text-rose-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>تقسیم مساوی ۵۰/۵۰</span>
                </button>
              </div>

              {/* Part A */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#8C1318] text-white flex items-center justify-center text-[10px] font-bold">۱</span>
                  <select
                    value={splitPartAMethod}
                    onChange={(e) => setSplitPartAMethod(e.target.value as any)}
                    className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="POS" className="bg-[#0C1E3C]">پوز (POS)</option>
                    <option value="CASH" className="bg-[#0C1E3C]">نقدی (Cash)</option>
                    <option value="TRANSFER" className="bg-[#0C1E3C]">کارت‌به‌کارت</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={partAAmount}
                    onChange={(e) => handlePartAChange(e.target.value)}
                    className="bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-white font-mono font-bold text-left text-xs w-28 focus:outline-none focus:border-[#90D2ED]"
                  />
                  <span className="text-[10px] text-slate-400">تومان</span>
                </div>
              </div>

              {/* Part B (Auto-calculated to guarantee integer balance) */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#0F4C81] text-white flex items-center justify-center text-[10px] font-bold">۲</span>
                  <select
                    value={splitPartBMethod}
                    onChange={(e) => setSplitPartBMethod(e.target.value as any)}
                    className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="POS" className="bg-[#0C1E3C]">پوز (POS)</option>
                    <option value="CASH" className="bg-[#0C1E3C]">نقدی (Cash)</option>
                    <option value="TRANSFER" className="bg-[#0C1E3C]">کارت‌به‌کارت</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-xs text-white bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 min-w-[7rem] text-left">
                    {formatToman(partBAmount)}
                  </span>
                  <span className="text-[10px] text-slate-400">تومان</span>
                </div>
              </div>

              {/* Invariant Status Check */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">کنترل موازنه دونگ‌ها:</span>
                <span className={`font-mono text-[11px] font-bold ${partAAmount + partBAmount === total ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {partAAmount + partBAmount === total
                    ? `✓ دقیقاً برابر ${formatToman(total)} تومان`
                    : `اختلاف ${formatToman(Math.abs(total - (partAAmount + partBAmount)))} تومان`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            انصراف
          </button>

          <button
            type="button"
            disabled={!canConfirm || isSubmitting}
            onClick={handleFinalConfirm}
            className={`w-2/3 py-3 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 shadow-lg ${
              canConfirm && !isSubmitting
                ? 'vision-checkout-cta tactile-press text-white'
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed opacity-50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تأیید و تسویه نهایی فاکتور</span>
          </button>
        </div>
      </div>
    </div>
  );
};
