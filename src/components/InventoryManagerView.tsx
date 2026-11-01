import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Package,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit3,
  Sliders,
  DollarSign,
  TrendingDown,
  Layers,
  Search,
  Scale,
  Milk,
  Coffee,
  Sparkles,
  Download,
  X,
  Check,
  ChevronRight,
  ShieldAlert,
  PackagePlus,
} from 'lucide-react';
import { InventoryInwardModal } from '../views/inventory/InventoryInwardModal';
import {
  RawIngredient,
  ProductRecipeBOM,
  IngredientUnit,
  RecipeIngredientItem,
  ModifierBOMOverride,
} from '../types/inventory-tab';
import { inventoryBomService } from '../services/inventoryBomService';
import { formatToman } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';
import { MenuItem } from '../types/domain';

interface InventoryManagerViewProps {
  menuItems: MenuItem[];
  onBackToPos?: () => void;
}

export const InventoryManagerView: React.FC<InventoryManagerViewProps> = ({
  menuItems,
  onBackToPos,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'raw_stock' | 'recipes_bom' | 'depletion_gauges'>('raw_stock');
  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipeBOM[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Modal States
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [selectedIngredientForRestock, setSelectedIngredientForRestock] = useState<RawIngredient | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(1000);
  const [restockCost, setRestockCost] = useState<number>(0);

  const [isNewIngredientOpen, setIsNewIngredientOpen] = useState(false);
  const [newTitleFa, setNewTitleFa] = useState('');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newUnit, setNewUnit] = useState<IngredientUnit>('g');
  const [newInitialStock, setNewInitialStock] = useState<number>(5000);
  const [newMinSafetyStock, setNewMinSafetyStock] = useState<number>(1000);
  const [newCostPerUnit, setNewCostPerUnit] = useState<number>(1000);

  // Recipe BOM Editor Modal State
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ProductRecipeBOM | null>(null);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientItem[]>([]);
  const [recipeOverrides, setRecipeOverrides] = useState<ModifierBOMOverride[]>([]);

  // New Override Draft State
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideAction, setOverrideAction] = useState<'REPLACE' | 'ADD'>('REPLACE');
  const [overrideReplacesId, setOverrideReplacesId] = useState('');
  const [overrideTargetId, setOverrideTargetId] = useState('');
  const [overrideAmount, setOverrideAmount] = useState<number>(160);

  // Subscribe to real-time inventory updates
  useEffect(() => {
    const unsub = inventoryBomService.subscribe((ings, recs) => {
      setIngredients(ings);
      setRecipes(recs);
    });
    return () => unsub();
  }, []);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch =
        searchQuery === '' ||
        ing.title_fa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ing.title_en.toLowerCase().includes(searchQuery.toLowerCase());

      const isOutOfStock = ing.current_stock <= 0;
      const isLowStock = ing.current_stock > 0 && ing.current_stock <= ing.min_safety_stock;

      if (!matchesSearch) return false;
      if (filterLevel === 'OUT_OF_STOCK') return isOutOfStock;
      if (filterLevel === 'LOW_STOCK') return isLowStock || isOutOfStock;
      return true;
    });
  }, [ingredients, searchQuery, filterLevel]);

  // Total inventory valuation & stats
  const totalValuationToman = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + ing.current_stock * ing.cost_per_unit, 0);
  }, [ingredients]);

  const lowStockCount = useMemo(() => {
    return ingredients.filter((i) => i.current_stock <= i.min_safety_stock).length;
  }, [ingredients]);

  const outOfStockCount = useMemo(() => {
    return ingredients.filter((i) => i.current_stock <= 0).length;
  }, [ingredients]);

  // Handle restock submission
  const handleConfirmRestock = () => {
    if (!selectedIngredientForRestock || restockAmount <= 0) return;
    inventoryBomService.restockIngredient(
      selectedIngredientForRestock.id,
      restockAmount,
      restockCost > 0 ? restockCost : undefined
    );
    playPosBeep('success');
    setIsRestockOpen(false);
    setSelectedIngredientForRestock(null);
  };

  // Handle create new ingredient
  const handleCreateIngredient = () => {
    if (!newTitleFa.trim()) return;
    const id = `ing_${Date.now()}`;
    const newIng: RawIngredient = {
      id,
      title_fa: newTitleFa.trim(),
      title_en: newTitleEn.trim() || newTitleFa.trim(),
      unit: newUnit,
      initial_stock: newInitialStock,
      current_stock: newInitialStock,
      min_safety_stock: newMinSafetyStock,
      cost_per_unit: newCostPerUnit,
      last_restocked_at: new Date().toISOString(),
    };
    inventoryBomService.saveIngredient(newIng);
    playPosBeep('success');
    setIsNewIngredientOpen(false);
    setNewTitleFa('');
    setNewTitleEn('');
  };

  // Open recipe editor for a menu item
  const handleOpenRecipeEditor = (menuItem: MenuItem) => {
    const existing = inventoryBomService.getRecipeForMenuItem(menuItem.id);
    setSelectedMenuItemId(menuItem.id);
    if (existing) {
      setEditingRecipe(existing);
      setRecipeIngredients([...existing.ingredients]);
      setRecipeOverrides([...(existing.modifier_overrides || [])]);
    } else {
      setEditingRecipe(null);
      setRecipeIngredients([]);
      setRecipeOverrides([]);
    }
    setIsRecipeModalOpen(true);
  };

  // Save recipe
  const handleSaveRecipe = () => {
    if (!selectedMenuItemId) return;
    const matchedMenu = menuItems.find((m) => m.id === selectedMenuItemId);
    const updatedRecipe: ProductRecipeBOM = {
      menu_item_id: selectedMenuItemId,
      menu_item_title: matchedMenu ? matchedMenu.nameFa : selectedMenuItemId,
      ingredients: recipeIngredients,
      modifier_overrides: recipeOverrides,
    };
    inventoryBomService.saveRecipe(updatedRecipe);
    playPosBeep('success');
    setIsRecipeModalOpen(false);
  };

  // Add ingredient line to recipe editor
  const handleAddRecipeIngredient = (ingredientId: string, amount: number, unit: IngredientUnit) => {
    setRecipeIngredients((prev) => {
      const exists = prev.find((p) => p.ingredient_id === ingredientId);
      if (exists) {
        return prev.map((p) => (p.ingredient_id === ingredientId ? { ...p, amount } : p));
      }
      return [...prev, { ingredient_id: ingredientId, amount, unit }];
    });
  };

  // Remove ingredient line from recipe editor
  const handleRemoveRecipeIngredient = (ingredientId: string) => {
    setRecipeIngredients((prev) => prev.filter((p) => p.ingredient_id !== ingredientId));
  };

  // Add override to recipe
  const handleAddOverride = () => {
    if (!overrideKey.trim() || !overrideTargetId) return;

    const newOverride: ModifierBOMOverride = {
      modifier_key: overrideKey.trim(),
    };

    const targetIng = ingredients.find((i) => i.id === overrideTargetId);
    const unit = targetIng ? targetIng.unit : 'ml';

    if (overrideAction === 'REPLACE' && overrideReplacesId) {
      newOverride.replaces = overrideReplacesId;
      newOverride.with = {
        ingredient_id: overrideTargetId,
        amount: overrideAmount,
        unit,
      };
    } else {
      newOverride.adds = {
        ingredient_id: overrideTargetId,
        amount: overrideAmount,
        unit,
      };
    }

    setRecipeOverrides((prev) => [...prev, newOverride]);
    setOverrideKey('');
    setOverrideReplacesId('');
    setOverrideTargetId('');
    setOverrideAmount(160);
  };

  // Export inventory to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Title FA', 'Title EN', 'Current Stock', 'Unit', 'Safety Stock', 'Cost/Unit (Toman)', 'Total Value'];
    const rows = ingredients.map((i) => [
      i.id,
      `"${i.title_fa}"`,
      `"${i.title_en}"`,
      i.current_stock,
      i.unit,
      i.min_safety_stock,
      i.cost_per_unit,
      i.current_stock * i.cost_per_unit,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `100Hich_Inventory_BOM_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playPosBeep('success');
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0D1015] text-slate-100 p-4 md:p-6 select-none font-sans space-y-6"
      style={{ fontFamily: "var(--font-fa-sans, 'Vazirmatn', sans-serif)" }}
    >
      {/* Top Banner & Header */}
      <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0D1015] border border-[#D71921]/40 flex items-center justify-center text-[#D71921] shadow-[0_0_15px_-2px_rgba(215,25,33,0.3)]">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                ماژول انبارداری و فرمولاسیون رسپی (Warehouse & Recipe BOM)
              </h1>
              <span className="text-[10px] bg-[#D71921] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                v2.1.0 BOM
              </span>
            </div>
            <p className="text-xs text-[#9EACB8] mt-0.5">
              تعریف موجودی اولیه دانه قهوه، شیر، سیروپ و کسر اتوماتیک بلادرنگ با دقت اعشاری FLOAT_DECIMAL_3
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#0D1015] border border-[#232D3E] text-slate-300 hover:text-white hover:border-slate-500 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>خروجی اکسل انبار</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setIsInwardModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_-2px_rgba(16,185,129,0.5)] transition cursor-pointer"
            title="ثبت فاکتور خرید دانه‌ها و شیرها با محاسبه میانگین موزون قیمت تمام‌شده"
          >
            <PackagePlus className="w-4 h-4" />
            <span>ثبت فاکتور خرید (ورود بار)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewIngredientOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#D71921] hover:bg-[#b8141b] text-white text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف ماده خام جدید</span>
          </button>
        </div>
      </div>

      {/* 4 Financial & Inventory Pulse Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Raw Ingredients */}
        <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9EACB8] text-xs">
            <span>اقلام ماده خام (SKUs)</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-black text-white">{ingredients.length}</span>
            <span className="text-[11px] text-[#9EACB8] mr-2">قلم فعال در بار</span>
          </div>
        </div>

        {/* Total Stock Asset Valuation */}
        <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9EACB8] text-xs">
            <span>ارزش ریالی موجودی انبار</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <bdi className="font-mono text-xl font-black text-emerald-400" dir="ltr">
              {formatToman(Math.round(totalValuationToman))}
            </bdi>
            <span className="text-[11px] text-[#9EACB8] mr-1">تومان</span>
          </div>
        </div>

        {/* Low Stock Warnings */}
        <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9EACB8] text-xs">
            <span>هشدار کسری (Low Stock)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-amber-400">{lowStockCount}</span>
            <span className="text-[11px] text-[#9EACB8]">ماده زیر حداقل ایمنی</span>
          </div>
        </div>

        {/* Out of Stock Gate */}
        <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9EACB8] text-xs">
            <span>اتمام موجودی قطعی (86 Gate)</span>
            <ShieldAlert className="w-4 h-4 text-[#D71921]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-rose-500">{outOfStockCount}</span>
            <span className="text-[11px] text-[#9EACB8]">مورد ناموجود</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#232D3E] pb-3 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveSubTab('raw_stock')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'raw_stock'
              ? 'bg-[#151B25] border border-[#D71921] text-white shadow-sm'
              : 'text-[#9EACB8] hover:text-white hover:bg-[#151B25]/50'
          }`}
        >
          <Scale className="w-4 h-4 text-[#D71921]" />
          <span>موجودی انبار و ثبت ورود بار (Raw Stock & Intake)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('recipes_bom')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'recipes_bom'
              ? 'bg-[#151B25] border border-[#D71921] text-white shadow-sm'
              : 'text-[#9EACB8] hover:text-white hover:bg-[#151B25]/50'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>پیکربندی رسپی و مودیفایر (BOM Recipe Configurator)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('depletion_gauges')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'depletion_gauges'
              ? 'bg-[#151B25] border border-[#D71921] text-white shadow-sm'
              : 'text-[#9EACB8] hover:text-white hover:bg-[#151B25]/50'
          }`}
        >
          <TrendingDown className="w-4 h-4 text-cyan-400" />
          <span>گیج‌های بلادرنگ مصرف و اخطارها (Depletion Gauges)</span>
        </button>
      </div>

      {/* SUB-TAB 1: RAW INGREDIENT INTAKE & INVENTORY TABLE */}
      {activeSubTab === 'raw_stock' && (
        <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl overflow-hidden shadow-2xl">
          {/* Controls & Filter Bar */}
          <div className="p-4 border-b border-[#232D3E] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#11161F]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#9EACB8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی ماده اولیه (فارسی، انگلیسی، دانه قهوه، شیر)..."
                className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder:text-[#9EACB8]/50 focus:outline-none focus:border-[#D71921]"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterLevel('ALL')}
                className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                  filterLevel === 'ALL'
                    ? 'bg-[#232D3E] text-white border-white/20'
                    : 'text-[#9EACB8] border-transparent hover:text-white'
                }`}
              >
                همه اقلام ({ingredients.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterLevel('LOW_STOCK')}
                className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                  filterLevel === 'LOW_STOCK'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                    : 'text-[#9EACB8] border-transparent hover:text-amber-400'
                }`}
              >
                هشدار کسری ({lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterLevel('OUT_OF_STOCK')}
                className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                  filterLevel === 'OUT_OF_STOCK'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                    : 'text-[#9EACB8] border-transparent hover:text-rose-400'
                }`}
              >
                ناموجود قطعی ({outOfStockCount})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#0D1015] text-[#9EACB8] border-b border-[#232D3E]">
                <tr>
                  <th className="py-3 px-4 font-bold">عنوان ماده خام</th>
                  <th className="py-3 px-4 font-bold">واحد</th>
                  <th className="py-3 px-4 font-bold">موجودی فعلی</th>
                  <th className="py-3 px-4 font-bold">حداقل ایمنی</th>
                  <th className="py-3 px-4 font-bold">وضعیت انبار</th>
                  <th className="py-3 px-4 font-bold">قیمت واحد</th>
                  <th className="py-3 px-4 font-bold">ارزش کل</th>
                  <th className="py-3 px-4 font-bold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232D3E]">
                {filteredIngredients.map((ing) => {
                  const isOutOfStock = ing.current_stock <= 0;
                  const isLow = ing.current_stock <= ing.min_safety_stock;
                  const percentOfInitial = Math.min(100, Math.round((ing.current_stock / (ing.initial_stock || ing.min_safety_stock * 2)) * 100));

                  return (
                    <tr key={ing.id} className="hover:bg-[#1A2230]/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-white text-sm">{ing.title_fa}</div>
                        <div className="font-mono text-[11px] text-[#9EACB8] mt-0.5">{ing.title_en}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                        {ing.unit === 'g' ? 'گرم (g)' : ing.unit === 'ml' ? 'میلی‌لیتر (ml)' : ing.unit === 'piece' ? 'عدد (piece)' : 'شات (shot)'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-sm text-white">
                        <bdi dir="ltr">{ing.current_stock.toLocaleString()}</bdi>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#9EACB8]">
                        <bdi dir="ltr">{ing.min_safety_stock.toLocaleString()}</bdi>
                      </td>
                      <td className="py-3.5 px-4">
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 font-bold text-[10px]">
                            ناموجود قطعی
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/60 font-bold text-[10px]">
                            هشدار کسری ایمنی
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60 font-bold text-[10px]">
                            تراز مناسب
                          </span>
                        )}
                        <div className="w-24 h-1.5 bg-[#0D1015] rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isOutOfStock ? 'bg-rose-500' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${percentOfInitial}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatToman(ing.cost_per_unit)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {formatToman(Math.round(ing.current_stock * ing.cost_per_unit))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIngredientForRestock(ing);
                              setRestockAmount(ing.unit === 'piece' ? 10 : ing.unit === 'g' ? 1000 : 2000);
                              setRestockCost(ing.cost_per_unit);
                              setIsRestockOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/50 hover:bg-emerald-800 text-emerald-200 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                            title="ثبت ورود بار / افزایش موجودی"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>شارژ انبار</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`آیا از حذف ماده خام ${ing.title_fa} اطمینان دارید؟`)) {
                                inventoryBomService.deleteIngredient(ing.id);
                              }
                            }}
                            className="p-1 rounded-lg bg-rose-950/60 border border-rose-800/40 hover:bg-rose-900 text-rose-300 transition cursor-pointer"
                            title="حذف ماده خام"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BOM RECIPE CONFIGURATOR */}
      {activeSubTab === 'recipes_bom' && (
        <div className="space-y-4">
          <div className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-white">پیکربندی رسپی و مودیفایرهای هر آیتم منو (BOM)</h2>
              <p className="text-xs text-[#9EACB8] mt-0.5">
                برای هر نوشیدنی یا خوراکی، مشخص کنید چه میزان گرم قهوه، میلی‌لیتر شیر یا قطعه نان مصرف می‌شود.
              </p>
            </div>
            <span className="text-xs font-mono bg-[#0D1015] border border-[#232D3E] px-3 py-1.5 rounded-xl text-amber-300">
              {recipes.length} رسپی ثبت‌شده
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map((item) => {
              const recipe = inventoryBomService.getRecipeForMenuItem(item.id);
              const hasRecipe = recipe && recipe.ingredients && recipe.ingredients.length > 0;

              return (
                <div
                  key={item.id}
                  className={`bg-[#151B25] border rounded-2xl p-4 flex flex-col justify-between transition ${
                    hasRecipe ? 'border-[#232D3E] hover:border-slate-500' : 'border-dashed border-[#232D3E] opacity-80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-extrabold text-sm text-white">{item.nameFa}</h3>
                        <p className="text-[11px] font-mono text-[#9EACB8]">{item.nameEn || item.id}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#F3E9DD]">
                        {formatToman(item.priceToman)}
                      </span>
                    </div>

                    {/* Ingredients summary */}
                    <div className="mt-3 pt-3 border-t border-[#232D3E] space-y-1.5">
                      {hasRecipe ? (
                        <>
                          <div className="text-[11px] font-bold text-[#9EACB8]">مواد مصرفی استاندارد (BOM):</div>
                          <div className="space-y-1">
                            {recipe.ingredients.map((ingItem, idx) => {
                              const ing = ingredients.find((i) => i.id === ingItem.ingredient_id);
                              return (
                                <div key={idx} className="flex justify-between text-xs bg-[#0D1015] p-1.5 rounded-lg border border-[#232D3E]">
                                  <span className="text-slate-200">{ing ? ing.title_fa : ingItem.ingredient_id}</span>
                                  <span className="font-mono font-bold text-amber-400">
                                    {ingItem.amount} {ingItem.unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {recipe.modifier_overrides && recipe.modifier_overrides.length > 0 && (
                            <div className="mt-2 text-[10px] text-cyan-400 flex items-center gap-1 font-bold">
                              <span>✓ دارای {recipe.modifier_overrides.length} مودیفایر اختصاصی (جایگزینی/افزودنی)</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-amber-400/80 py-2">
                          هنوز فرمول رسپی برای این آیتم تعریف نشده است.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-3">
                    <button
                      type="button"
                      onClick={() => handleOpenRecipeEditor(item)}
                      className="w-full py-2 rounded-xl bg-[#0D1015] hover:bg-[#D71921] text-white border border-[#232D3E] hover:border-[#D71921] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{hasRecipe ? 'ویرایش فرمول رسپی' : 'تعریف رسپی (BOM)'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DEPLETION GAUGES */}
      {activeSubTab === 'depletion_gauges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ingredients.map((ing) => {
            const isOutOfStock = ing.current_stock <= 0;
            const isLow = ing.current_stock <= ing.min_safety_stock;
            const percentage = Math.min(100, Math.round((ing.current_stock / (ing.initial_stock || 1)) * 100));

            return (
              <div
                key={ing.id}
                className="bg-[#151B25] border border-[#232D3E] rounded-2xl p-4.5 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <span>{ing.title_fa}</span>
                      {isOutOfStock ? (
                        <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700 px-2 py-0.5 rounded-full font-bold">
                          تمام شده
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-600 px-2 py-0.5 rounded-full font-bold">
                          زیر آستانه ایمنی
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-xs text-[#9EACB8] font-mono mt-0.5">{ing.title_en}</p>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-lg font-black text-white">{ing.current_stock.toLocaleString()}</span>
                    <span className="text-xs text-[#9EACB8] mr-1">{ing.unit}</span>
                  </div>
                </div>

                {/* Gauge Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[#9EACB8]">
                    <span>تراز مصرف نسبت به ظرفیت اولیه</span>
                    <span className="font-mono font-bold">{percentage}٪</span>
                  </div>
                  <div className="w-full h-3 bg-[#0D1015] rounded-full overflow-hidden p-0.5 border border-[#232D3E]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOutOfStock ? 'bg-rose-600' : isLow ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#232D3E]">
                  <span className="text-[#9EACB8]">
                    آستانه ایمنی: <bdi className="font-mono text-white" dir="ltr">{ing.min_safety_stock} {ing.unit}</bdi>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIngredientForRestock(ing);
                      setRestockAmount(ing.unit === 'piece' ? 10 : ing.unit === 'g' ? 1000 : 2000);
                      setRestockCost(ing.cost_per_unit);
                      setIsRestockOpen(true);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                  >
                    + افزایش سریع موجودی
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: RESTOCK / INTAKE MODAL
          ========================================================================= */}
      {isRestockOpen && selectedIngredientForRestock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#151B25] border border-[#232D3E] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#232D3E]">
              <div>
                <h3 className="font-extrabold text-sm text-white">ثبت ورود بار / افزایش موجودی انبار</h3>
                <p className="text-xs text-[#9EACB8] mt-0.5">{selectedIngredientForRestock.title_fa}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockOpen(false)}
                className="p-1 rounded text-[#9EACB8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">
                  مقدار ورودی جدید ({selectedIngredientForRestock.unit}):
                </label>
                <input
                  type="number"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#D71921]"
                />
              </div>

              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">
                  قیمت خرید هر واحد (تومان):
                </label>
                <input
                  type="number"
                  value={restockCost}
                  onChange={(e) => setRestockCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#D71921]"
                />
              </div>

              <div className="p-3 bg-[#0D1015] rounded-xl border border-[#232D3E] space-y-1">
                <div className="flex justify-between text-[#9EACB8]">
                  <span>موجودی فعلی:</span>
                  <span className="font-mono text-white">
                    {selectedIngredientForRestock.current_stock} {selectedIngredientForRestock.unit}
                  </span>
                </div>
                <div className="flex justify-between text-[#9EACB8]">
                  <span>موجودی پس از ثبت:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(selectedIngredientForRestock.current_stock + restockAmount).toLocaleString()} {selectedIngredientForRestock.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRestockOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0D1015] text-[#9EACB8] hover:text-white border border-[#232D3E] text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmRestock}
                className="px-5 py-2 rounded-xl bg-[#D71921] hover:bg-[#b8141b] text-white text-xs font-black shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)]"
              >
                تایید و افزایش موجودی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CREATE NEW INGREDIENT
          ========================================================================= */}
      {isNewIngredientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#151B25] border border-[#232D3E] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#232D3E]">
              <h3 className="font-extrabold text-sm text-white">تعریف ماده خام جدید در انبار کافه</h3>
              <button
                type="button"
                onClick={() => setIsNewIngredientOpen(false)}
                className="p-1 rounded text-[#9EACB8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[#9EACB8] mb-1 font-bold">نام ماده خام (فارسی):</label>
                <input
                  type="text"
                  value={newTitleFa}
                  onChange={(e) => setNewTitleFa(e.target.value)}
                  placeholder="مثال: دانه قهوه رواندا"
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D71921]"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-[#9EACB8] mb-1 font-bold">عنوان انگلیسی (English):</label>
                <input
                  type="text"
                  value={newTitleEn}
                  onChange={(e) => setNewTitleEn(e.target.value)}
                  placeholder="e.g. Rwanda Single Origin"
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D71921]"
                />
              </div>

              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">واحد سنجش (Unit):</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value as IngredientUnit)}
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D71921]"
                >
                  <option value="g">گرم (g)</option>
                  <option value="ml">میلی‌لیتر (ml)</option>
                  <option value="piece">عدد / قطعه (piece)</option>
                  <option value="shot">شات (shot)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">موجودی اولیه:</label>
                <input
                  type="number"
                  value={newInitialStock}
                  onChange={(e) => setNewInitialStock(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D71921]"
                />
              </div>

              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">حداقل ایمنی هشدار (Safety Stock):</label>
                <input
                  type="number"
                  value={newMinSafetyStock}
                  onChange={(e) => setNewMinSafetyStock(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D71921]"
                />
              </div>

              <div>
                <label className="block text-[#9EACB8] mb-1 font-bold">قیمت واحد (تومان):</label>
                <input
                  type="number"
                  value={newCostPerUnit}
                  onChange={(e) => setNewCostPerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0D1015] border border-[#232D3E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D71921]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#232D3E]">
              <button
                type="button"
                onClick={() => setIsNewIngredientOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0D1015] text-[#9EACB8] hover:text-white border border-[#232D3E] text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleCreateIngredient}
                disabled={!newTitleFa.trim()}
                className="px-5 py-2 rounded-xl bg-[#D71921] hover:bg-[#b8141b] disabled:opacity-50 text-white text-xs font-black shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)]"
              >
                ذخیره ماده خام
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: BOM RECIPE CONFIGURATOR MODAL
          ========================================================================= */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#151B25] border border-[#232D3E] rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#232D3E]">
              <div>
                <h3 className="font-extrabold text-sm text-white">
                  پیکربندی رسپی و مودیفایرهای آیتم (Recipe BOM Editor)
                </h3>
                <p className="text-xs text-[#9EACB8] mt-0.5">
                  آیتم انتخابی: {menuItems.find((m) => m.id === selectedMenuItemId)?.nameFa}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="p-1 rounded text-[#9EACB8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Standard Ingredients */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D71921]"></span>
                  <span>۱. مواد خام مصرفی استاندارد (Standard BOM)</span>
                </h4>
              </div>

              {recipeIngredients.length > 0 ? (
                <div className="space-y-2">
                  {recipeIngredients.map((rIng) => {
                    const ing = ingredients.find((i) => i.id === rIng.ingredient_id);
                    return (
                      <div
                        key={rIng.ingredient_id}
                        className="flex items-center justify-between bg-[#0D1015] p-3 rounded-xl border border-[#232D3E] text-xs"
                      >
                        <div className="flex-1">
                          <span className="font-bold text-white">{ing ? ing.title_fa : rIng.ingredient_id}</span>
                          <span className="text-[10px] text-[#9EACB8] block">{ing?.title_en}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={rIng.amount}
                            onChange={(e) =>
                              handleAddRecipeIngredient(
                                rIng.ingredient_id,
                                parseFloat(e.target.value) || 0,
                                rIng.unit
                              )
                            }
                            className="w-20 bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1 text-white font-mono text-xs text-center"
                          />
                          <span className="font-mono text-[#9EACB8]">{rIng.unit}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeIngredient(rIng.ingredient_id)}
                            className="p-1 text-rose-400 hover:text-rose-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-[#9EACB8] p-3 bg-[#0D1015] rounded-xl border border-dashed border-[#232D3E] text-center">
                  هیچ ماده خامی هنوز برای این رسپی انتخاب نشده است. از لیست زیر اضافه کنید:
                </div>
              )}

              {/* Quick Add Ingredient Line */}
              <div className="p-3 bg-[#0D1015] rounded-xl border border-[#232D3E] flex items-center gap-2">
                <select
                  id="select-add-ingredient"
                  className="flex-1 bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1.5 text-xs text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    انتخاب ماده خام برای افزودن به رسپی...
                  </option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title_fa} ({i.unit})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const sel = document.getElementById('select-add-ingredient') as HTMLSelectElement;
                    if (sel && sel.value) {
                      const ing = ingredients.find((i) => i.id === sel.value);
                      if (ing) {
                        handleAddRecipeIngredient(ing.id, ing.unit === 'g' ? 18 : ing.unit === 'ml' ? 160 : 1, ing.unit);
                      }
                      sel.value = '';
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#D71921] text-white text-xs font-bold hover:bg-[#b8141b]"
                >
                  افزودن به رسپی
                </button>
              </div>
            </div>

            {/* Section 2: Modifier Overrides */}
            <div className="space-y-3 pt-3 border-t border-[#232D3E]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>۲. رفتار مودیفایرها (Modifier Overrides)</span>
                </h4>
              </div>

              {recipeOverrides.length > 0 ? (
                <div className="space-y-2">
                  {recipeOverrides.map((ov, idx) => (
                    <div
                      key={idx}
                      className="bg-[#0D1015] p-3 rounded-xl border border-[#232D3E] text-xs flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-cyan-300">مودیفایر: {ov.modifier_key}</span>
                        <div className="text-[11px] text-[#9EACB8]">
                          {ov.replaces && ov.with ? (
                            <span>
                              جایگزینی{' '}
                              <b className="text-white">
                                {ingredients.find((i) => i.id === ov.replaces)?.title_fa}
                              </b>{' '}
                              با{' '}
                              <b className="text-emerald-400">
                                {ov.with.amount} {ov.with.unit}{' '}
                                {ingredients.find((i) => i.id === ov.with?.ingredient_id)?.title_fa}
                              </b>
                            </span>
                          ) : ov.adds ? (
                            <span>
                              افزودن{' '}
                              <b className="text-amber-400">
                                +{ov.adds.amount} {ov.adds.unit}{' '}
                                {ingredients.find((i) => i.id === ov.adds?.ingredient_id)?.title_fa}
                              </b>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setRecipeOverrides((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-rose-400 hover:text-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#9EACB8]">
                  هیچ قانون جایگزینی مودیفایر (مثلاً جایگزینی شیر گاو با شیر جو دوسر) تعریف نشده است.
                </p>
              )}

              {/* Add New Override Box */}
              <div className="p-3 bg-[#0D1015] rounded-xl border border-[#232D3E] space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">تعریف قانون جدید برای مودیفایر:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-[#9EACB8] mb-0.5">نام مودیفایر در منو:</label>
                    <input
                      type="text"
                      value={overrideKey}
                      onChange={(e) => setOverrideKey(e.target.value)}
                      placeholder="مثال: شیر جو دوسر یا شات اضافه"
                      className="w-full bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#9EACB8] mb-0.5">نوع رفتار:</label>
                    <select
                      value={overrideAction}
                      onChange={(e) => setOverrideAction(e.target.value as 'REPLACE' | 'ADD')}
                      className="w-full bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1 text-white"
                    >
                      <option value="REPLACE">جایگزینی یک ماده با ماده دیگر (Replace)</option>
                      <option value="ADD">افزودن مقدار اضافی به رسپی (Add Extra)</option>
                    </select>
                  </div>

                  {overrideAction === 'REPLACE' && (
                    <div>
                      <label className="block text-[10px] text-[#9EACB8] mb-0.5">ماده‌ای که حذف می‌شود:</label>
                      <select
                        value={overrideReplacesId}
                        onChange={(e) => setOverrideReplacesId(e.target.value)}
                        className="w-full bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1 text-white"
                      >
                        <option value="">انتخاب...</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.title_fa}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-[#9EACB8] mb-0.5">ماده هدف (تزریقی):</label>
                    <select
                      value={overrideTargetId}
                      onChange={(e) => setOverrideTargetId(e.target.value)}
                      className="w-full bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1 text-white"
                    >
                      <option value="">انتخاب...</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title_fa} ({i.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#9EACB8] mb-0.5">مقدار مصرفی:</label>
                    <input
                      type="number"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#151B25] border border-[#232D3E] rounded-lg px-2 py-1 text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddOverride}
                  className="px-3 py-1.5 rounded-lg bg-cyan-900/80 border border-cyan-500/50 hover:bg-cyan-800 text-cyan-200 text-xs font-bold transition"
                >
                  + ثبت این مودیفایر در رسپی
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#232D3E]">
              <button
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0D1015] text-[#9EACB8] hover:text-white border border-[#232D3E] text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="px-6 py-2 rounded-xl bg-[#D71921] hover:bg-[#b8141b] text-white text-xs font-black shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)]"
              >
                ذخیره رسپی (BOM)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Inward Purchase Invoice Modal */}
      <InventoryInwardModal
        isOpen={isInwardModalOpen}
        onClose={() => setIsInwardModalOpen(false)}
        ingredients={ingredients}
        onInwardSuccess={() => {
          // Reactive subscription will refresh ingredients automatically
        }}
      />
    </div>
  );
};
