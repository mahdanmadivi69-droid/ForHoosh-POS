/**
 * src/components/hub/AppLauncherHub.tsx
 * 
 * KarWand POS — 4-Way App Launcher Hub & RBAC Gate for 100 HICH
 * 
 * Features:
 *  - 4 Glass Cards:
 *     1. POS & Register (Active for both Cashier & Owner)
 *     2. Reports & Shift Analytics (Active for both Cashier & Owner)
 *     3. Sensory Lab & BOM (Disabled for Cashier unless overridden, enabled for Owner)
 *     4. Settings Control Deck (Strictly locked to Owner/Manager PIN)
 *  - Elevation gate via PinAuthModal for protected cards when Cashier is logged in.
 *  - Apple Liquid Glass tokens (34px blur, specular highlight, 3D tilt dynamics).
 *  - Header with venue identity, active user chip, shift status, and immediate lock.
 */

import React, { useState } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  FlaskConical,
  Sliders,
  Lock,
  Unlock,
  ShieldAlert,
  UserCheck,
  Clock,
  Sparkles,
  LogOut,
  ChevronLeft,
  Coffee,
  CheckCircle2,
} from 'lucide-react';
import { AuthUserRecord, ElevationAction } from '../../types/rbac-settings';
import { Shift, User } from '../../types/domain';
import { PinAuthModal } from '../modals/PinAuthModal';
import { playPosBeep } from '../../services/soundEffects';
import { formatToman } from '../../services/financialMath';

interface AppLauncherHubProps {
  activeUser: AuthUserRecord | User;
  onSelectApp: (tab: 'pos' | 'reports' | 'zero-g' | 'settings') => void;
  onLock: () => void;
  activeShift: Shift | null;
  venueTitle?: string;
  deviceId?: string;
}

export const AppLauncherHub: React.FC<AppLauncherHubProps> = ({
  activeUser,
  onSelectApp,
  onLock,
  activeShift,
  venueTitle = 'قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)',
  deviceId = 'TERM-01-MAIN',
}) => {
  const isOwnerOrManager =
    activeUser.role === 'OWNER' || activeUser.role === 'MANAGER' || (activeUser.role as string) === 'owner';

  // State for PIN Elevation Modal
  const [elevationAction, setElevationAction] = useState<ElevationAction | null>(null);
  const [pendingAppTarget, setPendingAppTarget] = useState<'zero-g' | 'settings' | null>(null);

  const handleCardClick = (e: React.MouseEvent, target: 'pos' | 'reports' | 'zero-g' | 'settings') => {
    e.stopPropagation();
    playPosBeep('click');

    if (target === 'pos' || target === 'reports') {
      onSelectApp(target);
      return;
    }

    if (target === 'zero-g') {
      if (isOwnerOrManager) {
        onSelectApp('zero-g');
      } else {
        // Cashier needs elevation
        setElevationAction('EDIT_RECIPE_BOM');
        setPendingAppTarget('zero-g');
      }
      return;
    }

    if (target === 'settings') {
      if (isOwnerOrManager) {
        onSelectApp('settings');
      } else {
        // Cashier strictly needs Manager/Owner elevation
        setElevationAction('ACCESS_SETTINGS_PANEL');
        setPendingAppTarget('settings');
      }
      return;
    }
  };

  const handleElevationSuccess = (authorizedBy: string) => {
    if (pendingAppTarget) {
      const target = pendingAppTarget;
      setPendingAppTarget(null);
      setElevationAction(null);
      onSelectApp(target);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-white flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none relative overflow-x-hidden">
      {/* Background Ambient Mesh */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-10 right-10 w-[500px] h-[500px] rounded-full bg-[#8C1318]/40 blur-[140px]" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full bg-[#0F223D]/60 blur-[160px]" />
      </div>

      {/* Top Header Deck */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4 z-10 py-2 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#8C1318] to-[#450A0D] border border-[rgba(144,210,237,0.35)] flex items-center justify-center shadow-[0_0_20px_rgba(140,19,24,0.5)]">
            <Coffee className="w-6 h-6 text-[#F5E8D0]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                {venueTitle}
              </h1>
              <span className="text-[10px] font-mono bg-white/10 border border-white/15 px-2 py-0.5 rounded-full text-[#90D2ED]">
                {deviceId}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">مرکز لانچر کاروند و مدیریت ماژولار</p>
          </div>
        </div>

        {/* User Info & Lock Controls */}
        <div className="flex items-center gap-3">
          {/* Shift status chip */}
          <div className="hidden sm:flex items-center gap-2 bg-[rgba(15,34,61,0.7)] border border-white/10 px-3 py-1.5 rounded-xl text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">
              {activeShift
                ? `شیفت باز (${formatToman(activeShift.openingCashToman)} تومان نقد)`
                : 'شیفت کاری بسته'}
            </span>
          </div>

          {/* Active User Badge */}
          <div className="flex items-center gap-2 bg-[rgba(12,25,48,0.85)] border border-[rgba(144,210,237,0.25)] px-3 py-1.5 rounded-xl">
            <UserCheck className="w-4 h-4 text-[#90D2ED]" />
            <div className="text-right">
              <span className="text-xs font-black block leading-none text-white">
                {activeUser.fullName}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {isOwnerOrManager ? 'مدیر / مالک' : 'صندوق‌دار شیفت'}
              </span>
            </div>
          </div>

          {/* Lock Terminal Button */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('delete');
              onLock();
            }}
            className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="قفل ترمینال و بازگشت به صفحه پین"
          >
            <Lock className="w-4 h-4" />
            <span className="hidden md:inline">قفل سیستم</span>
          </button>
        </div>
      </header>

      {/* Main 4-Way Glass Grid */}
      <main className="w-full max-w-6xl mx-auto my-auto py-8 z-10">
        <div className="text-center mb-8">
          <span className="text-xs font-black tracking-widest text-[#90D2ED] uppercase block mb-1">
            APPLICATION LAUNCHER HUB
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ماژول عملیاتی مورد نظر خود را انتخاب کنید
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: POS & Register */}
          <div
            onClick={(e) => handleCardClick(e, 'pos')}
            className="group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border border-[rgba(144,210,237,0.25)] hover:border-[rgba(144,210,237,0.6)] rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8C1318] to-[#450A0D] border border-[rgba(144,210,237,0.4)] flex items-center justify-center shadow-[0_0_20px_rgba(140,19,24,0.5)] mb-4 group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-7 h-7 text-white" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-[#90D2ED] transition-colors">
                  صندوق و ثبت سفارش
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  دسترسی آزاد
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                ثبت سفارشات بیرون‌بر و سالن، انتخاب میز، مدیریت هولد تب و تسویه حساب آنی نقدی یا پوز.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-[#90D2ED] group-hover:translate-x-[-4px] transition-transform">
              <span>ورود به صندوق POS</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Reports & Shift Analytics */}
          <div
            onClick={(e) => handleCardClick(e, 'reports')}
            className="group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border border-[rgba(144,210,237,0.25)] hover:border-[rgba(144,210,237,0.6)] rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F2E5A] to-[#0A1E3B] border border-[rgba(144,210,237,0.4)] flex items-center justify-center shadow-[0_0_20px_rgba(15,46,90,0.5)] mb-4 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-7 h-7 text-[#90D2ED]" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-[#90D2ED] transition-colors">
                  گزارش‌ها و تحلیل شیفت
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  دسترسی آزاد
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                مشاهده ریز تراکنش‌ها، گزارش پایانی شیفت Z-Report، مغایرت نقدی کشو و تحلیل آماری فروش.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-[#90D2ED] group-hover:translate-x-[-4px] transition-transform">
              <span>مشاهده گزارشات</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Sensory Lab & BOM */}
          <div
            onClick={(e) => handleCardClick(e, 'zero-g')}
            className={`group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5 ${
              isOwnerOrManager
                ? 'border-[rgba(144,210,237,0.25)] hover:border-[rgba(144,210,237,0.6)]'
                : 'border-amber-500/30 hover:border-amber-500/60'
            }`}
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9E8A5E]/40 to-[#423924] border border-[#9E8A5E]/50 flex items-center justify-center shadow-[0_0_20px_rgba(158,138,94,0.4)] mb-4 group-hover:scale-105 transition-transform">
                <FlaskConical className="w-7 h-7 text-[#F5E8D0]" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-[#F5E8D0] transition-colors">
                  سنسوری لب و فرمولاسیون
                </h3>
                {isOwnerOrManager ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/40">
                    مجاز (مدیر)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>پین ادمین</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                کاتالوگ تخصصی دان‌های قهوه، فرمولاسیون ترکیبی (Arabica vs Blend)، کسر اتوماتیک BOM از سیلوها.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-[#F5E8D0] group-hover:translate-x-[-4px] transition-transform">
              <span>{isOwnerOrManager ? 'ورود به سنسوری لب' : 'نیازمند تایید پین'}</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Settings Control Deck */}
          <div
            onClick={(e) => handleCardClick(e, 'settings')}
            className={`group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5 ${
              isOwnerOrManager
                ? 'border-[rgba(144,210,237,0.25)] hover:border-[rgba(144,210,237,0.6)]'
                : 'border-rose-500/30 hover:border-rose-500/60'
            }`}
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#450A0D] to-[#1F0406] border border-rose-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(140,19,24,0.4)] mb-4 group-hover:scale-105 transition-transform">
                <Sliders className="w-7 h-7 text-rose-300" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-rose-300 transition-colors">
                  کنترل دک و تنظیمات
                </h3>
                {isOwnerOrManager ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/40">
                    مجاز (مالک)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/40 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>قفل ادمین</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                هویت قفل‌شده ۱۰۰ هیچ، تیونینگ بصری، اتودیسکاوری پرینترها، مدیریت پین کارکنان و همگام‌سازی QR مش.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-rose-300 group-hover:translate-x-[-4px] transition-transform">
              <span>{isOwnerOrManager ? 'ورود به کنترل دک' : 'نیازمند پین ادمین'}</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-500 py-2 border-t border-white/10 z-10">
        <span>سیستم‌عامل تخصصی کافه و برشته‌کاری KarWand POS v2.5.0</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>حالت آفلاین امن (Local-First IndexedDB Active)</span>
        </div>
      </footer>

      {/* Pin Elevation Modal for Protected Cards */}
      {elevationAction && (
        <PinAuthModal
          isOpen={true}
          action={elevationAction}
          requestedByUser={activeUser.fullName}
          onSuccess={handleElevationSuccess}
          onClose={() => {
            setElevationAction(null);
            setPendingAppTarget(null);
          }}
        />
      )}
    </div>
  );
};
