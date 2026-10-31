import React, { useState } from 'react';
import { Dialog, Portal } from '@ark-ui/react';
import { ShieldAlert, KeyRound, AlertTriangle, X, Check, FileText } from 'lucide-react';
import { OrderService } from '../services/orderService';
import { playPosBeep } from '../services/soundEffects';

export interface OrderActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: number;
  actionType: 'void' | 'edit_items' | 'apply_discount';
  userId?: string;
  onSuccess?: () => void;
  correctPin?: string;
}

export const OrderActionModal: React.FC<OrderActionModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  actionType,
  userId = 'manager-1',
  onSuccess,
  correctPin = '1234',
}) => {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPin('');
    setReason('');
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. PIN verification
    if (pin.trim() !== correctPin) {
      playPosBeep('delete');
      setError('کد پین مدیر نامعتبر است (پیش‌فرض: ۱۲۳۴).');
      return;
    }

    // 2. Reason verification
    if (!reason.trim()) {
      playPosBeep('delete');
      setError('وارد کردن دلیل برای ثبت در گزارش حسابرسی و لاگ امنیتی الزامی است.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (actionType === 'void') {
        await OrderService.voidOrder(orderId, userId, reason.trim());
      }
      playPosBeep('success');
      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      playPosBeep('delete');
      setError(err?.message || 'خطا در اعمال عملیات روی سفارش.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleText =
    actionType === 'void'
      ? `ابطال رسمی سفارش #${orderNumber}`
      : actionType === 'apply_discount'
      ? `اعمال تخفیف مدیریتی برای سفارش #${orderNumber}`
      : `مجوز ویرایش اقلام سفارش #${orderNumber}`;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) handleClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm transition-opacity duration-200" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-[#1B222C] border border-[#293444] rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 text-white focus:outline-none animate-fadeIn select-none">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#293444]">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>{titleText}</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-[#9EACB8] hover:text-white p-1 rounded-lg cursor-pointer"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="p-3 bg-[#121417] rounded-xl border border-[#293444] text-xs text-[#9EACB8] space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>عملیات نیازمند مجوز مدیریت و بازگشت انبار است</span>
                </div>
                <p className="leading-relaxed">
                  با ثبت این عملیات، مواد اولیه مصرفی (BOM) به انبار بازگردانده شده و تراکنش با شناسه مدیر ثبت می‌شود.
                </p>
              </div>

              {/* Manager PIN Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#F3E9DD] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>کد پین مدیر (Manager PIN):</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="۱۲۳۴"
                  className="bg-[#121417] border border-[#293444] rounded-xl px-3.5 py-2.5 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-[#D71921] transition"
                  autoFocus
                />
              </div>

              {/* Mandatory Reason Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#F3E9DD] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>دلیل اجباری عملیات:</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثلاً: انصراف مشتری، تغییر نوشیدنی، اشتباه صندوق‌دار..."
                  className="bg-[#121417] border border-[#293444] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#D71921] transition resize-none placeholder:text-[#9EACB8]/50"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-rose-400 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg flex items-center gap-1.5 font-medium animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#293444]">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 bg-[#121417] hover:bg-[#222B38] text-[#9EACB8] hover:text-white border border-[#293444] py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 bg-[#D71921] hover:bg-[#B8141B] disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-black shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{actionType === 'void' ? 'تأیید ابطال فاکتور' : 'تأیید و اعمال عملیات'}</span>
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default OrderActionModal;
