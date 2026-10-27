import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { formatToman } from '../services/financialMath';
import { baristaDispatcher } from '../services/baristaDispatcher';
import {
  renderReceiptToCanvas,
  convertCanvasToEscPosRaster,
  printDirectWebUSB,
} from '../services/escposThermalPrinter';

const syncQueue = new OfflineSyncQueue({
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  maxRetries: 3,
});

interface CashierCheckoutPageProps {
  tenantId?: string;
  tenantName?: string;
  onOrderProcessed?: (order: OrderAggregate) => void;
}

export function CashierCheckoutPage({
  tenantId = 'tenant_100hich',
  tenantName = 'قهوه‌فروشی ۱۰۰هیچ',
  onOrderProcessed,
}: CashierCheckoutPageProps) {
  const [queueCount, setQueueCount] = useState({ total: 0, pending: 0, failed: 0 });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastProcessedOrder, setLastProcessedOrder] = useState<OrderAggregate | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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

  async function handleFastCheckout(activeCart?: any) {
    // ۱. تولید UUID کلاینت برای عدم تکرار
    const clientGeneratedId = crypto.randomUUID();

    // ۲. پردازش دامین با OrderDomainService
    let order = OrderDomainService.createDraft({
      id: clientGeneratedId,
      tenantId: tenantId,
      clientGeneratedId,
      tableLabel: activeCart?.tableLabel || 'میز پیشخوان (تند)',
      customerName: activeCart?.customerName || 'مشتری ۱۰۰هیچ',
      createdByUserId: 'cashier-fast',
      createdByUserName: 'صندوق‌دار شیفت',
      items: activeCart?.items || [
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

    // افزودن آیتمها و قفل کردن فاکتور (DRAFT -> PLACED)
    order = OrderDomainService.placeOrder(order);

    // تسویه حساب کامل (PLACED -> PAID)
    order = OrderDomainService.applyPayment(order, {
      id: crypto.randomUUID(),
      method: 'POS_TERMINAL',
      amount: order.totalNet,
      referenceNumber: `TRACE-${Math.floor(100000 + Math.random() * 900000)}`,
      terminalName: 'کارت‌خوان پوز ۱',
    });

    // ۳. ثبت فوری در صف آفلاین محلی (صندوقدار فوراً فاکتور بعدی را باز میکند)
    await syncQueue.enqueue(order);
    await updateCount();

    // ارسال رویداد به نمایشگر بار باریستا در زمان واقعی
    baristaDispatcher.dispatchPaidOrder(order).catch(() => {});

    setLastProcessedOrder(order);
    setActionNotice(`سفارش با شناسه ${order.clientGeneratedId.slice(0, 8)} با موفقیت تسویه و در صف ذخیره شد.`);
    setTimeout(() => setActionNotice(null), 4000);

    if (onOrderProcessed) {
      onOrderProcessed(order);
    }

    // ۴. صدور فرمان پرینت رسید حرارتی بدون تاخیر
    // printReceipt(order);
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4 text-stone-100">
      {/* هدر صفحه تسویه سریع و نشانگر وضعیت شبکه */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-stone-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-100">
              تسویه حساب فوق‌سریع صندوق (Fast Cashier Checkout)
            </h3>
            <p className="text-xs text-stone-400">
              مبتنی بر دامین اختصاصی فاز ۴ و صف آفلاین محلی IndexedDB با تضمین عدم تکرار
            </p>
          </div>
        </div>

        {/* بچ وضعیت شبکه و تعداد فیشهای منتظر همگامسازی */}
        <div className="flex items-center gap-2 text-xs font-mono bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
          <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-sans font-medium text-stone-300">
            {isOnline ? 'اتصال آنلاین' : 'آفلاین (بدون اینترنت)'}
          </span>
          {queueCount.pending > 0 && (
            <span className="bg-amber-900/60 border border-amber-600/50 text-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
              <span>{queueCount.pending} سفارش در صف ارسال</span>
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

      {/* بخش عملیاتی تسویه سریع (نمونه گردش کار) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* کارت پیش‌نمایش فاکتور جاری */}
        <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-800 text-xs">
              <span className="font-bold text-stone-300">اقلام آماده تسویه فوق سریع:</span>
              <span className="text-amber-400 font-mono">۲ قلم کالا</span>
            </div>

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
          </div>

          <div className="pt-4">
            <button
              onClick={() => handleFastCheckout()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white py-3 rounded-xl font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>اجرای تسویه سریع کارتخوان پوز ({formatToman(265000)} ت)</span>
            </button>
          </div>
        </div>

        {/* وضعیت صف و آخرین سفارش ثبت‌شده */}
        <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-800 text-xs">
              <span className="font-bold text-stone-300">آمار صف همگام‌سازی آفلاین:</span>
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
              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 text-xs space-y-1">
                <div className="text-stone-400 text-[11px]">آخرین سفارش پردازش‌شده:</div>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>وضعیت: {lastProcessedOrder.state} (تسویه کامل)</span>
                </div>
                <div className="font-mono text-[11px] text-stone-300 truncate" dir="ltr">
                  UUID: {lastProcessedOrder.clientGeneratedId}
                </div>
                <div className="text-stone-300">
                  مبلغ خالص: {formatToman(lastProcessedOrder.netTotalToman)} تومان
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-stone-900/50 border border-stone-800/60 text-center text-xs text-stone-500">
                هنوز سفارشی در این شیفت سریع ثبت نشده است. با کلیک روی دکمه بالا تسویه آزمایشی را اجرا کنید.
              </div>
            )}
          </div>

          <div className="pt-4 text-[11px] text-stone-400 flex items-center gap-1.5 justify-center">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>به‌روزرسانی دوره‌ای صف هر ۵ ثانیه یکبار انجام می‌شود.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
