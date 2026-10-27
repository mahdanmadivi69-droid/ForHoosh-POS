import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  UserCheck,
  Search,
  Filter,
  AlertTriangle,
  PackageX,
  CheckCircle2,
  AlertOctagon,
  FileSpreadsheet,
} from 'lucide-react';
import { AuditLog } from '../types/domain';
import { websocketServer } from '../services/websocket-server';
import { SmartOrdersStore } from '../services/storage';

interface AuditLogViewProps {
  logs: AuditLog[];
  onRefreshLogs?: () => void;
}

interface DiscrepancyCardData {
  id: string;
  timestamp: string;
  orderId?: string;
  conflicts: Array<{
    type: string;
    message: string;
    details: {
      productId: string;
      productName: string;
      requested: number;
      available: number;
      deficit: number;
    };
  }>;
  resolved: boolean;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, onRefreshLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyCardData[]>([]);

  useEffect(() => {
    // 1. Load any recent discrepancy messages from memory
    const recent = websocketServer.getRecentMessages();
    const discrepancyMsgs = recent.filter(
      (m) => m.event === 'AUDIT_DISCREPANCY_CREATED' && m.payload?.conflicts
    );

    const initialCards: DiscrepancyCardData[] = discrepancyMsgs.map((m, idx) => ({
      id: `incident-${idx}-${Date.now()}`,
      timestamp: m.timestamp,
      conflicts: m.payload.conflicts,
      resolved: false,
    }));

    // 2. Also check if existing audit logs contain STOCKOUT_OVERDRAFT entries
    const overdraftLogs = logs.filter((l) => l.action === 'STOCKOUT_OVERDRAFT');
    if (overdraftLogs.length > 0 && initialCards.length === 0) {
      initialCards.push({
        id: 'incident-historical',
        timestamp: overdraftLogs[0].createdAt,
        conflicts: overdraftLogs.map((l) => ({
          type: 'STOCKOUT_OVERDRAFT',
          message: l.details,
          details: {
            productId: l.entityId || 'prod-offline',
            productName: l.entityName || 'آیتم منو',
            requested: 1,
            available: 0,
            deficit: 1,
          },
        })),
        resolved: false,
      });
    }

    setDiscrepancies(initialCards);

    // 3. Subscribe to real-time events
    const unsub = websocketServer.subscribeToEvent('AUDIT_DISCREPANCY_CREATED', (payload, msg) => {
      if (payload && payload.conflicts) {
        const newCard: DiscrepancyCardData = {
          id: `incident-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: msg.timestamp,
          conflicts: payload.conflicts,
          resolved: false,
        };
        setDiscrepancies((prev) => [newCard, ...prev]);
      }
    });

    return () => unsub();
  }, [logs]);

  const handleResolveIncident = (incidentId: string) => {
    const activeUser = SmartOrdersStore.getActiveUser();
    SmartOrdersStore.addAuditLog(
      'STOCKOUT_OVERDRAFT_RESOLVED',
      'InventoryIncident',
      incidentId,
      `تایید و تسویه مغایرت کسری انبار آفلاین توسط ${activeUser.fullName} (سرپرست شیفت)`
    );

    setDiscrepancies((prev) =>
      prev.map((d) => (d.id === incidentId ? { ...d, resolved: true } : d))
    );

    if (onRefreshLogs) {
      onRefreshLogs();
    }
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      !searchQuery ||
      l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'all' || l.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const unresolvedDiscrepancies = discrepancies.filter((d) => !d.resolved);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5" dir="rtl">
      {/* Header bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-stone-100">سامانه ردپای حسابرسی و امنیت مالی (Audit Trail)</h2>
            <p className="text-xs text-stone-400">
              ثبت غیرقابل تغییر و بلادرنگ رویدادهای مالی، تغییر شیفت، ثبت پرداخت، و مغایرت‌های انبار
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در لاگ‌ها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1.5 text-xs text-stone-300 focus:outline-none"
          >
            <option value="all">همه رویدادها</option>
            <option value="STOCKOUT_OVERDRAFT">مغایرت کسری انبار (Overdraft)</option>
            <option value="SHIFT_OPENED">بازگشایی شیفت</option>
            <option value="SHIFT_CLOSED">بستن شیفت</option>
            <option value="ORDER_CREATED">ثبت سفارش</option>
            <option value="ORDER_PAID">تسویه پرداخت</option>
            <option value="ORDER_CANCELLED">ابطال سفارش</option>
            <option value="EXPENSE_RECORDED">ثبت هزینه</option>
            <option value="STOCK_ADJUSTED">تنظیم موجودی انبار</option>
            <option value="MENU_ITEM_UPDATED">تغییر منو</option>
          </select>
        </div>
      </div>

      {/* Discrepancy Incident Cards for Shift Managers */}
      {unresolvedDiscrepancies.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-rose-900/60">
            <div className="flex items-center gap-2.5 text-rose-300 font-bold text-sm">
              <AlertOctagon className="w-5 h-5 text-rose-400 animate-pulse" />
              <span>کارت‌های مغایرت کسری انبار همگام‌سازی آفلاین (Shift Manager Discrepancy Audit)</span>
            </div>
            <span className="bg-rose-900/60 border border-rose-700/60 text-rose-200 px-2.5 py-0.5 rounded-full text-xs font-mono">
              {unresolvedDiscrepancies.length} مغایرت در انتظار رسیدگی
            </span>
          </div>

          <p className="text-xs text-stone-300 leading-relaxed">
            به دلیل فروش در زمان قطعی شبکه اینترنت، موجودی کالا در انبار منفی شده است. طبق استاندارد حسابداری سیستم، مبالغ مالی بدون تغییر در دفاتر ثبت گردیده و بررسی و اصلاح موجودی فیزیکی به عهده سرپرست شیفت قرار داده شده است.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            {unresolvedDiscrepancies.map((incident) => (
              <div
                key={incident.id}
                className="bg-stone-950/80 border border-rose-800/60 rounded-xl p-3.5 flex flex-col justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800 text-[11px] text-stone-400">
                    <span className="font-mono text-rose-300 font-semibold">
                      کد رخداد: {incident.id.slice(0, 16)}
                    </span>
                    <span className="font-mono">
                      {new Date(incident.timestamp).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {incident.conflicts.map((c, idx) => (
                      <div
                        key={idx}
                        className="bg-rose-950/60 border border-rose-800/50 rounded-lg p-2 text-stone-200"
                      >
                        <div className="flex items-center justify-between font-bold text-rose-200">
                          <span>{c.details?.productName || 'محصول کسری'}</span>
                          <span className="text-rose-400 font-mono">
                            کسری: {c.details?.deficit?.toLocaleString('fa-IR') ?? '۱'} عدد
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1">
                          درخواست آفلاین: {c.details?.requested ?? 1} | موجودی قبل از سینک: {c.details?.available ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-400/90 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>نیازمند اصلاح یا تایید شارژ مجدد</span>
                  </span>

                  <button
                    onClick={() => handleResolveIncident(incident.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تایید و تسویه مغایرت</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-stone-950/60 text-stone-400 border-b border-stone-800">
                <th className="py-3 pr-4">زمان ثبت</th>
                <th className="py-3">کاربر عامل</th>
                <th className="py-3">نوع عملیات (Action)</th>
                <th className="py-3">موجودیت (Entity)</th>
                <th className="py-3 pl-4">شرح رویداد و جزئیات حسابرسی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredLogs.map((log) => {
                const isOverdraft =
                  log.action === 'STOCKOUT_OVERDRAFT' ||
                  log.action === 'STOCKOUT_OVERDRAFT_RESOLVED';

                return (
                  <tr
                    key={log.id}
                    className={`transition ${
                      isOverdraft ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-stone-850/50'
                    }`}
                  >
                    <td className="py-3 pr-4 text-stone-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('fa-IR')} -{' '}
                      {new Date(log.createdAt).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-stone-200">{log.userName}</span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`border px-2 py-0.5 rounded text-[10px] font-mono ${
                          log.action === 'STOCKOUT_OVERDRAFT'
                            ? 'bg-rose-950 border-rose-700 text-rose-300 font-bold'
                            : log.action === 'STOCKOUT_OVERDRAFT_RESOLVED'
                            ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                            : 'bg-stone-800 border-stone-700 text-stone-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 text-stone-400 font-mono text-[11px]">{log.entityName}</td>
                    <td className="py-3 pl-4 text-stone-300 leading-relaxed">{log.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

