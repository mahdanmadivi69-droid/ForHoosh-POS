import React from 'react';
import {
  Coffee,
  Clock,
  DollarSign,
  PlusCircle,
  FileText,
  Shield,
  UtensilsCrossed,
  UserCheck,
  PowerOff,
  Store,
} from 'lucide-react';
import { Shift, User, Tenant } from '../types/domain';
import { formatToman } from '../services/financialMath';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  tenant: Tenant;
  activeShift: Shift | null;
  activeUser: User;
  allUsers: User[];
  currentTab: 'pos' | 'reports' | 'menu' | 'audit';
  onTabChange: (tab: 'pos' | 'reports' | 'menu' | 'audit') => void;
  onOpenShiftModal: () => void;
  onOpenExpenseModal: () => void;
  onOpenBackupModal: () => void;
  onOpenBaristaKds: () => void;
  baristaActiveCount?: number;
  onUserChange: (userId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  tenant,
  activeShift,
  activeUser,
  allUsers,
  currentTab,
  onTabChange,
  onOpenShiftModal,
  onOpenExpenseModal,
  onOpenBackupModal,
  onOpenBaristaKds,
  baristaActiveCount = 0,
  onUserChange,
}) => {
  return (
    <header className="bg-stone-900 border-b border-stone-800 sticky top-0 z-30 shadow-md">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-stone-800/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm tracking-wide">
            <Coffee className="w-5 h-5 text-amber-500" />
            <span>SmartOrders</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
              MVP v1.0
            </span>
          </div>

          <div className="h-4 w-px bg-stone-700 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-stone-300">
            <Store className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-medium text-stone-200">{tenant.name}</span>
          </div>
        </div>

        {/* Shift Status & Role Selection */}
        <div className="flex items-center gap-3">
          {activeShift ? (
            <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 px-2.5 py-1 rounded-md text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>شیفت فعال:</span>
              <span className="font-semibold text-emerald-300">
                موجودی اولیه {formatToman(activeShift.openingCashToman)} تومان
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-800/50 text-rose-400 px-2.5 py-1 rounded-md text-xs">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>شیفت کاری بسته است</span>
            </div>
          )}

          {/* User & Role Switcher */}
          <div className="flex items-center gap-1.5 bg-stone-800 border border-stone-700 rounded-md px-2 py-0.5">
            <UserCheck className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400">کاربر:</span>
            <select
              value={activeUser.id}
              onChange={(e) => onUserChange(e.target.value)}
              className="bg-transparent text-stone-200 focus:outline-none text-xs font-medium cursor-pointer"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-stone-800 text-stone-100">
                  {u.fullName} ({u.role === 'OWNER' ? 'مالک' : u.role === 'MANAGER' ? 'مدیر شیفت' : u.role === 'CASHIER' ? 'صندوق‌دار' : 'باریستا'})
                </option>
              ))}
            </select>
          </div>

          {/* PWA In-App Install Button */}
          <PWAInstallButton />

          {/* Backup & Restore button (for Owner & Manager) */}
          {(activeUser.role === 'OWNER' || activeUser.role === 'MANAGER') && (
            <button
              onClick={onOpenBackupModal}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer"
              title="پشتیبان‌گیری و بازیابی اطلاعات کافه"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>پشتیبان‌گیری</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation & Quick Action Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-stone-950/60 p-1 rounded-lg border border-stone-800">
          <button
            onClick={() => onTabChange('pos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              currentTab === 'pos'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>صندوق فروش (POS)</span>
          </button>

          <button
            onClick={() => onTabChange('reports')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              currentTab === 'reports'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>شیفت و گزارش مالی</span>
          </button>

          <button
            onClick={() => onTabChange('menu')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              currentTab === 'menu'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <Coffee className="w-4 h-4" />
            <span>مدیریت منو و قیمت‌ها</span>
          </button>

          <button
            onClick={() => onTabChange('audit')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all ${
              currentTab === 'audit'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>لاگ حسابرسی</span>
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Barista Bar KDS Modal Button */}
          <button
            onClick={onOpenBaristaKds}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 px-3 py-1.5 rounded-md text-xs font-semibold transition relative cursor-pointer"
            title="نمایشگر بار باریستا (KDS) و دریافت زنده فیش‌های تسویه‌شده"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            <span>بار باریستا</span>
            {baristaActiveCount > 0 ? (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {baristaActiveCount}
              </span>
            ) : (
              <span className="text-[10px] text-stone-400">KDS</span>
            )}
          </button>

          {activeShift && (
            <button
              onClick={onOpenExpenseModal}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-rose-400" />
              <span>ثبت هزینه تنخواه</span>
            </button>
          )}

          <button
            onClick={onOpenShiftModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeShift
                ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
            }`}
          >
            {activeShift ? (
              <>
                <PowerOff className="w-3.5 h-3.5" />
                <span>بستن و شمارش شیفت</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>باز کردن شیفت کاری</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
