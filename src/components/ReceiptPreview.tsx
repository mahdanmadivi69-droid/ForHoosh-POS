import React from 'react';
import { Dialog, Portal } from '@ark-ui/react';
import { Printer, X, CheckCircle, Coffee, ShieldCheck } from 'lucide-react';
import { Order, Payment } from '../types/domain';
import { formatToman } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';
import { printThermalReceipt } from '../services/receiptPrinter';

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
  tenantName = 'قهوه‌فروشی صَد هیچ (100 HICH Coffee Roasters)',
  tenantPhone = '۰۲۱-۴۴۶۶۸۰۹۰',
  tenantAddress = 'اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت باکس',
  cashTendered,
  changeToman,
  onClose,
}) => {
  const handlePrint = () => {
    playPosBeep('click');
    window.print();
  };

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString('fa-IR');
  const formattedTime = orderDate.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md transition-opacity duration-200 print:hidden" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto print:p-0 print:static print:inset-auto">
          <Dialog.Content className="bg-[#1B222C] border border-[#293444] rounded-2xl max-w-sm w-full p-4 shadow-2xl flex flex-col gap-3 focus:outline-none print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:bg-white animate-fadeIn select-none">
            {/* Actions Bar (Hidden during print) */}
            <div className="flex items-center justify-between pb-2 border-b border-[#293444] print:hidden">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <CheckCircle className="w-4 h-4" />
                <span>فاکتور با موفقیت تسویه و ثبت شد</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onClose();
                }}
                className="text-[#9EACB8] hover:text-white p-1 rounded-lg"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Authentic 80mm Thermal Paper Ticket */}
            <div
              id="printable-receipt"
              className="receipt-paper rounded-xl p-4 md:p-5 flex flex-col justify-between text-xs border border-gray-300 shadow-xl print:rounded-none print:border-none print:p-2 print:shadow-none"
              style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}
            >
              {/* Receipt Header */}
              <div className="text-center pb-2.5 border-b-2 border-dashed border-gray-400">
                <h4 className="font-black text-xl tracking-tight text-black">100 HICH</h4>
                <p className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest">
                  COFFEE ROASTERS
                </p>
                <p className="text-[9px] text-gray-600 mt-1 leading-tight font-medium">
                  {tenantAddress}
                </p>
                <p className="text-[9px] text-gray-600 font-mono mt-0.5">تلفن: {tenantPhone}</p>
              </div>

              {/* Receipt Meta */}
              <div className="py-2.5 border-b border-dashed border-gray-300 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">شماره فاکتور:</span>
                  <span className="font-mono font-black text-black">
                    #{order.orderNumber || 1048}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">تاریخ و ساعت:</span>
                  <span className="font-mono text-gray-800">
                    {formattedDate} - {formattedTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">نوع سفارش:</span>
                  <span className="font-bold text-black">
                    {order.orderType === 'DINE_IN'
                      ? `سالن (${order.tableLabel || 'میز'})`
                      : 'بیرون‌بر (Takeaway)'}
                  </span>
                </div>
                {order.customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">مشتری:</span>
                    <span className="font-bold text-black">{order.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>صندوق‌دار / باریستا:</span>
                  <span>{order.createdByUserName}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-2.5 border-b-2 border-dashed border-gray-400">
                <table className="w-full text-right text-[10px]">
                  <thead>
                    <tr className="text-gray-600 border-b border-gray-200">
                      <th className="pb-1 text-right font-bold">شرح کالا</th>
                      <th className="pb-1 text-center font-bold">تعداد</th>
                      <th className="pb-1 text-left font-bold">مبلغ (تومان)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.items.map((item, idx) => (
                      <tr key={idx} className="py-1">
                        <td className="py-1 text-right font-medium text-black">
                          <div>{item.itemNameSnapshot}</div>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="text-[8px] text-gray-500 leading-tight">
                              {item.modifiers.map((m) => m.nameFa).join('، ')}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[8px] text-gray-500 italic">*{item.notes}</div>
                          )}
                        </td>
                        <td className="py-1 text-center font-bold font-mono text-black">
                          {item.quantity}×
                        </td>
                        <td className="py-1 text-left font-mono font-bold text-black num-heavy">
                          {formatToman(item.subtotalToman, false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Financial Breakdown */}
              <div className="py-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-700">
                  <span>جمع اقلام:</span>
                  <span className="font-bold font-mono num-heavy">
                    {formatToman(order.grossAmountToman, false)}
                  </span>
                </div>
                {order.discountAmountToman > 0 && (
                  <div className="flex justify-between text-red-700 font-semibold">
                    <span>کسر تخفیف:</span>
                    <span className="font-bold font-mono num-heavy">
                      -{formatToman(order.discountAmountToman, false)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1.5 border-t border-black text-black">
                  <span>مبلغ نهایی فاکتور:</span>
                  <span className="font-mono text-base num-heavy">
                    {formatToman(order.netTotalToman, false)} تومان
                  </span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="py-2 border-t border-dashed border-gray-300 text-[10px] space-y-0.5 text-gray-700">
                <div className="flex justify-between">
                  <span>روش تسویه:</span>
                  <span className="font-bold text-black">
                    {payment?.paymentMethod === 'CASH'
                      ? 'وجه نقد (اسکناس)'
                      : payment?.paymentMethod === 'CARD_MANUAL'
                      ? payment.terminalName || 'کارتخوان بانکی'
                      : 'کارتخوان بانکی'}
                  </span>
                </div>
                {payment?.referenceCode && (
                  <div className="flex justify-between font-mono" dir="ltr">
                    <span dir="rtl">شماره پیگیری (RRN):</span>
                    <span className="font-bold text-black">{payment.referenceCode}</span>
                  </div>
                )}
                {cashTendered !== undefined && cashTendered > 0 && (
                  <div className="flex justify-between">
                    <span>مبلغ نقد دریافتی:</span>
                    <span className="font-mono">{formatToman(cashTendered, false)} تومان</span>
                  </div>
                )}
                {changeToman !== undefined && changeToman > 0 && (
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>باقیمانده بازگردانده شده:</span>
                    <span className="font-mono">{formatToman(changeToman, false)} تومان</span>
                  </div>
                )}
              </div>

              {/* Barcode simulation & 100 Hich Slogan */}
              <div className="pt-3 text-center border-t border-gray-200">
                <div className="inline-block py-1 px-3 bg-gray-200 rounded font-mono text-[9px] tracking-widest text-black mb-1">
                  ||| | ||||| |||| || | |||| ||
                </div>
                <p className="text-[9px] font-extrabold text-gray-800">
                  «صد هیچ؛ تمرکز محض روی اصالت قهوه»
                </p>
                <p className="text-[8px] text-gray-500 mt-0.5">از خرید شما سپاسگزاریم • 100HICH.IR</p>
              </div>
            </div>

            {/* Bottom Print & New Order Action Bar (Hidden in print) */}
            <div className="flex items-center gap-2 pt-1 print:hidden">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onClose();
                }}
                className="flex-1 bg-[#121417] hover:bg-[#222B38] text-white border border-[#293444] py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                سفارش جدید
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-2 bg-[#D71921] hover:bg-[#B8141B] text-white py-2.5 rounded-xl text-xs font-black shadow-[0_0_15px_-3px_rgba(215,25,33,0.45)] transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>پرینت مستقیم فیش (۸۰ میلی‌متری)</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
