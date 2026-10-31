import React from 'react';
import {
  Clock,
  ArrowLeft,
  PauseCircle,
  Scissors,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import { SmartTicket, OrderStatus } from '../types';
import { formatToman } from '../utils/farsiFormatting';
import { useSlaCountdown } from '../hooks/useSlaCountdown';

export interface SmartOrderCardProps {
  ticket: SmartTicket;
  isActive: boolean;
  onSelect: (ticketId: string) => void;
  onAdvanceStatus: (ticketId: string) => void;
  onParkToggle?: (ticketId: string) => void;
  onSplitOrder?: (ticketId: string) => void;
}

export const SmartOrderCard: React.FC<SmartOrderCardProps> = ({
  ticket,
  isActive,
  onSelect,
  onAdvanceStatus,
  onParkToggle,
  onSplitOrder,
}) => {
  const isCompleted = ticket.status === 'Dispatched';
  const { formattedElapsed, percentage, slaColor, isBreached } = useSlaCountdown(
    ticket.createdAt,
    ticket.targetSlaSeconds,
    isCompleted
  );

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Draft':
        return { label: 'پیش‌نویس', bg: 'bg-stone-800 text-stone-300 border-stone-700' };
      case 'Queued':
        return { label: 'در صف انتظار', bg: 'bg-amber-950/70 text-amber-300 border-amber-700/80' };
      case 'In-Prep':
        return { label: 'در حال آماده‌سازی', bg: 'bg-blue-950/70 text-blue-300 border-blue-700/80' };
      case 'Ready':
        return { label: 'آماده تحویل', bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/80' };
      case 'Dispatched':
        return { label: 'تحویل شد / تسویه', bg: 'bg-gray-800/80 text-gray-400 border-gray-700' };
    }
  };

  const badge = getStatusBadge(ticket.status);

  return (
    <div
      onClick={() => onSelect(ticket.id)}
      className={`relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none ${
        isActive
          ? 'bg-[#1B222C] border-[#D71921] shadow-[0_0_20px_-3px_rgba(215,25,33,0.35)] ring-1 ring-[#D71921]'
          : 'bg-[#161B22] border-[#293444] hover:border-[#3d4d63] hover:bg-[#1A222C]'
      } ${ticket.isSocketPushed ? 'animate-pulse' : ''}`}
      dir="rtl"
    >
      {/* Top Bar: Code, Bidi Isolation, Status and SLA Timer */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#293444]">
        <div className="flex items-center gap-2">
          {/* Bidi Protected Ticket Number */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#9EACB8]">سفارش:</span>
            <bdi className="font-mono font-black text-sm text-white" dir="ltr">
              {ticket.ticketCode || `#KW-${ticket.orderNumber}`}
            </bdi>
          </div>

          {/* Table / Location Bidi */}
          {ticket.tableLabel && (
            <div className="flex items-center gap-1 text-[11px] text-[#9EACB8] bg-[#121417] px-2 py-0.5 rounded-md border border-[#293444]">
              <span>موقعیت:</span>
              <bdi className="font-mono font-bold text-white" dir="ltr">
                {ticket.tableLabel}
              </bdi>
            </div>
          )}

          {ticket.isParked && (
            <span className="bg-amber-950 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
              <PauseCircle className="w-3 h-3" />
              <span>معلق</span>
            </span>
          )}
        </div>

        {/* SLA Radial / Timer Indicator */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold"
            style={{
              borderColor: slaColor,
              color: slaColor,
              backgroundColor: `${slaColor}15`,
            }}
          >
            {isBreached ? (
              <AlertOctagon className="w-3.5 h-3.5 animate-bounce" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <bdi dir="ltr">{formattedElapsed}</bdi>
          </div>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Customer Name row if exists */}
      {ticket.customerName && (
        <div className="text-[11px] text-[#9EACB8] pt-2 flex items-center gap-1">
          <span>مشتری:</span>
          <span className="font-bold text-white">{ticket.customerName}</span>
        </div>
      )}

      {/* Item List */}
      <div className="py-2.5 space-y-1.5">
        {ticket.items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between text-xs py-1 border-b border-[#293444]/40 last:border-none"
          >
            <div>
              <div className="flex items-center gap-1.5 font-bold text-white">
                <span className="font-mono text-[#D71921] font-black">{item.quantity}×</span>
                <span>{item.title}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-[10px] text-[#9EACB8] pr-4 leading-tight">
                  {item.modifiers.map((m) => m.nameFa).join('، ')}
                </div>
              )}
              {item.notes && (
                <div className="text-[10px] text-amber-400/90 italic pr-4">
                  *{item.notes}
                </div>
              )}
            </div>

            <span className="font-mono text-xs text-[#F3E9DD] font-semibold shrink-0">
              {formatToman(item.subtotal)}
            </span>
          </div>
        ))}
      </div>

      {/* Total & Action Footer */}
      <div className="pt-3 border-t border-[#293444] flex items-center justify-between gap-2">
        <div>
          <span className="text-[11px] text-[#9EACB8] block">مبلغ فاکتور:</span>
          <span className="font-mono font-black text-sm text-[#F3E9DD]">
            {formatToman(ticket.total)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5">
          {onParkToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onParkToggle(ticket.id);
              }}
              className="p-2 rounded-xl bg-[#121417] hover:bg-[#222B38] text-[#9EACB8] hover:text-white border border-[#293444] transition cursor-pointer"
              title="تعلیق موقت (Park / Hold)"
            >
              <PauseCircle className="w-4 h-4" />
            </button>
          )}

          {onSplitOrder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSplitOrder(ticket.id);
              }}
              className="p-2 rounded-xl bg-[#121417] hover:bg-[#222B38] text-[#9EACB8] hover:text-white border border-[#293444] transition cursor-pointer"
              title="تفکیک فاکتور (Split Order)"
            >
              <Scissors className="w-4 h-4" />
            </button>
          )}

          {ticket.status !== 'Dispatched' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdvanceStatus(ticket.id);
              }}
              className="bg-[#D71921] hover:bg-[#B8141B] active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-[0_0_12px_-2px_rgba(215,25,33,0.4)] flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>ارتقای وضعیت</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/60">
              <CheckCircle2 className="w-4 h-4" />
              <span>تسویه کامل</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
