import React, { useState, useEffect } from 'react';
import { useOutboxSync } from '../hooks/useOutboxSync';
import { SyncStatusBarBadge } from './SyncStatusBarBadge';
import {
  Shield,
  UserCheck,
  LogOut,
  Lock,
  LayoutGrid,
} from 'lucide-react';
import { Shift, User, Tenant, isManagerOrOwner } from '../types/domain';
import { PWAInstallButton } from './PWAInstallButton';
import { playPosBeep } from '../services/soundEffects';
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
  activeUser,
  onTabChange,
  onOpenBackupModal,
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
      className="vision-glass-slab bg-[var(--color-header-bg,rgba(12,22,38,0.76))] border-b border-[var(--color-header-border,rgba(255,255,255,0.15))] sticky top-0 z-40 transition-all select-none shadow-xl h-[64px] flex items-center"
    >
      <div className="max-w-[1720px] mx-auto px-3 md:px-5 w-full flex items-center justify-between gap-3 relative select-none">
        {/* ================= FAR TOP-RIGHT SECTOR (Physical Right in RTL) ================= */}
        <div className="flex items-center gap-2.5 z-10">
          {/* AntiGravity Cloud Outbox Sync Badge */}
          <SyncStatusBarBadge status={syncStatus} onManualFlush={triggerFlush} />

          {/* Boiler Telemetry Status Chip */}
          <div className="flex items-center gap-1.5 bg-[rgba(12,20,35,0.7)] border border-white/10 px-2.5 py-1.5 rounded-xl text-xs text-[#9EACB8] backdrop-blur-md shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400 font-medium hidden sm:inline">بویلر:</span>
            <span className="text-slate-200 font-mono font-bold num-heavy">93.5°C • 9.1 Bar</span>
          </div>
        </div>

        {/* ================= CENTER BRAND LOCKUP (Strict Horizontal Center) ================= */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div
            className="flex items-center bg-[rgba(12,20,35,0.7)] border border-white/15 px-3.5 py-1.5 rounded-2xl shadow-inner backdrop-blur-md"
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
        </div>

        {/* ================= TOP-LEFT SECTOR (Physical Left in RTL) ================= */}
        <div className="flex items-center gap-2.5 z-10">
          {/* Subtle back-to-launcher icon button */}
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('hub');
            }}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-[rgba(20,32,54,0.7)] hover:bg-[rgba(30,48,80,0.9)] text-[#90D2ED] hover:text-white border border-white/15 transition cursor-pointer shadow-inner"
            title="بازگشت به لانچر برنامه‌ها (Hub)"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Live Clock */}
          <div className="hidden md:flex flex-col text-left pl-1">
            <span className="text-xs font-mono font-bold text-white num-heavy leading-tight">
              {liveClock || '00:00:00'}
            </span>
            <span className="text-[10px] text-[#9EACB8] leading-tight">
              {new Date().toLocaleDateString('fa-IR', { weekday: 'short', month: 'numeric', day: 'numeric' })}
            </span>
          </div>

          {/* Operator Profile Badge */}
          <div
            onClick={() => onUserSwitchRequest ? onUserSwitchRequest(activeUser.id) : onLockTerminal?.()}
            className="flex items-center gap-1.5 bg-[rgba(12,20,35,0.75)] hover:bg-[rgba(20,32,54,0.9)] border border-white/15 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-inner cursor-pointer transition select-none"
            title="تغییر کاربر یا قفل صندوق (کلیک جهت ورود PIN)"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#90D2ED]" />
            <span className="text-xs font-bold text-white max-w-[120px] truncate">
              {activeUser.fullName}
            </span>
            <span className="text-[10px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded text-slate-300 font-medium">
              {activeUser.role === 'OWNER'
                ? 'مالک'
                : activeUser.role === 'MANAGER'
                ? 'مدیر'
                : activeUser.role === 'CASHIER'
                ? 'صندوق‌دار'
                : 'باریستا'}
            </span>
            <Lock className="w-3 h-3 text-amber-400/80" />
          </div>

          {/* Lock / Logout Button */}
          <button
            onClick={() => {
              playPosBeep('click');
              onLogout();
            }}
            className="flex items-center gap-1.5 bg-[rgba(20,32,54,0.75)] hover:bg-rose-950/70 text-[#CAD5E2] hover:text-rose-200 border border-white/15 hover:border-rose-600/60 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer vision-haptic-press shadow-inner"
            title="خروج از حساب و بازگشت به صفحه لاگین"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">خروج</span>
          </button>

          {/* Support Backup button (for diagnostic export and cloud backup validation) */}
          {isManager && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenBackupModal();
              }}
              className="flex items-center gap-1 bg-[#1B222C] hover:bg-[#222B38] text-[#F3E9DD] border border-[#293444] rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer"
              title="پشتیبان‌گیری ابری و بازیابی اطلاعات"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">پشتیبان</span>
            </button>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
