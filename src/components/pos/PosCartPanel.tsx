import React from 'react';
import {
  ShoppingBag,
  Store,
  Layers,
  RotateCcw,
  LayoutGrid,
  Coffee,
  Trash2,
  Lock,
  CreditCard,
  User as UserIcon,
  Phone,
} from 'lucide-react';
import { OrderItem, OrderType } from '../../types/domain';
import { TenantProfile } from '../../config/tenantConfig';
import { floorPlanService } from '../../services/floorPlanService';
import { playPosBeep } from '../../services/soundEffects';
import { getCafeDatabase } from '../../db/cafeDb';

export interface PosCartPanelProps {
  cartItems: OrderItem[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  tableLabel: string;
  setTableLabel: (table: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (phone: string) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  discountPercent: number;
  handleApplyDiscountPercent: (percent: number) => void;
  canEditFinancials: boolean;
  grossAmountToman: number;
  discountAmountToman: number;
  netTotalToman: number;
  handleClearCart: () => void;
  handleStartCheckout: () => void;
  isSubmittingOrder?: boolean;
  handleUpdateQuantity: (cartItemId: string, delta: number) => void;
  handleRemoveItem: (cartItemId: string) => void;
  // Tabs & Shift state
  activeTabId: string | null;
  handleCancelTabEditing: () => void;
  openTabsCount: number;
  onOpenTabsModal: () => void;
  onHoldOrUpdateTab?: () => void;
  activeShift: { id: string } | null;
  onOpenTablePicker: () => void;
  activeTenant: TenantProfile;
  formatToman: (amount: number) => string;
  className?: string;
}

/**
 * PosCartPanel — 100 HICH Obsidian Liquid Glass Cart Panel
 *
 * Invariants & Specifications:
 * 1. Materiality: Translucent Liquid Glass (rgba(20,25,36,0.72), backdrop-blur 28px, border 1px border-white/10).
 * 2. 100 HICH Brand Badge: Placed strictly [above-cart] (top of panel) with LTR orientation:
 *    "100 HICH COFFEE ROASTERS", solid navy fill (#071C3D), crisp 2px border-white, uppercase.
 * 3. Primary Action Button: High-contrast Crimson Red (#D71921), label "ثبت و پرداخت", icon CreditCard.
 */
export const PosCartPanel: React.FC<PosCartPanelProps> = ({
  cartItems,
  orderType,
  setOrderType,
  tableLabel,
  setTableLabel,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  orderNotes,
  setOrderNotes,
  discountPercent,
  handleApplyDiscountPercent,
  canEditFinancials,
  grossAmountToman,
  discountAmountToman,
  netTotalToman,
  handleClearCart,
  handleStartCheckout,
  isSubmittingOrder = false,
  handleUpdateQuantity,
  handleRemoveItem,
  activeTabId,
  handleCancelTabEditing,
  openTabsCount,
  onOpenTabsModal,
  onHoldOrUpdateTab,
  activeShift,
  onOpenTablePicker,
  activeTenant,
  formatToman,
  className = '',
}) => {
  const tenantIdStr = activeTenant.id as string;
  const is100Hich = tenantIdStr === '100hich' || tenantIdStr === 'tenant-100hich-01';

  // Persist customer record to tenant-partitioned Dexie database
  const handleCustomerPersist = async (name: string, phone: string) => {
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    if (!cleanName && !cleanPhone) return;

    try {
      const tenantDb = getCafeDatabase(activeTenant.id);
      await tenantDb.transaction('rw', tenantDb.customers, async () => {
        let existing = null;
        if (cleanPhone) {
          existing = await tenantDb.customers.where('phone').equals(cleanPhone).first();
        }
        if (!existing && cleanName) {
          existing = await tenantDb.customers.where('name').equals(cleanName).first();
        }

        if (existing) {
          await tenantDb.customers.update(existing.id, {
            name: cleanName || existing.name,
            phone: cleanPhone || existing.phone,
          });
        } else {
          const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await tenantDb.customers.put({
            id,
            name: cleanName,
            phone: cleanPhone,
            tenantId: activeTenant.id,
            createdAt: Date.now(),
          });
        }
      });
    } catch (err) {
      console.warn('[PosCartPanel] Customer persistence error:', err);
    }
  };

  return (
    <div
      className={`liquid-glass-panel rounded-3xl transition-all flex flex-col h-full max-h-full justify-between overflow-hidden w-full ${className}`}
    >
      {/* ================= CART HEADER ================= */}
      <div className="p-2.5 py-1.5 border-b border-white/10 bg-[#0B1524]/80 backdrop-blur-xl flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D71921] animate-ping"></span>
            <h2 className="text-sm font-extrabold text-[#F5F5F7] tracking-wide">
              سفارش جاری بار
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                onOpenTabsModal();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#0F223D] hover:bg-[#162E52] border border-white/15 text-[#90D2ED] hover:text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
              title="مشاهده و بازیابی تب‌های باز سالن"
            >
              <Layers className="w-3 h-3" />
              <span>تب‌ها</span>
              <span className="w-4 h-4 rounded-full bg-[#D71921] text-white flex items-center justify-center text-[10px] font-mono">
                {openTabsCount}
              </span>
            </button>
            <span className="font-mono text-xs bg-[#0B1524] px-2 py-0.5 rounded text-[#C5A880] border border-white/10 font-bold">
              #{is100Hich ? '100H' : 'MOD'}-{activeShift ? activeShift.id.slice(-4) : 'POS'}
            </span>
          </div>
        </div>

        {/* Active Recalled Tab Notice Banner */}
        {activeTabId && (
          <div className="bg-gradient-to-r from-[#D71921]/30 to-[#0F223D]/80 border border-[#D71921]/40 p-2 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span className="font-bold text-[#F5F5F7]">
                در حال ویرایش تب: <span className="text-[#C5A880]">{tableLabel || 'میز فعال'}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelTabEditing}
              className="text-[10px] text-rose-300 hover:text-white px-2 py-0.5 rounded bg-black/40 border border-white/10 cursor-pointer"
            >
              خروج از ویرایش
            </button>
          </div>
        )}

        {/* Dine-in vs Takeaway Toggle */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#0B1524]/90 p-1 rounded-xl border border-white/10 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setOrderType('TAKEAWAY');
            }}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
              orderType === 'TAKEAWAY'
                ? 'bg-[#D71921] border border-white/20 text-white shadow-md'
                : 'text-[#F5F5F7]/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>بیرون‌بر</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setOrderType('DINE_IN');
            }}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
              orderType === 'DINE_IN'
                ? 'bg-[#D71921] border border-white/20 text-white shadow-md'
                : 'text-[#F5F5F7]/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>سالن</span>
          </button>
        </div>
      </div>

      {/* ================= CUSTOMER DETAIL & TABLE PICKER ================= */}
      {is100Hich ? (
        <div className="px-3 py-1.5 bg-[#0B1524]/60 border-b border-white/10 flex flex-col gap-1 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <UserIcon className="w-3.5 h-3.5 text-[#F5F5F7]/60 shrink-0" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={() => handleCustomerPersist(customerName, customerPhone || '')}
              placeholder="نام مشتری..."
              className="bg-transparent text-[#F5F5F7] placeholder:text-[#F5F5F7]/40 text-xs w-full focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <Phone className="w-3.5 h-3.5 text-[#F5F5F7]/60 shrink-0" />
            <input
              type="tel"
              value={customerPhone || ''}
              onChange={(e) => setCustomerPhone?.(e.target.value)}
              onBlur={() => handleCustomerPersist(customerName, customerPhone || '')}
              placeholder="شماره تماس..."
              dir="ltr"
              className="bg-transparent text-[#F5F5F7] placeholder:text-[#F5F5F7]/40 text-xs w-full text-right focus:outline-none font-mono"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="px-3 py-1.5 bg-[#0B1524]/60 border-b border-white/10 flex items-center justify-between text-xs gap-2 shrink-0">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={() => handleCustomerPersist(customerName, customerPhone || '')}
              placeholder={
                orderType === 'DINE_IN'
                  ? 'نام مشتری / مهمان سالن...'
                  : 'نام مشتری بیرون‌بر...'
              }
              className="bg-transparent text-[#F5F5F7] placeholder:text-[#F5F5F7]/40 text-xs w-full focus:outline-none"
            />
            {orderType === 'DINE_IN' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onOpenTablePicker}
                  className="text-[10px] bg-[#005A3E]/80 hover:bg-[#005A3E] border border-emerald-500/50 text-emerald-200 px-1.5 py-0.5 rounded-lg flex items-center gap-1 transition-colors active:scale-95"
                  title="انتخاب بصری از نقشه سالن"
                >
                  <LayoutGrid className="w-3 h-3 text-emerald-300" />
                  <span>نقشه</span>
                </button>
                <select
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  className="text-[10px] text-[#F5F5F7] bg-[#0F223D] px-1.5 py-0.5 rounded-lg border border-white/12 cursor-pointer focus:outline-none"
                >
                  {activeTenant.workflow.requireTableNumber && (
                    <option value="" className="bg-[#0F223D] text-gray-400">
                      -- انتخاب میز --
                    </option>
                  )}
                  {floorPlanService.getTables().map((tbl) => (
                    <option key={tbl.id} value={tbl.display_name} className="bg-[#0F223D] text-[#F5F5F7]">
                      {tbl.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[10px] text-[#F5F5F7]/60 bg-[#0F223D] px-1.5 py-0.5 rounded-lg border border-white/10 whitespace-nowrap">
                بیرون‌بر
              </span>
            )}
          </div>

          {/* Quick-Select Table Button Bar for Table-Required Tenants */}
          {orderType === 'DINE_IN' && activeTenant.workflow.requireTableNumber && activeTenant.workflow.quickTables.length > 0 && (
            <div className="px-3 py-2 bg-[#0B1524]/80 border-b border-white/10 shrink-0">
              <div className="text-[10px] text-[#F5F5F7]/70 font-bold mb-1.5 flex items-center justify-between">
                <span>میزهای پرکاربرد (سریع):</span>
                {tableLabel ? (
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                    <span>میز فعال:</span>
                    <span className="bg-[#005A3E] px-1.5 py-0.5 rounded-md border border-emerald-400 text-white">{tableLabel}</span>
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold">میزی انتخاب نشده است</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeTenant.workflow.quickTables.map((tbl) => (
                  <button
                    key={tbl}
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setTableLabel(tbl);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      tableLabel === tbl
                        ? 'bg-[#005A3E] text-white shadow-md border border-emerald-400 scale-105'
                        : 'bg-[#0F223D]/80 text-[#F5F5F7]/70 hover:text-white border border-white/10'
                    }`}
                  >
                    {tbl}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= INVOICE NOTES ================= */}
      <div className="px-3 py-1.5 bg-[#0B1524]/40 border-b border-white/10 flex items-center text-xs gap-2 shrink-0">
        <input
          type="text"
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          placeholder="یادداشت فاکتور (توضیحات کلی سفارش)..."
          className="bg-transparent text-[#F5F5F7] placeholder:text-[#F5F5F7]/40 text-xs w-full focus:outline-none"
        />
      </div>

      {/* ================= CART ITEMS LIST (SCROLLABLE AREA) ================= */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#F5F5F7]/60">
            <div className="w-14 h-14 rounded-full bg-[#0B1524] flex items-center justify-center border border-white/10 mb-3">
              <Coffee className="w-7 h-7 text-[#D71921] opacity-90" />
            </div>
            <p className="text-sm font-bold text-[#F5F5F7] mb-1">فاکتور هنوز خالی است</p>
            <p className="text-xs text-[#F5F5F7]/50 max-w-xs">
              {is100Hich
                ? 'آیتمی از منوی بلندها، بار گرم یا دانه‌های تخصصی صد هیچ را لمس کنید تا به سبد اضافه شود.'
                : 'آیتمی از منوی کافه مودندو یا سشن‌های بازی را لمس کنید تا به سبد اضافه شود.'}
            </p>
          </div>
        ) : (
          cartItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#0B1524]/70 border border-white/10 rounded-xl p-2.5 flex flex-col gap-2 transition hover:border-white/20 backdrop-blur-md shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#F5F5F7] truncate">
                    {item.itemNameSnapshot}
                  </h4>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-[#F5F5F7]/70">
                      {item.modifiers.map((m, mIdx) => (
                        <span key={mIdx} className="text-[#C5A880] font-medium">
                          {m.nameFa}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[10px] text-[#C5A880] italic">*{item.notes}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-[#F5F5F7]/50 hover:text-red-400 p-1 cursor-pointer transition-colors"
                  title="حذف آیتم"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <div className="flex items-center bg-[#0F223D]/80 border border-white/12 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="w-6 h-6 flex items-center justify-center text-[#F5F5F7]/70 hover:text-white font-black text-sm active:bg-[#D71921] cursor-pointer rounded-r-lg transition-colors"
                  >
                    -
                  </button>
                  <span className="w-7 text-center font-bold text-xs text-[#F5F5F7] num-heavy font-mono">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="w-6 h-6 flex items-center justify-center text-[#F5F5F7]/70 hover:text-white font-black text-sm active:bg-[#D71921] cursor-pointer rounded-l-lg transition-colors"
                  >
                    +
                  </button>
                </div>

                <div className="text-left">
                  <span className="text-xs font-black text-[#C5A880] num-heavy font-mono">
                    {formatToman(item.subtotalToman)}
                  </span>
                  <span className="text-[9px] text-[#C5A880]/80 mr-0.5">تومان</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ================= DISCOUNT & ACCELERATORS ================= */}
      <div className="px-3 pt-1 pb-0.5 border-t border-white/10 bg-[#0B1524]/60 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-[#F5F5F7]/70 mb-1">
          <span className="flex items-center gap-1.5">
            <span>تخفیف سریع فاکتور:</span>
            {!canEditFinancials && (
              <span className="flex items-center gap-0.5 text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-bold">
                <Lock className="w-2.5 h-2.5" />
                <span>قفل مدیر</span>
              </span>
            )}
          </span>
          <span className="text-[#C5A880] font-bold">
            {discountPercent > 0 ? `${discountPercent}٪ تخفیف فعال` : 'بدون تخفیف'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleApplyDiscountPercent(0)}
            className={`py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
              discountPercent === 0
                ? 'bg-[#D71921] border-white/20 text-white shadow-sm'
                : 'bg-[#0F223D]/70 border-white/10 text-[#F5F5F7]/70 hover:text-white hover:bg-[#0F223D]'
            }`}
          >
            ۰٪
          </button>
          <button
            type="button"
            disabled={!canEditFinancials}
            onClick={() => handleApplyDiscountPercent(5)}
            title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
            className={`py-1 rounded-lg border text-[11px] transition-all ${
              !canEditFinancials
                ? 'opacity-40 cursor-not-allowed bg-[#0F223D]/40 border-white/5 text-[#F5F5F7]/40'
                : discountPercent === 5
                ? 'bg-[#D71921] border-white/20 text-white shadow-sm cursor-pointer'
                : 'bg-[#0F223D]/70 border-white/10 text-[#F5F5F7]/70 hover:text-white hover:bg-[#0F223D] cursor-pointer'
            }`}
          >
            ۵٪ ویژه
          </button>
          <button
            type="button"
            disabled={!canEditFinancials}
            onClick={() => handleApplyDiscountPercent(10)}
            title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
            className={`py-1 rounded-lg border text-[11px] transition-all ${
              !canEditFinancials
                ? 'opacity-40 cursor-not-allowed bg-[#0F223D]/40 border-white/5 text-[#F5F5F7]/40'
                : discountPercent === 10
                ? 'bg-[#D71921] border-white/20 text-white shadow-sm cursor-pointer'
                : 'bg-[#0F223D]/70 border-white/10 text-[#F5F5F7]/70 hover:text-white hover:bg-[#0F223D] cursor-pointer'
            }`}
          >
            ۱۰٪ باریستا
          </button>
          <button
            type="button"
            disabled={!canEditFinancials}
            onClick={() => handleApplyDiscountPercent(15)}
            title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
            className={`py-1 rounded-lg border text-[11px] transition-all ${
              !canEditFinancials
                ? 'opacity-40 cursor-not-allowed bg-[#0F223D]/40 border-white/5 text-[#F5F5F7]/40'
                : discountPercent === 15
                ? 'bg-[#D71921] border-white/20 text-white shadow-sm cursor-pointer'
                : 'bg-[#0F223D]/70 border-white/10 text-[#F5F5F7]/70 hover:text-white hover:bg-[#0F223D] cursor-pointer'
            }`}
          >
            ۱۵٪ همکار
          </button>
        </div>
      </div>

      {/* ================= FINANCIAL CALCULATIONS & SUMMARY (PERMANENTLY ANCHORED BOTTOM TIER) ================= */}
      <div className="p-2.5 bg-[#0B1524]/95 border-t border-white/12 space-y-1 rounded-b-3xl shrink-0 pb-1.5">
        <div className="flex justify-between items-center text-xs text-[#F5F5F7]/70">
          <span>جمع اقلام:</span>
          <span className="font-bold text-[#F5F5F7] num-heavy font-mono">
            {formatToman(grossAmountToman)} تومان
          </span>
        </div>

        <div className="flex justify-between items-center text-xs text-[#F5F5F7]/70">
          <span>کسر تخفیف:</span>
          <span className="text-[#C5A880] num-heavy font-mono">
            {discountAmountToman > 0
              ? `-${formatToman(discountAmountToman)} تومان`
              : '۰ تومان'}
          </span>
        </div>

        <div className="h-[1px] bg-white/10 my-0.5"></div>

        <div className="flex justify-between items-baseline">
          <span className="text-sm font-extrabold text-[#F5F5F7]">مبلغ نهایی فاکتور:</span>
          <div className="text-right">
            <span className="text-xl font-black text-[#C5A880] num-heavy font-mono tracking-tight">
              {formatToman(netTotalToman)}
            </span>
            <span className="text-xs text-[#C5A880]/80 mr-1">تومان</span>
          </div>
        </div>

        {/* Action Controls Split: 2-Tier Architecture — pinned to the panel bottom, never clipped */}
        <div className="shrink-0 space-y-1 pt-0.5">
          {/* Top Row: [Clear] + [ثبت به عنوان تب باز] + [مشاهده تب‌ها (${count})] */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearCart}
              title="پاک کردن سبد"
              className="w-10 h-10 shrink-0 bg-[#0F223D]/80 hover:bg-[#D71921]/20 border border-white/12 text-[#F5F5F7]/60 hover:text-[#D71921] rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Top Action 1: ثبت به عنوان تب باز (Secondary Glass) */}
            <button
              type="button"
              onClick={() => {
                if (onHoldOrUpdateTab) {
                  onHoldOrUpdateTab();
                } else {
                  playPosBeep('click');
                  onOpenTabsModal();
                }
              }}
              disabled={cartItems.length === 0 && !activeTabId}
              className="flex-1 h-10 px-2.5 rounded-xl bg-[rgba(20,25,36,0.72)] hover:bg-[#162E52] border border-white/15 text-[#F5F5F7] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Layers className="w-3.5 h-3.5 shrink-0 text-[#90D2ED]" />
              <span className="truncate">{activeTabId ? 'ثبت تغییرات روی میز (سفارش باز)' : 'ثبت روی میز (سفارش باز)'}</span>
            </button>

            {/* Top Action 2: مشاهده تب‌ها (${count}) (Pill Badge) */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                onOpenTabsModal();
              }}
              className="h-10 px-3 rounded-xl bg-[#0F223D] hover:bg-[#162E52] border border-white/15 text-[#90D2ED] hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <span>مشاهده تب‌ها</span>
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#D71921] text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                {openTabsCount}
              </span>
            </button>
          </div>

          {/* Bottom Row: Full-width Crimson #D71921 [ثبت و پرداخت فوری / تسویه و بستن میز] */}
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={cartItems.length === 0 || isSubmittingOrder}
            className="vision-checkout-cta tactile-press w-full h-10 relative group overflow-hidden text-white font-black px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="relative z-10 whitespace-nowrap text-sm font-black">
              {activeTabId ? 'تسویه و بستن میز' : 'ثبت و پرداخت فوری'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosCartPanel;
