import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { baristaDispatcher, BaristaOrderTicket } from '../services/baristaDispatcher';
import { websocketServer } from '../services/websocket-server';
import { SmartOrdersStore } from '../services/storage';

interface BaristaKdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
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

export const BaristaKdsModal: React.FC<BaristaKdsModalProps> = ({
  isOpen,
  onClose,
  tenantName,
}) => {
  const [tickets, setTickets] = useState<BaristaOrderTicket[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PREP' | 'READY'>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stockoutAlerts, setStockoutAlerts] = useState<StockoutAlertItem[]>([]);

  useEffect(() => {
    const unsubscribeTickets = baristaDispatcher.subscribe((updatedTickets) => {
      setTickets(updatedTickets);
    });

    // Subscribe to real-time inventory stockout alerts from reconnected POS sync
    const unsubscribeStockout = websocketServer.subscribeToEvent('INVENTORY_STOCKOUT_ALERT', (payload) => {
      if (payload && payload.items && payload.items.length > 0) {
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
  }, [soundEnabled]);

  if (!isOpen) return null;

  const handleUpdateStatus = (
    orderId: string,
    newStatus: 'PENDING' | 'IN_PREP' | 'READY'
  ) => {
    baristaDispatcher.updatePrepStatus(orderId, newStatus);
    if (newStatus === 'READY' && soundEnabled) {
      baristaDispatcher.playBaristaChime();
    }
  };

  const handleTestSound = () => {
    baristaDispatcher.playBaristaChime();
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

  const pendingCount = tickets.filter((t) => t.prepStatus === 'PENDING').length;
  const inPrepCount = tickets.filter((t) => t.prepStatus === 'IN_PREP').length;
  const readyCount = tickets.filter((t) => t.prepStatus === 'READY').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 border border-amber-900/60 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/60 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-100">
                  نمایشگر بار باریستا (KDS — Barista Bar)
                </h2>
                <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                  {tenantName}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                دریافت زنده سفارشات تسویه‌شده از صندوق، تفکیک مودیفایرها و اعلام زمان آماده‌سازی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'قطع صدای اعلان' : 'فعال‌سازی صدای اعلان'}
              className={`p-2 rounded-lg border transition ${
                soundEnabled
                  ? 'bg-amber-950/40 border-amber-600/40 text-amber-400 hover:bg-amber-900/40'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-750'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={handleTestSound}
              title="تست صدای زنگ بار"
              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>تست زنگ</span>
            </button>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Counters */}
        <div className="px-6 py-2.5 bg-stone-950/60 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filter === 'ALL'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              همه سفارشات ({tickets.length})
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                filter === 'PENDING'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-rose-400 hover:bg-rose-950/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>در انتظار ({pendingCount})</span>
            </button>
            <button
              onClick={() => setFilter('IN_PREP')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                filter === 'IN_PREP'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-amber-400 hover:bg-amber-950/30'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>در حال عصاره‌گیری ({inPrepCount})</span>
            </button>
            <button
              onClick={() => setFilter('READY')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                filter === 'READY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-emerald-400 hover:bg-emerald-950/30'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>آماده / تحویل شده ({readyCount})</span>
            </button>
          </div>

          <div className="text-stone-400 text-[11px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>کانال ارتباطی فعال (Broadcast & Webhook)</span>
          </div>
        </div>

        {/* Real-Time Stockout / 86 Alerts Banner for Barista */}
        {stockoutAlerts.length > 0 && (
          <div className="bg-rose-950/70 border-b border-rose-800/80 px-6 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>هشدار فوری کسری انبار (سینک آفلاین / Stockout Alert)</span>
              </div>
              <span className="text-[11px] text-rose-300/80 font-mono">
                {stockoutAlerts.length} رخداد کسری
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {stockoutAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-black/40 border border-rose-700/50 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 font-bold">⚠️</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {alert.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="bg-rose-900/50 border border-rose-700/60 text-rose-200 px-2 py-0.5 rounded text-[11px] font-semibold"
                          >
                            {it.productName} (کسری: {it.deficit.toLocaleString('fa-IR')} عدد)
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        سفارش در وضعیت آفلاین تسویه شده و انبار منفی گردیده است. جهت جلوگیری از ثبت مجدد توسط صندوق‌دار، آیتم را ۸۶ کنید.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.items.map((it) => (
                      <button
                        key={it.productId}
                        onClick={() => handleMarkAsSoldOut(it.productId, alert.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] flex items-center gap-1 shadow transition"
                      >
                        <Ban className="w-3 h-3" />
                        <span>۸۶ کردن «{it.productName}»</span>
                      </button>
                    ))}
                    <button
                      onClick={() => handleDismissAlert(alert.id)}
                      className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] transition"
                    >
                      بایگانی
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-900/40">
          {filteredTickets.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-stone-800/80 text-stone-500 mb-3">
                <Coffee className="w-10 h-10" />
              </div>
              <h3 className="text-base font-semibold text-stone-300">
                هیچ سفارشی در این وضعیت وجود ندارد
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                سفارشات جدید ثبت‌شده در صندوق به محض تسویه حساب به صورت زنده و با صدای اعلان در این بخش ظاهر می‌شوند.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTickets.map((ticket) => {
                const isPending = ticket.prepStatus === 'PENDING';
                const isInPrep = ticket.prepStatus === 'IN_PREP';
                const isReady = ticket.prepStatus === 'READY';

                const timeFormatted = new Date(ticket.paidAt).toLocaleTimeString('fa-IR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={ticket.orderId}
                    className={`rounded-xl border p-4 flex flex-col justify-between transition-all shadow-md ${
                      isPending
                        ? 'bg-stone-950 border-rose-700/60 ring-1 ring-rose-500/20'
                        : isInPrep
                        ? 'bg-amber-950/20 border-amber-600/70'
                        : 'bg-stone-950/40 border-stone-800 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Ticket Header */}
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-800">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-amber-400">
                            #{ticket.orderNumber}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                              ticket.orderType === 'DINE_IN'
                                ? 'bg-blue-950/60 text-blue-300 border border-blue-800/50'
                                : 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                            }`}
                          >
                            {ticket.orderType === 'DINE_IN' ? 'سالن' : 'بیرون‌بر'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <span>{timeFormatted}</span>
                        </div>
                      </div>

                      {/* Customer / Location Info */}
                      <div className="flex items-center justify-between text-xs mb-3 text-stone-300">
                        {ticket.tableLabel && (
                          <div className="font-semibold text-stone-200">
                            محل: {ticket.tableLabel}
                          </div>
                        )}
                        {ticket.customerName && (
                          <div className="text-stone-400">
                            مشتری: <span className="text-stone-200">{ticket.customerName}</span>
                          </div>
                        )}
                      </div>

                      {/* Items & Modifiers */}
                      <div className="space-y-2 mb-4">
                        {ticket.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-stone-900 border border-stone-800/80 text-xs"
                          >
                            <div className="flex items-center justify-between font-bold text-stone-100">
                              <div className="flex items-center gap-1.5">
                                <span>{item.itemName}</span>
                                {allDepletedProductNames.has(item.itemName) && (
                                  <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700/80 px-1.5 py-0.2 rounded font-mono animate-pulse">
                                    ۸۶ شده
                                  </span>
                                )}
                              </div>
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs">
                                × {item.quantity}
                              </span>
                            </div>

                            {/* Modifiers */}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {item.modifiers.map((mod, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="text-[10px] bg-stone-800 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>{mod}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.notes && (
                              <p className="mt-1 text-[11px] text-stone-400 italic">
                                یادداشت: {item.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Status Buttons */}
                    <div className="pt-2 border-t border-stone-800/80">
                      {isPending && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.orderId, 'IN_PREP')}
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition"
                        >
                          <PlayCircle className="w-4 h-4" />
                          <span>شروع آماده‌سازی (Start Prep)</span>
                        </button>
                      )}

                      {isInPrep && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.orderId, 'READY')}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>تکمیل و تحویل به مشتری (Ready)</span>
                        </button>
                      )}

                      {isReady && (
                        <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span>سفارش با موفقیت تحویل شد</span>
                          </div>
                          <button
                            onClick={() => handleUpdateStatus(ticket.orderId, 'IN_PREP')}
                            className="text-[10px] text-stone-400 hover:text-stone-200 underline"
                          >
                            بازگشت
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <div>
            <span>کل سفارشات بار امروز: </span>
            <strong className="text-stone-200">{tickets.length} سفارش</strong>
          </div>
          <button
            onClick={onClose}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-4 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
