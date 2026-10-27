import React, { useState, useEffect } from 'react';
import { Dialog, Portal } from '@ark-ui/react';
import {
  Coffee,
  X,
  Check,
  Sparkles,
  SlidersHorizontal,
  Package,
} from 'lucide-react';
import { MenuItem } from '../types/domain';
import { ModifierOption, STANDARD_COFFEE_MODIFIERS } from '../types/order-domain';
import { formatToman } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';

interface ModifierModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: MenuItem, selectedModifiers: ModifierOption[], notes: string) => void;
}

const GRIND_OPTIONS: { id: string; nameFa: string }[] = [
  { id: 'grind-whole', nameFa: 'دانه درسته (بدون آسیاب)' },
  { id: 'grind-espresso', nameFa: 'آسیاب اسپرسو صنعتی' },
  { id: 'grind-moka', nameFa: 'آسیاب موکاپات / خانگی' },
  { id: 'grind-v60', nameFa: 'آسیاب دمی (V60 / فیلتر)' },
  { id: 'grind-french', nameFa: 'آسیاب درشت (فرنچ پرس)' },
  { id: 'grind-turkish', nameFa: 'آسیاب بسیار ریز (ترک)' },
];

const WEIGHT_OPTIONS: { id: string; nameFa: string; multiplier: number }[] = [
  { id: 'wt-250', nameFa: 'پاکت ۲۵۰ گرمی', multiplier: 1.0 },
  { id: 'wt-500', nameFa: 'پاکت ۵۰۰ گرمی', multiplier: 1.95 },
  { id: 'wt-1000', nameFa: '۱ کیلوگرمی (صرفه)', multiplier: 3.8 },
];

export const ModifierModal: React.FC<ModifierModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedMods, setSelectedMods] = useState<ModifierOption[]>([]);
  const [selectedGrind, setSelectedGrind] = useState<string>('دانه درسته (بدون آسیاب)');
  const [selectedWeight, setSelectedWeight] = useState<{ id: string; nameFa: string; multiplier: number }>({
    id: 'wt-250',
    nameFa: 'پاکت ۲۵۰ گرمی',
    multiplier: 1.0,
  });
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (item) {
      setSelectedMods([]);
      setSelectedGrind('دانه درسته (بدون آسیاب)');
      setSelectedWeight({ id: 'wt-250', nameFa: 'پاکت ۲۵۰ گرمی', multiplier: 1.0 });
      setNotes('');
    }
  }, [item]);

  if (!item) return null;

  const isBeanProduct = Boolean(item.isBean);

  const toggleModifier = (mod: ModifierOption) => {
    playPosBeep('click');
    if (selectedMods.some((m) => m.id === mod.id)) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, mod]);
    }
  };

  const handleSelectGrind = (grindName: string) => {
    playPosBeep('click');
    setSelectedGrind(grindName);
  };

  const handleSelectWeight = (wt: typeof selectedWeight) => {
    playPosBeep('click');
    setSelectedWeight(wt);
  };

  // Base price scaled by weight multiplier (for beans) or standard
  const baseScaledPrice = isBeanProduct
    ? Math.round(item.priceToman * selectedWeight.multiplier)
    : item.priceToman;

  const modifiersDeltaToman = selectedMods.reduce((sum, m) => sum + m.priceDeltaToman, 0);
  const totalUnitPriceToman = baseScaledPrice + modifiersDeltaToman;

  const handleAdd = () => {
    playPosBeep('click');

    // Compile modifiers list including grind and weight if bean
    const compiledMods: ModifierOption[] = [...selectedMods];

    if (isBeanProduct) {
      compiledMods.unshift({
        id: `grind-${Date.now()}`,
        nameFa: `${selectedGrind} • ${selectedWeight.nameFa}`,
        priceDeltaToman: baseScaledPrice - item.priceToman,
        category: 'SWEETNESS',
      });
    }

    onConfirm(
      {
        ...item,
        priceToman: item.priceToman,
      },
      compiledMods,
      notes.trim()
    );
    onClose();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
          <Dialog.Content className="bg-[#1B222C] border border-[#293444] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative text-right text-white select-none">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#293444]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-[#0F223D] border border-[#293444] text-[#F3E9DD] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {item.roastLevelText || '100 HICH SPECS'}
                  </span>
                  {item.badge && (
                    <span className="text-[10px] bg-[#D71921] text-white px-2 py-0.5 rounded font-black uppercase">
                      {item.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base md:text-lg font-black text-white">{item.nameFa}</h3>
                {item.origin && (
                  <p className="text-xs text-[#9EACB8] mt-0.5">
                    {item.origin} {item.process ? `• ${item.process}` : ''}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-[#9EACB8] hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If Coffee Bean: Grind & Pack Options */}
            {isBeanProduct && (
              <div className="space-y-3.5">
                {/* Grind selection */}
                <div>
                  <label className="block text-xs font-bold text-white mb-2">
                    درجه آسیاب دان برشته:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {GRIND_OPTIONS.map((opt) => {
                      const isSelected = selectedGrind === opt.nameFa;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectGrind(opt.nameFa)}
                          className={`py-2 px-2.5 rounded-lg border text-center font-medium transition cursor-pointer text-xs ${
                            isSelected
                              ? 'border-[#D71921] bg-[#D71921]/15 text-white font-bold shadow-[0_0_12px_rgba(215,25,33,0.3)]'
                              : 'border-[#293444] bg-[#121417] text-[#9EACB8] hover:text-white hover:border-[#9EACB8]'
                          }`}
                        >
                          {opt.nameFa}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weight selection */}
                <div>
                  <label className="block text-xs font-bold text-white mb-2">
                    وزن پاکت / بسته‌بندی:
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {WEIGHT_OPTIONS.map((wt) => {
                      const isSelected = selectedWeight.id === wt.id;
                      return (
                        <button
                          key={wt.id}
                          type="button"
                          onClick={() => handleSelectWeight(wt)}
                          className={`py-2 px-1 rounded-lg border text-center font-medium transition cursor-pointer text-xs ${
                            isSelected
                              ? 'border-[#D71921] bg-[#D71921]/15 text-white font-bold shadow-[0_0_12px_rgba(215,25,33,0.3)]'
                              : 'border-[#293444] bg-[#121417] text-[#9EACB8] hover:text-white hover:border-[#9EACB8]'
                          }`}
                        >
                          {wt.nameFa}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Standard Barista Modifiers for beverages */}
            {!isBeanProduct && (
              <div>
                <label className="block text-xs font-bold text-white mb-2">
                  شخصی‌سازی بار گرم و نوشیدنی:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pl-1">
                  {STANDARD_COFFEE_MODIFIERS.map((mod) => {
                    const isSelected = selectedMods.some((m) => m.id === mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleModifier(mod)}
                        className={`p-2.5 rounded-lg border flex items-center justify-between transition cursor-pointer text-right text-xs ${
                          isSelected
                            ? 'bg-[#0F223D] border-[#D71921] text-white font-bold shadow-sm'
                            : 'bg-[#121417] border-[#293444] text-[#9EACB8] hover:border-[#9EACB8] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] shrink-0 ${
                              isSelected
                                ? 'bg-[#D71921] text-white'
                                : 'border border-[#293444] bg-[#1B222C]'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span className="truncate">{mod.nameFa}</span>
                        </div>
                        {mod.priceDeltaToman > 0 && (
                          <span className="font-mono text-[#F3E9DD] font-bold text-[11px] shrink-0 num-heavy">
                            +{formatToman(mod.priceDeltaToman)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customer Special Note */}
            <div>
              <label className="block text-xs font-bold text-[#9EACB8] mb-1">
                یادداشت باریستا / توضیحات آماده‌سازی:
              </label>
              <input
                type="text"
                placeholder="مثلاً: فوق‌العاده داغ، لیوان دوجداره، کم‌یخ..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#121417] border border-[#293444] rounded-lg p-2 text-xs text-white placeholder:text-[#9EACB8]/60 focus:outline-none focus:border-[#D71921]"
              />
            </div>

            {/* Bottom Confirmation Bar */}
            <div className="pt-3 border-t border-[#293444] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#9EACB8] block">قیمت با مودیفایر:</span>
                <span className="text-base font-black text-[#D71921] num-heavy">
                  {formatToman(totalUnitPriceToman)} تومان
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-[#121417] hover:bg-[#222B38] border border-[#293444] text-[#9EACB8] hover:text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="bg-[#D71921] hover:bg-[#B8141B] text-white font-extrabold px-5 py-2 rounded-lg text-xs shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)] transition transform active:scale-95 cursor-pointer"
                >
                  افزودن به فاکتور
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
