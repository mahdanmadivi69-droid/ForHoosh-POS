/**
 * src/views/settings/StationRoutingSettings.tsx
 * 
 * KarWand POS — Station-Based Printing & Routing Settings
 * Liquid Glass Visual Architecture (Dark Navy `#0F223D`, Velvet Emerald `#005A3E`, RTL)
 * 
 * Features:
 *  - Master Toggle: Global enable/disable for venue printing.
 *  - Venue Rule Indicator: Explains 100 HICH (silent bypass) vs Modendo (dual station).
 *  - Category Station Selector: Direct assignment of category -> 'bar' | 'kitchen' | 'none'.
 *  - Item Overrides Modal: Precision overriding of specific menu items.
 *  - Station IP & Hardware Configurator.
 *  - Live Production Ticket Simulator.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer,
  Coffee,
  UtensilsCrossed,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  RotateCcw,
  Sparkles,
  Layers,
  Settings2,
  Cpu,
  X,
  Play,
  FileText,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { usePrinterStore } from '../../stores/usePrinterStore';
import { Station, StationConfig, ProductionTicket } from '../../types/printerRouting';
import { SmartOrdersStore } from '../../services/storage';
import { Category, MenuItem } from '../../types/domain';
import { RoutingService } from '../../services/printer/routingService';
import { audioFeedback } from '../../services/audioFeedback';

export const StationRoutingSettings: React.FC = () => {
  const {
    config,
    tenantId,
    isLoading,
    isSaving,
    initialize,
    setEnabled,
    setCategoryRoute,
    setItemOverride,
    removeItemOverride,
    updateStationConfig,
    resetToDefaults,
  } = usePrinterStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState<'all' | 'bar' | 'kitchen' | 'none'>('all');

  // Item Override Modal State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideItemId, setOverrideItemId] = useState('');
  const [overrideStation, setOverrideStation] = useState<Station>('bar');

  // Simulation & Test State
  const [testResult, setTestResult] = useState<{
    barTicket: ProductionTicket | null;
    kitchenTicket: ProductionTicket | null;
  } | null>(null);

  useEffect(() => {
    initialize();
    setCategories(SmartOrdersStore.getCategories());
    setMenuItems(SmartOrdersStore.getMenuItems());
  }, []);

  const isModendoVenue = tenantId.toLowerCase().includes('modendo');

  // Calculate statistics
  const barCategoriesCount = Object.values(config.categoryRoutes).filter((s) => s === 'bar').length;
  const kitchenCategoriesCount = Object.values(config.categoryRoutes).filter((s) => s === 'kitchen').length;
  const overrideCount = Object.keys(config.itemOverrides).length;

  // Filter categories
  const filteredCategories = categories.filter((cat) => {
    const route = config.categoryRoutes[cat.id] || config.categoryRoutes[cat.nameFa] || 'none';
    if (selectedStationFilter === 'all') return true;
    return route === selectedStationFilter;
  });

  const handleToggleMaster = async (val: boolean) => {
    audioFeedback.playTap();
    await setEnabled(val);
  };

  const handleStationChange = async (categoryId: string, station: Station) => {
    audioFeedback.playTap();
    await setCategoryRoute(categoryId, station);
  };

  const handleSaveItemOverride = async () => {
    if (!overrideItemId) return;
    audioFeedback.playSuccess();
    await setItemOverride(overrideItemId, overrideStation);
    setIsOverrideModalOpen(false);
    setOverrideItemId('');
  };

  const handleRemoveOverride = async (itemId: string) => {
    audioFeedback.playTap();
    await removeItemOverride(itemId);
  };

  // Run test split
  const handleRunSimulator = () => {
    audioFeedback.playTap();
    const sampleOrder = {
      id: 'SIM-904',
      tableLabel: 'میز ۴ (سالن)',
      items: [
        { id: 'item-latte-01', title: 'کافه لاته تخصصی', categoryId: 'coffee', quantity: 2, notes: 'شیر جو دوسر' },
        { id: 'item-burger-02', title: 'برگر کلاسیک دست‌ساز', categoryId: 'burgers', quantity: 1, notes: 'بدون پیاز' },
        { id: 'item-fries-03', title: 'سیب‌زمینی ویژه پنیر', categoryId: 'food', quantity: 1 },
        { id: 'item-retail-beans', title: 'بسته قهوه اتیوپی ۲۵۰g', categoryId: 'cat-retail-beans', quantity: 1 },
      ],
    };

    const res = RoutingService.splitCartByStation(sampleOrder, config);
    setTestResult({
      barTicket: res.barTicket,
      kitchenTicket: res.kitchenTicket,
    });
  };

  return (
    <div className="space-y-6 select-none font-sans" dir="rtl">
      
      {/* 1. Liquid Glass Master Venue Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 shadow-xl bg-gradient-to-br from-[#0F223D]/95 via-[#0A1322]/90 to-[#005A3E]/30 border-emerald-500/20 backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#005A3E]/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border ${
                isModendoVenue 
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(0,90,62,0.4)]'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700'
              }`}>
                <Building2 className="w-3.5 h-3.5" />
                <span>{isModendoVenue ? 'شعبه ۲: کافه و بیسترو مودندو (Modendo)' : 'شعبه ۱: قهوه‌فروشی ۱۰۰هیچ (100 HICH)'}</span>
              </span>

              {config.enabled ? (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#005A3E]/80 text-[#F8EED9] border border-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  چاپ خودکار فعال
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-950/70 text-amber-300 border border-amber-600/40 flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5" />
                  غیرفعال (حالت بای‌پس امن)
                </span>
              )}
            </div>

            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Printer className="w-6 h-6 text-[#5cdbb5]" />
              <span>مسیریابی هوشمند چاپگرهای ایستگاهی (Station Routing)</span>
            </h2>

            <p className="text-xs text-[#9EACB8] leading-relaxed">
              تفکیک خودکار سفارشات به قبض‌های تولید تفکیک‌شده برای <strong>ایستگاه بار</strong> و <strong>آشپزخانه گرم</strong> بدون نمایش اطلاعات مالی.
              در صورت غیرفعال بودن (مانند شعبه ۱۰۰هیچ)، کلیه فراخوانی‌های سخت‌افزاری بدون خطا دور زده شده و عملیات به صورت امن و محلی ثبت می‌شود.
            </p>
          </div>

          {/* Master Toggle */}
          <div className="flex flex-col items-center lg:items-end gap-3 bg-[#081813]/60 p-4 rounded-xl border border-emerald-900/40 backdrop-blur-sm">
            <span className="text-xs font-bold text-[#F8EED9]">کلید سراسری چاپ ایستگاه‌ها:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleToggleMaster(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#005A3E] peer-checked:border-emerald-400 border border-white/10 shadow-inner"></div>
            </label>
            <span className="text-[11px] text-[#9EACB8]">
              {config.enabled ? 'چاپگرهای شبکه آماده دریافت فیش' : 'بای‌پس شبکه فعال (بدون ارسال سوکت)'}
            </span>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-[#0F223D]/60 p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <span className="text-[#9EACB8]">ایستگاه بار:</span>
            <span className="font-bold text-[#5cdbb5] flex items-center gap-1">
              <Coffee className="w-3.5 h-3.5" />
              {barCategoriesCount} دسته‌بندی
            </span>
          </div>
          <div className="bg-[#0F223D]/60 p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <span className="text-[#9EACB8]">ایستگاه آشپزخانه:</span>
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              {kitchenCategoriesCount} دسته‌بندی
            </span>
          </div>
          <div className="bg-[#0F223D]/60 p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <span className="text-[#9EACB8]">استثناهای آیتم:</span>
            <span className="font-bold text-cyan-300">{overrideCount} آیتم خاص</span>
          </div>
          <div className="bg-[#0F223D]/60 p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <button
              onClick={resetToDefaults}
              className="text-[11px] text-[#9EACB8] hover:text-white flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>بازنشانی به پیش‌فرض شعبه</span>
            </button>
            {isSaving && <span className="text-[10px] text-emerald-400 animate-pulse">در حال ذخیره...</span>}
          </div>
        </div>
      </div>

      {/* 2. Station Hardware & LAN Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar Station Card */}
        <div className="p-4 rounded-xl border bg-[#0F223D]/80 border-cyan-500/20 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{config.stations.bar.name}</h3>
                <span className="text-[10px] text-[#9EACB8]">شناسه ایستگاه: bar</span>
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 font-mono">
              {config.stations.bar.paperWidth || 80}mm Thermal
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[11px] text-[#9EACB8]">آدرس IP سوکت شبکه:</label>
              <input
                type="text"
                value={config.stations.bar.ip || ''}
                onChange={(e) => updateStationConfig('bar', { ip: e.target.value })}
                placeholder="192.168.1.101"
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#0A0D11] border border-white/10 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#9EACB8]">پورت ارتباطی RAW:</label>
              <input
                type="number"
                value={config.stations.bar.port || 9100}
                onChange={(e) => updateStationConfig('bar', { port: parseInt(e.target.value, 10) || 9100 })}
                placeholder="9100"
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#0A0D11] border border-white/10 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Kitchen Station Card */}
        <div className="p-4 rounded-xl border bg-[#0F223D]/80 border-emerald-500/20 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{config.stations.kitchen.name}</h3>
                <span className="text-[10px] text-[#9EACB8]">شناسه ایستگاه: kitchen</span>
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 font-mono">
              {config.stations.kitchen.paperWidth || 80}mm Thermal
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[11px] text-[#9EACB8]">آدرس IP سوکت شبکه:</label>
              <input
                type="text"
                value={config.stations.kitchen.ip || ''}
                onChange={(e) => updateStationConfig('kitchen', { ip: e.target.value })}
                placeholder="192.168.1.102"
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#0A0D11] border border-white/10 text-white font-mono text-xs focus:border-emerald-400 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#9EACB8]">پورت ارتباطی RAW:</label>
              <input
                type="number"
                value={config.stations.kitchen.port || 9100}
                onChange={(e) => updateStationConfig('kitchen', { port: parseInt(e.target.value, 10) || 9100 })}
                placeholder="9100"
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#0A0D11] border border-white/10 text-white font-mono text-xs focus:border-emerald-400 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Category Station Selector Grid */}
      <div className="bg-[#0F223D]/90 border border-white/10 rounded-2xl p-5 shadow-lg space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#5cdbb5]" />
              <span>مسیریابی دسته‌بندی‌های منو (Category Routing)</span>
            </h3>
            <p className="text-xs text-[#9EACB8] mt-0.5">
              تعیین کنید هر دسته از اقلام پس از ثبت سفارش، به کدام چاپگر ایستگاهی هدایت شود.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#0A0D11] p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setSelectedStationFilter('all')}
              className={`px-3 py-1 rounded-lg transition ${selectedStationFilter === 'all' ? 'bg-[#005A3E] text-white font-bold' : 'text-[#9EACB8]'}`}
            >
              همه ({categories.length})
            </button>
            <button
              onClick={() => setSelectedStationFilter('bar')}
              className={`px-3 py-1 rounded-lg transition ${selectedStationFilter === 'bar' ? 'bg-cyan-900/60 text-cyan-300 font-bold border border-cyan-500/30' : 'text-[#9EACB8]'}`}
            >
              بار
            </button>
            <button
              onClick={() => setSelectedStationFilter('kitchen')}
              className={`px-3 py-1 rounded-lg transition ${selectedStationFilter === 'kitchen' ? 'bg-amber-900/60 text-amber-300 font-bold border border-amber-500/30' : 'text-[#9EACB8]'}`}
            >
              آشپزخانه
            </button>
            <button
              onClick={() => setSelectedStationFilter('none')}
              className={`px-3 py-1 rounded-lg transition ${selectedStationFilter === 'none' ? 'bg-slate-800 text-slate-300 font-bold' : 'text-[#9EACB8]'}`}
            >
              بدون چاپ
            </button>
          </div>
        </div>

        {/* Categories List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCategories.map((cat) => {
            const currentStation = config.categoryRoutes[cat.id] || config.categoryRoutes[cat.nameFa] || 'none';

            return (
              <div
                key={cat.id}
                className="bg-[#0A0D11]/80 border border-white/5 hover:border-white/20 rounded-xl p-3.5 transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-xs text-white flex items-center justify-between">
                    <span>{cat.nameFa}</span>
                    <span className="text-[10px] text-[#9EACB8] font-mono">{cat.id}</span>
                  </div>
                  {cat.nameEn && <div className="text-[10px] text-[#9EACB8] mt-0.5">{cat.nameEn}</div>}
                </div>

                {/* 3-State Station Radio Selector */}
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                  <button
                    onClick={() => handleStationChange(cat.id, 'bar')}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      currentStation === 'bar'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                        : 'bg-[#0F223D]/50 text-[#9EACB8] hover:text-white border border-transparent'
                    }`}
                  >
                    <Coffee className="w-3 h-3" />
                    <span>بار</span>
                  </button>

                  <button
                    onClick={() => handleStationChange(cat.id, 'kitchen')}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      currentStation === 'kitchen'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : 'bg-[#0F223D]/50 text-[#9EACB8] hover:text-white border border-transparent'
                    }`}
                  >
                    <UtensilsCrossed className="w-3 h-3" />
                    <span>آشپزخانه</span>
                  </button>

                  <button
                    onClick={() => handleStationChange(cat.id, 'none')}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      currentStation === 'none'
                        ? 'bg-slate-800 text-slate-300 border border-slate-600'
                        : 'bg-[#0F223D]/50 text-[#9EACB8] hover:text-white border border-transparent'
                    }`}
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>بدون چاپ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Item Overrides Section */}
      <div className="bg-[#0F223D]/90 border border-white/10 rounded-2xl p-5 shadow-lg space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-amber-400" />
              <span>استثناهای آیتم‌ها (Item Overrides)</span>
            </h3>
            <p className="text-xs text-[#9EACB8] mt-0.5">
              آیتم‌های خاصی که فارغ از دسته‌بندی والد، باید به ایستگاهی دیگر هدایت شوند (اولویت بالاتر از دسته‌بندی).
            </p>
          </div>

          <button
            onClick={() => setIsOverrideModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A3E] hover:bg-emerald-700 text-[#F8EED9] border border-emerald-400/50 shadow-md flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن استثنای جدید</span>
          </button>
        </div>

        {/* Existing Overrides List */}
        {Object.keys(config.itemOverrides).length === 0 ? (
          <div className="p-8 text-center text-[#9EACB8] text-xs bg-[#0A0D11]/40 rounded-xl border border-dashed border-white/10">
            هیچ استثنایی برای آیتم‌های منو تعریف نشده است. تمام اقلام طبق دسته‌بندی خود مسیریابی می‌شوند.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(config.itemOverrides).map(([itemId, station]) => {
              const matchedItem = menuItems.find((m) => m.id === itemId);
              const itemName = matchedItem ? ((matchedItem as any).nameFa || (matchedItem as any).title || itemId) : itemId;

              return (
                <div
                  key={itemId}
                  className="bg-[#0A0D11] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="font-bold text-xs text-white truncate">{itemName}</div>
                    <div className="text-[10px] text-[#9EACB8] flex items-center gap-1.5 mt-0.5">
                      <span>هدایت به:</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold ${
                        station === 'bar' ? 'text-cyan-400 bg-cyan-950/80' : station === 'kitchen' ? 'text-emerald-400 bg-emerald-950/80' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {station === 'bar' ? 'بار' : station === 'kitchen' ? 'آشپزخانه' : 'بدون چاپ'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveOverride(itemId)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition"
                    title="حذف استثنا"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Live Production Ticket Simulator */}
      <div className="bg-[#0A0D11] border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              <span>شبیه‌ساز و راستی‌آزمایی تفکیک فیش‌های تولید (Live Split Inspector)</span>
            </h3>
            <span className="text-xs text-[#9EACB8]">
              تست فوری تفکیک یک سفارش نمونه به قبض‌های بار و آشپزخانه و راستی‌آزمایی حذف فیلدهای مالی
            </span>
          </div>

          <button
            onClick={handleRunSimulator}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F223D] hover:bg-[#1A375E] text-white border border-white/20 flex items-center gap-1.5 transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>اجرای آزمایش تفکیک</span>
          </button>
        </div>

        {testResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Bar Ticket Result */}
            <div className="bg-[#0F223D] border border-cyan-500/30 rounded-xl p-4 font-mono text-xs">
              <div className="font-bold text-cyan-300 border-b border-white/10 pb-2 mb-2 flex items-center justify-between">
                <span>قبض تولید ایستگاه بار (BAR)</span>
                <span className="text-[10px] text-[#9EACB8]">#{testResult.barTicket?.orderId || '-'}</span>
              </div>
              {testResult.barTicket ? (
                <div className="space-y-1.5">
                  <div className="text-[#9EACB8]">میز: {testResult.barTicket.tableNumber || 'بیرون‌بر'}</div>
                  <div className="border-t border-dashed border-white/10 pt-2 space-y-1">
                    {testResult.barTicket.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-white">
                        <span>{it.quantity}× {it.name}</span>
                        {it.notes && <span className="text-cyan-400 text-[10px]">({it.notes})</span>}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>تایید شد: فاقد هرگونه فیلد قیمت و مبلغ مالی</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 py-4 text-center">فاقد آیتم برای بار (قبض صادر نشد)</div>
              )}
            </div>

            {/* Kitchen Ticket Result */}
            <div className="bg-[#0F223D] border border-emerald-500/30 rounded-xl p-4 font-mono text-xs">
              <div className="font-bold text-emerald-300 border-b border-white/10 pb-2 mb-2 flex items-center justify-between">
                <span>قبض تولید ایستگاه آشپزخانه (KITCHEN)</span>
                <span className="text-[10px] text-[#9EACB8]">#{testResult.kitchenTicket?.orderId || '-'}</span>
              </div>
              {testResult.kitchenTicket ? (
                <div className="space-y-1.5">
                  <div className="text-[#9EACB8]">میز: {testResult.kitchenTicket.tableNumber || 'بیرون‌بر'}</div>
                  <div className="border-t border-dashed border-white/10 pt-2 space-y-1">
                    {testResult.kitchenTicket.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-white">
                        <span>{it.quantity}× {it.name}</span>
                        {it.notes && <span className="text-amber-400 text-[10px]">({it.notes})</span>}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>تایید شد: فاقد هرگونه فیلد قیمت و مبلغ مالی</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 py-4 text-center">فاقد آیتم برای آشپزخانه (قبض صادر نشد)</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Item Override Modal */}
      <AnimatePresence>
        {isOverrideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0F223D] border border-emerald-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl text-right space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#5cdbb5]" />
                  <span>ثبت استثنای مسیریابی آیتم منو</span>
                </h4>
                <button
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Item Search & Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#9EACB8]">جستجو و انتخاب آیتم منو:</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchItemQuery}
                    onChange={(e) => setSearchItemQuery(e.target.value)}
                    placeholder="نام آیتم را تایپ کنید..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#0A0D11] border border-white/10 text-white text-xs outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 mt-2 border border-white/5 p-1 rounded-xl bg-[#0A0D11]/60">
                  {menuItems
                    .filter((m) => {
                      const title = (m as any).nameFa || (m as any).title || '';
                      return title.toLowerCase().includes(searchItemQuery.toLowerCase());
                    })
                    .slice(0, 20)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setOverrideItemId(item.id)}
                        className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between ${
                          overrideItemId === item.id
                            ? 'bg-[#005A3E] text-white font-bold'
                            : 'hover:bg-white/5 text-[#9EACB8]'
                        }`}
                      >
                        <span>{(item as any).nameFa || (item as any).title || item.id}</span>
                        <span className="text-[10px] opacity-70">{item.id}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Target Station Radio */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#9EACB8]">ایستگاه هدف برای این آیتم:</label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    onClick={() => setOverrideStation('bar')}
                    className={`py-2 rounded-xl border transition ${
                      overrideStation === 'bar'
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-400'
                        : 'bg-[#0A0D11] text-[#9EACB8] border-white/5'
                    }`}
                  >
                    بار
                  </button>
                  <button
                    onClick={() => setOverrideStation('kitchen')}
                    className={`py-2 rounded-xl border transition ${
                      overrideStation === 'kitchen'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                        : 'bg-[#0A0D11] text-[#9EACB8] border-white/5'
                    }`}
                  >
                    آشپزخانه
                  </button>
                  <button
                    onClick={() => setOverrideStation('none')}
                    className={`py-2 rounded-xl border transition ${
                      overrideStation === 'none'
                        ? 'bg-slate-800 text-slate-300 border-slate-500'
                        : 'bg-[#0A0D11] text-[#9EACB8] border-white/5'
                    }`}
                  >
                    بدون چاپ
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={handleSaveItemOverride}
                  disabled={!overrideItemId}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#005A3E] hover:bg-emerald-600 disabled:opacity-50 text-white shadow-lg transition"
                >
                  ذخیره استثنا
                </button>
                <button
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-[#9EACB8] transition"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
