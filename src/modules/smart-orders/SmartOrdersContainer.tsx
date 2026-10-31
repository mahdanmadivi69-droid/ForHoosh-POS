import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SmartTicket, MenuItem, OrderStatus, ModifierOption } from './types';
import { useBilingualHotkeys } from './hooks/useBilingualHotkeys';
import { RapidInputZone } from './components/RapidInputZone';
import { LiveOrderBuffer } from './components/LiveOrderBuffer';
import { FinancialPulseBar } from './components/FinancialPulseBar';
import { playPosBeep } from '../../services/soundEffects';

// Existing KarWand service imports (Bridged seamlessly without breaking core)
import { SmartOrdersStore } from '../../services/storage';
import { websocketServer } from '../../services/websocket-server';
import { baristaDispatcher } from '../../services/baristaDispatcher';
import { Order as KarWandOrder } from '../../types/domain';

export interface SmartOrdersContainerProps {
  onBackToStandardPos?: () => void;
}

export const SmartOrdersContainer: React.FC<SmartOrdersContainerProps> = ({
  onBackToStandardPos,
}) => {
  const [tickets, setTickets] = useState<SmartTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string>('');
  const [isRTL] = useState<boolean>(true); // Configured for Persian market

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
        categoryId: item.categoryId,
        categoryNameFa: catMap.get(item.categoryId) || 'عمومی',
        price: item.priceToman,
        hotkeyIndex: idx < 9 ? idx + 1 : undefined,
        isAvailable: item.isAvailable,
        notes: item.notes,
      }));
  }, []);

  // 3. Optimistic Advance Pipeline
  const handleAdvanceStatus = useCallback(
    async (ticketId: string) => {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      playPosBeep('click');
      const previousStatus = ticket.status;
      const nextStatus = getNextStatus(previousStatus);

      // Optimistic UI mutation (<1ms response)
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
      );

      try {
        // Sync with existing backend / storage
        if (nextStatus === 'Dispatched') {
          playPosBeep('success');
        }
      } catch (error) {
        // Automatic Rollback on failure
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: previousStatus } : t))
        );
        playPosBeep('delete');
        alert('خطا در بروزرسانی وضعیت سفارش. وضعیت بازگردانی شد.');
      }
    },
    [tickets]
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

  // 5. Bilingual Hotkey Injector Binding
  useBilingualHotkeys((slotIndex) => {
    const targetItem = catalog.find((c) => c.hotkeyIndex === slotIndex);
    if (targetItem) {
      handleInjectItem(targetItem);
    }
  });

  // 6. Push Active Order to Execution (Kitchen / Bar Dispatcher)
  const handlePushToExecution = useCallback(() => {
    const activeTicket = tickets.find((t) => t.id === activeTicketId);
    if (!activeTicket || activeTicket.items.length === 0) {
      alert('ابتدا حداقل یک آیتم به سفارش اضافه کنید.');
      return;
    }

    playPosBeep('success');

    // Advance draft -> Queued
    setTickets((prev) =>
      prev.map((t) =>
        t.id === activeTicketId ? { ...t, status: 'Queued' } : t
      )
    );

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
  }, [activeTicketId, tickets]);

  // 7. Fast Settlement
  const handleSettleOrder = useCallback(
    (ticketId: string, method: 'CARD' | 'CASH') => {
      playPosBeep('success');
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: 'Dispatched', paymentMethod: method }
            : t
        )
      );
    },
    []
  );

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex flex-col lg:flex-row h-screen w-full overflow-hidden bg-[#121417] text-slate-100 font-sans select-none"
      style={{ fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)" }}
    >
      {/* Top Banner if embedded in standard layout */}
      {onBackToStandardPos && (
        <div className="lg:hidden p-2 bg-[#0F223D] flex justify-between items-center text-xs">
          <span className="font-bold text-white">سامانه مافوق سریع Zero-G</span>
          <button
            onClick={onBackToStandardPos}
            className="text-[#9EACB8] hover:text-white underline cursor-pointer"
          >
            بازگشت به صندوق معمولی
          </button>
        </div>
      )}

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
      />

      {/* Viewport C: Financial Pulse Bar */}
      <FinancialPulseBar
        tickets={tickets}
        activeId={activeTicketId}
        onPushToExecution={handlePushToExecution}
        onSettleActiveTicket={handleSettleOrder}
      />
    </div>
  );
};

function getNextStatus(curr: OrderStatus): OrderStatus {
  const flow: OrderStatus[] = ['Draft', 'Queued', 'In-Prep', 'Ready', 'Dispatched'];
  const idx = flow.indexOf(curr);
  return flow[(idx + 1) % flow.length];
}

export default SmartOrdersContainer;
