import React from 'react';
import {
  Clock,
  ArrowLeft,
  PauseCircle,
  Scissors,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Coffee,
  Check,
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
  style?: React.CSSProperties;
}

const ORDER_STAGES: OrderStatus[] = ['Draft', 'Queued', 'In-Prep', 'Ready', 'Dispatched'];

export const SmartOrderCard: React.FC<SmartOrderCardProps> = ({
  ticket,
  isActive,
  onSelect,
  onAdvanceStatus,
  onParkToggle,
  onSplitOrder,
  style,
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
        return { label: 'پیش‌نویس', bg: 'bg-stone-800/90 text-stone-300 border-stone-600/60' };
      case 'Queued':
        return { label: 'در صف انتظار', bg: 'bg-amber-950/80 text-amber-300 border-amber-600/70 shadow-[0_0_10px_-2px_rgba(245,158,11,0.3)]' };
      case 'In-Prep':
        return { label: 'در حال آماده‌سازی', bg: 'bg-sky-950/80 text-sky-300 border-sky-600/70 shadow-[0_0_10px_-2px_rgba(14,165,233,0.3)]' };
      case 'Ready':
        return { label: 'آماده تحویل', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/70 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]' };
      case 'Dispatched':
        return { label: 'تحویل شد / تسویه', bg: 'bg-zinc-800/80 text-zinc-400 border-zinc-700' };
    }
  };

  const badge = getStatusBadge(ticket.status);
  const currentStageIndex = ORDER_STAGES.indexOf(ticket.status);

  return (
    <div
      onClick={() => onSelect(ticket.id)}
      style={style}
      className={`group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none overflow-hidden ${
        isActive
          ? 'bg-[#18202A] border-[#D71921] shadow-[0_0_24px_-4px_rgba(215,25,33,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-[#D71921]'
          : 'bg-[#13171F]/85 border-white/[0.08] hover:border-white/[0.18] hover:bg-[#1A202A] hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.5)]'
      } ${ticket.isSocketPushed ? 'flash-socket-pulse' : ''}`}
      dir="rtl"
    >
      {/* SLA Visual Gauge along top edge */}
      {!isCompleted && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.05] overflow-hidden">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, percentage)}%`,
              backgroundColor: slaColor,
              boxShadow: `0 0 8px ${slaColor}`,
            }}
          />
        </div>
      )}

      {/* Top Bar: Code, Bidi Isolation, Table Label, and SLA Timer */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.06] pt-0.5">
        <div className="flex items-center gap-2">
          {/* Bidi Protected Ticket Number */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#9EACB8]">سفارش:</span>
            <bdi className="font-mono font-black text-sm text-white tracking-wide" dir="ltr">
              {ticket.ticketCode || `#KW-${ticket.orderNumber}`}
            </bdi>
          </div>

          {/* Table / Location Bidi */}
          {ticket.tableLabel && (
            <div className="flex items-center gap-1 text-[11px] text-[#9EACB8] bg-[#0F1318] px-2 py-0.5 rounded-lg border border-white/[0.08]">
              <span>موقعیت:</span>
              <bdi className="font-mono font-bold text-white" dir="ltr">
                {ticket.tableLabel}
              </bdi>
            </div>
          )}

          {ticket.isParked && (
            <span className="bg-amber-950/80 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-600/70 flex items-center gap-1">
              <PauseCircle className="w-3 h-3" />
              <span>معلق</span>
            </span>
          )}
        </div>

        {/* SLA Radial / Timer Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold transition-colors ${
              isBreached ? 'animate-pulse' : ''
            }`}
            style={{
              borderColor: `${slaColor}80`,
              color: slaColor,
              backgroundColor: `${slaColor}15`,
            }}
          >
            {isBreached ? (
              <AlertOctagon className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <bdi dir="ltr">{formattedElapsed}</bdi>
          </div>

          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* 5-Stage Stepped Progression Tracker */}
      <div className="py-2 flex items-center gap-1 border-b border-white/[0.04]">
        {ORDER_STAGES.map((stage, idx) => {
          const isPassed = idx <= currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          return (
            <div key={stage} className="flex-1 flex flex-col gap-1 items-center">
              <div
                className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'bg-[#D71921] shadow-[0_0_8px_rgba(215,25,33,0.8)]'
                    : isPassed
                    ? 'bg-emerald-500/80'
                    : 'bg-white/[0.08]'
                }`}
              />
            </div>
          );
        })}
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
            className="flex items-start justify-between text-xs py-1 border-b border-white/[0.04] last:border-none"
          >
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-100">
                <span className="font-mono text-[#D71921] font-black text-sm">{item.quantity}×</span>
                <span className="leading-snug">{item.title}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-[10px] text-[#9EACB8] pr-5 leading-tight mt-0.5">
                  {item.modifiers.map((m) => m.nameFa).join('، ')}
                </div>
              )}
              {item.notes && (
                <div className="text-[10px] text-amber-400/90 italic pr-5 mt-0.5">
                  *{item.notes}
                </div>
              )}
            </div>

            <span className="font-mono text-xs text-[#F3E9DD] font-semibold shrink-0 num-heavy">
              {formatToman(item.subtotal)}
            </span>
          </div>
        ))}
      </div>

      {/* Total & Action Footer */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-[#9EACB8] block">مبلغ فاکتور:</span>
          <span className="font-mono font-black text-sm text-[#F3E9DD] num-heavy">
            {formatToman(ticket.total)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {onParkToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onParkToggle(ticket.id);
              }}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-[#9EACB8] hover:text-white border border-white/[0.08] transition-all cursor-pointer active:scale-95"
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
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-[#9EACB8] hover:text-white border border-white/[0.08] transition-all cursor-pointer active:scale-95"
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
              className="bg-[#D71921] hover:bg-[#B8141B] active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)] hover:shadow-[0_0_20px_-2px_rgba(215,25,33,0.7)] flex items-center gap-1.5 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>ارتقای وضعیت ➔</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-600/60 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-4 h-4" />
              <span>تسویه کامل</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
