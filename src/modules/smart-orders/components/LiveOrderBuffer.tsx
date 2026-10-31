import React, { useState } from 'react';
import { Layers, Inbox } from 'lucide-react';
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
      className="flex-1 bg-[#0E1116] h-full flex flex-col justify-between overflow-hidden select-none border-l border-[#293444]"
      dir="rtl"
    >
      {/* Top Filter Bar */}
      <div className="p-3.5 border-b border-[#293444] bg-[#0F223D]/60 backdrop-blur-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#0F223D] border border-[#293444] text-[#F3E9DD]">
            <Layers className="w-4 h-4 text-[#D71921]" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white">صف زنده سفارشات (Live Buffer Feed)</h2>
            <p className="text-[11px] text-[#9EACB8]">جریان بلادرنگ سالن، بیرون‌بر و بار اسپشیالتی</p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#121417] p-1 rounded-xl border border-[#293444]">
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
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-[#D71921] text-white shadow-sm'
                    : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] px-1 rounded bg-black/30">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Order Cards Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => (
            <SmartOrderCard
              key={ticket.id}
              ticket={ticket}
              isActive={ticket.id === activeId}
              onSelect={onSelect}
              onAdvanceStatus={onAdvanceStatus}
              onParkToggle={onParkToggle}
              onSplitOrder={onSplitOrder}
            />
          ))
        ) : (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 text-[#9EACB8]">
            <div className="p-4 rounded-2xl bg-[#1B222C] border border-[#293444] mb-3 text-[#526071]">
              <Inbox className="w-8 h-8" />
            </div>
            <p className="font-extrabold text-sm text-white">هیچ تیکتی در این فیلتر وجود ندارد</p>
            <p className="text-xs text-[#9EACB8] mt-1">
              با استفاده از کلیدهای ۱ تا ۹ یا کلیک روی اقلام سمت راست، سفارش جدید ایجاد کنید.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
