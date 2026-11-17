import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Percent,
  CheckCircle2,
  Printer,
  X,
  AlertCircle,
  AlertTriangle,
  Coffee,
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Bluetooth,
  Usb,
  Sliders,
  Store,
  Layers,
  ArrowRight,
  Lock,
  Gamepad2,
  Settings2,
  Map as MapIcon,
  Clock,
} from 'lucide-react';
import {
  Category,
  MenuItem,
  Order,
  OrderItem,
  OrderType,
  Payment,
  PaymentMethod,
  Shift,
  Tenant,
  User,
  isManagerOrOwner,
} from '../types/domain';
import {
  formatToman,
  calculateOrderTotals,
  safeInt,
  evaluateStockStatus,
  countStockAlerts,
} from '../services/financialMath';
import { ReceiptPreview } from './ReceiptPreview';
import { ModifierModal } from './ModifierModal';
import { ModifierOption } from '../types/order-domain';
import { toOrderAggregate } from '../types/order-adapter';
import { globalOfflineSyncQueue, QueueStats } from '../services/offlineSyncQueue';
import { baristaDispatcher } from '../services/baristaDispatcher';
import {
  renderReceiptToCanvas,
  convertCanvasToEscPosRaster,
  printDirectWebUSB,
  printDirectWebBluetooth,
} from '../services/escposThermalPrinter';
import { playPosBeep } from '../services/soundEffects';
import { printThermalReceipt } from '../services/receiptPrinter';
import { MODENDO_FLOOR_NODES, TableSession } from './FloorPlanCanvas';
import { openTabService } from '../services/openTabService';
import { TabCartItem } from '../types/inventory-tab';
import { getProductWallpaper } from '../utils/productWallpapers';

const MODENDO_FLOOR_SESSIONS_STORAGE_KEY = 'cafeos_modendo_floor_sessions_v2';

// Iranian common banknotes in Toman for rapid cash calculation
const IRANIAN_BANKNOTES_TOMAN = [
  50000,
  100000,
  200000,
  500000,
  1000000,
  2000000,
];

export interface PosBoundTableInfo {
  nodeId: string;
  label: string;
  titleFa: string;
  kind: 'TABLE' | 'PS5';
  guestCount?: number;
  ps5FeeToman?: number;
}

interface PosViewProps {
  tenant: Tenant;
  categories: Category[];
  menuItems: MenuItem[];
  activeShift: Shift | null;
  activeUser: User;
  onOrderCompleted: (
    order: Order,
    paymentMethod: PaymentMethod,
    referenceCode?: string,
    terminalName?: string
  ) => { order: Order; payment: Payment } | null;
  onOpenShiftRequired: () => void;
  onOpenZReport?: () => void;
  // Optional Modendo Table-First Drill-Down props (100hich leaves these undefined)
  preselectedTableLabel?: string | null;
  boundTable?: PosBoundTableInfo | null;
  initialCartItems?: OrderItem[];
  initialCustomerName?: string;
  initialOrderNotes?: string;
  initialDiscountToman?: number;
  initialDiscountPercent?: number;
  onCartSessionChange?: (
    nodeId: string,
    snapshot: {
      cartItems: OrderItem[];
      customerName: string;
      orderNotes: string;
      discountToman: number;
      discountPercent: number;
    }
  ) => void;
  onBackToFloorPlan?: () => void;
  onStartTakeaway?: () => void;
  onInspectBoundTable?: (nodeId: string) => void;
  onTableOrderSettled?: (nodeId: string, order: Order) => void;
  onSaveOpenTableTab?: (payload: {
    nodeId?: string;
    tableLabel: string;
    cartItems: OrderItem[];
    customerName: string;
    orderNotes: string;
    discountToman: number;
    discountPercent: number;
  }) => void;
}

export const PosView: React.FC<PosViewProps> = ({
  tenant,
  categories,
  menuItems,
  activeShift,
  activeUser,
  onOrderCompleted,
  onOpenShiftRequired,
  preselectedTableLabel,
  boundTable,
  initialCartItems,
  initialCustomerName,
  initialOrderNotes,
  initialDiscountToman,
  initialDiscountPercent,
  onCartSessionChange,
  onBackToFloorPlan,
  onStartTakeaway,
  onInspectBoundTable,
  onTableOrderSettled,
  onSaveOpenTableTab,
}) => {
  const isModendo =
    tenant.id === 'tenant-modendo-01' ||
    tenant.id === 'modendo' ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'modendo') ||
    (typeof import.meta !== 'undefined' && /modendo/i.test((import.meta as any).env?.VITE_TENANT_ID || '')) ||
    (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'modendo');
  const canEditFinancials = isManagerOrOwner(activeUser.role);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [roastFilter, setRoastFilter] = useState<'all' | 'medium' | 'dark' | 'light'>('all');
  const [modendoGroupFilter, setModendoGroupFilter] = useState<'all' | 'gaming' | 'drinks' | 'food'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'ALERTS_ONLY'>('ALL');

  // Reset catalog filters on tenant change
  useEffect(() => {
    setSelectedCategoryId('all');
    setRoastFilter('all');
    setModendoGroupFilter('all');
    setSearchQuery('');
    setStockFilter('ALL');
  }, [tenant.id]);

  // Configurable default threshold for low stock alert
  const [globalThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('smartorders_stock_threshold');
      return saved ? Math.max(1, parseInt(saved, 10)) : 5;
    } catch {
      return 5;
    }
  });

  // Current Order / Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>(() => initialCartItems ?? []);
  const [orderType, setOrderType] = useState<OrderType>(() =>
    boundTable ? 'DINE_IN' : 'TAKEAWAY'
  );
  const [tableLabel, setTableLabel] = useState<string>(
    () => boundTable?.label || (isModendo ? 'M-01' : 'میز ۱')
  );
  const [customerName, setCustomerName] = useState<string>(() => initialCustomerName ?? '');
  const [orderNotes, setOrderNotes] = useState<string>(() => initialOrderNotes ?? '');
  const [discountToman, setDiscountToman] = useState<number>(() => initialDiscountToman ?? 0);
  const [discountPercent, setDiscountPercent] = useState<number>(() => initialDiscountPercent ?? 0);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const skipSessionSyncRef = useRef<boolean>(false);

  // Hydrate cart when switching bound table or entering Takeaway mode
  const boundNodeKey = boundTable ? boundTable.nodeId : 'TAKEAWAY';
  useEffect(() => {
    skipSessionSyncRef.current = true;
    if (boundTable) {
      setOrderType('DINE_IN');
      setTableLabel(boundTable.label);
      setCartItems(initialCartItems ?? []);
      setCustomerName(initialCustomerName ?? '');
      setOrderNotes(initialOrderNotes ?? '');
      setDiscountToman(initialDiscountToman ?? 0);
      setDiscountPercent(initialDiscountPercent ?? 0);
    } else if (onBackToFloorPlan) {
      setOrderType('TAKEAWAY');
      setCartItems([]);
      setCustomerName('');
      setOrderNotes('');
      setDiscountToman(0);
      setDiscountPercent(0);
    }
  }, [boundNodeKey]);

  useEffect(() => {
    if (boundTable?.label) {
      setTableLabel(boundTable.label);
    }
  }, [boundTable?.label]);

  useEffect(() => {
    if (preselectedTableLabel) {
      setTableLabel(preselectedTableLabel);
      setOrderType('DINE_IN');
      if (isModendo) {
        try {
          const raw =
            localStorage.getItem(MODENDO_FLOOR_SESSIONS_STORAGE_KEY) ||
            localStorage.getItem('modendo_floor_sessions_v1');
          if (raw) {
            const sessions: Record<string, TableSession> = JSON.parse(raw);
            const node = MODENDO_FLOOR_NODES.find(
              (n) => n.label === preselectedTableLabel || n.id === preselectedTableLabel
            );
            const session = node
              ? sessions[node.id]
              : Object.values(sessions).find((s) => s.tableLabel === preselectedTableLabel);
            if (session && Array.isArray(session.cartItems) && session.cartItems.length > 0) {
              setCartItems(session.cartItems);
              setCustomerName(session.customerName || '');
              setOrderNotes(session.notes || '');
              setDiscountToman(session.discountToman || 0);
              setDiscountPercent(session.discountPercent || 0);
            } else if (session) {
              setCartItems([]);
              setCustomerName(session.customerName || '');
              setOrderNotes(session.notes || '');
              setDiscountToman(session.discountToman || 0);
              setDiscountPercent(session.discountPercent || 0);
            }
          }
        } catch (e) {
          console.warn('Failed loading session for preselected table:', e);
        }
      }
    }
  }, [preselectedTableLabel, isModendo]);

  // Persist open-tab edits live back to FloorPlan session
  useEffect(() => {
    if (skipSessionSyncRef.current) {
      skipSessionSyncRef.current = false;
      return;
    }
    if (boundTable && onCartSessionChange) {
      onCartSessionChange(boundTable.nodeId, {
        cartItems,
        customerName,
        orderNotes,
        discountToman,
        discountPercent,
      });
    }
  }, [cartItems, customerName, orderNotes, discountToman, discountPercent, boundTable?.nodeId]);

  // Modifier sheet modal state
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [isModifierOpen, setIsModifierOpen] = useState<boolean>(false);

  // Offline Sync Queue state
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    failed: 0,
    paused: 0,
    quarantined: 0,
  });
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD_MANUAL');
  const [terminalName, setTerminalName] = useState<string>('پوز ۱ (بانک سامان)');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [completedReceiptOrder, setCompletedReceiptOrder] = useState<Order | null>(null);
  const [completedReceiptPayment, setCompletedReceiptPayment] = useState<Payment | null>(null);
  const [completedCashTendered, setCompletedCashTendered] = useState<number | undefined>(undefined);
  const [completedChange, setCompletedChange] = useState<number | undefined>(undefined);
  const [hardwarePrintStatus, setHardwarePrintStatus] = useState<string | null>(null);
  // P0-2: settling + persistence failure state. While `paymentError` is set the
  // payment buttons stay disabled — the receipt modal is never reached.
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Financial totals calculation
  const { grossAmountToman, discountAmountToman, netTotalToman } = calculateOrderTotals(
    cartItems,
    discountToman
  );

  // Subscribe to offline sync queue stats
  useEffect(() => {
    const unsubscribe = globalOfflineSyncQueue.subscribe((stats) => {
      setQueueStats(stats);
    });
    return () => unsubscribe();
  }, []);

  const stockAlertStats = countStockAlerts(menuItems, globalThreshold);

  // P0-2: while a persistence error is unresolved (or a save is in flight) the
  // checkout buttons stay disabled; only an explicit retry clears the error.
  const isPaymentBlocked = isSettling || paymentError !== null;

  const MODENDO_GROUP_CATEGORIES: Record<'gaming' | 'drinks' | 'food', string[]> = {
    gaming: ['mod-cat-gaming', 'mod-cat-lounge'],
    drinks: [
      'mod-cat-espresso',
      'mod-cat-mocha',
      'mod-cat-tea',
      'mod-cat-iced',
      'mod-cat-mocktails',
      'mod-cat-shakes',
    ],
    food: [
      'mod-cat-bakery',
      'mod-cat-burgers',
      'mod-cat-pasta',
      'mod-cat-pizza',
      'mod-cat-appetizers',
      'mod-cat-salads',
      'mod-cat-desserts',
    ],
  };

  const visibleCategories =
    isModendo && modendoGroupFilter !== 'all'
      ? categories.filter((c) => MODENDO_GROUP_CATEGORIES[modendoGroupFilter].includes(c.id))
      : categories;

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    if (!item.isAvailable) return false;
    const matchesCat = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;

    let matchesSubFilter = true;
    if (isModendo) {
      if (modendoGroupFilter !== 'all') {
        matchesSubFilter = MODENDO_GROUP_CATEGORIES[modendoGroupFilter].includes(item.categoryId);
      }
    } else {
      matchesSubFilter = roastFilter === 'all' || item.roast === roastFilter;
    }

    const matchesSearch =
      !searchQuery.trim() ||
      item.nameFa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.origin && item.origin.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.notes && item.notes.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchesCat || !matchesSubFilter || !matchesSearch) return false;

    if (stockFilter === 'ALERTS_ONLY') {
      const status = evaluateStockStatus(item.currentStock, item.lowStockThreshold, globalThreshold).status;
      return status === 'LOW' || status === 'OUT_OF_STOCK';
    }
    return true;
  });

  // Hotkeys: 1-9 to add items, P for POS card, C for cash
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      // Hotkeys 1-9: Add corresponding item
      const keyNum = parseInt(e.key, 10);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
        const itemIdx = keyNum - 1;
        if (filteredItems[itemIdx]) {
          e.preventDefault();
          handleAddItem(filteredItems[itemIdx]);
        }
        return;
      }

      // Hotkey 'P' or 'p': Direct POS Card payment
      if (e.key === 'p' || e.key === 'P' || e.key === 'پ') {
        if (cartItems.length > 0 && activeShift) {
          e.preventDefault();
          setPaymentMethod('CARD_MANUAL');
          setIsCheckoutOpen(true);
        }
        return;
      }

      // Hotkey 'C' or 'c': Direct Cash payment
      if (e.key === 'c' || e.key === 'C') {
        if (cartItems.length > 0 && activeShift) {
          e.preventDefault();
          setPaymentMethod('CASH');
          setCashTendered(netTotalToman);
          setIsCheckoutOpen(true);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, cartItems, activeShift, netTotalToman]);

  useEffect(() => {
    if (!isCheckoutOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCheckoutOpen(false);
        setPaymentError(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCheckoutOpen]);

  // Cart operations
  const handleAddItem = (item: MenuItem) => {
    if (item.currentStock !== undefined && item.currentStock <= 0) {
      playPosBeep('delete');
      return;
    }

    playPosBeep('click');

    setCartItems((prev) => {
      const existing = prev.find(
        (i) => i.menuItemId === item.id && (!i.modifiers || i.modifiers.length === 0)
      );
      if (existing) {
        if (item.currentStock !== undefined && existing.quantity >= item.currentStock) {
          return prev;
        }
        return prev.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotalToman: (i.quantity + 1) * i.unitPriceSnapshotToman,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          menuItemId: item.id,
          itemNameSnapshot: item.nameFa,
          unitPriceSnapshotToman: item.priceToman,
          quantity: 1,
          subtotalToman: item.priceToman,
          modifiers: [],
        },
      ];
    });
  };

  const handleAddWithModifiers = (
    item: MenuItem,
    selectedModifiers: ModifierOption[],
    notes: string
  ) => {
    playPosBeep('click');
    const modifiersDelta = selectedModifiers.reduce((sum, m) => sum + m.priceDeltaToman, 0);
    const unitPrice = item.priceToman + modifiersDelta;

    setCartItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        menuItemId: item.id,
        itemNameSnapshot: item.nameFa,
        unitPriceSnapshotToman: unitPrice,
        quantity: 1,
        subtotalToman: unitPrice,
        modifiers: selectedModifiers,
        notes: notes || undefined,
      },
    ]);
  };

  const handleOpenModifierModal = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    playPosBeep('click');
    setModifierItem(item);
    setIsModifierOpen(true);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    if (delta < 0) {
      playPosBeep('delete');
    } else {
      playPosBeep('click');
    }

    setCartItems((prev) => {
      return prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0) {
              const matchedItem = menuItems.find((m) => m.id === i.menuItemId);
              if (
                matchedItem &&
                matchedItem.currentStock !== undefined &&
                newQty > matchedItem.currentStock
              ) {
                return i;
              }
            }
            return {
              ...i,
              quantity: newQty,
              subtotalToman: newQty * i.unitPriceSnapshotToman,
            };
          }
          return i;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const handleRemoveItem = (itemId: string) => {
    playPosBeep('delete');
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleClearCart = () => {
    if (cartItems.length > 0) {
      playPosBeep('delete');
    }
    setCartItems([]);
    setDiscountToman(0);
    setDiscountPercent(0);
    setCustomerName('');
    setOrderNotes('');
  };

  const handleSaveAsOpenTable = async () => {
    playPosBeep('success');

    const targetNode =
      MODENDO_FLOOR_NODES.find((n) => n.label === tableLabel || n.id === tableLabel) ||
      MODENDO_FLOOR_NODES[0];
    const targetNodeId = boundTable?.nodeId || targetNode?.id || tableLabel;
    const targetLabel = boundTable?.label || targetNode?.label || tableLabel;

    if (isModendo) {
      // 1. Persist to shared floor sessions with live timer & status
      try {
        const raw = localStorage.getItem(MODENDO_FLOOR_SESSIONS_STORAGE_KEY);
        const sessions: Record<string, TableSession> = raw ? JSON.parse(raw) : {};
        const existing = sessions[targetNodeId];
        const nowIso = new Date().toISOString();

        sessions[targetNodeId] = {
          nodeId: targetNodeId,
          tableLabel: targetLabel,
          kind: targetNode?.kind || 'TABLE',
          status: 'OCCUPIED',
          openedAt: existing?.openedAt || nowIso,
          guestCount: existing?.guestCount || boundTable?.guestCount || targetNode?.seats || 2,
          customerName: customerName || existing?.customerName || '',
          notes: orderNotes || existing?.notes || '',
          cartItems: [...cartItems],
          discountToman,
          discountPercent,
          mergedIntoNodeId: existing?.mergedIntoNodeId,
          mergedNodeIds: existing?.mergedNodeIds,
          ps5Session:
            existing?.ps5Session ||
            (targetNode?.kind === 'PS5'
              ? {
                  startedAt: existing?.openedAt || nowIso,
                  hourlyRateToman: targetNode.hourlyRateToman || 180000,
                  controllersCount: 2,
                  accumulatedMs: 0,
                  isPaused: false,
                }
              : undefined),
        };

        localStorage.setItem(MODENDO_FLOOR_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
        window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: sessions }));
      } catch (e) {
        console.warn('[PosView] Failed saving to floor sessions:', e);
      }

      // 2. Sync to openTabService
      try {
        const effectiveTenantId = tenant.id === 'modendo' ? 'tenant-modendo-01' : tenant.id;
        const tabItems: TabCartItem[] = cartItems.map((ci) => ({
          id: ci.id,
          menuItemId: ci.menuItemId,
          title: ci.itemNameSnapshot,
          unitPrice: ci.unitPriceSnapshotToman,
          quantity: ci.quantity,
          subtotal: ci.subtotalToman,
          modifiers: [],
          notes: ci.notes,
        }));

        const existingTab =
          openTabService.getTabForTable(targetNodeId, effectiveTenantId) ||
          openTabService.getTabForTable(targetLabel, effectiveTenantId);

        if (existingTab) {
          if (tabItems.length > 0) {
            openTabService.addRoundToTab(existingTab.tab_id, tabItems, true, effectiveTenantId);
          }
        } else {
          openTabService.openTab(
            targetNodeId,
            targetLabel,
            activeUser.fullName,
            targetNode?.seats || 2,
            tabItems,
            effectiveTenantId
          );
        }
      } catch (e) {
        console.warn('[PosView] Failed syncing to openTabService:', e);
      }

      // 3. Dispatch to Bar/Kitchen KDS if cartItems > 0
      if (cartItems.length > 0) {
        try {
          const effectiveTenantId = tenant.id === 'modendo' ? 'tenant-modendo-01' : tenant.id;
          const kdsOrder = {
            id: `open-tab-${targetNodeId}-${Date.now()}`,
            orderNumber: Math.floor(1000 + Math.random() * 9000),
            clientGeneratedId: `client-${Date.now()}`,
            tenantId: effectiveTenantId,
            orderType: 'DINE_IN',
            tableLabel: targetLabel,
            customerName: customerName || `میز ${targetLabel}`,
            items: cartItems,
          };
          await baristaDispatcher.dispatchOrder(kdsOrder, effectiveTenantId);
        } catch (e) {
          console.warn('[PosView] Failed to dispatch open table order to KDS:', e);
        }
      }
    }

    if (onSaveOpenTableTab) {
      onSaveOpenTableTab({
        nodeId: targetNodeId,
        tableLabel: targetLabel,
        cartItems,
        customerName,
        orderNotes,
        discountToman,
        discountPercent,
      });
    }

    if (!boundTable) {
      setCartItems([]);
      setDiscountToman(0);
      setDiscountPercent(0);
      setCustomerName('');
      setOrderNotes('');
    }

    // Return to 3-wing floor plan view
    if (onBackToFloorPlan) {
      onBackToFloorPlan();
    }
  };

  const handleApplyDiscountPercent = (percent: number) => {
    if (!canEditFinancials && percent > 0) {
      alert('دسترسی تدوین تخفیف فقط برای مدیر و مالک سیستم مجاز است.');
      return;
    }
    playPosBeep('click');
    setDiscountPercent(percent);
    const calculatedDiscount = Math.round((grossAmountToman * percent) / 100);
    setDiscountToman(calculatedDiscount);
  };

  // Trigger manual sync
  const handleTriggerManualSync = async () => {
    playPosBeep('click');
    setIsManualSyncing(true);
    try {
      await globalOfflineSyncQueue.triggerSync();
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Checkout submission
  const handleStartCheckout = () => {
    playPosBeep('click');
    if (!activeShift) {
      onOpenShiftRequired();
      return;
    }
    if (cartItems.length === 0) return;
    setPaymentError(null);
    setCashTendered(netTotalToman);
    setIsCheckoutOpen(true);
  };

  const handleConfirmPayment = (autoPrint = false) => {
    if (!activeShift) return;
    // P0-2: a previous persistence failure blocks the button until the cashier
    // acknowledges it (retry) — no double-click can slip a second sale through.
    if (isSettling || paymentError) return;

    setIsSettling(true);
    setPaymentError(null);

    try {
      const clientGeneratedId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newOrder: Order = {
        id: `order-${Date.now()}`,
        tenantId: activeShift.tenantId,
        shiftId: activeShift.id,
        createdByUserId: activeUser.id,
        createdByUserName: activeUser.fullName,
        orderNumber: 0,
        orderType,
        tableLabel: orderType === 'DINE_IN' ? tableLabel : undefined,
        customerName: customerName.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        status: 'COMPLETED',
        items: cartItems,
        grossAmountToman,
        discountAmountToman,
        netTotalToman,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = onOrderCompleted(
        newOrder,
        paymentMethod,
        referenceCode.trim() || undefined,
        terminalName
      );

      if (!result) {
        // Blocked before persistence (e.g. no active shift). Keep the modal
        // open, show nothing success-like, no receipt.
        return;
      }

      // Reached only after createOrder + recordPayment were persisted.
      playPosBeep('success');
      const orderSyncPayload = toOrderAggregate(result.order, [result.payment], clientGeneratedId, 'PAID');

      // 1. Enqueue in OfflineSyncQueue (IndexedDB)
      globalOfflineSyncQueue.enqueue(orderSyncPayload).catch((err) => {
        console.warn('Enqueue into offline database failed:', err);
      });

      // 2. Dispatch to Barista Bar in real time
      baristaDispatcher.dispatchPaidOrder(orderSyncPayload).catch((err) => {
        console.warn('Dispatching to barista bar failed:', err);
      });

      setCompletedReceiptOrder(result.order);
      setCompletedReceiptPayment(result.payment);
      if (paymentMethod === 'CASH') {
        setCompletedCashTendered(cashTendered);
        setCompletedChange(Math.max(0, cashTendered - netTotalToman));
      } else {
        setCompletedCashTendered(undefined);
        setCompletedChange(undefined);
      }
      setIsCheckoutOpen(false);
      if (boundTable && onTableOrderSettled) {
        onTableOrderSettled(boundTable.nodeId, result.order);
      }
      if (isModendo && orderType === 'DINE_IN') {
        try {
          const raw = localStorage.getItem(MODENDO_FLOOR_SESSIONS_STORAGE_KEY);
          if (raw) {
            const sessions: Record<string, TableSession> = JSON.parse(raw);
            const targetNode = MODENDO_FLOOR_NODES.find(
              (n) => n.label === tableLabel || n.id === tableLabel
            );
            const targetNodeId = boundTable?.nodeId || targetNode?.id || tableLabel;
            if (sessions[targetNodeId]) {
              delete sessions[targetNodeId];
              localStorage.setItem(MODENDO_FLOOR_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
              window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: sessions }));
            }
          }
          const effectiveTenantId = tenant.id === 'modendo' ? 'tenant-modendo-01' : tenant.id;
          const targetTab = openTabService.getTabForTable(tableLabel, effectiveTenantId);
          if (targetTab) {
            openTabService.settleTab(
              targetTab.tab_id,
              {
                paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'CARD',
                referenceCode,
              },
              effectiveTenantId
            );
          }
        } catch (e) {
          console.warn('[PosView] Clearing settled table session failed:', e);
        }
      }
      handleClearCart();
      setReferenceCode('');
      setIsMobileCartOpen(false);

      if (autoPrint) {
        setTimeout(() => {
          printThermalReceipt('thermal-receipt');
        }, 300);
      }
    } catch (err: any) {
      // P0-2: order/payment persistence failed. Keep the cart and modal
      // intact, disable the payment buttons and show the real error.
      // No receipt modal is opened and no success sound is played.
      console.error('[PosView] checkout persistence failed', err);
      setPaymentError(err?.message || 'خطای نامشخص در ذخیره‌سازی فاکتور و پرداخت');
      playPosBeep('delete');
    } finally {
      setIsSettling(false);
    }
  };

  // Direct Hardware ESC/POS Raster Print Handler (WebUSB / Bluetooth)
  const handleHardwarePrint = async (type: 'USB' | 'BLUETOOTH') => {
    if (!completedReceiptOrder) return;
    setHardwarePrintStatus('در حال اتصال به چاپگر حرارتی...');

    try {
      const printPayload = toOrderAggregate(completedReceiptOrder, completedReceiptPayment ? [completedReceiptPayment] : []);

      const canvas = renderReceiptToCanvas(printPayload, tenant);

      const rasterBytes = convertCanvasToEscPosRaster(canvas);

      if (type === 'USB') {
        const ok = await printDirectWebUSB(rasterBytes);
        setHardwarePrintStatus(ok ? 'فیش با موفقیت چاپ شد' : 'اتصال WebUSB لغو شد');
      } else {
        const ok = await printDirectWebBluetooth(rasterBytes);
        setHardwarePrintStatus(ok ? 'فیش از طریق بلوتوث چاپ شد' : 'اتصال بلوتوث لغو شد');
      }
    } catch (e) {
      console.error(e);
      setHardwarePrintStatus('خطا در ارتباط با پرینتر حرارتی');
    }
  };

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-4 p-3 md:p-5 max-w-[1720px] mx-auto w-full relative select-none">
      {/* ================= LEFT / MAIN: Catalog & Products Section ================= */}
      <section className="flex-1 flex flex-col min-w-0 pb-24 xl:pb-8">
        {/* Modendo: Unified Calm Top Bar (Table Navigation + Search + Queue Alert) */}
        {isModendo ? (
          <div className="space-y-3 mb-4">
            <div className="rounded-[22px] liquid-glass-shell p-2.5 md:px-4 md:py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {onBackToFloorPlan && (
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      onBackToFloorPlan();
                    }}
                    className="px-4 py-2 rounded-full liquid-glass-cta font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>نقشه سالن</span>
                  </button>
                )}

                {boundTable ? (
                  <div className="flex items-center gap-2 liquid-glass-well px-3.5 py-1.5 rounded-full text-xs">
                    {boundTable.kind === 'PS5' ? (
                      <Gamepad2 className="w-3.5 h-3.5 text-sky-400" />
                    ) : (
                      <MapIcon className="w-3.5 h-3.5 text-[#10B981]" />
                    )}
                    <strong className="text-white font-black">{boundTable.label}</strong>
                    {boundTable.guestCount && (
                      <span className="text-[11px] text-[#94A3B8] tabular-nums">
                        · {boundTable.guestCount} نفر
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 liquid-glass-well px-3.5 py-1.5 rounded-full text-xs">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                    <strong className="text-amber-200 font-bold">بیرون‌بر / آزاد</strong>
                  </div>
                )}

                {boundTable?.kind === 'PS5' &&
                  boundTable.ps5FeeToman !== undefined &&
                  boundTable.ps5FeeToman > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const fee = safeInt(boundTable.ps5FeeToman || 0);
                        if (fee <= 0) return;
                        playPosBeep('click');
                        setCartItems((prev) => {
                          const existingIdx = prev.findIndex((i) => i.menuItemId === 'ps5-gaming-fee');
                          const ps5Item: OrderItem = {
                            id: `ps5-fee-${boundTable.nodeId}`,
                            menuItemId: 'ps5-gaming-fee',
                            itemNameSnapshot: `هزینه بازی ${boundTable.label}`,
                            unitPriceSnapshotToman: fee,
                            quantity: 1,
                            subtotalToman: fee,
                            modifiers: [],
                          };
                          if (existingIdx >= 0) {
                            return prev.map((it, idx) => (idx === existingIdx ? ps5Item : it));
                          }
                          return [...prev, ps5Item];
                        });
                      }}
                      className="px-3 py-1.5 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer tabular-nums"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 text-sky-300" />
                      <span>+ بازی ({formatToman(boundTable.ps5FeeToman)} ت)</span>
                    </button>
                  )}

                {boundTable && onInspectBoundTable && (
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      onInspectBoundTable(boundTable.nodeId);
                    }}
                    className="px-3 py-1.5 rounded-full liquid-glass-pill text-[#E2E8F0] hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="hidden sm:inline">جزئیات / تایمر</span>
                  </button>
                )}

                {boundTable && onStartTakeaway && (
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      onStartTakeaway();
                    }}
                    className="px-3 py-1.5 rounded-full liquid-glass-pill text-amber-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline">بیرون‌بر</span>
                  </button>
                )}
              </div>

              {/* Search + Only show sync pill if pending > 0 */}
              <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                {queueStats.pending > 0 && (
                  <button
                    type="button"
                    onClick={handleTriggerManualSync}
                    disabled={isManualSyncing}
                    className="px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer tabular-nums"
                    title="سینک فوری صف آفلاین"
                  >
                    <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                    <span>{queueStats.pending} صف</span>
                  </button>
                )}

                {stockAlertStats.totalLowStock > 0 && (
                  <button
                    onClick={() => {
                      playPosBeep('click');
                      setStockFilter(stockFilter === 'ALL' ? 'ALERTS_ONLY' : 'ALL');
                    }}
                    className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      stockFilter === 'ALERTS_ONLY'
                        ? 'bg-rose-950/70 border-rose-500/70 text-rose-200'
                        : 'liquid-glass-pill text-rose-300'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{stockAlertStats.totalLowStock} کسری</span>
                  </button>
                )}

                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجو در منو..."
                    className="w-full liquid-glass-well rounded-full text-white text-xs pr-9 pl-3 py-2 focus:outline-none focus:border-[#10B981]/70 placeholder:text-[#94A3B8]/65 transition-colors"
                  />
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Hierarchical Clean Menu Filter: Primary Groups + Sub-Categories */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="liquid-glass-rail rounded-full p-1 flex items-center gap-1 shrink-0">
                {(
                  [
                    { id: 'all', label: 'همه' },
                    { id: 'gaming', label: 'گیمینگ' },
                    { id: 'drinks', label: 'نوشیدنی' },
                    { id: 'food', label: 'غذا و دسر' },
                  ] as const
                ).map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setModendoGroupFilter(grp.id);
                      setSelectedCategoryId('all');
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      modendoGroupFilter === grp.id
                        ? 'liquid-glass-cta font-black'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {grp.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                <button
                  onClick={() => {
                    playPosBeep('click');
                    setSelectedCategoryId('all');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                    selectedCategoryId === 'all'
                      ? 'bg-[#991B1B] text-white border border-[#DC2626] shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                      : 'bg-[#0A261E]/80 text-[#A3B8B0] border border-[#16382F] hover:text-white'
                  }`}
                >
                  همه محصولات
                </button>

                {visibleCategories.map((cat) => {
                  const isActive = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        playPosBeep('click');
                        setSelectedCategoryId(cat.id);
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                        isActive
                          ? 'bg-[#991B1B] text-white border border-[#DC2626] shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                          : 'bg-[#0A261E]/80 text-[#A3B8B0] border border-[#16382F] hover:text-white'
                      }`}
                    >
                      {cat.nameFa}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 100HICH Legacy Announcement & Category Bars (Preserved) */}
            <div className="bg-gradient-to-r from-[#0F223D] via-[#1B222C] to-[#0F223D] p-3 rounded-xl border border-[#293444] mb-3 flex flex-wrap items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-3">
                <span className="bg-[#D71921] text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                  NEW ROAST
                </span>
                <p className="text-xs md:text-sm font-semibold text-white">
                  روست هفتگی بلند اختصاصی{' '}
                  <span className="text-[#F3E9DD] font-bold">50/50 Brazil & Indonesia</span> آماده ارسال
                  و آسیاب تازه در بار
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-[#9EACB8]">
                <div className="hidden sm:flex items-center gap-1.5">
                  <span>دما و فشار بویلر:</span>
                  <strong className="text-white font-mono num-heavy">93.5°C | 9.1 Bar</strong>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>

                <div className="flex items-center gap-1.5 bg-[#121417]/80 px-2 py-0.5 rounded border border-[#293444]">
                  {queueStats.pending > 0 ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                      <span className="text-amber-300 font-bold font-mono num-heavy">
                        {queueStats.pending} صف آفلاین
                      </span>
                      <button
                        onClick={handleTriggerManualSync}
                        disabled={isManualSyncing}
                        className="p-1 hover:text-white"
                        title="سینک فوری با سرور"
                      >
                        <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">سینک برخط</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center overflow-x-auto scrollbar-none mb-3 select-none gap-2 pb-2">
              <button
                onClick={() => {
                  playPosBeep('click');
                  setSelectedCategoryId('all');
                }}
                className={`font-bold text-xs whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer px-3.5 py-2 rounded-xl border ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#D71921] border-[#D71921] text-white shadow-[0_0_20px_-3px_rgba(215,25,33,0.45)]'
                    : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white hover:border-[#9EACB8]'
                }`}
              >
                <span>⚡</span>
                <span>کل محصولات بار</span>
              </button>

              {categories.map((cat) => {
                const isActive = selectedCategoryId === cat.id;
                let icon = '☕';
                if (cat.id.includes('blend')) icon = '🔥';
                else if (cat.id.includes('single')) icon = '🌍';
                else if (cat.id.includes('tea') || cat.id.includes('karak')) icon = '🫖';
                else if (cat.id.includes('iced') || cat.id.includes('cold')) icon = '🧊';
                else if (cat.id.includes('pastry')) icon = '🍰';
                else if (cat.id.includes('gear')) icon = '⚙️';

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      playPosBeep('click');
                      setSelectedCategoryId(cat.id);
                    }}
                    className={`font-bold text-xs whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer px-3.5 py-2 rounded-xl border ${
                      isActive
                        ? 'bg-[#D71921] border-[#D71921] text-white shadow-[0_0_20px_-3px_rgba(215,25,33,0.45)]'
                        : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white hover:border-[#9EACB8]'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{cat.nameFa}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#9EACB8] border-[#293444]/70 pb-3 mb-2 border-b">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                <span className="text-[11px] font-bold text-white shrink-0">فیلتر رست:</span>
                <button
                  onClick={() => {
                    playPosBeep('click');
                    setRoastFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                    roastFilter === 'all'
                      ? 'bg-[#0F223D] border-[#D71921] text-white'
                      : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white'
                  }`}
                >
                  همه
                </button>
                <button
                  onClick={() => {
                    playPosBeep('click');
                    setRoastFilter('medium');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                    roastFilter === 'medium'
                      ? 'bg-[#0F223D] border-[#D71921] text-white'
                      : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white'
                  }`}
                >
                  مدیوم رست (متعادل)
                </button>
                <button
                  onClick={() => {
                    playPosBeep('click');
                    setRoastFilter('dark');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                    roastFilter === 'dark'
                      ? 'bg-[#0F223D] border-[#D71921] text-white'
                      : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white'
                  }`}
                >
                  مدیوم دارک / اسپرسو
                </button>
                <button
                  onClick={() => {
                    playPosBeep('click');
                    setRoastFilter('light');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                    roastFilter === 'light'
                      ? 'bg-[#0F223D] border-[#D71921] text-white'
                      : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white'
                  }`}
                >
                  لایت / دمی تخصصی
                </button>

                {stockAlertStats.totalLowStock > 0 && (
                  <button
                    onClick={() => {
                      playPosBeep('click');
                      setStockFilter(stockFilter === 'ALL' ? 'ALERTS_ONLY' : 'ALL');
                    }}
                    className={`px-3 py-1 rounded-full border text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      stockFilter === 'ALERTS_ONLY'
                        ? 'bg-rose-950/70 border-rose-500/70 text-rose-200'
                        : 'liquid-glass-pill text-rose-300'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{stockAlertStats.totalLowStock} کسری موجودی</span>
                  </button>
                )}
              </div>

              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی دان، ۵۰/۵۰، کرک تی، نوشیدنی..."
                  className="w-full text-white text-xs pr-9 pl-3 py-2 focus:outline-none transition-colors bg-[#121417] border border-[#293444] focus:border-[#D71921] rounded-lg placeholder:text-[#9EACB8]/60"
                />
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-2.5 pointer-events-none" />
              </div>

              <div className="hidden sm:block text-[11px] shrink-0 tabular-nums">
                <span className="font-bold text-white num-heavy">{filteredItems.length}</span> محصول
              </div>
            </div>
          </>
        )}

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3.5 md:gap-4 flex-1 items-start">
          {filteredItems.length === 0 ? (
            <div
              className={`col-span-full py-16 text-center text-[#94A3B8] ${
                isModendo
                  ? 'liquid-glass-shell rounded-[24px]'
                  : 'bg-[#1B222C]/50 border border-white/[0.08] rounded-2xl'
              }`}
            >
              <Coffee className="w-10 h-10 mx-auto text-[#94A3B8] mb-2 opacity-50" />
              <p className="font-bold text-white text-sm">هیچ محصولی با این فیلتر یافت نشد</p>
              <p className="text-xs mt-1">
                {isModendo
                  ? 'نام دیگری مانند «پلی‌استیشن»، «برگر»، «پیتزا»، «لاته» یا دسته‌بندی دیگری را انتخاب کنید.'
                  : 'نام دیگری مانند «۵۰/۵۰»، «کرک»، «اتیوپی» یا کاتگوری دیگری را انتخاب نمایید.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const stockStatus = evaluateStockStatus(
                item.currentStock,
                item.lowStockThreshold,
                globalThreshold
              );
              const isOutOfStock = stockStatus.isOutOfStock;
              const isLow = stockStatus.isLowStock && !isOutOfStock;

              const isSpecial =
                isModendo &&
                (item.categoryId?.includes('dessert') ||
                  item.nameFa.includes('چیزکیک') ||
                  item.nameFa.includes('کیک') ||
                  item.badge === 'محبوب' ||
                  item.badge === 'فروش ویژه');

              return (
                <article
                  key={item.id}
                  onClick={() => !isOutOfStock && handleAddItem(item)}
                  className={`${
                    isModendo
                      ? isSpecial
                        ? 'modendo-product-card-special rounded-[24px]'
                        : 'modendo-product-card rounded-[24px]'
                      : 'bg-[#1B222C] border border-[#293444] hover:border-[#9EACB8]/60 rounded-xl shadow-lg'
                  } overflow-hidden transition-all duration-200 flex flex-col justify-between group relative ${
                    isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {/* Photo Wallpaper Backdrop for Modendo */}
                  {isModendo && (
                    <>
                      <img
                        src={getProductWallpaper(item)}
                        alt={item.nameFa}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-35 filter blur-[0.4px] scale-105 group-hover:scale-110 transition-transform duration-500 pointer-events-none"
                      />
                      <div
                        className={`absolute inset-0 pointer-events-none ${
                          isSpecial
                            ? 'bg-gradient-to-t from-[#1F070B]/95 via-[#1F070B]/75 to-[#1F070B]/45'
                            : 'bg-gradient-to-t from-[#061813]/95 via-[#061813]/75 to-[#061813]/45'
                        }`}
                      />
                    </>
                  )}

                  {/* Card Header & Specs */}
                  <div className="p-4 pb-3 flex-1 flex flex-col justify-between relative z-10">
                    {isModendo ? (
                      <div className="flex items-center justify-between gap-1.5 mb-2 text-[10px]">
                        {/* Right Badge (Special/Popular/Fresh) */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black tracking-wide text-white shadow-sm ${
                            isSpecial
                              ? 'bg-rose-600/85 border border-rose-400/60'
                              : 'bg-emerald-600/30 border border-emerald-400/40 text-emerald-300'
                          }`}
                        >
                          {item.badge || (item.nameFa.includes('چیزکیک') ? 'محبوب' : item.nameFa.includes('کیک') ? 'فروش ویژه' : 'تازه')}
                        </span>

                        {/* Left Badge (Bean/Roast or 50/50 or Shortcut key) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold">
                            {item.roastLevelText || (item.isBean ? '100% Arabica' : '۵۰/۵۰')}
                          </span>
                          {idx < 9 && (
                            <span className="font-mono tabular-nums text-white/40 text-[10px] hidden sm:inline">
                              کلید {idx + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.roastLevelText ? (
                            <span className="text-[10px] font-mono tracking-wider font-bold px-2 py-0.5 rounded border bg-[#0F223D] border-[#293444] text-[#F3E9DD]">
                              {item.roastLevelText}
                            </span>
                          ) : null}

                          {item.badge ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider bg-[#D71921] text-white">
                              {item.badge}
                            </span>
                          ) : item.weight ? (
                            <span className="text-[10px] text-[#94A3B8] font-bold">
                              {item.weight}
                            </span>
                          ) : null}
                        </div>

                        {idx < 9 && (
                          <span className="text-[10px] font-mono tabular-nums bg-[#121417] text-[#94A3B8] px-1.5 py-0.5 rounded border border-white/[0.08]">
                            کلید {idx + 1}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Stock Alert Notice if low */}
                    {isOutOfStock ? (
                      <div className="mb-1.5 text-rose-300 text-[11px] font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>ناموجود</span>
                      </div>
                    ) : isLow ? (
                      <div className="mb-1.5 text-amber-300 text-[11px] font-bold flex items-center gap-1 tabular-nums">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>باقیمانده: {item.currentStock}</span>
                      </div>
                    ) : null}

                    {/* Product Titles */}
                    <h3
                      className={`font-extrabold text-sm md:text-[15px] text-white transition-colors leading-snug ${
                        isModendo ? 'text-center my-auto py-1.5' : 'group-hover:text-[#F3E9DD]'
                      }`}
                    >
                      {item.nameFa}
                    </h3>
                    {isModendo ? (
                      <div className="text-center font-bold text-xs text-emerald-300/90 num-heavy tabular-nums mt-1">
                        قیمت نهایی: {formatToman(item.priceToman)} تومان
                      </div>
                    ) : (
                      item.nameEn && (
                        <p className="text-[11px] font-display-latin text-[#94A3B8] mt-0.5 truncate tracking-tight">
                          {item.nameEn}
                        </p>
                      )
                    )}

                    {/* Technical Roast Specs Grid (100Hich only or beans) */}
                    {!isModendo && (item.origin || item.process) && (
                      <div className="mt-2.5 pt-2 border-t border-white/[0.07] text-[11px] space-y-1">
                        {item.origin && (
                          <div className="flex items-center justify-between text-[#94A3B8]">
                            <span>خاستگاه:</span>
                            <span className="text-white font-medium text-right max-w-[170px] truncate">
                              {item.origin}
                            </span>
                          </div>
                        )}
                        {item.process && item.process !== '-' && (
                          <div className="flex items-center justify-between text-[#94A3B8]">
                            <span>فرآوری:</span>
                            <span className="text-[#F3E9DD] font-mono text-[10px]">
                              {item.process}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Taste Notes Inline */}
                    {item.notes && item.notes.length > 0 && (
                      isModendo ? (
                        <p className="text-[11px] text-[#94A3B8]/90 mt-1.5 text-center truncate">
                          {item.notes.slice(0, 2).join(' · ')}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {item.notes.slice(0, 3).map((note, nIdx) => (
                            <span
                              key={nIdx}
                              className="text-[9.5px] bg-[#121417] text-[#94A3B8] px-1.5 py-0.5 rounded border border-white/[0.08] leading-tight"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      )
                    )}
                  </div>

                  {/* Card Bottom Bar: Price & Action CTA */}
                  <div
                    className={`px-3.5 py-2.5 border-t flex items-center justify-between gap-2 mt-auto overflow-hidden relative z-10 ${
                      isModendo
                        ? 'bg-black/25 border-white/[0.08]'
                        : 'bg-[#121417]/85 border-[#293444] rounded-b-xl'
                    }`}
                  >
                    {isModendo ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleOpenModifierModal(e, item)}
                          title="تنظیم آپشن / مودیفایر"
                          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddItem(item);
                          }}
                          disabled={isOutOfStock}
                          title="افزودن به سفارش"
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition cursor-pointer font-bold active:scale-95 shadow-sm shrink-0 ${
                            isSpecial
                              ? 'border-rose-400 bg-rose-500/25 text-rose-200 hover:bg-rose-500/40 hover:scale-105'
                              : 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 hover:scale-105'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1">
                            <span className="text-[15px] font-black text-white num-heavy tabular-nums tracking-tight">
                              {formatToman(item.priceToman)}
                            </span>
                            <span className="text-[10px] text-[#94A3B8] shrink-0">تومان</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleOpenModifierModal(e, item)}
                            title={item.isBean ? 'تنظیم درجه آسیاب' : 'تنظیم آپشن / مودیفایر'}
                            className="bg-[#0F223D] hover:bg-[#222B38] border border-[#293444] rounded-lg text-[#F3E9DD] h-7 px-2.5 gap-1 font-bold flex items-center justify-center transition cursor-pointer text-xs shrink-0 active:scale-95"
                          >
                            <Sliders className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] font-semibold">
                              {item.isBean ? 'آسیاب' : 'آپشن'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddItem(item);
                            }}
                            disabled={isOutOfStock}
                            title="افزودن به سفارش"
                            className="active:scale-95 disabled:bg-stone-700 h-7 px-3 flex items-center justify-center gap-1 transition cursor-pointer text-xs shrink-0 bg-[#D71921] hover:bg-[#B8141B] text-white font-bold rounded-lg shadow-md shadow-[#D71921]/30"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-xs font-black">افزودن</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* ================= RIGHT / SIDEBAR: ORDER & POS CART ================= */}
      <aside
        id="pos-cart-panel"
        className={`hidden xl:flex flex-col w-[420px] sticky top-3 max-h-[calc(100vh-5rem)] h-[calc(100vh-5rem)] transition-all overflow-hidden ${
          isModendo
            ? 'modendo-cart-shell rounded-[28px]'
            : 'bg-[#1B222C] border border-[#293444] rounded-xl shadow-2xl'
        }`}
      >
        {/* Cart Header & Order Type Toggle */}
        <div
          className={`p-4 border-b flex flex-col gap-3 ${
            isModendo
              ? 'border-white/[0.08] bg-black/20'
              : 'border-[#293444] bg-[#0F223D] rounded-t-xl'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono tabular-nums text-xs font-bold text-white/80">
              #{isModendo ? '10BM' : '100H'}-{activeShift ? activeShift.id.slice(-4) : '1488'}
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-bold text-cyan-300 shadow-sm">
              <span>🪑 تب‌ها: {cartItems.length > 0 ? '۱' : '۰'}</span>
            </div>
          </div>

          {/* Dine-in vs Takeaway Toggle */}
          <div
            className={`grid grid-cols-2 gap-2 text-xs font-bold p-1 ${
              isModendo
                ? 'rounded-full bg-black/40 border border-white/[0.08]'
                : 'bg-[#121417]/90 rounded-lg border border-white/[0.08]'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setOrderType('TAKEAWAY');
              }}
              className={`py-2 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === 'TAKEAWAY'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                  : 'bg-[#381116] border border-red-900/50 text-[#FCA5A5] hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Takeout</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setOrderType('DINE_IN');
              }}
              className={`py-2 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === 'DINE_IN'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                  : 'bg-[#381116] border border-red-900/50 text-[#FCA5A5] hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Table 🪑</span>
            </button>
          </div>
        </div>

        {/* Customer Detail & Invoice Notes */}
        <div className="px-4 py-2.5 border-b border-white/[0.08] bg-black/15 space-y-2 text-xs">
          <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-1.5">
            <span className="text-white/40">👤</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={orderType === 'DINE_IN' ? 'نام مشتری / مهمان سالن...' : 'نام مشتری بیرون‌بر...'}
              className="bg-transparent text-white placeholder:text-[#94A3B8]/60 text-xs w-full focus:outline-none"
            />
            {orderType === 'DINE_IN' && (
              <select
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                className="text-[11px] text-emerald-300 font-bold bg-[#0A1F18] border border-emerald-500/40 rounded-lg px-2 py-0.5 focus:outline-none"
              >
                {Array.from(
                  new Set([
                    ...(boundTable ? [boundTable.label] : []),
                    ...(isModendo
                      ? MODENDO_FLOOR_NODES.map((n) => n.label)
                      : ['میز ۱', 'میز ۲', 'میز ۳', 'میز ۴', 'میز ۵', 'میز ۶', 'میز ۷', 'کانتر بار']),
                  ])
                ).map((tbl) => (
                  <option key={tbl} value={tbl} className="bg-[#12161d] text-white">
                    {tbl}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-1.5">
            <span className="text-white/40">📞</span>
            <input
              type="text"
              placeholder="شماره تماس..."
              className="bg-transparent text-white placeholder:text-[#94A3B8]/60 text-xs w-full focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-1.5">
            <span className="text-white/40">📝</span>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="یادداشت فاکتور (توضیحات کل سفارش)..."
              className="bg-transparent text-white placeholder:text-[#94A3B8]/50 text-xs w-full focus:outline-none"
            />
          </div>
        </div>

        {/* Cart Items List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-2.5">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#94A3B8]">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                  isModendo ? 'liquid-glass-well' : 'bg-[#121417] border border-white/[0.08]'
                }`}
              >
                <Coffee
                  className={`w-7 h-7 opacity-85 ${
                    isModendo ? 'text-[#10B981]' : 'text-[#D71921]'
                  }`}
                />
              </div>
              <p className="text-sm font-bold text-white mb-1">فاکتور هنوز خالی است</p>
              <p className="text-xs text-[#94A3B8] max-w-xs leading-relaxed">
                {isModendo
                  ? 'آیتمی از منوی کافه مودندو یا سشن‌های بازی را لمس کنید تا به سبد اضافه شود.'
                  : 'آیتمی از منوی بلندها، بار گرم یا دانه‌های تخصصی صد هیچ را لمس کنید تا به سبد اضافه شود.'}
              </p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 flex flex-col gap-2 transition animate-ticket-item-spring ${
                  isModendo
                    ? 'rounded-2xl bg-black/35 border border-red-500/15'
                    : 'bg-[#121417] border border-white/[0.08] rounded-lg hover:border-white/[0.16]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {item.itemNameSnapshot}
                    </h4>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-emerald-300/80">
                        {item.modifiers.map((m, mIdx) => (
                          <span key={mIdx} className="font-medium">
                            {m.nameFa}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-amber-300 italic mt-0.5">*{item.notes}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-[#94A3B8] hover:text-rose-400 p-1 cursor-pointer transition"
                    title="حذف آیتم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.07]">
                  <div
                    className={`flex items-center overflow-hidden ${
                      isModendo
                        ? 'rounded-full bg-[#3B1218] border border-red-900/60 p-0.5'
                        : 'bg-[#1B222C] border border-white/[0.08] rounded-md'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className={`w-6 h-6 flex items-center justify-center font-black text-sm cursor-pointer transition ${
                        isModendo
                          ? 'rounded-full text-red-200 hover:text-white active:bg-red-800'
                          : 'text-[#94A3B8] hover:text-white active:bg-[#D71921]'
                      }`}
                    >
                      -
                    </button>
                    <span className="w-7 text-center font-bold text-xs text-white num-heavy tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className={`w-6 h-6 flex items-center justify-center font-black text-sm cursor-pointer transition ${
                        isModendo
                          ? 'rounded-full text-red-200 hover:text-white active:bg-red-800'
                          : 'text-[#94A3B8] hover:text-white active:bg-[#D71921]'
                      }`}
                    >
                      +
                    </button>
                  </div>

                  <div className="text-left">
                    <span className="text-xs font-black text-emerald-300 num-heavy tabular-nums">
                      {formatToman(item.subtotalToman)}
                    </span>
                    <span className="text-[9px] text-[#94A3B8] mr-1">تومان</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount & POS Keypad Accelerators */}
        <div className="px-4 pt-2.5 pb-2 border-t border-white/[0.08] bg-black/15">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mb-2">
            <span className="flex items-center gap-1.5">
              <span>تخفیف سریع فاکتور</span>
              {!canEditFinancials && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-300 font-bold">
                  <Lock className="w-2.5 h-2.5" />
                  <span>قفل مدیر</span>
                </span>
              )}
            </span>
            <span className="text-[#F3E9DD] font-bold">
              {discountPercent > 0 ? `${discountPercent}٪ تخفیف فعال` : 'بدون تخفیف'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleApplyDiscountPercent(0)}
              className={`py-1.5 text-[11px] cursor-pointer transition rounded-full ${
                discountPercent === 0
                  ? 'bg-[#991B1B] text-white border border-[#DC2626] shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                  : 'bg-[#1B222C] border-white/[0.08] text-[#94A3B8] hover:text-white'
              }`}
            >
              ۰٪
            </button>
            <button
              type="button"
              disabled={!canEditFinancials}
              onClick={() => handleApplyDiscountPercent(5)}
              title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
              className={`py-1.5 text-[11px] transition rounded-full ${
                !canEditFinancials
                  ? 'opacity-40 cursor-not-allowed text-[#94A3B8]'
                  : discountPercent === 5
                  ? 'bg-[#991B1B] text-white border border-[#DC2626] shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                  : 'bg-[#1B222C] border-white/[0.08] text-[#94A3B8] hover:text-white cursor-pointer'
              }`}
            >
              ۵٪ ویژه
            </button>
            <button
              type="button"
              disabled={!canEditFinancials}
              onClick={() => handleApplyDiscountPercent(10)}
              title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
              className={`py-1.5 text-[11px] transition rounded-full ${
                !canEditFinancials
                  ? 'opacity-40 cursor-not-allowed text-[#94A3B8]'
                  : discountPercent === 10
                  ? 'bg-[#991B1B] text-white border border-[#DC2626] shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                  : 'bg-[#1B222C] border-white/[0.08] text-[#94A3B8] hover:text-white cursor-pointer'
              }`}
            >
              ۱۰٪ باریستا
            </button>
            <button
              type="button"
              disabled={!canEditFinancials}
              onClick={() => handleApplyDiscountPercent(15)}
              title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
              className={`py-1.5 text-[11px] transition rounded-full ${
                !canEditFinancials
                  ? 'opacity-40 cursor-not-allowed text-[#94A3B8]'
                  : discountPercent === 15
                  ? 'bg-[#991B1B] text-white border border-[#DC2626] shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                  : 'bg-[#1B222C] border-white/[0.08] text-[#94A3B8] hover:text-white cursor-pointer'
              }`}
            >
              ۱۵٪ همکار
            </button>
          </div>
        </div>

        {/* Calculations & Total Summary */}
        <div
          className={`p-4 border-t border-white/[0.08] space-y-2 ${
            isModendo ? 'bg-black/25' : 'bg-[#121417] rounded-b-xl'
          }`}
        >
          <div className="flex justify-between items-center text-xs text-[#94A3B8]">
            <span>جمع اقلام:</span>
            <span className="font-bold text-white num-heavy tabular-nums">
              {formatToman(grossAmountToman)} تومان
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-[#94A3B8]">
            <span>کسر تخفیف:</span>
            <span className="text-[#F3E9DD] num-heavy tabular-nums">
              {discountAmountToman > 0
                ? `-${formatToman(discountAmountToman)} تومان`
                : '۰ تومان'}
            </span>
          </div>

          <div className="h-[1px] bg-white/[0.08] my-1"></div>

          <div className="flex justify-between items-baseline">
            <span className="text-sm font-extrabold text-white">مبلغ نهایی فاکتور:</span>
            <div className="text-right">
              <span
                className={`text-xl font-black num-heavy tabular-nums tracking-tight ${
                  isModendo ? 'text-emerald-300' : 'text-[#D71921]'
                }`}
              >
                {formatToman(netTotalToman)}
              </span>
              <span className="text-xs text-[#94A3B8] mr-1">تومان</span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="space-y-2 pt-2">
            {isModendo && orderType === 'DINE_IN' && (
              <button
                type="button"
                onClick={handleSaveAsOpenTable}
                className="w-full py-2.5 px-4 rounded-2xl liquid-glass-pill border border-emerald-400/40 hover:border-emerald-400/80 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] shadow-sm"
              >
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>ثبت روی میز باز (شروع زمان)</span>
              </button>
            )}

            <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={handleClearCart}
                title="پاک کردن سبد"
                className={`col-span-1 text-[#94A3B8] hover:text-rose-400 flex items-center justify-center transition cursor-pointer ${
                  isModendo
                    ? 'liquid-glass-pill rounded-2xl'
                    : 'bg-[#1B222C] hover:bg-[#222B38] border border-white/[0.08] rounded-lg'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={cartItems.length === 0}
                className={`col-span-4 py-3.5 px-4 flex items-center justify-center gap-2 transition transform active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  isModendo
                    ? 'rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#991B1B] text-white font-black text-sm shadow-[0_4px_25px_rgba(220,38,38,0.5)] border border-red-500/40 hover:brightness-110'
                    : 'bg-[#D71921] hover:bg-[#B8141B] disabled:bg-stone-700 text-white font-black rounded-lg shadow-[0_0_20px_-3px_rgba(215,25,33,0.45)]'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>ثبت سفارش و پرداخت</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE FLOATING CART BAR ================= */}
      <div className="xl:hidden fixed bottom-4 left-4 right-4 z-40">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className={`w-full p-3.5 flex items-center justify-between font-black cursor-pointer ${
            isModendo
              ? 'liquid-glass-cta rounded-full shadow-2xl'
              : 'bg-[#D71921] hover:bg-[#B8141B] text-white rounded-xl shadow-[0_0_25px_rgba(215,25,33,0.6)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <span className="tabular-nums">مشاهده سبد فاکتور ({totalCartCount} آیتم)</span>
          </div>
          <div className="font-mono num-heavy tabular-nums text-base">
            {formatToman(netTotalToman)} تومان
          </div>
        </button>
      </div>

      {/* ================= MOBILE CART DRAWER ================= */}
      {isMobileCartOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileCartOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex flex-col justify-end xl:hidden"
        >
          <div
            className={`max-h-[85vh] flex flex-col p-5 animate-spatial-modal ${
              isModendo
                ? 'liquid-glass-modal rounded-t-[28px]'
                : 'bg-[#1B222C] border-t border-white/[0.08] rounded-t-2xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-extrabold text-white">
                {isModendo ? 'سبد سفارش مودندو' : 'سبد سفارش صد هیچ'}
              </h3>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="text-[#94A3B8] hover:text-white p-1.5 rounded-full hover:bg-white/[0.08] cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 flex items-center justify-between ${
                    isModendo
                      ? 'liquid-glass-well rounded-2xl'
                      : 'bg-[#121417] rounded-lg border border-white/[0.08]'
                  }`}
                >
                  <div>
                    <h5 className="font-bold text-xs text-white">{item.itemNameSnapshot}</h5>
                    <span className="text-[10px] text-[#F3E9DD] tabular-nums">
                      {item.quantity} × {formatToman(item.unitPriceSnapshotToman)} ت
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-7 h-7 liquid-glass-pill text-white rounded-full flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs font-mono tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-7 h-7 liquid-glass-pill text-white rounded-full flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-[#94A3B8]">مبلغ کل قابل پرداخت:</span>
                <div>
                  <span
                    className={`text-lg font-black num-heavy tabular-nums ${
                      isModendo ? 'text-emerald-300' : 'text-[#D71921]'
                    }`}
                  >
                    {formatToman(netTotalToman)}
                  </span>
                  <span className="text-xs text-[#94A3B8] mr-1">تومان</span>
                </div>
              </div>
              {isModendo && orderType === 'DINE_IN' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    handleSaveAsOpenTable();
                  }}
                  className="w-full py-2.5 rounded-2xl liquid-glass-pill border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>ثبت روی میز باز (شروع زمان)</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleStartCheckout();
                }}
                className={`w-full py-3 font-black cursor-pointer ${
                  isModendo
                    ? 'liquid-glass-cta rounded-2xl'
                    : 'bg-[#D71921] text-white rounded-lg shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                }`}
              >
                ثبت نهایی سفارش و پرداخت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODIFIER MODAL ================= */}
      <ModifierModal
        item={modifierItem}
        isOpen={isModifierOpen}
        isModendo={isModendo}
        onClose={() => setIsModifierOpen(false)}
        onConfirm={handleAddWithModifiers}
      />

      {/* ================= PAYMENT & CHECKOUT MODAL ================= */}
      {isCheckoutOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCheckoutOpen(false);
              setPaymentError(null);
            }
          }}
          className="fixed inset-0 bg-black/75 backdrop-blur-xl z-50 flex items-center justify-center p-3"
        >
          <div
            role="dialog"
            aria-modal="true"
            className={`max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-right animate-spatial-modal ${
              isModendo
                ? 'liquid-glass-modal rounded-[28px]'
                : 'bg-[#1B222C] border border-white/[0.08] rounded-2xl shadow-2xl'
            }`}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <h3 className="text-base font-extrabold text-white">
                روش تسویه حساب بار
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setPaymentError(null);
                }}
                className="text-[#94A3B8] hover:text-white p-1.5 rounded-full hover:bg-white/[0.08] cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Payment Methods Body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-3.5">
              <label className="text-xs text-[#94A3B8] block">
                دستگاه پوز یا روش پرداخت را انتخاب کنید:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('CARD_MANUAL');
                    setTerminalName('پوز ۱ (بانک سامان)');
                  }}
                  className={`p-3.5 text-right text-xs transition cursor-pointer ${
                    isModendo ? 'rounded-2xl' : 'rounded-xl border'
                  } ${
                    paymentMethod === 'CARD_MANUAL' && terminalName === 'پوز ۱ (بانک سامان)'
                      ? isModendo
                        ? 'liquid-glass-card-active font-bold'
                        : 'border-2 border-[#D71921] bg-[#0F223D] font-bold shadow-sm'
                      : isModendo
                      ? 'liquid-glass-card text-[#94A3B8] hover:text-white'
                      : 'border-white/[0.08] bg-[#121417] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span className="text-white block mb-0.5 font-bold">پوز ۱ (بانک سامان)</span>
                  <span className="text-[10px] text-emerald-300 font-mono">متصل به بار اصلی</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('CARD_MANUAL');
                    setTerminalName('پوز ۲ (بانک ملت)');
                  }}
                  className={`p-3.5 text-right text-xs transition cursor-pointer ${
                    isModendo ? 'rounded-2xl' : 'rounded-xl border'
                  } ${
                    paymentMethod === 'CARD_MANUAL' && terminalName === 'پوز ۲ (بانک ملت)'
                      ? isModendo
                        ? 'liquid-glass-card-active font-bold'
                        : 'border-2 border-[#D71921] bg-[#0F223D] font-bold shadow-sm'
                      : isModendo
                      ? 'liquid-glass-card text-[#94A3B8] hover:text-white'
                      : 'border-white/[0.08] bg-[#121417] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span className="text-white block mb-0.5 font-bold">پوز ۲ (بانک ملت)</span>
                  <span className="text-[10px] text-[#94A3B8] font-mono">پوز سیار سالن</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('CASH');
                    setTerminalName('کش دراور نقدی');
                  }}
                  className={`p-3.5 text-right text-xs transition cursor-pointer ${
                    isModendo ? 'rounded-2xl' : 'rounded-xl border'
                  } ${
                    paymentMethod === 'CASH'
                      ? isModendo
                        ? 'liquid-glass-card-active font-bold'
                        : 'border-2 border-[#D71921] bg-[#0F223D] font-bold shadow-sm'
                      : isModendo
                      ? 'liquid-glass-card text-[#94A3B8] hover:text-white'
                      : 'border-white/[0.08] bg-[#121417] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span className="text-white block mb-0.5 font-bold">نقدی / کش دراور</span>
                  <span className="text-[10px] text-[#94A3B8]">دریافت وجه نقد اسکناس</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setPaymentMethod('CARD_MANUAL');
                    setTerminalName('کارت به کارت');
                  }}
                  className={`p-3.5 text-right text-xs transition cursor-pointer ${
                    isModendo ? 'rounded-2xl' : 'rounded-xl border'
                  } ${
                    paymentMethod === 'CARD_MANUAL' && terminalName === 'کارت به کارت'
                      ? isModendo
                        ? 'liquid-glass-card-active font-bold'
                        : 'border-2 border-[#D71921] bg-[#0F223D] font-bold shadow-sm'
                      : isModendo
                      ? 'liquid-glass-card text-[#94A3B8] hover:text-white'
                      : 'border-white/[0.08] bg-[#121417] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span className="text-white block mb-0.5 font-bold">کارت به کارت</span>
                  <span className="text-[10px] text-[#94A3B8]">تایید فیش همراه مشتری</span>
                </button>
              </div>

              {/* Cash Tendered & Iranian Banknote Chips (If Cash) */}
              {paymentMethod === 'CASH' && (
                <div className="liquid-glass-well p-4 rounded-2xl space-y-2.5 mt-2">
                  <label className="text-xs text-[#94A3B8] block">
                    مبلغ وجه نقد دریافتی از مشتری (تومان):
                  </label>
                  <input
                    type="number"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(safeInt(e.target.value))}
                    className={`w-full liquid-glass-well rounded-xl p-2.5 text-white font-bold text-center text-sm tabular-nums focus:outline-none ${
                      isModendo ? 'focus:border-[#10B981]' : 'focus:border-[#D71921]'
                    }`}
                  />

                  {/* Iranian Banknotes Suggestion Chips */}
                  <div>
                    <span className="text-[11px] text-[#94A3B8] block mb-1.5">
                      پیشنهاد اسکناس‌های رایج تومانی:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setCashTendered(netTotalToman);
                        }}
                        className="px-2.5 py-1 rounded-full liquid-glass-pill text-[#F3E9DD] text-[11px] font-semibold tabular-nums cursor-pointer"
                      >
                        دقیقاً {formatToman(netTotalToman)}
                      </button>
                      {IRANIAN_BANKNOTES_TOMAN.map((note) => (
                        <button
                          key={note}
                          type="button"
                          onClick={() => {
                            playPosBeep('click');
                            setCashTendered(note);
                          }}
                          className="px-2.5 py-1 rounded-full liquid-glass-pill text-white text-[11px] font-mono tabular-nums cursor-pointer"
                        >
                          {formatToman(note)} ت
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-white/[0.08] text-xs">
                    <span className="text-[#94A3B8]">باقیمانده پرداختی به مشتری:</span>
                    <span
                      className={`font-bold num-heavy tabular-nums ${
                        cashTendered >= netTotalToman ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {cashTendered >= netTotalToman
                        ? `${formatToman(cashTendered - netTotalToman)} تومان`
                        : 'مبلغ کمتر از فاکتور است'}
                    </span>
                  </div>
                </div>
              )}

              {/* Card Terminal Reference / Trace ID */}
              {paymentMethod !== 'CASH' && (
                <div className="liquid-glass-well p-3 rounded-2xl text-xs flex justify-between items-center">
                  <span className="text-[#94A3B8]">شناسه پیگیری فیش کارتخوان (اختیاری):</span>
                  <input
                    type="text"
                    placeholder="مثلاً: ۷۴۸۲۹۱"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    className="bg-transparent text-white font-mono font-bold text-left focus:outline-none placeholder:text-[#94A3B8]/40"
                  />
                </div>
              )}

              {/* Total Summary */}
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">مبلغ کل قابل تسویه:</span>
                <span
                  className={`font-black text-base num-heavy tabular-nums ${
                    isModendo ? 'text-emerald-300' : 'text-[#D71921]'
                  }`}
                >
                  {formatToman(netTotalToman)} تومان
                </span>
              </div>

              {/* P0-2: loud persistence failure — no receipt, no success */}
              {paymentError && (
                <div className="mt-3 bg-rose-950/75 border border-rose-500/40 rounded-2xl p-3.5 text-xs text-rose-100 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-extrabold text-rose-200">
                      فاکتور و پرداخت ذخیره نشد — وجهی دریافت نکنید.
                    </p>
                    <p className="mt-1 leading-5 text-rose-200/90">{paymentError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        setPaymentError(null);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-full bg-rose-900/70 hover:bg-rose-800 border border-rose-600/50 text-rose-100 font-bold cursor-pointer"
                    >
                      تلاش مجدد (پس از رفع مشکل حافظه)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="shrink-0 px-6 py-4 border-t border-white/[0.08] bg-black/25 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    setPaymentError(null);
                  }}
                  className="w-1/3 liquid-glass-pill text-[#94A3B8] hover:text-white py-3 rounded-2xl font-bold text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmPayment(false)}
                  disabled={isPaymentBlocked}
                  className={`w-2/3 py-3 rounded-2xl font-bold text-xs ${
                    isPaymentBlocked
                      ? 'liquid-glass-well text-[#526071] cursor-not-allowed opacity-60'
                      : 'liquid-glass-pill text-white cursor-pointer'
                  }`}
                >
                  {isSettling ? 'در حال ثبت فاکتور…' : 'ثبت پرداخت و مشاهده فیش'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleConfirmPayment(true)}
                disabled={isPaymentBlocked}
                className={`w-full py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition ${
                  isPaymentBlocked
                    ? 'bg-stone-800 text-[#94A3B8] cursor-not-allowed opacity-60'
                    : isModendo
                    ? 'liquid-glass-cta cursor-pointer'
                    : 'bg-[#D71921] hover:bg-[#B8141B] text-white shadow-[0_0_20px_-3px_rgba(215,25,33,0.45)] cursor-pointer active:scale-95'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>تایید تراکنش و چاپ فیش حرارتی (۸۰ میلی‌متری)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= COMPLETED RECEIPT PREVIEW MODAL ================= */}
      {completedReceiptOrder && (
        <div className="relative">
          {/* Hardware Direct Thermal Print Bar (WebUSB & Bluetooth) */}
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] p-3 flex flex-wrap items-center justify-between gap-3 text-xs w-full max-w-xl animate-spatial-modal ${
              isModendo
                ? 'liquid-glass-shell rounded-2xl'
                : 'bg-[#0F223D] border border-[#D71921]/60 rounded-2xl shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-2 text-white">
              <Printer className="w-4 h-4 text-[#F3E9DD]" />
              <span className="font-bold">چاپ مستقیم حرارتی ۸۰ میلی‌متری (ESC/POS Raster):</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleHardwarePrint('USB')}
                className="px-3 py-1.5 rounded-full liquid-glass-pill text-white font-medium flex items-center gap-1.5 cursor-pointer"
                title="اتصال مستقیم بدون درایور از طریق WebUSB"
              >
                <Usb className="w-3.5 h-3.5 text-emerald-300" />
                <span>WebUSB</span>
              </button>

              <button
                onClick={() => handleHardwarePrint('BLUETOOTH')}
                className="px-3 py-1.5 rounded-full liquid-glass-pill text-white font-medium flex items-center gap-1.5 cursor-pointer"
                title="اتصال مستقیم بدون درایور از طریق بلوتوث"
              >
                <Bluetooth className="w-3.5 h-3.5 text-sky-300" />
                <span>بلوتوث</span>
              </button>
            </div>

            {hardwarePrintStatus && (
              <div className="w-full text-center text-[11px] text-[#F3E9DD] liquid-glass-well rounded-xl p-1.5">
                {hardwarePrintStatus}
              </div>
            )}
          </div>

          <ReceiptPreview
            order={completedReceiptOrder}
            payment={completedReceiptPayment}
            tenantName={tenant.name}
            tenantPhone={tenant.phone}
            tenantAddress={tenant.address}
            isModendo={isModendo}
            cashTendered={completedCashTendered}
            changeToman={completedChange}
            onClose={() => {
              setCompletedReceiptOrder(null);
              setCompletedReceiptPayment(null);
              setCompletedCashTendered(undefined);
              setCompletedChange(undefined);
              setHardwarePrintStatus(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
