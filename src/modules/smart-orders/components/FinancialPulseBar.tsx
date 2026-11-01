import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  AlertTriangle,
  Send,
  CreditCard,
  Banknote,
  Receipt,
  Plus,
  Minus,
  Trash2,
  Percent,
  MapPin,
  Command,
} from 'lucide-react';
import { SmartTicket } from '../types';
import { formatToman } from '../utils/farsiFormatting';
import { MotionConfig } from '../utils/zeroGMotionTokens';

export interface FinancialPulseBarProps {
  tickets: SmartTicket[];
  activeId: string;
  onPushToExecution?: () => void;
  onSettleActiveTicket?: (ticketId: string, method: 'CARD' | 'CASH') => void;
  onUpdateItemQuantity?: (ticketId: string, itemId: string, delta: number) => void;
  onRemoveItem?: (ticketId: string, itemId: string) => void;
  onChangeTableLabel?: (ticketId: string, tableLabel: string) => void;
  onApplyDiscount?: (ticketId: string, discountToman: number) => void;
}

const TABLE_PRESETS = ['میز ۱', 'میز ۲', 'میز ۳', 'میز ۴', 'کانتر بار', 'بیرون‌بر'];

export const FinancialPulseBar: React.FC<FinancialPulseBarProps> = ({
  tickets,
  activeId,
  onPushToExecution,
  onSettleActiveTicket,
  onUpdateItemQuantity,
  onRemoveItem,
  onChangeTableLabel,
  onApplyDiscount,
}) => {
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [customDiscount, setCustomDiscount] = useState('');

  const activeTickets = tickets.filter((t) => t.status !== 'Dispatched');
  const activeTicket = tickets.find((t) => t.id === activeId) || activeTickets[0];
  const isDraft = activeTicket?.status === 'Draft';

  // Telemetry KPIs
  const activeTicketsCount = activeTickets.length;
  const pendingVolumeToman = activeTickets.reduce((sum, t) => sum + t.total, 0);

  const breachedSlaCount = activeTickets.filter((t) => {
    const elapsed = (Date.now() - t.createdAt) / 1000;
    return elapsed >= t.targetSlaSeconds;
  }).length;

  const handleQuickPercentDiscount = (percent: number) => {
    if (activeTicket && onApplyDiscount) {
      const discount = Math.round((activeTicket.subtotal * percent) / 100);
      onApplyDiscount(activeTicket.id, discount);
      setShowDiscountModal(false);
    }
  };

  const handleCustomDiscountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(customDiscount.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(amount) && activeTicket && onApplyDiscount) {
      onApplyDiscount(activeTicket.id, amount);
      setShowDiscountModal(false);
      setCustomDiscount('');
    }
  };

  return (
    <div
      className="w-full lg:w-[360px] xl:w-[410px] bg-[#0E1116]/95 border-r border-white/[0.08] h-full flex flex-col justify-between shrink-0 select-none backdrop-blur-xl relative z-10"
      dir="rtl"
    >
      {/* Top Header: Telemetry Pulse */}
      <div className="p-3.5 border-b border-white/[0.08] bg-[#0F223D]/60 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D71921] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.6)]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white tracking-tight">نبض مالی صف (Financial Pulse)</h3>
              <p className="text-[11px] text-[#9EACB8]">تله‌متری آنلاین حجم سفارشات فعال</p>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>

        {/* 2 Main Telemetry KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {/* Active Tickets */}
          <div className="bg-[#161B22]/90 border border-white/[0.08] p-2.5 rounded-xl text-center shadow-inner">
            <span className="text-[10px] text-[#9EACB8] block">سفارشات فعال</span>
            <span className="text-lg font-black font-mono text-white num-heavy">
              {activeTicketsCount}
            </span>
          </div>

          {/* Pending Volume */}
          <div className="bg-[#161B22]/90 border border-white/[0.08] p-2.5 rounded-xl text-center col-span-2 shadow-inner">
            <span className="text-[10px] text-[#9EACB8] block">ارزش کل صف (Pending)</span>
            <span className="text-base font-black font-mono text-[#F3E9DD] num-heavy truncate block">
              {formatToman(pendingVolumeToman)}
            </span>
          </div>
        </div>

        {/* Breached SLA warning banner if any */}
        {breachedSlaCount > 0 && (
          <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-700/80 text-rose-200 text-xs flex items-center justify-between font-bold animate-fadeIn shadow-[0_0_15px_-2px_rgba(244,63,94,0.3)]">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>تأخیر از حد مجاز (SLA):</span>
            </div>
            <span className="font-mono bg-rose-900/90 px-2 py-0.5 rounded-md text-white font-black">
              {breachedSlaCount} سفارش
            </span>
          </div>
        )}
      </div>

      {/* Middle: Active Selected Ticket Detail */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {activeTicket ? (
          <div className="bg-[#161B22]/90 border border-white/[0.08] rounded-2xl p-3.5 space-y-3 shadow-md">
            {/* Ticket Header & Table Picker */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
              <div>
                <span className="text-[10px] text-[#9EACB8] block">تیکت انتخابی:</span>
                <bdi className="font-mono font-black text-sm text-white tracking-wide" dir="ltr">
                  {activeTicket.ticketCode || `#KW-${activeTicket.orderNumber}`}
                </bdi>
              </div>

              {/* Table / Location Badge or Selector */}
              {isDraft && onChangeTableLabel ? (
                <div className="flex items-center gap-1 overflow-x-auto max-w-[190px] no-scrollbar">
                  {TABLE_PRESETS.map((t) => (
                    <motion.button
                      key={t}
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => onChangeTableLabel(activeTicket.id, t)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                        activeTicket.tableLabel === t
                          ? 'bg-[#D71921] border-[#D71921] text-white font-bold shadow-xs'
                          : 'bg-[#0E1116] border-white/[0.08] text-[#9EACB8] hover:text-white'
                      }`}
                    >
                      {t}
                    </motion.button>
                  ))}
                </div>
              ) : (
                activeTicket.tableLabel && (
                  <span className="text-xs bg-[#0E1116] text-white px-2.5 py-1 rounded-lg border border-white/[0.08] font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span>{activeTicket.tableLabel}</span>
                  </span>
                )
              )}
            </div>

            {/* Items inside active ticket (Staggered Ledger Additions with ticketItemSpring) */}
            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
              {activeTicket.items.length > 0 ? (
                <AnimatePresence>
                  {activeTicket.items.map((it) => (
                    <motion.div
                      key={it.id}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={MotionConfig.ticketItemSpring}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.04] last:border-none gap-2 animate-ticket-item-spring"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-100 font-bold truncate leading-tight">{it.title}</div>
                        {it.modifiers && it.modifiers.length > 0 && (
                          <div className="text-[10px] text-[#9EACB8] truncate">
                            {it.modifiers.map((m) => m.nameFa).join('، ')}
                          </div>
                        )}
                        {it.notes && (
                          <div className="text-[10px] text-amber-400/90 italic truncate">
                            *{it.notes}
                          </div>
                        )}
                      </div>

                      {/* Quantity controls if draft */}
                      {isDraft && onUpdateItemQuantity && onRemoveItem ? (
                        <div className="flex items-center gap-1 bg-[#0E1116] p-0.5 rounded-lg border border-white/[0.08]">
                          <motion.button
                            type="button"
                            whileTap={MotionConfig.tactileTap}
                            onClick={() => {
                              if (it.quantity > 1) {
                                onUpdateItemQuantity(activeTicket.id, it.id, -1);
                              } else {
                                onRemoveItem(activeTicket.id, it.id);
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-white/[0.1] text-[#9EACB8] hover:text-white transition-colors cursor-pointer"
                            title="کاهش تعداد"
                          >
                            {it.quantity > 1 ? (
                              <Minus className="w-3 h-3" />
                            ) : (
                              <Trash2 className="w-3 h-3 text-rose-400" />
                            )}
                          </motion.button>
                          <span className="font-mono text-xs font-bold text-white px-1.5 num-heavy">
                            {it.quantity}
                          </span>
                          <motion.button
                            type="button"
                            whileTap={MotionConfig.tactileTap}
                            onClick={() => onUpdateItemQuantity(activeTicket.id, it.id, 1)}
                            className="p-1.5 rounded-md hover:bg-white/[0.1] text-[#9EACB8] hover:text-white transition-colors cursor-pointer"
                            title="افزایش تعداد"
                          >
                            <Plus className="w-3 h-3" />
                          </motion.button>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[#9EACB8] font-bold num-heavy">
                          {it.quantity}×
                        </span>
                      )}

                      <span className="font-mono text-xs text-[#F3E9DD] font-semibold shrink-0 num-heavy">
                        {formatToman(it.subtotal)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="text-center py-6 text-[#9EACB8] text-xs">
                  <span>هیچ آیتمی به این پیش‌نویس اضافه نشده است.</span>
                  <span className="block text-[10px] text-[#526071] mt-1">
                    (کلیدهای ۱ تا ۹ یا کلیک روی منو)
                  </span>
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#9EACB8]">
                <span>جمع اقلام:</span>
                <span className="font-mono num-heavy">{formatToman(activeTicket.subtotal)}</span>
              </div>

              {/* Discount Row */}
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9EACB8]">تخفیف:</span>
                  {isDraft && onApplyDiscount && (
                    <button
                      type="button"
                      onClick={() => setShowDiscountModal((p) => !p)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Percent className="w-2.5 h-2.5" />
                      <span>تنظیم</span>
                    </button>
                  )}
                </div>
                <span className="font-mono text-rose-400 font-bold num-heavy">
                  {activeTicket.discount > 0 ? `-${formatToman(activeTicket.discount)}` : '۰ تومان'}
                </span>
              </div>

              {/* Quick Discount Drawer if Open */}
              {showDiscountModal && isDraft && (
                <div className="p-2.5 rounded-xl bg-[#0E1116] border border-white/[0.08] space-y-2 animate-fadeIn shadow-inner">
                  <div className="flex gap-1">
                    <motion.button
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => handleQuickPercentDiscount(5)}
                      className="flex-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-[10px] font-bold text-white border border-white/[0.08] transition-colors"
                    >
                      ۵٪
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => handleQuickPercentDiscount(10)}
                      className="flex-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-[10px] font-bold text-white border border-white/[0.08] transition-colors"
                    >
                      ۱۰٪
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => handleQuickPercentDiscount(15)}
                      className="flex-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-[10px] font-bold text-white border border-white/[0.08] transition-colors"
                    >
                      ۱۵٪
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => handleQuickPercentDiscount(20)}
                      className="flex-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-[10px] font-bold text-white border border-white/[0.08] transition-colors"
                    >
                      ۲۰٪
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => {
                        onApplyDiscount?.(activeTicket.id, 0);
                        setShowDiscountModal(false);
                      }}
                      className="flex-1 py-1 rounded-lg bg-rose-950/80 text-rose-300 text-[10px] font-bold border border-rose-800 transition-colors"
                    >
                      حذف
                    </motion.button>
                  </div>
                  <form onSubmit={handleCustomDiscountSubmit} className="flex gap-1.5">
                    <input
                      type="text"
                      value={customDiscount}
                      onChange={(e) => setCustomDiscount(e.target.value)}
                      placeholder="مبلغ دستی تومان..."
                      className="flex-1 bg-[#161B22] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-400"
                    />
                    <motion.button
                      type="submit"
                      whileTap={MotionConfig.tactileTap}
                      className="bg-[#D71921] hover:bg-[#B8141B] text-white px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      اعمال
                    </motion.button>
                  </form>
                </div>
              )}

              {/* Total Payable */}
              <div className="flex justify-between text-white font-black text-sm pt-2 border-t border-white/[0.08]">
                <span>مبلغ قابل پرداخت:</span>
                <span className="font-mono text-[#D71921] num-heavy text-base font-black">
                  {formatToman(activeTicket.total)}
                </span>
              </div>
            </div>

            {/* Fast Settlement Triggers */}
            {onSettleActiveTicket && activeTicket.status !== 'Dispatched' && (
              <div className="pt-2 grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  whileTap={MotionConfig.tactileTap}
                  onClick={() => onSettleActiveTicket(activeTicket.id, 'CARD')}
                  className="bg-[#0F223D] hover:bg-[#1A3358] border border-white/[0.08] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-xs"
                >
                  <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                  <span>تسویه کارتخوان</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={MotionConfig.tactileTap}
                  onClick={() => onSettleActiveTicket(activeTicket.id, 'CASH')}
                  className="bg-[#161B22] hover:bg-[#202834] border border-white/[0.08] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-xs"
                >
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تسویه نقدی</span>
                </motion.button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-[#9EACB8]">
            <Receipt className="w-6 h-6 mx-auto mb-2 text-[#526071]" />
            <span>یک سفارش را از لیست وسط انتخاب کنید</span>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action: Push to Execution Trigger with Keycap Badge */}
      <div className="p-3.5 border-t border-white/[0.08] bg-[#0F223D]/90 backdrop-blur-md">
        <motion.button
          type="button"
          whileTap={MotionConfig.tactileTap}
          onClick={onPushToExecution}
          disabled={!activeTicket || activeTicket.items.length === 0}
          className="w-full bg-[#D71921] hover:bg-[#B8141B] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none text-white py-3.5 rounded-xl font-black text-sm shadow-[0_0_25px_-2px_rgba(215,25,33,0.6)] hover:shadow-[0_0_35px_0_rgba(215,25,33,0.8)] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Send className="w-4 h-4 fill-white" />
          <span>ثبت و ارسال سفارش (Push to Execution)</span>
          <span className="keycap-badge px-1.5 py-0.5 text-[10px] text-white border-white/30 shadow-none ml-1 bg-black/40">
            Ctrl+↵
          </span>
        </motion.button>
      </div>
    </div>
  );
};
