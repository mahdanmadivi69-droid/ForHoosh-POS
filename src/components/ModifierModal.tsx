import React, { useState } from 'react';
import {
  Coffee,
  X,
  Plus,
  Check,
  Sparkles,
  Flame,
  Droplets,
} from 'lucide-react';
import { MenuItem } from '../types/domain';
import { ModifierOption, STANDARD_COFFEE_MODIFIERS } from '../types/order-domain';
import { formatToman } from '../services/financialMath';

interface ModifierModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: MenuItem, selectedModifiers: ModifierOption[], notes: string) => void;
}

export const ModifierModal: React.FC<ModifierModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedMods, setSelectedMods] = useState<ModifierOption[]>([]);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen || !item) return null;

  const toggleModifier = (mod: ModifierOption) => {
    if (selectedMods.some((m) => m.id === mod.id)) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, mod]);
    }
  };

  const modifiersDeltaToman = selectedMods.reduce((sum, m) => sum + m.priceDeltaToman, 0);
  const totalUnitPriceToman = item.priceToman + modifiersDeltaToman;

  const handleAdd = () => {
    onConfirm(item, selectedMods, notes.trim());
    setSelectedMods([]);
    setNotes('');
    onClose();
  };

  // Group modifiers by category
  const milkMods = STANDARD_COFFEE_MODIFIERS.filter((m) => m.category === 'MILK');
  const shotMods = STANDARD_COFFEE_MODIFIERS.filter((m) => m.category === 'SHOT');
  const syrupMods = STANDARD_COFFEE_MODIFIERS.filter((m) => m.category === 'SYRUP');
  const otherMods = STANDARD_COFFEE_MODIFIERS.filter(
    (m) => m.category === 'SWEETNESS' || m.category === 'TEMPERATURE'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/40 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-100 text-base flex items-center gap-2">
                <span>سفارشی‌سازی و مودیفایرها:</span>
                <span className="text-amber-400">{item.nameFa}</span>
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                گردش کار سریع ۳ لمسی با محاسبه زنده تغییرات قیمت تومانی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body with modifier options */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
          {/* Shots & Extra Coffee */}
          <div>
            <label className="font-bold text-stone-300 block mb-2 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>عصاره و اسپرسو:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {shotMods.map((mod) => {
                const isSelected = selectedMods.some((m) => m.id === mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(mod)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-xs'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-amber-500 text-stone-950' : 'border border-stone-700'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span>{mod.nameFa}</span>
                    </div>
                    <span className="font-mono text-amber-400 font-semibold">
                      +{formatToman(mod.priceDeltaToman)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plant-based Milks */}
          <div>
            <label className="font-bold text-stone-300 block mb-2 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span>انتخاب نوع شیر / گیاهی:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {milkMods.map((mod) => {
                const isSelected = selectedMods.some((m) => m.id === mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(mod)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-xs'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-amber-500 text-stone-950' : 'border border-stone-700'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span>{mod.nameFa}</span>
                    </div>
                    <span className="font-mono text-amber-400 font-semibold">
                      +{formatToman(mod.priceDeltaToman)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Syrups */}
          <div>
            <label className="font-bold text-stone-300 block mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>سیروپ‌های تخصصی بار:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {syrupMods.map((mod) => {
                const isSelected = selectedMods.some((m) => m.id === mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(mod)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-xs'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-amber-500 text-stone-950' : 'border border-stone-700'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span>{mod.nameFa}</span>
                    </div>
                    <span className="font-mono text-amber-400 font-semibold">
                      +{formatToman(mod.priceDeltaToman)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sweetness & Temp */}
          <div>
            <label className="font-bold text-stone-300 block mb-2">
              سایر تنظیمات (رایگان):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {otherMods.map((mod) => {
                const isSelected = selectedMods.some((m) => m.id === mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(mod)}
                    className={`p-2 rounded-xl border text-center transition ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <span>{mod.nameFa}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barista Custom Notes */}
          <div>
            <label className="font-medium text-stone-400 block mb-1">
              یادداشت یا دستور باریستا:
            </label>
            <input
              type="text"
              placeholder="مثلاً: در ماگ سفالی سرو شود، با فوم غلیظ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer & Live Price calculation */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <div className="text-stone-400">
              <span>قیمت پایه: {formatToman(item.priceToman)}</span>
              {modifiersDeltaToman > 0 && (
                <span className="text-amber-400"> + مودیفایر: {formatToman(modifiersDeltaToman)}</span>
              )}
            </div>
            <div className="text-sm font-black text-amber-300">
              <span>مبلغ نهایی آیتم: </span>
              <span className="text-base text-amber-400">{formatToman(totalUnitPriceToman)} تومان</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl text-xs font-semibold"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="w-2/3 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن به فاکتور ({formatToman(totalUnitPriceToman)} ت)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
