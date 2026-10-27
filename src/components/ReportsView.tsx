import React, { useState, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Printer,
  ShoppingBag,
  Search,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal,
  BarChart3,
  Download,
  Coins,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Shift, Order, Payment, Expense, User, Tenant } from '../types/domain';
import {
  formatToman,
  compileShiftReport,
  computeDailyRevenueTrends,
  DailyRevenueDataPoint,
  downloadOrdersCSV,
  downloadExpensesCSV,
  calculateShiftProfit,
} from '../services/financialMath';
import { ReceiptPreview } from './ReceiptPreview';
import { ShiftSummaryReceipt } from './ShiftSummaryReceipt';


interface ReportsViewProps {
  tenant?: Tenant;
  shifts: Shift[];
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  activeUser: User;
  onCancelOrder?: (orderId: string, reason: string) => void;
}

const RevenueChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data: DailyRevenueDataPoint = payload[0].payload;
    return (
      <div className="bg-stone-900/95 backdrop-blur-md border border-stone-700/80 rounded-xl p-3 shadow-2xl text-xs flex flex-col gap-1.5 min-w-[210px] text-right font-sans">
        <div className="text-[11px] text-stone-300 font-semibold pb-1.5 border-b border-stone-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-stone-300">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>{data.fullDateFa}</span>
          </span>
          <span className="text-[10px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded font-mono">
            {data.dateLabel}
          </span>
        </div>

        <div className="flex justify-between items-center text-amber-400 font-bold pt-0.5">
          <span>درآمد خالص:</span>
          <span className="font-mono text-sm">{formatToman(data.revenue)} تومان</span>
        </div>

        <div className="flex justify-between items-center text-stone-400 text-[11px]">
          <span>فروش ناخالص:</span>
          <span className="font-mono">{formatToman(data.grossSales)} تومان</span>
        </div>

        {data.discounts > 0 && (
          <div className="flex justify-between items-center text-rose-400 text-[11px]">
            <span>تخفیف اعطایی:</span>
            <span className="font-mono">-{formatToman(data.discounts)} تومان</span>
          </div>
        )}

        <div className="flex justify-between items-center text-stone-300 text-[11px] pt-1.5 border-t border-stone-800">
          <span>سفارشات تسویه‌شده:</span>
          <span className="font-mono font-bold text-stone-200">
            {data.orderCount.toLocaleString('fa-IR')} فاکتور
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  tenant,
  shifts,
  orders,
  payments,
  expenses,
  activeUser,
  onCancelOrder,
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState<string>(
    shifts.length > 0 ? shifts[0].id : 'all'
  );
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [shiftForSummaryReceipt, setShiftForSummaryReceipt] = useState<Shift | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');

  // 30-Day Daily Revenue Trends (Computed using continuous calendar window)
  const revenueTrends = useMemo(() => {
    return computeDailyRevenueTrends(orders, 30);
  }, [orders]);


  // Search & Filter State for Orders
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [dateRangePreset, setDateRangePreset] = useState<
    'current_shift' | 'all' | 'today' | 'yesterday' | 'last_7_days' | 'custom'
  >('current_shift');
  const [customStartDateTime, setCustomStartDateTime] = useState<string>('');
  const [customEndDateTime, setCustomEndDateTime] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'COMPLETED' | 'CANCELLED'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'DINE_IN' | 'TAKEAWAY'>('all');

  const currentShift = shifts.find((s) => s.id === selectedShiftId) || (shifts.length > 0 ? shifts[0] : null);

  // If a specific shift is selected, compile its exact financial report
  const report = currentShift
    ? compileShiftReport(currentShift, orders, payments, expenses)
    : null;

  // Filter orders by search query, shift/date preset, custom datetime, type, and status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Shift / Date range filtering
      if (dateRangePreset === 'current_shift') {
        if (currentShift && order.shiftId !== currentShift.id) {
          return false;
        }
      } else if (dateRangePreset === 'today') {
        const orderDate = new Date(order.createdAt).toDateString();
        const today = new Date().toDateString();
        if (orderDate !== today) return false;
      } else if (dateRangePreset === 'yesterday') {
        const orderDate = new Date(order.createdAt);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (orderDate.toDateString() !== yesterday.toDateString()) return false;
      } else if (dateRangePreset === 'last_7_days') {
        const orderTime = new Date(order.createdAt).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (orderTime < sevenDaysAgo) return false;
      } else if (dateRangePreset === 'custom') {
        const orderTime = new Date(order.createdAt).getTime();
        if (customStartDateTime) {
          const startTime = new Date(customStartDateTime).getTime();
          if (!isNaN(startTime) && orderTime < startTime) return false;
        }
        if (customEndDateTime) {
          const endTime = new Date(customEndDateTime).getTime();
          if (!isNaN(endTime) && orderTime > endTime) return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // 3. Order type filter
      if (orderTypeFilter !== 'all' && order.orderType !== orderTypeFilter) {
        return false;
      }

      // 4. Text search query (order number, customer name, table, items)
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.trim().toLowerCase();
        const cleanNum = q.replace('#', '');
        const matchNum = order.orderNumber.toString().includes(cleanNum);
        const matchCustomer = order.customerName?.toLowerCase().includes(q);
        const matchTable = order.tableLabel?.toLowerCase().includes(q);
        const matchItem = order.items.some((it) =>
          it.itemNameSnapshot.toLowerCase().includes(q)
        );

        if (!matchNum && !matchCustomer && !matchTable && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    dateRangePreset,
    currentShift,
    customStartDateTime,
    customEndDateTime,
    statusFilter,
    orderTypeFilter,
    orderSearchQuery,
  ]);

  const filteredTotalNetToman = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.netTotalToman, 0);
  }, [filteredOrders]);

  const isFilterActive =
    orderSearchQuery.trim() !== '' ||
    dateRangePreset !== 'current_shift' ||
    statusFilter !== 'all' ||
    orderTypeFilter !== 'all' ||
    customStartDateTime !== '' ||
    customEndDateTime !== '';

  const handleResetFilters = () => {
    setOrderSearchQuery('');
    setDateRangePreset('current_shift');
    setCustomStartDateTime('');
    setCustomEndDateTime('');
    setStatusFilter('all');
    setOrderTypeFilter('all');
  };

  const [isCsvExporting, setIsCsvExporting] = useState(false);
  const [csvExportSuccess, setCsvExportSuccess] = useState(false);

  const handleDownloadCSV = () => {
    if (filteredOrders.length === 0 || isCsvExporting) return;
    setIsCsvExporting(true);
    try {
      const now = new Date();
      const datePart = now.toISOString().split('T')[0];
      const filename = `cafe-narenj-orders-${datePart}.csv`;
      const success = downloadOrdersCSV(filteredOrders, filename);
      if (success) {
        setCsvExportSuccess(true);
        setTimeout(() => {
          setCsvExportSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setIsCsvExporting(false);
    }
  };

  const [isExpenseCsvExporting, setIsExpenseCsvExporting] = useState(false);
  const [expenseCsvExportSuccess, setExpenseCsvExportSuccess] = useState(false);

  const filteredExpenses = currentShift
    ? expenses.filter((e) => e.shiftId === currentShift.id)
    : expenses;

  const handleDownloadExpensesCSV = () => {
    if (filteredExpenses.length === 0 || isExpenseCsvExporting) return;
    setIsExpenseCsvExporting(true);
    try {
      const now = new Date();
      const datePart = now.toISOString().split('T')[0];
      const shiftPart = currentShift ? `shift-${currentShift.id.slice(0, 8)}` : 'all-shifts';
      const filename = `cafe-expenses-${shiftPart}-${datePart}.csv`;
      const success = downloadExpensesCSV(filteredExpenses, filename);
      if (success) {
        setExpenseCsvExportSuccess(true);
        setTimeout(() => {
          setExpenseCsvExportSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to export expenses CSV:', err);
    } finally {
      setIsExpenseCsvExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5">
      {/* Top Controls: Shift Selector & Print */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-stone-100">گزارشات تفصیلی شیفت و حسابداری عملیاتی</h2>
            <p className="text-xs text-stone-400">
              تفکیک بدون خطای درآمد، وجوه نقد ورودی، کارتخوان، هزینه‌های تنخواه و تراز صندوق
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400">انتخاب شیفت کاری:</label>
          <select
            value={selectedShiftId}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="bg-stone-950 border border-stone-700 text-stone-100 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500"
          >
            {shifts.map((s, idx) => (
              <option key={s.id} value={s.id}>
                {s.status === 'OPEN' ? '🟢 شیفت فعال جاری' : `🔴 شیفت بسته شماره ${shifts.length - idx}`} - (
                {new Date(s.openedAt).toLocaleDateString('fa-IR')})
              </option>
            ))}
          </select>

          <button
            onClick={() => currentShift && setShiftForSummaryReceipt(currentShift)}
            className="bg-stone-800 hover:bg-stone-750 text-amber-400 hover:text-amber-300 border border-stone-700 hover:border-amber-500/50 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="چاپ فیش حرارتی صورت‌جلسه تسویه شیفت"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>چاپ صورت‌جلسه شیفت</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={filteredOrders.length === 0 || isCsvExporting}
            className={`border px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              filteredOrders.length === 0
                ? 'bg-stone-950 text-stone-600 border-stone-800 cursor-not-allowed opacity-50'
                : csvExportSuccess
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                : 'bg-stone-800 hover:bg-stone-750 text-emerald-400 border-stone-700 hover:border-emerald-500/50'
            }`}
            title="دانلود خروجی فاکتورهای فروش (CSV)"
          >
            {csvExportSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>فاکتورها ذخیره شد</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-400" />
                <span>CSV فاکتورها ({filteredOrders.length})</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadExpensesCSV}
            disabled={filteredExpenses.length === 0 || isExpenseCsvExporting}
            className={`border px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              filteredExpenses.length === 0
                ? 'bg-stone-950 text-stone-600 border-stone-800 cursor-not-allowed opacity-50'
                : expenseCsvExportSuccess
                ? 'bg-rose-950 text-rose-300 border-rose-500'
                : 'bg-stone-800 hover:bg-stone-750 text-rose-400 border-stone-700 hover:border-rose-500/50'
            }`}
            title="دانلود خروجی هزینه‌های تنخواه (CSV)"
          >
            {expenseCsvExportSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>هزینه‌ها ذخیره شد</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-rose-400" />
                <span>CSV هزینه‌ها ({filteredExpenses.length})</span>
              </>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4 text-stone-400" />
            <span>چاپ کل صفحه</span>
          </button>
        </div>
      </div>

      {report ? (
        <>
          {/* Main 5 Accounting Metrics (Revenue, Inflows, Expenses, Cash Drawer, Profit Summary) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Metric 1: Revenue (Accrual Sales) */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-stone-400 mb-2">
                <span className="text-xs font-semibold">۱. درآمد ناخالص و خالص</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-black text-stone-100">
                  {formatToman(report.netRevenueToman)} <span className="text-xs font-normal text-stone-400">تومان</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-1 flex flex-col gap-0.5">
                  <span>فروش ناخالص: {formatToman(report.grossSalesToman)} تومان</span>
                  <span className="text-rose-400">تخفیف اعطایی: - {formatToman(report.discountsToman)} تومان</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-stone-800/80 text-[11px] text-stone-400">
                تعداد فاکتورهای موفق: <strong className="text-stone-200">{report.completedOrderCount}</strong> سفارش
              </div>
            </div>

            {/* Metric 2: Collected Payments Breakdown */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-stone-400 mb-2">
                <span className="text-xs font-semibold">۲. وجوه وصول‌شده</span>
                <CreditCard className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-sky-400">
                  {formatToman(report.totalCollectedToman)} <span className="text-xs font-normal text-stone-400">تومان</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-1 flex flex-col gap-0.5">
                  <span className="flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-emerald-400" />
                    <span>نقد ورودی به صندوق: {formatToman(report.cashReceivedToman)} تومان</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-sky-400" />
                    <span>کارتخوان بانکی (پوز): {formatToman(report.cardReceivedToman)} تومان</span>
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-stone-800/80 text-[11px] text-sky-300">
                مبالغ کارتخوان مستقیماً به حساب بانکی واریز می‌گردد.
              </div>
            </div>

            {/* Metric 3: Shift Expenses */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-stone-400 mb-2">
                <span className="text-xs font-semibold">۳. هزینه‌های تنخواه شیفت</span>
                <DollarSign className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <div className="text-2xl font-black text-rose-400">
                  {formatToman(report.totalExpensesToman)} <span className="text-xs font-normal text-stone-400">تومان</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-1 flex flex-col gap-0.5">
                  <span>کسر شده از کشوی نقد: {formatToman(report.cashDrawerExpensesToman)} تومان</span>
                  <span>پرداخت خارج از صندوق: {formatToman(report.otherExpensesToman)} تومان</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-stone-800/80 text-[11px] text-stone-400">
                تعداد اقلام هزینه: <strong className="text-stone-200">{filteredExpenses.length}</strong> مورد
              </div>
            </div>

            {/* Metric 4: Cash Drawer Balance & Discrepancy */}
            <div className={`border rounded-2xl p-4 flex flex-col justify-between shadow-sm ${
              report.discrepancyToman === undefined
                ? 'bg-stone-900 border-stone-800'
                : report.discrepancyToman === 0
                ? 'bg-emerald-950/20 border-emerald-800/60'
                : 'bg-rose-950/20 border-rose-800/60'
            }`}>
              <div className="flex items-center justify-between text-stone-400 mb-2">
                <span className="text-xs font-semibold">۴. تراز کشوی نقد فیزیکی</span>
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-stone-400">نقد مورد انتظار در پایان:</div>
                <div className="text-xl font-bold text-amber-400">
                  {formatToman(report.expectedCashToman)} <span className="text-xs font-normal text-stone-400">تومان</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  موجودی اولیه: {formatToman(report.openingCashToman)} تومان
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-stone-800 text-[11px]">
                {report.actualCashToman !== undefined && report.discrepancyToman !== undefined ? (
                  <div className="flex justify-between items-center">
                    <span>مغایرت شمارش:</span>
                    <span className={`font-bold ${report.discrepancyToman === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {report.discrepancyToman === 0
                        ? 'تراز کامل (بدون کسری)'
                        : `${formatToman(Math.abs(report.discrepancyToman))} تومان ${report.discrepancyToman < 0 ? 'کسری' : 'مازاد'}`}
                    </span>
                  </div>
                ) : (
                  <span className="text-amber-400">شیفت باز است (شمارش نشده)</span>
                )}
              </div>
            </div>

            {/* Metric 5: Shift Profit Summary (Net Order Revenue - Total Recorded Expenses) */}
            {(() => {
              const profitData = calculateShiftProfit(report.netRevenueToman, report.totalExpensesToman);
              const { profitToman, isProfitable, profitMarginPercent } = profitData;

              return (
                <div
                  className={`border rounded-2xl p-4 flex flex-col justify-between shadow-sm transition ${
                    isProfitable
                      ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-emerald-950/30 border-emerald-600/70 shadow-emerald-950/20 ring-1 ring-emerald-500/20'
                      : 'bg-gradient-to-b from-stone-900 via-stone-900 to-rose-950/30 border-rose-600/70 shadow-rose-950/20 ring-1 ring-rose-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-stone-400 mb-2">
                    <span className="text-xs font-semibold">۵. سود خالص شیفت (Profit)</span>
                    <Coins className={`w-4 h-4 ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`} />
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-2xl font-black font-mono ${
                          isProfitable ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfitable
                          ? `+ ${formatToman(profitToman)}`
                          : `- ${formatToman(Math.abs(profitToman))}`}
                      </span>
                      <span className="text-xs font-normal text-stone-400">تومان</span>
                    </div>

                    <div className="text-[11px] text-stone-400 mt-1 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span>درآمد خالص سفارشات:</span>
                        <strong className="text-stone-200 font-mono">{formatToman(report.netRevenueToman)} تومان</strong>
                      </div>
                      <div className="flex justify-between items-center text-rose-400/90">
                        <span>کسر کل هزینه‌ها:</span>
                        <strong className="font-mono">- {formatToman(report.totalExpensesToman)} تومان</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">حاشیه سود خالص:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                        isProfitable
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                      }`}
                    >
                      {profitMarginPercent}%
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 30-Day Daily Revenue Trend Line Chart */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
                    <span>روند درآمد روزانه (۳۰ روز اخیر)</span>
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      Recharts
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    نمودار خطی روند درآمد خالص فاکتورهای تسویه‌شده به تفکیک روز با مقادیر دقیق تومان
                  </p>
                </div>
              </div>

              {/* Summary KPI Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 flex items-center gap-1.5">
                  <span className="text-stone-400">مجموع ۳۰ روز:</span>
                  <strong className="text-amber-400 font-mono">
                    {formatToman(revenueTrends.totalRevenueToman)} تومان
                  </strong>
                </div>
                <div className="bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 flex items-center gap-1.5">
                  <span className="text-stone-400">میانگین روزانه:</span>
                  <strong className="text-stone-200 font-mono">
                    {formatToman(revenueTrends.averageDailyRevenueToman)} تومان
                  </strong>
                </div>
                <div className="bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 flex items-center gap-1.5">
                  <span className="text-stone-400">اوج فروش ({revenueTrends.peakDateLabel}):</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatToman(revenueTrends.peakDailyRevenueToman)} تومان
                  </strong>
                </div>
                <div className="bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 flex items-center gap-1.5">
                  <span className="text-stone-400">کل فاکتورها:</span>
                  <strong className="text-stone-200 font-mono">
                    {revenueTrends.totalCompletedOrders.toLocaleString('fa-IR')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Line Chart */}
            <div className="w-full h-72 pt-3" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={revenueTrends.dataPoints}
                  margin={{ top: 12, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="#78716c"
                    tick={{ fill: '#a8a29e', fontSize: 11 }}
                    tickMargin={10}
                    interval={2}
                    tickLine={false}
                    axisLine={{ stroke: '#44403c' }}
                  />
                  <YAxis
                    stroke="#78716c"
                    tick={{ fill: '#a8a29e', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#44403c' }}
                    domain={[0, 'auto']}
                    width={56}
                    tickFormatter={(val: number) => {
                      if (val === 0) return '۰';
                      if (val >= 1_000_000)
                        return `${(val / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} م`;
                      if (val >= 1_000)
                        return `${(val / 1_000).toLocaleString('fa-IR', { maximumFractionDigits: 0 })} هـ`;
                      return val.toLocaleString('fa-IR');
                    }}
                  />
                  <Tooltip content={<RevenueChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="درآمد خالص (تومان)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 1 }}
                    activeDot={{ r: 6, fill: '#fbbf24', stroke: '#d97706', strokeWidth: 2 }}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Shift Details & Order History Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Orders Search, Filter, and History Section (8 cols) */}
            <div className="lg:col-span-8 bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5">
              {/* Section Header with live statistics */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-stone-100">سوابق و جستجوی فاکتورهای فروش</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-stone-950 px-2.5 py-1 rounded-lg border border-stone-800 text-[11px]">
                    <span className="text-stone-400">یافت شد:</span>
                    <strong className="text-stone-200 font-mono">{filteredOrders.length} فاکتور</strong>
                    <span className="text-stone-600">|</span>
                    <span className="text-stone-400">مجموع خالص:</span>
                    <strong className="text-amber-400 font-mono">{formatToman(filteredTotalNetToman)} تومان</strong>
                  </div>

                  {/* Download CSV Button */}
                  <button
                    onClick={handleDownloadCSV}
                    disabled={filteredOrders.length === 0 || isCsvExporting}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition shadow-sm ${
                      filteredOrders.length === 0
                        ? 'bg-stone-950 text-stone-600 border border-stone-800 cursor-not-allowed opacity-50'
                        : csvExportSuccess
                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500 shadow-emerald-950/60'
                        : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-500/40 shadow-emerald-950/40'
                    }`}
                    title={
                      filteredOrders.length === 0
                        ? 'هیچ فاکتوری برای خروجی اکسل یافت نشد'
                        : `دانلود خروجی اکسل و CSV از ${filteredOrders.length} فاکتور فیلترشده جاری`
                    }
                  >
                    {csvExportSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>فایل ذخیره شد</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود CSV ({filteredOrders.length})</span>
                      </>
                    )}
                  </button>

                  {isFilterActive && (
                    <button
                      onClick={handleResetFilters}
                      className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/60 px-2 py-1 rounded-lg transition"
                      title="بازنشانی فیلترها"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>حذف فیلترها</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Controls Box */}
              <div className="bg-stone-950/80 p-3 rounded-xl border border-stone-800 flex flex-col gap-2.5">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="جستجو با شماره فاکتور (مثلاً #۱)، نام مشتری، شماره میز یا قلم کالا (مثلاً لاته)..."
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl pr-9 pl-8 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Selectors Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Date & Time Range Preset */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      <span>محدوده زمانی:</span>
                    </label>
                    <select
                      value={dateRangePreset}
                      onChange={(e) => setDateRangePreset(e.target.value as any)}
                      className="bg-stone-900 border border-stone-700 text-stone-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="current_shift">شیفت انتخابی جاری</option>
                      <option value="today">امروز (سفارشات ۲۴ ساعت اخیر)</option>
                      <option value="yesterday">دیروز</option>
                      <option value="last_7_days">۷ روز اخیر</option>
                      <option value="all">همه زمان‌ها (کل تاریخچه)</option>
                      <option value="custom">بازه سفارشی تاریخ و ساعت...</option>
                    </select>
                  </div>

                  {/* Order Type */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                      <Filter className="w-3 h-3 text-amber-500" />
                      <span>نوع سفارش:</span>
                    </label>
                    <select
                      value={orderTypeFilter}
                      onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                      className="bg-stone-900 border border-stone-700 text-stone-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="all">همه انواع (سالن و بیرون‌بر)</option>
                      <option value="DINE_IN">فقط سالن (میز)</option>
                      <option value="TAKEAWAY">فقط بیرون‌بر</option>
                    </select>
                  </div>

                  {/* Order Status */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                      <SlidersHorizontal className="w-3 h-3 text-amber-500" />
                      <span>وضعیت تسویه:</span>
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="bg-stone-900 border border-stone-700 text-stone-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="all">همه وضعیت‌ها</option>
                      <option value="COMPLETED">فقط فاکتورهای تسویه‌شده</option>
                      <option value="CANCELLED">فقط فاکتورهای لغوشده</option>
                    </select>
                  </div>
                </div>

                {/* Custom DateTime Range Pickers (Visible when 'custom' is selected) */}
                {dateRangePreset === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-stone-800 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>از تاریخ و ساعت (Start):</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={customStartDateTime}
                        onChange={(e) => setCustomStartDateTime(e.target.value)}
                        className="bg-stone-900 border border-stone-700 text-stone-200 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>تا تاریخ و ساعت (End):</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={customEndDateTime}
                        onChange={(e) => setCustomEndDateTime(e.target.value)}
                        className="bg-stone-900 border border-stone-700 text-stone-200 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                {filteredOrders.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2 border border-dashed border-stone-800 rounded-xl">
                    <Search className="w-6 h-6 text-stone-500" />
                    <span className="text-xs">هیچ سفارشی مطابق معیارهای جستجو و فیلتر یافت نشد.</span>
                    {isFilterActive && (
                      <button
                        onClick={handleResetFilters}
                        className="text-[11px] text-amber-400 hover:underline mt-1 font-semibold"
                      >
                        پاک کردن فیلترها و مشاهده همه
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-800 pb-2">
                        <th className="py-2 pr-2">شماره</th>
                        <th className="py-2">تاریخ و زمان</th>
                        <th className="py-2">مشتری / میز</th>
                        <th className="py-2">اقلام سفارش</th>
                        <th className="py-2">مبلغ ناخالص</th>
                        <th className="py-2">تخفیف</th>
                        <th className="py-2">خالص پرداختی</th>
                        <th className="py-2">وضعیت</th>
                        <th className="py-2 pl-2 text-left">چاپ فیش</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-stone-800/40 transition">
                          <td className="py-2.5 pr-2 font-mono font-bold text-amber-400">
                            #{order.orderNumber}
                          </td>
                          <td className="py-2.5 text-stone-400 font-mono text-[11px] whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString('fa-IR')} -{' '}
                            {new Date(order.createdAt).toLocaleTimeString('fa-IR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 text-stone-200">
                            {order.orderType === 'DINE_IN'
                              ? order.tableLabel
                              : `بیرون‌بر (${order.customerName || 'مشتری'})`}
                          </td>
                          <td className="py-2.5 text-stone-300">
                            {order.items.map((it) => `${it.quantity}× ${it.itemNameSnapshot}`).join('، ')}
                          </td>
                          <td className="py-2.5 text-stone-400 font-mono">
                            {formatToman(order.grossAmountToman)}
                          </td>
                          <td className="py-2.5 text-rose-400 font-mono">
                            {order.discountAmountToman > 0 ? `-${formatToman(order.discountAmountToman)}` : '۰'}
                          </td>
                          <td className="py-2.5 font-bold text-stone-100 font-mono">
                            {formatToman(order.netTotalToman)}
                          </td>
                          <td className="py-2.5">
                            {order.status === 'COMPLETED' ? (
                              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                                تسویه‌شده
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="bg-rose-950/60 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  لغوشده
                                </span>
                                {order.cancellationReason && (
                                  <span
                                    className="text-[9px] text-stone-400 mt-0.5 max-w-[120px] truncate"
                                    title={order.cancellationReason}
                                  >
                                    علت: {order.cancellationReason}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pl-2 text-left">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => {
                                  setPreviewOrder(order);
                                  const p = payments.find((pay) => pay.orderId === order.id);
                                  setPreviewPayment(p || null);
                                }}
                                className="bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-amber-400 p-1.5 rounded-lg border border-stone-700 transition inline-flex items-center gap-1 text-[11px]"
                                title="مشاهده و چاپ مجدد فیش"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>فیش</span>
                              </button>

                              {/* Manager cancellation button for completed orders */}
                              {order.status === 'COMPLETED' &&
                                (activeUser.role === 'OWNER' || activeUser.role === 'MANAGER') && (
                                  <button
                                    onClick={() => {
                                      setOrderToCancel(order);
                                      setCancellationReasonInput('');
                                      setCancelError('');
                                    }}
                                    className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white p-1.5 rounded-lg border border-rose-900/60 transition inline-flex items-center gap-1 text-[11px]"
                                    title="ابطال این سفارش"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>ابطال</span>
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {filteredOrders.length > 0 && (
                <div className="pt-2.5 border-t border-stone-800 flex flex-wrap items-center justify-between text-[11px] text-stone-400 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>
                      فایل CSV خروجی با کدگذاری استاندارد UTF-8 BOM جهت بازگشایی مستقیم در اکسل و حسابداری ذخیره می‌شود.
                    </span>
                  </div>
                  <button
                    onClick={handleDownloadCSV}
                    disabled={isCsvExporting}
                    className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:underline"
                    title="دانلود فایل فاکتورهای فیلترشده"
                  >
                    <Download className="w-3 h-3" />
                    <span>دریافت خروجی فاکتورها (CSV)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Expenses in this shift (4 cols) */}
            <div className="lg:col-span-4 bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-sm text-stone-100">هزینه‌های ثبت‌شده</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-bold font-mono">
                    {formatToman(report.totalExpensesToman)} تومان
                  </span>

                  <button
                    onClick={handleDownloadExpensesCSV}
                    disabled={filteredExpenses.length === 0 || isExpenseCsvExporting}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition shadow-sm ${
                      filteredExpenses.length === 0
                        ? 'bg-stone-950 text-stone-600 border border-stone-800 cursor-not-allowed opacity-50'
                        : expenseCsvExportSuccess
                        ? 'bg-rose-950/90 text-rose-300 border border-rose-500 shadow-rose-950/60'
                        : 'bg-rose-700 hover:bg-rose-600 active:scale-95 text-white border border-rose-500/40 shadow-rose-950/40'
                    }`}
                    title={
                      filteredExpenses.length === 0
                        ? 'هیچ هزینه‌ای برای خروجی اکسل یافت نشد'
                        : `دانلود خروجی اکسل و CSV از ${filteredExpenses.length} قلم هزینه`
                    }
                  >
                    {expenseCsvExportSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
                        <span>ذخیره شد</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV ({filteredExpenses.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto">
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 text-stone-400 text-xs">
                    هیچ هزینه‌ای برای این شیفت ثبت نشده است.
                  </div>
                ) : (
                  filteredExpenses.map((exp) => (
                    <div key={exp.id} className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 text-xs flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-stone-200">{exp.category}</span>
                        <span className="font-bold text-rose-400">{formatToman(exp.amountToman)} تومان</span>
                      </div>
                      <p className="text-[11px] text-stone-400">{exp.description}</p>
                      <div className="flex justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-800/80">
                        <span>ثبت توسط: {exp.recordedByUserName}</span>
                        <span>{exp.isPaidFromCashDrawer ? 'کسر از کشوی نقد' : 'پرداخت متفرقه'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {filteredExpenses.length > 0 && (
                <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
                  <span>کدگذاری استاندارد UTF-8 BOM</span>
                  <button
                    onClick={handleDownloadExpensesCSV}
                    disabled={isExpenseCsvExporting}
                    className="text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 hover:underline"
                    title="دانلود فایل اکسل هزینه‌های این شیفت"
                  >
                    <Download className="w-3 h-3" />
                    <span>دریافت فایل هزینه‌ها (CSV)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-stone-900 border border-stone-800 rounded-2xl text-stone-400">
          هیچ اطلاعاتی برای شیفت انتخاب‌شده موجود نیست.
        </div>
      )}

      {/* Reusable Receipt Preview Modal */}
      {previewOrder && (
        <ReceiptPreview
          order={previewOrder}
          payment={previewPayment}
          tenantName={tenant?.name}
          tenantPhone={tenant?.phone}
          tenantAddress={tenant?.address}
          onClose={() => {
            setPreviewOrder(null);
            setPreviewPayment(null);
          }}
        />
      )}

      {/* Cancellation Confirmation Modal */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-rose-900/80 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>ابطال رسمی فاکتور سفارش #{orderToCancel.orderNumber}</span>
              </div>
              <button onClick={() => setOrderToCancel(null)} className="text-stone-400 hover:text-stone-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-stone-300 leading-relaxed">
              با ابطال این سفارش، وضعیت فاکتور به «لغوشده» تغییر یافته و مبالغ آن از آمار درآمدی کسر می‌گردد. همچنین ردپای حسابرسی با نام شما ثبت خواهد شد.
            </p>

            <div className="flex justify-between bg-stone-950 p-2.5 rounded-xl border border-stone-800 text-stone-300">
              <span>مبلغ فاکتور:</span>
              <strong className="text-amber-400 font-mono">{formatToman(orderToCancel.netTotalToman)} تومان</strong>
            </div>

            {cancelError && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-300 p-2 rounded-lg text-xs">
                {cancelError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-300 font-semibold">* علت یا انگیزه ابطال سفارش (الزامی):</label>
              <textarea
                value={cancellationReasonInput}
                onChange={(e) => {
                  setCancelError('');
                  setCancellationReasonInput(e.target.value);
                }}
                rows={2}
                placeholder="مثلاً: انصراف مشتری به دلیل تأخیر، خطای صندوق‌دار در ثبت اقلام..."
                className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl font-medium"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!cancellationReasonInput.trim()) {
                    setCancelError('درج دلیل ابطال الزامی است.');
                    return;
                  }
                  if (onCancelOrder) {
                    onCancelOrder(orderToCancel.id, cancellationReasonInput.trim());
                  }
                  setOrderToCancel(null);
                }}
                className="flex-2 bg-rose-700 hover:bg-rose-600 text-white py-2.5 rounded-xl font-bold shadow transition"
              >
                تأیید نهایی ابطال فاکتور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Receipt Modal */}
      {shiftForSummaryReceipt && (
        <ShiftSummaryReceipt
          shift={shiftForSummaryReceipt}
          tenant={tenant}
          orders={orders}
          payments={payments}
          expenses={expenses}
          activeUser={activeUser}
          onClose={() => setShiftForSummaryReceipt(null)}
        />
      )}
    </div>
  );
};
