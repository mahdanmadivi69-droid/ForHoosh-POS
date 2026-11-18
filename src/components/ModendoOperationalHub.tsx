/**
 * src/components/ModendoOperationalHub.tsx
 * 
 * Modendo POS — Operational Module Hub (Launcher View)
 * Rendered after PIN unlock when activeTenant === 'modendo'.
 * Features:
 *  - Solid Matte Emerald Visual Tokens (#06120F canvas, #0B1F1A cards, #10B981 emerald accent).
 *  - 9 Interactive Module Cards (3x3 Grid):
 *      1. نقشه سالن و ایستگاه‌های PS5 (FLOOR_PLAN)
 *      2. صندوق و سفارش بیرون‌بر (POS takeaway)
 *      3. بار باریستا و آشپزخانه (KDS)
 *      4. سابقه فیش‌ها و چاپ مجدد (Receipts & Reprint)
 *      5. گزارش‌ها و تراز مالی (Role-Gated -> REPORTS)
 *      6. مدیریت منو و تعرفه بازی (Role-Gated -> MENU_ADMIN)
 *      7. انبارداری و موجودی کالا (Role-Gated -> INVENTORY)
 *      8. لاگ حسابرسی و نظارت (Role-Gated -> AUDIT)
 *      9. تنظیمات سیستم و چاپگرها (Role-Gated -> ModendoSettingsDeck)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutGrid,
  ShoppingBag,
  Coffee,
  TrendingUp,
  Sliders,
  Printer,
  Lock,
  Unlock,
  ShieldCheck,
  Clock,
  Sparkles,
  Gamepad2,
  ChevronLeft,
  Users,
  ShieldAlert,
  Flame,
  CheckCircle2,
  LogOut,
  MapPin,
  UtensilsCrossed,
  Receipt,
  Warehouse,
  Shield,
} from 'lucide-react';
import { AuthUserRecord } from '../types/rbac-settings';
import { Shift, User } from '../types/domain';
import { PinAuthModal } from './modals/PinAuthModal';
import { ModendoSettingsDeck } from './ModendoSettingsDeck';
import { MODENDO_FLOOR_NODES } from './floorplan/FloorPlanCanvas';
import { openTabService } from '../services/openTabService';
import { CatalogService } from '../services/catalog/catalogService';
import { baristaDispatcher } from '../services/baristaDispatcher';
import { playPosBeep } from '../services/soundEffects';
import { SmartOrdersStore } from '../services/storage';

interface ModendoOperationalHubProps {
  activeUser: AuthUserRecord | User;
  activeShift: Shift | null;
  onSelectModule: (target: 'floor-plan' | 'pos' | 'takeaway' | 'kds' | 'reports' | 'menu' | 'settings' | 'inventory' | 'audit' | 'receipts') => void;
  onLock: () => void;
  onOpenShiftModal?: () => void;
  onOpenKds?: () => void;
  onOpenReceiptHistory?: () => void;
  baristaActiveCount?: number;
}

export const ModendoOperationalHub: React.FC<ModendoOperationalHubProps> = ({
  activeUser,
  activeShift,
  onSelectModule,
  onLock,
  onOpenShiftModal,
  onOpenKds,
  onOpenReceiptHistory,
  baristaActiveCount = 0,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [elevationTarget, setElevationTarget] = useState<'reports' | 'menu' | 'settings' | 'inventory' | 'audit' | null>(null);
  const [activeTablesCount, setActiveTablesCount] = useState<number>(0);
  const [activePs5Count, setActivePs5Count] = useState<number>(0);
  const [liveKdsCount, setLiveKdsCount] = useState<number>(baristaActiveCount);
  const [settledCount, setSettledCount] = useState<number>(0);

  const isManagerOrOwner =
    activeUser.role === 'OWNER' ||
    activeUser.role === 'MANAGER' ||
    (activeUser.role as string).toLowerCase() === 'owner' ||
    (activeUser.role as string).toLowerCase() === 'manager';

  // Live tables and PS5 console monitoring
  useEffect(() => {
    const updateStats = () => {
      try {
        const activeTabs = openTabService.getAllActiveTabs('tenant-modendo-01');
        const catalogTabs = CatalogService.getOpenTabs('tenant-modendo-01');
        const allTabs = [...activeTabs, ...catalogTabs];

        let occupiedTables = 0;
        let occupiedPs5 = 0;

        for (const node of MODENDO_FLOOR_NODES) {
          const match = allTabs.some((t: any) => {
            const label = t.table_or_customer || t.tableOrCustomer || t.tableId || '';
            return (
              label === node.label ||
              label === node.id ||
              label.includes(node.label) ||
              (node.tableId && label.includes(node.tableId)) ||
              (node.stationId && label.includes(node.stationId))
            );
          });

          if (match) {
            if (node.kind === 'PS5') {
              occupiedPs5++;
            } else {
              occupiedTables++;
            }
          }
        }

        setActiveTablesCount(occupiedTables);
        setActivePs5Count(occupiedPs5);

        const orders = SmartOrdersStore.getOrders();
        setSettledCount(orders.filter((o) => o.status === 'COMPLETED').length);
      } catch (err) {
        console.warn('[ModendoOperationalHub] Could not calculate live station stats:', err);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 2500);
    return () => clearInterval(interval);
  }, []);

  // Live Barista KDS ticket counter subscription
  useEffect(() => {
    const unsub = baristaDispatcher.subscribe((tickets) => {
      const active = tickets.filter((t) => t.prepStatus !== 'READY').length;
      setLiveKdsCount(active);
    });
    return () => unsub();
  }, []);

  const handleCardClick = (
    target: 'floor-plan' | 'pos' | 'takeaway' | 'kds' | 'receipts' | 'reports' | 'menu' | 'settings' | 'inventory' | 'audit'
  ) => {
    playPosBeep('click');

    if (target === 'receipts') {
      onOpenReceiptHistory?.();
      return;
    }

    if (target === 'floor-plan' || target === 'pos' || target === 'takeaway') {
      onSelectModule(target);
      return;
    }

    if (target === 'kds') {
      if (onOpenKds) {
        onOpenKds();
      } else {
        onSelectModule('kds');
      }
      return;
    }

    // Role-gated targets: reports, menu, settings
    if (isManagerOrOwner) {
      if (target === 'settings') {
        setIsSettingsOpen(true);
      } else {
        onSelectModule(target);
      }
    } else {
      // Trigger PIN elevation for Cashier/Barista
      setElevationTarget(target);
    }
  };

  const handleElevationSuccess = () => {
    if (elevationTarget === 'settings') {
      setElevationTarget(null);
      setIsSettingsOpen(true);
    } else if (elevationTarget) {
      const target = elevationTarget;
      setElevationTarget(null);
      onSelectModule(target);
    }
  };

  const roleTitleFa =
    activeUser.role === 'OWNER' || (activeUser.role as string).toLowerCase() === 'owner'
      ? 'مالک سیستم'
      : activeUser.role === 'MANAGER' || (activeUser.role as string).toLowerCase() === 'manager'
      ? 'مدیر شیفت'
      : activeUser.role === 'ACCOUNTANT'
      ? 'حسابدار'
      : 'صندوق‌دار / باریستا';

  return (
    <div
      dir="rtl"
      className="h-screen max-h-screen w-full bg-[#06120F] text-white flex flex-col justify-between p-4 md:p-8 select-none overflow-y-auto overflow-x-hidden font-sans relative pb-32 liquid-ambient-canvas"
    >
      {/* Top Operational Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto rounded-3xl liquid-glass-shell p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xl shrink-0">
        {/* Brand & Hub Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-black tracking-tight text-white font-display-latin">
                MODENDO
              </span>
              <span className="text-white/30 text-sm hidden sm:inline">—</span>
              <h1 className="text-sm md:text-base font-black text-white">
                مرکز عملیات کافه گیمینگ و بیسترو
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              سیستم جامع ماژول‌های نقشه سالن، سفارش‌گیری، بار باریستا و مدیریت مالی
            </p>
          </div>
        </div>

        {/* User Chip, Shift Status & Terminal Lock */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active Shift Pill */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              onOpenShiftModal?.();
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeShift
                ? 'bg-[#10B981]/20 border border-[#10B981]/50 text-emerald-200 hover:bg-[#10B981]/30 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
                : 'bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
            }`}
            title="وضعیت شیفت کاری"
          >
            <Clock className={`w-3.5 h-3.5 ${activeShift ? 'text-[#10B981]' : 'text-amber-300'}`} />
            <span>{activeShift ? 'شیفت فعال' : 'شیفت بسته (شروع)'}</span>
          </button>

          {/* Active User Pill */}
          <div className="rounded-full bg-[#0E2922] border border-[#16382F] px-3.5 py-1.5 flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-white">{activeUser.fullName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#94A3B8] font-bold">
              {roleTitleFa}
            </span>
          </div>

          {/* Lock Terminal Button (Minimal Crimson Trace) */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              onLock();
            }}
            className="rounded-full bg-[#881337]/30 hover:bg-[#881337]/70 border border-[#991B1B]/50 hover:border-[#991B1B] p-2 text-rose-300 hover:text-white transition cursor-pointer shadow-sm"
            title="قفل فوری پایانه"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main 9-Module Interactive Grid */}
      <main className="relative z-10 max-w-6xl w-full mx-auto py-6 pb-24 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* =========================================================================
              CARD 1: نقشه سالن و ایستگاه‌های PS5
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('floor-plan')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-[#10B981] shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shadow-[0_0_16px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/40 inline-block mb-1">
                    ۲۳ جایگاه و ۴ کنسول
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                    نقشه سالن و ایستگاه‌های PS5
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-emerald-300 group-hover:bg-[#10B981]/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              پلان ۳ بالِ سالن (لانژ مبل و ژتون، سالن اصلی بردگیم، تراس) و مانیتورینگ کابین‌های PS5 با تایمر زنده.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-white font-mono font-bold">{activeTablesCount} فعال</span>
                <span className="text-[#16382F]">|</span>
                <span className="text-sky-300 font-mono font-bold">{activePs5Count} PS5</span>
              </div>
              <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>ورود به سالن</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 2: صندوق و سفارش بیرون‌بر (POS & Takeaway)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('takeaway')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-amber-400/50 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.2)] group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 inline-block mb-1">
                    ثبت سریع سفارش
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-amber-300 transition-colors">
                    صندوق و سفارش بیرون‌بر
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-amber-300 group-hover:bg-amber-500/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              ثبت مستقیم فاکتورهای بیرون‌بر (Takeaway)، انتخاب اقلام از کاتالوگ ۸۹ قلمی و تسویه نقدی/پوز.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">بدون نیاز به انتخاب میز</span>
              <span className="text-amber-300 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>ثبت فاکتور فوری</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 3: بار باریستا و آشپزخانه (KDS)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('kds')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-[#10B981] shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shadow-[0_0_16px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
                  <Coffee className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    {liveKdsCount > 0 ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                        <span>{liveKdsCount} فیش در صف</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#94A3B8]">
                        صف آماده‌سازی خلوت
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                    بار باریستا و آشپزخانه (KDS)
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-emerald-300 group-hover:bg-[#10B981]/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              نمایشگر لمسی آماده‌سازی نوشیدنی‌های گرم، بار سرد و اسنک‌های آشپزخانه با تفکیک ایستگاه‌ها.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">تفکیک ایستگاه Bar & Kitchen</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>نمایشگر KDS</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 4: سابقه فیش‌ها و چاپ مجدد (Receipt History & Reprint)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('receipts')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-[#10B981] shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shadow-[0_0_16px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/30 inline-block">
                      {settledCount > 0 ? `${settledCount} فیش ثبت‌شده` : 'بایگانی فیش‌ها'}
                    </span>
                  </div>
                  <h2 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                    سابقه فیش‌ها و چاپ مجدد
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-emerald-300 group-hover:bg-[#10B981]/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              مشاهده فاکتورهای تسویه‌شده، چاپ مجدد فیش حرارتی ۸۰ میلی‌متری و ابطال با پین‌کد مدیر.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">چاپ مجدد حرارتی · ابطال PIN</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>بایگانی و چاپ مجدد</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 5: گزارش‌ها و تراز مالی (Role-Gated)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('reports')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-sky-400/50 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.2)] group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30 inline-block mb-1">
                    {isManagerOrOwner ? 'دسترسی مدیریت' : 'نیازمند مجوز مدیر'}
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-sky-300 transition-colors">
                    گزارش‌ها و تراز مالی
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-sky-300 group-hover:bg-sky-500/20 transition-all">
                {isManagerOrOwner ? <ChevronLeft className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-300" />}
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              تحلیل درآمدهای ناخالص، مغایرت نقدی صندوق، تفکیک درآمد کافه و کنسول‌های بازی و گزارش‌های Z-Report.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">خلاصه فروش و شیفت</span>
              <span className="text-sky-300 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>مشاهده گزارشات</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 6: مدیریت منو و تعرفه بازی (Role-Gated)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('menu')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-purple-400/50 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.2)] group-hover:scale-105 transition-transform">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30 inline-block mb-1">
                    {isManagerOrOwner ? 'کاتالوگ و قیمت‌گذاری' : 'نیازمند مجوز مدیر'}
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-purple-300 transition-colors">
                    مدیریت منو و تعرفه بازی
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-purple-300 group-hover:bg-purple-500/20 transition-all">
                {isManagerOrOwner ? <ChevronLeft className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-300" />}
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              پیکربندی ۸۹ قلم منوی مودندو، نرخ ساعتی بازی کنسول PS5، افزودن آیتم جدید و تنظیم مواد اولیه BOM.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">قیمت‌ها به تومان صحیح</span>
              <span className="text-purple-300 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>ویرایش کاتالوگ</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 7: انبارداری و موجودی کالا (Role-Gated)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('inventory')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-emerald-400/50 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
                  <Warehouse className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 inline-block mb-1">
                    مواد اولیه و اقلام
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                    انبار و موجودی کالا
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-emerald-300 group-hover:bg-emerald-500/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              کنترل موجودی انبار، بسته‌بندی، مواد اولیه باریستا و آشپزخانه، ثبت ورود کالا و هشدار کسری اقلام.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">ورود کالا و هشدار موجودی</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>کنترل انبار</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 8: لاگ حسابرسی و نظارت سیستم (Role-Gated)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('audit')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-violet-400/50 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 shadow-[0_0_16px_rgba(139,92,246,0.2)] group-hover:scale-105 transition-transform">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-400/30 inline-block mb-1">
                    امنیت و رهگیری
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-violet-300 transition-colors">
                    لاگ حسابرسی و نظارت
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-violet-300 group-hover:bg-violet-500/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              ردیابی جامع رخدادهای پایانه، تغییرات تنظیمات، ورودها، اعمال تخفیف‌ها و ابطال فاکتورها.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">لاگ وقایع امنیتی</span>
              <span className="text-violet-300 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>مشاهده لاگ</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>

          {/* =========================================================================
              CARD 9: تنظیمات سیستم و چاپگرها (Role-Gated Modendo Configuration)
             ========================================================================= */}
          <motion.div
            role="button"
            tabIndex={0}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            onClick={() => handleCardClick('settings')}
            className="relative rounded-3xl p-5 liquid-glass-card border border-[#16382F]/90 hover:border-indigo-400/50 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between min-h-[220px] transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-[0_0_16px_rgba(99,102,241,0.2)] group-hover:scale-105 transition-transform">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/30 inline-block mb-1">
                    {isManagerOrOwner ? 'سخت‌افزار و شبکه' : 'نیازمند مجوز مدیر'}
                  </span>
                  <h2 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                    تنظیمات سیستم و چاپگرها
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-indigo-300 group-hover:bg-indigo-500/20 transition-all">
                {isManagerOrOwner ? <ChevronLeft className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-300" />}
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed my-3">
              پیکربندی پورت‌های ۹۱۰۰/۹۱۰۱ چاپگرهای بار و آشپزخانه، مدیریت کدهای PIN پرسنل، سربرگ فیش مودندو و پشتیبان‌گیری محلی دیتابیس.
            </p>

            <div className="pt-3 border-t border-[#16382F] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">پیکربندی اختصاصی کافه گیمینگ مودندو</span>
              <span className="text-indigo-300 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                <span>پیکربندی پایانه</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom Status Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center py-2 text-xs text-[#64748b] flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 shrink-0 mb-8">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>نسخه مودندو ۰.۱۶.۰ (Gaming Lounge Edition)</span>
        </div>
        <div>
          <span>کافه بردگیم و گیمینگ مودندو · پایانه فعال TERM-01-MAIN</span>
        </div>
      </footer>

      {/* Modendo Dedicated Settings Modal */}
      <ModendoSettingsDeck
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUserName={activeUser.fullName}
      />

      {/* PIN Elevation Modal for Protected Cards (Reports, Menu, Settings) */}
      <PinAuthModal
        isOpen={Boolean(elevationTarget)}
        action={
          elevationTarget === 'reports'
            ? 'ACCESS_SETTINGS_PANEL'
            : elevationTarget === 'menu'
            ? 'EDIT_RECIPE_BOM'
            : 'ACCESS_SETTINGS_PANEL'
        }
        requestedByUser={activeUser.fullName}
        onSuccess={handleElevationSuccess}
        onClose={() => setElevationTarget(null)}
      />
    </div>
  );
};
export default ModendoOperationalHub;
