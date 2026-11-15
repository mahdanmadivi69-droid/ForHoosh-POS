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
  Warehouse,
  BookOpen,
  ScrollText,
  PieChart,
  Gamepad2,
} from 'lucide-react';
import { AuthUserRecord, ElevationAction } from '../../types/rbac-settings';
import { Shift, User } from '../../types/domain';
import { PinAuthModal } from '../modals/PinAuthModal';
import { playPosBeep } from '../../services/soundEffects';
import { formatToman } from '../../services/financialMath';
import { getActiveTenant } from '../../config/tenantConfig';

interface AppLauncherHubProps {
  activeUser: AuthUserRecord | User;
  onSelectApp: (
    tab: 'pos' | 'reports' | 'zero-g' | 'settings' | 'inventory' | 'menu' | 'audit' | 'executive-pl' | 'floor-plan'
  ) => void;
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
  venueTitle = 'قهوه‌فروشی ۱۰۰ هیچ',
  deviceId = 'TERM-01-MAIN',
}) => {
  const isOwnerOrManager =
    activeUser.role === 'OWNER' || activeUser.role === 'MANAGER' || (activeUser.role as string) === 'owner';
  const activeTenant = getActiveTenant();
  const isModendo = activeTenant.id === 'modendo';

  // State for PIN Elevation Modal
  const [elevationAction, setElevationAction] = useState<ElevationAction | null>(null);
  const [pendingAppTarget, setPendingAppTarget] = useState<'zero-g' | 'settings' | null>(null);

  const handleCardClick = (
    e: React.MouseEvent,
    target: 'pos' | 'reports' | 'zero-g' | 'settings' | 'inventory' | 'menu' | 'audit' | 'executive-pl' | 'floor-plan'
  ) => {
    e.stopPropagation();
    playPosBeep('click');

    if (target === 'pos' || target === 'reports' || target === 'floor-plan') {
      onSelectApp(target);
      return;
    }

    if (target === 'inventory' || target === 'menu' || target === 'audit' || target === 'executive-pl') {
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
        {/* Left: Venue Identity with 100 HICH Badge */}
        <div className="flex items-center gap-3">
          <div
            dir="ltr"
            className="px-3.5 py-1.5 rounded-2xl bg-[#0F223D] border border-white/20 shadow-[0_0_20px_rgba(15,34,61,0.6)] flex flex-col items-center justify-center"
          >
            <span className="text-xs font-black tracking-widest text-[#F5F5F7] uppercase font-sans leading-none">
              {isModendo ? 'MODENDO' : '100 HICH'}
            </span>
            <span className="text-[8px] font-bold tracking-[0.2em] text-[#90D2ED] uppercase font-mono leading-tight mt-0.5">
              {isModendo ? 'GAMING LOUNGE' : 'ROASTERS'}
            </span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">
              {venueTitle}
            </h1>
            <p className="text-[11px] text-[#90D2ED]/80 font-medium mt-1">سامانه جامع مدیریت و فروش کافه</p>
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
      <main className="w-full max-w-6xl mx-auto my-auto py-8 z-10 flex flex-col items-center">
        {/* Launcher heading removed per final polish spec — app grid retained below */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
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
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" title="دسترسی مجاز" />
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
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" title="دسترسی مجاز" />
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
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse" title="مجاز (مدیر)" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" title="نیازمند پین مدیر" />
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
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse" title="مجاز (مالک)" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" title="قفل ادمین" />
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

          {/* Card 5: Inventory & Storage */}
          <div
            onClick={(e) => handleCardClick(e, 'inventory')}
            className="group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border border-[rgba(144,210,237,0.25)] hover:border-[rgba(144,210,237,0.6)] rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F4C3A] to-[#0A2E24] border border-emerald-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] mb-4 group-hover:scale-105 transition-transform">
                <Warehouse className="w-7 h-7 text-emerald-300" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                  انبار و موجودی
                </h3>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" title="دسترسی مجاز" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                مواد اولیه، بسته‌بندی، ورود کالا (Stock Inward)، رسپی BOM و هشدار کسری موجودی.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-emerald-300 group-hover:translate-x-[-4px] transition-transform">
              <span>ورود به انبار</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 6: Menu & Catalog Management */}
          <div
            onClick={(e) => handleCardClick(e, 'menu')}
            className="group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border border-[rgba(144,210,237,0.25)] hover:border-[rgba(144,210,237,0.6)] rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F223D] to-[#0A1628] border border-[#90D2ED]/40 flex items-center justify-center shadow-[0_0_20px_rgba(144,210,237,0.35)] mb-4 group-hover:scale-105 transition-transform">
                <BookOpen className="w-7 h-7 text-[#90D2ED]" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-[#90D2ED] transition-colors">
                  مدیریت منو و کاتالوگ
                </h3>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse" title="مجاز (مدیر)" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                دسته‌بندی‌ها، قیمت‌گذاری، دان‌ها و نوشیدنی‌ها و دسترس‌پذیری آیتم‌های منو.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-[#90D2ED] group-hover:translate-x-[-4px] transition-transform">
              <span>ورود به مدیریت منو</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 7: Executive P&L Board */}
          <div
            onClick={(e) => handleCardClick(e, 'executive-pl')}
            className="group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border border-[rgba(158,138,94,0.35)] hover:border-[#C5A880]/70 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(201,179,126,0.3), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9E8A5E]/50 to-[#3d3218] border border-[#C5A880]/50 flex items-center justify-center shadow-[0_0_20px_rgba(158,138,94,0.45)] mb-4 group-hover:scale-105 transition-transform">
                <PieChart className="w-7 h-7 text-[#F5E8D0]" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-[#F5E8D0] transition-colors">
                  سود و زیان مدیریتی
                </h3>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse" title="مجاز (مدیر)" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                داشبورد مالی مدیریتی: حاشیه سود، هزینه‌ها و تحلیل عملکرد عملیاتی.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-[#F5E8D0] group-hover:translate-x-[-4px] transition-transform">
              <span>داشبورد مالی</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 8: Audit Log */}
          <div
            onClick={(e) => handleCardClick(e, 'audit')}
            className="group relative bg-[rgba(12,25,48,0.85)] hover:bg-[rgba(16,35,68,0.92)] border border-violet-500/30 hover:border-violet-400/60 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
            style={{
              boxShadow: 'inset 0 1px 1.5px 0 rgba(167,139,250,0.25), 0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3B1E5C] to-[#1C0F30] border border-violet-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)] mb-4 group-hover:scale-105 transition-transform">
                <ScrollText className="w-7 h-7 text-violet-300" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-white group-hover:text-violet-300 transition-colors">
                  لاگ حسابرسی
                </h3>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse" title="مجاز (مدیر)" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                ردیابی کامل رخدادها، تغییرات تنظیمات، ورودها و ابطال‌ها.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-violet-300 group-hover:translate-x-[-4px] transition-transform">
              <span>ورود به لاگ</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>

          {/* Card 9 (Modendo Gaming Lounge Edition only): Station & Table Session Manager */}
          {isModendo && (
            <div
              onClick={(e) => handleCardClick(e, 'floor-plan')}
              className="group relative bg-[rgba(8,24,19,0.85)] hover:bg-[rgba(10,36,28,0.92)] border border-[rgba(104,166,145,0.35)] hover:border-[#68A691]/70 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
              style={{
                boxShadow: 'inset 0 1px 1.5px 0 rgba(104,166,145,0.3), 0 20px 50px rgba(0,0,0,0.8)',
              }}
            >
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#005A3E] to-[#03110C] border border-[#68A691]/50 flex items-center justify-center shadow-[0_0_20px_rgba(0,122,84,0.5)] mb-4 group-hover:scale-105 transition-transform">
                  <Gamepad2 className="w-7 h-7 text-[#A8E6CF]" />
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black text-white group-hover:text-[#A8E6CF] transition-colors">
                    ایستگاه‌های گیمینگ و پلن سالن
                  </h3>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" title="دسترسی مجاز" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  پادهای PS5، غرفه‌های VIP و میزهای کافه؛ تایمر زنده سشن، توقف/ادامه، انتقال میز و تسویه ترکیبی گیمینگ + F&B.
                </p>
              </div>

              <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-bold text-[#A8E6CF] group-hover:translate-x-[-4px] transition-transform">
                <span>مدیریت ایستگاه‌ها و سشن‌ها</span>
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>
          )}
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
