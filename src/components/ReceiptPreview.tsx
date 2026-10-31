import React from 'react';
import { Dialog, Portal } from '@ark-ui/react';
import { Printer, X, CheckCircle } from 'lucide-react';
import { Order, Payment } from '../types/domain';
import { playPosBeep } from '../services/soundEffects';
import { printThermalReceipt } from '../services/receiptPrinter';
import { ReceiptPrintTemplate, ReceiptOrderData } from './ReceiptPrintTemplate';

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
  tenantName = '100 HICH COFFEE ROASTERS',
  tenantPhone = '۰۲۱-۴۴۶۶۸۰۹۰',
  tenantAddress = 'اکباتان فاز ۱ بازارچه ۱۰ جنب پیتزا پیت‌باکس',
  cashTendered,
  changeToman,
  onClose,
}) => {
  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString('fa-IR');
  const formattedTime = orderDate.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const cashierDisplay =
    order.createdByUserName && order.createdByUserName !== 'مدیر سیستم'
      ? order.createdByUserName
      : 'مهدان مددی - مدیر و مالک';

  const orderTypeDisplay =
    order.orderType === 'DINE_IN'
      ? `سالن (${order.tableLabel || 'میز'})`
      : 'بیرون‌بر / Takeaway';

  const settlementDisplay =
    payment?.paymentMethod === 'CASH'
      ? 'نقدی'
      : payment?.terminalName || 'پوز ۱ بانک سامان';

  const orderData: ReceiptOrderData = {
    invoiceNo: order.orderNumber || 5,
    dateTime: `${formattedDate} - ${formattedTime}`,
    orderType: orderTypeDisplay,
    cashier: cashierDisplay,
    customerName: order.customerName,
    tableLabel: order.tableLabel,
    items: order.items.map((i) => ({
      name: i.itemNameSnapshot,
      qty: i.quantity,
      price: i.subtotalToman,
      modifiers: i.modifiers?.map((m) => m.nameFa),
      notes: i.notes,
    })),
    subtotalAmount: order.grossAmountToman,
    discountAmount: order.discountAmountToman,
    totalAmount: order.netTotalToman,
    paymentMethod: settlementDisplay,
    referenceCode: payment?.referenceCode,
    cashTendered,
    changeDue: changeToman,
  };

  const handlePrint = () => {
    playPosBeep('click');
    printThermalReceipt(orderData, {
      documentTitle: `رسید فاکتور #${order.orderNumber || 5} - ${tenantName}`,
      tenantAddress,
      tenantPhone,
    });
  };

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
                className="text-[#9EACB8] hover:text-white p-1 rounded-lg cursor-pointer"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Authentic 80mm Thermal Paper Ticket Preview */}
            <div
              id="thermal-receipt"
              className="receipt-paper rounded-xl p-2 flex flex-col justify-between text-xs border border-gray-300 shadow-xl bg-white text-black overflow-hidden print:rounded-none print:border-none print:p-0 print:shadow-none"
              style={{ width: '100%', maxWidth: '80mm', margin: '0 auto' }}
            >
              <ReceiptPrintTemplate
                order={orderData}
                tenantName={tenantName}
                tenantAddress={tenantAddress}
                tenantPhone={tenantPhone}
              />
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

export default ReceiptPreview;
