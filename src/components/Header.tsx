import React, { useState, useEffect, useRef } from 'react';
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
  Map as MapIcon,
  ChevronDown,
  ChevronLeft,
  MoreHorizontal,
  LayoutGrid,
  Receipt,
} from 'lucide-react';
import { Shift, User, Tenant, isManagerOrOwner } from '../types/domain';
import { formatToman } from '../services/financialMath';
import { PWAInstallButton } from './PWAInstallButton';
import { playPosBeep } from '../services/soundEffects';
import { FEATURES } from '../modules/smart-orders';
import { getActiveTenant } from '../config/tenantConfig';

export type HeaderTab =
  | 'hub'
  | 'floor-plan'
  | 'floor'
  | 'pos'
  | 'zero-g'
  | 'reports'
  | 'menu'
  | 'audit'
  | 'inventory'
  | 'settings'
  | 'executive-pl';

interface HeaderProps {
  tenant: Tenant;
  activeTenantKey?: 'modendo' | '100hich';
  onTenantSwitch?: (key: 'modendo' | '100hich') => void;
  activeShift: Shift | null;
  activeUser: User;
  allUsers: User[];
  currentTab: HeaderTab;
  onTabChange: (tab: any) => void;
  onOpenShiftModal: () => void;
  onOpenZReportModal?: () => void;
  onOpenExpenseModal: () => void;
  onOpenBackupModal: () => void;
  onOpenBaristaKds: () => void;
  onOpenReceiptHistory?: () => void;
  baristaActiveCount?: number;
  onUserChange: (userId: string) => void;
  onUserSwitchRequest?: (userId: string) => void;
  onLockTerminal?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tenant,
  activeTenantKey,
  onTenantSwitch,
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
  onOpenReceiptHistory,
  baristaActiveCount = 0,
  onUserChange,
  onUserSwitchRequest,
  onLockTerminal,
  onLogout,
}) => {
  const activeTenantConfig = getActiveTenant();
  const isModendo =
    activeTenantKey === 'modendo' ||
    tenant.id === 'tenant-modendo-01' ||
    tenant.id === 'modendo' ||
    activeTenantConfig.id === 'modendo' ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'modendo') ||
    (typeof import.meta !== 'undefined' && /modendo/i.test((import.meta as any).env?.VITE_TENANT_ID || '')) ||
    (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'modendo');
  const isManager = isManagerOrOwner(activeUser.role);
  const [liveClock, setLiveClock] = useState<string>('');
  const [persianDate, setPersianDate] = useState<string>('امروز');
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState<boolean>(false);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const updateDate = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('fa-IR', {
          weekday: 'long',
          month: 'numeric',
          day: 'numeric',
        }).format(now);
        setPersianDate(formatted);
      } catch {
        setPersianDate('امروز');
      }
    };
    updateDate();
    const interval = setInterval(updateDate, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isUtilityMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(e.target as Node)) {
        setIsUtilityMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsUtilityMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isUtilityMenuOpen]);

  const roleLabel =
    activeUser.role === 'OWNER'
      ? 'مالک'
      : activeUser.role === 'MANAGER'
      ? 'مدیر'
      : activeUser.role === 'CASHIER'
      ? 'صندوق‌دار'
      : 'باریستا';

  /* ============================================================================
   * MODENDO: Floating Liquid Glass Spatial Header (Reference Image Fidelity)
   * ============================================================================ */
  if (isModendo) {
    return (
      <header className="sticky top-0 md:top-2 z-40 md:mx-auto md:w-[calc(100%-1.5rem)] max-w-[1780px] md:rounded-full bg-gradient-to-r from-[#072019]/92 via-[#0A2E24]/92 to-[#072019]/92 backdrop-blur-2xl border border-[#164538]/70 shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(167,243,208,0.15)] transition-all duration-200 select-none">
        <div className="px-3 md:px-5 py-2 flex items-center justify-between gap-2 md:gap-4 min-w-0">
          {/* Left Zone: Red Badge · Exit Button · User Pill (Red Border) · Clock/Date · Launcher */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0 flex-nowrap">
            {/* Crimson Monogram Emblem [ K ] */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7F1D1D] to-[#450A0A] border border-[#DC2626]/70 flex items-center justify-center font-black text-rose-300 shadow-[0_0_12px_rgba(220,38,38,0.35)] shrink-0">
              <span className="font-display-latin text-xs font-black">K</span>
            </div>

            {/* Exit Button */}
            <button
              onClick={() => {
                playPosBeep('click');
                onLogout();
              }}
              className="rounded-full bg-[#2A0C10]/85 border border-red-900/60 hover:border-red-600/80 text-xs font-bold text-rose-200 hover:text-white px-3 py-1.5 flex items-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
              title="خروج از حساب"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span>خروج</span>
            </button>

            {/* User Capsule with Crimson Border */}
            <div ref={utilityMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  setIsUtilityMenuOpen((v) => !v);
                }}
                className={`rounded-full bg-[#200B10]/85 border border-rose-500/50 hover:border-rose-400 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap shrink-0 shadow-[0_0_10px_rgba(220,38,38,0.25)] transition ${
                  isUtilityMenuOpen ? 'border-rose-400 bg-[#2C0F16]' : ''
                }`}
                title="حساب کاربری و منوی ابزارها"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="max-w-[110px] truncate whitespace-nowrap">
                  {activeUser.fullName || 'مدیر سیستم'}
                </span>
                <span className="text-white/40">|</span>
                <span className="text-rose-300 text-[11px] font-semibold">{roleLabel}</span>
                <ChevronDown className="w-3 h-3 text-rose-300/80" />
              </button>

              {/* Utility Dropdown (Preserving all utilities: shift, kds, PIN user switch, backup, receipt history) */}
              {isUtilityMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-72 liquid-glass-modal rounded-[24px] p-4 space-y-3 z-50 animate-spatial-modal text-right shadow-2xl">
                  {/* Profile + Live Clock */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
                    <div>
                      <div className="text-xs font-black text-white">{activeUser.fullName}</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">{roleLabel}</div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#34D399] tabular-nums">
                      {liveClock || '00:00:00'}
                    </span>
                  </div>

                  {/* Active Shift Cash Summary + Close Shift Action */}
                  {activeShift && (
                    <div className="liquid-glass-well rounded-xl p-2.5 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#94A3B8]">تنخواه شروع شیفت:</span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {formatToman(activeShift.openingCashToman)} ت
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setIsUtilityMenuOpen(false);
                          onOpenShiftModal();
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>بستن شیفت و تسویه</span>
                      </button>
                    </div>
                  )}

                  {/* Switch User */}
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">تغییر کاربر / ورود با PIN</label>
                    <select
                      value={activeUser.id}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setIsUtilityMenuOpen(false);
                        if (onUserSwitchRequest) {
                          onUserSwitchRequest(targetId);
                        } else {
                          onUserChange(targetId);
                        }
                      }}
                      className="w-full liquid-glass-well rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id} className="bg-[#12161d] text-white">
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operational Shortcuts */}
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        setIsUtilityMenuOpen(false);
                        onOpenBaristaKds();
                      }}
                      className="w-full liquid-glass-pill rounded-xl px-3 py-2 text-xs font-bold text-[#F3E9DD] flex items-center justify-between cursor-pointer whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1.5">
                        <Coffee className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>نمایشگر بار باریستا (KDS)</span>
                      </span>
                      {baristaActiveCount > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums bg-[#10B981] text-[#06120F]">
                          {baristaActiveCount}
                        </span>
                      )}
                    </button>

                    {onOpenReceiptHistory && (
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setIsUtilityMenuOpen(false);
                          onOpenReceiptHistory();
                        }}
                        className="w-full liquid-glass-pill rounded-xl px-3 py-2 text-xs font-bold text-[#F3E9DD] flex items-center justify-between cursor-pointer whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-[#10B981]" />
                          <span>سابقه فیش‌ها و چاپ مجدد</span>
                        </span>
                        <ChevronLeft className="w-3.5 h-3.5 text-white/40" />
                      </button>
                    )}

                    {activeShift && (
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setIsUtilityMenuOpen(false);
                          onOpenExpenseModal();
                        }}
                        className="w-full liquid-glass-pill rounded-xl px-3 py-2 text-xs font-bold text-[#F3E9DD] flex items-center justify-between cursor-pointer whitespace-nowrap"
                      >
                        <span>ثبت هزینه تنخواه</span>
                        <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                      </button>
                    )}

                    {isManager && (
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setIsUtilityMenuOpen(false);
                          onOpenBackupModal();
                        }}
                        className="w-full liquid-glass-pill rounded-xl px-3 py-2 text-xs font-bold text-[#F3E9DD] flex items-center justify-between cursor-pointer whitespace-nowrap"
                      >
                        <span>پشتیبان‌گیری و بازیابی</span>
                        <Shield className="w-3.5 h-3.5 text-[#10B981]" />
                      </button>
                    )}

                    {onLockTerminal && (
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setIsUtilityMenuOpen(false);
                          onLockTerminal();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>قفل موقت ترمینال</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Live Clock & Persian Date */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#07241C]/80 border border-[#16382F] px-3 py-1.5 text-xs font-mono font-bold text-emerald-200 tabular-nums shadow-sm shrink-0">
              <span>{liveClock || '20:47:43'}</span>
              <span className="text-white/30">|</span>
              <span className="font-sans font-bold text-emerald-300/90 text-[11px]">{persianDate}</span>
            </div>

            {/* 4-Square App Launcher Icon (Navigates to Hub) */}
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('hub');
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition shadow-sm shrink-0 ${
                currentTab === 'hub'
                  ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-[#07241C]/80 border border-[#16382F] hover:border-emerald-400/60 text-emerald-300 hover:text-white'
              }`}
              title="مرکز عملیات و ماژول‌ها"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* Quick Floor Plan Pill */}
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('floor-plan');
              }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
                currentTab === 'floor-plan'
                  ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-[#07241C]/80 border border-[#16382F] hover:border-emerald-400/60 text-emerald-300 hover:text-white'
              }`}
              title="نقشه سالن و میزها"
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>نقشه سالن</span>
            </button>

            {/* Quick POS Pill */}
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('pos');
              }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
                currentTab === 'pos'
                  ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-[#07241C]/80 border border-[#16382F] hover:border-emerald-400/60 text-emerald-300 hover:text-white'
              }`}
              title="صندوق و ثبت سفارش"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />
              <span>صندوق</span>
            </button>
          </div>

          {/* Center Zone: 3D Hexagonal Green Emblem + Gold/Emerald Calligraphy "کافه مودندو" */}
          <div
            onClick={() => onTabChange('pos')}
            className="flex items-center gap-2 md:gap-3 cursor-pointer shrink-0 select-none group"
            title="کافه گیمینگ مودندو"
          >
            {/* 3D Isometric Hexagon Emblem */}
            <div className="w-8 h-8 relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <svg className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" viewBox="0 0 100 100" fill="none">
                <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" stroke="#10B981" strokeWidth="6" fill="#062219" />
                <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" stroke="#34D399" strokeWidth="3" fill="#0A382A" />
                <path d="M50 15 L50 85 M20 32 L80 68 M20 68 L80 32" stroke="#10B981" strokeWidth="2" strokeOpacity="0.4" />
              </svg>
            </div>
            
            {/* Persian Brand Title */}
            <span className="text-xl md:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#D1FAE5] via-[#FDE68A] to-[#6EE7B7] drop-shadow-[0_0_14px_rgba(16,185,129,0.45)] font-fa-sans">
              کافه مودندو
            </span>
          </div>

          {/* Right Zone: Telemetry Pill (93.5°C • 9.1 Bar • بویلر) · Online Toggle */}
          <div className="flex items-center gap-2 md:gap-2.5 shrink-0 flex-nowrap">
            {/* Boiler Telemetry Pill */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#07241C]/80 border border-[#16382F] px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-300 shadow-sm shrink-0">
              <span>93.5°C • 9.1 Bar • بویلر</span>
            </div>

            {/* Online Status Toggle Pill */}
            <div className="flex items-center gap-2 rounded-full bg-[#07241C]/80 border border-[#16382F] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse shrink-0" />
              <span className="font-mono text-emerald-200 text-xs">online</span>
              <div className="w-8 h-4 rounded-full bg-emerald-500 flex items-center justify-end px-0.5 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0">
                <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  /* ============================================================================
   * 100HICH: Preserved Legacy Roastery Header
   * ============================================================================ */
  return (
    <header className="bg-[#0F223D] border-b border-[#293444] sticky top-0 z-40 shadow-md transition-all duration-200 select-none">
      {/* Top Main Brand & Control Bar */}
      <div className="max-w-[1720px] mx-auto px-3.5 md:px-5 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Branch Identity */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex items-center bg-[#081425] border-[#293444] border px-3 py-1.5 rounded-xl">
            <div className="text-left font-black tracking-tighter leading-none pr-1 whitespace-nowrap">
              <span className="text-2xl font-black text-white">100</span>
              <span className="text-[10px] block text-[#D71921] tracking-widest font-black uppercase">
                HICH
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/[0.08] mx-2.5"></div>
            <div>
              <h1 className="text-sm font-extrabold text-[#F3E9DD] flex items-center gap-2 whitespace-nowrap">
                <span>{tenant.name || 'قهوه‌فروشی صَد هیچ'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-[#D71921] text-white">
                  ROASTERS
                </span>
              </h1>
              <p className="text-[11px] text-[#94A3B8] truncate max-w-[260px]">
                {tenant.address || 'شعبه ۱: اکباتان - فاز ۱'}
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center p-1 text-xs font-bold gap-1 bg-[#121417] border border-[#293444] rounded-xl">
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('pos');
              }}
              className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 rounded-lg ${
                currentTab === 'pos'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
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
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-all cursor-pointer font-bold whitespace-nowrap shrink-0 rounded-lg ${
                  currentTab === 'zero-g'
                    ? 'bg-gradient-to-r from-[#D71921] to-[#E52E38] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.6)] ring-1 ring-red-400'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-white/[0.06] border border-amber-500/30'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Zero-G سریع</span>
              </button>
            )}

            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('reports');
                }}
                className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 rounded-lg ${
                  currentTab === 'reports'
                    ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>شیفت و گزارش مالی</span>
              </button>
            ) : (
              <button
                disabled
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[#526071] cursor-not-allowed opacity-60 border border-transparent whitespace-nowrap shrink-0"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>گزارش مالی (قفل)</span>
              </button>
            )}

            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('menu');
                }}
                className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 rounded-lg ${
                  currentTab === 'menu'
                    ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>مدیریت منو و قیمت‌ها</span>
              </button>
            ) : (
              <button
                disabled
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[#526071] cursor-not-allowed opacity-60 border border-transparent whitespace-nowrap shrink-0"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>منو (قفل مدیر)</span>
              </button>
            )}

            {isManager ? (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('audit');
                }}
                className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 rounded-lg ${
                  currentTab === 'audit'
                    ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)]'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>لاگ حسابرسی</span>
              </button>
            ) : (
              <button
                disabled
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[#526071] cursor-not-allowed opacity-60 border border-transparent whitespace-nowrap shrink-0"
              >
                <Lock className="w-3 h-3 text-amber-500/70" />
                <span>حسابرسی (قفل)</span>
              </button>
            )}
          </nav>
        </div>

        {/* Live Status, Clock & Actions */}
        <div className="flex items-center gap-2">
          {activeShift ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap bg-[#1B222C] border border-[#10B981]/30 text-[#10B981] rounded-lg">
              <span className="font-semibold tabular-nums">
                شیفت فعال · {formatToman(activeShift.openingCashToman)} ت
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#94A3B8] whitespace-nowrap bg-[#1B222C] border border-white/[0.08] rounded-lg">
              <span>شیفت بسته است</span>
            </div>
          )}

          <div className="hidden md:flex flex-col text-left pl-1">
            <span className="text-xs font-mono tabular-nums font-bold text-white leading-tight">
              {liveClock || '00:00:00'}
            </span>
            <span className="text-[10px] text-[#94A3B8] leading-tight">
              {activeUser.fullName.split(' ')[0]} · {roleLabel}
            </span>
          </div>

          <button
            onClick={() => {
              playPosBeep('click');
              onOpenBaristaKds();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition cursor-pointer relative whitespace-nowrap shrink-0 bg-[#1B222C] hover:bg-[#222B38] text-white border border-white/[0.08] rounded-lg"
          >
            <Coffee className="w-3.5 h-3.5 text-[#F3E9DD]" />
            <span className="hidden sm:inline">بار باریستا</span>
            {baristaActiveCount > 0 ? (
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums bg-[#D71921] text-white">
                {baristaActiveCount}
              </span>
            ) : (
              <span className="text-[10px] text-[#94A3B8]">KDS</span>
            )}
          </button>

          {activeShift && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenExpenseModal();
              }}
              className="hidden lg:flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 bg-[#1B222C] hover:bg-[#222B38] text-rose-300 border border-[#293444] rounded-lg"
            >
              <DollarSign className="w-3.5 h-3.5 text-rose-400" />
              <span>هزینه تنخواه</span>
            </button>
          )}

          <button
            onClick={() => {
              playPosBeep('click');
              onOpenShiftModal();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0 rounded-lg ${
              activeShift
                ? 'bg-rose-500/18 hover:bg-rose-500/28 text-rose-200 border border-rose-400/35'
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

          {onTenantSwitch && (
            <div className="hidden xl:flex items-center liquid-glass-rail rounded-full p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onTenantSwitch('modendo');
                }}
                className="px-2.5 py-1 rounded-full transition cursor-pointer text-[#9EACB8] hover:text-white"
              >
                Modendo
              </button>
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onTenantSwitch('100hich');
                }}
                className="px-2.5 py-1 rounded-full transition cursor-pointer bg-[#D71921] text-white font-black"
              >
                100Hich
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#121417] border border-[#293444] rounded-lg">
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

          <button
            onClick={() => {
              playPosBeep('click');
              onLogout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 bg-[#1B222C] hover:bg-rose-950/60 text-[#CAD5E2] hover:text-rose-200 border border-[#293444] hover:border-rose-800/60 rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">خروج</span>
          </button>

          {isManager && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenBackupModal();
              }}
              className="hidden xl:flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 bg-[#1B222C] hover:bg-[#222B38] text-[#F3E9DD] border border-[#293444] rounded-lg"
            >
              <Shield className="w-3.5 h-3.5 text-[#F3E9DD]" />
              <span>پشتیبان</span>
            </button>
          )}

          <PWAInstallButton />
        </div>
      </div>

      {/* Mobile Navigation Tabs */}
      <div className="lg:hidden border-t border-[#293444] bg-[#081425] px-3 py-1.5 flex items-center justify-around text-xs font-bold overflow-x-auto scrollbar-none gap-1">
        <button
          onClick={() => {
            playPosBeep('click');
            onTabChange('pos');
          }}
          className={`px-3 py-1 flex items-center gap-1 whitespace-nowrap shrink-0 transition rounded-lg ${
            currentTab === 'pos' ? 'bg-[#D71921] text-white' : 'text-[#94A3B8]'
          }`}
        >
          <UtensilsCrossed className="w-3 h-3" />
          <span>صندوق (POS)</span>
        </button>

        {isManager && (
          <>
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('reports');
              }}
              className={`px-3 py-1 flex items-center gap-1 whitespace-nowrap shrink-0 transition rounded-lg ${
                currentTab === 'reports' ? 'bg-[#D71921] text-white' : 'text-[#94A3B8]'
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
              className={`px-3 py-1 flex items-center gap-1 whitespace-nowrap shrink-0 transition rounded-lg ${
                currentTab === 'menu' ? 'bg-[#D71921] text-white' : 'text-[#94A3B8]'
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
              className={`px-3 py-1 flex items-center gap-1 whitespace-nowrap shrink-0 transition rounded-lg ${
                currentTab === 'audit' ? 'bg-[#D71921] text-white' : 'text-[#94A3B8]'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>حسابرسی</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
