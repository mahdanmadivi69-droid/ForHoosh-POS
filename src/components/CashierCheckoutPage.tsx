import { printThermalReceipt } from '../services/receiptPrinter';
import React, { useEffect, useState, useMemo } from 'react';
import { SegmentGroup, Dialog, Portal } from '@ark-ui/react';
import { OfflineSyncQueue } from './offline-sync-queue';
import { OrderDomainService, toToman, OrderAggregate } from './order-domain';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Zap,
  Printer,
  CheckCircle,
  Coffee,
  CreditCard,
  Banknote,
  Clock,
  Sparkles,
  X,
  Eye,
  Gamepad2,
  ShoppingBag,
  Store,
  UserCheck,
  Users,
} from 'lucide-react';
import { formatToman } from '../services/financialMath';
import { baristaDispatcher } from '../services/baristaDispatcher';
import {
  getTenantOperationalConfig,
  TenantOperationalConfig,
  OperationalMode,
  VenueZoneConfig,
  VenueTableDef,
} from '../types/tenant-config';

const syncQueue = new OfflineSyncQueue({
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  maxRetries: 3,
});

export interface CashierCheckoutPageProps {
  tenantId?: string;
  tenantName?: string;
  config?: TenantOperationalConfig;
  onOrderProcessed?: (order: OrderAggregate) => void;
}

export interface FastCheckoutOptions {
  activeCart?: any;
  orderTypeOverride?: 'DINE_IN' | 'TAKEAWAY';
  takeawayBillingMode?: 'INSTANT_PAY' | 'OPEN_TAB_REGULAR';
  customerName?: string;
  customerPhone?: string;
  tableLabelOverride?: string;
  actionOverride?: 'ADD_TO_TAB' | 'SETTLE_TAB';
}

export function CashierCheckoutPage({
  tenantId = 'tenant-modendo-01',
  tenantName = 'کافه بردگیم و گیمینگ مودندو',
  config,
  onOrderProcessed,
}: CashierCheckoutPageProps) {
  const tenantConfig = config || getTenantOperationalConfig(tenantId);
  const zones: VenueZoneConfig[] = tenantConfig.zones || [];

  const [queueCount, setQueueCount] = useState({ total: 0, pending: 0, failed: 0 });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastProcessedOrder, setLastProcessedOrder] = useState<OrderAggregate | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'POS_TERMINAL' | 'CASH' | 'CARD_MANUAL'>('POS_TERMINAL');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Order Type & Takeaway Flow State
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Zone & Table Layout State
  const [selectedZoneId, setSelectedZoneId] = useState<string>(() => zones[0]?.id || 'zone-default');
  const activeZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZoneId) || zones[0] || null;
  }, [zones, selectedZoneId]);

  const [selectedTable, setSelectedTable] = useState<string>(() => {
    if (activeZone && activeZone.tables.length > 0) {
      return activeZone.tables[0].label;
    }
    return tenantConfig.primaryMode === 'COUNTER_QUICK_PAY' ? 'پیشخوان / کانتر' : 'میز ۴ (سالن)';
  });

  const [orderRound, setOrderRound] = useState<number>(1);
  const [tableSessionId, setTableSessionId] = useState<string>(() => `sess-${Date.now().toString(36)}`);

  // Enforce Dine-in Pay-Later by default
  const defaultTabAction = tenantConfig.dineInPolicy?.enforcePayLaterByDefault ? 'ADD_TO_TAB' : 'SETTLE_TAB';
  const [tabAction, setTabAction] = useState<'ADD_TO_TAB' | 'SETTLE_TAB'>(defaultTabAction);

  useEffect(() => {
    syncQueue.init().then(updateCount);

    const interval = setInterval(updateCount, 5000);

    const handleOnline = () => {
      setIsOnline(true);
      updateCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function updateCount() {
    const counts = await syncQueue.getQueueCount();
    setQueueCount(counts);
  }

  async function triggerManualSync() {
    setIsSyncing(true);
    setActionNotice('در حال همگام‌سازی صف آفلاین...');
    try {
      await syncQueue.triggerSync();
      await updateCount();
      setActionNotice('همگام‌سازی با موفقیت انجام شد.');
    } catch (e: any) {
      setActionNotice(`خطا در همگام‌سازی: ${e?.message || 'عدم دسترسی به سرور'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setActionNotice(null), 3000);
    }
  }

  function handleZoneChange(zoneId: string) {
    setSelectedZoneId(zoneId);
    const z = zones.find((item) => item.id === zoneId);
    if (z && z.tables.length > 0) {
      setSelectedTable(z.tables[0].label);
    }
  }

  async function handleFastCheckout(opts?: FastCheckoutOptions) {
    const clientGeneratedId = crypto.randomUUID();
    const effectiveOrderType = opts?.orderTypeOverride || orderType;
    const isTakeaway = effectiveOrderType === 'TAKEAWAY';
    const takeawayMode = opts?.takeawayBillingMode || 'INSTANT_PAY';

    const tableLabelToUse = isTakeaway
      ? 'سفارش بیرون‌بر (Takeaway)'
      : opts?.tableLabelOverride || selectedTable;
    const tableNum = isTakeaway ? 'TAKEAWAY' : tableLabelToUse.replace(/[^0-9]/g, '') || '1';

    const custName =
      opts?.customerName ||
      customerName.trim() ||
      (isTakeaway
        ? takeawayMode === 'OPEN_TAB_REGULAR'
          ? 'مشتری ثابت بیرون‌بر'
          : 'مشتری بیرون‌بر'
        : tenantConfig.primaryMode === 'TAB_PAY_LATER'
        ? 'مشتری گیمینگ مودندو'
        : 'مشتری ۱۰۰هیچ');

    // Create Draft Order
    let order = OrderDomainService.createDraft({
      id: clientGeneratedId,
      tenantId: tenantId,
      clientGeneratedId,
      tableLabel: tableLabelToUse,
      customerName: custName,
      customerPhone: opts?.customerPhone || customerPhone.trim() || undefined,
      createdByUserId: 'cashier-fast',
      createdByUserName: 'صندوق‌دار شیفت',
      items: opts?.activeCart?.items || [
        {
          id: `item-${Date.now()}-1`,
          menuItemId: 'item-v60',
          itemNameSnapshot: 'قهوه دمی V60 کلمبیا گیشا',
          unitPriceSnapshotToman: toToman(145000),
          quantity: 1,
          modifiers: [
            { id: 'mod-extra-hot', nameFa: 'خیلی داغ', priceDeltaToman: 0, category: 'TEMPERATURE' },
          ],
          modifiersDeltaToman: 0,
          subtotalToman: toToman(145000),
        },
        {
          id: `item-${Date.now()}-2`,
          menuItemId: 'item-latte',
          itemNameSnapshot: 'کافه لاته با شیر جو دوسر',
          unitPriceSnapshotToman: toToman(95000),
          quantity: 1,
          modifiers: [
            { id: 'mod-oat-milk', nameFa: 'شیر جو دوسر (Oat Milk)', priceDeltaToman: 25000, category: 'MILK' },
          ],
          modifiersDeltaToman: 25000,
          subtotalToman: toToman(120000),
        },
      ],
    });

    // Populate operational metadata
    (order as any).flowType = isTakeaway ? 'COUNTER_QUICK_PAY' : tenantConfig.primaryMode;
    (order as any).orderType = effectiveOrderType;
    (order as any).tableSessionId = isTakeaway ? `takeaway-${Date.now().toString(36)}` : tableSessionId;
    (order as any).tableNumber = tableNum;
    (order as any).roundNumber = orderRound;

    // Transition to PLACED
    order = OrderDomainService.placeOrder(order);

    // FLOW A: Takeaway Open Tab for Regulars ("ثبت حساب باز بیرونبر (مشتری ثابت)")
    if (isTakeaway && takeawayMode === 'OPEN_TAB_REGULAR') {
      (order as any).takeawayBillingMode = 'OPEN_TAB_REGULAR';
      (order as any).isRegularCustomerTab = true;
      (order as any).flowType = 'TAB_PAY_LATER';

      await syncQueue.enqueue(order);
      await updateCount();
      baristaDispatcher.dispatchPaidOrder(order).catch(() => {});
      setLastProcessedOrder(order);
      setActionNotice(`حساب باز بیرون‌بر برای ${custName} با موفقیت ثبت شد.`);
      setTimeout(() => setActionNotice(null), 4000);
      if (onOrderProcessed) onOrderProcessed(order);
      return;
    }

    // FLOW B: Dine-In Open Tab (Pay-Later)
    const effectiveAction = opts?.actionOverride || tabAction;
    if (!isTakeaway && effectiveAction === 'ADD_TO_TAB') {
      await syncQueue.enqueue(order);
      await updateCount();
      baristaDispatcher.dispatchPaidOrder(order).catch(() => {});
      setLastProcessedOrder(order);
      setActionNotice(`سفارش راند ${orderRound} با موفقیت در تب باز ${tableLabelToUse} ثبت شد.`);
      setTimeout(() => setActionNotice(null), 4000);
      if (onOrderProcessed) onOrderProcessed(order);
      return;
    }

    // FLOW C: Immediate Payment (Instant Takeaway or Table Tab Settle)
    const refCode =
      paymentMethod === 'CASH'
        ? 'CASH-DRAWER'
        : paymentMethod === 'CARD_MANUAL'
        ? `CARD-P2P-${Math.floor(1000 + Math.random() * 9000)}`
        : `TRACE-${Math.floor(100000 + Math.random() * 900000)}`;

    if (isTakeaway) {
      (order as any).takeawayBillingMode = 'INSTANT_PAY';
    }

    order = OrderDomainService.applyPayment(order, {
      id: crypto.randomUUID(),
      method: paymentMethod,
      amount: order.totalNet,
      referenceNumber: refCode,
      terminalName: paymentMethod === 'POS_TERMINAL' ? 'کارت‌خوان پوز ۱' : undefined,
    });

    await syncQueue.enqueue(order);
    await updateCount();
    baristaDispatcher.dispatchPaidOrder(order).catch(() => {});
    setLastProcessedOrder(order);

    if (isTakeaway) {
      setActionNotice(`سفارش بیرون‌بر (${custName}) با موفقیت تسویه و در صف ذخیره شد.`);
    } else if (tenantConfig.primaryMode === 'DINE_IN_PAY_BY_ORDER') {
      setActionNotice(`راند ${orderRound} میز ${tableLabelToUse} با موفقیت تسویه شد. سشن میز فعال است.`);
      setOrderRound((prev) => prev + 1);
    } else if (tenantConfig.primaryMode === 'TAB_PAY_LATER') {
      setActionNotice(`تب باز ${tableLabelToUse} با موفقیت تسویه و بسته شد.`);
      setTableSessionId(`sess-${Date.now().toString(36)}`);
      setOrderRound(1);
    } else {
      setActionNotice(`سفارش پیشخوان با شناسه ${order.clientGeneratedId.slice(0, 8)} با موفقیت تسویه شد.`);
    }

    setTimeout(() => setActionNotice(null), 4000);
    if (onOrderProcessed) {
      onOrderProcessed(order);
    }
  }

  return (
    <div
      data-tenant={tenantId}
      className="bg-[var(--color-surface-panel,#1c1917)] border border-[var(--color-surface-border,#292524)] rounded-2xl p-5 shadow-xl flex flex-col gap-4 text-[var(--color-text-primary,#f5f5f4)]"
    >
      {/* هدر صفحه تسویه بر اساس حالت عملیاتی تننت */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-stone-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--color-brand-primary-light,rgba(215,25,33,0.15))] text-[var(--color-brand-primary,#D71921)] border border-[var(--color-brand-primary-border,rgba(215,25,33,0.3))]">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-stone-100">
                {tenantConfig.primaryMode === 'COUNTER_QUICK_PAY'
                  ? 'تسویه حساب پیشخوان و بیرون‌بر (Counter & Takeaway)'
                  : tenantConfig.primaryMode === 'TAB_PAY_LATER'
                  ? 'مدیریت زون‌ها، تب‌های باز و گیم‌پادها (Gaming Lounge)'
                  : 'سفارش به سفارش سالن (Dine-In Pay-by-Order)'}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-[var(--color-brand-primary-light,rgba(215,25,33,0.12))] text-[var(--color-brand-primary,#D71921)] border border-[var(--color-brand-primary-border,rgba(215,25,33,0.3))]">
                {tenantConfig.primaryMode}
              </span>
            </div>
            <p className="text-xs text-stone-400">
              {tenantConfig.primaryMode === 'COUNTER_QUICK_PAY'
                ? 'جریان بهینه‌سازی‌شده ۱۰۰هیچ — پیشخوان سریع، میزهای تست دان و سفارشات بیرون‌بر با حساب باز برای مشتریان ثابت'
                : tenantConfig.primaryMode === 'TAB_PAY_LATER'
                ? 'جریان مودندو — سالن اصلی بردگیم، ۴ پاد اختصاصی PS5 با محاسبه ساعتی، و تسویه در خروج به‌صورت پیش‌فرض'
                : 'جریان بیسترو و داین-این — ثبت و تسویه راند به راند سفارشات با حفظ سشن میز'}
            </p>
          </div>
        </div>

        {/* وضعیت شبکه و تعداد فیشهای صف */}
        <div className="flex items-center gap-2 text-xs font-mono bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
          <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-sans font-medium text-stone-300">
            {isOnline ? 'اتصال آنلاین' : 'آفلاین (بدون اینترنت)'}
          </span>
          {queueCount.pending > 0 && (
            <span className="bg-amber-900/60 border border-amber-600/50 text-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
              <span>{queueCount.pending} در صف</span>
            </span>
          )}
        </div>
      </div>

      {/* بنر اطلاعیه اقدام */}
      {actionNotice && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3 text-xs text-amber-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-amber-400 hover:text-amber-200 text-xs"
          >
            بستن
          </button>
        </div>
      )}

      {/* انتخاب نوع سفارش: سالن / در محل در برابر بیرون‌بر */}
      <div className="flex items-center justify-between bg-stone-900 p-2 rounded-xl border border-stone-800 text-xs">
        <div className="flex items-center gap-2 font-bold text-stone-300">
          <span>نوع سفارش:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setOrderType('DINE_IN');
              if (tenantConfig.dineInPolicy?.enforcePayLaterByDefault) {
                setTabAction('ADD_TO_TAB');
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              orderType === 'DINE_IN'
                ? 'bg-[var(--color-brand-primary,#D71921)] text-white shadow-xs'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>سفارش در محل (سالن / کانتر)</span>
          </button>
          <button
            type="button"
            onClick={() => setOrderType('TAKEAWAY')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              orderType === 'TAKEAWAY'
                ? 'bg-[var(--color-brand-primary,#D71921)] text-white shadow-xs'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>سفارش بیرون‌بر (Takeaway)</span>
          </button>
        </div>
      </div>

      {/* زون‌ها و میزها (مخصوص سفارش در محل) */}
      {orderType === 'DINE_IN' && zones.length > 0 && (
        <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <span>انتخاب زون اختصاصی فضا ({tenantName}):</span>
            </span>

            {/* زون تب‌ها */}
            <div className="flex flex-wrap items-center gap-1.5">
              {zones.map((zone) => {
                const isPs5 = zone.type === 'GAMING_PS5';
                const isCounter = zone.type === 'COUNTER';
                const isRetail = zone.type === 'RETAIL';
                const isSelected = selectedZoneId === zone.id;

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleZoneChange(zone.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      isSelected
                        ? 'bg-[var(--color-brand-primary,#D71921)] text-white shadow-xs'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-750'
                    }`}
                  >
                    {isPs5 && <Gamepad2 className="w-3.5 h-3.5 text-sky-300" />}
                    {isCounter && <Coffee className="w-3.5 h-3.5 text-amber-300" />}
                    {isRetail && <Store className="w-3.5 h-3.5 text-emerald-300" />}
                    <span>{zone.nameFa}</span>
                    {isPs5 && (
                      <span className="text-[9px] bg-sky-950/80 text-sky-200 px-1.5 py-0.2 rounded-full border border-sky-600/40">
                        ۴ استیشن
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* میزها و استیشن‌های زون انتخاب‌شده */}
          {activeZone && (
            <div className="pt-2 border-t border-stone-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-stone-400">میز / استیشن:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeZone.tables.map((table) => {
                  const isSelected = selectedTable === table.label;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTable(table.label)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-600 text-white font-bold ring-1 ring-amber-400'
                          : 'bg-stone-950 text-stone-300 border border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {table.isPs5Station && <Gamepad2 className="w-3 h-3 text-sky-400" />}
                      <span>{table.label}</span>
                      {table.hourlyRateToman && (
                        <span className="text-[9px] opacity-75 font-mono">
                          {formatToman(table.hourlyRateToman)} ت/ساعت
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* اطلاعات سفارش بیرون‌بر (نام و موبایل مشتری ثابت) */}
      {orderType === 'TAKEAWAY' && (
        <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[11px] text-stone-400 block mb-1">نام یا عنوان مشتری:</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: آقای اکبری / مشتری ثابت"
              className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[11px] text-stone-400 block mb-1">شماره تماس (اختیاری):</label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="۰۹۱۲..."
              className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="text-[11px] text-stone-400 pt-3">
            <span>امکان تسویه نقدی/کارت آنی یا ثبت در حساب باز مشتری برای تسویه دوره‌ای.</span>
          </div>
        </div>
      )}

      {/* بخش عملیاتی تسویه سریع و پیش‌نمایش اقلام */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* کارت پیش‌نمایش اقلام فاکتور جاری */}
        <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-800 text-xs">
              <span className="font-bold text-stone-300">اقلام آماده ثبت / تسویه:</span>
              <span className="text-amber-400 font-mono">۲ قلم کالا</span>
            </div>

            {/* کنترلرهای وضعیت راند و تب باز در سالن */}
            {orderType === 'DINE_IN' && (
              <div className="mb-3 p-2.5 rounded-xl bg-stone-900 border border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400">محل استقرار:</span>
                  <span className="font-bold text-stone-200 bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                    {selectedTable}
                  </span>
                </div>

                {tenantConfig.primaryMode === 'DINE_IN_PAY_BY_ORDER' && (
                  <div className="flex items-center gap-1.5 font-bold text-amber-400 bg-amber-950/40 border border-amber-600/40 px-2.5 py-1 rounded-lg">
                    <span>راند سفارش:</span>
                    <span className="font-mono font-black text-sm">{orderRound}</span>
                  </div>
                )}

                {tenantConfig.primaryMode === 'TAB_PAY_LATER' && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTabAction('ADD_TO_TAB')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                        tabAction === 'ADD_TO_TAB'
                          ? 'bg-[var(--color-brand-primary,#059669)] text-white shadow-xs'
                          : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      ثبت در تب باز (پیش‌فرض)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTabAction('SETTLE_TAB')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                        tabAction === 'SETTLE_TAB'
                          ? 'bg-[var(--color-brand-primary,#059669)] text-white shadow-xs'
                          : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      تسویه کامل میز
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-stone-900 border border-stone-800/80">
                <div>
                  <div className="font-semibold text-stone-200">قهوه دمی V60 کلمبیا گیشا</div>
                  <div className="text-[10px] text-stone-400">تک‌خاستگاه - عصاره‌گیری تخصصی</div>
                </div>
                <div className="font-mono text-amber-400 font-bold">{formatToman(145000)} ت</div>
              </div>

              <div className="flex justify-between items-center p-2 rounded-lg bg-stone-900 border border-stone-800/80">
                <div>
                  <div className="font-semibold text-stone-200">کافه لاته با شیر جو دوسر</div>
                  <div className="text-[10px] text-amber-300">+ شیر جو دوسر (Oat Milk) ۲۵,۰۰۰ ت</div>
                </div>
                <div className="font-mono text-amber-400 font-bold">{formatToman(120000)} ت</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex justify-between items-center text-sm font-bold">
              <span className="text-stone-300">مجموع قابل پرداخت:</span>
              <span className="text-amber-400 font-black text-base">
                {formatToman(265000)} تومان
              </span>
            </div>

            {/* انتخاب درگاه تسویه نقدی/کارتخوان برای پرداخت‌های آنی */}
            <div className="mt-4 space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-400 block">
                روش پرداخت (در صورت تسویه آنی):
              </label>
              <SegmentGroup.Root
                value={paymentMethod}
                onValueChange={(details) => {
                  if (details.value) setPaymentMethod(details.value as any);
                }}
                className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-xl border border-stone-800"
              >
                <SegmentGroup.Item
                  value="POS_TERMINAL"
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition select-none ${
                    paymentMethod === 'POS_TERMINAL'
                      ? 'bg-[var(--color-brand-primary,#D71921)] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <SegmentGroup.ItemText>پوز بانکی</SegmentGroup.ItemText>
                  <SegmentGroup.ItemControl />
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>

                <SegmentGroup.Item
                  value="CASH"
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition select-none ${
                    paymentMethod === 'CASH'
                      ? 'bg-[var(--color-brand-primary,#D71921)] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <SegmentGroup.ItemText>نقد صندوق</SegmentGroup.ItemText>
                  <SegmentGroup.ItemControl />
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>

                <SegmentGroup.Item
                  value="CARD_MANUAL"
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition select-none ${
                    paymentMethod === 'CARD_MANUAL'
                      ? 'bg-[var(--color-brand-primary,#D71921)] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <SegmentGroup.ItemText>کارت/سایر</SegmentGroup.ItemText>
                  <SegmentGroup.ItemControl />
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              </SegmentGroup.Root>
            </div>
          </div>

          {/* دکمه‌های اقدام تسویه بر اساس سالن یا بیرون‌بر */}
          <div className="pt-4 space-y-2">
            {orderType === 'TAKEAWAY' ? (
              <div className="flex flex-col sm:flex-row gap-2">
                {/* تسویه آنی بیرون‌بر */}
                <button
                  type="button"
                  onClick={() =>
                    handleFastCheckout({
                      orderTypeOverride: 'TAKEAWAY',
                      takeawayBillingMode: 'INSTANT_PAY',
                    })
                  }
                  className="flex-1 bg-[var(--color-brand-primary,#059669)] hover:brightness-110 active:scale-[0.99] text-white py-3 px-3 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>تسویه آنی بیرون‌بر ({formatToman(265000)} ت)</span>
                </button>

                {/* ثبت حساب باز بیرونبر (مشتری ثابت) */}
                <button
                  type="button"
                  onClick={() =>
                    handleFastCheckout({
                      orderTypeOverride: 'TAKEAWAY',
                      takeawayBillingMode: 'OPEN_TAB_REGULAR',
                    })
                  }
                  className="flex-1 bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white py-3 px-3 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>ثبت حساب باز بیرونبر (مشتری ثابت)</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleFastCheckout()}
                className="w-full bg-[var(--color-brand-primary,#059669)] hover:brightness-110 active:scale-[0.99] text-white py-3 rounded-xl font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span>
                  {tenantConfig.primaryMode === 'COUNTER_QUICK_PAY' &&
                    `تسویه فوری پیشخوان (${formatToman(265000)} ت)`}
                  {tenantConfig.primaryMode === 'TAB_PAY_LATER' &&
                    (tabAction === 'ADD_TO_TAB'
                      ? `ثبت سفارش در تب باز ${selectedTable} (پرداخت در خروج)`
                      : `تسویه نهایی تب باز ${selectedTable} (${formatToman(265000)} ت)`)}
                  {tenantConfig.primaryMode === 'DINE_IN_PAY_BY_ORDER' &&
                    `تسویه راند ${orderRound} میز ${selectedTable} (${formatToman(265000)} ت)`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* وضعیت صف و آخرین سفارش پردازش‌شده */}
        <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-800 text-xs">
              <span className="font-bold text-stone-300">وضعیت صف همگام‌سازی آفلاین:</span>
              <button
                onClick={triggerManualSync}
                disabled={isSyncing}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>سینک دستی</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
              <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800">
                <span className="text-[10px] text-stone-400 block mb-1">کل در صف</span>
                <span className="font-mono font-bold text-stone-200 text-base">{queueCount.total}</span>
              </div>
              <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800">
                <span className="text-[10px] text-amber-400 block mb-1">معلق (Pending)</span>
                <span className="font-mono font-bold text-amber-400 text-base">{queueCount.pending}</span>
              </div>
              <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800">
                <span className="text-[10px] text-rose-400 block mb-1">خطا خورده</span>
                <span className="font-mono font-bold text-rose-400 text-base">{queueCount.failed}</span>
              </div>
            </div>

            {lastProcessedOrder ? (
              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 text-[11px]">آخرین سفارش پردازش‌شده:</span>
                  <button
                    onClick={() => setIsReceiptOpen(true)}
                    className="text-amber-400 hover:text-amber-300 text-[11px] flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>مشاهده فیش (Ark UI Dialog)</span>
                  </button>
                </div>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    وضعیت: {lastProcessedOrder.state}{' '}
                    {(lastProcessedOrder as any).takeawayBillingMode === 'OPEN_TAB_REGULAR'
                      ? '(حساب باز مشتری ثابت بیرون‌بر)'
                      : (lastProcessedOrder as any).state === 'PAID'
                      ? '(تسویه کامل)'
                      : '(ثبت در تب باز)'}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-stone-300 truncate" dir="ltr">
                  UUID: {lastProcessedOrder.clientGeneratedId}
                </div>
                <div className="text-stone-300 flex justify-between">
                  <span>مشتری:</span>
                  <span className="text-amber-300 font-medium">
                    {lastProcessedOrder.customerName || 'عمومی'}
                  </span>
                </div>
                <div className="text-stone-300 flex justify-between">
                  <span>مبلغ خالص:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {formatToman(lastProcessedOrder.netTotalToman)} تومان
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-stone-900/50 border border-stone-800/60 text-center text-xs text-stone-500">
                هنوز سفارشی در این شیفت سریع ثبت نشده است. با انتخاب زون و دکمه بالا تسویه را اجرا کنید.
              </div>
            )}
          </div>

          <div className="pt-4 text-[11px] text-stone-400 flex items-center gap-1.5 justify-center">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>به‌روزرسانی دوره‌ای صف هر ۵ ثانیه یکبار انجام می‌شود.</span>
          </div>
        </div>
      </div>

      {/* Ark UI Modal for Receipt Preview */}
      {lastProcessedOrder && (
        <Dialog.Root
          open={isReceiptOpen}
          onOpenChange={(details) => {
            if (!details.open) setIsReceiptOpen(false);
          }}
        >
          <Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs" />
            <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <Dialog.Content className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 text-stone-100 flex flex-col gap-3 focus:outline-none">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-amber-500" />
                    <Dialog.Title className="font-bold text-sm">
                      رسید رسمی {tenantName}
                    </Dialog.Title>
                  </div>
                  <Dialog.CloseTrigger asChild>
                    <button
                      onClick={() => setIsReceiptOpen(false)}
                      className="text-stone-400 hover:text-stone-200 p-1 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </Dialog.CloseTrigger>
                </div>

                <Dialog.Description className="text-xs text-stone-400">
                  فیش صادرشده برای مشتری با شناسه یکتا و اقلام سفارش:
                </Dialog.Description>

                <div id="thermal-receipt" className="receipt-paper bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs space-y-2">
                  <div className="flex justify-between text-stone-400 text-[11px]">
                    <span>شماره سفارش: #{lastProcessedOrder.orderNumber}</span>
                    <span>{new Date(lastProcessedOrder.createdAt).toLocaleTimeString('fa-IR')}</span>
                  </div>

                  <div className="border-t border-dashed border-stone-800 pt-2 space-y-1">
                    {lastProcessedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-stone-200">
                        <span>
                          {item.quantity} × {item.itemNameSnapshot}
                        </span>
                        <span className="font-mono text-amber-400">
                          {formatToman(item.subtotalToman)} ت
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-stone-800 pt-2 flex justify-between font-bold text-amber-400">
                    <span>مبلغ کل خالص:</span>
                    <span className="font-mono text-sm">
                      {formatToman(lastProcessedOrder.netTotalToman)} تومان
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 print:hidden">
                  <button
                    onClick={() => {
                      printThermalReceipt('thermal-receipt');
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ فیش حرارتی ۸۰mm</span>
                  </button>
                  <button
                    onClick={() => setIsReceiptOpen(false)}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    بستن
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
