import React, { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, X, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SmartOrdersStore } from '../services/storage';
import { User } from '../types/domain';

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

  if (!isOpen) return null;

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

  const handleResetDemo = () => {
    if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام داده‌ها را به نسخه آزمایشی اولیه بازنشانی کنید؟ تمام سوابق فعلی جایگزین خواهند شد.')) {
      SmartOrdersStore.resetDatabaseToSeed();
      setFeedback({ type: 'success', message: 'اطلاعات با موفقیت به داده‌های اولیه بازنشانی شد.' });
      onDataRestored();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 text-xs">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2 text-stone-100 font-bold text-sm">
            <Shield className="w-5 h-5 text-amber-500" />
            <span>مدیریت پشتیبان‌گیری و بازیابی داده‌ها (Backup & Recovery)</span>
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
          {/* Export card */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-200">۱. دانلود فایل پشتیبان کامل (JSON)</span>
              <Download className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              شامل تمام اطلاعات کافه، قیمت‌های منو، شیفت‌های کاری، فاکتورهای فروش، دریافتی‌های صندوق و لاگ‌های حسابرسی.
            </p>
            <button
              onClick={handleExport}
              className="bg-amber-600 hover:bg-amber-500 text-white py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition mt-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود آنی فایل پشتیبان</span>
            </button>
          </div>

          {/* Import card */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-200">۲. بازیابی از فایل پشتیبان (Restore)</span>
              <Upload className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              انتخاب یک فایل JSON پشتیبان قبلی و بارگذاری مجدد دیتابیس در سامانه.
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
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>انتخاب و بارگذاری فایل پشتیبان</span>
            </button>
          </div>

          {/* Reset Demo card */}
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-stone-300 block">بازنشانی به داده‌های آزمایشی اولیه</span>
              <span className="text-[10px] text-stone-500">پاکسازی دیتای فعلی و بارگذاری کافه نارنج</span>
            </div>
            <button
              onClick={handleResetDemo}
              className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/60 py-1.5 px-3 rounded-lg font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>بازنشانی</span>
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
