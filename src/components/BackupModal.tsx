import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Upload,
  X,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  RefreshCw,
  Database,
  Clock,
  History,
  Check,
} from 'lucide-react';
import { SmartOrdersStore } from '../services/storage';
import { User } from '../types/domain';
import { dailyBackupScheduler, CloudSyncStatus } from '../services/dailyBackupScheduler';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: User;
  onDataRestored: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  onDataRestored,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Subscribe to cloud scheduler status & load history
  useEffect(() => {
    if (!isOpen) return;

    const unsub = dailyBackupScheduler.subscribe((status) => {
      setCloudStatus(status);
    });

    dailyBackupScheduler.checkCloudStatus();
    loadCloudHistory();

    return () => unsub();
  }, [isOpen]);

  const loadCloudHistory = async () => {
    const list = await dailyBackupScheduler.getCloudBackupHistory();
    setCloudHistory(list);
  };

  if (!isOpen) return null;

  const handleManualCloudBackup = async () => {
    setIsCloudSyncing(true);
    setFeedback(null);
    try {
      const res = await dailyBackupScheduler.triggerDailyBackup();
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await loadCloudHistory();
        onDataRestored();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `خطا در پشتیبان‌گیری ابری: ${err.message}` });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleTriggerQueueSync = async () => {
    setIsCloudSyncing(true);
    setFeedback(null);
    try {
      await dailyBackupScheduler.triggerQueueSync();
      setFeedback({ type: 'success', message: 'صف سفارش‌های آفلاین با سرور ابری همگام شد.' });
      onDataRestored();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `خطا در همگام‌سازی صف: ${err.message}` });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleExport = () => {
    try {
      const json = SmartOrdersStore.exportBackupData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `smartorders-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback({ type: 'success', message: 'فایل پشتیبان با موفقیت دانلود شد.' });
      onDataRestored();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `خطا در ایجاد پشتیبان: ${err.message}` });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = SmartOrdersStore.importBackupData(content);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
        onDataRestored();
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'خطا در خواندن فایل پشتیبان انتخاب‌شده.' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatPersianDate = (isoString?: string | null) => {
    if (!isoString) return 'هنوز ثبت نشده';
    try {
      return new Date(isoString).toLocaleString('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 text-xs font-sans">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2 text-stone-100 font-bold text-sm">
            <Shield className="w-5 h-5 text-amber-500" />
            <span>مدیریت پشتیبان‌گیری ابری و بازیابی داده‌ها (Cloud Backup & Sync)</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/50 border-rose-800 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* 1. Cloud PostgreSQL Periodic Backup Card */}
          <div className="bg-gradient-to-br from-stone-950 to-stone-900 p-4 rounded-xl border border-sky-900/40 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                <span className="font-semibold text-stone-200">۱. اتصال دیتابیس ابری PostgreSQL (بک‌آپ روزانه خودکار)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    cloudStatus?.isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[11px] font-mono text-stone-300">
                  {cloudStatus?.isCloudConnected ? 'PostgreSQL ابری (RLS فعال)' : 'حالت آماده‌باش / محلی'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              صف آفلاین کلاینت به‌صورت خودکار هر ۱۵ ثانیه بررسی شده و نسخه پشتیبان کامل روزانه (فاکتورها، شیفت‌ها، پرداخت‌ها، بهای تمام‌شده و لاگ‌های امنیتی) با جداسازی چندمستاجره به دیتابیس ابری PostgreSQL ارسال می‌شود.
            </p>

            {/* Metrics pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-stone-900/80 p-2.5 rounded-lg border border-stone-800 text-[11px]">
              <div>
                <span className="text-stone-500 block">صف آفلاین کلاینت:</span>
                <span className="font-bold text-stone-200">
                  {cloudStatus?.queueStats?.pending ? (
                    <span className="text-amber-400">{cloudStatus.queueStats.pending} سفارش در انتظار</span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3 inline" /> تمام سفارش‌ها همگام هستند
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">آخرین بک‌آپ ابری:</span>
                <span className="font-mono text-stone-300 text-[10px]">
                  {formatPersianDate(cloudStatus?.lastBackupAt)}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">وضعیت صف دوره‌ای:</span>
                <span className="text-sky-400 font-medium">فعال (هر ۱۵ ثانیه)</span>
              </div>
            </div>

            {/* Cloud action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleManualCloudBackup}
                disabled={isCloudSyncing}
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Cloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                <span>{isCloudSyncing ? 'در حال ارسال به سرور ابری...' : 'ارسال فوری بک‌آپ به سرور ابری'}</span>
              </button>
              <button
                onClick={handleTriggerQueueSync}
                disabled={isCloudSyncing}
                className="bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 border border-stone-700 py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-stone-400 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                <span>تخلیه و همگام‌سازی صف</span>
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 py-2 px-3 rounded-lg font-medium flex items-center gap-1.5 transition text-[11px]"
              >
                <History className="w-3.5 h-3.5 text-stone-400" />
                <span>سوابق ابری ({cloudHistory.length})</span>
              </button>
            </div>

            {/* History drawer if opened */}
            {showHistory && (
              <div className="mt-2 bg-stone-900 border border-stone-800 rounded-lg p-2.5 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                <span className="text-stone-400 font-semibold text-[10px] block mb-1">
                  سوابق آخرین بک‌آپ‌های روزانه در PostgreSQL:
                </span>
                {cloudHistory.length === 0 ? (
                  <span className="text-stone-500 text-[10px]">هیچ بک‌آپ روزانه‌ای هنوز در دیتابیس ابری ثبت نشده است.</span>
                ) : (
                  cloudHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between py-1 px-2 rounded bg-stone-950/70 border border-stone-800/80 text-[10px]"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-sky-400" />
                        <span className="font-mono text-stone-200">{item.backupDate || item.backup_date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-stone-400">{item.totalOrders || item.total_orders || 0} سفارش</span>
                        <span className="text-emerald-400 font-mono font-medium">
                          {(item.totalRevenueToman || item.total_revenue_toman || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. Export local JSON card */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-200">۲. دانلود فایل پشتیبان آفلاین (JSON)</span>
              <Download className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              ذخیره محلی فایل JSON شامل تمام اطلاعات کافه، قیمت‌های منو، شیفت‌های کاری، فاکتورهای فروش، دریافتی‌های صندوق و لاگ‌های حسابرسی روی رایانه.
            </p>
            <button
              onClick={handleExport}
              className="bg-amber-600 hover:bg-amber-500 text-white py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition mt-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود فایل پشتیبان آفلاین</span>
            </button>
          </div>

          {/* 3. Import local JSON card */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-200">۳. بازیابی از فایل پشتیبان (Restore)</span>
              <Upload className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              انتخاب یک فایل JSON پشتیبان قبلی و بازگردانی کلیه جداول و تنظیمات کافه در مرورگر.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition mt-1"
            >
              <Upload className="w-3.5 h-3.5 text-teal-400" />
              <span>انتخاب و بارگذاری فایل پشتیبان</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-stone-800">
          <button
            onClick={onClose}
            className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 rounded-xl font-medium transition"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
