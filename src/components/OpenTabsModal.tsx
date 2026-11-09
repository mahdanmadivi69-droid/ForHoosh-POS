/**
 * src/components/OpenTabsModal.tsx
 * 
 * KarWand POS — 100 HICH Sensory Lab & POS
 * Open Tabs Recall & Edit Management Sheet
 * 
 * Features:
 *  - Displays all active open tabs with table/customer tags, item counts & integer Toman totals.
 *  - "Recall to Cart" action loads items back into active cart for real-time additions/modifications.
 *  - Tracks activeTabId so updating/completing it mutates the existing record in-place.
 *  - Liquid Glass VisionOS styling with Pinar/Vazirmatn typography.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Clock,
  User,
  ShoppingBag,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { OpenTabRecord } from '../db/schema';
import { CatalogService } from '../services/catalog/catalogService';
import { formatToman } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';

interface OpenTabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecallTab: (tab: OpenTabRecord) => void;
  activeTabId?: string | null;
  onNewTabRequest?: () => void;
}

export const OpenTabsModal: React.FC<OpenTabsModalProps> = ({
  isOpen,
  onClose,
  onRecallTab,
  activeTabId,
  onNewTabRequest,
}) => {
  const [tabs, setTabs] = useState<OpenTabRecord[]>([]);

  const refreshTabs = () => {
    const activeList = CatalogService.getOpenTabs();
    setTabs(activeList);
  };

  useEffect(() => {
    if (isOpen) {
      refreshTabs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRecall = (tab: OpenTabRecord) => {
    playPosBeep('click');
    onRecallTab(tab);
    onClose();
  };

  const handleVoid = (tabId: string, label: string) => {
    if (confirm(`آیا از ابطال تب "${label}" اطمینان دارید؟`)) {
      playPosBeep('delete');
      CatalogService.voidOpenTab(tabId);
      refreshTabs();
    }
  };

  const parseItemCount = (rawCartJson: string): number => {
    try {
      const items = JSON.parse(rawCartJson);
      if (Array.isArray(items)) {
        return items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
      }
    } catch {
      // fallback
    }
    return 0;
  };

  const formatTime = (timestampMs: number): string => {
    try {
      const date = new Date(timestampMs);
      return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none">
      <div 
        className="w-full max-w-2xl bg-[rgba(12,25,48,0.92)] border border-[rgba(144,210,237,0.3)] rounded-3xl p-5 sm:p-6 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-[34px] flex flex-col max-h-[90vh] text-right relative overflow-hidden"
        style={{
          boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.35), 0 24px 60px -15px rgba(0, 0, 0, 0.90)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#8C1318] shadow-[0_0_12px_#8C1318]"></span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>تب‌های باز و فاکتورهای معلق سالن</span>
                <span className="px-2 py-0.5 rounded-full bg-[rgba(140,19,24,0.35)] text-rose-300 border border-[rgba(140,19,24,0.6)] text-xs font-mono font-bold">
                  {tabs.length} تب فعال
                </span>
              </h2>
              <p className="text-xs text-[#90D2ED]/80 mt-0.5 font-medium">
                انتخاب تب جهت بازیابی، ویرایش اقلام و ثبت تسویه لحظه‌ای
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs List */}
        <div className="py-4 overflow-y-auto space-y-3 flex-1 pr-1 custom-scrollbar">
          {tabs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-[#90D2ED]/30 mb-3" />
              <p className="text-sm font-bold text-white">در حال حاضر هیچ تب بازی در این شیفت وجود ندارد</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                برای نگهداری سفارش مشتری یا میز، از دکمه «نگهداری در تب / هولد» در سبد فروش استفاده کنید.
              </p>
            </div>
          ) : (
            tabs.map((tab) => {
              const isActive = activeTabId === tab.tab_id;
              const itemCount = parseItemCount(tab.raw_cart_json);

              return (
                <div
                  key={tab.tab_id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-[rgba(140,19,24,0.22)] border-[rgba(140,19,24,0.7)] shadow-[0_0_20px_rgba(140,19,24,0.35)]'
                      : 'bg-[rgba(15,34,61,0.6)] hover:bg-[rgba(20,44,80,0.75)] border-white/10 hover:border-[rgba(144,210,237,0.35)]'
                  }`}
                >
                  {/* Tab Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-extrabold text-white text-sm sm:text-base tracking-tight truncate">
                        {tab.table_or_customer || 'میز بدون نام'}
                      </h4>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#8C1318] text-white animate-pulse">
                          در حال ویرایش در سبد
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-[#90D2ED] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(tab.opened_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span>تعداد اقلام: <strong className="text-white font-mono">{itemCount}</strong></span>
                      <span>•</span>
                      <span>مبلغ کل: <strong className="text-[#F5E8D0] font-black font-mono">{formatToman(tab.total_toman)}</strong> تومان</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                    <button
                      type="button"
                      onClick={() => handleRecall(tab)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md ${
                        isActive
                          ? 'bg-[#8C1318] text-white border border-[#9E8A5E]/50'
                          : 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] text-white hover:brightness-110 border border-white/20'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isActive ? 'ادامه ویرایش' : 'بازیابی در سبد (Recall)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleVoid(tab.tab_id, tab.table_or_customer)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 transition cursor-pointer"
                      title="ابطال این تب"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>موتور تب‌های سنسوری لب ۱۰۰ هیچ</span>
            <span>|</span>
            <span className="text-emerald-400">دقت محاسباتی: عدد صحیح تومان</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
