import React from 'react';
import { X, Check, Plus, Coffee } from 'lucide-react';
import { MenuItem, ModifierOption } from '../types';
import { formatToman } from '../utils/farsiFormatting';

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
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
      dir="rtl"
    >
      <div
        className="w-full max-w-md bg-[#1B222C] border-r border-[#293444] h-full flex flex-col justify-between shadow-2xl animate-slideInRight"
        style={{ fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)" }}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-[#293444] flex items-center justify-between bg-[#121417]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#D71921]/15 text-[#D71921]">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">{item.title}</h3>
              <p className="text-[11px] text-[#9EACB8]">افزودنی‌ها و شخصی‌سازی (Modifiers)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9EACB8] hover:text-white hover:bg-[#293444] transition cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modifier Options */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <span className="text-xs font-bold text-[#F3E9DD] block mb-2">
              گزینه‌های قابل انتخاب برای بار باریستا:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {defaultModifiers.map((mod) => {
                const isSelected = selectedModifiers.some((m) => m.id === mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => onToggleModifier(mod)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs transition cursor-pointer ${
                      isSelected
                        ? 'border-[#D71921] bg-[#0F223D] text-white shadow-sm'
                        : 'border-[#293444] bg-[#121417] text-[#9EACB8] hover:text-white hover:border-[#3a4759]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[#D71921] border-[#D71921] text-white'
                            : 'border-[#293444] bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold">{mod.nameFa}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#F3E9DD]">
                      {mod.priceDelta > 0 ? `+${formatToman(mod.priceDelta)}` : 'بدون تغییر'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes for barista */}
          <div className="pt-2">
            <label className="text-xs font-bold text-[#F3E9DD] block mb-1.5">
              یادداشت باریستا / توضیحات آماده‌سازی:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => onChangeNotes(e.target.value)}
              placeholder="مثلاً: دمای شیر بالاتر باشد، بدون فوم، در لیوان شیشه‌ای..."
              className="w-full bg-[#121417] border border-[#293444] rounded-xl p-3 text-xs text-white placeholder:text-[#9EACB8]/50 focus:outline-none focus:border-[#D71921] transition resize-none"
            />
          </div>
        </div>

        {/* Footer with Price and Confirm */}
        <div className="p-4 border-t border-[#293444] bg-[#121417] space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#9EACB8]">قیمت پایه + شخصی‌سازی:</span>
            <span className="font-black text-sm text-[#F3E9DD] font-mono">
              {formatToman(finalItemPrice)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 bg-[#1B222C] hover:bg-[#222B38] text-[#9EACB8] hover:text-white py-2.5 rounded-xl text-xs font-bold transition border border-[#293444] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="w-2/3 bg-[#D71921] hover:bg-[#B8141B] text-white py-2.5 rounded-xl text-xs font-black shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)] transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن به تیکت سفارش</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
