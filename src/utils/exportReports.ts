/**
 * src/utils/exportReports.ts
 * 
 * KarWand POS — Bespoke Excel & CSV Report Generation Engine
 * 
 * Features:
 * - RFC 4180 compliant CSV generator with \uFEFF UTF-8 BOM for Microsoft Excel.
 * - Bespoke HTML Spreadsheet (.xls) generator with Right-to-Left (dir="rtl") alignment.
 * - Dark Slate (#0F223D) executive header rows with high-contrast text.
 * - Formatted Persian columns with integer Toman currency precision.
 * - Zero float leaks, strict integer arithmetic.
 */

import { Order, Expense } from '../types/domain';
import {
  escapeCSVCell,
  formatToman,
  generateOrdersCSV,
  downloadOrdersCSV,
  generateExpensesCSV,
  downloadExpensesCSV,
} from '../services/financialMath';

export {
  escapeCSVCell,
  generateOrdersCSV,
  downloadOrdersCSV,
  generateExpensesCSV,
  downloadExpensesCSV,
};

/**
 * Downloads arbitrary file content in the browser as Blob
 */
export function downloadFileBlob(content: string, filename: string, mimeType: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Generates a styled Right-to-Left HTML spreadsheet for Orders readable by Excel
 */
export function generateOrdersExcelHTML(orders: Order[], venueName: string = 'قهوه‌فروشی ۱۰۰ هیچ'): string {
  const nowStr = new Date().toLocaleDateString('fa-IR');
  const sumGross = orders.reduce((acc, o) => acc + (Math.round(o.grossAmountToman) || 0), 0);
  const sumDiscount = orders.reduce((acc, o) => acc + (Math.round(o.discountAmountToman) || 0), 0);
  const sumNet = orders.reduce((acc, o) => acc + (Math.round(o.netTotalToman) || 0), 0);

  const rows = orders.map((o, idx) => {
    const isCancelled = o.status === 'CANCELLED';
    const statusFa = isCancelled
      ? 'لغو شده'
      : o.status === 'COMPLETED'
      ? 'تکمیل شده'
      : o.status === 'PREPARING'
      ? 'در حال آماده‌سازی'
      : o.status === 'DRAFT'
      ? 'در انتظار'
      : o.status;
    const orderTypeFa = o.orderType === 'DINE_IN' ? 'سالن' : 'بیرون‌بر';
    const itemsSummary = o.items.map((i) => `${i.itemNameSnapshot} (×${i.quantity})`).join('، ');
    const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

    return `
      <tr style="background-color: ${rowBg}; text-align: center; border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; font-weight: bold;">#${o.orderNumber}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${new Date(o.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} - ${new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${orderTypeFa}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${o.tableLabel || o.customerName || '-'}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; color: ${isCancelled ? '#DC2626' : '#16A34A'}; font-weight: bold;">${statusFa}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${o.createdByUserName || 'مهدان مهدوی'}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: right;">${itemsSummary}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; font-family: monospace;">${formatToman(o.grossAmountToman)} تومان</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; color: #DC2626; font-family: monospace;">${o.discountAmountToman > 0 ? formatToman(o.discountAmountToman) + ' تومان' : '۰'}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; font-weight: bold; color: #0F223D; font-family: monospace;">${formatToman(o.netTotalToman)} تومان</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; color: #64748B;">${o.cancellationReason || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="fa">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>دفتر فروش فاکتورها</x:Name>
              <x:WorksheetOptions>
                <x:DisplayRightToLeft/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
        th { background-color: #0F223D; color: #FFFFFF; font-weight: bold; padding: 10px; border: 1px solid #1E293B; font-size: 13px; }
        td { font-size: 12px; }
        .summary-cell { background-color: #E2E8F0; font-weight: bold; border: 2px solid #0F223D; padding: 10px; }
      </style>
    </head>
    <body dir="rtl">
      <div style="margin-bottom: 16px; text-align: center;">
        <h2 style="color: #0F223D; margin: 0;">گزارش فروش و فاکتورهای صندوق — ${venueName}</h2>
        <p style="color: #64748B; font-size: 12px; margin: 4px 0;">تاریخ استخراج: ${nowStr} | تعداد فاکتورها: ${orders.length}</p>
      </div>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>شماره فاکتور</th>
            <th>زمان و تاریخ</th>
            <th>نوع سفارش</th>
            <th>میز / مشتری</th>
            <th>وضعیت</th>
            <th>صندوقدار</th>
            <th>اقلام سفارش</th>
            <th>مبلغ ناخالص</th>
            <th>تخفیف</th>
            <th>مبلغ خالص نهایی</th>
            <th>توضیحات</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background-color: #F1F5F9; font-weight: bold; text-align: center;">
            <td colspan="8" class="summary-cell" style="text-align: right;">مجموع کل (${orders.length} فاکتور)</td>
            <td class="summary-cell" style="font-family: monospace;">${formatToman(sumGross)} تومان</td>
            <td class="summary-cell" style="color: #DC2626; font-family: monospace;">${formatToman(sumDiscount)} تومان</td>
            <td class="summary-cell" style="color: #0F223D; font-size: 14px; font-family: monospace;">${formatToman(sumNet)} تومان</td>
            <td class="summary-cell">-</td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `.trim();
}

/**
 * Generates a styled Right-to-Left HTML spreadsheet for Expenses readable by Excel
 */
export function generateExpensesExcelHTML(expenses: Expense[], venueName: string = 'قهوه‌فروشی ۱۰۰ هیچ'): string {
  const nowStr = new Date().toLocaleDateString('fa-IR');
  const sumAmount = expenses.reduce((acc, e) => acc + (Math.round(e.amountToman) || 0), 0);

  const rows = expenses.map((e, idx) => {
    const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const paymentSourceFa = e.isPaidFromCashDrawer ? 'صندوق نقدی' : 'کارت‌خوان / غیرنقدی';

    return `
      <tr style="background-color: ${rowBg}; text-align: center; border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; font-weight: bold;">${e.id}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${new Date(e.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} - ${new Date(e.createdAt).toLocaleDateString('fa-IR')}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${e.category || 'متفرقه'}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: right;">${e.description || '-'}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${paymentSourceFa}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1;">${e.recordedByUserName || 'مهدان مهدوی'}</td>
        <td style="padding: 8px; border: 1px solid #CBD5E1; font-weight: bold; color: #DC2626; font-family: monospace;">${formatToman(e.amountToman)} تومان</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="fa">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>دفتر هزینه‌ها و تنخواه</x:Name>
              <x:WorksheetOptions>
                <x:DisplayRightToLeft/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
        th { background-color: #0F223D; color: #FFFFFF; font-weight: bold; padding: 10px; border: 1px solid #1E293B; font-size: 13px; }
        td { font-size: 12px; }
        .summary-cell { background-color: #E2E8F0; font-weight: bold; border: 2px solid #0F223D; padding: 10px; }
      </style>
    </head>
    <body dir="rtl">
      <div style="margin-bottom: 16px; text-align: center;">
        <h2 style="color: #0F223D; margin: 0;">گزارش هزینه‌های جاری و تنخواه — ${venueName}</h2>
        <p style="color: #64748B; font-size: 12px; margin: 4px 0;">تاریخ استخراج: ${nowStr} | تعداد ردیف‌ها: ${expenses.length}</p>
      </div>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>شناسه سند</th>
            <th>زمان و تاریخ</th>
            <th>دسته‌بندی</th>
            <th>شرح هزینه</th>
            <th>منبع پرداخت</th>
            <th>ثبت‌کننده</th>
            <th>مبلغ هزینه</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background-color: #F1F5F9; font-weight: bold; text-align: center;">
            <td colspan="7" class="summary-cell" style="text-align: right;">مجموع کل هزینه‌ها (${expenses.length} ردیف)</td>
            <td class="summary-cell" style="color: #DC2626; font-size: 14px; font-family: monospace;">${formatToman(sumAmount)} تومان</td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `.trim();
}

/**
 * Triggers browser download of bespoke styled Excel spreadsheet (.xls)
 */
export function exportOrdersToExcel(orders: Order[], filename?: string, venueName?: string): boolean {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeFilename = filename || `100hich-orders-${dateStr}.xls`;
  const html = generateOrdersExcelHTML(orders, venueName);
  return downloadFileBlob(html, safeFilename, 'application/vnd.ms-excel;charset=utf-8;');
}

/**
 * Triggers browser download of bespoke styled Excel expenses spreadsheet (.xls)
 */
export function exportExpensesToExcel(expenses: Expense[], filename?: string, venueName?: string): boolean {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeFilename = filename || `100hich-expenses-${dateStr}.xls`;
  const html = generateExpensesExcelHTML(expenses, venueName);
  return downloadFileBlob(html, safeFilename, 'application/vnd.ms-excel;charset=utf-8;');
}
