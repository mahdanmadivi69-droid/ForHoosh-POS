/**
 * src/components/ModendoReceiptHistoryModal.tsx
 * 
 * Modendo POS — Receipt History, Thermal Reprint & PIN-Gated Void
 * Styled with Liquid Glass Emerald Theme (#0b0e12 ground, #1B222C/70 glass cards, #10B981 emerald accent).
 * Strictly isolated from 100 HICH order records.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Printer,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Ban,
  Clock,
  Coffee,
  Gamepad2,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RotateCcw,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { Order, User, isManagerOrOwner } from '../types/domain';
import { SmartOrdersStore } from '../services/storage';
import { RBACService } from '../services/RBACService';
import { printThermalReceipt } from '../services/receiptPrinter';
import { ReceiptOrderData } from './ReceiptPrintTemplate';
import { formatToman } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';

interface ModendoReceiptHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: User;
  onOrderCancelled?: (orderId: string, reason: string) => void;
}

export const ModendoReceiptHistoryModal: React.FC<ModendoReceiptHistoryModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  onOrderCancelled,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Reprint feedback indicator
  const [reprintFeedback, setReprintFeedback] = useState<Record<string, string>>({});

  // PIN-gated void dialog state
  const [voidingOrder, setVoidingOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState<string>('اشتباه در ثبت سفارش یا انصراف مشتری');
  const [managerPin, setManagerPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  const isUserElevated = isManagerOrOwner(activeUser.role);

  // Load orders from tenant-scoped SmartOrdersStore
  const reloadOrders = () => {
    try {
      const all = SmartOrdersStore.getOrders().filter(
        (o) =>
          o.tenantId === 'tenant-modendo-01' ||
          (!o.tenantId?.includes('100hich') && !o.customerName?.includes('۱۰۰هیچ'))
      );
      // Sort newest first
      setOrders([...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.warn('[ModendoReceiptHistory] Failed loading orders:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadOrders();
      setSearchQuery('');
      setStatusFilter('ALL');
      setExpandedOrderId(null);
      setVoidingOrder(null);
      setManagerPin('');
      setPinError(null);
    }
  }, [isOpen]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && ord.status !== statusFilter) {
        return false;
      }

      // 2. Search Query (orderNumber, #MOD-..., table, customer, items)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const cleanQ = q.replace('#', '').replace('mod-', '').replace('mod', '');
        const matchNum = String(ord.orderNumber).includes(cleanQ);
        const matchTable = (ord.tableLabel || '').toLowerCase().includes(q);
        const matchCustomer = (ord.customerName || '').toLowerCase().includes(q);
        const matchItem = ord.items.some((i) =>
          (i.itemNameSnapshot || '').toLowerCase().includes(q)
        );

        return matchNum || matchTable || matchCustomer || matchItem;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  if (!isOpen) return null;

  // Handle thermal reprint
  const handleReprintReceipt = async (order: Order) => {
    playPosBeep('click');
    try {
      const receiptData: ReceiptOrderData = {
        invoiceNo: order.orderNumber,
        tenantId: 'tenant-modendo-01',
        dateTime: order.createdAt,
        orderType: order.orderType,
        cashier: order.createdByUserName,
        customerName: order.customerName,
        tableLabel: order.tableLabel,
        items: order.items.map((i) => ({
          name: i.itemNameSnapshot,
          qty: i.quantity,
          price: i.unitPriceSnapshotToman,
          notes: i.notes,
        })),
        subtotalAmount: order.grossAmountToman,
        discountAmount: order.discountAmountToman,
        totalAmount: order.netTotalToman,
        paymentMethod: 'CASH',
      };
      await printThermalReceipt(receiptData, {
        documentTitle: `فیش مجدد #${order.orderNumber}`,
        tenantName: 'کافه گیمینگ مودندو',
        tenantAddress: 'تهران، خیابان شریعتی، مجتمع مودندو، منفی ۱',
        tenantPhone: '021-88994455',
        headerNoteFa: 'لحظاتی خوش و ماندگار در کافه گیمینگ مودندو',
      });
      playPosBeep('success');
      setReprintFeedback((prev) => ({
        ...prev,
        [order.id]: `✓ فیش #MOD-${order.orderNumber} با موفقیت چاپ شد`,
      }));
      setTimeout(() => {
        setReprintFeedback((prev) => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
      }, 3000);
    } catch (e) {
      console.error('[ModendoReceiptHistory] Reprint failed:', e);
      setReprintFeedback((prev) => ({
        ...prev,
        [order.id]: 'خطا در ارسال به چاپگر حرارتی',
      }));
    }
  };

  // Start void workflow
  const handleStartVoid = (order: Order) => {
    playPosBeep('click');
    setVoidingOrder(order);
    setVoidReason('اشتباه در ثبت سفارش یا انصراف مشتری');
    setManagerPin('');
    setPinError(null);
  };

  // Confirm void with PIN verification
  const handleConfirmVoid = async () => {
    if (!voidingOrder) return;

    if (!voidReason.trim()) {
      setPinError('لطفاً دلیل ابطال فاکتور را وارد کنید.');
      return;
    }

    setIsVerifyingPin(true);
    setPinError(null);

    try {
      // If user is already MANAGER/OWNER, PIN can be optional or validated
      if (!isUserElevated) {
        if (!managerPin || managerPin.length < 4) {
          setPinError('ورود پین‌کد معتبر مدیر الزامی است.');
          setIsVerifyingPin(false);
          return;
        }

        // Verify PIN against RBAC service
        const authRes = await RBACService.verifyElevationPin(
          managerPin,
          'VOID_DISPATCHED_ORDER',
          activeUser.fullName
        );

        if (!authRes.success) {
          setPinError(authRes.error || 'پین‌کد مدیریت نامعتبر است.');
          playPosBeep('delete');
          setIsVerifyingPin(false);
          return;
        }
      }

      // Execute order cancellation
      SmartOrdersStore.cancelOrder(voidingOrder.id, voidReason);
      if (onOrderCancelled) {
        onOrderCancelled(voidingOrder.id, voidReason);
      }

      playPosBeep('success');
      reloadOrders();
      setVoidingOrder(null);
    } catch (err: any) {
      console.error('[ModendoReceiptHistory] Cancel failed:', err);
      setPinError(err.message || 'خطا در ابطال سفارش');
      playPosBeep('delete');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[88vh] max-h-[90vh] flex flex-col rounded-3xl bg-[#0f141c]/95 border border-white/10 backdrop-blur-2xl shadow-2xl text-right overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0b0e12]/80 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              playPosBeep('click');
              onClose();
            }}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/30 font-bold">
                  MODENDO ARCHIVE
                </span>
                <h2 className="text-base font-black text-white">
                  سابقه فیش‌ها، چاپ مجدد و ابطال (Receipt History)
                </h2>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                جستجوی فاکتورهای تسویه‌شده، چاپ مجدد ۸۰ میلی‌متری و ابطال با پین مدیر
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shadow-inner">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-5 py-3 border-b border-white/10 bg-[#12161D] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با شماره فیش (#MOD-...)، نام میز/PS5 یا مشتری..."
              className="w-full bg-[#0b0e12] border border-white/15 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-[#94A3B8]/60 focus:border-[#10B981] outline-none transition"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#0b0e12] p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => {
                playPosBeep('click');
                setStatusFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-white/[0.15] text-white font-black shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              همه فیش‌ها ({orders.length})
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                setStatusFilter('COMPLETED');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-300 font-black border border-emerald-400/30'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>تسویه‌شده</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                setStatusFilter('CANCELLED');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'CANCELLED'
                  ? 'bg-red-500/20 text-red-300 font-black border border-red-400/30'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Ban className="w-3.5 h-3.5 text-red-400" />
              <span>لغوشده</span>
            </button>
          </div>
        </div>

        {/* Orders List Body */}
        <div className="flex-1 overflow-y-auto p-5 pb-24 space-y-3.5 overscroll-contain">
          {filteredOrders.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-[#94A3B8] space-y-3">
              <FileText className="w-12 h-12 text-[#94A3B8]/30 stroke-1" />
              <p className="text-sm font-bold text-white">هیچ فیشی با مشخصات مورد نظر یافت نشد.</p>
              <p className="text-xs text-[#94A3B8]">
                {orders.length === 0
                  ? 'هنوز فاکتوری در این پایانه ثبت و تسویه نشده است.'
                  : 'عبارت جستجو را تغییر دهید یا فیلتر را پاک کنید.'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const isCancelled = order.status === 'CANCELLED';
              const isPs5 = (order.tableLabel || '').startsWith('PS5');
              const isTakeaway = (order.tableLabel || '').includes('بیرون') || order.orderType === 'TAKEAWAY';

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border transition-all ${
                    isCancelled
                      ? 'bg-red-950/20 border-red-500/20'
                      : 'bg-[#1B222C]/70 hover:bg-[#1B222C]/90 border-white/10'
                  }`}
                >
                  {/* Card Row */}
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    {/* Left: Metadata */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                          isCancelled
                            ? 'bg-red-950/50 border-red-500/30 text-red-400'
                            : isPs5
                            ? 'bg-sky-950/50 border-sky-500/30 text-sky-400'
                            : isTakeaway
                            ? 'bg-amber-950/50 border-amber-500/30 text-amber-400'
                            : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {isPs5 ? (
                          <Gamepad2 className="w-5 h-5" />
                        ) : isTakeaway ? (
                          <ShoppingBag className="w-5 h-5" />
                        ) : (
                          <Coffee className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-white">
                            #MOD-{order.orderNumber}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              isCancelled
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isCancelled ? 'لغوشده (ابطال)' : 'تسویه‌شده'}
                          </span>
                        </div>

                        <div className="text-xs text-[#94A3B8] flex items-center gap-2 mt-1">
                          <span className="font-bold text-white">
                            {order.tableLabel || (isTakeaway ? 'بیرون‌بر' : 'میز آزاد')}
                          </span>
                          {order.customerName && (
                            <>
                              <span>·</span>
                              <span>{order.customerName}</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="font-mono text-[11px]">
                            {new Date(order.createdAt).toLocaleTimeString('fa-IR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-3 mr-auto">
                      <div className="text-left font-mono">
                        <span
                          className={`text-base font-black tabular-nums ${
                            isCancelled ? 'line-through text-red-400/80' : 'text-emerald-300'
                          }`}
                        >
                          {formatToman(order.netTotalToman)}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] mr-1">تومان</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Thermal Reprint Button */}
                        <button
                          type="button"
                          onClick={() => handleReprintReceipt(order)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                          title="چاپ مجدد فیش حرارتی ۸۰ میلی‌متری"
                        >
                          <Printer className="w-3.5 h-3.5 text-cyan-400" />
                          <span>چاپ مجدد</span>
                        </button>

                        {/* PIN-Gated Void Button */}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleStartVoid(order)}
                            className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900 border border-red-700/50 text-red-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                            title="ابطال فاکتور با پین مدیر"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>ابطال فاکتور</span>
                          </button>
                        )}

                        {/* Expand Line Items Toggle */}
                        <button
                          type="button"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg transition cursor-pointer"
                          title="مشاهده ریز اقلام فاکتور"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Banner */}
                  {reprintFeedback[order.id] && (
                    <div className="px-4 py-1.5 bg-cyan-950/40 border-t border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{reprintFeedback[order.id]}</span>
                    </div>
                  )}

                  {/* Expanded Line Items Detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2 text-xs"
                      >
                        <div className="text-[11px] text-[#94A3B8] font-bold">ریز اقلام سفارش:</div>
                        <div className="space-y-1.5 bg-[#0b0e12]/60 rounded-xl p-3 border border-white/5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-emerald-400 font-bold">{item.quantity}×</span>
                                <span className="text-white font-medium">{item.itemNameSnapshot}</span>
                                {item.modifiers && item.modifiers.length > 0 && (
                                  <span className="text-[10px] text-[#94A3B8] bg-white/5 px-2 py-0.5 rounded-full">
                                    {item.modifiers.map((m: any) => (typeof m === 'string' ? m : m.nameFa || m.id)).join('، ')}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-[#cbd5e1]">
                                {formatToman(item.subtotalToman)} ت
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.cancellationReason && (
                          <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-[11px]">
                            <strong>دلیل ابطال:</strong> {order.cancellationReason}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* PIN-Gated Void Confirmation Modal Overlay */}
        {voidingOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#12161D] border border-red-500/30 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-right text-white"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <button
                  type="button"
                  onClick={() => setVoidingOrder(null)}
                  className="p-1 text-[#94A3B8] hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>ابطال فاکتور #MOD-{voidingOrder.orderNumber}</span>
                </div>
              </div>

              <p className="text-xs text-[#94A3B8] leading-relaxed">
                با ابطال این سفارش، فاکتور با وضعیت «لغوشده» بایگانی شده و مبلغ{' '}
                <strong className="text-white font-mono">{formatToman(voidingOrder.netTotalToman)} تومان</strong> از
                تراز درآمدی شیفت کسر خواهد شد.
              </p>

              <div>
                <label className="block text-xs font-bold text-white mb-1">دلیل ابطال فاکتور:</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="مثال: اشتباه در ثبت سفارش یا انصراف مشتری..."
                  className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-red-400 outline-none"
                />
              </div>

              {!isUserElevated && (
                <div>
                  <label className="block text-xs font-bold text-white mb-1 flex items-center justify-between">
                    <span>پین‌کد مدیریت / مالک کافه:</span>
                    <span className="text-[10px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>تأیید مجوز الزامی است</span>
                    </span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:border-red-400 outline-none"
                  />
                </div>
              )}

              {pinError && (
                <div className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-500/20">
                  {pinError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidingOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVoid}
                  disabled={isVerifyingPin}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" />
                  <span>تأیید نهایی و ابطال</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
