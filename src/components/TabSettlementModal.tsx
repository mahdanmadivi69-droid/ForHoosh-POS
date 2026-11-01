import React, { useState } from 'react';
import {
  CreditCard,
  Banknote,
  Users,
  Printer,
  CheckCircle2,
  X,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Percent,
} from 'lucide-react';
import { TableSessionTab } from '../types/inventory-tab';
import { formatToman } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';
import { printThermalReceipt } from '../services/receiptPrinter';

interface TabSettlementModalProps {
  isOpen: boolean;
  tab: TableSessionTab | null;
  onClose: () => void;
  onConfirmSettlement: (paymentData: {
    paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
    terminalName: string;
    referenceCode?: string;
    cashTendered?: number;
    splitCount?: number;
  }) => void;
}

const BANKNOTES_TOMAN = [50000, 100000, 200000, 500000, 1000000, 2000000];

export const TabSettlementModal: React.FC<TabSettlementModalProps> = ({
  isOpen,
  tab,
  onClose,
  onConfirmSettlement,
}) => {
  if (!isOpen || !tab) return null;

  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH' | 'SPLIT'>('CARD');
  const [terminalName, setTerminalName] = useState('پوز ۱ (بانک سامان)');
  const [referenceCode, setReferenceCode] = useState('');
  const [cashTendered, setCashTendered] = useState<number>(tab.total_due);
  const [splitCount, setSplitCount] = useState<number>(Math.max(2, tab.guest_count || 2));
  const [isReceiptPrinting, setIsReceiptPrinting] = useState(false);

  const changeDue = Math.max(0, cashTendered - tab.total_due);
  const splitAmountPerPerson = Math.ceil(tab.total_due / splitCount);

  // Print Proforma or Final Receipt
  const handlePrintReceipt = () => {
    setIsReceiptPrinting(true);
    playPosBeep('click');
    try {
      const allItems = tab.rounds.flatMap((r) => r.items);
      printThermalReceipt({
        invoiceNo: parseInt(tab.tab_id.replace(/\D/g, '').slice(-4), 10) || 101,
        dateTime: new Date().toISOString(),
        orderType: 'سالن (Dine-In)',
        cashier: tab.server_name,
        customerName: `مهمان ${tab.table_label}`,
        tableLabel: tab.table_label,
        items: allItems.map((it) => ({
          name: it.title,
          qty: it.quantity,
          price: it.unitPrice,
          modifiers: it.modifiers?.map((m) => m.nameFa),
          notes: it.notes,
        })),
        subtotalAmount: tab.subtotal,
        discountAmount: tab.discount,
        totalAmount: tab.total_due,
        paymentMethod:
          paymentMethod === 'CASH'
            ? 'نقدی'
            : paymentMethod === 'CARD'
            ? terminalName
            : 'پرداخت تفکیکی (دونگی)',
        referenceCode: referenceCode || undefined,
        cashTendered: paymentMethod === 'CASH' ? cashTendered : undefined,
        changeDue: paymentMethod === 'CASH' ? changeDue : undefined,
      });
    } catch (e) {
      console.error('Print receipt failed', e);
    } finally {
      setTimeout(() => setIsReceiptPrinting(false), 800);
    }
  };

  const handleFinalize = () => {
    onConfirmSettlement({
      paymentMethod,
      terminalName,
      referenceCode: referenceCode || undefined,
      cashTendered: paymentMethod === 'CASH' ? cashTendered : undefined,
      splitCount: paymentMethod === 'SPLIT' ? splitCount : undefined,
    });
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto select-none"
      style={{ fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)" }}
    >
      <div className="w-full max-w-xl bg-[#151B25] border border-[#232D3E] rounded-3xl p-6 shadow-2xl space-y-5 animate-fadeIn max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#232D3E]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0D1015] border border-[#D71921]/40 flex items-center justify-center text-[#D71921]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                تسویه حساب نهایی و آزادسازی میز ({tab.table_label})
              </h2>
              <p className="text-xs text-[#9EACB8]">
                مهمانداری: {tab.server_name} • تعداد مهمانان: {tab.guest_count} نفر • دورهای سفارش: {tab.rounds.length} دور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-[#9EACB8] hover:text-white hover:bg-white/[0.05]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Summary Cards & Rounds breakdown */}
        <div className="bg-[#0D1015] border border-[#232D3E] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#9EACB8]">
            <span>تفکیک دورهای سفارش در این میز:</span>
            <span>{tab.rounds.flatMap((r) => r.items).length} قلم کل</span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {tab.rounds.map((round) => (
              <div key={round.round_number} className="bg-[#151B25] p-2.5 rounded-xl border border-[#232D3E] text-xs">
                <div className="flex justify-between items-center text-[11px] text-amber-400 font-bold mb-1">
                  <span>دور {round.round_number} سفارش:</span>
                  <span className="text-[#9EACB8] font-mono">
                    {new Date(round.dispatched_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {round.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-slate-200">
                      <span>{it.quantity}× {it.title}</span>
                      <span className="font-mono text-slate-300">{formatToman(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Totals */}
          <div className="pt-2 border-t border-[#232D3E] space-y-1 text-xs">
            <div className="flex justify-between text-[#9EACB8]">
              <span>جمع ناخالص اقلام:</span>
              <span className="font-mono">{formatToman(tab.subtotal)}</span>
            </div>
            {tab.discount > 0 && (
              <div className="flex justify-between text-rose-400 font-bold">
                <span>تخفیف اعمال‌شده:</span>
                <span className="font-mono">-{formatToman(tab.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-black text-sm pt-1.5 border-t border-[#232D3E]">
              <span>مبلغ نهایی قابل تسویه:</span>
              <bdi className="font-mono text-lg text-[#D71921] font-black" dir="ltr">
                {formatToman(tab.total_due)}
              </bdi>
            </div>
          </div>
        </div>

        {/* Payment Methods Selection */}
        <div className="space-y-3">
          <label className="text-xs font-black text-white block">روش پرداخت مشتری:</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('CARD');
                playPosBeep('click');
              }}
              className={`py-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                paymentMethod === 'CARD'
                  ? 'bg-[#151B25] border-[#D71921] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.4)]'
                  : 'bg-[#0D1015] border-[#232D3E] text-[#9EACB8] hover:text-white'
              }`}
            >
              <CreditCard className="w-5 h-5 text-sky-400" />
              <span>دستگاه پوز بانکی</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentMethod('CASH');
                playPosBeep('click');
              }}
              className={`py-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                paymentMethod === 'CASH'
                  ? 'bg-[#151B25] border-emerald-500 text-white shadow-[0_0_15px_-2px_rgba(16,185,129,0.4)]'
                  : 'bg-[#0D1015] border-[#232D3E] text-[#9EACB8] hover:text-white'
              }`}
            >
              <Banknote className="w-5 h-5 text-emerald-400" />
              <span>پرداخت نقدی</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentMethod('SPLIT');
                playPosBeep('click');
              }}
              className={`py-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                paymentMethod === 'SPLIT'
                  ? 'bg-[#151B25] border-amber-500 text-white shadow-[0_0_15px_-2px_rgba(245,158,11,0.4)]'
                  : 'bg-[#0D1015] border-[#232D3E] text-[#9EACB8] hover:text-white'
              }`}
            >
              <Users className="w-5 h-5 text-amber-400" />
              <span>تقسیم دونگی (Split)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Context: CARD details */}
        {paymentMethod === 'CARD' && (
          <div className="bg-[#0D1015] border border-[#232D3E] rounded-2xl p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">دستگاه پوز انتخابی:</label>
                <select
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  className="w-full bg-[#151B25] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-bold"
                >
                  <option value="پوز ۱ (بانک سامان)">پوز ۱ (بانک سامان)</option>
                  <option value="پوز ۲ (بانک ملت)">پوز ۲ (بانک ملت)</option>
                  <option value="پوز ۳ (بانک پاسارگاد)">پوز ۳ (بانک پاسارگاد)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">شماره پیگیری / ارجاع کارتخوان:</label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="مثال: ۹۸۷۶۵۴"
                  className="w-full bg-[#151B25] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Context: CASH details */}
        {paymentMethod === 'CASH' && (
          <div className="bg-[#0D1015] border border-[#232D3E] rounded-2xl p-4 space-y-3 text-xs">
            <div>
              <label className="block text-[#9EACB8] mb-1 font-bold">مبلغ وجه نقد دریافتی از مشتری (تومان):</label>
              <input
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#151B25] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Quick Banknote Injections */}
            <div className="flex gap-1.5 flex-wrap">
              {BANKNOTES_TOMAN.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => setCashTendered((prev) => prev + note)}
                  className="px-2.5 py-1 rounded-lg bg-[#151B25] text-slate-300 border border-[#232D3E] font-mono text-[11px] hover:text-white hover:border-emerald-500"
                >
                  +{formatToman(note)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashTendered(tab.total_due)}
                className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[11px] font-bold"
              >
                مبلغ دقیق
              </button>
            </div>

            <div className="pt-2 border-t border-[#232D3E] flex justify-between items-center">
              <span className="text-[#9EACB8] font-bold">باقی‌مانده پول مشتری (Change Due):</span>
              <span className={`font-mono font-black text-sm ${changeDue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {changeDue >= 0 ? `${formatToman(changeDue)}` : 'مبلغ ناکافی'}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Context: SPLIT CHECK details */}
        {paymentMethod === 'SPLIT' && (
          <div className="bg-[#0D1015] border border-[#232D3E] rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">تعداد نفرات برای تقسیم دونگی:</span>
              <div className="flex items-center gap-2">
                {[2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSplitCount(num)}
                    className={`w-8 h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                      splitCount === num
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-[#151B25] text-[#9EACB8] border border-[#232D3E]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#151B25] rounded-xl border border-amber-500/30 flex justify-between items-center">
              <span className="text-amber-300 font-bold">سهم هر نفر (برای {splitCount} نفر):</span>
              <bdi className="font-mono text-base font-black text-amber-400" dir="ltr">
                {formatToman(splitAmountPerPerson)}
              </bdi>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#232D3E]">
          <button
            type="button"
            onClick={handlePrintReceipt}
            disabled={isReceiptPrinting}
            className="px-4 py-3 rounded-2xl bg-[#0D1015] border border-[#232D3E] hover:border-slate-400 text-slate-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>{isReceiptPrinting ? 'در حال چاپ...' : 'چاپ فاکتور نهایی'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-[#0D1015] border border-[#232D3E] text-[#9EACB8] hover:text-white text-xs font-bold cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              className="px-6 py-3 rounded-2xl bg-[#D71921] hover:bg-[#b8141b] text-white text-xs font-black shadow-[0_0_20px_-2px_rgba(215,25,33,0.6)] flex items-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تکمیل تسویه و آزادسازی میز</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
