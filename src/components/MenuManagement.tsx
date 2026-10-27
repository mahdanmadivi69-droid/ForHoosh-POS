import React, { useState } from 'react';
import {
  Coffee,
  Plus,
  Edit2,
  Check,
  X,
  AlertTriangle,
  AlertOctagon,
  Search,
  Minus,
  Sliders,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { Category, MenuItem, User } from '../types/domain';
import {
  formatToman,
  safeInt,
  evaluateStockStatus,
  countStockAlerts,
  getEffectiveThreshold,
} from '../services/financialMath';

interface MenuManagementProps {
  categories: Category[];
  menuItems: MenuItem[];
  activeUser: User;
  onSaveItem: (item: MenuItem) => void;
}

export const MenuManagement: React.FC<MenuManagementProps> = ({
  categories,
  menuItems,
  activeUser,
  onSaveItem,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_ONLY' | 'OUT_OF_STOCK_ONLY' | 'OK_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Configurable default threshold for low stock alert (persisted in localStorage)
  const [globalThreshold, setGlobalThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('smartorders_stock_threshold');
      return saved ? Math.max(1, parseInt(saved, 10)) : 5;
    } catch {
      return 5;
    }
  });

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [formNameFa, setFormNameFa] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formPriceToman, setFormPriceToman] = useState<number>(85000);
  const [formCategoryId, setFormCategoryId] = useState(categories[0]?.id || '');
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formCurrentStock, setFormCurrentStock] = useState<number>(15);
  const [formCustomThreshold, setFormCustomThreshold] = useState<string>('');

  const canEdit = activeUser.role === 'OWNER' || activeUser.role === 'MANAGER';

  // Handle global threshold change
  const handleUpdateGlobalThreshold = (newVal: number) => {
    const safeVal = Math.max(1, Math.min(100, Math.round(newVal)));
    setGlobalThreshold(safeVal);
    try {
      localStorage.setItem('smartorders_stock_threshold', String(safeVal));
    } catch (e) {
      console.error('Failed to save threshold to storage:', e);
    }
  };

  const handleOpenNew = () => {
    setEditingItem(null);
    setFormNameFa('');
    setFormNameEn('');
    setFormPriceToman(85000);
    setFormCategoryId(categories[0]?.id || '');
    setFormIsAvailable(true);
    setFormCurrentStock(20);
    setFormCustomThreshold('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormNameFa(item.nameFa);
    setFormNameEn(item.nameEn || '');
    setFormPriceToman(item.priceToman);
    setFormCategoryId(item.categoryId);
    setFormIsAvailable(item.isAvailable);
    setFormCurrentStock(item.currentStock ?? 0);
    setFormCustomThreshold(
      item.lowStockThreshold !== undefined && item.lowStockThreshold !== null
        ? String(item.lowStockThreshold)
        : ''
    );
    setIsModalOpen(true);
  };

  const handleToggleAvailability = (item: MenuItem) => {
    if (!canEdit) return;
    onSaveItem({
      ...item,
      isAvailable: !item.isAvailable,
    });
  };

  const handleQuickAdjustStock = (item: MenuItem, delta: number) => {
    if (!canEdit) return;
    const current = item.currentStock ?? 0;
    const nextStock = Math.max(0, current + delta);
    onSaveItem({
      ...item,
      currentStock: nextStock,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameFa.trim()) return;

    const parsedCustomThreshold = formCustomThreshold.trim() !== ''
      ? Math.max(0, parseInt(formCustomThreshold, 10))
      : undefined;

    const targetItem: MenuItem = {
      id: editingItem ? editingItem.id : `item-${Date.now()}`,
      tenantId: activeUser.tenantId,
      categoryId: formCategoryId,
      nameFa: formNameFa.trim(),
      nameEn: formNameEn.trim() || undefined,
      priceToman: Math.round(formPriceToman),
      isAvailable: formIsAvailable,
      currentStock: Math.max(0, Math.round(formCurrentStock)),
      lowStockThreshold: parsedCustomThreshold,
    };

    onSaveItem(targetItem);
    setIsModalOpen(false);
  };

  // Compute stock alerts across items
  const alertStats = countStockAlerts(menuItems, globalThreshold);

  // Filter items based on Category, Stock Status, and Search Query
  const filteredItems = menuItems.filter((item) => {
    // 1. Category Filter
    if (selectedCatId !== 'all' && item.categoryId !== selectedCatId) {
      return false;
    }

    // 2. Stock Alert Filter
    const analysis = evaluateStockStatus(item.currentStock, item.lowStockThreshold, globalThreshold);
    if (stockFilter === 'LOW_ONLY' && !analysis.isLowStock) {
      return false;
    }
    if (stockFilter === 'OUT_OF_STOCK_ONLY' && !analysis.isOutOfStock) {
      return false;
    }
    if (stockFilter === 'OK_ONLY' && analysis.isLowStock) {
      return false;
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchFa = item.nameFa.toLowerCase().includes(q);
      const matchEn = item.nameEn ? item.nameEn.toLowerCase().includes(q) : false;
      if (!matchFa && !matchEn) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5">
      {/* Header bar with Global Threshold Configurator */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-stone-100">مدیریت اقلام منو، موجودی انبار و قیمت‌ها</h2>
            <p className="text-xs text-stone-400">
              پایش بلادرنگ موجودی انبار با سیستم هوشمند هشدار کسری و آستانه قابل تنظیم
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Configurable Threshold Stepper Control */}
          <div className="flex items-center gap-2 bg-stone-950/80 border border-stone-800 px-3 py-1.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-stone-400 text-xs">
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              <span>آستانه هشدار کسری:</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdateGlobalThreshold(globalThreshold - 1)}
                disabled={!canEdit || globalThreshold <= 1}
                aria-label="کاهش آستانه هشدار"
                className="w-6 h-6 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 text-stone-300 disabled:opacity-40 transition text-xs font-bold"
              >
                <Minus className="w-3 h-3" />
              </button>

              <input
                type="number"
                min="1"
                max="100"
                value={globalThreshold}
                onChange={(e) => handleUpdateGlobalThreshold(safeInt(e.target.value) || 1)}
                disabled={!canEdit}
                aria-label="مقدار عددی آستانه هشدار موجودی"
                className="w-10 text-center font-mono font-bold text-xs bg-stone-900 border border-stone-700 rounded py-0.5 text-amber-400 tabular-nums focus:outline-none focus:border-amber-500"
              />

              <button
                type="button"
                onClick={() => handleUpdateGlobalThreshold(globalThreshold + 1)}
                disabled={!canEdit || globalThreshold >= 100}
                aria-label="افزایش آستانه هشدار"
                className="w-6 h-6 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 text-stone-300 disabled:opacity-40 transition text-xs font-bold"
              >
                <Plus className="w-3 h-3" />
              </button>
              <span className="text-[11px] text-stone-400 mr-0.5">عدد</span>
            </div>
          </div>

          {canEdit && (
            <button
              onClick={handleOpenNew}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن آیتم جدید به منو</span>
            </button>
          )}
        </div>
      </div>

      {/* Low Stock Alert Strip (Visible when items fall below threshold) */}
      {alertStats.totalLowStock > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/60 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-amber-200">
                هشدار کسری موجودی انبار ({alertStats.totalLowStock} قلم کالا)
              </div>
              <div className="text-amber-300/80 mt-0.5 text-[11px]">
                {alertStats.outOfStockCount > 0 && (
                  <span className="font-semibold text-rose-300">
                    {alertStats.outOfStockCount} قلم اتمام موجودی کامل{' '}
                  </span>
                )}
                {alertStats.outOfStockCount > 0 && alertStats.warningCount > 0 && <span>و </span>}
                {alertStats.warningCount > 0 && (
                  <span>
                    {alertStats.warningCount} قلم به کمتر از آستانه مجاز ({globalThreshold} عدد) رسیده‌اند.
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStockFilter(stockFilter === 'LOW_ONLY' ? 'ALL' : 'LOW_ONLY')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border shrink-0 ${
              stockFilter === 'LOW_ONLY'
                ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                : 'bg-stone-900 hover:bg-stone-850 text-amber-300 border-amber-800/80'
            }`}
          >
            {stockFilter === 'LOW_ONLY' ? 'نمایش همه اقلام منو' : 'مشاهده اقلام دارای کسری موجودی'}
          </button>
        </div>
      )}

      {/* Filters Toolbar: Search + Stock Status Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Stock Status Segmented Control */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-stone-900 border border-stone-800 rounded-xl no-scrollbar">
          <button
            type="button"
            onClick={() => setStockFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              stockFilter === 'ALL'
                ? 'bg-stone-800 text-stone-100 shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            همه اقلام ({menuItems.length})
          </button>

          <button
            type="button"
            onClick={() => setStockFilter('LOW_ONLY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              stockFilter === 'LOW_ONLY'
                ? 'bg-amber-600 text-white shadow-xs'
                : alertStats.totalLowStock > 0
                ? 'text-amber-400 hover:bg-amber-950/30'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {alertStats.totalLowStock > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
            <span>کمبود یا اتمام موجودی ({alertStats.totalLowStock})</span>
          </button>

          {alertStats.outOfStockCount > 0 && (
            <button
              type="button"
              onClick={() => setStockFilter('OUT_OF_STOCK_ONLY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                stockFilter === 'OUT_OF_STOCK_ONLY'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-400 hover:bg-rose-950/30'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>اتمام موجودی ({alertStats.outOfStockCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setStockFilter('OK_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              stockFilter === 'OK_ONLY'
                ? 'bg-stone-800 text-stone-100 shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            موجودی کافی ({alertStats.healthyCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام فارسی یا انگلیسی..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCatId('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            selectedCatId === 'all'
              ? 'bg-amber-600 text-white'
              : 'bg-stone-900 border border-stone-800 text-stone-300 hover:bg-stone-800'
          }`}
        >
          همه دسته‌ها
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCatId(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              selectedCatId === c.id
                ? 'bg-amber-600 text-white'
                : 'bg-stone-900 border border-stone-800 text-stone-300 hover:bg-stone-800'
            }`}
          >
            {c.nameFa}
          </button>
        ))}
      </div>

      {/* Items Table with Low-Stock Highlights */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-stone-950/60 text-stone-400 border-b border-stone-800">
                <th className="py-3 pr-4">نام آیتم (فارسی و لاتین)</th>
                <th className="py-3">دسته‌بندی</th>
                <th className="py-3">قیمت فعلی</th>
                <th className="py-3">موجودی انبار و وضعیت هشدار</th>
                <th className="py-3">وضعیت در صندوق</th>
                <th className="py-3 pl-4 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    هیچ آیتمی با شرایط انتخاب‌شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  const analysis = evaluateStockStatus(
                    item.currentStock,
                    item.lowStockThreshold,
                    globalThreshold
                  );

                  // Row highlight styling based on stock level
                  let rowClasses = 'transition ';
                  if (analysis.status === 'OUT_OF_STOCK') {
                    rowClasses += 'bg-rose-950/20 hover:bg-rose-950/30 border-r-4 border-r-rose-500';
                  } else if (analysis.status === 'LOW') {
                    rowClasses += 'bg-amber-950/20 hover:bg-amber-950/30 border-r-4 border-r-amber-500';
                  } else {
                    rowClasses += 'hover:bg-stone-850/50 border-r-4 border-r-transparent';
                  }

                  return (
                    <tr key={item.id} className={rowClasses}>
                      {/* Name */}
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-stone-100">{item.nameFa}</span>
                          {item.nameEn && (
                            <span className="text-[11px] text-stone-400 font-mono" dir="ltr">
                              {item.nameEn}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 text-stone-300">{cat?.nameFa || '—'}</td>

                      {/* Price */}
                      <td className="py-3 font-bold text-amber-400 font-mono text-sm">
                        {formatToman(item.priceToman)}{' '}
                        <span className="text-xs font-normal text-stone-400">تومان</span>
                      </td>

                      {/* Stock Level & Alert Status */}
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          {/* Stock Counter with inline quick adjusters */}
                          <div className="flex items-center gap-1.5 bg-stone-950/70 border border-stone-800 px-2 py-1 rounded-lg">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleQuickAdjustStock(item, -1)}
                                disabled={(item.currentStock ?? 0) <= 0}
                                title="کاهش یک واحد موجودی"
                                className="w-5 h-5 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 text-stone-300 disabled:opacity-30 transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            )}

                            <span
                              className={`font-mono font-bold text-xs px-1 tabular-nums ${
                                analysis.status === 'OUT_OF_STOCK'
                                  ? 'text-rose-400'
                                  : analysis.status === 'LOW'
                                  ? 'text-amber-400'
                                  : 'text-stone-200'
                              }`}
                            >
                              {item.currentStock ?? 0}
                            </span>
                            <span className="text-[11px] text-stone-400">عدد</span>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleQuickAdjustStock(item, 1)}
                                title="افزایش یک واحد موجودی"
                                className="w-5 h-5 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Visual Alert Indicator */}
                          <div className="flex flex-col text-[11px]">
                            {analysis.status === 'OUT_OF_STOCK' && (
                              <div className="flex items-center gap-1 text-rose-400 font-bold">
                                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                <span>اتمام موجودی</span>
                              </div>
                            )}

                            {analysis.status === 'LOW' && (
                              <div className="flex items-center gap-1 text-amber-400 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  کسری موجودی ({analysis.currentStock} از {analysis.effectiveThreshold})
                                </span>
                              </div>
                            )}

                            {analysis.status === 'OK' && (
                              <div className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>موجودی کافی</span>
                              </div>
                            )}

                            {/* Threshold metadata note */}
                            <span className="text-[10px] text-stone-400">
                              {item.lowStockThreshold !== undefined && item.lowStockThreshold !== null
                                ? `آستانه اختصاصی: ${item.lowStockThreshold} عدد`
                                : `آستانه پیش‌فرض: ${globalThreshold} عدد`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* POS Availability Toggle */}
                      <td className="py-3">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          disabled={!canEdit}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                            item.isAvailable
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-950'
                              : 'bg-rose-950/40 text-rose-400 border-rose-800 hover:bg-rose-950'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.isAvailable ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          <span>{item.isAvailable ? 'موجود در صندوق' : 'ناموجود (عدم نمایش)'}</span>
                        </button>
                      </td>

                      {/* Operations */}
                      <td className="py-3 pl-4 text-left">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>ویرایش و موجودی</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Modal with Stock & Custom Threshold */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-bold text-stone-100 text-base">
                {editingItem ? 'ویرایش مشخصات و موجودی آیتم' : 'افزودن آیتم جدید به منو'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">نام فارسی آیتم:</label>
                <input
                  type="text"
                  value={formNameFa}
                  onChange={(e) => setFormNameFa(e.target.value)}
                  placeholder="مثلاً: کورتادو (Cortado)"
                  className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">نام لاتین (اختیاری):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  placeholder="Cortado"
                  className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 font-mono text-left focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">دسته‌بندی منو:</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-200 focus:outline-none focus:border-amber-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">قیمت فروش (تومان):</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={formPriceToman || ''}
                  onChange={(e) => setFormPriceToman(safeInt(e.target.value))}
                  placeholder="مثلاً: ۹۵,۰۰۰"
                  className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 font-bold text-center text-sm focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="text-[11px] text-amber-400 text-center font-medium">
                  معادل: {formatToman(formPriceToman)} تومان
                </span>
              </div>

              {/* Inventory Management: Stock and Threshold */}
              <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-stone-200 font-bold text-xs pb-1 border-b border-stone-800">
                  <Package className="w-3.5 h-3.5 text-amber-500" />
                  <span>انبارداری و آستانه هشدار موجودی</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-stone-300 font-medium text-[11px]">موجودی فعلی (عدد):</label>
                    <input
                      type="number"
                      min="0"
                      value={formCurrentStock}
                      onChange={(e) => setFormCurrentStock(safeInt(e.target.value))}
                      className="bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 font-mono text-center focus:outline-none focus:border-amber-500 font-bold tabular-nums"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-stone-300 font-medium text-[11px]">
                      آستانه اختصاصی (اختیاری):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formCustomThreshold}
                      onChange={(e) => setFormCustomThreshold(e.target.value)}
                      placeholder={`پیش‌فرض: ${globalThreshold}`}
                      className="bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 font-mono text-center focus:outline-none focus:border-amber-500 tabular-nums placeholder:text-stone-600"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-stone-400 leading-relaxed">
                  اگر آستانه اختصاصی خالی باشد، از آستانه پیش‌فرض سیستم ({globalThreshold} عدد) استفاده
                  می‌شود. در صورت رسیدن موجودی به این آستانه، علامت هشدار روی آیتم درج می‌گردد.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-stone-950 p-3 rounded-xl border border-stone-800">
                <input
                  type="checkbox"
                  id="availCheck"
                  checked={formIsAvailable}
                  onChange={(e) => setFormIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-0 bg-stone-800 border-stone-700"
                />
                <label htmlFor="availCheck" className="text-stone-200 cursor-pointer select-none">
                  آیتم فعال و آماده فروش در صندوق است
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-2 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl font-bold shadow transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

