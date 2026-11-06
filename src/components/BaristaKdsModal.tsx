/**
 * CAFE OS — Realtime Barista Kitchen Display System (KDS)
 * Path: src/components/BaristaKdsModal.tsx
 *
 * Implements:
 * 1. Tactile, full-screen KDS board with true browser fullscreen toggle.
 * 2. Explicit order lifecycle progression: Queued (PENDING) -> Brewing (IN_PREP) -> Ready (READY).
 * 3. Visual SLA indicators (Target: 5m, Warning: 5-10m, Breached: >10m) with live timer & progress gauge.
 * 4. Multi-Tenant isolation bound to validated tenant context.
 * 5. High-contrast industrial dark theme, acoustic chimes, and tactile touch targets.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee,
  X,
  Clock,
  CheckCircle,
  PlayCircle,
  Bell,
  Volume2,
  VolumeX,
  Printer,
  Sparkles,
  Flame,
  AlertOctagon,
  AlertTriangle,
  Ban,
  Maximize2,
  Minimize2,
  Timer,
  RotateCcw,
  Activity,
  Layers,
} from 'lucide-react';
import { baristaDispatcher, BaristaOrderTicket, isValidTenantId } from '../services/baristaDispatcher';
import { websocketServer } from '../services/websocket-server';
import { SmartOrdersStore } from '../services/storage';
import { thermalPrinterDriver } from '../services/ThermalPrinterDriver';
import { StationRouter } from '../services/StationRouter';

export interface BaristaKdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  tenantId?: string;
  initialFullScreen?: boolean;
}

interface StockoutAlertItem {
  id: string;
  orderId: string;
  items: Array<{
    productId: string;
    productName: string;
    deficit: number;
  }>;
  timestamp: string;
}

export type SlaStatus = 'NORMAL' | 'WARNING' | 'BREACHED';

export function calculateSlaMetrics(paidAt: string, currentTime: number) {
  const parsedTime = new Date(paidAt).getTime();
  const validPaidAt = isNaN(parsedTime) ? currentTime : parsedTime;
  const elapsedSec = Math.max(0, Math.floor((currentTime - validPaidAt) / 1000));
  const targetSec = 300; // 5 min target
  const warningSec = 600; // 10 min warning threshold

  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let status: SlaStatus = 'NORMAL';
  let badgeClass = 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300';
  let label = 'عادی (SLA OK)';
  let progressPct = Math.min(100, Math.round((elapsedSec / targetSec) * 100));
  let progressColor = 'bg-emerald-500';

  if (elapsedSec > warningSec) {
    status = 'BREACHED';
    badgeClass = 'bg-rose-950/90 border-rose-500 text-rose-300 ring-1 ring-rose-500 animate-pulse';
    label = 'تاخیر بحرانی (SLA Breached)';
    progressPct = 100;
    progressColor = 'bg-rose-500';
  } else if (elapsedSec > targetSec) {
    status = 'WARNING';
    badgeClass = 'bg-amber-950/80 border-amber-600 text-amber-300';
    label = 'هشدار تاخیر (SLA Warning)';
    const warningElapsed = elapsedSec - targetSec;
    progressPct = Math.min(100, Math.round((warningElapsed / (warningSec - targetSec)) * 100));
    progressColor = 'bg-amber-500';
  }

  return {
    elapsedSec,
    formattedTime,
    status,
    badgeClass,
    label,
    progressPct,
    progressColor,
  };
}

export const BaristaKdsModal: React.FC<BaristaKdsModalProps> = ({
  isOpen,
  onClose,
  tenantName,
  tenantId,
  initialFullScreen = false,
}) => {
  const [tickets, setTickets] = useState<BaristaOrderTicket[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PREP' | 'READY'>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stockoutAlerts, setStockoutAlerts] = useState<StockoutAlertItem[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(initialFullScreen);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  // Explicit tenant context: prop takes precedence over canonical store
  const activeTenantId = tenantId || SmartOrdersStore.getActiveTenantId();
  const isTenantValid = isValidTenantId(activeTenantId);

  // Live timer tick every 1000ms for accurate SLA calculations
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Fullscreen event listener to sync state with native browser changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        setIsFullScreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullScreen(false);
      }
    } catch (err) {
      // Fallback toggle for windowed simulated full-screen
      setIsFullScreen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (!isTenantValid) {
      console.warn('[BaristaKdsModal] Missing or invalid tenant context:', activeTenantId);
      setTickets([]);
      return;
    }

    const unsubscribeTickets = baristaDispatcher.subscribe((updatedTickets) => {
      setTickets(updatedTickets);
    }, activeTenantId);

    // Subscribe to real-time inventory stockout alerts from reconnected POS sync
    const unsubscribeStockout = websocketServer.subscribeToEvent('INVENTORY_STOCKOUT_ALERT', (payload) => {
      if (payload && payload.items && payload.items.length > 0) {
        // Enforce tenant scoping on inventory stockout alerts
        if (payload.tenantId && payload.tenantId !== activeTenantId) {
          return;
        }
        const newAlert: StockoutAlertItem = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          orderId: payload.orderId || 'offline-sync',
          items: payload.items,
          timestamp: payload.timestamp || new Date().toISOString(),
        };
        setStockoutAlerts((prev) => [newAlert, ...prev]);

        if (soundEnabled) {
          baristaDispatcher.playBaristaChime();
        }
      }
    });

    return () => {
      unsubscribeTickets();
      unsubscribeStockout();
    };
  }, [isOpen, activeTenantId, isTenantValid, soundEnabled]);

  if (!isOpen) return null;

  const handleUpdateStatus = (
    orderId: string,
    newStatus: 'PENDING' | 'IN_PREP' | 'READY'
  ) => {
    if (!isTenantValid) {
      console.error('[BaristaKdsModal] Cannot update status without valid tenant context');
      return;
    }

    // Optional tactile haptic feedback for touch displays
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(35);
      } catch {
        // Ignore haptic error
      }
    }

    baristaDispatcher.updatePrepStatus(orderId, newStatus, activeTenantId);
    if (newStatus === 'READY' && soundEnabled) {
      baristaDispatcher.playBaristaChime();
    }
  };

  const handleTestSound = () => {
    baristaDispatcher.playBaristaChime();
  };

  const handleReprintTicket = async (ticket: BaristaOrderTicket) => {
    try {
      const items = ticket.items.map((it, idx) => ({
        id: `reprint-${ticket.orderId}-${idx}`,
        title: it.itemName,
        quantity: it.quantity,
        modifiers: it.modifiers,
        notes: it.notes,
        station: 'BAR' as const,
      }));

      const splitResult = StationRouter.splitTicket(items, [], {
        ticketId: ticket.orderNumber,
        tableLabel: ticket.tableLabel || 'سالن',
        cashierName: 'باریستا',
      });

      await thermalPrinterDriver.printBothStations(splitResult);
    } catch (e) {
      console.warn('Reprint ticket failed:', e);
    }
  };

  const handleMarkAsSoldOut = (productId: string, alertId: string) => {
    try {
      const items = SmartOrdersStore.getMenuItems();
      const target = items.find((i) => i.id === productId);
      if (target) {
        SmartOrdersStore.updateMenuItem({
          ...target,
          isAvailable: false,
          currentStock: 0,
        });
      }
    } catch (e) {
      console.error('Failed to update menu item stock status:', e);
    }

    setStockoutAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleDismissAlert = (alertId: string) => {
    setStockoutAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const allDepletedProductNames = new Set(
    stockoutAlerts.flatMap((a) => a.items.map((i) => i.productName))
  );

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'ALL') return true;
    return t.prepStatus === filter;
  });

  const queuedTickets = tickets.filter((t) => t.prepStatus === 'PENDING');
  const brewingTickets = tickets.filter((t) => t.prepStatus === 'IN_PREP');
  const readyTickets = tickets.filter((t) => t.prepStatus === 'READY');

  const queuedCount = queuedTickets.length;
  const brewingCount = brewingTickets.length;
  const readyCount = readyTickets.length;

  // Compute active SLA summary
  let normalSlaCount = 0;
  let warningSlaCount = 0;
  let breachedSlaCount = 0;

  tickets.forEach((t) => {
    if (t.prepStatus !== 'READY') {
      const { status } = calculateSlaMetrics(t.paidAt, currentTime);
      if (status === 'BREACHED') breachedSlaCount++;
      else if (status === 'WARNING') warningSlaCount++;
      else normalSlaCount++;
    }
  });

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isFullScreen ? 'p-0 w-screen h-screen' : 'p-3 bg-black/85 backdrop-blur-md'
      } animate-fadeIn select-none font-sans`}
      dir="rtl"
    >
      <div
        className={`bg-stone-950 border border-stone-800 ${
          isFullScreen
            ? 'w-full h-full rounded-none border-none'
            : 'rounded-2xl w-full max-w-7xl max-h-[96vh] shadow-2xl'
        } flex flex-col overflow-hidden transition-all`}
      >
        {/* KDS Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/70 border-b border-stone-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/40 shadow-inner">
              <Coffee className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wide text-stone-100 flex items-center gap-2">
                  <span>سیستم نمایشگر باریستا</span>
                  <span className="text-xs font-mono text-amber-400/90 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    BAR KDS
                  </span>
                </h1>
                <span className="text-[11px] bg-stone-800/90 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  {tenantName}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-3">
                <span>نمایش زنده صف آماده‌سازی، کنترل SLA سفارش و نظارت بر تاخیرات</span>
              </p>
            </div>
          </div>

          {/* Right Action Tools & Fullscreen Toggle */}
          <div className="flex items-center gap-2">
            {/* Live SLA Badge Indicators */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-stone-900/90 border border-stone-800 rounded-xl text-xs font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400" title="سفارشات در بازه استاندارد">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold">{normalSlaCount}</span>
                <span className="text-[10px] text-stone-400 font-sans">عادی</span>
              </div>
              <span className="text-stone-700">|</span>
              <div className="flex items-center gap-1.5 text-amber-400" title="سفارشات در مرز تاخیر">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-bold">{warningSlaCount}</span>
                <span className="text-[10px] text-stone-400 font-sans">هشدار</span>
              </div>
              <span className="text-stone-700">|</span>
              <div className="flex items-center gap-1.5 text-rose-400" title="سفارشات دارای تاخیر بیش از ۱۰ دقیقه">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-bold">{breachedSlaCount}</span>
                <span className="text-[10px] text-stone-400 font-sans">تاخیر بحرانی</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullScreen ? 'خروج از تمام‌صفحه' : 'حالت تمام‌صفحه تبلت و کیوسک (F11)'}
              className="p-2.5 rounded-xl border border-stone-700 bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-amber-400 transition cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
              <span className="hidden sm:inline">{isFullScreen ? 'پنجره‌ای' : 'تمام‌صفحه'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'قطع صدای اعلان' : 'فعال‌سازی صدای اعلان'}
              className={`p-2.5 rounded-xl border transition cursor-pointer active:scale-95 ${
                soundEnabled
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-400 hover:bg-amber-900/40'
                  : 'bg-stone-850 border-stone-750 text-stone-400 hover:bg-stone-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleTestSound}
              title="تست آکوستیک زنگ باریستا"
              className="px-3 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">تست زنگ</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="بستن صفحه KDS"
              className="text-stone-400 hover:text-rose-400 p-2 rounded-xl hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tactile Lifecycle Filter Tabs (Queued -> Brewing -> Ready) */}
        <div className="px-5 py-2.5 bg-stone-950 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer active:scale-95 ${
                filter === 'ALL'
                  ? 'bg-stone-700 text-white shadow-lg ring-1 ring-stone-500'
                  : 'text-stone-400 hover:text-stone-200 bg-stone-900 border border-stone-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>همه تیکت‌ها ({tickets.length})</span>
            </button>

            {/* State 1: Queued */}
            <button
              type="button"
              onClick={() => setFilter('PENDING')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer active:scale-95 ${
                filter === 'PENDING'
                  ? 'bg-rose-600 text-white shadow-lg ring-2 ring-rose-400'
                  : 'text-rose-400 hover:bg-rose-950/40 bg-stone-900 border border-rose-900/50'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
              <span>۱. در صف انتظار / Queued ({queuedCount})</span>
            </button>

            {/* State 2: Brewing */}
            <button
              type="button"
              onClick={() => setFilter('IN_PREP')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer active:scale-95 ${
                filter === 'IN_PREP'
                  ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-400'
                  : 'text-amber-400 hover:bg-amber-950/40 bg-stone-900 border border-amber-900/50'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>۲. در حال دم‌آوری / Brewing ({brewingCount})</span>
            </button>

            {/* State 3: Ready */}
            <button
              type="button"
              onClick={() => setFilter('READY')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer active:scale-95 ${
                filter === 'READY'
                  ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400'
                  : 'text-emerald-400 hover:bg-emerald-950/40 bg-stone-900 border border-emerald-900/50'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>۳. آماده تحویل / Ready ({readyCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-stone-400 text-xs">
            <div className="flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span>زمان فعلی: {new Date(currentTime).toLocaleTimeString('fa-IR')}</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="اتصال بلادرنگ برقرار است" />
          </div>
        </div>

        {/* Real-Time Stockout / 86 Alerts Banner */}
        {stockoutAlerts.length > 0 && (
          <div className="bg-rose-950/80 border-b border-rose-800 px-5 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>هشدار کسری انبار باریستا (Stockout Alert / 86)</span>
              </div>
              <span className="text-xs text-rose-300/80 font-mono">
                {stockoutAlerts.length} مورد
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {stockoutAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-black/50 border border-rose-700/60 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 font-bold">⚠️</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {alert.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="bg-rose-900/60 border border-rose-700 text-rose-200 px-2 py-0.5 rounded text-xs font-semibold"
                        >
                          {it.productName} (کسری: {it.deficit.toLocaleString('fa-IR')})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.items.map((it) => (
                      <button
                        key={it.productId}
                        type="button"
                        onClick={() => handleMarkAsSoldOut(it.productId, alert.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer active:scale-95"
                      >
                        <Ban className="w-3 h-3" />
                        <span>۸۶ کردن «{it.productName}»</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleDismissAlert(alert.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs transition cursor-pointer"
                    >
                      رد هشدار
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets Tactile Board Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-stone-900/30">
          {!isTenantValid ? (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-rose-950/70 text-rose-400 mb-3 border border-rose-800">
                <Ban className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-rose-300">
                خطای ایزولاسیون شعبه (Tenant Isolation Error)
              </h3>
              <p className="text-xs text-stone-400 max-w-md mt-1">
                هویت شعبه نامعتبر است. جهت حفاظت از حریم داده‌های مالی و سفارشات، دسترسی مسدود شد.
              </p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 text-stone-500 mb-3">
                <Coffee className="w-12 h-12" />
              </div>
              <h3 className="text-base font-bold text-stone-300">
                هیچ سفارشی در وضعیت انتخابی وجود ندارد
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                سفارشات جدید ثبت‌شده در صندوق بار به محض تسویه در صف قرار می‌گیرند.
              </p>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${
                isFullScreen ? 'xl:grid-cols-4 2xl:grid-cols-5' : 'xl:grid-cols-3'
              } gap-4`}
            >
              {filteredTickets.map((ticket) => {
                const isPending = ticket.prepStatus === 'PENDING';
                const isInPrep = ticket.prepStatus === 'IN_PREP';
                const isReady = ticket.prepStatus === 'READY';

                const timeFormatted = new Date(ticket.paidAt).toLocaleTimeString('fa-IR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const sla = calculateSlaMetrics(ticket.paidAt, currentTime);

                return (
                  <div
                    key={ticket.orderId}
                    className={`rounded-2xl border flex flex-col justify-between transition-all duration-200 shadow-xl overflow-hidden relative ${
                      isPending
                        ? 'bg-stone-950/90 border-rose-800/70 ring-1 ring-rose-500/30'
                        : isInPrep
                        ? 'bg-amber-950/20 border-amber-600/80 ring-1 ring-amber-500/20'
                        : 'bg-stone-950/60 border-emerald-900/60 opacity-90'
                    }`}
                  >
                    {/* Visual SLA Top Health Progress Bar */}
                    <div className="h-1.5 w-full bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full ${sla.progressColor} transition-all duration-1000 ease-linear`}
                        style={{ width: `${sla.progressPct}%` }}
                      />
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Ticket Header & Status SLA */}
                        <div className="flex items-start justify-between pb-3 mb-3 border-b border-stone-800/80">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
                                #{ticket.orderNumber}
                              </span>
                              <span
                                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                                  ticket.orderType === 'DINE_IN'
                                    ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                    : 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                }`}
                              >
                                {ticket.orderType === 'DINE_IN' ? 'سالن' : 'بیرون‌بر'}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-stone-200 mt-1">
                              محل: <span className="text-amber-300">{ticket.tableLabel || 'پیشخوان'}</span>
                              {ticket.customerName && (
                                <span className="text-stone-400 mr-2">({ticket.customerName})</span>
                              )}
                            </div>
                          </div>

                          {/* SLA Timer Badge */}
                          <div className="flex flex-col items-end gap-1">
                            <div
                              className={`px-2 py-0.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm ${sla.badgeClass}`}
                              title={sla.label}
                            >
                              <Timer className="w-3.5 h-3.5" />
                              <span>{sla.formattedTime}</span>
                            </div>
                            <span className="text-[10px] text-stone-500 font-mono">
                              ثبت: {timeFormatted}
                            </span>
                          </div>
                        </div>

                        {/* Order Items & Modifiers List */}
                        <div className="space-y-2.5 mb-4">
                          {ticket.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-stone-900 border border-stone-850 text-xs shadow-sm"
                            >
                              <div className="flex items-center justify-between font-bold text-stone-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{item.itemName}</span>
                                  {allDepletedProductNames.has(item.itemName) && (
                                    <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700 px-1.5 py-0.5 rounded font-mono animate-pulse">
                                      ۸۶ شده
                                    </span>
                                  )}
                                </div>
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold">
                                  × {item.quantity}
                                </span>
                              </div>

                              {/* Modifiers Badges */}
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {item.modifiers.map((mod, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className="text-[11px] bg-stone-800 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium"
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-400" />
                                      <span>{mod}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {item.notes && (
                                <p className="mt-1.5 text-[11px] text-amber-200/80 bg-amber-950/30 border border-amber-900/40 rounded p-1.5 italic">
                                  یادداشت: {item.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tactile Large Action Buttons (Lifecycle Progression) */}
                      <div className="pt-3 border-t border-stone-800/80 space-y-2">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ticket.orderId, 'IN_PREP')}
                            className="w-full min-h-[48px] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
                          >
                            <PlayCircle className="w-5 h-5" />
                            <span>شروع دم‌آوری (Start Brewing)</span>
                          </button>
                        )}

                        {isInPrep && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ticket.orderId, 'READY')}
                            className="w-full min-h-[48px] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span>اعلام آماده‌سازی (Mark Ready)</span>
                          </button>
                        )}

                        {isReady && (
                          <div className="flex items-center justify-between gap-2 p-2 bg-emerald-950/40 border border-emerald-800/50 rounded-xl">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                              <span>آماده تحویل</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(ticket.orderId, 'IN_PREP')}
                              className="px-2.5 py-1 text-xs text-stone-400 hover:text-stone-200 bg-stone-900 border border-stone-750 rounded-lg flex items-center gap-1 transition cursor-pointer active:scale-95"
                              title="بازگرداندن به مرحله دم‌آوری"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>بازگشت</span>
                            </button>
                          </div>
                        )}

                        {/* Bottom Secondary Utility Bar: Hardware Reprint */}
                        <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                          <button
                            type="button"
                            onClick={() => handleReprintTicket(ticket)}
                            title="چاپ مجدد تیکت کاغذی در پرینتر بار"
                            className="text-stone-400 hover:text-amber-400 flex items-center gap-1.5 p-1 rounded hover:bg-stone-900 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>چاپ مجدد فیش</span>
                          </button>
                          <span className="text-[11px] font-mono text-stone-500">
                            ID: {ticket.clientGeneratedId.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tactile Board Footer */}
        <div className="px-5 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-4">
            <div>
              <span>کل سفارشات فعال بار: </span>
              <strong className="text-amber-400 font-mono text-sm">{tickets.length}</strong>
            </div>
            <span className="text-stone-700">|</span>
            <div className="hidden sm:inline">
              <span>هدف میانگین آماده‌سازی (SLA): </span>
              <strong className="text-stone-200 font-mono">۵:۰۰ دقیقه</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-stone-850 hover:bg-stone-800 text-stone-200 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
            >
              بستن پنجره KDS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BaristaKdsBoard = BaristaKdsModal;
