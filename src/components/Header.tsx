import React, { useState, useEffect } from 'react';
import { useOutboxSync } from '../hooks/useOutboxSync';
import { SyncStatusBarBadge } from './SyncStatusBarBadge';
import {
  Coffee,
  Clock,
  DollarSign,
  FileText,
  Shield,
  UtensilsCrossed,
  UserCheck,
  PowerOff,
  LogOut,
  Lock,
  Zap,
  Boxes,
  Settings,
  LayoutGrid,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Shift, User, Tenant, isManagerOrOwner } from '../types/domain';
import { formatToman } from '../services/financialMath';
import { PWAInstallButton } from './PWAInstallButton';
import { playPosBeep } from '../services/soundEffects';
import { FEATURES } from '../modules/smart-orders';
import { getActiveTenant } from '../config/tenantConfig';

interface HeaderProps {
  tenant: Tenant;
  activeShift: Shift | null;
  activeUser: User;
  allUsers: User[];
  currentTab: 'hub' | 'pos' | 'zero-g' | 'floor-plan' | 'reports' | 'menu' | 'audit' | 'inventory' | 'settings' | 'executive-pl';
  onTabChange: (tab: 'hub' | 'pos' | 'zero-g' | 'floor-plan' | 'reports' | 'menu' | 'audit' | 'inventory' | 'settings' | 'executive-pl') => void;
  onLockTerminal?: () => void;
  onOpenShiftModal: () => void;
  onOpenZReportModal?: () => void;
  onOpenExpenseModal: () => void;
  onOpenBackupModal: () => void;
  onOpenBaristaKds: () => void;
  onOpenTenantConfig?: () => void;
  baristaActiveCount?: number;
  onUserChange: (userId: string) => void;
  onUserSwitchRequest?: (userId: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tenant,
  activeShift,
  activeUser,
  allUsers,
  currentTab,
  onTabChange,
  onOpenShiftModal,
  onOpenZReportModal,
  onOpenExpenseModal,
  onOpenBackupModal,
  onOpenBaristaKds,
  onOpenTenantConfig,
  baristaActiveCount = 0,
  onUserChange,
  onUserSwitchRequest,
  onLockTerminal,
  onLogout,
}) => {
  const activeTenant = getActiveTenant();
  const { status: syncStatus, triggerFlush } = useOutboxSync(tenant.id);
  const isManager = isManagerOrOwner(activeUser.role);
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
    <header
      data-tenant={tenant.id}
      className="vision-glass-slab bg-[var(--color-header-bg,rgba(12,22,38,0.76))] border-b border-[var(--color-header-border,rgba(255,255,255,0.15))] sticky top-0 z-40 transition-all select-none shadow-xl"
    >
      {/* Top Main Brand & Control Bar */}
      <div className="max-w-[1720px] mx-auto px-3 md:px-5 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Branch Identity */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center bg-[rgba(12,20,35,0.7)] border border-white/15 px-3 py-1.5 rounded-xl shadow-inner backdrop-blur-md"
            style={{
              backgroundColor: activeTenant.palette.surfaceBg,
              borderColor: activeTenant.palette.borderHairline,
            }}
          >
            {/* Tenant Logo Badge */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center p-0.5 border"
                style={{
                  borderColor: activeTenant.palette.borderHairline,
                  backgroundColor: activeTenant.palette.primaryBg,
                }}
              >
                <img
                  src={activeTenant.receipt.logoPath}
                  alt={activeTenant.brandNameEn}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.src.endsWith('.svg')) {
                      img.src = activeTenant.receipt.logoPath.replace('.png', '.svg');
                    }
                  }}
                />
              </div>
              <div className="text-left font-black tracking-tighter leading-none pr-1">
                <span className="text-xl font-black" style={{ color: activeTenant.palette.accentColor }}>
                  {activeTenant.id === 'modendo' ? 'MODENDO' : '100'}
                </span>
                <span
                  className="text-[9px] block tracking-widest font-black uppercase"
                  style={{ color: activeTenant.palette.textMuted }}
                >
                  {activeTenant.id === 'modendo' ? 'CAFÉ' : 'HICH'}
                </span>
              </div>
            </div>
            <div className="h-6 w-[1.5px] bg-[#293444] mx-2.5" style={{ backgroundColor: activeTenant.palette.borderHairline }}></div>
            <div>
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5" style={{ color: activeTenant.palette.textPrimary }}>
                <span>{activeTenant.brandNameFa}</span>
                <span
                  className="text-[10px] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{ backgroundColor: activeTenant.palette.accentColor }}
                >
                  {activeTenant.id === 'modendo' ? 'MODENDO CAFÉ' : 'ROASTERS'}
                </span>
              </h1>
              <p className="text-[11px] text-[#9EACB8] flex items-center gap-1" style={{ color: activeTenant.palette.textMuted }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                <span>{activeTenant.id === 'modendo' ? 'تهران، خیابان شریعتی، مجتمع مودندو، منفی ۱' : (tenant.address || 'شعبه ۱: اکباتان - فاز ۱')}</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs dynamically decoupled for multi-tenant styling (RSK-05) */}
          <nav className="hidden lg:flex items-center bg-[var(--color-surface-card,rgba(12,20,35,0.65))] p-1.5 rounded-2xl border border-[var(--color-surface-border,rgba(255,255,255,0.12))] text-xs font-bold gap-2 backdrop-blur-xl shadow-inner font-sans" dir="rtl">
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('pos');
              }}
              style={currentTab === 'pos' ? {
                background: 'var(--color-tab-active-bg)',
                borderColor: 'var(--color-tab-active-border)',
                boxShadow: 'var(--glow-accent, 0 0 20px rgba(140,19,24,0.6))',
              } : undefined}
              className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-bold ${
                currentTab === 'pos'
                  ? 'border text-white'
                  : 'text-[#A0B2C6] hover:text-white hover:bg-white/10 border-transparent'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 text-[var(--color-brand-accent,#90D2ED)]" />
              <span>صندوق و بارتندر (POS)</span>
            </button>

            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('inventory');
                }}
                style={currentTab === 'inventory' ? {
                  background: 'var(--color-tab-active-bg)',
                  borderColor: 'var(--color-tab-active-border)',
                  boxShadow: 'var(--glow-accent, 0 0 20px rgba(140,19,24,0.6))',
                } : undefined}
                className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-bold ${
                  currentTab === 'inventory'
                    ? 'border text-white'
                    : 'text-[#A0B2C6] hover:text-white hover:bg-white/10 border-transparent'
                }`}
                title="مدیریت انبارداری و سنسوری (Sensory & BOM)"
              >
                <Boxes className="w-4 h-4 text-amber-400" />
                <span>انبارداری و سنسوری</span>
              </button>
            ) : (
              <button
                disabled
                title="مخصوص مدیر و مالک"
                className="px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-[#526071] bg-[#121417]/50 cursor-not-allowed opacity-60 border border-transparent"
              >
                <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                <span>انبارداری و سنسوری</span>
              </button>
            )}

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('settings');
              }}
              style={currentTab === 'settings' ? {
                background: 'var(--color-tab-active-bg)',
                borderColor: 'var(--color-tab-active-border)',
                boxShadow: 'var(--glow-accent, 0 0 20px rgba(140,19,24,0.6))',
              } : undefined}
              className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-bold ${
                currentTab === 'settings'
                  ? 'border text-white'
                  : 'text-[#A0B2C6] hover:text-white hover:bg-white/10 border-transparent'
              }`}
              title="تنظیمات سیستم، تجهیزات چاپگر و گیت امنیتی RBAC"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              <span>تنظیمات</span>
              {!isManager && <Lock className="w-2.5 h-2.5 text-amber-400" />}
            </button>
          </nav>
        </div>

        {/* Live Status, Clock & Actions */}
        <div className="flex items-center gap-2.5">
                    {/* AntiGravity Cloud Outbox Sync Badge */}
          <SyncStatusBarBadge status={syncStatus} onManualFlush={triggerFlush} />

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
          <div onClick={() => onUserSwitchRequest ? onUserSwitchRequest(activeUser.id) : onLockTerminal?.()} title="کلیک جهت قفل یا تغییر کاربر" className="hidden md:flex flex-col text-left pl-1 cursor-pointer hover:opacity-80 transition">
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

          {/* SaaS Tenant Intake Modal Trigger */}
          {onOpenTenantConfig && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenTenantConfig();
              }}
              className="flex items-center gap-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
              title="پذیرش و راه‌اندازی شعبه جدید (SaaS Onboarding)"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">شعبه جدید</span>
            </button>
          )}

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

          {/* Open / Close Shift / Z-Report Button */}
          <button
            onClick={() => {
              playPosBeep('click');
              if (activeShift) {
                if (onOpenZReportModal) {
                  onOpenZReportModal();
                } else {
                  onOpenShiftModal();
                }
              } else {
                onOpenShiftModal();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              activeShift
                ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/80 shadow-[0_0_12px_-2px_rgba(215,25,33,0.4)]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
            }`}
            title={activeShift ? 'بستن شیفت و صدور گزارش جامع Z-Report' : 'بازگشایی شیفت کاری جدید'}
          >
            {activeShift ? (
              <>
                <PowerOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">بستن شیفت / Z-Report</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>شروع شیفت</span>
              </>
            )}
          </button>

          {/* User & Role Switcher */}
          <div className="flex items-center gap-1 bg-[rgba(12,20,35,0.75)] border border-white/15 rounded-xl px-2.5 py-1 backdrop-blur-md shadow-inner">
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

          {/* Logout / Lock Button */}
          <button
            onClick={() => {
              playPosBeep('click');
              onLogout();
            }}
            className="flex items-center gap-1.5 bg-[rgba(20,32,54,0.75)] hover:bg-rose-950/70 text-[#CAD5E2] hover:text-rose-200 border border-white/15 hover:border-rose-600/60 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer vision-haptic-press"
            title="خروج از حساب و بازگشت به صفحه لاگین"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">خروج</span>
          </button>

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

      {/* Mobile Navigation Tabs dynamically decoupled for multi-tenant styling (RSK-05) */}
      <div className="lg:hidden border-t border-[var(--color-header-border,#293444)] px-4 py-2 flex items-center justify-around bg-[var(--color-header-bg,#081425)] text-xs font-bold font-sans" dir="rtl">
        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('pos');
          }}
          style={currentTab === 'pos' ? {
            background: 'var(--color-tab-active-bg)',
            borderColor: 'var(--color-tab-active-border)',
          } : undefined}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
            currentTab === 'pos' ? 'text-white shadow-md border' : 'text-[#9EACB8] border-transparent'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5 text-[var(--color-brand-accent,#90D2ED)]" />
          <span>صندوق و بارتندر (POS)</span>
        </button>

        {isManager ? (
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('inventory');
            }}
            style={currentTab === 'inventory' ? {
              background: 'var(--color-tab-active-bg)',
              borderColor: 'var(--color-tab-active-border)',
            } : undefined}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
              currentTab === 'inventory' ? 'text-white shadow-md border' : 'text-[#9EACB8] border-transparent'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-amber-400" />
            <span>انبارداری و سنسوری</span>
          </button>
        ) : (
          <button
            disabled
            className="px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[#526071] opacity-50 cursor-not-allowed"
            title="مخصوص مدیر و مالک"
          >
            <Lock className="w-3 h-3 text-amber-500/70" />
            <span>انبارداری و سنسوری</span>
          </button>
        )}

        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('settings');
          }}
          style={currentTab === 'settings' ? {
            background: 'var(--color-tab-active-bg)',
            borderColor: 'var(--color-tab-active-border)',
          } : undefined}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
            currentTab === 'settings' ? 'text-white shadow-md border' : 'text-[#9EACB8] border-transparent'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>تنظیمات</span>
          {!isManager && <Lock className="w-2.5 h-2.5 text-amber-400" />}
        </button>
      </div>
    </header>
  );
};
