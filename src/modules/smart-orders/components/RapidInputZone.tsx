import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Zap, SlidersHorizontal, Sparkles, X, Layers } from 'lucide-react';
import { MenuItem, ModifierOption } from '../types';
import { formatToman } from '../utils/farsiFormatting';
import { MotionConfig } from '../utils/zeroGMotionTokens';
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
      className="w-full lg:w-[420px] xl:w-[470px] bg-[#0E1116]/95 border-l border-white/[0.08] h-full flex flex-col justify-between shrink-0 select-none backdrop-blur-xl relative z-10"
      dir="rtl"
    >
      {/* Top Header & Search Telemetry */}
      <div className="p-3.5 border-b border-white/[0.08] bg-[#0F223D]/60 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-extrabold text-sm">
            <div className="p-1.5 rounded-lg bg-[#D71921] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.6)]">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <span className="block leading-tight font-black tracking-tight">تزریق سریع اقلام (Rapid Input)</span>
              <span className="text-[10px] text-[#9EACB8] font-normal">ورود آنی کاتالوگ با کلیدهای عددی</span>
            </div>
          </div>
          <span className="text-[10px] bg-[#121417]/80 text-[#F3E9DD] px-2 py-0.5 rounded-md border border-white/[0.1] font-mono shadow-inner">
            کلیدهای ۱ تا ۹ فعال
          </span>
        </div>

        {/* Search Input with Clear Button */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#9EACB8] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی سریع آیتم (مثلاً فلت وایت، v60، کروسان)..."
            className="w-full bg-[#121417] border border-white/[0.08] rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder:text-[#9EACB8]/50 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#9EACB8] hover:text-white hover:bg-white/10 transition-colors"
              title="پاک کردن جستجو"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <motion.button
              key={cat}
              type="button"
              whileTap={MotionConfig.tactileTap}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                selectedCategory === cat
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-2px_rgba(215,25,33,0.55)] border border-[#D71921]'
                  : 'bg-white/[0.03] text-[#9EACB8] hover:text-white hover:bg-white/[0.08] border border-white/[0.08]'
              }`}
            >
              {cat === 'ALL' && <Layers className="w-3 h-3" />}
              <span>{cat === 'ALL' ? 'همه اقلام' : cat}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Grid of Rapid Inject Cards */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 auto-rows-max">
        {filteredItems.map((item, idx) => {
          const hotkeyNumber = item.hotkeyIndex || (idx < 9 ? idx + 1 : undefined);

          return (
            <motion.div
              key={item.id}
              whileTap={MotionConfig.tactileTap}
              onClick={() => onInjectItem(item)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onInjectItem(item);
                }
              }}
              className="group relative bg-[#161B22]/90 hover:bg-[#1E2632] border border-white/[0.08] hover:border-cyan-500/50 rounded-2xl p-3 flex flex-col justify-between min-h-[105px] transition-colors duration-150 cursor-pointer shadow-sm hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121417] select-none"
            >
              {/* Top Row: Title & Tactile Hotkey Cap */}
              <div className="flex items-start justify-between gap-1.5">
                <span className="font-extrabold text-xs text-slate-100 group-hover:text-white line-clamp-2 leading-snug">
                  {item.title}
                </span>

                {hotkeyNumber && hotkeyNumber <= 9 && (
                  <span className="keycap-badge shrink-0 w-6 h-6 text-[11px] group-hover:border-cyan-400 group-hover:text-cyan-300 transition-colors">
                    {hotkeyNumber}
                  </span>
                )}
              </div>

              {/* Bottom Row: Price & Modifiers Trigger */}
              <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-white/[0.06]">
                <span className="font-mono text-xs font-bold text-[#F3E9DD] num-heavy">
                  {formatToman(item.price)}
                </span>

                <motion.button
                  type="button"
                  whileTap={MotionConfig.tactileTap}
                  onClick={(e) => handleOpenFlyout(e, item)}
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D71921] text-[#9EACB8] hover:text-white border border-white/[0.06] hover:border-[#D71921] transition-colors duration-150 cursor-pointer"
                  title="افزودنی‌ها و شخصی‌سازی (Modifiers)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Status strip */}
      <div className="p-2.5 border-t border-white/[0.08] bg-[#0A0D11] text-center text-[10px] text-[#9EACB8] flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>کلیک روی کارت یا فشردن کلیدهای ۱ تا ۹ برای تزریق فوری به پیش‌نویس</span>
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
