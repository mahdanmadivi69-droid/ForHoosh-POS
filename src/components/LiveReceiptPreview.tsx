/**
 * CAFE OS — Live Thermal Receipt Simulator (80mm / 58mm)
 * Real-time dynamic visual preview of thermal paper with raster font & perforation
 */

import React from 'react';
import { StoreProfileConfig, FiscalRulesConfig, ReceiptTemplateConfig, RollWidthMm } from '../types/rbac-settings';
import { QrCode, Scissors } from 'lucide-react';

interface LiveReceiptPreviewProps {
  storeProfile: StoreProfileConfig;
  fiscalRules: FiscalRulesConfig;
  receiptTemplate: ReceiptTemplateConfig;
  rollWidthMm: RollWidthMm;
}

export const LiveReceiptPreview: React.FC<LiveReceiptPreviewProps> = ({
  storeProfile,
  fiscalRules,
  receiptTemplate,
  rollWidthMm,
}) => {
  const is80mm = rollWidthMm === 80;
  const sampleItems = [
    { title: 'اسپرسو دوبل (بلند صَد)', qty: 2, price: 65000 },
    { title: 'آیس لاته فندق کارامل', qty: 1, price: 98000 },
    { title: 'کروسان کره‌ای شکلاتی', qty: 1, price: 75000 },
  ];

  const subtotal = sampleItems.reduce((acc, it) => acc + it.price * it.qty, 0);
  const vatAmount =
    fiscalRules.vat_tax_percentage > 0
      ? Math.round((subtotal * fiscalRules.vat_tax_percentage) / (100 + fiscalRules.vat_tax_percentage))
      : 0;
  const total = subtotal;

  const tenantId = storeProfile.name_en?.toUpperCase().includes('MODENDO')
    ? 'tenant-modendo-01'
    : 'tenant-100hich-01';

  return (
    <div
      data-tenant={tenantId}
      className="flex flex-col items-center select-none"
      dir="rtl"
    >
      {/* Paper Width Badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-mono font-bold bg-[var(--color-surface-panel,#1F242C)] text-[var(--color-text-secondary,#9EACB8)] border border-[var(--color-surface-border,rgba(255,255,255,0.1))] px-2 py-0.5 rounded">
          رول کاغذ: {rollWidthMm}mm ({is80mm ? '۴۲ کاراکتر' : '۳۲ کاراکتر'})
        </span>
        <span className="text-[10px] font-bold text-[var(--color-badge-text,#34D399)] bg-[var(--color-badge-bg,rgba(5,150,105,0.15))] border border-[var(--color-badge-border,rgba(5,150,105,0.3))] px-2 py-0.5 rounded">
          ESC/POS LIVE
        </span>
      </div>

      {/* Simulated Thermal Paper */}
      <div
        className={`bg-[#FAFAFA] text-[#121212] rounded-t-sm shadow-2xl transition-all duration-300 font-sans p-4 border-b-2 border-dashed border-gray-400 relative overflow-hidden ${
          is80mm ? 'w-[310px]' : 'w-[245px]'
        }`}
        style={{
          boxShadow: '0 20px 45px -10px rgba(0,0,0,0.8), 0 0 1px 1px rgba(255,255,255,0.1)',
        }}
      >
        {/* Paper Top Jagged Cut Simulation */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 opacity-60"></div>

        {/* Store Header */}
        <div className="text-center space-y-0.5 mb-3">
          <div className="text-center font-bold text-base text-black">
            {storeProfile.name_fa || 'قهوه‌فروشی ۱۰۰ هیچ'}
          </div>
          <div dir="ltr" className="text-center text-xs tracking-wider text-neutral-400 font-mono">
            {storeProfile.name_en || '100 HICH COFFEE ROASTERS'}
          </div>
          <div className="text-[10px] text-gray-700 leading-tight">
            {storeProfile.address}
          </div>
          <div className="text-[10px] font-mono text-gray-700">
            تلفن: {storeProfile.phone}
          </div>
          {storeProfile.tax_registration_no && (
            <div className="text-[9px] font-mono text-gray-500">
              کد اقتصادی: {storeProfile.tax_registration_no}
            </div>
          )}
        </div>

        {/* Custom Header Lines */}
        {receiptTemplate.header_lines.length > 0 && (
          <div className="text-center border-y border-dashed border-gray-400 py-1.5 my-2 space-y-0.5">
            {receiptTemplate.header_lines.map((line, idx) => (
              <div key={idx} className="text-[10px] font-bold text-gray-800">
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Invoice Meta */}
        <div className="text-[10px] space-y-0.5 my-2 text-gray-800">
          <div className="flex justify-between">
            <span>شماره سفارش: #۱۰۴۲</span>
            <span className="font-bold">میز ۳ (سالن)</span>
          </div>
          <div className="flex justify-between text-gray-600 font-mono text-[9px]">
            <span>۱۴۰۵/۰۸/۱۰ - ۱۱:۳۰</span>
            <span>صندوق‌دار: شیفت صبح</span>
          </div>
        </div>

        {/* Separator */}
        <div className="border-b border-black my-1.5"></div>

        {/* Items Table */}
        <div className="space-y-1.5 my-2">
          {sampleItems.map((item, idx) => (
            <div key={idx} className="text-[10px]">
              <div className="flex justify-between font-bold text-gray-900">
                <span>{item.title}</span>
                <span className="font-mono">{(item.price * item.qty).toLocaleString('fa-IR')}</span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                <span>
                  {item.qty} × {item.price.toLocaleString('fa-IR')}
                </span>
                <span>تومان</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Section */}
        <div className="border-t border-black pt-1.5 mt-2 space-y-1 text-[10px]">
          <div className="flex justify-between text-gray-700">
            <span>جمع اقلام:</span>
            <span className="font-mono">{subtotal.toLocaleString('fa-IR')} ت</span>
          </div>
          {fiscalRules.vat_tax_percentage > 0 && (
            <div className="flex justify-between text-gray-700">
              <span>ارزش افزوده ({fiscalRules.vat_tax_percentage}٪):</span>
              <span className="font-mono">{vatAmount.toLocaleString('fa-IR')} ت</span>
            </div>
          )}
          <div className="flex justify-between font-black text-xs text-black border-t border-dashed border-gray-400 pt-1">
            <span>مبلغ کل پرداختی:</span>
            <span className="font-mono">{total.toLocaleString('fa-IR')} تومان</span>
          </div>
        </div>

        {/* Custom Footer Lines */}
        {receiptTemplate.footer_lines.length > 0 && (
          <div className="text-center border-t border-dashed border-gray-400 pt-2 mt-3 space-y-0.5">
            {receiptTemplate.footer_lines.map((line, idx) => (
              <div key={idx} className="text-[9px] text-gray-700">
                {line}
              </div>
            ))}
          </div>
        )}

        {/* QR Code */}
        {receiptTemplate.print_qr_invoice_link && (
          <div className="flex flex-col items-center justify-center my-2 pt-1 border-t border-dotted border-gray-400">
            <div className="p-1 bg-white border border-gray-300 rounded shadow-sm">
              <QrCode className="w-12 h-12 text-black" />
            </div>
            <span className="text-[8px] text-gray-500 font-mono mt-0.5">
              اسکن فاکتور رسمی
            </span>
          </div>
        )}

        {/* Cutter Notch Simulation */}
        <div className="flex items-center justify-center gap-1 text-[8px] text-gray-400 font-mono mt-3">
          <Scissors className="w-3 h-3 rotate-180" />
          <span>- - - - - - برش خودکار (Auto Cut) - - - - - -</span>
        </div>
      </div>
    </div>
  );
};
