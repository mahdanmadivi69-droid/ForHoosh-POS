import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Clock,
  DollarSign,
  FileText,
  Shield,
  UtensilsCrossed,
  UserCheck,
  PowerOff,
} from 'lucide-react';
import { Shift, User, Tenant } from '../types/domain';
import { formatToman } from '../services/financialMath';
import { PWAInstallButton } from './PWAInstallButton';
import { playPosBeep } from '../services/soundEffects';

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
  const [liveClock, setLiveClock] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setLiveClock(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#0F223D] border-b border-[#293444] sticky top-0 z-40 transition-all shadow-md select-none">
      {/* Top Main Brand & Control Bar */}
      <div className="max-w-[1720px] mx-auto px-3 md:px-5 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Branch Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#081425] border border-[#293444] px-3 py-1.5 rounded-lg">
            <div className="text-left font-black tracking-tighter leading-none pr-1">
              <span className="text-2xl font-black text-white">100</span>
              <span className="text-[10px] block text-[#D71921] tracking-widest font-black uppercase">
                HICH
              </span>
            </div>
            <div className="h-6 w-[1.5px] bg-[#293444] mx-2.5"></div>
            <div>
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>{tenant.name || 'قهوه‌فروشی صَد هیچ'}</span>
                <span className="text-[10px] bg-[#D71921] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  ROASTERS
                </span>
              </h1>
              <p className="text-[11px] text-[#9EACB8] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                <span>{tenant.address || 'شعبه ۱: اکباتان - فاز ۱ (پیتزا پیت باکس)'}</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs (POS, Reports, Menu, Audit) */}
          <nav className="hidden lg:flex items-center bg-[#121417] p-1 rounded-lg border border-[#293444] text-xs font-bold gap-1">
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('pos');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'pos'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>صندوق بارتندر (POS)</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('reports');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'reports'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>شیفت و گزارش مالی</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('menu');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'menu'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>مدیریت منو و قیمت‌ها</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('audit');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'audit'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>لاگ حسابرسی</span>
            </button>
          </nav>
        </div>

        {/* Live Status, Clock & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Shift Status Indicator */}
          {activeShift ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-800/60 text-emerald-400 px-2.5 py-1 rounded-lg text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold">
                شیفت فعال: {formatToman(activeShift.openingCashToman)} ت
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 bg-rose-950/50 border border-rose-800/60 text-rose-400 px-2.5 py-1 rounded-lg text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              <span>شیفت بسته است</span>
            </div>
          )}

          {/* Live Clock & Cashier Info */}
          <div className="hidden md:flex flex-col text-left pl-1">
            <span className="text-xs font-mono font-bold text-white num-heavy leading-tight">
              {liveClock || '00:00:00'}
            </span>
            <span className="text-[10px] text-[#9EACB8] leading-tight">
              {activeUser.fullName.split(' ')[0]} •{' '}
              {activeUser.role === 'OWNER'
                ? 'مالک'
                : activeUser.role === 'MANAGER'
                ? 'مدیر'
                : activeUser.role === 'CASHIER'
                ? 'صندوق‌دار'
                : 'باریستا'}
            </span>
          </div>

          {/* Barista KDS Trigger */}
          <button
            onClick={() => {
              playPosBeep('click');
              onOpenBaristaKds();
            }}
            className="flex items-center gap-1.5 bg-[#1B222C] hover:bg-[#222B38] text-white border border-[#293444] px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer relative"
            title="نمایشگر زنده بار باریستا (KDS)"
          >
            <Coffee className="w-3.5 h-3.5 text-[#F3E9DD]" />
            <span className="hidden sm:inline">بار باریستا</span>
            {baristaActiveCount > 0 ? (
              <span className="bg-[#D71921] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-[0_0_8px_rgba(215,25,33,0.8)]">
                {baristaActiveCount}
              </span>
            ) : (
              <span className="text-[10px] text-[#9EACB8]">KDS</span>
            )}
          </button>

          {/* Expense Modal Button */}
          {activeShift && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenExpenseModal();
              }}
              className="hidden lg:flex items-center gap-1 bg-[#1B222C] hover:bg-[#222B38] text-rose-300 border border-[#293444] px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
              title="ثبت هزینه تنخواه از صندوق نقد"
            >
              <DollarSign className="w-3.5 h-3.5 text-rose-400" />
              <span>هزینه تنخواه</span>
            </button>
          )}

          {/* Open / Close Shift Button */}
          <button
            onClick={() => {
              playPosBeep('click');
              onOpenShiftModal();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              activeShift
                ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/80'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
            }`}
          >
            {activeShift ? (
              <>
                <PowerOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">بستن شیفت</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>شروع شیفت</span>
              </>
            )}
          </button>

          {/* User & Role Switcher */}
          <div className="flex items-center gap-1 bg-[#121417] border border-[#293444] rounded-lg px-2 py-1">
            <UserCheck className="w-3.5 h-3.5 text-[#9EACB8]" />
            <select
              value={activeUser.id}
              onChange={(e) => onUserChange(e.target.value)}
              className="bg-transparent text-white focus:outline-none text-xs font-semibold cursor-pointer max-w-[110px] truncate"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#1B222C] text-white">
                  {u.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Backup Button (for Owner & Manager) */}
          {(activeUser.role === 'OWNER' || activeUser.role === 'MANAGER') && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenBackupModal();
              }}
              className="hidden xl:flex items-center gap-1 bg-[#1B222C] hover:bg-[#222B38] text-[#F3E9DD] border border-[#293444] rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer"
              title="پشتیبان‌گیری و بازیابی اطلاعات"
            >
              <Shield className="w-3.5 h-3.5 text-[#F3E9DD]" />
              <span>پشتیبان</span>
            </button>
          )}

          {/* In-app PWA install button */}
          <PWAInstallButton />
        </div>
      </div>

      {/* Mobile Navigation Tabs (visible only on small screens) */}
      <div className="lg:hidden border-t border-[#293444] px-3 py-1.5 flex items-center justify-around bg-[#081425] text-xs font-bold overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('pos');
          }}
          className={`px-2.5 py-1 rounded flex items-center gap-1 ${
            currentTab === 'pos' ? 'bg-[#D71921] text-white' : 'text-[#9EACB8]'
          }`}
        >
          <UtensilsCrossed className="w-3 h-3" />
          <span>صندوق (POS)</span>
        </button>

        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('reports');
          }}
          className={`px-2.5 py-1 rounded flex items-center gap-1 ${
            currentTab === 'reports' ? 'bg-[#D71921] text-white' : 'text-[#9EACB8]'
          }`}
        >
          <FileText className="w-3 h-3" />
          <span>گزارشات</span>
        </button>

        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('menu');
          }}
          className={`px-2.5 py-1 rounded flex items-center gap-1 ${
            currentTab === 'menu' ? 'bg-[#D71921] text-white' : 'text-[#9EACB8]'
          }`}
        >
          <Coffee className="w-3 h-3" />
          <span>منو</span>
        </button>

        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('audit');
          }}
          className={`px-2.5 py-1 rounded flex items-center gap-1 ${
            currentTab === 'audit' ? 'bg-[#D71921] text-white' : 'text-[#9EACB8]'
          }`}
        >
          <Shield className="w-3 h-3" />
          <span>حسابرسی</span>
        </button>
      </div>
    </header>
  );
};
