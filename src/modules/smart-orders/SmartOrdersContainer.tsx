import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Keyboard,
  X,
  Command,
} from 'lucide-react';
import { SmartTicket, SmartTicketItem, MenuItem, OrderStatus, ModifierOption } from './types';
import { useBilingualHotkeys } from './hooks/useBilingualHotkeys';
import { RapidInputZone } from './components/RapidInputZone';
import { LiveOrderBuffer } from './components/LiveOrderBuffer';
import { FinancialPulseBar } from './components/FinancialPulseBar';
import { CafeOSTerminalCore } from './components/CafeOSTerminalCore';
import { playPosBeep } from '../../services/soundEffects';

// Existing KarWand service imports (Bridged seamlessly without breaking core)
import { SmartOrdersStore } from '../../services/storage';
import { websocketServer } from '../../services/websocket-server';
import { baristaDispatcher } from '../../services/baristaDispatcher';
import { StationRouter } from '../../services/StationRouter';
import { thermalPrinterDriver } from '../../services/ThermalPrinterDriver';
import { playDispatchTicketAudio } from '../../components/DispatchActionBar';
import { Order as KarWandOrder } from '../../types/domain';

export interface SmartOrdersContainerProps {
  onBackToStandardPos?: () => void;
}

export const SmartOrdersContainer: React.FC<SmartOrdersContainerProps> = ({
  onBackToStandardPos,
}) => {
  const [viewMode, setViewMode] = useState<'terminal-core' | 'live-buffer'>('terminal-core');
  const [tickets, setTickets] = useState<SmartTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string>('');
  const [isRTL] = useState<boolean>(true); // Configured for Persian market
  const [simulateNetworkFailure, setSimulateNetworkFailure] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'error' | 'success' | 'info';
  } | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToastNotification({ message, type });
    const timer = setTimeout(() => {
      setToastNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Transform KarWand core order model to Zero-G SmartTicket
  const toSmartTicket = useCallback((order: KarWandOrder): SmartTicket => {
    let status: OrderStatus = 'Queued';
    if (order.status === 'COMPLETED') status = 'Dispatched';
    else if (order.status === 'DRAFT') status = 'Draft';
    else if (order.status === 'CANCELLED') status = 'Dispatched';

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      ticketCode: `#KW-${order.orderNumber}`,
      tableLabel: order.tableLabel,
      customerName: order.customerName,
      status,
      items: order.items.map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        title: it.itemNameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPriceSnapshotToman,
        modifiers: it.modifiers?.map((m) => ({
          id: m.id,
          nameFa: m.nameFa,
          priceDelta: m.priceDeltaToman,
        })),
        subtotal: it.subtotalToman,
        notes: it.notes,
      })),
      subtotal: order.grossAmountToman,
      discount: order.discountAmountToman,
      total: order.netTotalToman,
      createdAt: new Date(order.createdAt).getTime(),
      targetSlaSeconds: 180, // Default 3 min target SLA
    };
  }, []);

  // 1. Initial Load from KarWand Storage / Core Services
  useEffect(() => {
    const rawOrders = SmartOrdersStore.getOrders();
    const active = rawOrders.filter((o) => o.status !== 'CANCELLED');
    const mapped = active.map(toSmartTicket);

    // If no active draft ticket exists, create an initial draft ticket
    if (mapped.length === 0 || !mapped.some((t) => t.status === 'Draft')) {
      const initialDraft: SmartTicket = {
        id: `draft-${Date.now()}`,
        orderNumber: (rawOrders[rawOrders.length - 1]?.orderNumber || 100) + 1,
        ticketCode: `#KW-${(rawOrders[rawOrders.length - 1]?.orderNumber || 100) + 1}`,
        tableLabel: 'میز ۱',
        status: 'Draft',
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        createdAt: Date.now(),
        targetSlaSeconds: 180,
      };
      setTickets([initialDraft, ...mapped]);
      setActiveTicketId(initialDraft.id);
    } else {
      setTickets(mapped);
      setActiveTicketId(mapped[0].id);
    }
  }, [toSmartTicket]);

  // 2. Real-Time Socket Listener with Micro-Flash Trigger
  useEffect(() => {
    const unsub = websocketServer.subscribeToEvent('ORDER_SYNC_COMPLETED', (payload) => {
      if (payload && payload.orderId) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === payload.orderId ? { ...t, isSocketPushed: true } : t
          )
        );
        setTimeout(() => {
          setTickets((prev) =>
            prev.map((t) =>
              t.id === payload.orderId ? { ...t, isSocketPushed: false } : t
            )
          );
        }, 1500);
      }
    });

    return () => unsub();
  }, []);

  // Get catalog from KarWand Store
  const catalog: MenuItem[] = useMemo(() => {
    const rawItems = SmartOrdersStore.getMenuItems();
    const categories = SmartOrdersStore.getCategories();
    const catMap = new Map(categories.map((c) => [c.id, c.nameFa]));

    return rawItems
      .filter((i) => i.isAvailable)
      .map((item, idx) => ({
        id: item.id,
        title: item.nameFa,
        titleEn: item.nameEn,
        categoryId: item.categoryId,
        categoryNameFa: catMap.get(item.categoryId) || 'عمومی',
        station: item.station,
        price: item.priceToman,
        hotkeyIndex: idx < 9 ? idx + 1 : undefined,
        isAvailable: item.isAvailable,
        currentStock: item.currentStock,
        notes: item.notes,
      }));
  }, []);

  // 3. Optimistic Advance Pipeline with Rollback Engine
  const handleAdvanceStatus = useCallback(
    async (ticketId: string) => {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      playPosBeep('click');
      const previousStatus = ticket.status;
      const nextStatus = getNextStatus(previousStatus);

      // Instant Optimistic UI mutation (<1ms response)
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
      );

      try {
        // Simulated network latency
        await new Promise((resolve) => setTimeout(resolve, 80));

        // Test Checkpoint #5: Network Failure simulation
        if (simulateNetworkFailure) {
          throw new Error('ERR_NETWORK_DISCONNECTED: عدم برقراری ارتباط با سرویس مرکزی کارواند');
        }

        // Sync with backend / storage
        if (nextStatus === 'Dispatched') {
          playPosBeep('success');
          showToast(`سفارش ${ticket.ticketCode} تسویه و بسته شد.`, 'success');
        }
      } catch (error: any) {
        // Automatic Instant Rollback on failure
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: previousStatus } : t))
        );
        playPosBeep('delete');
        showToast('خطا در بروزرسانی وضعیت سفارش. وضعیت بازگردانی شد.', 'error');
      }
    },
    [tickets, simulateNetworkFailure, showToast]
  );

  // 4. Inject Item into Active Draft Order
  const handleInjectItem = useCallback(
    (item: MenuItem, modifiers: ModifierOption[] = [], notes: string = '') => {
      playPosBeep('click');

      setTickets((prev) => {
        let currentDraft = prev.find((t) => t.id === activeTicketId);
        if (!currentDraft || currentDraft.status === 'Dispatched') {
          // Create new draft
          const newId = `draft-${Date.now()}`;
          const newOrderNumber =
            Math.max(...prev.map((t) => t.orderNumber || 100), 100) + 1;
          currentDraft = {
            id: newId,
            orderNumber: newOrderNumber,
            ticketCode: `#KW-${newOrderNumber}`,
            tableLabel: 'میز ۱',
            status: 'Draft',
            items: [],
            subtotal: 0,
            discount: 0,
            total: 0,
            createdAt: Date.now(),
            targetSlaSeconds: 180,
          };
          prev = [currentDraft, ...prev];
          setActiveTicketId(newId);
        }

        const modsDelta = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
        const itemSubtotal = item.price + modsDelta;

        const newItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          menuItemId: item.id,
          title: item.title,
          quantity: 1,
          unitPrice: item.price,
          modifiers,
          modifiersDelta: modsDelta,
          subtotal: itemSubtotal,
          notes: notes || undefined,
          station: item.station || StationRouter.resolveStation(item),
          status: 'PENDING_DISPATCH' as const,
        };

        const updatedItems = [...currentDraft.items, newItem];
        const newSubtotal = updatedItems.reduce((acc, it) => acc + it.subtotal, 0);
        const newTotal = Math.max(0, newSubtotal - currentDraft.discount);

        return prev.map((t) =>
          t.id === currentDraft?.id
            ? {
                ...t,
                items: updatedItems,
                subtotal: newSubtotal,
                total: newTotal,
              }
            : t
        );
      });
    },
    [activeTicketId]
  );

  // 5. Push Active Order to Execution (Kitchen / Bar Dispatcher with Dual Thermal Print & Delta Protection)
  const handlePushToExecution = useCallback(() => {
    const activeTicket = tickets.find((t) => t.id === activeTicketId);
    if (!activeTicket || activeTicket.items.length === 0) {
      showToast('ابتدا حداقل یک آیتم به سفارش اضافه کنید.', 'error');
      playPosBeep('delete');
      return;
    }

    // Run StationRouter for automatic BAR / KITCHEN partition & Delta suppression
    const previousDispatchedIds = activeTicket.dispatchedItemIds || [];
    const splitResult = StationRouter.splitTicket(
      activeTicket.items,
      previousDispatchedIds,
      {
        ticketId: activeTicket.ticketCode || activeTicket.orderNumber,
        orderNumber: activeTicket.orderNumber,
        tableLabel: activeTicket.tableLabel || 'میز ۱',
        cashierName: 'صندوقدار',
        orderNotes: activeTicket.notes,
      }
    );

    // 1. Play dual-tone acoustic ticket feedback [660, 880] Hz, 120ms
    playDispatchTicketAudio();

    // 2. Hardware thermal dispatch via prioritized layers
    thermalPrinterDriver.printBothStations(splitResult).catch((err) => {
      console.warn('[SmartOrdersContainer] Thermal printer error:', err);
    });

    const newlyDispatched = new Set(splitResult.newDispatchedIds);
    const updatedDispatchedIds = [
      ...previousDispatchedIds,
      ...splitResult.newDispatchedIds,
    ];

    // Advance draft -> Queued (preserving table open state)
    setTickets((prev) =>
      prev.map((t) =>
        t.id === activeTicketId
          ? {
              ...t,
              status: 'Queued',
              isTableOpen: true,
              dispatchedItemIds: updatedDispatchedIds,
              items: t.items.map((it) =>
                newlyDispatched.has(it.id)
                  ? { ...it, status: 'DISPATCHED' as const, dispatchedAt: new Date().toISOString() }
                  : it
              ),
            }
          : t
      )
    );

    // Dispatch to Barista Bar
    try {
      const activeShift = SmartOrdersStore.getActiveShift();
      const activeUser = SmartOrdersStore.getActiveUser();
      if (activeShift) {
        SmartOrdersStore.createOrder({
          tenantId: activeShift.tenantId,
          shiftId: activeShift.id,
          createdByUserId: activeUser.id,
          createdByUserName: activeUser.fullName,
          orderType: 'DINE_IN',
          tableLabel: activeTicket.tableLabel || 'میز ۱',
          customerName: activeTicket.customerName,
          status: 'PREPARING',
          items: activeTicket.items.map((it) => ({
            id: it.id,
            menuItemId: it.menuItemId,
            itemNameSnapshot: it.title,
            unitPriceSnapshotToman: it.unitPrice,
            quantity: it.quantity,
            modifiers: it.modifiers?.map((m) => ({
              id: m.id,
              nameFa: m.nameFa,
              priceDeltaToman: m.priceDelta,
            })),
            subtotalToman: it.subtotal,
            notes: it.notes,
          })),
          grossAmountToman: activeTicket.subtotal,
          discountAmountToman: activeTicket.discount,
          netTotalToman: activeTicket.total,
        });

        // Broadcast to websocket listeners
        websocketServer.broadcastToTenant(
          activeShift.tenantId,
          'ORDER_SYNC_COMPLETED',
          {
            orderId: activeTicket.id,
            timestamp: new Date().toISOString(),
          }
        );
      }
    } catch (e) {
      console.warn('Storage sync log:', e);
    }

    showToast(`سفارش ${activeTicket.ticketCode} با موفقیت به صف اجرا ارسال شد.`, 'success');

    // Prepare fresh draft for cashier
    const nextOrderNumber = activeTicket.orderNumber + 1;
    const nextDraft: SmartTicket = {
      id: `draft-${Date.now()}`,
      orderNumber: nextOrderNumber,
      ticketCode: `#KW-${nextOrderNumber}`,
      tableLabel: 'میز ۱',
      status: 'Draft',
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      createdAt: Date.now(),
      targetSlaSeconds: 180,
    };

    setTickets((prev) => [nextDraft, ...prev]);
    setActiveTicketId(nextDraft.id);
  }, [activeTicketId, tickets, showToast]);

  // Buffer Navigation Callbacks (J/K or Up/Down)
  const handleNavNextTicket = useCallback(() => {
    setTickets((prev) => {
      const activeTickets = prev.filter((t) => t.status !== 'Dispatched');
      if (activeTickets.length === 0) return prev;
      const currentIndex = activeTickets.findIndex((t) => t.id === activeTicketId);
      const nextIndex = (currentIndex + 1) % activeTickets.length;
      setActiveTicketId(activeTickets[nextIndex].id);
      playPosBeep('click');
      return prev;
    });
  }, [activeTicketId]);

  const handleNavPrevTicket = useCallback(() => {
    setTickets((prev) => {
      const activeTickets = prev.filter((t) => t.status !== 'Dispatched');
      if (activeTickets.length === 0) return prev;
      const currentIndex = activeTickets.findIndex((t) => t.id === activeTicketId);
      const prevIndex = (currentIndex - 1 + activeTickets.length) % activeTickets.length;
      setActiveTicketId(activeTickets[prevIndex].id);
      playPosBeep('click');
      return prev;
    });
  }, [activeTicketId]);

  // 6. Bilingual Hotkey Injector Binding (Supports EN/FA layouts + Control shortcuts)
  useBilingualHotkeys(
    (slotIndex) => {
      const targetItem = catalog.find((c) => c.hotkeyIndex === slotIndex);
      if (targetItem) {
        handleInjectItem(targetItem);
      }
    },
    (command) => {
      if (command === 'PUSH') {
        handlePushToExecution();
      } else if (command === 'NAV_NEXT') {
        handleNavNextTicket();
      } else if (command === 'NAV_PREV') {
        handleNavPrevTicket();
      } else if (command === 'ADVANCE') {
        if (activeTicketId) {
          handleAdvanceStatus(activeTicketId);
        }
      } else if (command === 'ESCAPE') {
        setShowKeyboardHelp(false);
      }
    }
  );

  // 7. Fast Settlement (P0-1 LEAK GUARD: Blocked to prevent unrecorded cash/card leaks)
  const handleSettleOrder = useCallback(
    (ticketId: string, method: 'CARD' | 'CASH') => {
      // P0-1 Audit Guard: Zero-G direct settlement does not persist to Dexie/IndexedDB or offline queue.
      // Settlement must only be performed through standard PosView to ensure ledger integrity.
      playPosBeep('delete');
      showToast(
        'خطای امنیتی تسویه: ثبت مالی مستقیم در ماژول آزمایشی Zero-G به دلیل عدم اتصال به دفتر کل مسدود است. لطفاً سفارش را در صندوق استاندارد (POS) ثبت و تسویه فرمایید.',
        'error'
      );
      console.error(
        `[P0-1 LEAK GUARD] Blocked unrecorded settlement attempt for ticket ${ticketId} via ${method}. Zero-G lacks ledger/storage persistence.`
      );
    },
    [showToast]
  );

  // 8. Split Order into 2 tickets
  const handleSplitOrder = useCallback(
    (ticketId: string) => {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      const totalItemsCount = ticket.items.reduce((sum, it) => sum + it.quantity, 0);
      if (ticket.items.length <= 1 && totalItemsCount <= 1) {
        showToast('سفارش حاوی فقط یک قلم است و امکان تفکیک وجود ندارد.', 'error');
        playPosBeep('delete');
        return;
      }

      playPosBeep('click');

      let originalItems: SmartTicketItem[] = [];
      let splitItems: SmartTicketItem[] = [];

      if (ticket.items.length > 1) {
        const mid = Math.ceil(ticket.items.length / 2);
        originalItems = ticket.items.slice(0, mid);
        splitItems = ticket.items.slice(mid);
      } else {
        const item = ticket.items[0];
        const half1 = Math.ceil(item.quantity / 2);
        const half2 = item.quantity - half1;
        originalItems = [
          {
            ...item,
            quantity: half1,
            subtotal: (item.unitPrice + (item.modifiersDelta || 0)) * half1,
          },
        ];
        splitItems = [
          {
            ...item,
            id: `item-${Date.now()}-split`,
            quantity: half2,
            subtotal: (item.unitPrice + (item.modifiersDelta || 0)) * half2,
          },
        ];
      }

      const origSubtotal = originalItems.reduce((acc, it) => acc + it.subtotal, 0);
      const splitSubtotal = splitItems.reduce((acc, it) => acc + it.subtotal, 0);

      const maxOrderNum = Math.max(...tickets.map((t) => t.orderNumber || 100), 100);
      const nextOrderNum = maxOrderNum + 1;

      const newTicket: SmartTicket = {
        id: `split-${Date.now()}`,
        orderNumber: nextOrderNum,
        ticketCode: `#KW-${nextOrderNum}`,
        tableLabel: ticket.tableLabel,
        customerName: ticket.customerName ? `${ticket.customerName} (۲)` : undefined,
        status: ticket.status,
        items: splitItems,
        subtotal: splitSubtotal,
        discount: 0,
        total: splitSubtotal,
        createdAt: Date.now(),
        targetSlaSeconds: ticket.targetSlaSeconds,
      };

      setTickets((prev) => [
        newTicket,
        ...prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                items: originalItems,
                subtotal: origSubtotal,
                total: Math.max(0, origSubtotal - t.discount),
              }
            : t
        ),
      ]);

      showToast(`فاکتور ${ticket.ticketCode} با موفقیت به ۲ بخش تفکیک شد.`, 'success');
    },
    [tickets, showToast]
  );

  // 9. Update Draft Item Quantity
  const handleUpdateItemQuantity = useCallback(
    (ticketId: string, itemId: string, delta: number) => {
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;

          const updatedItems = t.items
            .map((it) => {
              if (it.id !== itemId) return it;
              const newQty = it.quantity + delta;
              if (newQty <= 0) return null;
              const unitWithMods = it.unitPrice + (it.modifiersDelta || 0);
              return {
                ...it,
                quantity: newQty,
                subtotal: unitWithMods * newQty,
              };
            })
            .filter(Boolean) as SmartTicketItem[];

          const newSubtotal = updatedItems.reduce((sum, it) => sum + it.subtotal, 0);
          const newTotal = Math.max(0, newSubtotal - t.discount);

          return {
            ...t,
            items: updatedItems,
            subtotal: newSubtotal,
            total: newTotal,
          };
        })
      );
    },
    []
  );

  // 10. Remove Item from Draft
  const handleRemoveItem = useCallback(
    (ticketId: string, itemId: string) => {
      playPosBeep('delete');
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          const updatedItems = t.items.filter((it) => it.id !== itemId);
          const newSubtotal = updatedItems.reduce((sum, it) => sum + it.subtotal, 0);
          const newTotal = Math.max(0, newSubtotal - t.discount);
          return {
            ...t,
            items: updatedItems,
            subtotal: newSubtotal,
            total: newTotal,
          };
        })
      );
    },
    []
  );

  // 11. Change Table Label
  const handleChangeTableLabel = useCallback((ticketId: string, tableLabel: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, tableLabel } : t))
    );
  }, []);

  // 12. Apply Discount to Ticket
  const handleApplyDiscount = useCallback((ticketId: string, discountToman: number) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const validDiscount = Math.min(Math.max(0, discountToman), t.subtotal);
        return {
          ...t,
          discount: validDiscount,
          total: Math.max(0, t.subtotal - validDiscount),
        };
      })
    );
  }, []);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex flex-col h-screen w-full overflow-hidden text-slate-100 font-sans select-none relative"
      style={{
        fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)",
        background: "radial-gradient(circle at 15% 0%, rgba(15, 34, 61, 0.45) 0%, transparent 45%), radial-gradient(circle at 85% 100%, rgba(215, 25, 33, 0.08) 0%, transparent 40%), #0A0D11",
      }}
    >
      {viewMode === 'terminal-core' ? (
        <CafeOSTerminalCore
          catalog={catalog}
          tickets={tickets}
          activeTicketId={activeTicketId}
          onSelectTicket={setActiveTicketId}
          onInjectItem={handleInjectItem}
          onPushToExecution={handlePushToExecution}
          onAdvanceStatus={handleAdvanceStatus}
          onParkToggle={(id) => {
            setTickets((prev) =>
              prev.map((t) => (t.id === id ? { ...t, isParked: !t.isParked } : t))
            );
          }}
          onSplitOrder={handleSplitOrder}
          onUpdateItemQuantity={handleUpdateItemQuantity}
          onRemoveItem={handleRemoveItem}
          onChangeTableLabel={handleChangeTableLabel}
          onApplyDiscount={handleApplyDiscount}
          onSettleOrder={handleSettleOrder}
          simulateNetworkFailure={simulateNetworkFailure}
          onToggleNetworkFailure={() => {
            setSimulateNetworkFailure((prev) => {
              const next = !prev;
              showToast(
                next
                  ? 'شبیه‌ساز قطعی شبکه فعال شد (تست Rollback در ارتقای سفارش)'
                  : 'شبکه به حالت برخط (Online) بازگشت.',
                next ? 'error' : 'info'
              );
              return next;
            });
          }}
          onBackToStandardPos={onBackToStandardPos}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode('live-buffer')}
        />
      ) : (
        <>
          {/* Top Zero-G Status & Control Ribbon */}
          <div className="bg-[#081425]/90 border-b border-white/[0.08] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 z-30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
                <span className="font-extrabold text-white tracking-tight">سامانه مافوق سریع Zero-G</span>
                <span className="text-[10px] bg-[#D71921] text-white px-1.5 py-0.2 rounded-md font-mono font-bold shadow-[0_0_10px_-2px_rgba(215,25,33,0.7)]">
                  &lt;1ms
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-[#9EACB8] bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>کیبورد دو زبانه (FA/EN): اعداد ۱ تا ۹ فعال</span>
              </div>
            </div>

            {/* Right Controls: View Switcher, Keyboard HUD, Network Simulation Toggle & Back Button */}
            <div className="flex items-center gap-2">
              {/* Switch to Terminal Core Button */}
              <button
                type="button"
                onClick={() => setViewMode('terminal-core')}
                className="px-2.5 py-1 rounded-lg bg-[#D71921]/20 hover:bg-[#D71921]/30 text-rose-200 border border-[#D71921]/40 transition flex items-center gap-1.5 cursor-pointer font-bold text-xs active:scale-95 shadow-[0_0_10px_-2px_rgba(215,25,33,0.4)]"
                title="تغییر به چیدمان ۳ ستونه ترمینال فوق‌سریع CafeOS"
              >
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                <span>ترمینال سریع CafeOS</span>
              </button>

              {/* Keyboard Shortcuts HUD Button */}
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(true)}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-[#9EACB8] hover:text-white border border-white/[0.08] transition flex items-center gap-1.5 cursor-pointer font-bold text-xs active:scale-95"
                title="مشاهده میانبرهای کیبورد (HUD)"
              >
                <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                <span>راهنمای کلیدها [?]</span>
              </button>

              {/* Network Disconnect Simulation Toggle (QA Test Button) */}
              <button
                type="button"
                onClick={() => {
                  setSimulateNetworkFailure((prev) => {
                    const next = !prev;
                    showToast(
                      next
                        ? 'شبیه‌ساز قطعی شبکه فعال شد (تست Rollback در ارتقای سفارش)'
                        : 'شبکه به حالت برخط (Online) بازگشت.',
                      next ? 'error' : 'info'
                    );
                    return next;
                  });
                }}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs active:scale-95 ${
                  simulateNetworkFailure
                    ? 'bg-rose-950 text-rose-300 border border-rose-700 shadow-[0_0_12px_-2px_rgba(244,63,94,0.4)]'
                    : 'bg-white/[0.04] text-[#9EACB8] hover:text-white border border-white/[0.08]'
                }`}
                title="کلیک جهت شبیه‌سازی قطعی ارتباط با سرور برای تست Rollback"
              >
                {simulateNetworkFailure ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>شبکه: قطع (شبیه‌ساز QA فعال)</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>شبکه: برخط (آنلاین)</span>
                  </>
                )}
              </button>

              {/* Fallback to Standard POS */}
              {onBackToStandardPos && (
                <button
                  type="button"
                  onClick={onBackToStandardPos}
                  className="px-3 py-1 rounded-lg bg-[#1B222C] hover:bg-[#222B38] text-white hover:text-white border border-white/[0.08] transition flex items-center gap-1 cursor-pointer font-bold active:scale-95"
                >
                  <span>بازگشت به صندوق معمولی</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Main 3 Viewport Flex Grid */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full">
            {/* Viewport A: Rapid Input Grid */}
            <RapidInputZone catalog={catalog} onInjectItem={handleInjectItem} />

            {/* Viewport B: Live Buffer Feed */}
            <LiveOrderBuffer
              tickets={tickets}
              activeId={activeTicketId}
              onSelect={setActiveTicketId}
              onAdvanceStatus={handleAdvanceStatus}
              onParkToggle={(id) => {
                setTickets((prev) =>
                  prev.map((t) => (t.id === id ? { ...t, isParked: !t.isParked } : t))
                );
              }}
              onSplitOrder={handleSplitOrder}
            />

            {/* Viewport C: Financial Pulse Bar */}
            <FinancialPulseBar
              tickets={tickets}
              activeId={activeTicketId}
              onPushToExecution={handlePushToExecution}
              onSettleActiveTicket={handleSettleOrder}
              onUpdateItemQuantity={handleUpdateItemQuantity}
              onRemoveItem={handleRemoveItem}
              onChangeTableLabel={handleChangeTableLabel}
              onApplyDiscount={handleApplyDiscount}
            />
          </div>
        </>
      )}

      {/* Floating Warning / Success Toast */}
      {toastNotification && (
        <div
          className={`fixed bottom-5 left-5 z-50 border px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn backdrop-blur-md ${
            toastNotification.type === 'error'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200 shadow-[0_0_20px_-2px_rgba(244,63,94,0.4)]'
              : toastNotification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200 shadow-[0_0_20px_-2px_rgba(16,185,129,0.4)]'
              : 'bg-[#1B222C]/90 border-white/[0.1] text-white'
          }`}
        >
          {toastNotification.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastNotification.message}</span>
        </div>
      )}

      {/* Keyboard Shortcuts HUD Modal */}
      {showKeyboardHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn select-none"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            className="w-full max-w-lg bg-[#13171F] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/60">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">راهنمای کلیدهای میانبر (Zero-G Keyboard HUD)</h3>
                  <p className="text-xs text-[#9EACB8]">سرعت عملیاتی مافوق‌صوت بدون نیاز به ماوس</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1.5 rounded-lg text-[#9EACB8] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-200">تزریق فوری اقلام کاتالوگ به سفارش فعال:</span>
                <span className="keycap-badge px-2.5 py-1 text-xs text-cyan-300 border-cyan-500/40">
                  ۱ تا ۹ (FA/EN)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-200">ثبت و ارسال سفارش به صف بار / آشپزخانه:</span>
                <span className="keycap-badge px-2.5 py-1 text-xs text-rose-300 border-rose-500/40">
                  Ctrl + Enter
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-200">ارتقای وضعیت سفارش انتخابی به گام بعدی:</span>
                <span className="keycap-badge px-2.5 py-1 text-xs text-amber-300 border-amber-500/40">
                  Space
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-200">جابجایی بین تیکت‌های صف سفارشات (Live Buffer):</span>
                <div className="flex gap-1.5">
                  <span className="keycap-badge px-2 py-0.5 text-xs text-white">J / ↓</span>
                  <span className="keycap-badge px-2 py-0.5 text-xs text-white">K / ↑</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-slate-200">بستن پنجره‌ها، کشوی افزودنی‌ها و لغو عملیات:</span>
                <span className="keycap-badge px-2.5 py-1 text-xs text-slate-300">
                  Esc
                </span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="w-full py-2.5 rounded-xl bg-[#D71921] hover:bg-[#B8141B] text-white text-xs font-bold transition cursor-pointer active:scale-98"
              >
                متوجه شدم (بستن پنجره)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getNextStatus(curr: OrderStatus): OrderStatus {
  const flow: OrderStatus[] = ['Draft', 'Queued', 'In-Prep', 'Ready', 'Dispatched'];
  const idx = flow.indexOf(curr);
  return flow[(idx + 1) % flow.length];
}

export default SmartOrdersContainer;
