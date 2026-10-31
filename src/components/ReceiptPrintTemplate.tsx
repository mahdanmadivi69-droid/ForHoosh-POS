import React from "react";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  modifiers?: string[];
  notes?: string;
}

export interface ReceiptOrderData {
  invoiceNo: string | number;
  dateTime: string;
  orderType: string;
  cashier: string;
  customerName?: string;
  tableLabel?: string;
  items: ReceiptItem[];
  subtotalAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: string;
  referenceCode?: string;
  cashTendered?: number;
  changeDue?: number;
}

export interface ReceiptPrintTemplateProps {
  order: ReceiptOrderData;
  tenantName?: string;
  tenantAddress?: string;
  tenantPhone?: string;
}

export const ReceiptPrintTemplate: React.FC<ReceiptPrintTemplateProps> = ({
  order,
  tenantAddress = "اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت باکس",
  tenantPhone = "۰۲۱-۴۴۶۶۸۰۹۰",
}) => {
  return (
    <div
      id="pos-thermal-receipt"
      className="thermal-receipt-container w-[80mm] max-w-[80mm] p-2 bg-white text-black font-sans text-xs leading-tight select-none mx-auto"
      style={{
        width: "80mm",
        maxWidth: "80mm",
        boxSizing: "border-box",
        padding: "4mm 2mm",
        backgroundColor: "#ffffff",
        color: "#000000",
        fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif",
      }}
      dir="rtl"
    >
      {/* Brand Header */}
      <div className="text-center space-y-1 mb-2">
        <h1 className="text-xl font-black tracking-wider text-black m-0 p-0">100 HICH</h1>
        <p className="text-xs font-bold tracking-widest text-gray-800 m-0 uppercase">COFFEE ROASTERS</p>
        <p className="text-[10px] text-gray-700 m-0 leading-tight">{tenantAddress}</p>
        <p className="text-[10px] text-gray-700 m-0 font-mono">تلفن: {tenantPhone}</p>
      </div>

      <div className="border-b border-dashed border-gray-400 my-2" style={{ borderBottom: "1px dashed #666" }} />

      {/* Metadata */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between font-bold text-black">
          <span>شماره فاکتور:</span>
          <span className="font-mono">#{order.invoiceNo}</span>
        </div>
        <div className="flex justify-between text-gray-800">
          <span>تاریخ و ساعت:</span>
          <span>{order.dateTime}</span>
        </div>
        <div className="flex justify-between text-black">
          <span>نوع سفارش:</span>
          <span className="font-bold">{order.orderType}</span>
        </div>
        {order.customerName && (
          <div className="flex justify-between text-black">
            <span>مشتری:</span>
            <span className="font-bold">{order.customerName}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-700">
          <span>صندوقدار / باریستا:</span>
          <span>{order.cashier || "مهدان مددی - مدیر و مالک"}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-gray-400 my-2" style={{ borderBottom: "1px dashed #666" }} />

      {/* Items Table */}
      <table className="w-full text-right text-[11px]" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr className="border-b border-gray-300 text-gray-700" style={{ borderBottom: "1px solid #ccc" }}>
            <th className="py-1 text-right font-bold">شرح کالا</th>
            <th className="py-1 text-center font-bold">تعداد</th>
            <th className="py-1 text-left font-bold">مبلغ (تومان)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {order.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
              <td className="py-1 font-semibold text-black">
                <div>{item.name}</div>
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="text-[8px] text-gray-500">{item.modifiers.join("، ")}</div>
                )}
                {item.notes && <div className="text-[8px] text-gray-500 italic">*{item.notes}</div>}
              </td>
              <td className="py-1 text-center font-bold font-mono text-black">{item.qty}×</td>
              <td className="py-1 text-left font-mono font-bold text-black">
                {item.price.toLocaleString("fa-IR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-b border-dashed border-gray-400 my-2" style={{ borderBottom: "1px dashed #666" }} />

      {/* Totals */}
      <div className="space-y-1 text-xs text-gray-800">
        <div className="flex justify-between">
          <span>جمع اقلام:</span>
          <span className="font-semibold font-mono">
            {(order.subtotalAmount ?? order.totalAmount).toLocaleString("fa-IR")} تومان
          </span>
        </div>
        {order.discountAmount !== undefined && order.discountAmount > 0 && (
          <div className="flex justify-between text-red-700">
            <span>کسر تخفیف:</span>
            <span className="font-semibold font-mono">
              -{order.discountAmount.toLocaleString("fa-IR")} تومان
            </span>
          </div>
        )}
        <div
          className="flex justify-between text-sm font-black pt-1 text-black"
          style={{ borderTop: "1px solid #000", marginTop: "4px" }}
        >
          <span>مبلغ نهایی فاکتور:</span>
          <span className="font-mono">{order.totalAmount.toLocaleString("fa-IR")} تومان</span>
        </div>
      </div>

      <div className="border-b border-dashed border-gray-400 my-2" style={{ borderBottom: "1px dashed #666" }} />

      {/* Payment Method */}
      <div className="space-y-0.5 text-[11px] text-gray-800">
        <div className="flex justify-between font-bold text-black">
          <span>روش تسویه:</span>
          <span>{order.paymentMethod}</span>
        </div>
        {order.referenceCode && (
          <div className="flex justify-between font-mono" dir="ltr">
            <span dir="rtl">شماره پیگیری (RRN):</span>
            <span className="font-bold text-black">{order.referenceCode}</span>
          </div>
        )}
        {order.cashTendered !== undefined && order.cashTendered > 0 && (
          <div className="flex justify-between">
            <span>مبلغ دریافتی:</span>
            <span className="font-mono">{order.cashTendered.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        {order.changeDue !== undefined && order.changeDue > 0 && (
          <div className="flex justify-between font-bold text-emerald-800">
            <span>باقیمانده بازگردانده شده:</span>
            <span className="font-mono">{order.changeDue.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
      </div>

      {/* Barcode & Footer */}
      <div className="text-center mt-3 space-y-1 pt-2" style={{ borderTop: "1px solid #ddd" }}>
        <div className="text-base tracking-[0.25em] font-mono select-none">||| | ||||| |||| || | |||| ||</div>
        <p className="text-[10px] font-bold mt-1 text-black">«صد هیچ؛ تمرکز محض روی اصالت قهوه»</p>
        <p className="text-[9px] text-gray-600">از خرید شما سپاسگزاریم • 100HICH.IR</p>
      </div>
    </div>
  );
};

export function renderReceiptTemplateHtml(
  order: ReceiptOrderData,
  tenantInfo: { address?: string; phone?: string } = {}
): string {
  const address = tenantInfo.address || "اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت باکس";
  const phone = tenantInfo.phone || "۰۲۱-۴۴۶۶۸۰۹۰";
  const cashier = order.cashier || "مهدان مددی - مدیر و مالک";
  const subtotal = (order.subtotalAmount ?? order.totalAmount).toLocaleString("fa-IR");
  const total = order.totalAmount.toLocaleString("fa-IR");

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #000;">
          <div>${item.name}</div>
          ${item.modifiers && item.modifiers.length > 0 ? `<div style="font-size: 8px; color: #666;">${item.modifiers.join("، ")}</div>` : ""}
          ${item.notes ? `<div style="font-size: 8px; color: #666; font-style: italic;">*${item.notes}</div>` : ""}
        </td>
        <td style="padding: 4px 0; text-align: center; font-weight: 700; font-family: monospace; color: #000;">${item.qty}×</td>
        <td style="padding: 4px 0; text-align: left; font-family: monospace; font-weight: 700; color: #000;">${item.price.toLocaleString("fa-IR")}</td>
      </tr>
    `
    )
    .join("");

  return `
    <div
      id="pos-thermal-receipt"
      class="thermal-receipt-container"
      dir="rtl"
      style="width: 80mm; max-width: 80mm; box-sizing: border-box; padding: 4mm 2mm; background: #ffffff; color: #000000; font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.35; margin: 0 auto; text-align: right;"
    >
      <div style="text-align: center; margin-bottom: 8px;">
        <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 1px; margin: 0 0 2px 0; color: #000;">100 HICH</h1>
        <p style="font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 0 0 4px 0; text-transform: uppercase; color: #333;">COFFEE ROASTERS</p>
        <p style="font-size: 10px; color: #444; margin: 0 0 2px 0;">${address}</p>
        <p style="font-size: 10px; color: #444; margin: 0; font-family: monospace;">تلفن: ${phone}</p>
      </div>

      <div style="border-bottom: 1px dashed #666; margin: 8px 0;"></div>

      <div style="font-size: 11px; line-height: 1.5;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>شماره فاکتور:</span>
          <span style="font-family: monospace;">#${order.invoiceNo}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #333;">
          <span>تاریخ و ساعت:</span>
          <span>${order.dateTime}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>نوع سفارش:</span>
          <span style="font-weight: 700;">${order.orderType}</span>
        </div>
        ${order.customerName ? `
        <div style="display: flex; justify-content: space-between;">
          <span>مشتری:</span>
          <span style="font-weight: 700;">${order.customerName}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; color: #444;">
          <span>صندوقدار / باریستا:</span>
          <span>${cashier}</span>
        </div>
      </div>

      <div style="border-bottom: 1px dashed #666; margin: 8px 0;"></div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 1px solid #ccc; color: #444;">
            <th style="padding: 4px 0; text-align: right; font-weight: 700;">شرح کالا</th>
            <th style="padding: 4px 0; text-align: center; font-weight: 700;">تعداد</th>
            <th style="padding: 4px 0; text-align: left; font-weight: 700;">مبلغ (تومان)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-bottom: 1px dashed #666; margin: 8px 0;"></div>

      <div style="font-size: 12px; line-height: 1.5; color: #333;">
        <div style="display: flex; justify-content: space-between;">
          <span>جمع اقلام:</span>
          <span style="font-family: monospace; font-weight: 600;">${subtotal} تومان</span>
        </div>
        ${order.discountAmount && order.discountAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; color: #b91c1c;">
          <span>کسر تخفیف:</span>
          <span style="font-family: monospace; font-weight: 600;">-${order.discountAmount.toLocaleString("fa-IR")} تومان</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #000; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
          <span>مبلغ نهایی فاکتور:</span>
          <span style="font-family: monospace;">${total} تومان</span>
        </div>
      </div>

      <div style="border-bottom: 1px dashed #666; margin: 8px 0;"></div>

      <div style="font-size: 11px; line-height: 1.5; color: #333;">
        <div style="display: flex; justify-content: space-between; font-weight: 700; color: #000;">
          <span>روش تسویه:</span>
          <span>${order.paymentMethod}</span>
        </div>
        ${order.referenceCode ? `
        <div style="display: flex; justify-content: space-between; font-family: monospace;" dir="ltr">
          <span dir="rtl">شماره پیگیری (RRN):</span>
          <span style="font-weight: 700; color: #000;">${order.referenceCode}</span>
        </div>` : ""}
        ${order.cashTendered && order.cashTendered > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>مبلغ دریافتی:</span>
          <span style="font-family: monospace;">${order.cashTendered.toLocaleString("fa-IR")} تومان</span>
        </div>` : ""}
        ${order.changeDue && order.changeDue > 0 ? `
        <div style="display: flex; justify-content: space-between; font-weight: 700; color: #065f46;">
          <span>باقیمانده بازگردانده شده:</span>
          <span style="font-family: monospace;">${order.changeDue.toLocaleString("fa-IR")} تومان</span>
        </div>` : ""}
      </div>

      <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid #ddd;">
        <div style="font-size: 15px; letter-spacing: 0.25em; font-family: monospace; user-select: none;">||| | ||||| |||| || | |||| ||</div>
        <p style="font-size: 10px; font-weight: 700; margin: 4px 0 2px 0; color: #000;">«صد هیچ؛ تمرکز محض روی اصالت قهوه»</p>
        <p style="font-size: 9px; color: #666; margin: 0;">از خرید شما سپاسگزاریم • 100HICH.IR</p>
      </div>
    </div>
  `;
}

export default ReceiptPrintTemplate;
