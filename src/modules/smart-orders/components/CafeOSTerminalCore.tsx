import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  Coffee,
  Flame,
  Utensils,
  Sparkles,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Plus,
  Minus,
  Trash2,
  Percent,
  CreditCard,
  Banknote,
  Send,
  Wifi,
  WifiOff,
  HelpCircle,
  LayoutGrid,
  Check,
  TrendingUp,
  Receipt,
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  Printer,
  ShieldAlert,
  Boxes,
} from 'lucide-react';
import { MenuItem, SmartTicket, ModifierOption } from '../types';
import { formatToman } from '../utils/farsiFormatting';
import { MotionConfig } from '../utils/zeroGMotionTokens';
import { playCartBurst, playPosBeep } from '../../../services/soundEffects';
import { ModifierRailFlyout } from './ModifierRailFlyout';
import { openTabService, DEFAULT_TABLES } from '../../../services/openTabService';
import { inventoryBomService } from '../../../services/inventoryBomService';
import { TabSettlementModal } from '../../../components/TabSettlementModal';
import { TableSessionTab, TabCartItem } from '../../../types/inventory-tab';
import { printThermalReceipt } from '../../../services/receiptPrinter';
import { StationRouter } from '../../../services/StationRouter';
import { thermalPrinterDriver } from '../../../services/ThermalPrinterDriver';
import { DispatchActionBar, playDispatchTicketAudio } from '../../../components/DispatchActionBar';

export interface CafeOSTerminalCoreProps {
  catalog: MenuItem[];
  tickets: SmartTicket[];
  activeTicketId: string;
  onSelectTicket: (ticketId: string) => void;
  onInjectItem: (item: MenuItem, modifiers?: ModifierOption[], notes?: string) => void;
  onPushToExecution: () => void;
  onAdvanceStatus: (ticketId: string) => void;
  onParkToggle?: (ticketId: string) => void;
  onSplitOrder?: (ticketId: string) => void;
  onUpdateItemQuantity: (ticketId: string, itemId: string, delta: number) => void;
  onRemoveItem: (ticketId: string, itemId: string) => void;
  onChangeTableLabel: (ticketId: string, tableLabel: string) => void;
  onApplyDiscount: (ticketId: string, discountToman: number) => void;
  onSettleOrder: (ticketId: string, method: 'CARD' | 'CASH') => void;
  simulateNetworkFailure: boolean;
  onToggleNetworkFailure: () => void;
  onBackToStandardPos?: () => void;
  viewMode?: 'terminal-core' | 'live-buffer';
  onToggleViewMode?: () => void;
}

export const CafeOSTerminalCore: React.FC<CafeOSTerminalCoreProps> = ({
  catalog,
  tickets,
  activeTicketId,
  onSelectTicket,
  onInjectItem,
  onPushToExecution,
  onAdvanceStatus,
  onParkToggle,
  onSplitOrder,
  onUpdateItemQuantity,
  onRemoveItem,
  onChangeTableLabel,
  onApplyDiscount,
  onSettleOrder,
  simulateNetworkFailure,
  onToggleNetworkFailure,
  onBackToStandardPos,
  viewMode,
  onToggleViewMode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFloorMapActive, setIsFloorMapActive] = useState<boolean>(false);
  const [flyoutItem, setFlyoutItem] = useState<MenuItem | null>(null);
  const [pendingModifiers, setPendingModifiers] = useState<ModifierOption[]>([]);
  const [pendingNotes, setPendingNotes] = useState<string>('');
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);
  const [activeAlertMessage, setActiveAlertMessage] = useState<string | null>(null);

  // Table Tabs & Inventory BOM Subscriptions
  const [allTabs, setAllTabs] = useState<TableSessionTab[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('t2'); // Defaults to Table 2 (Active demo)
  const [settlementModalTab, setSettlementModalTab] = useState<TableSessionTab | null>(null);

  // Draft items for the current active table round
  const [draftRoundItems, setDraftRoundItems] = useState<TabCartItem[]>([]);

  // Subscribe to OpenTabService
  useEffect(() => {
    const unsub = openTabService.subscribe((tabs) => {
      setAllTabs(tabs);
    });
    return () => unsub();
  }, []);

  // Subscribe to InventoryBomService
  useEffect(() => {
    const unsub = inventoryBomService.subscribe(() => {
      // Re-triggers stock evaluation reactively
      setAllTabs((curr) => [...curr]);
    });
    return () => unsub();
  }, []);

  // Active open tab for currently selected table
  const currentTableTab = useMemo(() => {
    return allTabs.find(
      (t) =>
        t.status !== 'settled' &&
        (t.table_id === selectedTableId || t.table_label === selectedTableId)
    );
  }, [allTabs, selectedTableId]);

  const matchedTablePreset = useMemo(() => {
    return (
      DEFAULT_TABLES.find((t) => t.id === selectedTableId || t.label === selectedTableId) ||
      DEFAULT_TABLES[0]
    );
  }, [selectedTableId]);

  // Extract categories for rail
  const categories = [
    { id: 'ALL', labelFa: 'همه', labelEn: 'ALL', icon: Layers },
    { id: 'cat-espresso', labelFa: 'اسپرسو', labelEn: 'ESPR', icon: Coffee },
    { id: 'cat-brew', labelFa: 'دمی', labelEn: 'BREW', icon: Flame },
    { id: 'cat-bakery', labelFa: 'بیکری', labelEn: 'BAKE', icon: Utensils },
    { id: 'cat-cold', labelFa: 'سرد', labelEn: 'COLD', icon: Sparkles },
  ];

  const activeTickets = tickets.filter((t) => t.status !== 'Dispatched');
  const activeTicket = tickets.find((t) => t.id === activeTicketId) || activeTickets[0];
  const isDraft = activeTicket?.status === 'Draft';

  // Calculate total due for active table
  const activeTabSubtotal = useMemo(() => {
    const pastRoundsTotal =
      currentTableTab?.rounds.reduce(
        (sum, r) => sum + r.items.reduce((s, it) => s + it.subtotal, 0),
        0
      ) || 0;
    const currentDraftTotal = draftRoundItems.reduce((s, it) => s + it.subtotal, 0);
    return pastRoundsTotal + currentDraftTotal;
  }, [currentTableTab, draftRoundItems]);

  const activeTabDiscount = currentTableTab?.discount || 0;
  const activeTabTotalDue = Math.max(0, activeTabSubtotal - activeTabDiscount);

  // Filter items
  const filteredItems = catalog.filter((item) => {
    const matchesCat =
      selectedCategory === 'ALL' ||
      item.categoryId === selectedCategory ||
      item.categoryNameFa?.includes(selectedCategory);
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.titleEn && item.titleEn.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  const handleOpenFlyout = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setFlyoutItem(item);
    setPendingModifiers([]);
    setPendingNotes('');
  };

  const handleToggleModifier = (mod: ModifierOption) => {
    setPendingModifiers((prev) =>
      prev.some((m) => m.id === mod.id)
        ? prev.filter((m) => m.id !== mod.id)
        : [...prev, mod]
    );
  };

  const handleConfirmFlyout = () => {
    if (flyoutItem) {
      addItemToActiveRound(flyoutItem, pendingModifiers, pendingNotes);
      setFlyoutItem(null);
    }
  };

  // Add Item to current table's draft round with BOM stock check
  const addItemToActiveRound = (
    item: MenuItem,
    modifiers: ModifierOption[] = [],
    notes: string = ''
  ) => {
    // 1. Evaluate BOM stock
    const bomStock = inventoryBomService.evaluateMenuItemStock(item.id);
    if (!item.isAvailable || (item.currentStock !== undefined && item.currentStock <= 0) || bomStock.isOutOfStock) {
      playPosBeep('delete');
      const limitTitle = bomStock.limitingIngredients[0]?.titleFa || 'مواد اولیه';
      setActiveAlertMessage(`اتمام موجودی ماده خام (${limitTitle})! سفارش این آیتم مسدود شد.`);
      setTimeout(() => setActiveAlertMessage(null), 3500);
      return;
    }

    playCartBurst(800);

    const modsDelta = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const itemSubtotal = item.price + modsDelta;

    const newItem: TabCartItem = {
      id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: item.id,
      title: item.title,
      quantity: 1,
      unitPrice: item.price,
      station: item.station || StationRouter.resolveStation({ id: item.id, title: item.title, categoryId: item.categoryId, quantity: 1 }),
      status: 'PENDING_DISPATCH',
      modifiers: modifiers.map((m) => ({
        id: m.id,
        nameFa: m.nameFa,
        priceDelta: m.priceDelta,
      })),
      subtotal: itemSubtotal,
      notes: notes || undefined,
    };

    setDraftRoundItems((prev) => [...prev, newItem]);

    // Also mirror into zero-g ticket if present
    onInjectItem(item, modifiers, notes);
  };

  const handleDraftQtyDelta = (itemId: string, delta: number) => {
    setDraftRoundItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const newQty = Math.max(1, it.quantity + delta);
          const modsDelta = it.modifiers?.reduce((acc, m) => acc + m.priceDelta, 0) || 0;
          return {
            ...it,
            quantity: newQty,
            subtotal: (it.unitPrice + modsDelta) * newQty,
          };
        }
        return it;
      })
    );
    playCartBurst(delta > 0 ? 800 : 400);
  };

  const handleRemoveDraftItem = (itemId: string) => {
    setDraftRoundItems((prev) => prev.filter((it) => it.id !== itemId));
    playCartBurst(400);
  };

  // Dispatch Round to Kitchen/Bar with atomic BOM deduction & Dual Thermal Print
  const handleDispatchRound = async () => {
    if (draftRoundItems.length === 0) {
      playPosBeep('delete');
      setActiveAlertMessage('ابتدا حداقل یک آیتم به پیش‌نویس این دور اضافه کنید.');
      setTimeout(() => setActiveAlertMessage(null), 3000);
      return;
    }

    const previousDispatchedIds = currentTableTab
      ? currentTableTab.rounds.flatMap((r) => r.items.map((i) => i.id))
      : [];

    const splitResult = StationRouter.splitTicket(
      draftRoundItems,
      previousDispatchedIds,
      {
        ticketId: currentTableTab ? currentTableTab.tab_id.slice(-6) : `T-${Date.now() % 1000}`,
        tableLabel: matchedTablePreset.label,
        cashierName: currentTableTab?.server_name || 'سارا رضایی',
      }
    );

    // 1. Play dual-tone acoustic ticket feedback [660, 880] Hz, 120ms
    playDispatchTicketAudio();

    // 2. Dispatch to thermal hardware drivers (WebSerial -> Raw TCP -> Headless Iframe)
    try {
      await thermalPrinterDriver.printBothStations(splitResult);
    } catch (e) {
      console.warn('[CafeOSTerminalCore] Thermal printer dispatch warning:', e);
    }

    // 3. Update table session tab without closing table bill
    if (currentTableTab) {
      openTabService.addRoundToTab(currentTableTab.tab_id, draftRoundItems, true);
    } else {
      openTabService.openTab(
        matchedTablePreset.id,
        matchedTablePreset.label,
        'سارا رضایی',
        matchedTablePreset.capacity,
        draftRoundItems
      );
    }

    setDraftRoundItems([]);
    onPushToExecution();
    playPosBeep('success');
  };

  // Request bill (active_open_tab -> awaiting_checkout)
  const handleRequestBill = () => {
    if (!currentTableTab) return;
    openTabService.requestBill(currentTableTab.tab_id);

    // Print proforma receipt
    try {
      const allItems = currentTableTab.rounds.flatMap((r) => r.items);
      printThermalReceipt({
        invoiceNo: parseInt(currentTableTab.tab_id.replace(/\D/g, '').slice(-4), 10) || 101,
        dateTime: new Date().toISOString(),
        orderType: 'پیش‌فاکتور سالن',
        cashier: currentTableTab.server_name,
        customerName: `مهمان ${currentTableTab.table_label}`,
        tableLabel: currentTableTab.table_label,
        items: allItems.map((it) => ({
          name: it.title,
          qty: it.quantity,
          price: it.unitPrice,
          modifiers: it.modifiers?.map((m) => m.nameFa),
          notes: it.notes,
        })),
        subtotalAmount: currentTableTab.subtotal,
        discountAmount: currentTableTab.discount,
        totalAmount: currentTableTab.total_due,
        paymentMethod: 'صورتحساب موقت جهت بررسی مشتری',
      });
    } catch (e) {
      console.warn('Proforma print error', e);
    }
  };

  // Settle and close tab (awaiting_checkout -> idle_empty)
  const handleCompleteSettlement = (paymentData: {
    paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
    terminalName: string;
    referenceCode?: string;
    cashTendered?: number;
    splitCount?: number;
  }) => {
    if (!settlementModalTab) return;
    openTabService.settleTab(settlementModalTab.tab_id, paymentData);
    setSettlementModalTab(null);
    setDraftRoundItems([]);
  };

  // Elapsed stay timer string
  const formatStayDuration = (openedAtISO: string) => {
    const elapsedMs = Math.max(0, Date.now() - new Date(openedAtISO).getTime());
    const mins = Math.floor(elapsedMs / 60000);
    if (mins < 60) return `${mins} دقیقه`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}س و ${remMins}د`;
  };

  return (
    <div
      dir="rtl"
      className="flex h-screen w-full overflow-hidden bg-[#0D0F12] text-slate-100 font-sans select-none relative"
      style={{ fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)" }}
    >
      {/* Toast Alert Banner */}
      {activeAlertMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#151B25] border border-rose-600/70 text-rose-300 font-bold px-4 py-2.5 rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-fadeIn">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>{activeAlertMessage}</span>
        </div>
      )}

      {/* =========================================================================
          COLUMN 1: w-20 Category & Navigation Rail (80px fixed width)
          ========================================================================= */}
      <aside className="w-20 shrink-0 h-full bg-[#0D0F12] border-l border-white/[0.08] flex flex-col justify-between items-center py-3 select-none z-20">
        {/* Top: Terminal Badge */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#161A1F] border border-white/[0.08] flex items-center justify-center relative">
            <span className="w-2 h-2 rounded-full bg-[#D71921] absolute top-1.5 right-1.5 shadow-[0_0_6px_#D71921]"></span>
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <span className="font-mono text-[9px] font-bold text-[#9EACB8] tracking-wider">&lt;1ms</span>
        </div>

        {/* Middle: Category Switchers with 4px/8px rhythm */}
        <nav className="flex-1 w-full px-2 flex flex-col gap-2 justify-center">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id && !isFloorMapActive;
            return (
              <motion.button
                key={cat.id}
                type="button"
                whileTap={MotionConfig.tactileTap}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setIsFloorMapActive(false);
                }}
                className={`w-full h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors duration-120 cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#161A1F] text-white border border-[#D71921] shadow-xs'
                    : 'text-[#9EACB8] hover:text-white hover:bg-[#161A1F]/60 border border-transparent'
                }`}
                title={cat.labelFa}
              >
                {isSelected && (
                  <span className="absolute right-0 top-2 bottom-2 w-1 bg-[#D71921] rounded-l-full"></span>
                )}
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-bold leading-none">{cat.labelFa}</span>
              </motion.button>
            );
          })}

          <div className="h-[1px] bg-white/[0.08] my-1 mx-2"></div>

          {/* Interactive Floor-Map Toggle */}
          <motion.button
            type="button"
            whileTap={MotionConfig.tactileTap}
            onClick={() => setIsFloorMapActive((prev) => !prev)}
            className={`w-full h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors duration-120 cursor-pointer relative ${
              isFloorMapActive
                ? 'bg-[#D71921] text-white border border-[#D71921] shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)]'
                : 'text-[#9EACB8] hover:text-white hover:bg-[#161A1F]/60 border border-transparent'
            }`}
            title="نقشه و وضعیت میزهای سالن (Open Tabs)"
          >
            {isFloorMapActive ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <MapPin className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-[9px] font-bold leading-none">
              {isFloorMapActive ? 'منو اقلام' : 'میزها'}
            </span>
          </motion.button>
        </nav>

        {/* Bottom Actions: Keyboard HUD & Network Toggle */}
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/[0.08] w-full px-2">
          <motion.button
            type="button"
            whileTap={MotionConfig.tactileTap}
            onClick={() => setShowKeyboardHelp(true)}
            className="w-10 h-10 rounded-xl bg-[#161A1F] border border-white/[0.08] text-[#9EACB8] hover:text-white flex items-center justify-center cursor-pointer"
            title="راهنمای کلیدها [?]"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
          </motion.button>

          <motion.button
            type="button"
            whileTap={MotionConfig.tactileTap}
            onClick={onToggleNetworkFailure}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
              simulateNetworkFailure
                ? 'bg-rose-950 border-rose-700 text-rose-300'
                : 'bg-[#161A1F] border-white/[0.08] text-emerald-400 hover:text-white'
            }`}
            title={simulateNetworkFailure ? 'شبکه قطع است (Rollback فعال)' : 'شبکه متصل است'}
          >
            {simulateNetworkFailure ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          </motion.button>
        </div>
      </aside>

      {/* =========================================================================
          COLUMN 2: flex-1 Product Catalog Grid or Floor-Map (Center Viewport)
          ========================================================================= */}
      <section className="flex-1 h-full flex flex-col justify-between overflow-hidden bg-[#0D0F12] border-l border-white/[0.08] z-10">
        {/* Top Header & Search Bar with Strict 4px/8px rhythm */}
        <header className="p-3 border-b border-white/[0.08] bg-[#0D0F12] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-2">
              <span>{isFloorMapActive ? 'نقشه و وضعیت استقرار سالن (Floor Map & Open Tabs)' : 'کاتالوگ و بار اسپشیالتی (Catalog)'}</span>
              {currentTableTab && (
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 px-2 py-0.5 rounded-full font-bold">
                  {currentTableTab.table_label}: حساب باز
                </span>
              )}
            </h1>
            <span className="keycap-badge px-2 py-0.5 text-[10px] text-cyan-300 border-cyan-500/30">
              کلیدهای ۱ تا ۹ فعال
            </span>
          </div>

          {/* Search Box */}
          {!isFloorMapActive && (
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#9EACB8] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی عنوان فارسی یا لاتین..."
                className="w-full bg-[#161A1F] border border-white/[0.08] rounded-xl pr-9 pl-7 py-1.5 text-xs text-white placeholder:text-[#9EACB8]/40 focus:outline-none focus:border-cyan-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#9EACB8] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {onToggleViewMode && (
              <button
                type="button"
                onClick={onToggleViewMode}
                className="text-xs text-cyan-300 hover:text-white bg-[#161A1F] border border-cyan-500/30 hover:border-cyan-500/60 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition active:scale-95 flex items-center gap-1.5"
                title="تغییر به نمای ۳ ستونه بافر زنده سفارشات"
              >
                <span>نمای صف زنده (Live Buffer)</span>
              </button>
            )}

            {onBackToStandardPos && (
              <button
                type="button"
                onClick={onBackToStandardPos}
                className="text-xs text-[#9EACB8] hover:text-white bg-[#161A1F] border border-white/[0.08] px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition active:scale-95"
              >
                صندوق کلاسیک
              </button>
            )}
          </div>
        </header>

        {/* Viewport Content: Floor Map OR Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isFloorMapActive ? (
            /* =========================================================================
               Interactive Floor Map with Open Tab State Machine
               ========================================================================= */
            <div className="space-y-4">
              <div className="bg-[#151B25] border border-[#232D3E] p-3 rounded-2xl flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">
                  راهنمای وضعیت میزها:
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[#9EACB8]">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span>آزاد (خالی)</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                    <span>مشغول / حساب باز</span>
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                    <span>در انتظار تسویه (صورتحساب)</span>
                  </span>
                  <span className="flex items-center gap-1 text-sky-400">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                    <span>رزرو شده</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {DEFAULT_TABLES.map((tbl) => {
                  const state = openTabService.getTableLifecycleState(tbl.id);
                  const activeTab = openTabService.getTabForTable(tbl.id);
                  const isSelected = selectedTableId === tbl.id;

                  return (
                    <motion.div
                      key={tbl.id}
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => {
                        setSelectedTableId(tbl.id);
                        onChangeTableLabel(activeTicketId, tbl.label);
                        playPosBeep('click');
                      }}
                      className={`p-4 rounded-2xl border transition-all duration-120 cursor-pointer flex flex-col justify-between min-h-[155px] relative ${
                        isSelected
                          ? 'ring-2 ring-[#D71921] bg-[#161A1F] border-[#D71921] shadow-[0_0_20px_-2px_rgba(215,25,33,0.5)]'
                          : state === 'active_open_tab'
                          ? 'bg-[#161A1F] border-[#10B981]/50 shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]'
                          : state === 'awaiting_checkout'
                          ? 'bg-[#161A1F] border-[#F59E0B]/60 shadow-[0_0_15px_-2px_rgba(245,158,11,0.4)]'
                          : state === 'reserved'
                          ? 'bg-[#161A1F] border-[#3B82F6]/50'
                          : 'bg-[#161A1F] border-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      {/* Top Row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-black text-sm text-white block">{tbl.label}</span>
                          <span className="text-[11px] text-[#9EACB8]">{tbl.zone}</span>
                        </div>

                        {/* Lifecycle Status Pill */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            state === 'active_open_tab'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-600/60'
                              : state === 'awaiting_checkout'
                              ? 'bg-amber-950 text-amber-300 border-amber-600/60'
                              : state === 'reserved'
                              ? 'bg-sky-950 text-sky-300 border-sky-600/60'
                              : 'bg-slate-900 text-[#9EACB8] border-white/10'
                          }`}
                        >
                          {state === 'active_open_tab'
                            ? 'مشغول (حساب باز)'
                            : state === 'awaiting_checkout'
                            ? 'در انتظار تسویه'
                            : state === 'reserved'
                            ? 'رزرو'
                            : 'آزاد'}
                        </span>
                      </div>

                      {/* Middle: Active Tab Details */}
                      {activeTab && (
                        <div className="my-2 p-2 bg-[#0D0F12] rounded-xl border border-white/[0.06] text-[11px] space-y-1">
                          <div className="flex justify-between text-[#9EACB8]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              <span>{formatStayDuration(activeTab.opened_at)}</span>
                            </span>
                            <span className="font-bold text-amber-400">
                              {activeTab.rounds.length} دور سفارش
                            </span>
                          </div>
                          <div className="flex justify-between text-white font-mono font-bold">
                            <span>مبلغ حساب:</span>
                            <bdi dir="ltr">{formatToman(activeTab.total_due)}</bdi>
                          </div>
                        </div>
                      )}

                      {/* Bottom Row */}
                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                        <span className="text-[#9EACB8] text-[11px]">ظرفیت: {tbl.capacity} نفر</span>

                        <div className="flex items-center gap-1">
                          {activeTab ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettlementModalTab(activeTab);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#D71921] hover:bg-[#b8141b] text-white text-[10px] font-bold"
                            >
                              تسویه
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTabService.toggleTableReservation(tbl.id);
                              }}
                              className="text-[10px] text-sky-400 hover:underline"
                            >
                              {state === 'reserved' ? 'لغو رزرو' : 'رزرو'}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* =========================================================================
               Product Catalog Grid (With Real-Time BOM Ingredient Stocks)
               ========================================================================= */
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map((item, idx) => {
                const hotkeyNum = item.hotkeyIndex || (idx < 9 ? idx + 1 : undefined);
                const bomStatus = inventoryBomService.evaluateMenuItemStock(item.id);
                const isOutOfStock =
                  !item.isAvailable ||
                  (item.currentStock !== undefined && item.currentStock <= 0) ||
                  bomStatus.isOutOfStock;
                const hasLowStock = bomStatus.hasLowStockIngredients && !isOutOfStock;

                return (
                  <motion.div
                    key={item.id}
                    whileTap={!isOutOfStock ? MotionConfig.tactileTap : undefined}
                    onClick={() => addItemToActiveRound(item)}
                    className={`group relative bg-[#161A1F] border rounded-2xl p-3 flex flex-col justify-between min-h-[115px] select-none cursor-pointer transition-all duration-120 ${
                      isOutOfStock
                        ? 'border-rose-900/40 opacity-40 pointer-events-none grayscale'
                        : hasLowStock
                        ? 'border-amber-600/40 hover:border-amber-500'
                        : 'border-white/[0.08] hover:-translate-y-0.5 hover:border-white/20'
                    }`}
                  >
                    {/* Top Row: Dual-label typography (Persian & English) & Keycap */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <span className="font-extrabold text-xs text-slate-100 group-hover:text-white line-clamp-1 block leading-tight">
                          {item.title}
                        </span>
                        {item.titleEn && (
                          <span className="font-sans text-[10px] text-[#9EACB8] tracking-tight block truncate mt-0.5">
                            {item.titleEn}
                          </span>
                        )}
                      </div>

                      {hotkeyNum && hotkeyNum <= 9 && (
                        <span className="keycap-badge shrink-0 w-6 h-6 text-[11px] border-cyan-500/30 group-hover:border-cyan-400 group-hover:text-cyan-300">
                          {hotkeyNum}
                        </span>
                      )}
                    </div>

                    {/* BOM Stock status badges */}
                    {isOutOfStock ? (
                      <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700/60 px-1.5 py-0.5 rounded w-max font-bold mt-1">
                        اتمام موجودی مواد خام
                      </span>
                    ) : hasLowStock ? (
                      <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-600/50 px-1.5 py-0.5 rounded w-max font-bold mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                        <span>کسری مواد اولیه</span>
                      </span>
                    ) : null}

                    {/* Bottom Row: Tabular Monospace Price & Contextual Modifiers */}
                    <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-white/[0.06]">
                      <span className="font-mono text-xs font-bold text-[#F3E9DD] tabular-nums num-heavy">
                        {formatToman(item.price)}
                      </span>

                      {!isOutOfStock && (
                        <motion.button
                          type="button"
                          whileTap={MotionConfig.tactileTap}
                          onClick={(e) => handleOpenFlyout(e, item)}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D71921] text-[#9EACB8] hover:text-white border border-white/[0.06] hover:border-[#D71921] transition-colors"
                          title="افزودنی‌ها و شخصی‌سازی (Modifiers)"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          COLUMN 3: w-[380px] Live Ledger & Open Tabs Session Manager (380px)
          ========================================================================= */}
      <aside className="w-[380px] shrink-0 h-full flex flex-col justify-between bg-[#0D0F12] border-r border-white/[0.08] select-none z-20">
        {/* Ledger Header & Table Info */}
        <header className="p-3.5 border-b border-white/[0.08] bg-[#0D0F12] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#D71921] text-white">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-white tracking-tight">حساب باز میز (Open Tab Ledger)</h2>
                <p className="text-[10px] text-[#9EACB8]">
                  {matchedTablePreset.label} • {matchedTablePreset.zone}
                </p>
              </div>
            </div>

            {currentTableTab ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                currentTableTab.status === 'printed'
                  ? 'bg-amber-950 text-amber-300 border-amber-600/60'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-600/60'
              }`}>
                {currentTableTab.status === 'printed' ? 'درخواست صورتحساب' : 'حساب فعال'}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#161A1F] text-[#9EACB8] border border-white/10">
                پیش‌نویس اولیه
              </span>
            )}
          </div>

          {/* Active Session Info Pill */}
          {currentTableTab && (
            <div className="p-2 bg-[#161A1F] border border-white/[0.08] rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-200">{currentTableTab.server_name} ({currentTableTab.guest_count} نفر)</span>
              </div>
              <div className="flex items-center gap-1 text-[#9EACB8] font-mono text-[11px]">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{formatStayDuration(currentTableTab.opened_at)}</span>
              </div>
            </div>
          )}
        </header>

        {/* Middle: Open Tab Ledger Body with Rounds breakdown */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* SECTION A: Dispatched Rounds on Active Tab */}
          {currentTableTab && currentTableTab.rounds.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>سفارش‌های ثبت‌شده و تحویل‌شده در این میز:</span>
              </span>

              {currentTableTab.rounds.map((round) => (
                <div
                  key={round.round_number}
                  className="bg-[#161A1F] border border-white/[0.08] rounded-xl p-2.5 space-y-1.5 text-xs"
                >
                  <div className="flex justify-between items-center text-[10px] text-[#9EACB8] pb-1 border-b border-white/[0.06]">
                    <span className="font-bold text-white">دور {round.round_number}</span>
                    <span className="text-emerald-400">
                      {round.inventory_deducted ? '✓ کسر از انبار (BOM)' : 'در صف آماده‌سازی'}
                    </span>
                  </div>

                  {round.items.map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-slate-200">
                      <div>
                        <span>{it.quantity}× {it.title}</span>
                        {it.modifiers && it.modifiers.length > 0 && (
                          <span className="text-[10px] text-[#9EACB8] mr-1">
                            ({it.modifiers.map((m) => m.nameFa).join('، ')})
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-300">{formatToman(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* SECTION B: Current Draft Items (New Round) */}
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            <span className="text-[11px] font-black text-cyan-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {currentTableTab ? 'دور جدید سفارش (افزودن به همین میز):' : 'اقلام سفارش اولیه:'}
              </span>
            </span>

            {draftRoundItems.length > 0 ? (
              <AnimatePresence>
                {draftRoundItems.map((it) => (
                  <motion.div
                    key={it.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={MotionConfig.ticketItemSpring}
                    className="bg-[#161A1F] border border-cyan-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-100 block truncate">{it.title}</span>
                      {it.modifiers && it.modifiers.length > 0 && (
                        <span className="text-[10px] text-[#9EACB8] block truncate">
                          {it.modifiers.map((m) => m.nameFa).join('، ')}
                        </span>
                      )}
                      {it.notes && (
                        <span className="text-[10px] text-amber-400/90 italic block truncate">
                          *{it.notes}
                        </span>
                      )}
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1 bg-[#0D0F12] p-0.5 rounded-lg border border-white/[0.08]">
                      <motion.button
                        type="button"
                        whileTap={MotionConfig.tactileTap}
                        onClick={() => {
                          if (it.quantity > 1) {
                            handleDraftQtyDelta(it.id, -1);
                          } else {
                            handleRemoveDraftItem(it.id);
                          }
                        }}
                        className="p-1 rounded text-[#9EACB8] hover:text-white"
                      >
                        {it.quantity > 1 ? <Minus className="w-3 h-3" /> : <Trash2 className="w-3 h-3 text-rose-400" />}
                      </motion.button>
                      <span className="font-mono text-xs font-bold text-white px-1 tabular-nums">{it.quantity}</span>
                      <motion.button
                        type="button"
                        whileTap={MotionConfig.tactileTap}
                        onClick={() => handleDraftQtyDelta(it.id, 1)}
                        className="p-1 rounded text-[#9EACB8] hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </motion.button>
                    </div>

                    <span className="font-mono text-xs font-bold text-[#F3E9DD] tabular-nums shrink-0">
                      {formatToman(it.subtotal)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="text-center py-6 text-[#9EACB8] text-xs space-y-1">
                <Receipt className="w-6 h-6 mx-auto text-[#526071]" />
                <p className="font-bold text-[11px]">پیش‌نویس این دور خالی است</p>
                <p className="text-[10px] text-[#526071]">برای افزودن آیتم جدید به این میز، روی اقلام منو کلیک کنید</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Price Calculations, Discounts, and Action Buttons */}
        <footer className="p-3.5 border-t border-white/[0.08] bg-[#0D0F12] space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[#9EACB8]">
              <span>جمع کل سفارشات میز:</span>
              <span className="font-mono tabular-nums">{formatToman(activeTabSubtotal)}</span>
            </div>

            {activeTabDiscount > 0 && (
              <div className="flex justify-between text-rose-400 font-bold">
                <span>تخفیف:</span>
                <span className="font-mono tabular-nums">-{formatToman(activeTabDiscount)}</span>
              </div>
            )}

            {/* Net Total Due */}
            <div className="flex justify-between text-white font-black text-sm pt-2 border-t border-white/[0.08]">
              <span>مبلغ قابل پرداخت میز:</span>
              <span className="font-mono text-[#D71921] text-base font-black tabular-nums">
                {formatToman(activeTabTotalDue)}
              </span>
            </div>

            {/* Open Tab Stage 2 Actions: Request Bill & Settle */}
            {currentTableTab && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <motion.button
                  type="button"
                  whileTap={MotionConfig.tactileTap}
                  onClick={handleRequestBill}
                  className="py-2 rounded-xl bg-[#161A1F] border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-950/40"
                  title="صدور پیش‌فاکتور و تغییر وضعیت میز به در انتظار تسویه"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>درخواست صورتحساب</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={MotionConfig.tactileTap}
                  onClick={() => setSettlementModalTab(currentTableTab)}
                  disabled={activeTabTotalDue <= 0}
                  className="py-2 rounded-xl bg-emerald-950/80 border border-emerald-600/60 text-emerald-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-800 disabled:opacity-40"
                  title="تسویه نهایی میز (کارتخوان / نقدی / دونگی) و آزادسازی میز"
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تسویه و بستن میز</span>
                </motion.button>
              </div>
            )}
          </div>

          {/* Dual Thermal & KDS Dispatch Action Bar */}
          <DispatchActionBar
            items={draftRoundItems}
            alreadyDispatchedIds={
              currentTableTab
                ? currentTableTab.rounds.flatMap((r) => r.items.map((i) => i.id))
                : []
            }
            tableLabel={matchedTablePreset.label}
            ticketId={
              currentTableTab
                ? currentTableTab.tab_id.slice(-6)
                : `T-${Date.now() % 1000}`
            }
            orderNumber={
              currentTableTab
                ? parseInt(currentTableTab.tab_id.replace(/\D/g, '').slice(-4), 10) || 101
                : 101
            }
            cashierName={currentTableTab?.server_name || 'سارا رضایی'}
            disabled={draftRoundItems.length === 0}
            onDispatchComplete={() => {
              handleDispatchRound();
            }}
          />
        </footer>
      </aside>

      {/* Headless Iframe Staging Container for Thermal Printer Fallback */}
      <div id="thermal-receipt-staging" style={{ display: 'none' }} aria-hidden="true" />

      {/* =========================================================================
          Contextual Modifier Drawer
          ========================================================================= */}
      <ModifierRailFlyout
        isOpen={flyoutItem !== null}
        item={flyoutItem}
        selectedModifiers={pendingModifiers}
        notes={pendingNotes}
        onToggleModifier={handleToggleModifier}
        onChangeNotes={setPendingNotes}
        onConfirm={handleConfirmFlyout}
        onClose={() => setFlyoutItem(null)}
      />

      {/* =========================================================================
          Settlement Modal (Split Check, Print Receipt, Free Table)
          ========================================================================= */}
      <TabSettlementModal
        isOpen={settlementModalTab !== null}
        tab={settlementModalTab}
        onClose={() => setSettlementModalTab(null)}
        onConfirmSettlement={handleCompleteSettlement}
      />

      {/* Keyboard Shortcuts HUD Modal */}
      {showKeyboardHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fadeIn select-none"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            className="w-full max-w-md bg-[#161A1F] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-sm font-extrabold text-white">راهنمای کلیدهای میانبر (Terminal HUD)</h3>
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1 rounded text-[#9EACB8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded bg-[#0D0F12] border border-white/[0.06]">
                <span>تزریق سریع اقلام منو:</span>
                <span className="keycap-badge px-2 py-0.5 text-cyan-300">۱ تا ۹</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#0D0F12] border border-white/[0.06]">
                <span>ثبت و ارسال دور جدید:</span>
                <span className="keycap-badge px-2 py-0.5 text-rose-300">Ctrl + Enter</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#0D0F12] border border-white/[0.06]">
                <span>بستن پنجره‌ها:</span>
                <span className="keycap-badge px-2 py-0.5 text-white">Esc</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CafeOSTerminalCore;
