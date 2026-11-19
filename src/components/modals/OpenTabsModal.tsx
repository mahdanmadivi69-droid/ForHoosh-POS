/**
 * src/components/modals/OpenTabsModal.tsx
 * 
 * Modendo & CafeOS — Live Open Tabs & Active Table Session Drawer
 * Displays real-time open tabs from openTabService and active floor sessions.
 * Allows cashier to immediately drill down and open a table's bill.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  RefreshCw,
  Clock,
  Coffee,
  Gamepad2,
  ShoppingBag,
  ExternalLink,
  Receipt,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { openTabService } from '../../services/openTabService';
import { TableSessionTab } from '../../types/inventory-tab';
import { formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { MODENDO_FLOOR_NODES, TableSession } from '../floorplan/FloorPlanCanvas';

interface OpenTabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tableLabel: string, nodeId?: string) => void;
  tenantId?: string;
}

interface UnifiedTabRow {
  key: string;
  tableId: string;
  tableLabel: string;
  customerName?: string;
  guestCount?: number;
  openedAt: string;
  itemCount: number;
  totalToman: number;
  kind?: 'TABLE' | 'PS5' | 'TAKEAWAY';
  source: 'openTabService' | 'floorSession';
}

export const OpenTabsModal: React.FC<OpenTabsModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  tenantId = 'tenant-modendo-01',
}) => {
  const [tabs, setTabs] = useState<TableSessionTab[]>([]);
  const [floorSessions, setFloorSessions] = useState<Record<string, TableSession>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reloadData = useCallback(() => {
    setIsRefreshing(true);
    try {
      const activeTabs = openTabService.getOpenTabs(tenantId);
      setTabs(activeTabs);
    } catch (e) {
      console.warn('[OpenTabsModal] Failed loading from openTabService:', e);
    }

    try {
      const raw =
        localStorage.getItem('cafeos_modendo_floor_sessions_v2') ||
        localStorage.getItem('modendo_floor_sessions_v1');
      if (raw) {
        setFloorSessions(JSON.parse(raw));
      } else {
        setFloorSessions({});
      }
    } catch (e) {
      console.warn('[OpenTabsModal] Failed loading floor sessions:', e);
    }
    setTimeout(() => setIsRefreshing(false), 300);
  }, [tenantId]);

  useEffect(() => {
    if (isOpen) {
      reloadData();
    }
  }, [isOpen, reloadData]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!isOpen) return;

    const unsub = openTabService.subscribe(() => {
      reloadData();
    }, tenantId);

    const handleFloorChange = () => {
      reloadData();
    };
    window.addEventListener('cafeos_floor_sessions_changed', handleFloorChange);

    const interval = setInterval(reloadData, 3000);

    return () => {
      unsub();
      window.removeEventListener('cafeos_floor_sessions_changed', handleFloorChange);
      clearInterval(interval);
    };
  }, [isOpen, reloadData, tenantId]);

  // Combine openTabService tabs with active floor plan sessions
  const unifiedTabs: UnifiedTabRow[] = useMemo(() => {
    const list: UnifiedTabRow[] = [];
    const seenTables = new Set<string>();

    // 1. First add from openTabService
    tabs.forEach((t) => {
      seenTables.add(t.table_label);
      seenTables.add(t.table_id);
      const itemsCount = t.rounds.reduce((sum, r) => sum + r.items.reduce((acc, it) => acc + it.quantity, 0), 0);
      const isPs5 = t.table_label.toLowerCase().includes('ps5') || t.table_id.toLowerCase().includes('ps5');
      const isTakeaway = t.table_label.includes('بیرون') || t.table_id.includes('takeaway');

      list.push({
        key: `ots-${t.tab_id}`,
        tableId: t.table_id,
        tableLabel: t.table_label,
        customerName: t.notes || (t.guest_count > 0 ? `${t.guest_count} نفر` : undefined),
        guestCount: t.guest_count,
        openedAt: t.opened_at,
        itemCount: itemsCount,
        totalToman: t.total_due || t.subtotal || 0,
        kind: isPs5 ? 'PS5' : isTakeaway ? 'TAKEAWAY' : 'TABLE',
        source: 'openTabService',
      });
    });

    // 2. Add from floor sessions if not already in openTabService
    Object.entries(floorSessions).forEach(([nodeId, session]) => {
      if (!session || (!session.cartItems?.length && session.status !== 'OCCUPIED')) {
        return;
      }
      if (seenTables.has(session.tableLabel) || seenTables.has(nodeId)) {
        return;
      }
      const node = MODENDO_FLOOR_NODES.find((n) => n.id === nodeId || n.label === session.tableLabel);
      const isPs5 = node?.kind === 'PS5' || session.tableLabel.includes('PS5');
      const itemsCount = (session.cartItems || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
      const gross = (session.cartItems || []).reduce((sum, it) => sum + (it.subtotalToman || 0), 0);
      const net = Math.max(0, gross - (session.discountToman || 0));

      list.push({
        key: `flr-${nodeId}`,
        tableId: nodeId,
        tableLabel: session.tableLabel || node?.label || nodeId,
        customerName: session.customerName,
        guestCount: session.guestCount,
        openedAt: session.openedAt || new Date().toISOString(),
        itemCount: itemsCount,
        totalToman: net,
        kind: isPs5 ? 'PS5' : 'TABLE',
        source: 'floorSession',
      });
    });

    return list;
  }, [tabs, floorSessions]);

  const formatElapsed = (isoTime: string) => {
    try {
      const ms = Date.now() - new Date(isoTime).getTime();
      const mins = Math.max(0, Math.floor(ms / 60000));
      if (mins < 1) return 'لحظاتی پیش';
      if (mins < 60) return `${mins} دقیقه پیش`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs} ساعت و ${remMins} دقیقه`;
    } catch {
      return 'نامشخص';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
          className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[28px] bg-[#0c1411]/95 border border-emerald-500/30 backdrop-blur-2xl shadow-2xl overflow-hidden text-right"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 bg-[#06120F]/90 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">میزها و تب‌های باز سالن</h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {unifiedTabs.length} تب فعال
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  لیست فاکتورهای باز میزها، کنسول‌ها و سفارش‌های در حال پذیرایی
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  reloadData();
                }}
                className={`p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/10 transition cursor-pointer ${
                  isRefreshing ? 'animate-spin text-emerald-400' : ''
                }`}
                title="تازه‌سازی لیست تب‌ها"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onClose();
                }}
                className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="بستن پنجره"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
            {unifiedTabs.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#94A3B8]/40">
                  <Coffee className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-white">هیچ میز یا تب بازی وجود ندارد</p>
                <p className="text-xs text-[#94A3B8] max-w-xs">
                  در حال حاضر هیچ سفارشی بر روی میزها ثبت نشده و تمام میزها آزاد هستند.
                </p>
              </div>
            ) : (
              unifiedTabs.map((tab) => (
                <div
                  key={tab.key}
                  className="rounded-2xl p-4 bg-[#12241F]/80 hover:bg-[#16302A] border border-[#1E453B]/70 hover:border-emerald-500/50 shadow-lg flex flex-wrap items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner ${
                        tab.kind === 'PS5'
                          ? 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                          : tab.kind === 'TAKEAWAY'
                          ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      }`}
                    >
                      {tab.kind === 'PS5' ? (
                        <Gamepad2 className="w-5 h-5" />
                      ) : tab.kind === 'TAKEAWAY' ? (
                        <ShoppingBag className="w-5 h-5" />
                      ) : (
                        <Coffee className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{tab.tableLabel}</span>
                        {tab.customerName && (
                          <span className="text-xs text-[#94A3B8] font-bold">
                            ({tab.customerName})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#94A3B8] mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>{formatElapsed(tab.openedAt)}</span>
                        </span>
                        <span>•</span>
                        <span>{tab.itemCount} قلم کالا</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <span className="text-[10px] text-[#94A3B8] block">مبلغ قابل پرداخت</span>
                      <span className="text-sm md:text-base font-black text-emerald-300 font-mono">
                        {formatToman(tab.totalToman)} تومان
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        onSelectTab(tab.tableLabel, tab.tableId);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer transition-all"
                    >
                      <span>باز کردن</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
