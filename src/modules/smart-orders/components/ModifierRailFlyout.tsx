import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Coffee } from 'lucide-react';
import { MenuItem, ModifierOption } from '../types';
import { formatToman } from '../utils/farsiFormatting';
import { MotionConfig } from '../utils/zeroGMotionTokens';

export interface ModifierRailFlyoutProps {
  isOpen: boolean;
  item: MenuItem | null;
  selectedModifiers: ModifierOption[];
  notes: string;
  onToggleModifier: (mod: ModifierOption) => void;
  onChangeNotes: (notes: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const ModifierRailFlyout: React.FC<ModifierRailFlyoutProps> = ({
  isOpen,
  item,
  selectedModifiers,
  notes,
  onToggleModifier,
  onChangeNotes,
  onConfirm,
  onClose,
}) => {
  // Listen for Escape key to close flyout
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const defaultModifiers: ModifierOption[] = item.modifiers && item.modifiers.length > 0
    ? item.modifiers
    : [
        { id: 'mod-1', nameFa: 'شات دبل (اسپرسو اضافه)', priceDelta: 45000 },
        { id: 'mod-2', nameFa: 'شیر جو دوسر (Oat Milk)', priceDelta: 40000 },
        { id: 'mod-3', nameFa: 'شیر بادام (Almond Milk)', priceDelta: 45000 },
        { id: 'mod-4', nameFa: 'سیروپ کارامل دست‌ساز', priceDelta: 30000 },
        { id: 'mod-5', nameFa: 'سیروپ وانیل ماداگاسکار', priceDelta: 30000 },
        { id: 'mod-6', nameFa: 'بدون شکر / رژیمی', priceDelta: 0 },
        { id: 'mod-7', nameFa: 'کم‌شیرین (Half Sweet)', priceDelta: 0 },
      ];

  const totalModDelta = selectedModifiers.reduce((acc, m) => acc + m.priceDelta, 0);
  const finalItemPrice = item.price + totalModDelta;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
        dir="rtl"
        onClick={onClose}
      >
        <motion.div
          initial={MotionConfig.drawerExit}
          animate={MotionConfig.drawerEnter}
          exit={MotionConfig.drawerExit}
          className="w-full max-w-md bg-[#13171F]/95 border-r border-white/[0.08] h-full flex flex-col justify-between shadow-2xl backdrop-blur-2xl"
          style={{ fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0E1116]/80 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#D71921]/15 text-[#D71921] border border-[#D71921]/20 shadow-[0_0_12px_-2px_rgba(215,25,33,0.4)]">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white tracking-tight">{item.title}</h3>
                <p className="text-[11px] text-[#9EACB8]">افزودنی‌ها و شخصی‌سازی (Modifiers)</p>
              </div>
            </div>
            <motion.button
              whileTap={MotionConfig.tactileTap}
              onClick={onClose}
              className="p-2 rounded-xl text-[#9EACB8] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="بستن [Esc]"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Scrollable Modifier Options */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <span className="text-xs font-bold text-[#F3E9DD] block mb-2.5">
                گزینه‌های قابل انتخاب برای بار باریستا:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {defaultModifiers.map((mod) => {
                  const isSelected = selectedModifiers.some((m) => m.id === mod.id);
                  return (
                    <motion.button
                      key={mod.id}
                      type="button"
                      whileTap={MotionConfig.tactileTap}
                      onClick={() => onToggleModifier(mod)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                        isSelected
                          ? 'border-[#D71921] bg-[#0F223D] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.4)]'
                          : 'border-white/[0.08] bg-[#0E1116]/80 text-[#9EACB8] hover:text-white hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-[#D71921] border-[#D71921] text-white'
                              : 'border-white/20 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-semibold">{mod.nameFa}</span>
                      </div>
                      <span className="font-mono text-xs text-[#F3E9DD] num-heavy">
                        {mod.priceDelta > 0 ? `+${formatToman(mod.priceDelta)}` : 'بدون تغییر'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Notes for barista */}
            <div className="pt-2">
              <label className="text-xs font-bold text-[#F3E9DD] block mb-2">
                یادداشت باریستا / توضیحات آماده‌سازی:
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => onChangeNotes(e.target.value)}
                placeholder="مثلاً: دمای شیر بالاتر باشد، بدون فوم، در لیوان شیشه‌ای..."
                className="w-full bg-[#0E1116] border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder:text-[#9EACB8]/40 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer with Price and Confirm */}
          <div className="p-4 border-t border-white/[0.08] bg-[#0E1116]/90 backdrop-blur-md space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#9EACB8]">قیمت پایه + شخصی‌سازی:</span>
              <span className="font-black text-sm text-[#F3E9DD] font-mono num-heavy">
                {formatToman(finalItemPrice)}
              </span>
            </div>

            <div className="flex gap-2">
              <motion.button
                type="button"
                whileTap={MotionConfig.tactileTap}
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9EACB8] hover:text-white border border-white/[0.08] text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف [Esc]
              </motion.button>
              <motion.button
                type="button"
                whileTap={MotionConfig.tactileTap}
                onClick={onConfirm}
                className="flex-2 py-3 rounded-xl bg-[#D71921] hover:bg-[#B8141B] text-white text-xs font-black shadow-[0_0_20px_-2px_rgba(215,25,33,0.6)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>تأیید و افزودن به سفارش</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
