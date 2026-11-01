import React, { useState } from 'react';
import { Layers, Inbox, Sparkles, Filter } from 'lucide-react';
import { SmartTicket, OrderStatus } from '../types';
import { SmartOrderCard } from './SmartOrderCard';

export interface LiveOrderBufferProps {
  tickets: SmartTicket[];
  activeId: string;
  onSelect: (ticketId: string) => void;
  onAdvanceStatus: (ticketId: string) => void;
  onParkToggle?: (ticketId: string) => void;
  onSplitOrder?: (ticketId: string) => void;
}

export const LiveOrderBuffer: React.FC<LiveOrderBufferProps> = ({
  tickets,
  activeId,
  onSelect,
  onAdvanceStatus,
  onParkToggle,
  onSplitOrder,
}) => {
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');

  const filterTabs: Array<{ id: OrderStatus | 'ALL'; label: string }> = [
    { id: 'ALL', label: 'همه تیکت‌ها' },
    { id: 'Draft', label: 'پیش‌نویس' },
    { id: 'Queued', label: 'در صف' },
    { id: 'In-Prep', label: 'آماده‌سازی' },
    { id: 'Ready', label: 'آماده تحویل' },
  ];

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === 'ALL') return t.status !== 'Dispatched';
    return t.status === filterStatus;
  });

  return (
    <div
      className="flex-1 bg-[#0B0D11]/95 h-full flex flex-col justify-between overflow-hidden select-none border-l border-white/[0.08] relative z-0"
      dir="rtl"
    >
      {/* Top Filter Bar with Telemetry */}
      <div className="p-3.5 border-b border-white/[0.08] bg-[#0F223D]/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F3E9DD] shadow-inner">
            <Layers className="w-4 h-4 text-[#D71921]" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-2">
              <span>صف زنده سفارشات (Live Order Buffer)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h2>
            <p className="text-[11px] text-[#9EACB8]">جریان بلادرنگ سالن، بیرون‌بر و بار اسپشیالتی</p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#0E1116] p-1 rounded-xl border border-white/[0.08]">
          {filterTabs.map((tab) => {
            const count =
              tab.id === 'ALL'
                ? tickets.filter((t) => t.status !== 'Dispatched').length
                : tickets.filter((t) => t.status === tab.id).length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  filterStatus === tab.id
                    ? 'bg-[#D71921] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.55)] border border-[#D71921]'
                    : 'text-[#9EACB8] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-black/40 text-[#F3E9DD]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Order Cards Feed with Cascade Stagger */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket, idx) => (
            <SmartOrderCard
              key={ticket.id}
              ticket={ticket}
              isActive={ticket.id === activeId}
              onSelect={onSelect}
              onAdvanceStatus={onAdvanceStatus}
              onParkToggle={onParkToggle}
              onSplitOrder={onSplitOrder}
              style={{
                animationDelay: `${Math.min(idx * 35, 250)}ms`,
              }}
            />
          ))
        ) : (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 text-[#9EACB8]">
            <div className="p-5 rounded-2xl bg-[#161B22] border border-white/[0.08] mb-3 text-[#526071] shadow-inner">
              <Inbox className="w-8 h-8" />
            </div>
            <p className="font-extrabold text-sm text-white">هیچ تیکتی در این فیلتر وجود ندارد</p>
            <p className="text-xs text-[#9EACB8] mt-1 max-w-sm">
              با استفاده از کلیدهای ۱ تا ۹ یا کلیک روی اقلام سمت راست، سفارش جدید ایجاد کنید.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
