import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Send,
  CreditCard,
  Banknote,
  Receipt,
  Layers,
} from 'lucide-react';
import { SmartTicket } from '../types';
import { formatToman } from '../utils/farsiFormatting';

export interface FinancialPulseBarProps {
  tickets: SmartTicket[];
  activeId: string;
  onPushToExecution?: () => void;
  onSettleActiveTicket?: (ticketId: string, method: 'CARD' | 'CASH') => void;
}

export const FinancialPulseBar: React.FC<FinancialPulseBarProps> = ({
  tickets,
  activeId,
  onPushToExecution,
  onSettleActiveTicket,
}) => {
  const activeTickets = tickets.filter((t) => t.status !== 'Dispatched');
  const activeTicket = tickets.find((t) => t.id === activeId) || activeTickets[0];

  // Telemetry KPIs
  const activeTicketsCount = activeTickets.length;
  const pendingVolumeToman = activeTickets.reduce((sum, t) => sum + t.total, 0);

  const breachedSlaCount = activeTickets.filter((t) => {
    const elapsed = (Date.now() - t.createdAt) / 1000;
    return elapsed >= t.targetSlaSeconds;
  }).length;

  return (
    <div
      className="w-full lg:w-[360px] xl:w-[400px] bg-[#121417] border-r border-[#293444] h-full flex flex-col justify-between shrink-0 select-none shadow-xl"
      dir="rtl"
    >
      {/* Top Header: Telemetry Pulse */}
      <div className="p-4 border-b border-[#293444] bg-[#0F223D]/80 backdrop-blur-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D71921] text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">نبض مالی صف (Financial Pulse)</h3>
              <p className="text-[11px] text-[#9EACB8]">تله‌متری آنلاین حجم سفارشات فعال</p>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>

        {/* 3 Main KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {/* Active Tickets */}
          <div className="bg-[#1B222C] border border-[#293444] p-2.5 rounded-xl text-center">
            <span className="text-[10px] text-[#9EACB8] block">سفارشات فعال</span>
            <span className="text-base font-black font-mono text-white num-heavy">
              {activeTicketsCount}
            </span>
          </div>

          {/* Pending Volume */}
          <div className="bg-[#1B222C] border border-[#293444] p-2.5 rounded-xl text-center col-span-2">
            <span className="text-[10px] text-[#9EACB8] block">ارزش کل صف (Pending)</span>
            <span className="text-sm font-black font-mono text-[#F3E9DD] num-heavy truncate block">
              {formatToman(pendingVolumeToman)}
            </span>
          </div>
        </div>

        {/* Breached SLA warning banner if any */}
        {breachedSlaCount > 0 && (
          <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-between font-bold animate-fadeIn">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>تأخیر از حد مجاز (SLA):</span>
            </div>
            <span className="font-mono bg-rose-900 px-2 py-0.5 rounded-md text-white">
              {breachedSlaCount} سفارش
            </span>
          </div>
        )}
      </div>

      {/* Middle: Active Selected Ticket Detail */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeTicket ? (
          <div className="bg-[#161B22] border border-[#293444] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#293444]">
              <div>
                <span className="text-[10px] text-[#9EACB8] block">تیکت انتخاب‌شده</span>
                <span className="font-mono font-black text-sm text-white">
                  {activeTicket.ticketCode || `#KW-${activeTicket.orderNumber}`}
                </span>
              </div>
              {activeTicket.tableLabel && (
                <span className="text-xs bg-[#121417] text-white px-2 py-1 rounded-lg border border-[#293444] font-bold">
                  {activeTicket.tableLabel}
                </span>
              )}
            </div>

            {/* Items inside active ticket */}
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {activeTicket.items.map((it) => (
                <div key={it.id} className="flex justify-between text-xs py-1 border-b border-[#293444]/40">
                  <span className="text-white font-medium">
                    {it.quantity}× {it.title}
                  </span>
                  <span className="font-mono text-[#F3E9DD]">{formatToman(it.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="pt-2 border-t border-[#293444] space-y-1 text-xs">
              <div className="flex justify-between text-[#9EACB8]">
                <span>جمع اقلام:</span>
                <span className="font-mono">{formatToman(activeTicket.subtotal)}</span>
              </div>
              {activeTicket.discount > 0 && (
                <div className="flex justify-between text-rose-400 font-bold">
                  <span>تخفیف:</span>
                  <span className="font-mono">-{formatToman(activeTicket.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-black text-sm pt-1 border-t border-[#293444]">
                <span>مبلغ قابل پرداخت:</span>
                <span className="font-mono text-[#D71921] num-heavy">
                  {formatToman(activeTicket.total)}
                </span>
              </div>
            </div>

            {/* Fast Settlement Triggers */}
            {onSettleActiveTicket && activeTicket.status !== 'Dispatched' && (
              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSettleActiveTicket(activeTicket.id, 'CARD')}
                  className="bg-[#0F223D] hover:bg-[#1B3255] border border-[#293444] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  <span>تسویه کارتخوان</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSettleActiveTicket(activeTicket.id, 'CASH')}
                  className="bg-[#1B222C] hover:bg-[#222B38] border border-[#293444] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تسویه نقدی</span>
                </button>
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

      {/* Bottom Sticky Action: Push to Execution Trigger */}
      <div className="p-4 border-t border-[#293444] bg-[#0F223D]/90 backdrop-blur-md">
        <button
          type="button"
          onClick={onPushToExecution}
          className="w-full bg-[#D71921] hover:bg-[#B8141B] active:scale-98 text-white py-3.5 rounded-xl font-black text-sm shadow-[0_0_25px_-3px_rgba(215,25,33,0.55)] transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>ثبت و ارسال سفارش (Push to Execution)</span>
        </button>
      </div>
    </div>
  );
};
