import React from 'react';
import { Printer, X, CheckCircle, Coffee, ShieldCheck } from 'lucide-react';
import { Order, Payment } from '../types/domain';
import { formatToman } from '../services/financialMath';

interface ReceiptPreviewProps {
  order: Order;
  payment?: Payment | null;
  tenantName?: string;
  tenantPhone?: string;
  tenantAddress?: string;
  cashTendered?: number;
  changeToman?: number;
  onClose: () => void;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  order,
  payment,
  tenantName = 'کافه نارنج (Naranj Coffee)',
  tenantPhone = '۰۲۱-۸۸۹۹۷۷۶۶',
  tenantAddress = 'تهران، خیابان ولیعصر، بالاتر از توانیر',
  cashTendered,
  changeToman,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString('fa-IR');
  const formattedTime = orderDate.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container - Styled as thermal receipt (80mm width standard) */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-sm w-full p-4 shadow-2xl flex flex-col gap-3 print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:bg-white">
        
        {/* Actions bar (Hidden in print) */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-800 print:hidden">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>سفارش با موفقیت ثبت و تسویه شد</span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1 rounded-lg"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Printable Paper Ticket */}
        <div
          id="printable-receipt"
          className="bg-white text-stone-900 p-5 rounded-2xl shadow-inner font-sans text-xs border border-stone-200 flex flex-col gap-2.5 print:rounded-none print:border-none print:p-2 print:shadow-none"
          style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}
        >
          {/* Header Brand */}
          <div className="text-center pb-2 border-b border-dashed border-stone-300">
            <div className="flex justify-center mb-1">
              <Coffee className="w-5 h-5 text-stone-900" />
            </div>
            <h2 className="font-extrabold text-base tracking-tight text-stone-900">{tenantName}</h2>
            {tenantPhone && (
              <p className="text-[10px] text-stone-600 mt-0.5 font-mono" dir="ltr">
                تلفن: {tenantPhone}
              </p>
            )}
            {tenantAddress && (
              <p className="text-[9px] text-stone-500 mt-0.5 leading-tight">{tenantAddress}</p>
            )}
          </div>

          {/* Order Meta Info */}
          <div className="flex flex-col gap-1 text-[11px] text-stone-700 pb-1.5 border-b border-stone-200">
            <div className="flex justify-between items-center font-bold">
              <span>فاکتور شماره:</span>
              <span className="font-mono text-xs text-stone-900">#{order.orderNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>تاریخ و ساعت:</span>
              <span className="font-mono text-[10px] text-stone-800">
                {formattedDate} - {formattedTime}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>نوع سفارش:</span>
              <span className="font-semibold text-stone-900">
                {order.orderType === 'DINE_IN' ? `سالن (${order.tableLabel || 'میز'})` : 'بیرون‌بر'}
              </span>
            </div>
            {order.customerName && (
              <div className="flex justify-between items-center">
                <span>مشتری:</span>
                <span className="font-semibold">{order.customerName}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[10px] text-stone-600">
              <span>صندوق‌دار:</span>
              <span>{order.createdByUserName}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex flex-col gap-1.5 py-1 border-b border-stone-200">
            <div className="flex justify-between font-bold text-[10px] text-stone-500 pb-1 border-b border-stone-100">
              <span className="w-1/2">شرح کالا</span>
              <span className="w-1/4 text-center">تعداد</span>
              <span className="w-1/4 text-left">مبلغ (تومان)</span>
            </div>

            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[11px] text-stone-800 leading-snug">
                <span className="w-1/2 font-medium">{item.itemNameSnapshot}</span>
                <span className="w-1/4 text-center font-mono">{item.quantity}×</span>
                <span className="w-1/4 text-left font-mono font-semibold">
                  {formatToman(item.subtotalToman, false)}
                </span>
              </div>
            ))}
          </div>

          {/* Financial Calculation Summary */}
          <div className="flex flex-col gap-1 text-[11px] pt-1 border-b border-stone-200 pb-2">
            <div className="flex justify-between text-stone-600">
              <span>جمع ناخالص:</span>
              <span className="font-mono">{formatToman(order.grossAmountToman, false)} تومان</span>
            </div>
            {order.discountAmountToman > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>تخفیف:</span>
                <span className="font-mono">- {formatToman(order.discountAmountToman, false)} تومان</span>
              </div>
            )}
            <div className="flex justify-between text-stone-950 font-black text-sm pt-1 border-t border-dashed border-stone-300">
              <span>مبلغ پرداختی نهایی:</span>
              <span className="font-mono text-base">{formatToman(order.netTotalToman, false)} تومان</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="flex flex-col gap-0.5 text-[10px] text-stone-700 bg-stone-50 p-2 rounded-lg border border-stone-200">
            <div className="flex justify-between font-semibold">
              <span>روش تسویه:</span>
              <span>
                {payment?.paymentMethod === 'CASH'
                  ? 'وجه نقد (اسکناس)'
                  : payment?.paymentMethod === 'CARD_MANUAL'
                  ? 'کارتخوان بانکی (POS)'
                  : 'سایر'}
              </span>
            </div>
            {payment?.terminalName && (
              <div className="flex justify-between text-[9px] text-stone-500">
                <span>دستگاه پایانه:</span>
                <span>{payment.terminalName}</span>
              </div>
            )}
            {payment?.referenceCode && (
              <div className="flex justify-between text-[9px] text-stone-500 font-mono" dir="ltr">
                <span dir="rtl">شماره پیگیری:</span>
                <span>{payment.referenceCode}</span>
              </div>
            )}
            {cashTendered !== undefined && cashTendered > 0 && (
              <div className="flex justify-between pt-0.5 text-stone-600">
                <span>مبلغ نقد دریافتی:</span>
                <span className="font-mono">{formatToman(cashTendered, false)} تومان</span>
              </div>
            )}
            {changeToman !== undefined && changeToman > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>باقیمانده بازگردانده شده:</span>
                <span className="font-mono">{formatToman(changeToman, false)} تومان</span>
              </div>
            )}
          </div>

          {/* Footer message and bar */}
          <div className="text-center pt-2 text-[9px] text-stone-500 flex flex-col gap-1">
            <span>با سپاس از همراهی شما، روز خوش!</span>
            <div className="flex items-center justify-center gap-1 text-[8px] text-stone-400 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>SmartOrders POS System</span>
            </div>
          </div>
        </div>

        {/* Bottom Buttons Bar (Hidden in print) */}
        <div className="flex items-center gap-2 pt-1 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            سفارش جدید
          </button>
          <button
            onClick={handlePrint}
            className="flex-2 bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ فیش (Print Receipt)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
