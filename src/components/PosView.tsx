import React, { useState, useEffect } from 'react';
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
  AlertOctagon,
  Sliders,
  Filter,
  Coffee,
  Search,
  Sparkles,
  RefreshCw,
  Wifi,
  WifiOff,
  Bluetooth,
  Usb,
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
} from '../types/domain';
import {
  formatToman,
  calculateOrderTotals,
  safeInt,
  evaluateStockStatus,
  countStockAlerts,
  getEffectiveThreshold,
} from '../services/financialMath';
import { ReceiptPreview } from './ReceiptPreview';
import { ModifierModal } from './ModifierModal';
import { ModifierOption, OrderAggregate, OrderItemAggregate } from '../types/order-domain';
import { globalOfflineSyncQueue, QueueStats } from '../services/offlineSyncQueue';
import { baristaDispatcher } from '../services/baristaDispatcher';
import {
  renderReceiptToCanvas,
  convertCanvasToEscPosRaster,
  printDirectWebUSB,
  printDirectWebBluetooth,
} from '../services/escposThermalPrinter';

// Iranian common banknotes in Toman for rapid cash calculation
const IRANIAN_BANKNOTES_TOMAN = [
  50000,
  100000,
  200000,
  500000,
  1000000,
  2000000,
];

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
}

export const PosView: React.FC<PosViewProps> = ({
  tenant,
  categories,
  menuItems,
  activeShift,
  activeUser,
  onOrderCompleted,
  onOpenShiftRequired,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'ALERTS_ONLY'>('ALL');

  // Configurable default threshold for low stock alert
  const [globalThreshold, setGlobalThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('smartorders_stock_threshold');
      return saved ? Math.max(1, parseInt(saved, 10)) : 5;
    } catch {
      return 5;
    }
  });

  // Current Order / Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [tableLabel, setTableLabel] = useState<string>('میز ۱');
  const [customerName, setCustomerName] = useState<string>('');
  const [discountToman, setDiscountToman] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Modifier sheet modal state
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [isModifierOpen, setIsModifierOpen] = useState<boolean>(false);

  // Offline Sync Queue state
  const [queueStats, setQueueStats] = useState<QueueStats>({ total: 0, pending: 0, failed: 0 });
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD_MANUAL');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [terminalName, setTerminalName] = useState<string>('دستگاه پوز ۱');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [completedReceiptOrder, setCompletedReceiptOrder] = useState<Order | null>(null);
  const [completedReceiptPayment, setCompletedReceiptPayment] = useState<Payment | null>(null);
  const [completedCashTendered, setCompletedCashTendered] = useState<number | undefined>(undefined);
  const [completedChange, setCompletedChange] = useState<number | undefined>(undefined);
  const [hardwarePrintStatus, setHardwarePrintStatus] = useState<string | null>(null);

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

  const handleUpdateGlobalThreshold = (delta: number) => {
    const newVal = Math.max(1, Math.min(100, globalThreshold + delta));
    setGlobalThreshold(newVal);
    try {
      localStorage.setItem('smartorders_stock_threshold', String(newVal));
    } catch (e) {
      console.error('Failed to save threshold to storage:', e);
    }
  };

  const stockAlertStats = countStockAlerts(menuItems, globalThreshold);

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    if (!item.isAvailable) return false;
    const matchesCat = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
    const matchesSearch =
      !searchQuery.trim() ||
      item.nameFa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesCat || !matchesSearch) return false;

    if (stockFilter === 'ALERTS_ONLY') {
      const status = evaluateStockStatus(item.currentStock, item.lowStockThreshold, globalThreshold).status;
      return status === 'LOW' || status === 'OUT_OF_STOCK';
    }
    return true;
  });

  // Hotkeys: 1-9 to add items, P for POS card, C for cash
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
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

  // Cart operations
  const handleAddItem = (item: MenuItem) => {
    if (item.currentStock !== undefined && item.currentStock <= 0) {
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id && (!i.modifiers || i.modifiers.length === 0));
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

  // Add Item with Modifiers (3-Tap Fast Flow)
  const handleAddWithModifiers = (
    item: MenuItem,
    selectedModifiers: ModifierOption[],
    notes: string
  ) => {
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
    setModifierItem(item);
    setIsModifierOpen(true);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0) {
              const matchedItem = menuItems.find((m) => m.id === i.menuItemId);
              if (matchedItem && matchedItem.currentStock !== undefined && newQty > matchedItem.currentStock) {
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
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setDiscountToman(0);
    setDiscountPercent(0);
    setCustomerName('');
  };

  const handleApplyDiscountPercent = (percent: number) => {
    setDiscountPercent(percent);
    const calculatedDiscount = Math.round((grossAmountToman * percent) / 100);
    setDiscountToman(calculatedDiscount);
  };

  // Trigger manual sync
  const handleTriggerManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await globalOfflineSyncQueue.triggerSync();
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Checkout submission
  const handleStartCheckout = () => {
    if (!activeShift) {
      onOpenShiftRequired();
      return;
    }
    if (cartItems.length === 0) return;
    setCashTendered(netTotalToman);
    setIsCheckoutOpen(true);
  };

  const handleConfirmPayment = (autoPrint = false) => {
    if (!activeShift) return;

    const clientGeneratedId = typeof crypto !== 'undefined' && crypto.randomUUID
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

    if (result) {
      // Build Phase 4 OrderAggregate for OfflineSyncQueue and Barista Bar
      const orderAggregateItems: OrderItemAggregate[] = cartItems.map((item) => {
        const mods = item.modifiers ? item.modifiers.map((m) => ({ ...m })) : [];
        const modsDelta = mods.reduce((sum, m) => sum + m.priceDeltaToman, 0);
        return {
          id: item.id,
          menuItemId: item.menuItemId,
          itemNameSnapshot: item.itemNameSnapshot,
          unitPriceSnapshotToman: item.unitPriceSnapshotToman,
          quantity: item.quantity,
          modifiers: mods,
          modifiersDeltaToman: modsDelta * item.quantity,
          subtotalToman: item.subtotalToman,
          notes: item.notes,
        };
      });

      const orderAggregate: OrderAggregate = {
        clientGeneratedId,
        id: result.order.id,
        tenantId: activeShift.tenantId,
        shiftId: activeShift.id,
        orderNumber: result.order.orderNumber,
        orderType,
        state: 'PAID',
        tableLabel: orderType === 'DINE_IN' ? tableLabel : undefined,
        customerName: customerName.trim() || undefined,
        items: orderAggregateItems,
        grossAmountToman,
        grossAmount: grossAmountToman,
        discountAmountToman,
        discountAmount: discountAmountToman,
        netTotalToman,
        totalNet: netTotalToman,
        payments: [
          {
            id: result.payment.id,
            tenantId: activeShift.tenantId,
            orderId: result.order.id,
            clientGeneratedId,
            shiftId: activeShift.id,
            receivedByUserId: activeUser.id,
            receivedByUserName: activeUser.fullName,
            amountToman: netTotalToman,
            paymentMethod,
            referenceCode: referenceCode.trim() || undefined,
            terminalName,
            status: 'SUCCESSFUL',
            createdAt: new Date().toISOString(),
          },
        ],
        paidAmountToman: netTotalToman,
        paidAmount: netTotalToman,
        createdAt: result.order.createdAt,
        updatedAt: result.order.updatedAt,
        createdByUserId: activeUser.id,
        createdByUserName: activeUser.fullName,
      };

      // 1. Enqueue in OfflineSyncQueue (IndexedDB)
      globalOfflineSyncQueue.enqueue(orderAggregate).catch((err) => {
        console.warn('Enqueue into offline database failed:', err);
      });

      // 2. Dispatch to Barista Bar in real time
      baristaDispatcher.dispatchPaidOrder(orderAggregate).catch((err) => {
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
      handleClearCart();
      setReferenceCode('');

      if (autoPrint) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    }
  };

  // Direct Hardware ESC/POS Raster Print Handler (WebUSB / Bluetooth)
  const handleHardwarePrint = async (type: 'USB' | 'BLUETOOTH') => {
    if (!completedReceiptOrder) return;
    setHardwarePrintStatus('در حال اتصال به چاپگر حرارتی...');

    try {
      const orderAggregate: OrderAggregate = {
        clientGeneratedId: completedReceiptOrder.id,
        id: completedReceiptOrder.id,
        tenantId: completedReceiptOrder.tenantId,
        shiftId: completedReceiptOrder.shiftId,
        orderNumber: completedReceiptOrder.orderNumber,
        orderType: completedReceiptOrder.orderType,
        state: 'PAID',
        tableLabel: completedReceiptOrder.tableLabel,
        customerName: completedReceiptOrder.customerName,
        items: completedReceiptOrder.items.map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          itemNameSnapshot: i.itemNameSnapshot,
          unitPriceSnapshotToman: i.unitPriceSnapshotToman,
          quantity: i.quantity,
          modifiers: i.modifiers || [],
          modifiersDeltaToman: 0,
          subtotalToman: i.subtotalToman,
          notes: i.notes,
        })),
        grossAmountToman: completedReceiptOrder.grossAmountToman,
        grossAmount: completedReceiptOrder.grossAmountToman,
        discountAmountToman: completedReceiptOrder.discountAmountToman,
        discountAmount: completedReceiptOrder.discountAmountToman,
        netTotalToman: completedReceiptOrder.netTotalToman,
        totalNet: completedReceiptOrder.netTotalToman,
        payments: completedReceiptPayment ? [{
          id: completedReceiptPayment.id,
          tenantId: completedReceiptPayment.tenantId,
          orderId: completedReceiptPayment.orderId,
          clientGeneratedId: completedReceiptOrder.id,
          shiftId: completedReceiptPayment.shiftId,
          receivedByUserId: completedReceiptPayment.receivedByUserId,
          amountToman: completedReceiptPayment.amountToman,
          paymentMethod: completedReceiptPayment.paymentMethod,
          referenceCode: completedReceiptPayment.referenceCode,
          terminalName: completedReceiptPayment.terminalName,
          status: 'SUCCESSFUL',
          createdAt: completedReceiptPayment.createdAt,
        }] : [],
        paidAmountToman: completedReceiptOrder.netTotalToman,
        paidAmount: completedReceiptOrder.netTotalToman,
        createdAt: completedReceiptOrder.createdAt,
        updatedAt: completedReceiptOrder.updatedAt,
        createdByUserId: completedReceiptOrder.createdByUserId,
        createdByUserName: completedReceiptOrder.createdByUserName,
      };

      const canvas = renderReceiptToCanvas(
        orderAggregate,
        tenant,
        completedCashTendered,
        completedChange
      );

      const rasterBytes = convertCanvasToEscPosRaster(canvas);

      if (type === 'USB') {
        const res = await printDirectWebUSB(rasterBytes);
        setHardwarePrintStatus(res.message);
      } else {
        const res = await printDirectWebBluetooth(rasterBytes);
        setHardwarePrintStatus(res.message);
      }

      setTimeout(() => setHardwarePrintStatus(null), 4000);
    } catch (err: any) {
      setHardwarePrintStatus(`خطا در چاپ سخت‌افزاری: ${err?.message || 'اتصال برقرار نشد'}`);
      setTimeout(() => setHardwarePrintStatus(null), 5000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Shift Warning Banner if Closed */}
      {!activeShift && (
        <div className="mb-4 bg-amber-950/40 border border-amber-800/80 rounded-lg p-3 text-amber-200 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>توجه:</strong> در حال حاضر هیچ شیفت کاری فعالی ثبت نشده است. برای ثبت و تسویه سفارشات، ابتدا یک شیفت جدید باز کنید.
            </span>
          </div>
          <button
            onClick={onOpenShiftRequired}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shadow"
          >
            بازگشایی فوری شیفت
          </button>
        </div>
      )}

      {/* Offline Sync Queue Banner (Shows pending orders in IndexedDB) */}
      {queueStats.pending > 0 && (
        <div className="mb-4 bg-stone-900 border border-amber-600/60 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-stone-200 flex items-center gap-2">
                <span>صف پایگاه داده آفلاین (IndexedDB):</span>
                <span className="bg-amber-500 text-stone-950 font-black px-2 py-0.5 rounded-full text-[11px]">
                  {queueStats.pending} سفارش در انتظار همگام‌سازی
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                فیش‌ها به صورت محلی ذخیره شده‌اند و به محض دسترسی به اینترنت یا کلیک روی همگام‌سازی با لاجیک Idempotent ارسال می‌شوند.
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerManualSync}
            disabled={isManualSyncing}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
            <span>{isManualSyncing ? 'در حال سینک...' : 'همگام‌سازی فوری'}</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side (Menu & Categories) - 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Inventory Alert Banner (Configurable Threshold Warning) */}
          {(stockAlertStats.totalLowStock > 0 || stockFilter === 'ALERTS_ONLY') && (
            <div className="bg-gradient-to-r from-amber-950/40 via-stone-900 to-amber-950/30 border border-amber-600/50 rounded-xl p-3 shadow-md flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <AlertTriangle className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-amber-200">
                      هشدار موجودی انبار ({stockAlertStats.totalLowStock} قلم کالا)
                    </span>
                    {stockAlertStats.outOfStockCount > 0 && (
                      <span className="bg-rose-950/90 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-800">
                        {stockAlertStats.outOfStockCount} ناموجود
                      </span>
                    )}
                    {stockAlertStats.warningCount > 0 && (
                      <span className="bg-amber-950/90 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-600/60">
                        {stockAlertStats.warningCount} زیر آستانه
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-400 mt-0.5">
                    اقلام با موجودی ≤ حد آستانه ({globalThreshold} عدد) دارای هشدار بصری زرد و ناموجودها غیرفعال هستند.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {/* Configurable Threshold Stepper in POS */}
                <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-stone-400">آستانه:</span>
                  <button
                    onClick={() => handleUpdateGlobalThreshold(-1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition"
                    title="کاهش آستانه هشدار"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-amber-400 text-xs w-5 text-center">
                    {globalThreshold}
                  </span>
                  <button
                    onClick={() => handleUpdateGlobalThreshold(1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition"
                    title="افزایش آستانه هشدار"
                  >
                    +
                  </button>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setStockFilter(stockFilter === 'ALL' ? 'ALERTS_ONLY' : 'ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    stockFilter === 'ALERTS_ONLY'
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{stockFilter === 'ALERTS_ONLY' ? 'نمایش همه' : 'فقط هشدارها'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Search, Categories Bar & Hotkey Hint */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجوی سریع آیتم (مثلاً اسپرسو، لاته، چیزکیک...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pr-9 pl-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Hotkey Helper Tag */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-stone-400 bg-stone-950 border border-stone-800/80 px-2.5 py-1.5 rounded-lg">
                <span className="text-amber-400 font-mono">1-9</span>
                <span>ثبت سریع اقلام</span>
                <span className="text-stone-600">|</span>
                <span className="text-amber-400 font-mono">P</span>
                <span>پوز</span>
                <span className="text-stone-600">|</span>
                <span className="text-amber-400 font-mono">C</span>
                <span>نقد</span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedCategoryId === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                همه اقلام منو ({menuItems.length})
              </button>
              {categories.map((cat) => {
                const count = menuItems.filter((i) => i.categoryId === cat.id && i.isAvailable).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      selectedCategoryId === cat.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {cat.nameFa} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {filteredItems.map((item, idx) => {
              const inCart = cartItems.find((ci) => ci.menuItemId === item.id);
              const cartQty = inCart ? inCart.quantity : 0;
              const stockEval = evaluateStockStatus(
                item.currentStock,
                item.lowStockThreshold,
                globalThreshold
              );
              const isOutOfStock = stockEval.status === 'OUT_OF_STOCK';
              const isLowStock = stockEval.status === 'LOW';
              const currentStock = item.currentStock ?? 0;
              const isCartMaxed = item.currentStock !== undefined && cartQty >= currentStock;

              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between text-right p-3 rounded-xl border transition-all text-sm group relative ${
                    isOutOfStock
                      ? 'bg-stone-900/40 border-rose-900/40 opacity-60'
                      : isCartMaxed
                      ? 'bg-stone-900/60 border-amber-600/40 opacity-75'
                      : inCart
                      ? 'bg-amber-950/20 border-amber-600/70 shadow-sm'
                      : isLowStock
                      ? 'bg-amber-950/15 border-amber-500/70 shadow-sm ring-1 ring-amber-500/30 hover:border-amber-400 hover:bg-amber-950/25'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700 hover:bg-stone-800/60'
                  }`}
                >
                  {/* Top Badges */}
                  <div className="flex items-center justify-between w-full mb-1">
                    {/* Hotkey Number Tag (1-9) */}
                    {idx < 9 ? (
                      <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    ) : (
                      <span />
                    )}

                    {/* Stock Warning Badge */}
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 bg-rose-950 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-800">
                        <AlertOctagon className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>اتمام موجودی</span>
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 bg-amber-950/90 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/60 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>هشدار ({item.currentStock})</span>
                      </span>
                    ) : null}

                    {inCart && (
                      <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                        {inCart.quantity}×
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 w-full my-1">
                    <span className="font-semibold text-stone-100 group-hover:text-amber-400 transition leading-snug">
                      {item.nameFa}
                    </span>
                    {item.nameEn && (
                      <span className="text-[11px] text-stone-400 font-mono" dir="ltr">
                        {item.nameEn}
                      </span>
                    )}
                  </div>

                  {/* Price & Action Buttons */}
                  <div className="flex flex-col gap-2 w-full pt-2 border-t border-stone-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 text-xs">قیمت پایه:</span>
                      <span className="font-bold text-amber-400 font-mono text-xs">
                        {formatToman(item.priceToman)} ت
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Fast Add Button */}
                      <button
                        onClick={() => handleAddItem(item)}
                        disabled={isOutOfStock || isCartMaxed}
                        className="bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        <span>سریع</span>
                      </button>

                      {/* 3-Tap Modifier Sheet Button */}
                      <button
                        onClick={(e) => handleOpenModifierModal(e, item)}
                        disabled={isOutOfStock || isCartMaxed}
                        className="bg-amber-950/40 hover:bg-amber-900/40 border border-amber-600/40 disabled:opacity-50 text-amber-300 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition"
                        title="سفارشی‌سازی مودیفایر (شیر جو دوسر، دبل‌شات، سیروپ)"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>مودیفایر</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side (Cart & Order Registration) - 5 cols */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-xl shadow-md flex flex-col justify-between overflow-hidden">
          {/* Cart Header */}
          <div className="p-3 border-b border-stone-800 bg-stone-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-sm text-stone-100">فاکتور جاری صندوق</span>
              <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)} آیتم
              </span>
            </div>

            {cartItems.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-stone-400 hover:text-rose-400 p-1 text-xs flex items-center gap-1 transition"
                title="خالی کردن کل سبد"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف همه</span>
              </button>
            )}
          </div>

          {/* Order Meta / Settings */}
          <div className="p-3 border-b border-stone-800 bg-stone-950/30 flex flex-col gap-2.5 text-xs">
            {/* Dine-In vs Takeaway */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-stone-400">نوع سفارش:</span>
              <div className="flex items-center gap-1 bg-stone-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setOrderType('DINE_IN')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    orderType === 'DINE_IN'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  سالن (میز)
                </button>
                <button
                  onClick={() => setOrderType('TAKEAWAY')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    orderType === 'TAKEAWAY'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  بیرون‌بر
                </button>
              </div>
            </div>

            {/* Table or Customer input */}
            <div className="grid grid-cols-2 gap-2">
              {orderType === 'DINE_IN' ? (
                <div>
                  <label className="text-stone-400 block mb-1">شماره یا نام میز:</label>
                  <select
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-1.5 text-stone-200 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'بار تخصصی', 'فضای باز'].map((t) => (
                      <option key={t} value={`میز ${t}`}>
                        {typeof t === 'number' ? `میز ${t}` : t}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-stone-400 block mb-1">نام مشتری:</label>
                  <input
                    type="text"
                    placeholder="نام تحویل‌گیرنده..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
              )}

              <div>
                <label className="text-stone-400 block mb-1">توضیحات فاکتور:</label>
                <input
                  type="text"
                  placeholder="اختیاری..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px]">
            {cartItems.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-stone-500 text-xs gap-2">
                <Coffee className="w-8 h-8 text-stone-600" />
                <span>سبد سفارش خالی است</span>
                <span className="text-[11px] text-stone-600">
                  برای افزودن روی اقلام منو کلیک کنید یا کلیدهای 1 تا 9 را بفشارید
                </span>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-stone-950/70 border border-stone-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex flex-col flex-1">
                    <span className="font-semibold text-stone-200">{item.itemNameSnapshot}</span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      {formatToman(item.unitPriceSnapshotToman)} تومان
                    </span>

                    {/* Modifiers List in Cart */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.modifiers.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[9px] bg-stone-900 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded"
                          >
                            + {m.nameFa}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.notes && (
                      <span className="text-[10px] text-stone-400 italic mt-0.5">
                        یادداشت: {item.notes}
                      </span>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 rounded-lg p-0.5">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-stone-100 font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-left font-bold text-amber-400 font-mono w-20">
                    {formatToman(item.subtotalToman)} ت
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-stone-500 hover:text-rose-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Quick Discount Buttons & Totals */}
          {cartItems.length > 0 && (
            <div className="p-3 border-t border-stone-800 bg-stone-950/40 flex flex-col gap-2.5">
              {/* Discount pills */}
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-stone-400 flex items-center gap-1">
                  <Percent className="w-3 h-3" /> تخفیف:
                </span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15, 20].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleApplyDiscountPercent(p)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition ${
                        discountPercent === p && discountToman > 0
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {p === 0 ? 'بدون تخفیف' : `${p}٪`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>جمع اقلام (ناخالص):</span>
                  <span>{formatToman(grossAmountToman)} تومان</span>
                </div>
                {discountAmountToman > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>مبلغ تخفیف:</span>
                    <span>- {formatToman(discountAmountToman)} تومان</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-stone-100 pt-1 border-t border-stone-800">
                  <span>مبلغ قابل پرداخت (خالص):</span>
                  <span className="text-amber-400">{formatToman(netTotalToman)} تومان</span>
                </div>
              </div>

              {/* Checkout Action Button */}
              <button
                onClick={handleStartCheckout}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تسویه و ثبت پرداخت ({formatToman(netTotalToman)} تومان)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modifier Sheet Modal */}
      <ModifierModal
        item={modifierItem}
        isOpen={isModifierOpen}
        onClose={() => {
          setIsModifierOpen(false);
          setModifierItem(null);
        }}
        onConfirm={handleAddWithModifiers}
      />

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-bold text-stone-100 text-base">تسویه و ثبت پرداخت سفارش</h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total due banner */}
            <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3 text-center">
              <span className="text-xs text-amber-300">مبلغ قابل تسویه:</span>
              <div className="text-2xl font-black text-amber-400 mt-0.5">
                {formatToman(netTotalToman)} <span className="text-xs font-normal text-amber-200">تومان</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-300">روش پرداخت:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD_MANUAL')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                    paymentMethod === 'CARD_MANUAL'
                      ? 'bg-amber-600 border-amber-500 text-white shadow'
                      : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-750'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>کارتخوان بانکی (P)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setCashTendered(netTotalToman);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-amber-600 border-amber-500 text-white shadow'
                      : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-750'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>وجه نقد (C)</span>
                </button>
              </div>
            </div>

            {/* Method-specific fields */}
            {paymentMethod === 'CARD_MANUAL' ? (
              <div className="flex flex-col gap-2.5 bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs">
                <div>
                  <label className="text-stone-400 block mb-1">دستگاه کارتخوان:</label>
                  <select
                    value={terminalName}
                    onChange={(e) => setTerminalName(e.target.value)}
                    className="w-full bg-stone-850 border border-stone-700 rounded-lg p-2 text-stone-200"
                  >
                    <option value="کارتخوان به‌پرداخت ملت ۱">کارتخوان ۱ (به‌پرداخت ملت)</option>
                    <option value="کارتخوان سامان کیش ۲">کارتخوان ۲ (سپ - سامان کیش)</option>
                    <option value="کارتخوان پاسارگاد">کارتخوان ۳ (فناپ پاسارگاد)</option>
                  </select>
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">شماره پیگیری فیش کارتخوان (اختیاری):</label>
                  <input
                    type="text"
                    placeholder="مثلاً: ۷۴۸۲۹۱"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    className="w-full bg-stone-850 border border-stone-700 rounded-lg p-2 text-stone-100 font-mono text-center tracking-wider focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs">
                <label className="text-stone-400">وجه نقد دریافتی از مشتری (تومان):</label>
                <input
                  type="number"
                  value={cashTendered || ''}
                  onChange={(e) => setCashTendered(safeInt(e.target.value))}
                  className="w-full bg-stone-850 border border-stone-700 rounded-lg p-2 text-stone-100 font-bold text-center text-sm focus:outline-none focus:border-amber-500"
                />

                {/* Iranian Banknotes Quick Suggestion Chips */}
                <div className="pt-1">
                  <span className="text-[11px] text-stone-400 block mb-1.5">
                    پیشنهاد اسکناس‌های رایج تومانی:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashTendered(netTotalToman)}
                      className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 text-[10px] font-semibold border border-stone-700"
                    >
                      دقیقاً همین مبلغ
                    </button>
                    {IRANIAN_BANKNOTES_TOMAN.map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => setCashTendered(note)}
                        className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-mono border border-stone-700"
                      >
                        {formatToman(note)} ت
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-stone-800 text-xs">
                  <span className="text-stone-400">باقیمانده پرداختی به مشتری (Change):</span>
                  <span className={`font-bold ${cashTendered >= netTotalToman ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {cashTendered >= netTotalToman
                      ? `${formatToman(cashTendered - netTotalToman)} تومان`
                      : 'مبلغ کمتر از فاکتور است'}
                  </span>
                </div>
              </div>
            )}

            {/* Confirm & Print Receipt buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="w-1/3 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl text-xs font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmPayment(false)}
                  className="w-2/3 bg-stone-700 hover:bg-stone-650 text-stone-100 py-2.5 rounded-xl text-xs font-bold shadow transition cursor-pointer"
                >
                  ثبت پرداخت و مشاهده رسید
                </button>
              </div>

              {/* Dedicated Print Receipt Button */}
              <button
                type="button"
                onClick={() => handleConfirmPayment(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>ثبت نهایی و چاپ فیش (Print Receipt)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Printer-Friendly Receipt Preview Component */}
      {completedReceiptOrder && (
        <div className="relative">
          {/* Hardware Direct Thermal Print Bar */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900 border border-amber-600/60 rounded-2xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs w-full max-w-xl animate-fadeIn">
            <div className="flex items-center gap-2 text-stone-200">
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="font-bold">چاپ مستقیم حرارتی ۸۰ میلی‌متری (ESC/POS Raster):</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleHardwarePrint('USB')}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-medium flex items-center gap-1.5 transition"
                title="اتصال بدون درایور از طریق WebUSB"
              >
                <Usb className="w-3.5 h-3.5 text-blue-400" />
                <span>WebUSB</span>
              </button>

              <button
                onClick={() => handleHardwarePrint('BLUETOOTH')}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-medium flex items-center gap-1.5 transition"
                title="اتصال بدون درایور از طریق بلوتوث"
              >
                <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
                <span>بلوتوث</span>
              </button>
            </div>

            {hardwarePrintStatus && (
              <div className="w-full text-center text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/40 rounded p-1">
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
