import React, { useState } from 'react';
import { Search, Zap, SlidersHorizontal, Sparkles } from 'lucide-react';
import { MenuItem, ModifierOption } from '../types';
import { formatToman } from '../utils/farsiFormatting';
import { ModifierRailFlyout } from './ModifierRailFlyout';

export interface RapidInputZoneProps {
  catalog: MenuItem[];
  onInjectItem: (item: MenuItem, modifiers?: ModifierOption[], notes?: string) => void;
}

export const RapidInputZone: React.FC<RapidInputZoneProps> = ({
  catalog,
  onInjectItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [flyoutItem, setFlyoutItem] = useState<MenuItem | null>(null);
  const [pendingModifiers, setPendingModifiers] = useState<ModifierOption[]>([]);
  const [pendingNotes, setPendingNotes] = useState('');

  // Extract categories
  const categories = ['ALL', ...Array.from(new Set(catalog.map((c) => c.categoryNameFa || c.categoryId)))];

  const filteredItems = catalog.filter((item) => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      item.categoryNameFa === selectedCategory ||
      item.categoryId === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleOpenFlyout = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setFlyoutItem(item);
    setPendingModifiers([]);
    setPendingNotes('');
  };

  const handleToggleModifier = (mod: ModifierOption) => {
    setPendingModifiers((prev) =>
      prev.some((m) => m.id === mod.id)
        ? prev.filter((m) => m.id !== mod.id)
        : [...prev, mod]
    );
  };

  const handleConfirmFlyout = () => {
    if (flyoutItem) {
      onInjectItem(flyoutItem, pendingModifiers, pendingNotes);
      setFlyoutItem(null);
    }
  };

  return (
    <div
      className="w-full lg:w-[420px] xl:w-[480px] bg-[#121417] border-l border-[#293444] h-full flex flex-col justify-between shrink-0 select-none"
      dir="rtl"
    >
      {/* Top Header & Search */}
      <div className="p-3.5 border-b border-[#293444] bg-[#0F223D]/60 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-extrabold text-sm">
            <div className="p-1.5 rounded-lg bg-[#D71921] text-white shadow-sm">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <span>تزریق سریع اقلام (Rapid Input Grid)</span>
          </div>
          <span className="text-[10px] bg-[#1B222C] text-[#F3E9DD] px-2 py-0.5 rounded border border-[#293444] font-mono">
            کلیدهای ۱ تا ۹ فعال
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#9EACB8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی سریع آیتم (مثلاً فلت وایت، v60، کروسان)..."
            className="w-full bg-[#121417] border border-[#293444] rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-[#9EACB8]/60 focus:outline-none focus:border-[#D71921] transition"
          />
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#D71921] text-white shadow-sm'
                  : 'bg-[#1B222C] text-[#9EACB8] hover:text-white hover:bg-[#222B38] border border-[#293444]'
              }`}
            >
              {cat === 'ALL' ? 'همه اقلام' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Rapid Inject Cards */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 auto-rows-max">
        {filteredItems.map((item, idx) => {
          const hotkeyNumber = item.hotkeyIndex || (idx < 9 ? idx + 1 : undefined);

          return (
            <div
              key={item.id}
              onClick={() => onInjectItem(item)}
              className="group relative bg-[#1B222C] hover:bg-[#222B38] active:scale-[0.98] border border-[#293444] hover:border-[#D71921]/60 rounded-xl p-2.5 flex flex-col justify-between min-h-[95px] transition-all cursor-pointer shadow-sm select-none"
            >
              {/* Top Row: Hotkey Badge & Title */}
              <div className="flex items-start justify-between gap-1">
                <span className="font-extrabold text-xs text-white group-hover:text-[#F3E9DD] line-clamp-2 leading-tight">
                  {item.title}
                </span>

                {hotkeyNumber && hotkeyNumber <= 9 && (
                  <span className="shrink-0 w-5 h-5 rounded-md bg-[#0F223D] border border-[#D71921]/70 text-[#F3E9DD] font-mono text-[10px] font-black flex items-center justify-center shadow-xs">
                    {hotkeyNumber}
                  </span>
                )}
              </div>

              {/* Bottom Row: Price & Modifiers Trigger */}
              <div className="flex items-center justify-between pt-2 mt-auto border-t border-[#293444]/60">
                <span className="font-mono text-[11px] font-bold text-[#F3E9DD]">
                  {formatToman(item.price)}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleOpenFlyout(e, item)}
                  className="p-1 rounded bg-[#121417] hover:bg-[#D71921] text-[#9EACB8] hover:text-white transition cursor-pointer"
                  title="افزودنی‌ها و شخصی‌سازی (Modifiers)"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Status strip */}
      <div className="p-2 border-t border-[#293444] bg-[#081425] text-center text-[10px] text-[#9EACB8] flex items-center justify-center gap-1.5">
        <Sparkles className="w-3 h-3 text-amber-400" />
        <span>کلیک یا فشردن اعداد کیبورد جهت افزودن فوری به سفارش فعال</span>
      </div>

      {/* Modifier Drawer Flyout */}
      <ModifierRailFlyout
        isOpen={flyoutItem !== null}
        item={flyoutItem}
        selectedModifiers={pendingModifiers}
        notes={pendingNotes}
        onToggleModifier={handleToggleModifier}
        onChangeNotes={setPendingNotes}
        onConfirm={handleConfirmFlyout}
        onClose={() => setFlyoutItem(null)}
      />
    </div>
  );
};
