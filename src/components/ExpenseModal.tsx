import React, { useState } from 'react';
import { Dialog, Portal, SegmentGroup } from '@ark-ui/react';
import { DollarSign, X, Check, AlertCircle, Banknote, CreditCard } from 'lucide-react';
import { Shift, User, Expense } from '../types/domain';
import { formatToman, safeInt } from '../services/financialMath';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: Shift | null;
  activeUser: User;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
}

const EXPENSE_CATEGORIES = [
  'خرید روزمره (شیر، خامه و لبنیات)',
  'خرید میوه و سبزیجات تازه',
  'ملزومات و ظروف یکبارمصرف',
  'کرایه پیک و حمل‌ونقل',
  'تعمیرات جزئی و تجهیزات',
  'شوینده و بهداشتی',
  'متفرقه و اضطراری',
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  activeUser,
  onSaveExpense,
}) => {
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amountToman, setAmountToman] = useState<number>(50000);
  const [paymentSource, setPaymentSource] = useState<'DRAWER' | 'BANK'>('DRAWER');
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const isPaidFromCashDrawer = paymentSource === 'DRAWER';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      setErrorMsg('برای ثبت هزینه، ابتدا باید یک شیفت کاری فعال باز باشد.');
      return;
    }
    if (amountToman <= 0) {
      setErrorMsg('مبلغ هزینه باید بزرگتر از صفر باشد.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('درج شرح دقیق هزینه الزامی است.');
      return;
    }

    onSaveExpense({
      tenantId: activeShift.tenantId,
      shiftId: activeShift.id,
      recordedByUserId: activeUser.id,
      recordedByUserName: activeUser.fullName,
      category,
      amountToman,
      isPaidFromCashDrawer,
      description: description.trim(),
    });

    onClose();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs transition-opacity duration-200" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-xs focus:outline-none animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-rose-500" />
                <Dialog.Title className="font-bold text-stone-100 text-base">
                  ثبت هزینه تنخواه شیفت جاری
                </Dialog.Title>
              </div>
              <Dialog.CloseTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-stone-400 hover:text-stone-200 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.CloseTrigger>
            </div>

            <Dialog.Description className="text-stone-400 text-[11px]">
              هزینه‌های تنخواه ثبت‌شده مستقیماً در مغایرت نقدینگی و سود خالص شیفت محاسبه می‌شوند.
            </Dialog.Description>

            {errorMsg && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-300 p-2.5 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">دسته‌بندی هزینه:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">مبلغ پرداختی (تومان):</label>
                <input
                  type="number"
                  step="5000"
                  min="1000"
                  value={amountToman || ''}
                  onChange={(e) => {
                    setErrorMsg('');
                    setAmountToman(safeInt(e.target.value));
                  }}
                  placeholder="مثلاً: ۶۵,۰۰۰"
                  className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 font-bold text-center text-sm focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
                <span className="text-[11px] text-amber-400 text-center font-mono">
                  معادل: {formatToman(amountToman)} تومان
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">منبع تسویه هزینه:</label>
                <SegmentGroup.Root
                  value={paymentSource}
                  onValueChange={(details) => {
                    if (details.value) setPaymentSource(details.value as any);
                  }}
                  className="grid grid-cols-2 gap-2 bg-stone-950 p-1 rounded-xl border border-stone-800"
                >
                  <SegmentGroup.Item
                    value="DRAWER"
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition select-none ${
                      paymentSource === 'DRAWER'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 shrink-0" />
                    <SegmentGroup.ItemText>کسر از نقد صندوق</SegmentGroup.ItemText>
                    <SegmentGroup.ItemControl />
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>

                  <SegmentGroup.Item
                    value="BANK"
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition select-none ${
                      paymentSource === 'BANK'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <SegmentGroup.ItemText>کارت بانکی کافه</SegmentGroup.ItemText>
                    <SegmentGroup.ItemControl />
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </SegmentGroup.Root>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-stone-300 font-medium">شرح دقیق و فاکتور خرید:</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setErrorMsg('');
                    setDescription(e.target.value);
                  }}
                  rows={2}
                  placeholder="مثلاً: خرید ۲ بطری شیر پرچرب کاله از سوپر محله"
                  className="bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl font-medium cursor-pointer transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>ثبت هزینه</span>
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
