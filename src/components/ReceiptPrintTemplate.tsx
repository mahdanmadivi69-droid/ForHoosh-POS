import React from "react";
import { escapeHtml } from "../lib/escapeHtml";
import { getActiveTenant } from "../config/tenantConfig";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  modifiers?: string[];
  notes?: string;
}

export interface ReceiptOrderData {
  invoiceNo: string | number;
  tenantId?: string;
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
  notes?: string;
}

export interface ReceiptPrintTemplateProps {
  order: ReceiptOrderData;
  tenantId?: string;
  tenantName?: string;
  tenantAddress?: string;
  tenantPhone?: string;
  brandTagline?: string;
  website?: string;
  logoPath?: string;
  headerNoteFa?: string;
  printKitchenTicket?: boolean;
}

export const ReceiptPrintTemplate: React.FC<ReceiptPrintTemplateProps> = ({
  order,
  tenantId,
  tenantName,
  tenantAddress,
  tenantPhone,
  brandTagline,
  website,
  logoPath,
  headerNoteFa,
  printKitchenTicket,
}) => {
  const activeTenant = getActiveTenant();
  // Strict tenant detection — never guess from display names (English/Persian casing traps).
  const effectiveTenantId = tenantId || order.tenantId || activeTenant.id;
  const isModendo =
    effectiveTenantId === 'modendo' ||
    effectiveTenantId === 'tenant-modendo-01' ||
    effectiveTenantId.includes('modendo');

  const displayTenantName = tenantName || activeTenant.brandNameFa;
  const displayLogo = logoPath || '/karwand-logo.png';
  const displayHeaderNote = headerNoteFa || activeTenant.receipt.headerNoteFa;
  const shouldPrintKitchen =
    printKitchenTicket !== undefined ? printKitchenTicket : activeTenant.receipt.printKitchenTicket;

  const displayTagline =
    brandTagline ||
    displayHeaderNote ||
    (isModendo
      ? "«کافه گیمینگ مودندو؛ دنیای بردگیم و هیجان کنسول PS5»"
      : "«صد هیچ؛ تمرکز محض روی اصالت قهوه»");
  const displayWebsite = website || (isModendo ? "MODENDO.CAFE" : "100HICH.IR");
  const subBrand = isModendo ? "MODENDO GAMING LOUNGE" : "COFFEE ROASTERS";
  const displayAddress =
    tenantAddress ||
    (isModendo
      ? "تهران، خیابان شریعتی، مجتمع تجاری مودندو، طبقه منفی ۱ و همکف"
      : "اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت باکس");
  const displayPhone = tenantPhone || (isModendo ? "۰۲۱-۸۸۹۹۷۷۶۶" : "۰۲۱-۴۴۶۶۸۰۹۰");

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
      {/* =================================================================== */}
      {/* TICKET 1: CUSTOMER RECEIPT (رسید مشتری)                             */}
      {/* =================================================================== */}
      <div className="customer-receipt-ticket">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-1 mb-2">
          {displayLogo && (
            <div className="flex justify-center mb-1">
              <img
                src={displayLogo}
                alt="KarWand"
                className="h-12 w-12 rounded-xl object-cover border border-[#C5A880]/60 shadow-sm mx-auto block"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.endsWith('.svg')) {
                    img.src = displayLogo.replace('.png', '.svg');
                  }
                }}
              />
            </div>
          )}
          {isModendo ? (
            <>
              <h1 className="text-xl font-black tracking-wider text-black m-0 p-0">{displayTenantName}</h1>
              <p className="text-xs font-bold tracking-widest text-gray-800 m-0 uppercase">{subBrand}</p>
            </>
          ) : (
            <div className="space-y-0.5">
              <div className="text-center font-bold text-base text-black">قهوه‌فروشی ۱۰۰ هیچ</div>
              <div dir="ltr" className="text-center text-xs tracking-wider text-neutral-400 font-mono">100 HICH COFFEE ROASTERS</div>
            </div>
          )}
          {displayHeaderNote && (
            <p className="text-[10px] font-bold text-gray-700 m-0">{displayHeaderNote}</p>
          )}
          <p className="text-[10px] text-gray-700 m-0 leading-tight">{displayAddress}</p>
          <p className="text-[10px] text-gray-700 m-0 font-mono">تلفن: {displayPhone}</p>
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
          {order.tableLabel && (
            <div className="flex justify-between text-black font-extrabold">
              <span>شماره میز:</span>
              <span className="font-mono bg-gray-100 px-1 rounded">{order.tableLabel}</span>
            </div>
          )}
          {order.customerName && (
            <div className="flex justify-between text-black">
              <span>مشتری:</span>
              <span className="font-bold">{order.customerName}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-700">
            <span>صندوقدار / باریستا:</span>
            <span>{order.cashier || (isModendo ? "مهدان مهدوی - مدیر کل" : "مهدان مهدوی - مدیر و مالک")}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-gray-400 my-2" style={{ borderBottom: "1px dashed #666" }} />

        {/* Itemized Pricing Table */}
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

        {/* Totals & Subtotal */}
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

        {/* Footer: Tagline & Thanks */}
        <div className="text-center mt-3 space-y-1 pt-2" style={{ borderTop: "1px solid #ddd" }}>
          <p className="text-[10px] font-bold mt-1 text-black">{displayTagline}</p>
          <p className="text-[9px] text-gray-600">از خرید و همراهی شما سپاسگزاریم • {displayWebsite}</p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TICKET 2: KITCHEN & BAR SLIP (فیش سفارش بار / آشپزخانه)             */}
      {/* Rendered when activeTenant.receipt.printKitchenTicket is true       */}
      {/* =================================================================== */}
      {shouldPrintKitchen && (
        <div
          className="kitchen-ticket-break"
          style={{
            pageBreakBefore: "always",
            borderTop: "2px dashed #000",
            marginTop: "15px",
            paddingTop: "10px",
          }}
        >
          {/* Header: *** فیش سفارش بار / آشپزخانه *** */}
          <div className="text-center mb-2">
            <h2 className="text-sm font-black text-black m-0 p-0">*** فیش سفارش بار / آشپزخانه ***</h2>
            {/* Bold large text: شماره سفارش: #KW-{orderNumber} | میز: {tableLabel} */}
            <div className="text-sm font-extrabold text-black mt-1">
              شماره سفارش: #KW-{order.invoiceNo} | میز: {order.tableLabel || (order.orderType === 'TAKEAWAY' ? 'بیرون‌بر' : 'سالن')}
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              <span>زمان ثبت: {order.dateTime}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-gray-400 my-2" style={{ borderBottom: "1px dashed #666" }} />

          {/* Item rows with Quantity + Modifiers + Notes (EXCLUDE all prices and totals) */}
          <table className="w-full text-right text-[11px]" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b border-gray-300 text-gray-700" style={{ borderBottom: "1px solid #ccc" }}>
                <th className="py-1 text-right font-bold">شرح اقلام سفارش</th>
                <th className="py-1 text-left font-bold">تعداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td className="py-1.5 font-bold text-black text-xs">
                    <div>{item.name}</div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-[9px] font-semibold text-gray-700">{item.modifiers.join("، ")}</div>
                    )}
                    {item.notes && <div className="text-[9px] text-gray-600 italic">*{item.notes}</div>}
                  </td>
                  <td className="py-1.5 text-left font-mono font-black text-sm text-black">
                    {item.qty}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {order.notes && (
            <div className="mt-2 pt-1 border-t border-dashed border-gray-400 text-[10px] text-black" style={{ borderTop: "1px dashed #666" }}>
              <span className="font-bold">یادداشت سفارش: </span>
              <span>{order.notes}</span>
            </div>
          )}

          <div className="text-center mt-3 pt-2 border-t border-gray-300 text-[10px] font-bold text-gray-700" style={{ borderTop: "1px solid #ddd" }}>
            <span>آماده‌سازی سفارشات بخش بار و آشپزخانه</span>
          </div>
        </div>
      )}
    </div>
  );
};

export function renderReceiptTemplateHtml(
  order: ReceiptOrderData,
  tenantInfo: {
    name?: string;
    address?: string;
    phone?: string;
    tagline?: string;
    website?: string;
    logoPath?: string;
    headerNoteFa?: string;
    printKitchenTicket?: boolean;
  } = {}
): string {
  const activeTenant = getActiveTenant();
  const shouldPrintKitchenTicket =
    tenantInfo.printKitchenTicket !== undefined
      ? tenantInfo.printKitchenTicket
      : activeTenant.receipt.printKitchenTicket;

  const isModendo =
    activeTenant.id === 'modendo' ||
    (tenantInfo.name
      ? tenantInfo.name.includes('مودندو') || tenantInfo.name.toUpperCase().includes('MODENDO')
      : false);

  const brandName = escapeHtml(tenantInfo.name || activeTenant.brandNameFa);
  const logoPath = escapeHtml(tenantInfo.logoPath || activeTenant.receipt.logoPath);
  const headerNote = escapeHtml(tenantInfo.headerNoteFa || activeTenant.receipt.headerNoteFa);
  const subBrand = escapeHtml(isModendo ? "MODENDO BOARDGAME & GAMING CAFE" : "COFFEE ROASTERS");
  const address = escapeHtml(tenantInfo.address || (isModendo ? "تهران، خیابان شریعتی، مجتمع تجاری مودندو، منفی ۱" : "اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت باکس"));
  const phone = escapeHtml(tenantInfo.phone || (isModendo ? "۰۲۱-۸۸۹۹۷۷۶۶" : "۰۲۱-۴۴۶۶۸۰۹۰"));
  const tagline = escapeHtml(tenantInfo.tagline || headerNote || (isModendo ? "«کافه مودندو؛ دنیای بردگیم و هیجان کنسول PS5»" : "«صد هیچ؛ تمرکز محض روی اصالت قهوه»"));
  const website = escapeHtml(tenantInfo.website || (isModendo ? "MODENDO.CAFE" : "100HICH.IR"));
  const cashier = escapeHtml(order.cashier || (isModendo ? "مهدان مهدوی - مدیر کل" : "مهدان مهدوی - مدیر و مالک"));
  const subtotal = (order.subtotalAmount ?? order.totalAmount).toLocaleString("fa-IR");
  const total = order.totalAmount.toLocaleString("fa-IR");

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #000;">
          <div>${escapeHtml(item.name)}</div>
          ${item.modifiers && item.modifiers.length > 0 ? `<div style="font-size: 8px; color: #666;">${item.modifiers.map(escapeHtml).join("، ")}</div>` : ""}
          ${item.notes ? `<div style="font-size: 8px; color: #666; font-style: italic;">*${escapeHtml(item.notes)}</div>` : ""}
        </td>
        <td style="padding: 4px 0; text-align: center; font-weight: 700; font-family: monospace; color: #000;">${escapeHtml(item.qty)}×</td>
        <td style="padding: 4px 0; text-align: left; font-family: monospace; font-weight: 700; color: #000;">${item.price.toLocaleString("fa-IR")}</td>
      </tr>
    `
    )
    .join("");

  const kitchenSlipHtml = shouldPrintKitchenTicket
    ? `
      <div style="page-break-before: always; border-top: 2px dashed #000; margin-top: 15px; padding-top: 10px;">
        <div style="text-align: center; margin-bottom: 8px;">
          <h2 style="font-size: 15px; font-weight: 900; margin: 0 0 4px 0; color: #000;">*** فیش سفارش بار / آشپزخانه ***</h2>
          <div style="font-size: 13px; font-weight: 900; color: #000; margin-top: 4px;">
            شماره سفارش: #KW-${escapeHtml(order.invoiceNo)} | میز: ${escapeHtml(order.tableLabel || (order.orderType === 'TAKEAWAY' ? 'بیرون‌بر' : 'سالن'))}
          </div>
          <div style="font-size: 10px; color: #555; margin-top: 2px;">
            <span>زمان ثبت: ${escapeHtml(order.dateTime)}</span>
          </div>
        </div>

        <div style="border-bottom: 1px dashed #666; margin: 6px 0;"></div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1px solid #ccc; color: #444;">
              <th style="padding: 4px 0; text-align: right; font-weight: 700;">شرح کالا</th>
              <th style="padding: 4px 0; text-align: left; font-weight: 700;">تعداد</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (item) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 5px 0; font-weight: 700; text-align: right; color: #000; font-size: 12px;">
                  <div>${escapeHtml(item.name)}</div>
                  ${item.modifiers && item.modifiers.length > 0 ? `<div style="font-size: 9px; font-weight: 600; color: #444;">${item.modifiers.map(escapeHtml).join("، ")}</div>` : ""}
                  ${item.notes ? `<div style="font-size: 9px; font-style: italic; color: #555;">*${escapeHtml(item.notes)}</div>` : ""}
                </td>
                <td style="padding: 5px 0; text-align: left; font-weight: 900; font-size: 14px; font-family: monospace; color: #000;">
                  ${escapeHtml(item.qty)}×
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        ${
          order.notes
            ? `
          <div style="border-top: 1px dashed #666; margin-top: 8px; padding-top: 6px; font-size: 10px; color: #333;">
            <strong>توضیحات سفارش:</strong> ${escapeHtml(order.notes)}
          </div>
        `
            : ""
        }
      </div>
    `
    : "";

  return `
    <div
      id="pos-thermal-receipt"
      class="thermal-receipt-container"
      dir="rtl"
      style="width: 80mm; max-width: 80mm; box-sizing: border-box; padding: 4mm 2mm; background: #ffffff; color: #000000; font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.35; margin: 0 auto; text-align: right;"
    >
      ${logoPath ? `
      <div style="text-align: center; margin-bottom: 6px;">
        <img src="${logoPath}" alt="${brandName}" style="max-height: 48px; max-width: 140px; object-fit: contain; margin: 0 auto 4px auto; display: block;" onerror="this.src=this.src.replace('.png','.svg');" />
      </div>` : ''}

      <div style="text-align: center; margin-bottom: 8px;">
        ${isModendo ? `
          <h1 style="font-size: 18px; font-weight: 900; letter-spacing: 1px; margin: 0 0 2px 0; color: #000;">${brandName}</h1>
          <p style="font-size: 10px; font-weight: 800; letter-spacing: 2px; margin: 0 0 4px 0; text-transform: uppercase; color: #333;">${subBrand}</p>
        ` : `
          <div style="text-align: center; font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">قهوه‌فروشی ۱۰۰ هیچ</div>
          <div dir="ltr" style="text-align: center; font-size: 11px; letter-spacing: 1px; color: #666; font-family: monospace;">100 HICH COFFEE ROASTERS</div>
        `}
        ${headerNote ? `<p style="font-size: 10px; font-weight: 700; color: #333; margin: 2px 0;">${headerNote}</p>` : ''}
        <p style="font-size: 10px; color: #444; margin: 2px 0;">${address}</p>
        <p style="font-size: 10px; color: #444; margin: 0; font-family: monospace;">تلفن: ${phone}</p>
      </div>

      <div style="border-bottom: 1px dashed #666; margin: 8px 0;"></div>

      <div style="font-size: 11px; line-height: 1.5;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>شماره فاکتور:</span>
          <span style="font-family: monospace;">#${escapeHtml(order.invoiceNo)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #333;">
          <span>تاریخ و ساعت:</span>
          <span>${escapeHtml(order.dateTime)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>نوع سفارش:</span>
          <span style="font-weight: 700;">${escapeHtml(order.orderType)}</span>
        </div>
        ${order.tableLabel ? `
        <div style="display: flex; justify-content: space-between; font-weight: 800;">
          <span>شماره میز:</span>
          <span style="font-family: monospace;">${escapeHtml(order.tableLabel)}</span>
        </div>` : ""}
        ${order.customerName ? `
        <div style="display: flex; justify-content: space-between;">
          <span>مشتری:</span>
          <span style="font-weight: 700;">${escapeHtml(order.customerName)}</span>
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
          <span>${escapeHtml(order.paymentMethod)}</span>
        </div>
        ${order.referenceCode ? `
        <div style="display: flex; justify-content: space-between; font-family: monospace;" dir="ltr">
          <span dir="rtl">شماره پیگیری (RRN):</span>
          <span style="font-weight: 700; color: #000;">${escapeHtml(order.referenceCode)}</span>
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
        <p style="font-size: 10px; font-weight: 700; margin: 4px 0 2px 0; color: #000;">${tagline}</p>
        <p style="font-size: 9px; color: #666; margin: 0;">از همراهی شما سپاسگزاریم • ${website}</p>
      </div>

      ${kitchenSlipHtml}
    </div>
  `;
}

export default ReceiptPrintTemplate;
