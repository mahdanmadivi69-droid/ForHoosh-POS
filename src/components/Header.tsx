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
      className="vision-glass-slab border-b border-white/15 sticky top-0 z-40 transition-all select-none shadow-xl"
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

          {/* Navigation Tabs (POS, Reports, Menu, Audit) */}
          <nav className="hidden lg:flex items-center bg-[rgba(12,20,35,0.65)] p-1 rounded-xl border border-white/12 text-xs font-bold gap-1 backdrop-blur-xl shadow-inner">
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('pos');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'pos'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-[0_0_20px_rgba(140,19,24,0.6),0_0_10px_rgba(158,138,94,0.4)]'
                  : 'text-[#A0B2C6] hover:text-white hover:bg-white/10'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>صندوق بارتندر (POS)</span>
            </button>

            {FEATURES.ENABLE_ZERO_G_SMART_ORDERS && (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('zero-g');
                }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                  currentTab === 'zero-g'
                    ? 'bg-gradient-to-r from-[var(--color-brand-primary,#D71921)] to-[var(--color-brand-primary-hover,#E52E38)] text-white shadow-[0_0_15px_-2px_var(--color-brand-primary-light,rgba(215,25,33,0.6))] ring-1 ring-red-400'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-[#1B222C] border border-amber-500/30'
                }`}
                title="سامانه مافوق سریع Zero-G (کلیدهای ۱ تا ۹ بدون تأخیر)"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Zero-G سریع</span>
                <span className="text-[9px] bg-red-600/90 text-white px-1 py-0.2 rounded font-mono">
                  &lt;1ms
                </span>
              </button>
            )}

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('floor-plan');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                currentTab === 'floor-plan'
                  ? 'bg-emerald-600 text-white shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>نقشه سالن (Floor Plan)</span>
            </button>

            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('reports');
                }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'reports' ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-md' : 'text-[#A0B2C6] hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>شیفت و گزارش مالی</span>
              </button>
            ) : (
              <button
                disabled
                title="گزارش مالی و شیفت فقط برای مدیر و مالک مجاز است"
                className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[#526071] bg-[#121417]/50 cursor-not-allowed opacity-60 border border-transparent"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>گزارش مالی (قفل)</span>
              </button>
            )}

            {/* Menu tab: Accessible only to Owner & Manager */}
            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('menu');
                }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'menu' ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-md' : 'text-[#A0B2C6] hover:text-white hover:bg-white/10'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>مدیریت منو و قیمت‌ها</span>
              </button>
            ) : (
              <button
                disabled
                title="مخصوص مدیر و مالک (برای صندوق‌دار و باریستا قفل است)"
                className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[#526071] bg-[#121417]/50 cursor-not-allowed opacity-60 border border-transparent"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>منو (قفل مدیر)</span>
              </button>
            )}

            {/* Audit tab: Accessible only to Owner & Manager */}
            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('audit');
                }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'audit' ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-md' : 'text-[#A0B2C6] hover:text-white hover:bg-white/10'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>لاگ حسابرسی</span>
              </button>
            ) : (
              <button
                disabled
                title="مخصوص مدیر و مالک (برای صندوق‌دار و باریستا قفل است)"
                className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[#526071] bg-[#121417]/50 cursor-not-allowed opacity-60 border border-transparent"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>حسابرسی (قفل)</span>
              </button>
            )}

            {/* Warehouse & Stock BOM tab: Accessible to Owner & Manager */}
            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('inventory');
                }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'inventory' ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-md' : 'text-[#A0B2C6] hover:text-white hover:bg-white/10'
                }`}
                title="مدیریت انبارداری و فرمولاسیون رسپی (BOM)"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>انبارداری و رسپی (BOM)</span>
              </button>
            ) : (
              <button
                disabled
                title="مخصوص مدیر و مالک (برای صندوق‌دار و باریستا قفل است)"
                className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[#526071] bg-[#121417]/50 cursor-not-allowed opacity-60 border border-transparent"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>انبار (قفل)</span>
              </button>
            )}

            {/* Settings & Hardware Hub tab */}
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('settings');
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'settings' ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-md' : 'text-[#A0B2C6] hover:text-white hover:bg-white/10'
              }`}
              title="تنظیمات سیستم، تجهیزات چاپگر و گیت امنیتی RBAC"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>تنظیمات و سخت‌افزار</span>
              {!isManager && (
                <Lock className="w-2.5 h-2.5 text-amber-400" />
              )}
            </button>

            {/* Executive P&L Board Tab */}
            {isManager && (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('executive-pl');
                }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'executive-pl'
                    ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                    : 'text-[#9EACB8] hover:text-white hover:bg-[#1B222C]'
                }`}
                title="داشبورد یکپارچه سود و زیان (Executive P&L Board)"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>داشبورد P&amp;L</span>
              </button>
            )}
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

        {FEATURES.ENABLE_ZERO_G_SMART_ORDERS && (
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('zero-g');
            }}
            className={`px-2.5 py-1 rounded flex items-center gap-1 ${
              currentTab === 'zero-g'
                ? 'bg-[#D71921] text-white'
                : 'text-amber-400 border border-amber-500/30'
            }`}
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>Zero-G</span>
          </button>
        )}

        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('floor-plan');
          }}
          className={`px-2.5 py-1 rounded flex items-center gap-1 ${
            currentTab === 'floor-plan' ? 'bg-emerald-600 text-white' : 'text-[#9EACB8]'
          }`}
        >
          <LayoutGrid className="w-3 h-3" />
          <span>نقشه سالن</span>
        </button>

        {isManager ? (
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
        ) : (
          <button
            disabled
            title="گزارش مالی فقط برای مدیر و مالک مجاز است"
            className="px-2.5 py-1 rounded flex items-center gap-1 text-[#526071] bg-[#121417]/50 cursor-not-allowed opacity-60"
          >
            <Lock className="w-2.5 h-2.5 text-amber-500/70" />
            <span>گزارشات (قفل)</span>
          </button>
        )}

        {/* Menu Tab (Mobile) */}
        {isManager ? (
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
        ) : (
          <button
            disabled
            className="px-2 py-1 rounded flex items-center gap-1 text-[#526071] opacity-50 cursor-not-allowed"
            title="مخصوص مدیر و مالک"
          >
            <Lock className="w-3 h-3 text-amber-500/70" />
            <span>منو</span>
          </button>
        )}

        {/* Audit Tab (Mobile) */}
        {isManager ? (
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
        ) : (
          <button
            disabled
            className="px-2 py-1 rounded flex items-center gap-1 text-[#526071] opacity-50 cursor-not-allowed"
            title="مخصوص مدیر و مالک"
          >
            <Lock className="w-3 h-3 text-amber-500/70" />
            <span>حسابرسی</span>
          </button>
        )}

        {/* Warehouse Tab (Mobile) */}
        {isManager ? (
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('inventory');
            }}
            className={`px-2.5 py-1 rounded flex items-center gap-1 ${
              currentTab === 'inventory' ? 'bg-[#D71921] text-white' : 'text-[#9EACB8]'
            }`}
          >
            <Boxes className="w-3 h-3" />
            <span>انبارداری</span>
          </button>
        ) : (
          <button
            disabled
            className="px-2 py-1 rounded flex items-center gap-1 text-[#526071] opacity-50 cursor-not-allowed"
            title="مخصوص مدیر و مالک"
          >
            <Lock className="w-3 h-3 text-amber-500/70" />
            <span>انبار</span>
          </button>
        )}

        {/* Settings Tab (Mobile) */}
        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('settings');
          }}
          className={`px-2.5 py-1 rounded flex items-center gap-1 ${
            currentTab === 'settings' ? 'bg-[#D71921] text-white' : 'text-[#9EACB8]'
          }`}
        >
          <Settings className="w-3 h-3" />
          <span>تنظیمات</span>
          {!isManager && <Lock className="w-2 h-2 text-amber-400" />}
        </button>
      </div>
    </header>
  );
};
