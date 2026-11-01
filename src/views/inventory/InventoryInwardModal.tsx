/**
 * CAFE OS — Inventory Inward Modal (InventoryInwardModal.tsx)
 * Module: InventoryInwardModule (v2.5.0)
 * 
 * Features:
 *  - Form for registering new supplier purchase invoices (Stock Inward)
 *  - Real-time Dynamic Weighted Average Cost (WAC) recalculation
 *  - Atomic update to RawIngredient stock and BOM cost
 *  - IndexedDB transaction persistence in stockInwardTransactions
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PackagePlus,
  Boxes,
  Truck,
  Hash,
  Scale,
  DollarSign,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { RawIngredient } from '../../types/inventory-tab';
import { inventoryBomService } from '../../services/inventoryBomService';
import { formatToman } from '../../services/financialMath';
import { audioFeedback } from '../../services/audioFeedback';

interface InventoryInwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: RawIngredient[];
  onInwardSuccess?: () => void;
  operatorName?: string;
}

export const InventoryInwardModal: React.FC<InventoryInwardModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  onInwardSuccess,
  operatorName = 'مسئول انبار',
}) => {
  const [selectedRawItemId, setSelectedRawItemId] = useState<string>(
    ingredients[0]?.id || ''
  );
  const [batchNumber, setBatchNumber] = useState<string>(
    `BATCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  );
  const [incomingQty, setIncomingQty] = useState<number>(5000);
  const [purchaseCostPerUnit, setPurchaseCostPerUnit] = useState<number>(1800);
  const [supplierName, setSupplierName] = useState<string>('رستری ۱۰۰هیچ (100 HICH Roasters)');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const selectedIngredient = useMemo(() => {
    return ingredients.find((i) => i.id === selectedRawItemId) || ingredients[0];
  }, [ingredients, selectedRawItemId]);

  // Update default unit cost when selected ingredient changes
  React.useEffect(() => {
    if (selectedIngredient) {
      setPurchaseCostPerUnit(selectedIngredient.cost_per_unit || 1000);
      if (selectedIngredient.unit === 'g') {
        setIncomingQty(5000); // 5 kg
      } else if (selectedIngredient.unit === 'ml') {
        setIncomingQty(10000); // 10 L
      } else {
        setIncomingQty(20);
      }
    }
  }, [selectedIngredient]);

  // Real-time Weighted Average Cost (WAC) calculations
  const wacCalculation = useMemo(() => {
    if (!selectedIngredient) {
      return {
        previousStock: 0,
        newStock: 0,
        previousCost: 0,
        purchaseCost: 0,
        weightedAverageCost: 0,
        totalInvoiceCost: 0,
        unit: 'واحد',
      };
    }

    const previousStock = Math.max(0, selectedIngredient.current_stock);
    const qty = Math.max(0, incomingQty);
    const newStock = previousStock + qty;
    const previousCost = selectedIngredient.cost_per_unit;
    const purchaseCost = Math.max(0, purchaseCostPerUnit);

    let weightedAverageCost = purchaseCost;
    if (previousStock > 0 && newStock > 0) {
      const prevVal = previousStock * previousCost;
      const incomingVal = qty * purchaseCost;
      weightedAverageCost = Math.round((prevVal + incomingVal) / newStock);
    }

    const totalInvoiceCost = Math.round(qty * purchaseCost);

    return {
      previousStock,
      newStock,
      previousCost,
      purchaseCost,
      weightedAverageCost,
      totalInvoiceCost,
      unit: selectedIngredient.unit,
    };
  }, [selectedIngredient, incomingQty, purchaseCostPerUnit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRawItemId) {
      setErrorMsg('لطفاً ماده اولیه مورد نظر را انتخاب کنید.');
      return;
    }
    if (incomingQty <= 0) {
      setErrorMsg('مقدار وارده باید بزرگتر از صفر باشد.');
      return;
    }
    if (purchaseCostPerUnit <= 0) {
      setErrorMsg('قیمت خرید هر واحد باید بزرگتر از صفر باشد.');
      return;
    }
    if (!supplierName.trim()) {
      setErrorMsg('نام تأمین‌کننده الزامی است.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await inventoryBomService.recordStockInward({
        raw_item_id: selectedRawItemId,
        batch_number: batchNumber,
        incoming_quantity: incomingQty,
        purchase_cost_per_unit: purchaseCostPerUnit,
        supplier_name: supplierName,
        notes: invoiceNotes,
        operator_name: operatorName,
      });

      audioFeedback.playSuccess();
      setSuccessNotice(
        `فاکتور ورود بار "${selectedIngredient?.title_fa}" با موفقیت ثبت شد و میانگین موزون قیمت تمام‌شده به‌روز گردید.`
      );

      setTimeout(() => {
        setSuccessNotice(null);
        if (onInwardSuccess) onInwardSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      audioFeedback.playError();
      setErrorMsg(err.message || 'خطا در ثبت فاکتور ورود بار به انبار');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitFa =
    wacCalculation.unit === 'g'
      ? 'گرم'
      : wacCalculation.unit === 'ml'
      ? 'میلی‌لیتر'
      : 'عدد';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-4 backdrop-blur-sm bg-black/80 select-none overflow-y-auto">
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          className="relative w-full max-w-2xl bg-[#1F242C] rounded-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
          dir="rtl"
        >
          {/* Header Bar */}
          <div className="bg-[#161A1F] border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>ثبت فاکتور خرید جدید (ورود بار به انبار / Stock Inward)</span>
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono font-bold">
                    WAC ENGINE
                  </span>
                </h3>
                <p className="text-xs text-[#9EACB8]">
                  افزایش موجودی دانه‌ها و شیرها به همراه اصلاح میانگین موزون قیمت تمام‌شده
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-600/40 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D71921] shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successNotice && (
              <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Field 1: Raw Item Select */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-blue-400" />
                <span>انتخاب ماده اولیه ورودی:</span>
              </label>
              <select
                value={selectedRawItemId}
                onChange={(e) => setSelectedRawItemId(e.target.value)}
                className="w-full bg-[#161A1F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#D71921] focus:outline-none"
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.title_fa} ({ing.title_en}) — موجودی: {ing.current_stock.toLocaleString('fa-IR')} {ing.unit} — قیمت فعلی: {formatToman(ing.cost_per_unit)} ت/{ing.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid: Batch Number & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber-400" />
                  <span>شماره پارت / بچ فاکتور (Batch Number):</span>
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="مثال: BATCH-2026-11-K01"
                  className="w-full bg-[#161A1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-purple-400" />
                  <span>نام تأمین‌کننده / فروشنده:</span>
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="نام شرکت یا بازرگانی تأمین‌کننده..."
                  className="w-full bg-[#161A1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
                />
              </div>
            </div>

            {/* Grid: Incoming Quantity & Purchase Cost per Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  <span>مقدار وارده جدید ({unitFa}):</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step={wacCalculation.unit === 'g' || wacCalculation.unit === 'ml' ? '50' : '1'}
                    value={incomingQty || ''}
                    onChange={(e) => setIncomingQty(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#161A1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none pl-12"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-2.5 text-[11px] text-gray-400 font-bold">
                    {wacCalculation.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  <span>قیمت خرید هر واحد فاکتور (تومان):</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="50"
                    value={purchaseCostPerUnit || ''}
                    onChange={(e) =>
                      setPurchaseCostPerUnit(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full bg-[#161A1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none pl-14"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-2.5 text-[11px] text-gray-400 font-bold">تومان</span>
                </div>
              </div>
            </div>

            {/* Live Weighted Average Cost (WAC) Metric Box */}
            <div className="bg-[#161A1F] rounded-xl border border-emerald-500/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  <span>تحلیل لحظه‌ای میانگین موزون متحرک (Weighted Average Cost):</span>
                </div>
                <span className="text-[10px] text-[#9EACB8] font-mono">حسابداری انبار WAC</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-[#1F242C] p-2.5 rounded-lg border border-white/5">
                  <span className="text-[10px] text-gray-400 block">موجودی قبلی:</span>
                  <span className="font-mono font-bold text-gray-200">
                    {wacCalculation.previousStock.toLocaleString('fa-IR')} {unitFa}
                  </span>
                </div>

                <div className="bg-[#1F242C] p-2.5 rounded-lg border border-white/5">
                  <span className="text-[10px] text-gray-400 block">موجودی پس از ورود:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {wacCalculation.newStock.toLocaleString('fa-IR')} {unitFa}
                  </span>
                </div>

                <div className="bg-[#1F242C] p-2.5 rounded-lg border border-white/5">
                  <span className="text-[10px] text-gray-400 block">نرخ خرید قبلی:</span>
                  <span className="font-mono text-gray-300">
                    {formatToman(wacCalculation.previousCost)} ت
                  </span>
                </div>

                <div className="bg-[#1F242C] p-2.5 rounded-lg border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 font-bold block">نرخ تمام‌شده موزون جدید:</span>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    {formatToman(wacCalculation.weightedAverageCost)} ت
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#9EACB8] pt-1">
                <span>
                  مبلغ کل فاکتور ورودی:{' '}
                  <strong className="text-white font-mono">
                    {formatToman(wacCalculation.totalInvoiceCost)} تومان
                  </strong>
                </span>
                <span className="text-[11px] text-emerald-400">
                  فرمولاسیون رسپی تمام نوشیدنی‌های شامل این ماده بلافاصله بازنگری خواهند شد.
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                یادداشت یا شماره فاکتور فیزیکی (اختیاری):
              </label>
              <input
                type="text"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="مثال: فاکتور شماره ۷۸۴۴ بازرگانی قهوه..."
                className="w-full bg-[#161A1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
              />
            </div>
          </form>

          {/* Action Footer */}
          <div className="bg-[#161A1F] border-t border-white/5 p-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-[#1F242C] hover:bg-[#2A313C] text-xs font-bold text-[#9EACB8] hover:text-white transition-all cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#0EA271] text-xs font-black text-white flex items-center gap-2 shadow-[0_0_15px_-2px_rgba(16,185,129,0.5)] transition-all cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال محاسبه و ثبت...' : 'ثبت قطعی ورود بار به انبار'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
