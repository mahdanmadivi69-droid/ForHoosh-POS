import React, { useState, useEffect } from 'react';
import { useOutboxSync } from '../hooks/useOutboxSync';
import { SyncStatusBarBadge } from './SyncStatusBarBadge';
import {
  Shield,
  UserCheck,
  LogOut,
  Lock,
  LayoutGrid,
  Warehouse,
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
      className="vision-glass-slab bg-[#0F223D]/90 border-b border-white/12 sticky top-0 z-40 transition-all select-none shadow-2xl h-[64px] shrink-0 flex items-center backdrop-blur-2xl"
    >
      <div className="max-w-[1720px] mx-auto px-3 md:px-5 w-full flex items-center justify-between gap-3 relative select-none">
        {/* ================= FAR TOP-RIGHT SECTOR (Physical Right in RTL) ================= */}
        <div className="flex items-center gap-2.5 z-10 shrink-0">
          {/* AntiGravity Cloud Outbox Sync Badge */}
          <SyncStatusBarBadge status={syncStatus} onManualFlush={triggerFlush} />

          {/* Boiler Telemetry Status Chip */}
          <div className="flex items-center gap-1.5 bg-[#0B1524]/80 border border-white/12 px-2.5 py-1.5 rounded-xl text-xs text-[#F5F5F7]/70 backdrop-blur-md shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-[#005A3E] border border-emerald-400 animate-pulse"></span>
            <span className="text-[#F5F5F7]/60 font-medium hidden sm:inline">بویلر:</span>
            <span className="text-[#F5F5F7] font-mono font-bold num-heavy">93.5°C • 9.1 Bar</span>
          </div>
        </div>

        {/* ================= CENTER BRAND LOCKUP (Strict Horizontal Center) ================= */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          {activeTenant.id === 'modendo' ? (
            <div
              className="flex items-center bg-[#0F223D]/90 border border-white/15 px-3.5 py-1.5 rounded-2xl shadow-inner backdrop-blur-xl"
              style={{
                borderColor: activeTenant.palette.borderHairline || 'rgba(255,255,255,0.15)',
              }}
            >
              {/* Tenant Logo Badge */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center p-0.5 border border-white/15 bg-[#0B1524]"
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
                    MODENDO
                  </span>
                  <span className="text-[9px] block tracking-widest font-black uppercase text-[#F5F5F7]/60">
                    CAFÉ
                  </span>
                </div>
              </div>
              <div className="h-6 w-[1px] bg-white/15 mx-2.5"></div>
              <div>
                <h1 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-1.5">
                  <span>{activeTenant.brandNameFa}</span>
                  <span
                    className="text-[10px] text-white px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider"
                    style={{ backgroundColor: activeTenant.palette.accentColor }}
                  >
                    MODENDO CAFÉ
                  </span>
                </h1>
                <p className="text-[11px] text-[#F5F5F7]/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005A3E] border border-emerald-400 animate-pulse inline-block"></span>
                  <span>تهران، خیابان شریعتی، مجتمع مودندو، منفی ۱</span>
                </p>
              </div>
            </div>
          ) : (
            /* 100 HICH Navy Badge Pill */
            <div
              dir="ltr"
              className="flex items-center justify-center gap-2.5 px-3.5 py-1.5 rounded-full glass-pill shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            >
              <img
                src="/karwand-logo.png"
                alt="KarWand"
                className="w-9 h-9 rounded-xl object-cover border border-[#9E8A5E]/40 shadow-[0_0_14px_rgba(201,179,126,0.35)]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="w-[1px] h-7 bg-white/15" />
              <div className="flex flex-col items-center justify-center">
                <span className="text-sm font-black tracking-widest text-[#F5F5F7] uppercase font-sans leading-none">
                  100 HICH
                </span>
                <span className="text-[9px] font-bold tracking-[0.2em] text-[#90D2ED] uppercase font-mono leading-tight mt-0.5">
                  COFFEE ROASTERS
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ================= TOP-LEFT SECTOR (Physical Left in RTL) ================= */}
        <div className="flex items-center gap-2.5 z-10 shrink-0">
          {/* Subtle back-to-launcher icon button */}
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('hub');
            }}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#0F223D]/80 hover:bg-[#162E52] text-[#90D2ED] hover:text-white border border-white/15 transition cursor-pointer shadow-inner active:scale-95"
            title="بازگشت به لانچر برنامه‌ها (Hub)"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Quick Inventory & Storage shortcut */}
          <button
            onClick={() => {
              playPosBeep('click');
              onTabChange('inventory');
            }}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#0F223D]/80 hover:bg-[#162E52] text-emerald-300 hover:text-white border border-white/15 transition cursor-pointer shadow-inner active:scale-95"
            title="انبار و موجودی (Inventory & Storage)"
          >
            <Warehouse className="w-4 h-4" />
          </button>

          {/* Live Clock */}
          <div className="hidden md:flex flex-col text-left pl-1">
            <span className="text-xs font-mono font-bold text-[#F5F5F7] num-heavy leading-tight">
              {liveClock || '00:00:00'}
            </span>
            <span className="text-[10px] text-[#F5F5F7]/60 leading-tight">
              {new Date().toLocaleDateString('fa-IR', { weekday: 'short', month: 'numeric', day: 'numeric' })}
            </span>
          </div>

          {/* Operator Profile Badge */}
          <div
            onClick={() => onUserSwitchRequest ? onUserSwitchRequest(activeUser.id) : onLockTerminal?.()}
            className="flex items-center gap-1.5 bg-[#0F223D]/80 hover:bg-[#162E52] border border-white/15 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-inner cursor-pointer transition select-none active:scale-95"
            title="تغییر کاربر یا قفل صندوق (کلیک جهت ورود PIN)"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#90D2ED]" />
            <span className="text-xs font-bold text-[#F5F5F7] max-w-[120px] truncate">
              {activeUser.fullName}
            </span>
            <span className="text-[10px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md text-[#F5F5F7]/90 font-medium">
              {activeUser.role === 'OWNER'
                ? 'مالک'
                : activeUser.role === 'MANAGER'
                ? 'مدیر'
                : activeUser.role === 'CASHIER'
                ? 'صندوق‌دار'
                : 'باریستا'}
            </span>
            <Lock className="w-3 h-3 text-[#C5A880]" />
          </div>

          {/* Lock / Logout Button */}
          <button
            onClick={() => {
              playPosBeep('click');
              onLogout();
            }}
            className="flex items-center gap-1.5 bg-[#0F223D]/80 hover:bg-[#D71921] text-[#F5F5F7] hover:text-white border border-white/15 hover:border-[#D71921] px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-inner"
            title="خروج از حساب و بازگشت به صفحه لاگین"
          >
            <LogOut className="w-3.5 h-3.5 text-[#D71921] group-hover:text-white" />
            <span className="hidden sm:inline">خروج</span>
          </button>

          {/* Support Backup button (for diagnostic export and cloud backup validation) */}
          {isManager && (
            <button
              onClick={() => {
                playPosBeep('click');
                onOpenBackupModal();
              }}
              className="flex items-center gap-1 bg-[#0F223D]/80 hover:bg-[#162E52] text-[#F5F5F7] border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer active:scale-95"
              title="پشتیبان‌گیری ابری و بازیابی اطلاعات"
            >
              <Shield className="w-3.5 h-3.5 text-[#C5A880]" />
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
