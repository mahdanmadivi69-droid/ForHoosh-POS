/**
 * Modendo POS — Table Session & Gaming Timer Modal (v0.16 Gaming Lounge Edition)
 * Compliant with Specification v6.3 (PS5 Console Rate, Lounge Token-Based, Boardgame Hourly)
 * Mission v0.16 additions: strict integer billing via financialMath, pause/resume,
 * station/table transfer, and one-click combined Gaming + F&B settlement.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Play,
  Square,
  Pause,
  Clock,
  Sparkles,
  Gamepad2,
  Users,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ShoppingCart,
  DollarSign,
  Coffee,
  ArrowLeftRight,
} from 'lucide-react';
import { TableEntity } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { openTabService } from '../../services/openTabService';
import { SmartOrdersStore } from '../../services/storage';
import {
  formatToman,
  calculateSessionElapsedSeconds,
  calculateHourlySessionCostToman,
} from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { ZERO_G_PHYSICS, MotionConfig } from '../../modules/smart-orders/utils/zeroGMotionTokens';

interface TableSessionModalProps {
  table: TableEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectForPosOrder: (tableLabel: string) => void;
}

export const TableSessionModal: React.FC<TableSessionModalProps> = ({
  table,
  isOpen,
  onClose,
  onSelectForPosOrder,
}) => {
  // Hooks run unconditionally — the previous early-return-before-hooks
  // violated React rules-of-hooks and could crash on modal close.
  const [guestCount, setGuestCount] = useState<number>(
    table?.activeGuestsCount || table?.capacity.nominal || 2
  );
  const [tokenInput, setTokenInput] = useState<string>(table?.assignedToken || '');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Strict integer hourly rate from the pricing tier registry (no hardcoded rates)
  const hourlyRateToman = useMemo(() => floorPlanService.getHourlyRateForTable(table), [table]);

  // Reset per-table runtime inputs when a different entity is opened
  useEffect(() => {
    setGuestCount(table?.activeGuestsCount || table?.capacity.nominal || 2);
    setTokenInput(table?.assignedToken || '');
    setIsTransferOpen(false);
  }, [table?.id]);

  // Live timer: wall clock minus accumulated paused budget; frozen while paused
  useEffect(() => {
    if (!table?.sessionStartTime) {
      setElapsedSeconds(0);
      return;
    }
    const calculate = () => {
      const startIso = table.sessionStartTime!;
      if (table.pausedAt) {
        const frozenAtMs = new Date(table.pausedAt).getTime();
        setElapsedSeconds(
          calculateSessionElapsedSeconds(startIso, frozenAtMs, table.pausedMs || 0)
        );
        return;
      }
      setElapsedSeconds(calculateSessionElapsedSeconds(startIso, Date.now(), table.pausedMs || 0));
    };
    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [table?.sessionStartTime, table?.pausedAt, table?.pausedMs, table?.id]);

  // 1s re-render tick so F&B tab totals and transfer targets stay honest
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Open F&B tab bound to this station/table (by floor-plan id or display label)
  const fbTab = useMemo(() => {
    if (!table) return undefined;
    return (
      openTabService.getTabForTable(table.id) ||
      openTabService.getTabForTable(table.display_name)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, nowTick]);

  const sessionChargeToman = calculateHourlySessionCostToman(hourlyRateToman, elapsedSeconds);
  const combinedTotalToman = (fbTab?.total_due || 0) + sessionChargeToman;

  const formatHMS = (totalSec: number) => {
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const isPaused = Boolean(table?.pausedAt);
  const isSessionActive = Boolean(
    table &&
      (table.status === 'GAMING_ACTIVE' ||
        table.status === 'OCCUPIED' ||
        table.status === 'PAUSED' ||
        table.sessionStartTime)
  );

  if (!isOpen || !table) return null;

  const handleStartSession = () => {
    playPosBeep('success');
    floorPlanService.startSession(table.id, table.billing_mode === 'token' ? tokenInput : guestCount);
  };

  const handlePauseResume = () => {
    if (table.pausedAt) {
      playPosBeep('click');
      floorPlanService.resumeSession(table.id);
    } else {
      playPosBeep('click');
      floorPlanService.pauseSession(table.id);
    }
  };

  const handleClearSession = () => {
    const tab =
      openTabService.getTabForTable(table.id) || openTabService.getTabForTable(table.display_name);
    const charge = calculateHourlySessionCostToman(
      floorPlanService.getHourlyRateForTable(table),
      calculateSessionElapsedSeconds(
        table.sessionStartTime || new Date().toISOString(),
        Date.now(),
        table.pausedMs || 0
      )
    );
    const hasMoney = Boolean(tab) || charge > 0;

    if (!hasMoney) {
      if (confirm(`آیا از تسویه و آزادسازی ${table.display_name} اطمینان دارید؟`)) {
        playPosBeep('delete');
        floorPlanService.clearSession(table.id);
        onClose();
      }
      return;
    }

    const summary =
      `تسویه ترکیبی ${table.display_name}\n` +
      `F&B (تب باز): ${formatToman(tab?.total_due || 0)} تومان\n` +
      `شارژ ساعتی گیمینگ: ${formatToman(charge)} تومان\n` +
      `مبلغ نهایی: ${formatToman(combinedTotalToman)} تومان\n\nادامه؟`;

    if (!confirm(summary)) return;

    const activeShift = SmartOrdersStore.getActiveShift();
    if (!activeShift) {
      alert('ابتدا شیفت کاری را باز کنید — دریافت وجه بدون شیفت فعال مجاز نیست.');
      return;
    }

    playPosBeep('success');
    if (tab) {
      // One-click combined settlement: accumulated F&B rounds + hourly gaming charge
      openTabService.settleTab(tab.tab_id, {
        paymentMethod: 'CASH',
        sessionChargeToman: charge,
      });
    } else {
      // No open F&B tab: register the hourly gaming charge as its own settled order
      const activeUser = SmartOrdersStore.getActiveUser();
      const createdOrder = SmartOrdersStore.createOrder({
        tenantId: activeShift.tenantId,
        shiftId: activeShift.id,
        createdByUserId: activeUser.id,
        createdByUserName: activeUser.fullName,
        orderType: 'DINE_IN',
        tableLabel: table.display_name,
        customerName: `سشن ${table.display_name}`,
        status: 'COMPLETED',
        items: [
          {
            id: `session-charge-${Date.now()}`,
            menuItemId: 'session-hourly-charge',
            itemNameSnapshot: 'شارژ ساعتی ایستگاه گیمینگ',
            unitPriceSnapshotToman: charge,
            quantity: 1,
            subtotalToman: charge,
          },
        ],
        grossAmountToman: charge,
        discountAmountToman: 0,
        netTotalToman: charge,
      });
      SmartOrdersStore.recordPayment({
        tenantId: activeShift.tenantId,
        orderId: createdOrder.id,
        shiftId: activeShift.id,
        receivedByUserId: activeUser.id,
        amountToman: charge,
        paymentMethod: 'CASH',
        terminalName: 'صندوق کاروند (مودندو)',
        status: 'SUCCESSFUL',
      });
    }
    floorPlanService.clearSession(table.id);
    onClose();
  };

  // Transfer destinations: any AVAILABLE station/table other than this one
  const freeTargets = floorPlanService
    .getTables()
    .filter((t) => t.id !== table.id && t.status === 'AVAILABLE');

  const handleTransfer = (targetId: string) => {
    const target = floorPlanService.getTableById(targetId);
    if (!target) return;
    const tab =
      openTabService.getTabForTable(table.id) || openTabService.getTabForTable(table.display_name);
    const okSession = floorPlanService.transferSession(table.id, target.id);
    if (!okSession) {
      alert('انتقال سشن ممکن نشد — مقصد باید آزاد باشد.');
      return;
    }
    if (tab) {
      openTabService.transferTab(tab.tab_id, target.id, target.display_name);
    }
    playPosBeep('success');
    setIsTransferOpen(false);
    onClose();
  };

  const timerBlockVisible = table.billing_mode === 'hourly_timer' || table.capabilities.game_timer;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={ZERO_G_PHYSICS.buoyant}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#12161D]/95 border border-white/[0.08] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-right backdrop-blur-2xl"
        >
          {/* Modal Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0B0D11]/80 backdrop-blur-md">
            <motion.button
              whileTap={MotionConfig.tactileTap}
              onClick={() => {
                playPosBeep('click');
                onClose();
              }}
              className="p-1.5 text-[#9EACB8] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </motion.button>
            <div className="flex items-center gap-2">
              <div>
                <h3 className="text-base font-black text-white tracking-heading">{table.display_name}</h3>
                <span className="text-[11px] text-[#9EACB8]">
                  {table.level === 0 ? 'تراز ۰ (لانژ / گیمینگ)' : 'تراز ۱ (سالن / تراس)'}
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#1E293B] border border-white/[0.08] flex items-center justify-center text-blue-400 shadow-inner">
                {table.billing_mode === 'hourly_timer' ? (
                  <Gamepad2 className="w-5 h-5" />
                ) : table.billing_mode === 'token' ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <Coffee className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4">
            {/* Status Indicator Bar */}
            <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isPaused
                      ? 'bg-amber-400'
                      : isSessionActive
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-emerald-500'
                  }`}
                ></span>
                <span className="text-xs font-bold text-[#E2E8F0]">
                  {isPaused
                    ? 'سشن متوقف موقت (زمان فریز شده)'
                    : isSessionActive
                    ? 'سشن فعال / پذیرش شده'
                    : 'میز آماده پذیرش'}
                </span>
              </div>
              <span className="text-xs text-[#9EACB8] font-medium">
                ظرفیت: {table.capacity.nominal} تا {table.capacity.max} نفر
              </span>
            </div>

            {/* Active Timer / Elapsed Cost */}
            {timerBlockVisible ? (
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between shadow-[0_0_15px_-4px_rgba(59,130,246,0.3)]">
                <div>
                  <span className="text-[11px] text-blue-300 block mb-0.5 font-bold">
                    زمان سپری شده بازی / کنسول
                  </span>
                  <span className="text-2xl font-black font-mono tracking-mono text-blue-400">
                    {formatHMS(elapsedSeconds)}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-[#9EACB8] block mb-0.5">
                    هزینه زمان ({formatToman(hourlyRateToman)} ت/ساعت)
                  </span>
                  <span className="text-lg font-black text-white font-mono tracking-mono">
                    {formatToman(sessionChargeToman)}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Open F&B Tab Accumulation (Mission v0.16) */}
            {fbTab && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    تب باز F&B این ایستگاه ({fbTab.rounds.length} راند)
                  </span>
                  <span className="font-mono text-emerald-200">{formatToman(fbTab.total_due)}</span>
                </div>
                {timerBlockVisible && (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-500/20">
                    <span className="font-bold text-white">مبلغ ترکیبی (F&B + گیمینگ):</span>
                    <bdi className="font-mono font-black text-white" dir="ltr">
                      {formatToman(combinedTotalToman)}
                    </bdi>
                  </div>
                )}
              </div>
            )}

            {/* Token Mode (Lounge) */}
            {table.billing_mode === 'token' && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <label className="text-xs font-bold text-emerald-300 block">
                  شماره ژتون موقت مشتری (Token ID):
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="مثلاً: LZ-12 یا ۱۰۴"
                  className="w-full bg-[#0B0D11] border border-white/[0.08] px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 text-left font-mono"
                />
              </div>
            )}

            {/* Guest Count */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0D11] border border-white/[0.06]">
              <span className="text-xs font-bold text-[#CBD5E1]">تعداد میهمانان:</span>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={MotionConfig.tactileTap}
                  onClick={() => {
                    playPosBeep('click');
                    setGuestCount((c) => Math.max(1, c - 1));
                  }}
                  className="w-8 h-8 bg-[#1E293B] hover:bg-[#334155] rounded-lg text-white font-bold flex items-center justify-center cursor-pointer border border-white/[0.06]"
                >
                  -
                </motion.button>
                <span className="text-sm font-bold text-white px-2 font-mono tracking-mono">{guestCount}</span>
                <motion.button
                  whileTap={MotionConfig.tactileTap}
                  onClick={() => {
                    playPosBeep('click');
                    setGuestCount((c) => Math.min(table.capacity.max, c + 1));
                  }}
                  className="w-8 h-8 bg-[#1E293B] hover:bg-[#334155] rounded-lg text-white font-bold flex items-center justify-center cursor-pointer border border-white/[0.06]"
                >
                  +
                </motion.button>
              </div>
            </div>

            {/* Transfer Destination Picker (Mission v0.16) */}
            {isTransferOpen && (
              <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/[0.08] max-h-44 overflow-y-auto space-y-1">
                <p className="text-[11px] text-[#9EACB8] font-bold mb-1.5">
                  انتقال سشن و تب باز به کدام ایستگاه / میز؟
                </p>
                {freeTargets.length === 0 && (
                  <p className="text-[11px] text-amber-300">هیچ مقصد آزادی برای انتقال وجود ندارد.</p>
                )}
                {freeTargets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTransfer(t.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#12161D] hover:bg-[#1E293B] text-xs text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      {t.billing_mode === 'hourly_timer' && <Gamepad2 className="w-3 h-3 text-sky-400" />}
                      <span>{t.display_name}</span>
                    </span>
                    <span className="text-[10px] text-[#9EACB8] font-mono">
                      {t.billing_mode === 'hourly_timer'
                        ? `${formatToman(floorPlanService.getHourlyRateForTable(t))} ت/ساعت`
                        : 'آزاد'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 border-t border-white/[0.08] bg-[#0B0D11]/80 flex flex-wrap items-center justify-between gap-2">
            {/* Settle / Clear */}
            {isSessionActive && (
              <motion.button
                whileTap={MotionConfig.tactileTap}
                onClick={handleClearSession}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-950/40 hover:bg-red-900 border border-red-700/50 text-red-300 transition-colors cursor-pointer"
              >
                {fbTab || sessionChargeToman > 0 ? 'تسویه ترکیبی و پایان سشن' : 'تسویه و پایان سشن'}
              </motion.button>
            )}

            <div className="flex items-center gap-2 mr-auto flex-wrap">
              {/* Start Session Button */}
              {!isSessionActive ? (
                <motion.button
                  whileTap={MotionConfig.tactileTap}
                  onClick={handleStartSession}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  شروع سشن و رزرو
                </motion.button>
              ) : (
                <>
                  {/* Pause / Resume (Mission v0.16) */}
                  <motion.button
                    whileTap={MotionConfig.tactileTap}
                    onClick={handlePauseResume}
                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
                      isPaused
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        ادامه سشن
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        توقف موقت
                      </>
                    )}
                  </motion.button>

                  {/* Transfer Session + Tab (Mission v0.16) */}
                  <motion.button
                    whileTap={MotionConfig.tactileTap}
                    onClick={() => {
                      playPosBeep('click');
                      setIsTransferOpen((v) => !v);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-sky-700 hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    انتقال
                  </motion.button>
                </>
              )}

              {/* Jump to POS Order */}
              <motion.button
                whileTap={MotionConfig.tactileTap}
                onClick={() => {
                  playPosBeep('click');
                  onSelectForPosOrder(table.display_name);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                ثبت فاکتور در صندوق POS
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
