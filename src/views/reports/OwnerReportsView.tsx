/**
 * src/views/reports/OwnerReportsView.tsx
 * 
 * Modendo Dedicated Owner & Manager Sales & Staff Performance Reporting.
 * Includes: Daily Summary, Top 5 Items by Revenue, Payment Methods Breakdown,
 * Staff Order Performance, and UTF-8 BOM Persian CSV Export.
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  ArrowRight,
  Download,
  DollarSign,
  ShoppingBag,
  Award,
  CreditCard,
  Banknote,
  Users,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { SmartOrdersStore } from '../../services/storage';
import { formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { LiquidSurface } from '../../components/liquid/LiquidSurface';

interface OwnerReportsViewProps {
  onBack: () => void;
}

export const OwnerReportsView: React.FC<OwnerReportsViewProps> = ({ onBack }) => {
  const orders = SmartOrdersStore.getOrders();
  const payments = SmartOrdersStore.getPayments();

  // Compute Analytics
  const analytics = useMemo(() => {
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');

    // 1. Sales Summary
    const totalOrdersCount = completedOrders.length;
    const grossTotal = completedOrders.reduce((acc, o) => acc + (o.grossAmountToman || 0), 0);
    const discountTotal = completedOrders.reduce((acc, o) => acc + (o.discountAmountToman || 0), 0);
    const netTotal = completedOrders.reduce((acc, o) => acc + (o.netTotalToman || 0), 0);
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(netTotal / totalOrdersCount) : 0;

    // 2. Top 5 Items by Revenue
    const itemMap = new Map<string, { title: string; count: number; revenue: number }>();
    for (const ord of completedOrders) {
      if (ord.items && Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const title = it.itemNameSnapshot || 'آیتم نامشخص';
          const qty = it.quantity || 1;
          const sub = it.subtotalToman || (it.unitPriceSnapshotToman || 0) * qty;

          const existing = itemMap.get(title) || { title, count: 0, revenue: 0 };
          existing.count += qty;
          existing.revenue += sub;
          itemMap.set(title, existing);
        }
      }
    }
    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 3. Payment Method Breakdown
    let cashTotal = 0;
    let cardTotal = 0;
    let otherTotal = 0;
    for (const p of payments) {
      if (p.status === 'SUCCESSFUL') {
        if (p.paymentMethod === 'CASH') {
          cashTotal += p.amountToman || 0;
        } else if (p.paymentMethod === 'CARD_MANUAL') {
          cardTotal += p.amountToman || 0;
        } else {
          otherTotal += p.amountToman || 0;
        }
      }
    }
    const allPaymentsTotal = cashTotal + cardTotal + otherTotal;
    const cashPct = allPaymentsTotal > 0 ? Math.round((cashTotal / allPaymentsTotal) * 100) : 0;
    const cardPct = allPaymentsTotal > 0 ? Math.round((cardTotal / allPaymentsTotal) * 100) : 0;

    // 4. Staff Performance
    const staffMap = new Map<string, { name: string; count: number; volume: number }>();
    for (const ord of completedOrders) {
      const staffName = ord.createdByUserName || 'صندوق‌دار';
      const existing = staffMap.get(staffName) || { name: staffName, count: 0, volume: 0 };
      existing.count += 1;
      existing.volume += ord.netTotalToman || 0;
      staffMap.set(staffName, existing);
    }
    const staffStats = Array.from(staffMap.values()).sort((a, b) => b.volume - a.volume);

    return {
      totalOrdersCount,
      grossTotal,
      discountTotal,
      netTotal,
      avgOrderValue,
      topItems,
      cashTotal,
      cardTotal,
      otherTotal,
      allPaymentsTotal,
      cashPct,
      cardPct,
      staffStats,
    };
  }, [orders, payments]);

  // Export to CSV with UTF-8 BOM
  const handleExportCsv = () => {
    playPosBeep('click');
    const nowStr = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');

    let csv = '\uFEFF'; // UTF-8 BOM for Persian Excel support
    csv += 'گزارش تحلیلی فروش و عملکرد پرسنل — کافه گیمینگ مودندو\n';
    csv += `تاریخ گزارش:,"${new Date().toLocaleDateString('fa-IR')}"\n\n`;

    // Section 1: Sales Summary
    csv += '۱. خلاصه فروش کلی\n';
    csv += 'شاخص,مقدار (تومان / تعداد)\n';
    csv += `تعداد کل سفارشات موفق,"${analytics.totalOrdersCount}"\n`;
    csv += `فروش ناخالص,"${analytics.grossTotal}"\n`;
    csv += `تخفیف‌های اعمال شده,"${analytics.discountTotal}"\n`;
    csv += `درآمد خالص,"${analytics.netTotal}"\n`;
    csv += `میانگین ارزش هر سفارش,"${analytics.avgOrderValue}"\n\n`;

    // Section 2: Top 5 Items
    csv += '۲. ۵ آیتم پرفروش از نظر درآمد\n';
    csv += 'رتبه,عنوان آیتم,تعداد فروخته‌شده,درآمد کل (تومان)\n';
    analytics.topItems.forEach((it, idx) => {
      csv += `"${idx + 1}","${it.title}","${it.count}","${it.revenue}"\n`;
    });
    csv += '\n';

    // Section 3: Payment Breakdown
    csv += '۳. تفکیک روش‌های پرداخت\n';
    csv += 'روش پرداخت,مبلغ دریافتی (تومان),درصد سهم\n';
    csv += `کارتخوان (POS),"${analytics.cardTotal}","${analytics.cardPct}%"\n`;
    csv += `نقدی (Cash),"${analytics.cashTotal}","${analytics.cashPct}%"\n`;
    if (analytics.otherTotal > 0) {
      csv += `سایر روش‌ها,"${analytics.otherTotal}","${100 - analytics.cashPct - analytics.cardPct}%"\n`;
    }
    csv += '\n';

    // Section 4: Staff Performance
    csv += '۴. عملکرد پرسنل\n';
    csv += 'نام پرسنل,تعداد سفارشات ثبت‌شده,حجم فروش ریالی (تومان)\n';
    analytics.staffStats.forEach((st) => {
      csv += `"${st.name}","${st.count}","${st.volume}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Modendo-Report-${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      dir="rtl"
      className="min-h-full w-full bg-[#06120F] text-white p-4 md:p-8 select-none font-sans relative overflow-y-auto"
    >
      <div className="max-w-6xl w-full mx-auto space-y-6 pb-20">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl liquid-glass-shell border border-[#16382F] shadow-xl">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                onBack();
              }}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
              title="بازگشت"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white">
                گزارش‌ها و تحلیل عملکرد مودندو
              </h1>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                خلاصه فروش روزانه، ۵ آیتم برتر، تفکیک نقدی/کارتخوان و عملکرد هر پرسنل
              </p>
            </div>
          </div>

          <LiquidSurface
            as="button"
            magnetic={true}
            onClick={handleExportCsv}
            className="h-11 px-5 rounded-2xl bg-[#005A3E] hover:bg-[#007A54] text-white font-bold text-xs flex items-center gap-2 border border-emerald-400/40 shadow-lg cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>خروجی اکسل (CSV)</span>
          </LiquidSurface>
        </div>

        {/* 1. Daily Sales Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-3xl p-5 liquid-glass-card border border-[#16382F] flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold">فروش خالص (Net Sales)</span>
            <div className="my-2">
              <span className="font-mono text-xl md:text-2xl font-black text-emerald-300">
                {formatToman(analytics.netTotal)}
              </span>
              <span className="text-xs text-white/50 mr-1.5">تومان</span>
            </div>
            <span className="text-[10px] text-white/40">پس از کسر تخفیف‌ها</span>
          </div>

          <div className="rounded-3xl p-5 liquid-glass-card border border-[#16382F] flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold">فروش ناخالص (Gross)</span>
            <div className="my-2">
              <span className="font-mono text-xl md:text-2xl font-black text-white">
                {formatToman(analytics.grossTotal)}
              </span>
              <span className="text-xs text-white/50 mr-1.5">تومان</span>
            </div>
            <span className="text-[10px] text-amber-300/80">
              تخفیف: {formatToman(analytics.discountTotal)} ت
            </span>
          </div>

          <div className="rounded-3xl p-5 liquid-glass-card border border-[#16382F] flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold">تعداد کل سفارشات</span>
            <div className="my-2">
              <span className="font-mono text-xl md:text-2xl font-black text-sky-300">
                {analytics.totalOrdersCount}
              </span>
              <span className="text-xs text-white/50 mr-1.5">فاکتور</span>
            </div>
            <span className="text-[10px] text-white/40">سفارشات موفق و نهایی‌شده</span>
          </div>

          <div className="rounded-3xl p-5 liquid-glass-card border border-[#16382F] flex flex-col justify-between">
            <span className="text-xs text-[#94A3B8] font-bold">میانگین ارزش سفارش (AOV)</span>
            <div className="my-2">
              <span className="font-mono text-xl md:text-2xl font-black text-purple-300">
                {formatToman(analytics.avgOrderValue)}
              </span>
              <span className="text-xs text-white/50 mr-1.5">تومان</span>
            </div>
            <span className="text-[10px] text-white/40">میانگین فروش به ازای هر فاکتور</span>
          </div>
        </div>

        {/* 2-Column: Top 5 Items & Payment Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top 5 Items by Revenue */}
          <div className="rounded-3xl p-6 liquid-glass-card border border-[#16382F] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#16382F]">
                <Award className="w-5 h-5 text-amber-300" />
                <h2 className="text-sm font-bold text-white">۵ آیتم برتر از نظر درآمد</h2>
              </div>

              {analytics.topItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#94A3B8]">
                  هنوز فاکتور نهایی‌شده‌ای ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.topItems.map((it, idx) => (
                    <div
                      key={it.title}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-white text-xs block">{it.title}</span>
                          <span className="text-[11px] text-[#94A3B8]">
                            تعداد فروش: {it.count} عدد
                          </span>
                        </div>
                      </div>
                      <div className="text-left font-mono text-xs font-bold text-emerald-300">
                        {formatToman(it.revenue)} ت
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="rounded-3xl p-6 liquid-glass-card border border-[#16382F] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#16382F]">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">تفکیک درگاه‌های پرداخت</h2>
              </div>

              <div className="space-y-4">
                {/* Card Payment Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/90">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span>کارتخوان بانکی (POS)</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      {formatToman(analytics.cardTotal)} ت ({analytics.cardPct}٪)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${analytics.cardPct}%` }}
                    />
                  </div>
                </div>

                {/* Cash Payment Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/90">
                      <Banknote className="w-4 h-4 text-amber-400" />
                      <span>وجه نقد (Cash)</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {formatToman(analytics.cashTotal)} ت ({analytics.cashPct}٪)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${analytics.cashPct}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#092219] border border-[#16382F] flex items-center justify-between text-xs mt-4">
                  <span className="text-[#94A3B8]">مجموع کل مبالغ دریافتی:</span>
                  <span className="font-mono font-bold text-white">
                    {formatToman(analytics.allPaymentsTotal)} تومان
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Staff Performance Table */}
        <div className="rounded-3xl p-6 liquid-glass-card border border-[#16382F]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#16382F]">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">عملکرد پرسنل و ثبت سفارشات</h2>
          </div>

          {analytics.staffStats.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#94A3B8]">
              اطلاعاتی از ثبت سفارشات پرسنل یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#16382F] text-[#94A3B8]">
                    <th className="py-2.5 px-3">نام پرسنل</th>
                    <th className="py-2.5 px-3">تعداد سفارشات</th>
                    <th className="py-2.5 px-3">حجم فروش ثبت‌شده</th>
                    <th className="py-2.5 px-3 text-left">سهم از کل فروش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#16382F]/50">
                  {analytics.staffStats.map((st) => {
                    const sharePct =
                      analytics.netTotal > 0 ? Math.round((st.volume / analytics.netTotal) * 100) : 0;
                    return (
                      <tr key={st.name} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-bold text-white">{st.name}</td>
                        <td className="py-3 px-3 font-mono text-sky-300">{st.count} سفارش</td>
                        <td className="py-3 px-3 font-mono text-emerald-300">
                          {formatToman(st.volume)} تومان
                        </td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-white/80">
                          {sharePct}٪
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
