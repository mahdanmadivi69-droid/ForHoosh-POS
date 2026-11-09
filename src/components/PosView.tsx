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
  FileText,
  LayoutGrid,
  RotateCcw,
} from 'lucide-react';
import { TablePickerModal } from './floorplan/TablePickerModal';
import { floorPlanService } from '../services/floorPlanService';
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
import { ModifierOption, OrderAggregate, OrderItemAggregate } from '../types/order-domain';
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
import { inventoryBomService } from '../services/inventoryBomService';
import { openTabService } from '../services/openTabService';
import { getActiveTenant } from '../config/tenantConfig';
import { CatalogCard } from './CatalogCard';
import { CatalogMenuItem, SelectedBean, CatalogCartItem } from '../types/catalog';
import { OpenTabsModal } from './OpenTabsModal';
import { LiquidGlassPaymentSheet, SettlementResult } from './LiquidGlassPaymentSheet';
import { CatalogService } from '../services/catalog/catalogService';
import { OpenTabRecord } from '../db/schema';

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
  onOpenZReport?: () => void;
  preselectedTableLabel?: string | null;
}

export const PosView: React.FC<PosViewProps> = ({
  tenant,
  categories,
  menuItems,
  activeShift,
  activeUser,
  onOrderCompleted,
  onOpenShiftRequired,
  onOpenZReport,
  preselectedTableLabel,
}) => {
  const canEditFinancials = isManagerOrOwner(activeUser.role);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [roastFilter, setRoastFilter] = useState<'all' | 'medium' | 'dark' | 'light'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'ALERTS_ONLY'>('ALL');

  // Configurable default threshold for low stock alert
  const [globalThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('smartorders_stock_threshold');
      return saved ? Math.max(1, parseInt(saved, 10)) : 5;
    } catch {
      return 5;
    }
  });

  const activeTenant = getActiveTenant();
  const [tableToast, setTableToast] = useState<string | null>(null);
  const showTableToast = (msg: string) => {
    setTableToast(msg);
    setTimeout(() => setTableToast(null), 3500);
  };

  // Current Order / Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(activeTenant.workflow.defaultOrderType);
  const [tableLabel, setTableLabel] = useState<string>(
    preselectedTableLabel || (activeTenant.workflow.requireTableNumber ? '' : 'میز ۱')
  );
  const [isTablePickerOpen, setIsTablePickerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (preselectedTableLabel) {
      setTableLabel(preselectedTableLabel);
      setOrderType('DINE_IN');
    }
  }, [preselectedTableLabel]);
  const [customerName, setCustomerName] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [discountToman, setDiscountToman] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);

  // Modifier sheet modal state
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [isModifierOpen, setIsModifierOpen] = useState<boolean>(false);

  // Offline Sync Queue state
  const [queueStats, setQueueStats] = useState<QueueStats>({ total: 0, pending: 0, failed: 0, paused: 0, quarantined: 0 });
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOpenTabsModalOpen, setIsOpenTabsModalOpen] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [openTabsCount, setOpenTabsCount] = useState<number>(() => {
    try {
      return CatalogService.getOpenTabs().length;
    } catch {
      return 0;
    }
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD_MANUAL');
  const [terminalName, setTerminalName] = useState<string>('پوز ۱ (بانک سامان)');
  const [referenceCode, setReferenceCode] = useState<string>('');
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

  const stockAlertStats = countStockAlerts(menuItems, globalThreshold);

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    if (!item.isAvailable) return false;
    const matchesCat = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
    const matchesRoast = roastFilter === 'all' || item.roast === roastFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      item.nameFa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.origin && item.origin.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.notes && item.notes.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchesCat || !matchesRoast || !matchesSearch) return false;

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
          if (activeTenant.workflow.requireTableNumber && orderType === 'DINE_IN' && !tableLabel.trim()) {
            showTableToast('لطفاً شماره میز را انتخاب کنید');
            playPosBeep('delete');
            return;
          }
          e.preventDefault();
          setPaymentMethod('CARD_MANUAL');
          setIsCheckoutOpen(true);
        }
        return;
      }

      // Hotkey 'C' or 'c': Direct Cash payment
      if (e.key === 'c' || e.key === 'C') {
        if (cartItems.length > 0 && activeShift) {
          if (activeTenant.workflow.requireTableNumber && orderType === 'DINE_IN' && !tableLabel.trim()) {
            showTableToast('لطفاً شماره میز را انتخاب کنید');
            playPosBeep('delete');
            return;
          }
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
    const bomStock = inventoryBomService.evaluateMenuItemStock(item.id);
    if ((item.currentStock !== undefined && item.currentStock <= 0) || bomStock.isOutOfStock) {
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
    const bomStock = inventoryBomService.evaluateMenuItemStock(item.id);
    if ((item.currentStock !== undefined && item.currentStock <= 0) || bomStock.isOutOfStock) {
      playPosBeep('delete');
      return;
    }

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

  const handleAddCatalogCardItem = (catItem: CatalogMenuItem, selectedBean: SelectedBean) => {
    const isBlend = selectedBean === 'blend';
    const beanLabel = isBlend ? 'میکس ۵۰/۵۰' : 'عربیکا ۱۰۰٪';
    const effectivePrice = isBlend ? (catItem.priceBlend ?? catItem.priceToman) : (catItem.priceArabica ?? catItem.priceToman);

    playPosBeep('click');
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.menuItemId === catItem.id && c.notes === beanLabel
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + 1;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          subtotalToman: existing.unitPriceSnapshotToman * newQty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          menuItemId: catItem.id,
          itemNameSnapshot: `${catItem.nameFa} (${beanLabel})`,
          unitPriceSnapshotToman: effectivePrice,
          quantity: 1,
          subtotalToman: effectivePrice,
          modifiers: [],
          notes: beanLabel,
        },
      ];
    });
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

  // Open Tabs Handlers
  const handleRecallTabForEditing = (tab: OpenTabRecord) => {
    try {
      const recalled = CatalogService.recallTabForEditing(tab.tab_id, activeShift?.tenantId);
      const mappedItems: OrderItem[] = recalled.cart.map((c) => ({
        id: c.cartItemId || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        menuItemId: c.menuItemId,
        itemNameSnapshot: c.title,
        unitPriceSnapshotToman: c.unitPriceToman || c.unitPriceSnapshotToman || 0,
        quantity: c.quantity,
        subtotalToman: c.subtotalToman,
        modifiers: [],
        notes: c.notes,
      }));

      setCartItems(mappedItems);
      setTableLabel(tab.table_or_customer || '');
      setActiveTabId(tab.tab_id);
      showTableToast(`تب "${tab.table_or_customer}" در سبد فعال بازیابی شد`);
    } catch (e: any) {
      alert(`خطا در بازیابی تب: ${e?.message || e}`);
    }
  };

  const handleHoldOrUpdateTab = () => {
    if (cartItems.length === 0) {
      playPosBeep('delete');
      showTableToast('سبد سفارش برای ثبت تب خالی است');
      return;
    }

    playPosBeep('click');
    const catalogCart: CatalogCartItem[] = cartItems.map((it) => ({
      cartItemId: it.id,
      menuItemId: it.menuItemId,
      title: it.itemNameSnapshot,
      unitPriceToman: it.unitPriceSnapshotToman,
      unitPriceSnapshotToman: it.unitPriceSnapshotToman,
      quantity: it.quantity,
      subtotalToman: it.subtotalToman,
      bomGramsPerCup: 18.0,
      selectedBean: it.notes?.includes('۵۰/۵۰') ? 'blend' : 'arabica',
      notes: it.notes,
    }));

    const label = (orderType === 'DINE_IN' ? tableLabel : customerName) || 'میز موقت';

    if (activeTabId) {
      // In-place mutation of existing tab
      try {
        CatalogService.updateOpenTab(activeTabId, catalogCart, label, activeShift?.tenantId);
        showTableToast(`تغییرات تب "${label}" با موفقیت ذخیره شد`);
        setCartItems([]);
        setActiveTabId(null);
        setOpenTabsCount(CatalogService.getOpenTabs().length);
      } catch (e: any) {
        alert(`خطا در بروزرسانی تب: ${e?.message || e}`);
      }
    } else {
      // Creation of new tab
      try {
        CatalogService.holdCurrentCartAsTab(catalogCart, label, activeShift?.tenantId);
        showTableToast(`سفارش در تب جدید "${label}" نگهداری شد`);
        setCartItems([]);
        setOpenTabsCount(CatalogService.getOpenTabs().length);
      } catch (e: any) {
        alert(`خطا در نگهداری تب: ${e?.message || e}`);
      }
    }
  };

  const handleCancelTabEditing = () => {
    playPosBeep('delete');
    setActiveTabId(null);
    showTableToast('از حالت ویرایش تب خارج شدید');
  };

  const handleConfirmSettlement = (settleResult: SettlementResult) => {
    const domainPayMethod: PaymentMethod =
      settleResult.paymentMethod === 'CASH'
        ? 'CASH'
        : settleResult.paymentMethod === 'POS'
        ? 'CARD_MANUAL'
        : 'OTHER';

    setPaymentMethod(domainPayMethod);
    setTerminalName(settleResult.terminalName);
    if (settleResult.referenceCode) {
      setReferenceCode(settleResult.referenceCode);
    }
    if (settleResult.cashTendered !== undefined) {
      setCashTendered(settleResult.cashTendered);
    }
    handleConfirmPayment(false, settleResult);
  };

  // Checkout submission
  const handleStartCheckout = () => {
    playPosBeep('click');
    if (!activeShift) {
      onOpenShiftRequired();
      return;
    }
    if (cartItems.length === 0) return;
    if (activeTenant.workflow.requireTableNumber && orderType === 'DINE_IN' && !tableLabel.trim()) {
      showTableToast('لطفاً شماره میز را انتخاب کنید');
      playPosBeep('delete');
      return;
    }
    setCashTendered(netTotalToman);
    setIsCheckoutOpen(true);
  };

  const handleConfirmPayment = (autoPrint = false, settleResult?: SettlementResult) => {
    if (!activeShift) return;

    playPosBeep('success');

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

    if (result) {
      // Automatically deduct raw BOM materials upon order settlement
      // If completing a recalled open tab, settle and close it in place!
      if (activeTabId) {
        try {
          CatalogService.settleAndCloseTab(activeTabId, result.order.id, activeShift.tenantId);
          setOpenTabsCount(CatalogService.getOpenTabs().length);
        } catch (e) {
          console.warn('[PosView] Failed to settle tab:', e);
        }
        setActiveTabId(null);
      }

      inventoryBomService.deductForItems(
        cartItems.map((it) => ({
          id: it.id,
          menuItemId: it.menuItemId,
          title: it.itemNameSnapshot,
          quantity: it.quantity,
          unitPrice: it.unitPriceSnapshotToman,
          subtotal: it.subtotalToman,
          modifiers: it.modifiers?.map((m) => ({ id: m.id, nameFa: m.nameFa, priceDelta: m.priceDeltaToman })),
          notes: it.notes,
        }))
      );

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
      setIsMobileCartOpen(false);

      if (autoPrint) {
        setTimeout(() => {
          printThermalReceipt('thermal-receipt');
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
        payments: completedReceiptPayment
          ? [
              {
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
              },
            ]
          : [],
        paidAmountToman: completedReceiptOrder.netTotalToman,
        paidAmount: completedReceiptOrder.netTotalToman,
        createdAt: completedReceiptOrder.createdAt,
        updatedAt: completedReceiptOrder.updatedAt,
        createdByUserId: completedReceiptOrder.createdByUserId,
        createdByUserName: completedReceiptOrder.createdByUserName,
      };

      const canvas = renderReceiptToCanvas(orderAggregate, tenant);

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
      <section className="flex-1 flex flex-col min-w-0">
        {/* Top Announcement & Roast Specs Bar */}
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

            {/* Offline Sync Status Chip */}
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

        {/* Categories Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-3 select-none">
          <button
            onClick={() => {
              playPosBeep('click');
              setSelectedCategoryId('all');
            }}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
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
            else if (cat.id.includes('karak')) icon = '🫖';
            else if (cat.id.includes('cold')) icon = '🧊';
            else if (cat.id.includes('gear')) icon = '⚙️';
            else if (cat.id.includes('pastry')) icon = '🍰';

            return (
              <button
                key={cat.id}
                onClick={() => {
                  playPosBeep('click');
                  setSelectedCategoryId(cat.id);
                }}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
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

        {/* Quick Filter Sub-tags & Live Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#9EACB8] pb-3 mb-2 border-b border-[#293444]/70">
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

            {/* Stock alert toggle */}
            {stockAlertStats.totalLowStock > 0 && (
              <button
                onClick={() => {
                  playPosBeep('click');
                  setStockFilter(stockFilter === 'ALL' ? 'ALERTS_ONLY' : 'ALL');
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  stockFilter === 'ALERTS_ONLY'
                    ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                    : 'bg-[#1B222C] border-[#293444] text-rose-400 hover:border-rose-500'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{stockAlertStats.totalLowStock} کسری موجودی</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی دان، ۵۰/۵۰، کرک تی، نوشیدنی..."
              className="w-full bg-[#121417] border border-[#293444] text-white text-xs rounded-lg pr-8 pl-3 py-1.5 focus:outline-none focus:border-[#D71921] transition-colors placeholder:text-[#9EACB8]/60"
            />
            <Search className="w-3.5 h-3.5 text-[#9EACB8] absolute right-2.5 top-2" />
          </div>

          <div className="hidden sm:block text-[11px] shrink-0">
            تعداد آیتم‌ها: <span className="font-bold text-white num-heavy">{filteredItems.length}</span> محصول
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4 flex-1 items-start">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[#9EACB8] bg-[#1B222C]/40 border border-[#293444] rounded-2xl">
              <Coffee className="w-10 h-10 mx-auto text-[#9EACB8] mb-2 opacity-50" />
              <p className="font-bold text-white text-sm">هیچ محصولی با این فیلتر یافت نشد</p>
              <p className="text-xs mt-1">
                نام دیگری مانند «۵۰/۵۰»، «کرک»، «اتیوپی» یا کاتگوری دیگری را انتخاب نمایید.
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const stockStatus = evaluateStockStatus(
                item.currentStock,
                item.lowStockThreshold,
                globalThreshold
              );
              const bomStock = inventoryBomService.evaluateMenuItemStock(item.id);
              const isOutOfStock = stockStatus.isOutOfStock || bomStock.isOutOfStock;
              const isLow = (stockStatus.isLowStock || bomStock.hasLowStockIngredients) && !isOutOfStock;
              const isSensoryCard = Boolean(item.hasDualBean || (activeTenant.id.includes('100hich') && (item.isBean || item.categoryId === 'cat-coffee')));
              if (isSensoryCard) {
                return (
                  <CatalogCard
                    key={item.id}
                    item={item as unknown as CatalogMenuItem}
                    onAddToCart={handleAddCatalogCardItem}
                    isOutOfStock={isOutOfStock}
                    isLowStock={isLow}
                    hotkeyIndex={idx < 9 ? idx + 1 : undefined}
                  />
                );
              }

              return (
                <article
                  key={item.id}
                  onClick={() => !isOutOfStock && handleAddItem(item)}
                  className={`bg-[#1B222C] border border-[#293444] rounded-xl overflow-hidden hover:border-[#9EACB8]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg relative ${
                    isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {/* Card Header & Badges */}
                  <div className="p-3 pb-2 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.roastLevelText ? (
                          <span className="text-[10px] font-mono tracking-wider font-bold bg-[#0F223D] border border-[#293444] text-[#F3E9DD] px-2 py-0.5 rounded">
                            {item.roastLevelText}
                          </span>
                        ) : null}

                        {item.badge ? (
                          <span className="text-[10px] font-black bg-[#D71921] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                            {item.badge}
                          </span>
                        ) : item.weight ? (
                          <span className="text-[10px] text-[#9EACB8] font-bold">
                            {item.weight}
                          </span>
                        ) : null}
                      </div>

                      {/* Hotkey hint (1-9) */}
                      {idx < 9 && (
                        <span className="text-[10px] font-mono bg-[#121417] text-[#9EACB8] px-1.5 py-0.5 rounded border border-[#293444]">
                          کلید {idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Stock Alert Badge if low */}
                    {isOutOfStock ? (
                      <div className="mb-2 bg-rose-950/60 border border-rose-800 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        <span>ناموجود (اتمام مواد اولیه انبار)</span>
                      </div>
                    ) : isLow ? (
                      <div className="mb-2 bg-amber-950/60 border border-amber-800 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>هشدار کسری موجودی / مواد خام</span>
                      </div>
                    ) : null}

                    {/* Product Titles */}
                    <h3 className="font-extrabold text-sm md:text-base text-white group-hover:text-[#F3E9DD] transition-colors leading-snug">
                      {item.nameFa}
                    </h3>
                    {item.nameEn && (
                      <p className="text-[11px] font-mono text-[#9EACB8] mt-0.5 truncate tracking-tight">
                        {item.nameEn}
                      </p>
                    )}

                    {/* Technical Roast Specs Grid */}
                    {(item.origin || item.process) && (
                      <div className="mt-2.5 pt-2 border-t border-[#293444]/60 text-[11px] space-y-1">
                        {item.origin && (
                          <div className="flex items-center justify-between text-[#9EACB8]">
                            <span>خاستگاه:</span>
                            <span className="text-white font-medium text-right max-w-[170px] truncate">
                              {item.origin}
                            </span>
                          </div>
                        )}
                        {item.process && item.process !== '-' && (
                          <div className="flex items-center justify-between text-[#9EACB8]">
                            <span>فرآوری:</span>
                            <span className="text-[#F3E9DD] font-mono text-[10px]">
                              {item.process}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Taste Notes Tags */}
                    {item.notes && item.notes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {item.notes.slice(0, 3).map((note, nIdx) => (
                          <span
                            key={nIdx}
                            className="text-[9.5px] bg-[#121417] text-[#9EACB8] px-1.5 py-0.5 rounded border border-[#293444] leading-tight"
                          >
                            {note}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Bar: Price & Action CTA */}
                  <div className="px-3 py-2 bg-[#121417]/90 border-t border-[#293444] rounded-b-xl flex items-center justify-between gap-1.5 mt-auto overflow-hidden">
                    <div className="min-w-0 pr-0.5">
                      <span className="text-[9px] text-[#9EACB8] block leading-none mb-0.5 font-medium">
                        قیمت پایه:
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-white num-heavy tracking-tight">
                          {formatToman(item.priceToman)}
                        </span>
                        <span className="text-[9px] text-[#9EACB8] shrink-0">تومان</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Customize / Modifiers button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenModifierModal(e, item)}
                        title={item.isBean ? 'تنظیم درجه آسیاب' : 'تنظیم مودیفایر'}
                        className="bg-[#0F223D] hover:bg-[#222B38] border border-[#293444] text-[#F3E9DD] h-7 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition cursor-pointer text-xs shrink-0 active:scale-95"
                      >
                        <Sliders className="w-3 h-3 text-[#F3E9DD] shrink-0" />
                        <span className="text-[10px] font-semibold">
                          {item.isBean ? 'آسیاب' : 'آپشن'}
                        </span>
                      </button>

                      {/* Quick Add Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(item);
                        }}
                        disabled={isOutOfStock}
                        title="افزودن به سفارش"
                        className="bg-[#D71921] hover:bg-[#B8141B] active:scale-95 disabled:bg-stone-700 text-white h-7 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1 shadow-md shadow-[#D71921]/30 transition cursor-pointer text-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-black">افزودن</span>
                      </button>
                    </div>
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
        className="hidden xl:flex flex-col w-[420px] bg-[#1B222C] border border-[#293444] rounded-xl sticky top-[72px] h-[calc(100vh-90px)] shadow-2xl transition-all"
      >
        {/* Cart Header & Order Type Toggle */}
        <div className="p-3.5 border-b border-[#293444] bg-[#0F223D] rounded-t-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D71921] animate-ping"></span>
              <h2 className="text-sm font-extrabold text-white tracking-wide">
                سفارش جاری بار (فاکتور)
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  setIsOpenTabsModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[rgba(140,19,24,0.3)] hover:bg-[rgba(140,19,24,0.5)] border border-[rgba(144,210,237,0.3)] text-[#90D2ED] hover:text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                title="مشاهده و بازیابی تب‌های باز سالن"
              >
                <Layers className="w-3 h-3" />
                <span>تب‌های باز</span>
                <span className="w-4 h-4 rounded-full bg-[#8C1318] text-white flex items-center justify-center text-[10px] font-mono">
                  {openTabsCount}
                </span>
              </button>
              <span className="font-mono text-xs bg-[#081425] px-2 py-0.5 rounded text-[#F3E9DD] border border-[#293444] font-bold">
                #100H-{activeShift ? activeShift.id.slice(-4) : 'POS'}
              </span>
            </div>
          </div>

          {/* Active Recalled Tab Notice Banner */}
          {activeTabId && (
            <div className="bg-gradient-to-r from-[rgba(140,19,24,0.45)] to-[rgba(15,34,61,0.7)] border border-[rgba(144,210,237,0.45)] p-2 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-[#90D2ED]" />
                <span className="font-bold text-white">
                  در حال ویرایش تب: <span className="text-[#F5E8D0]">{tableLabel || 'میز فعال'}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelTabEditing}
                className="text-[10px] text-rose-300 hover:text-white px-2 py-0.5 rounded bg-black/40 border border-white/10 cursor-pointer"
              >
                خروج از ویرایش
              </button>
            </div>
          )}

          {/* Dine-in vs Takeaway Toggle */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#121417]/80 p-1 rounded-lg border border-[#293444] text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setOrderType('TAKEAWAY');
              }}
              className={`py-1.5 rounded flex items-center justify-center gap-1 transition-all cursor-pointer ${
                orderType === 'TAKEAWAY'
                  ? 'bg-[#D71921] text-white shadow-sm'
                  : 'text-[#9EACB8] hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>بیرون‌بر (Takeaway)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setOrderType('DINE_IN');
              }}
              className={`py-1.5 rounded flex items-center justify-center gap-1 transition-all cursor-pointer ${
                orderType === 'DINE_IN'
                  ? 'bg-[#D71921] text-white shadow-sm'
                  : 'text-[#9EACB8] hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>سرو در سالن (Dine-in)</span>
            </button>
          </div>
        </div>

        {/* Customer Detail */}
        <div className="px-3 py-2 bg-[#121417]/50 border-b border-[#293444] flex items-center justify-between text-xs gap-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={
              orderType === 'DINE_IN'
                ? 'نام مشتری / مهمان سالن...'
                : 'نام مشتری بیرون‌بر...'
            }
            className="bg-transparent text-white placeholder:text-[#9EACB8]/70 text-xs w-full focus:outline-none"
          />
          {orderType === 'DINE_IN' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsTablePickerOpen(true)}
                className="text-[10px] bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                title="انتخاب بصری از نقشه سالن"
              >
                <LayoutGrid className="w-3 h-3 text-emerald-400" />
                <span>نقشه</span>
              </button>
              <select
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                className="text-[10px] text-white bg-[#1B222C] px-1.5 py-0.5 rounded border border-[#293444] cursor-pointer focus:outline-none"
              >
                {activeTenant.workflow.requireTableNumber && (
                  <option value="" className="bg-[#1B222C] text-gray-400">
                    -- انتخاب میز --
                  </option>
                )}
                {floorPlanService.getTables().map((tbl) => (
                  <option key={tbl.id} value={tbl.display_name} className="bg-[#1B222C] text-white">
                    {tbl.display_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-[10px] text-[#9EACB8] bg-[#1B222C] px-1.5 py-0.5 rounded border border-[#293444] whitespace-nowrap">
              بیرون‌بر
            </span>
          )}
        </div>

        {/* Quick-Select Table Button Bar for Table-Required Tenants (e.g. Modendo) */}
        {orderType === 'DINE_IN' && activeTenant.workflow.requireTableNumber && activeTenant.workflow.quickTables.length > 0 && (
          <div className="px-3 py-2 bg-[#121417]/80 border-b border-[#293444]">
            <div className="text-[10px] text-[#9EACB8] font-bold mb-1.5 flex items-center justify-between">
              <span>میزهای پرکاربرد (سریع):</span>
              {tableLabel ? (
                <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                  <span>میز فعال:</span>
                  <span className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-600/50">{tableLabel}</span>
                </span>
              ) : (
                <span className="text-amber-400 font-bold">میزی انتخاب نشده است</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeTenant.workflow.quickTables.map((tbl) => (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setTableLabel(tbl);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    tableLabel === tbl
                      ? 'bg-[var(--app-accent,#005A3E)] text-white shadow-md border border-emerald-400 scale-105'
                      : 'bg-[#1B222C] text-[#9EACB8] hover:text-white border border-[#293444]'
                  }`}
                >
                  {tbl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Invoice Notes */}
        <div className="px-3 py-1.5 bg-[#121417]/30 border-b border-[#293444] flex items-center text-xs gap-2">
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="یادداشت فاکتور (توضیحات کلی سفارش)..."
            className="bg-transparent text-white placeholder:text-[#9EACB8]/50 text-xs w-full focus:outline-none"
          />
        </div>

        {/* Cart Items List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#9EACB8]">
              <div className="w-14 h-14 rounded-full bg-[#121417] flex items-center justify-center border border-[#293444] mb-3">
                <Coffee className="w-7 h-7 text-[#D71921] opacity-80" />
              </div>
              <p className="text-sm font-bold text-white mb-1">فاکتور هنوز خالی است</p>
              <p className="text-xs text-[#9EACB8] max-w-xs">
                آیتمی از منوی بلندها، بار گرم یا دانه‌های تخصصی صد هیچ را لمس کنید تا به سبد اضافه شود.
              </p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#121417] border border-[#293444] rounded-lg p-2.5 flex flex-col gap-2 transition hover:border-[#293444]/90"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {item.itemNameSnapshot}
                    </h4>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-[#9EACB8]">
                        {item.modifiers.map((m, mIdx) => (
                          <span key={mIdx} className="text-[#F3E9DD] font-medium">
                            {m.nameFa}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-amber-400 italic">*{item.notes}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-[#9EACB8] hover:text-red-400 p-1 cursor-pointer"
                    title="حذف آیتم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#293444]/50">
                  <div className="flex items-center bg-[#1B222C] border border-[#293444] rounded-md">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center text-[#9EACB8] hover:text-white font-black text-sm active:bg-[#D71921] cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-7 text-center font-bold text-xs text-white num-heavy">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center text-[#9EACB8] hover:text-white font-black text-sm active:bg-[#D71921] cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-left">
                    <span className="text-xs font-black text-white num-heavy">
                      {formatToman(item.subtotalToman)}
                    </span>
                    <span className="text-[9px] text-[#9EACB8] mr-0.5">تومان</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount & POS Keypad Accelerators */}
        <div className="px-3 pt-2 pb-1 border-t border-[#293444] bg-[#121417]/40">
          <div className="flex items-center justify-between text-[11px] text-[#9EACB8] mb-1.5">
            <span className="flex items-center gap-1.5">
              <span>تخفیف سریع فاکتور:</span>
              {!canEditFinancials && (
                <span className="flex items-center gap-0.5 text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-bold">
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
              className={`py-1 rounded border text-[11px] cursor-pointer ${
                discountPercent === 0
                  ? 'bg-[#0F223D] border-[#D71921] text-white'
                  : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white'
              }`}
            >
              ۰٪
            </button>
            <button
              type="button"
              disabled={!canEditFinancials}
              onClick={() => handleApplyDiscountPercent(5)}
              title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
              className={`py-1 rounded border text-[11px] ${
                !canEditFinancials
                  ? 'opacity-40 cursor-not-allowed bg-[#1B222C] border-[#293444] text-[#9EACB8]'
                  : discountPercent === 5
                  ? 'bg-[#0F223D] border-[#D71921] text-white cursor-pointer'
                  : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white cursor-pointer'
              }`}
            >
              ۵٪ ویژه
            </button>
            <button
              type="button"
              disabled={!canEditFinancials}
              onClick={() => handleApplyDiscountPercent(10)}
              title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
              className={`py-1 rounded border text-[11px] ${
                !canEditFinancials
                  ? 'opacity-40 cursor-not-allowed bg-[#1B222C] border-[#293444] text-[#9EACB8]'
                  : discountPercent === 10
                  ? 'bg-[#0F223D] border-[#D71921] text-white cursor-pointer'
                  : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white cursor-pointer'
              }`}
            >
              ۱۰٪ باریستا
            </button>
            <button
              type="button"
              disabled={!canEditFinancials}
              onClick={() => handleApplyDiscountPercent(15)}
              title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
              className={`py-1 rounded border text-[11px] ${
                !canEditFinancials
                  ? 'opacity-40 cursor-not-allowed bg-[#1B222C] border-[#293444] text-[#9EACB8]'
                  : discountPercent === 15
                  ? 'bg-[#0F223D] border-[#D71921] text-white cursor-pointer'
                  : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white cursor-pointer'
              }`}
            >
              ۱۵٪ همکار
            </button>
          </div>
        </div>

        {/* Calculations & Total Summary */}
        <div className="p-3.5 bg-[#121417] border-t border-[#293444] space-y-2 rounded-b-xl">
          <div className="flex justify-between items-center text-xs text-[#9EACB8]">
            <span>جمع اقلام:</span>
            <span className="font-bold text-white num-heavy">
              {formatToman(grossAmountToman)} تومان
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-[#9EACB8]">
            <span>کسر تخفیف:</span>
            <span className="text-[#F3E9DD] num-heavy">
              {discountAmountToman > 0
                ? `-${formatToman(discountAmountToman)} تومان`
                : '۰ تومان'}
            </span>
          </div>

          <div className="h-[1px] bg-[#293444]/80 my-1"></div>

          <div className="flex justify-between items-baseline">
            <span className="text-sm font-extrabold text-white">مبلغ نهایی فاکتور:</span>
            <div className="text-right">
              <span className="text-xl font-black text-[#D71921] num-heavy tracking-tight">
                {formatToman(netTotalToman)}
              </span>
              <span className="text-xs text-[#9EACB8] mr-1">تومان</span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="grid grid-cols-5 gap-2 pt-1.5">
            <button
              type="button"
              onClick={handleClearCart}
              title="پاک کردن سبد"
              className="col-span-1 bg-[#1B222C] hover:bg-[#222B38] border border-[#293444] text-[#9EACB8] hover:text-red-400 rounded-lg flex items-center justify-center transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleStartCheckout}
              disabled={cartItems.length === 0}
              className="col-span-4 bg-[#D71921] hover:bg-[#B8141B] disabled:bg-stone-700 disabled:opacity-50 text-white font-black py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-[0_0_20px_-3px_rgba(215,25,33,0.45)] transition transform active:scale-[0.98] cursor-pointer"
            >
              <CreditCard className="w-5 h-5" />
              <span>ثبت نهایی و تسویه فاکتور</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE FLOATING CART BAR ================= */}
      <div className="xl:hidden fixed bottom-4 left-4 right-4 z-40">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full bg-[#D71921] hover:bg-[#B8141B] text-white p-3 rounded-xl flex items-center justify-between font-black shadow-[0_0_25px_rgba(215,25,33,0.6)] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <span>مشاهده سبد فاکتور ({totalCartCount} آیتم)</span>
          </div>
          <div className="font-mono num-heavy text-base">
            {formatToman(netTotalToman)} تومان
          </div>
        </button>
      </div>

      {/* ================= MOBILE CART DRAWER ================= */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end xl:hidden">
          <div className="bg-[#1B222C] border-t border-[#293444] rounded-t-2xl max-h-[85vh] flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#293444]">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D71921]"></span>
                سبد سفارش صد هیچ
              </h3>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="text-[#9EACB8] hover:text-white p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#121417] p-2.5 rounded-lg border border-[#293444] flex items-center justify-between"
                >
                  <div>
                    <h5 className="font-bold text-xs text-white">{item.itemNameSnapshot}</h5>
                    <span className="text-[10px] text-[#F3E9DD]">
                      {item.quantity} × {formatToman(item.unitPriceSnapshotToman)} ت
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 bg-[#1B222C] text-white rounded flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs font-mono">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 bg-[#1B222C] text-white rounded flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#293444] space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-[#9EACB8]">مبلغ کل قابل پرداخت:</span>
                <div>
                  <span className="text-lg font-black text-[#D71921] num-heavy">
                    {formatToman(netTotalToman)}
                  </span>
                  <span className="text-xs text-[#9EACB8] mr-1">تومان</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleStartCheckout();
                }}
                className="w-full bg-[#D71921] text-white py-3 rounded-lg font-bold shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)] cursor-pointer"
              >
                ثبت فاکتور و پرداخت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODIFIER MODAL ================= */}
      <ModifierModal
        item={modifierItem}
        isOpen={isModifierOpen}
        onClose={() => setIsModifierOpen(false)}
        onConfirm={handleAddWithModifiers}
      />

      {/* ================= LIQUID GLASS PAYMENT SHEET ================= */}
      <LiquidGlassPaymentSheet
        isOpen={isCheckoutOpen}
        totalBalanceToman={netTotalToman}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirm={handleConfirmSettlement}
        tableOrCustomerLabel={orderType === 'DINE_IN' ? tableLabel : customerName || 'مشتری بیرون‌بر'}
      />

      {/* ================= OPEN TABS MODAL ================= */}
      <OpenTabsModal
        isOpen={isOpenTabsModalOpen}
        onClose={() => {
          setIsOpenTabsModalOpen(false);
          setOpenTabsCount(CatalogService.getOpenTabs().length);
        }}
        onRecallTab={handleRecallTabForEditing}
        activeTabId={activeTabId}
      />

      {/* ================= COMPLETED RECEIPT PREVIEW MODAL ================= */}
      {completedReceiptOrder && (
        <div className="relative">
          {/* Hardware Direct Thermal Print Bar (WebUSB & Bluetooth) */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0F223D] border border-[#D71921]/60 rounded-2xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs w-full max-w-xl animate-fadeIn">
            <div className="flex items-center gap-2 text-white">
              <Printer className="w-4 h-4 text-[#F3E9DD]" />
              <span className="font-bold">چاپ مستقیم حرارتی ۸۰ میلی‌متری (ESC/POS Raster):</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleHardwarePrint('USB')}
                className="px-2.5 py-1.5 rounded-lg bg-[#1B222C] hover:bg-[#222B38] border border-[#293444] text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="اتصال مستقیم بدون درایور از طریق WebUSB"
              >
                <Usb className="w-3.5 h-3.5 text-blue-400" />
                <span>WebUSB</span>
              </button>

              <button
                onClick={() => handleHardwarePrint('BLUETOOTH')}
                className="px-2.5 py-1.5 rounded-lg bg-[#1B222C] hover:bg-[#222B38] border border-[#293444] text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="اتصال مستقیم بدون درایور از طریق بلوتوث"
              >
                <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
                <span>بلوتوث</span>
              </button>
            </div>

            {hardwarePrintStatus && (
              <div className="w-full text-center text-[11px] text-[#F3E9DD] bg-[#121417] border border-[#293444] rounded p-1">
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

      {/* Table Requirement Toast */}
      {tableToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#842029] text-white border border-red-500/50 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-300" />
          <span>{tableToast}</span>
        </div>
      )}

      {/* Visual Table Picker Modal */}
      <TablePickerModal
        isOpen={isTablePickerOpen}
        onClose={() => setIsTablePickerOpen(false)}
        onSelectTable={(selectedTbl) => {
          setTableLabel(selectedTbl);
          setOrderType('DINE_IN');
        }}
      />
    </div>
  );
};
