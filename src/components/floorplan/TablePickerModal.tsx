/**
 * Modendo POS — Table Picker Modal for Cashier Quick Selection
 * Allows cashiers to visually select tables directly from the interactive floor plan.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LayoutGrid, Check } from 'lucide-react';
import { TableEntity } from '../../types/floor-plan';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { playPosBeep } from '../../services/soundEffects';
import { ZERO_G_PHYSICS, MotionConfig } from '../../modules/smart-orders/utils/zeroGMotionTokens';

interface TablePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (tableLabel: string) => void;
}

export const TablePickerModal: React.FC<TablePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTable,
}) => {
  if (!isOpen) return null;

  const [levelFilter, setLevelFilter] = useState<0 | 1 | 'all'>('all');
  const [selectedTable, setSelectedTable] = useState<TableEntity | null>(null);

  const handleConfirm = () => {
    if (selectedTable) {
      playPosBeep('success');
      onSelectTable(selectedTable.display_name);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={ZERO_G_PHYSICS.buoyant}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#12161D]/95 border border-white/[0.08] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl text-right backdrop-blur-2xl"
        >
          {/* Header */}
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
                <h2 className="text-base font-black text-white tracking-heading">انتخاب میز از نقشه سالن</h2>
                <p className="text-[11px] text-[#9EACB8]">
                  روی میز یا زون مورد نظر کلیک کنید تا در فاکتور جاری درج شود
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#1E293B] border border-white/[0.08] flex items-center justify-center text-emerald-400 shadow-inner">
                <LayoutGrid className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Level Switcher Sub-bar */}
          <div className="px-4 py-2 border-b border-white/[0.08] bg-[#12161D] flex items-center justify-between">
            <div className="flex items-center gap-1 bg-[#0B0D11] p-1 rounded-xl border border-white/[0.08]">
              <motion.button
                whileTap={MotionConfig.tactileTap}
                onClick={() => {
                  playPosBeep('click');
                  setLevelFilter('all');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  levelFilter === 'all' ? 'bg-[#1E293B] text-white' : 'text-[#9EACB8]'
                }`}
              >
                کل فضا
              </motion.button>
              <motion.button
                whileTap={MotionConfig.tactileTap}
                onClick={() => {
                  playPosBeep('click');
                  setLevelFilter(0);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  levelFilter === 0 ? 'bg-emerald-950/60 text-emerald-300' : 'text-[#9EACB8]'
                }`}
              >
                تراز ۰ (لانژ و PS5)
              </motion.button>
              <motion.button
                whileTap={MotionConfig.tactileTap}
                onClick={() => {
                  playPosBeep('click');
                  setLevelFilter(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  levelFilter === 1 ? 'bg-amber-950/60 text-amber-300' : 'text-[#9EACB8]'
                }`}
              >
                تراز ۱ (سالن و تراس)
              </motion.button>
            </div>

            {selectedTable && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#CBD5E1] font-bold">
                  انتخاب شده: <span className="text-emerald-400">{selectedTable.display_name}</span>
                </span>
              </div>
            )}
          </div>

          {/* Canvas Body */}
          <div className="flex-1 p-3 overflow-hidden bg-[#0B0D11]">
            <FloorPlanCanvas
              levelFilter={levelFilter}
              isEditMode={false}
              selectedTableId={selectedTable?.id || null}
              onSelectTable={(tbl) => {
                if (tbl) playPosBeep('click');
                setSelectedTable(tbl);
              }}
              onConfirmTableOrder={(tbl) => {
                playPosBeep('success');
                onSelectTable(tbl.display_name);
                onClose();
              }}
            />
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/[0.08] bg-[#0B0D11]/80 flex items-center justify-between">
            <motion.button
              whileTap={MotionConfig.tactileTap}
              onClick={() => {
                playPosBeep('click');
                onClose();
              }}
              className="px-4 py-2 text-xs font-bold text-[#9EACB8] hover:text-white cursor-pointer"
            >
              انصراف
            </motion.button>

            <motion.button
              whileTap={selectedTable ? MotionConfig.tactileTap : undefined}
              onClick={handleConfirm}
              disabled={!selectedTable}
              className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                selectedTable
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-[#1A222F] text-[#64748B] cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              تأیید و انتخاب میز
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
