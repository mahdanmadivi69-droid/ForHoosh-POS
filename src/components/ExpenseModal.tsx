import React, { useState } from 'react';
import { DollarSign, X, Check, AlertCircle } from 'lucide-react';
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
  const [isPaidFromCashDrawer, setIsPaidFromCashDrawer] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-stone-100 text-base">ثبت هزینه تنخواه شیفت جاری</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

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
              className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-200 focus:outline-none focus:border-amber-500"
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
              className="bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 font-bold text-center text-sm focus:outline-none focus:border-amber-500"
              required
            />
            <span className="text-[11px] text-amber-400 text-center">
              معادل: {formatToman(amountToman)} تومان
            </span>
          </div>

          <div className="flex items-center gap-2 bg-stone-950 p-3 rounded-xl border border-stone-800">
            <input
              type="checkbox"
              id="cashDrawerCheck"
              checked={isPaidFromCashDrawer}
              onChange={(e) => setIsPaidFromCashDrawer(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-0 bg-stone-800 border-stone-700"
            />
            <label htmlFor="cashDrawerCheck" className="text-stone-200 cursor-pointer select-none">
              پرداخت از کشوی نقد صندوق (از نقدینگی شیفت کسر شود)
            </label>
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
              className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-xl font-medium"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl font-bold shadow transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>ثبت هزینه</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
