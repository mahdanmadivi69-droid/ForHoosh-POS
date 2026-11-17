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
    (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'modendo');
  const isManager = isManagerOrOwner(activeUser.role);
  const [liveClock, setLiveClock] = useState<string>('');
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
   * MODENDO: Ultra-Clean Floating Liquid Glass Spatial Header
   * ============================================================================ */
  if (isModendo) {
    return (
      <header className="sticky top-0 md:top-2.5 z-40 md:mx-auto md:w-[calc(100%-2rem)] max-w-[1720px] md:rounded-[22px] liquid-glass-shell shadow-2xl transition-all duration-200 select-none">
        <div className="px-3 md:px-5 py-2.5 flex items-center justify-between gap-2 md:gap-4 min-w-0">
          {/* Zone 1: Minimal Brand Mark */}
          <div className="flex items-center gap-2 md:gap-2.5 shrink-0 min-w-0">
            <span className="text-base md:text-[17px] font-black tracking-tight text-white font-display-latin">
              MODENDO
            </span>
            <span className="text-white/40 text-xs hidden sm:inline">—</span>
            <span className="hidden sm:inline text-xs font-bold text-emerald-300 whitespace-nowrap">
              کافه گیمینگ مودندو
            </span>
          </div>

          {/* Zone 2: Clean Segmented Nav Rail */}
          <nav className="hidden xl:flex items-center liquid-glass-rail rounded-full p-1 text-xs font-bold gap-1 shrink-0">
            {/* Hub / Operational Modules launcher button */}
            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('hub');
              }}
              className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                currentTab === 'hub'
                  ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
              }`}
              title="مرکز عملیات و ماژول‌ها"
            >
              <LayoutGrid className={`w-3.5 h-3.5 ${currentTab === 'hub' ? 'text-[#10B981]' : ''}`} />
              <span>ماژول‌ها</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('floor-plan');
              }}
              className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                currentTab === 'floor-plan' || currentTab === 'floor'
                  ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-[#10B981]" />
              <span>نقشه سالن</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                onTabChange('pos');
              }}
              className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                currentTab === 'pos'
                  ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              <UtensilsCrossed className={`w-3.5 h-3.5 ${currentTab === 'pos' ? 'text-[#10B981]' : ''}`} />
              <span>صندوق</span>
            </button>

            {FEATURES.ENABLE_ZERO_G_SMART_ORDERS && !isModendo && (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('zero-g');
                }}
                className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer font-bold whitespace-nowrap shrink-0 ${
                  currentTab === 'zero-g'
                    ? 'bg-white/[0.16] text-white font-black border border-white/[0.22]'
                    : 'text-amber-300 hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Zero-G</span>
              </button>
            )}

            {isManager && (
              <>
                <button
                  onClick={() => {
                    playPosBeep('click');
                    onTabChange('reports');
                  }}
                  className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                    currentTab === 'reports'
                      ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>گزارشات</span>
                </button>

                <button
                  onClick={() => {
                    playPosBeep('click');
                    onTabChange('menu');
                  }}
                  className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                    currentTab === 'menu'
                      ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>مدیریت منو</span>
                </button>

                <button
                  onClick={() => {
                    playPosBeep('click');
                    onTabChange('audit');
                  }}
                  className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                    currentTab === 'audit'
                      ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>حسابرسی</span>
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: 3 Clean Operational Actions (KDS · Shift · Account & Tools Popover) */}
          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0 flex-nowrap">
            {/* Barista KDS */}
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenBaristaKds();
              }}
              className="rounded-full bg-[#0E2922] border border-[#16382F] hover:border-[#10B981]/50 flex items-center gap-1.5 px-2.5 md:px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap shrink-0 transition"
              title="نمایشگر زنده بار باریستا (KDS)"
            >
              <Coffee className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="hidden md:inline">بار باریستا KDS</span>
              <span className="md:hidden">KDS</span>
              {baristaActiveCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums bg-[#10B981] text-[#06120F]">
                  {baristaActiveCount}
                </span>
              )}
            </button>

            {/* Receipt History (Modendo / quick-access) */}
            {onOpenReceiptHistory && (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onOpenReceiptHistory();
                }}
                className="rounded-full bg-[#0E2922] border border-[#16382F] hover:border-[#10B981]/50 flex items-center gap-1.5 px-2.5 md:px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap shrink-0 transition"
                title="سابقه فیش‌ها، چاپ مجدد و ابطال"
              >
                <Receipt className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="hidden md:inline">سابقه فیش‌ها</span>
                <span className="md:hidden">فیش‌ها</span>
              </button>
            )}

            {/* Quick Expense (when shift is active, xl only) */}
            {activeShift && (
              <button
                onClick={() => {
                  playPosBeep('click');
                  onOpenExpenseModal();
                }}
                className="hidden 2xl:flex rounded-full bg-[#0E2922] border border-[#16382F] items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#cbd5e1] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                title="ثبت هزینه تنخواه"
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                <span>تنخواه</span>
              </button>
            )}

            {/* Unified Shift Trigger */}
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenShiftModal();
              }}
              className={`rounded-full flex items-center gap-1.5 px-2.5 md:px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeShift
                  ? 'bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/50 text-emerald-200'
                  : 'bg-[#10B981] text-[#06120F] hover:bg-[#059669] hover:text-white font-black shadow-lg'
              }`}
              title={activeShift ? 'مشاهده وضعیت یا بستن شیفت' : 'شروع شیفت کاری'}
            >
              <Clock className={`w-3.5 h-3.5 ${activeShift ? 'text-[#34D399]' : ''}`} />
              <span className="whitespace-nowrap">{activeShift ? 'شیفت فعال' : 'شروع شیفت'}</span>
            </button>

            {/* Account & Utilities Dropdown */}
            <div ref={utilityMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  setIsUtilityMenuOpen((v) => !v);
                }}
                className={`rounded-full bg-[#0E2922] border border-[#16382F] hover:border-[#10B981]/50 flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0 ${
                  isUtilityMenuOpen ? 'border-[#10B981] bg-[#0E2922]' : ''
                }`}
                title="حساب کاربری و ابزارها"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="hidden sm:inline max-w-[85px] truncate whitespace-nowrap">
                  {activeUser.fullName.split(' ')[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              </button>

              {isUtilityMenuOpen && (
                <div className="absolute left-0 mt-2.5 w-72 liquid-glass-modal rounded-[24px] p-4 space-y-3 z-50 animate-spatial-modal text-right shadow-2xl">
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

                  {/* Tenant Switcher (if superadmin) */}
                  {onTenantSwitch && (
                    <div className="liquid-glass-rail rounded-full p-1 grid grid-cols-2 gap-1 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          onTenantSwitch('modendo');
                          setIsUtilityMenuOpen(false);
                        }}
                        className="py-1.5 rounded-full bg-[#10B981] text-[#07140F] font-black cursor-pointer"
                      >
                        Modendo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          onTenantSwitch('100hich');
                          setIsUtilityMenuOpen(false);
                        }}
                        className="py-1.5 rounded-full text-[#94A3B8] hover:text-white cursor-pointer"
                      >
                        100Hich
                      </button>
                    </div>
                  )}

                  {/* Quick Tools */}
                  <div className="space-y-1.5 pt-1">
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
                        className="w-full liquid-glass-pill rounded-xl px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:text-white flex items-center justify-between cursor-pointer whitespace-nowrap"
                      >
                        <span>قفل پایانه</span>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <PWAInstallButton />
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setIsUtilityMenuOpen(false);
                          onLogout();
                        }}
                        className="flex-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 px-3 py-2 text-xs font-bold text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>خروج</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean Mobile Navigation Strip */}
        <div className="lg:hidden border-t border-white/[0.08] bg-white/[0.02] px-3 py-1.5 flex items-center justify-around text-xs font-bold overflow-x-auto scrollbar-none gap-1">
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('hub');
            }}
            className={`px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
              currentTab === 'hub'
                ? 'bg-white/[0.15] text-white font-black border border-white/[0.2]'
                : 'text-[#94A3B8]'
            }`}
          >
            <LayoutGrid className="w-3 h-3 text-[#10B981]" />
            <span>ماژول‌ها</span>
          </button>

          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('floor-plan');
            }}
            className={`px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
              currentTab === 'floor-plan' || currentTab === 'floor'
                ? 'bg-white/[0.15] text-white font-black border border-white/[0.2]'
                : 'text-[#94A3B8]'
            }`}
          >
            <MapIcon className="w-3 h-3 text-[#10B981]" />
            <span>نقشه سالن</span>
          </button>

          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('pos');
            }}
            className={`px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
              currentTab === 'pos'
                ? 'bg-white/[0.15] text-white font-black border border-white/[0.2]'
                : 'text-[#94A3B8]'
            }`}
          >
            <UtensilsCrossed className="w-3 h-3" />
            <span>صندوق</span>
          </button>

          {isManager && (
            <>
              <button
                onClick={() => {
                  playPosBeep('click');
                  onTabChange('reports');
                }}
                className={`px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                  currentTab === 'reports'
                    ? 'bg-white/[0.15] text-white font-black border border-white/[0.2]'
                    : 'text-[#94A3B8]'
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
                className={`px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                  currentTab === 'menu'
                    ? 'bg-white/[0.15] text-white font-black border border-white/[0.2]'
                    : 'text-[#94A3B8]'
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
                className={`px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                  currentTab === 'audit'
                    ? 'bg-white/[0.15] text-white font-black border border-white/[0.2]'
                    : 'text-[#94A3B8]'
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
