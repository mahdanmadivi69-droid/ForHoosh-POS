/**
 * Modendo POS — FloorPlanView Module
 * Full Split-Level Interactive Table Management & Floor Plan Visualizer
 * Compliant with Specification v6.3-Final Settled
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Layers,
  Gamepad2,
  Coffee,
  Sparkles,
  Settings2,
  RefreshCw,
  Plus,
  RotateCcw,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Flame,
  LayoutGrid,
  ChevronLeft,
} from 'lucide-react';
import { TableEntity } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { TableSessionModal } from './TableSessionModal';
import { playPosBeep } from '../../services/soundEffects';
import { MotionConfig } from '../../modules/smart-orders/utils/zeroGMotionTokens';

interface FloorPlanViewProps {
  onBackToPos: () => void;
  onSelectTableForOrder: (tableLabel: string) => void;
}

export const FloorPlanView: React.FC<FloorPlanViewProps> = ({
  onBackToPos,
  onSelectTableForOrder,
}) => {
  const [levelFilter, setLevelFilter] = useState<0 | 1 | 'all'>('all');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<TableEntity | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState<boolean>(false);
  const [tables, setTables] = useState<TableEntity[]>([]);

  useEffect(() => {
    const unsub = floorPlanService.subscribe((schema) => {
      setTables(schema.tables);
    });
    return () => unsub();
  }, []);

  // Spatial stats calculations
  const totalTables = tables.length;
  const occupiedCount = tables.filter(
    (t) => t.status === 'OCCUPIED' || t.status === 'GAMING_ACTIVE' || t.sessionStartTime
  ).length;
  const ps5ActiveCount = tables.filter(
    (t) => t.billing_mode === 'hourly_timer' && t.status === 'GAMING_ACTIVE'
  ).length;

  const handleOpenSession = (table: TableEntity) => {
    setSelectedTable(table);
    setIsSessionModalOpen(true);
  };

  const handleResetDefaults = () => {
    if (confirm('آیا از بازنشانی نقشه سالن به چیدمان استاندارد مودندو (نسخه ۶.۳) اطمینان دارید؟')) {
      floorPlanService.resetToDefault();
    }
  };

  return (
    <div className="max-w-[1720px] mx-auto px-3 md:px-5 py-4 space-y-4 select-none animate-fade-in text-right">
      {/* Top Header & Operational Stats Bar */}
      <div className="bg-[#12161D] border border-[#27313F] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-md">
        {/* Title & Brand Zone */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E293B] border border-[#27313F] flex items-center justify-center text-emerald-400">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-heading">
                نقشه سالن و مدیریت میزها (Floor Plan)
              </h1>
              <span className="text-[10px] bg-[#1E293B] border border-[#27313F] text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                نسخه ۶.۳ Final
              </span>
            </div>
            <p className="text-xs text-[#9EACB8] mt-0.5">
              سیستم مدیریت ترازهای دوگانه (سالن بردگیم، لانژ ژتونی و اتاق PS5)
            </p>
          </div>
        </div>

        {/* Quick Operational Stats */}
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <div className="bg-[#0B0D11] border border-[#27313F] px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <Coffee className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-[#9EACB8] block leading-none">میزهای اشغال</span>
              <span className="text-xs font-bold text-white tracking-mono font-mono">
                {occupiedCount} از {totalTables}
              </span>
            </div>
          </div>

          <div className="bg-[#0B0D11] border border-[#27313F] px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-[10px] text-[#9EACB8] block leading-none">کنسول‌های فعال</span>
              <span className="text-xs font-bold text-blue-400 tracking-mono font-mono">
                {ps5ActiveCount} از ۴ ایستگاه
              </span>
            </div>
          </div>

          {/* Back to POS Button */}
          <motion.button
            whileTap={MotionConfig.tactileTap}
            onClick={() => {
              playPosBeep('click');
              onBackToPos();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            <span>بازگشت به صندوق</span>
            <ChevronLeft className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Control Segment: Level Filter & Editor Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12161D] border border-[#27313F] p-2.5 rounded-2xl">
        {/* Level Switcher (Section 4.1) */}
        <div className="flex items-center gap-1 bg-[#0B0D11] p-1 rounded-xl border border-[#27313F]">
          <motion.button
            whileTap={MotionConfig.tactileTap}
            onClick={() => {
              playPosBeep('click');
              setLevelFilter('all');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              levelFilter === 'all'
                ? 'bg-[#1E293B] text-white shadow-sm'
                : 'text-[#9EACB8] hover:text-white'
            }`}
          >
            کل فضا (Split-Level)
          </motion.button>
          <motion.button
            whileTap={MotionConfig.tactileTap}
            onClick={() => {
              playPosBeep('click');
              setLevelFilter(0);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              levelFilter === 0
                ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 shadow-sm'
                : 'text-[#9EACB8] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            تراز ۰ (لانژ و PS5)
          </motion.button>
          <motion.button
            whileTap={MotionConfig.tactileTap}
            onClick={() => {
              playPosBeep('click');
              setLevelFilter(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              levelFilter === 1
                ? 'bg-amber-950/60 border border-amber-700/60 text-amber-300 shadow-sm'
                : 'text-[#9EACB8] hover:text-white'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            تراز ۱ (سالن و تراس)
          </motion.button>
        </div>

        {/* Mode Toggle & Admin Options (Section 4.2) */}
        <div className="flex items-center gap-2">
          {isEditMode && (
            <motion.button
              whileTap={MotionConfig.tactileTap}
              onClick={() => {
                playPosBeep('delete');
                handleResetDefaults();
              }}
              className="px-3 py-1.5 text-xs font-bold text-[#CBD5E1] hover:text-white bg-[#1E293B] hover:bg-[#334155] rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="بازنشانی مختصات و ابعاد نقشه به پیش‌فرض کارخانه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              بازنشانی چیدمان
            </motion.button>
          )}

          <motion.button
            whileTap={MotionConfig.tactileTap}
            onClick={() => {
              playPosBeep('click');
              setIsEditMode(!isEditMode);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isEditMode
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-[#1E293B] text-[#CBD5E1] hover:text-white border border-[#27313F]'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>{isEditMode ? 'حالت ویرایش فعال' : 'ویرایش نقشه سالن'}</span>
          </motion.button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <FloorPlanCanvas
        levelFilter={levelFilter}
        isEditMode={isEditMode}
        selectedTableId={selectedTable?.id || null}
        onSelectTable={(tbl) => setSelectedTable(tbl)}
        onOpenSessionModal={handleOpenSession}
        onConfirmTableOrder={(tbl) => onSelectTableForOrder(tbl.display_name)}
      />

      {/* Table Session / Gaming Timer Modal */}
      <TableSessionModal
        table={selectedTable}
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        onSelectForPosOrder={(label) => {
          onSelectTableForOrder(label);
        }}
      />
    </div>
  );
};
