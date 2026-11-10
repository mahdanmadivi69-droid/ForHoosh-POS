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
  handleUpdateQuantity: (cartItemId: string, delta: number) => void;
  handleRemoveItem: (cartItemId: string) => void;
  // Tabs & Shift state
  activeTabId: string | null;
  handleCancelTabEditing: () => void;
  openTabsCount: number;
  onOpenTabsModal: () => void;
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
  handleUpdateQuantity,
  handleRemoveItem,
  activeTabId,
  handleCancelTabEditing,
  openTabsCount,
  onOpenTabsModal,
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
    } catch (err) {
      console.warn('[PosCartPanel] Customer persistence error:', err);
    }
  };

  return (
    <div
      className={`bg-[rgba(20,25,36,0.72)] backdrop-blur-[28px] border border-white/10 rounded-3xl shadow-2xl transition-all overflow-hidden flex flex-col h-full w-full ${className}`}
    >
      {/* ================= CART HEADER & 100 HICH BRAND BADGE ================= */}
      <div className="p-3 border-b border-white/10 bg-[rgba(12,25,48,0.7)] backdrop-blur-xl flex flex-col gap-2.5">
        {/* Centered 100 HICH Brand Badge Capsule strictly above the title */}
        <div className="flex justify-center w-full">
          <div
            dir="ltr"
            className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-[#071C3D] border-2 border-white shadow-md text-center shrink-0"
          >
            <span className="text-white font-black text-xs tracking-widest uppercase font-sans leading-none">
              100 HICH
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D71921] animate-ping"></span>
            <h2 className="text-sm font-extrabold text-white tracking-wide">
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
              className="px-2.5 py-1 rounded-lg bg-[rgba(140,19,24,0.3)] hover:bg-[rgba(140,19,24,0.5)] border border-[rgba(144,210,237,0.3)] text-[#90D2ED] hover:text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              title="مشاهده و بازیابی تب‌های باز سالن"
            >
              <Layers className="w-3 h-3" />
              <span>تب‌ها</span>
              <span className="w-4 h-4 rounded-full bg-[#8C1318] text-white flex items-center justify-center text-[10px] font-mono">
                {openTabsCount}
              </span>
            </button>
            <span className="font-mono text-xs bg-[#081425] px-2 py-0.5 rounded text-[#F3E9DD] border border-[#293444] font-bold">
              #100H-{activeShift ? activeShift.id.slice(-4) : 'POS'}
            </span>
          </div>
        </div>

        {/* Active Recalled Tab Notice Banner */}
        {activeTabId && (
          <div className="bg-gradient-to-r from-[rgba(140,19,24,0.45)] to-[rgba(15,34,61,0.7)] border border-[rgba(144,210,237,0.45)] p-2 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span className="font-bold text-white">
                در حال ویرایش تب: <span className="text-[#F5E8D0]">{tableLabel || 'میز فعال'}</span>
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
        <div className="grid grid-cols-2 gap-1.5 bg-[#121417]/80 p-1 rounded-lg border border-[#293444] text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setOrderType('TAKEAWAY');
            }}
            className={`py-1.5 rounded flex items-center justify-center gap-1 transition-all cursor-pointer ${
              orderType === 'TAKEAWAY'
                ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] border border-[#9E8A5E]/50 text-white shadow-md'
                : 'text-[#9EACB8] hover:text-white'
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
            className={`py-1.5 rounded flex items-center justify-center gap-1 transition-all cursor-pointer ${
              orderType === 'DINE_IN'
                ? 'bg-[#D71921] text-white shadow-sm'
                : 'text-[#9EACB8] hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>سالن</span>
          </button>
        </div>
      </div>

      {/* ================= CUSTOMER DETAIL & TABLE PICKER ================= */}
      {is100Hich ? (
        <div className="px-3 py-2 bg-[#121417]/50 border-b border-[#293444] flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <UserIcon className="w-3.5 h-3.5 text-[#9EACB8] shrink-0" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={() => handleCustomerPersist(customerName, customerPhone || '')}
              placeholder="نام مشتری..."
              className="bg-transparent text-white placeholder:text-[#9EACB8]/70 text-xs w-full focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <Phone className="w-3.5 h-3.5 text-[#9EACB8] shrink-0" />
            <input
              type="tel"
              value={customerPhone || ''}
              onChange={(e) => setCustomerPhone?.(e.target.value)}
              onBlur={() => handleCustomerPersist(customerName, customerPhone || '')}
              placeholder="شماره تماس..."
              dir="ltr"
              className="bg-transparent text-white placeholder:text-[#9EACB8]/70 text-xs w-full text-right focus:outline-none font-mono"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="px-3 py-2 bg-[#121417]/50 border-b border-[#293444] flex items-center justify-between text-xs gap-2">
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
              className="bg-transparent text-white placeholder:text-[#9EACB8]/70 text-xs w-full focus:outline-none"
            />
            {orderType === 'DINE_IN' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onOpenTablePicker}
                  className="text-[10px] bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                  title="انتخاب بصری از نقشه سالن"
                >
                  <LayoutGrid className="w-3 h-3 text-emerald-400" />
                  <span>نقشه</span>
                </button>
                <select
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  className="text-[10px] text-white bg-[#1B222C] px-1.5 py-0.5 rounded border border-[#293444] cursor-pointer focus:outline-none"
                >
                  {activeTenant.workflow.requireTableNumber && (
                    <option value="" className="bg-[#1B222C] text-gray-400">
                      -- انتخاب میز --
                    </option>
                  )}
                  {floorPlanService.getTables().map((tbl) => (
                    <option key={tbl.id} value={tbl.display_name} className="bg-[#1B222C] text-white">
                      {tbl.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[10px] text-[#9EACB8] bg-[#1B222C] px-1.5 py-0.5 rounded border border-[#293444] whitespace-nowrap">
                بیرون‌بر
              </span>
            )}
          </div>

          {/* Quick-Select Table Button Bar for Table-Required Tenants */}
          {orderType === 'DINE_IN' && activeTenant.workflow.requireTableNumber && activeTenant.workflow.quickTables.length > 0 && (
            <div className="px-3 py-2 bg-[#121417]/80 border-b border-[#293444]">
              <div className="text-[10px] text-[#9EACB8] font-bold mb-1.5 flex items-center justify-between">
                <span>میزهای پرکاربرد (سریع):</span>
                {tableLabel ? (
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                    <span>میز فعال:</span>
                    <span className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-600/50">{tableLabel}</span>
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
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      tableLabel === tbl
                        ? 'bg-[var(--app-accent,#005A3E)] text-white shadow-md border border-emerald-400 scale-105'
                        : 'bg-[#1B222C] text-[#9EACB8] hover:text-white border border-[#293444]'
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
      <div className="px-3 py-1.5 bg-[#121417]/30 border-b border-[#293444] flex items-center text-xs gap-2">
        <input
          type="text"
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          placeholder="یادداشت فاکتور (توضیحات کلی سفارش)..."
          className="bg-transparent text-white placeholder:text-[#9EACB8]/50 text-xs w-full focus:outline-none"
        />
      </div>

      {/* ================= CART ITEMS LIST (SCROLLABLE AREA) ================= */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#9EACB8]">
            <div className="w-14 h-14 rounded-full bg-[#121417] flex items-center justify-center border border-[#293444] mb-3">
              <Coffee className="w-7 h-7 text-[#D71921] opacity-80" />
            </div>
            <p className="text-sm font-bold text-white mb-1">فاکتور هنوز خالی است</p>
            <p className="text-xs text-[#9EACB8] max-w-xs">
              آیتمی از منوی بلندها، بار گرم یا دانه‌های تخصصی صد هیچ را لمس کنید تا به سبد اضافه شود.
            </p>
          </div>
        ) : (
          cartItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#121417] border border-[#293444] rounded-lg p-2.5 flex flex-col gap-2 transition hover:border-[#293444]/90"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {item.itemNameSnapshot}
                  </h4>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-[#9EACB8]">
                      {item.modifiers.map((m, mIdx) => (
                        <span key={mIdx} className="text-[#F3E9DD] font-medium">
                          {m.nameFa}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[10px] text-amber-400 italic">*{item.notes}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-[#9EACB8] hover:text-red-400 p-1 cursor-pointer"
                  title="حذف آیتم"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#293444]/50">
                <div className="flex items-center bg-[#1B222C] border border-[#293444] rounded-md">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="w-6 h-6 flex items-center justify-center text-[#9EACB8] hover:text-white font-black text-sm active:bg-[#D71921] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-7 text-center font-bold text-xs text-white num-heavy">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="w-6 h-6 flex items-center justify-center text-[#9EACB8] hover:text-white font-black text-sm active:bg-[#D71921] cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="text-left">
                  <span className="text-xs font-black text-white num-heavy">
                    {formatToman(item.subtotalToman)}
                  </span>
                  <span className="text-[9px] text-[#9EACB8] mr-0.5">تومان</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ================= DISCOUNT & ACCELERATORS ================= */}
      <div className="px-3 pt-2 pb-1 border-t border-[#293444] bg-[#121417]/40">
        <div className="flex items-center justify-between text-[11px] text-[#9EACB8] mb-1.5">
          <span className="flex items-center gap-1.5">
            <span>تخفیف سریع فاکتور:</span>
            {!canEditFinancials && (
              <span className="flex items-center gap-0.5 text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-bold">
                <Lock className="w-2.5 h-2.5" />
                <span>قفل مدیر</span>
              </span>
            )}
          </span>
          <span className="text-[#F3E9DD] font-bold">
            {discountPercent > 0 ? `${discountPercent}٪ تخفیف فعال` : 'بدون تخفیف'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleApplyDiscountPercent(0)}
            className={`py-1 rounded border text-[11px] cursor-pointer ${
              discountPercent === 0
                ? 'bg-[#0F223D] border-[#D71921] text-white'
                : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white'
            }`}
          >
            ۰٪
          </button>
          <button
            type="button"
            disabled={!canEditFinancials}
            onClick={() => handleApplyDiscountPercent(5)}
            title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
            className={`py-1 rounded border text-[11px] ${
              !canEditFinancials
                ? 'opacity-40 cursor-not-allowed bg-[#1B222C] border-[#293444] text-[#9EACB8]'
                : discountPercent === 5
                ? 'bg-[#0F223D] border-[#D71921] text-white cursor-pointer'
                : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white cursor-pointer'
            }`}
          >
            ۵٪ ویژه
          </button>
          <button
            type="button"
            disabled={!canEditFinancials}
            onClick={() => handleApplyDiscountPercent(10)}
            title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
            className={`py-1 rounded border text-[11px] ${
              !canEditFinancials
                ? 'opacity-40 cursor-not-allowed bg-[#1B222C] border-[#293444] text-[#9EACB8]'
                : discountPercent === 10
                ? 'bg-[#0F223D] border-[#D71921] text-white cursor-pointer'
                : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white cursor-pointer'
            }`}
          >
            ۱۰٪ باریستا
          </button>
          <button
            type="button"
            disabled={!canEditFinancials}
            onClick={() => handleApplyDiscountPercent(15)}
            title={!canEditFinancials ? 'تدوین تخفیف فقط با دسترسی مدیر و مالک مجاز است' : undefined}
            className={`py-1 rounded border text-[11px] ${
              !canEditFinancials
                ? 'opacity-40 cursor-not-allowed bg-[#1B222C] border-[#293444] text-[#9EACB8]'
                : discountPercent === 15
                ? 'bg-[#0F223D] border-[#D71921] text-white cursor-pointer'
                : 'bg-[#1B222C] border-[#293444] text-[#9EACB8] hover:text-white cursor-pointer'
            }`}
          >
            ۱۵٪ همکار
          </button>
        </div>
      </div>

      {/* ================= FINANCIAL CALCULATIONS & SUMMARY ================= */}
      <div className="p-3.5 bg-[#121417] border-t border-[#293444] space-y-2 rounded-b-3xl">
        <div className="flex justify-between items-center text-xs text-[#9EACB8]">
          <span>جمع اقلام:</span>
          <span className="font-bold text-white num-heavy">
            {formatToman(grossAmountToman)} تومان
          </span>
        </div>

        <div className="flex justify-between items-center text-xs text-[#9EACB8]">
          <span>کسر تخفیف:</span>
          <span className="text-[#F3E9DD] num-heavy">
            {discountAmountToman > 0
              ? `-${formatToman(discountAmountToman)} تومان`
              : '۰ تومان'}
          </span>
        </div>

        <div className="h-[1px] bg-[#293444]/80 my-1"></div>

        <div className="flex justify-between items-baseline">
          <span className="text-sm font-extrabold text-white">مبلغ نهایی فاکتور:</span>
          <div className="text-right">
            <span className="text-xl font-black text-[#D71921] num-heavy tracking-tight">
              {formatToman(netTotalToman)}
            </span>
            <span className="text-xs text-[#9EACB8] mr-1">تومان</span>
          </div>
        </div>

        {/* Action Controls Split */}
        <div className="flex items-center gap-2 pt-1.5">
          <button
            type="button"
            onClick={handleClearCart}
            title="پاک کردن سبد"
            className="w-10 h-11 shrink-0 bg-[#1B222C] hover:bg-[#222B38] border border-[#293444] text-[#9EACB8] hover:text-red-400 rounded-xl flex items-center justify-center transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Button 1: ثبت تب / مشاهده تب‌ها */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              onOpenTabsModal();
            }}
            className="flex-1 h-11 px-2.5 rounded-xl bg-[rgba(15,28,48,0.85)] hover:bg-[rgba(20,38,65,0.95)] border border-[rgba(144,210,237,0.35)] text-[#90D2ED] hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Layers className="w-4 h-4 shrink-0 text-[#90D2ED]" />
            <span className="truncate">ثبت تب / مشاهده تب‌ها</span>
            <span className="w-4 h-4 rounded-full bg-[#8C1318] text-white flex items-center justify-center text-[10px] font-mono shrink-0">
              {openTabsCount}
            </span>
          </button>

          {/* Button 2: ثبت و پرداخت فوری (Crimson #D71921 CTA) */}
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={cartItems.length === 0}
            className="flex-[1.4] h-11 relative group overflow-hidden bg-[#D71921] hover:bg-[#B8141B] active:scale-[0.98] disabled:bg-stone-800 disabled:opacity-40 text-white font-black px-3 rounded-xl flex items-center justify-center gap-1.5 border border-white/30 shadow-[0_0_20px_rgba(215,25,33,0.6)] hover:shadow-[0_0_30px_rgba(215,25,33,0.8)] transition-all cursor-pointer text-xs"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="relative z-10 whitespace-nowrap">ثبت و پرداخت فوری</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosCartPanel;
