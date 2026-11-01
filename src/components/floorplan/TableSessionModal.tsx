/**
 * Modendo POS — Table Session & Gaming Timer Modal
 * Compliant with Specification v6.3 (PS5 Console Rate, Lounge Token-Based, Boardgame Hourly)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Play,
  Square,
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
} from 'lucide-react';
import { TableEntity, TableStatus } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { formatToman } from '../../services/financialMath';
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
  if (!isOpen || !table) return null;

  const [guestCount, setGuestCount] = useState<number>(table.activeGuestsCount || table.capacity.nominal);
  const [tokenInput, setTokenInput] = useState<string>(table.assignedToken || '');
  const [hourlyRateToman, setHourlyRateToman] = useState<number>(
    table.billing_mode === 'hourly_timer' ? 120000 : 45000
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Live timer calculation
  useEffect(() => {
    if (!table.sessionStartTime) {
      setElapsedSeconds(0);
      return;
    }

    const calculate = () => {
      const start = new Date(table.sessionStartTime!).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSeconds(diff);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [table.sessionStartTime]);

  const formatHMS = (totalSec: number) => {
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Cost calculation based on elapsed time
  const calculatedCostToman = Math.round((elapsedSeconds / 3600) * hourlyRateToman);

  const handleStartSession = () => {
    playPosBeep('success');
    floorPlanService.startSession(table.id, table.billing_mode === 'token' ? tokenInput : guestCount);
  };

  const handleClearSession = () => {
    if (confirm(`آیا از تسویه و آزادسازی ${table.display_name} اطمینان دارید؟`)) {
      playPosBeep('delete');
      floorPlanService.clearSession(table.id);
      onClose();
    }
  };

  const isSessionActive =
    table.status === 'GAMING_ACTIVE' ||
    table.status === 'OCCUPIED' ||
    Boolean(table.sessionStartTime);

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
                    isSessionActive ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                ></span>
                <span className="text-xs font-bold text-[#E2E8F0]">
                  {isSessionActive ? 'سشن فعال / پذیرش شده' : 'میز آماده پذیرش'}
                </span>
              </div>
              <span className="text-xs text-[#9EACB8] font-medium">
                ظرفیت: {table.capacity.nominal} تا {table.capacity.max} نفر
              </span>
            </div>

            {/* Active Timer / Elapsed Cost */}
            {table.billing_mode === 'hourly_timer' || table.capabilities.game_timer ? (
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
                    هزینه زمان (نرخ ساعتی)
                  </span>
                  <span className="text-lg font-black text-white font-mono tracking-mono">
                    {formatToman(calculatedCostToman)}
                  </span>
                </div>
              </div>
            ) : null}

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
                تسویه و پایان سشن
              </motion.button>
            )}

            <div className="flex items-center gap-2 mr-auto">
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
              ) : null}

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
