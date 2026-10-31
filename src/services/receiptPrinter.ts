import React from 'react';
import { ReceiptOrderData, renderReceiptTemplateHtml } from '../components/ReceiptPrintTemplate';

/**
 * Dedicated POS Thermal Receipt Printing Service (Isolated Sandboxed Iframe)
 * Guarantees 100% zero leakage of background POS catalog, boilers, or charts.
 * Never falls back to parent window.print() to prevent viewport dumps.
 */

export interface PrintOptions {
  documentTitle?: string;
  tenantAddress?: string;
  tenantPhone?: string;
}

export function printThermalReceipt(
  targetOrData: HTMLElement | string | ReceiptOrderData = 'pos-thermal-receipt',
  options: PrintOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      let receiptHtml = '';

      if (typeof targetOrData === 'object' && targetOrData !== null && !('nodeType' in targetOrData)) {
        // Direct data rendering via ReceiptPrintTemplate
        receiptHtml = renderReceiptTemplateHtml(targetOrData as ReceiptOrderData, {
          address: options.tenantAddress,
          phone: options.tenantPhone,
        });
      } else {
        let targetEl: HTMLElement | null = null;
        if (typeof targetOrData === 'string') {
          targetEl =
            document.getElementById(targetOrData) ||
            document.getElementById('pos-thermal-receipt') ||
            document.getElementById('thermal-receipt') ||
            document.getElementById('printable-shift-summary') ||
            document.getElementById('printable-receipt');
        } else if ('nodeType' in targetOrData) {
          targetEl = targetOrData as HTMLElement;
        }

        if (!targetEl) {
          console.warn('[ThermalPrinter] Target receipt element not found in DOM, aborting print without viewport leakage');
          resolve(false);
          return;
        }

        receiptHtml = targetEl.outerHTML;
      }

      // Create an isolated sandbox iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('role', 'presentation');
      iframe.setAttribute('title', 'Receipt Print Sandbox');
      iframe.style.position = 'fixed';
      iframe.style.left = '0';
      iframe.style.top = '0';
      iframe.style.width = '80mm';
      iframe.style.height = '140px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.001';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>${options.documentTitle || 'رسید حرارتی ۸۰ میلی‌متری'}</title>
          <style>
            @page {
              size: 80mm auto !important;
              margin: 0mm !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              margin: 0;
              padding: 0;
              box-shadow: none !important;
              text-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
              font-size: 11px !important;
              line-height: 1.35 !important;
            }
            #pos-thermal-receipt,
            #thermal-receipt,
            #printable-shift-summary,
            #printable-receipt,
            .thermal-receipt-container {
              display: block !important;
              visibility: visible !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              padding: 4mm 2mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            button, .print\\:hidden, .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${receiptHtml}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        const frameWin = iframe.contentWindow;
        if (!frameWin) {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          resolve(false);
          return;
        }

        // Force layout reflow before triggering print
        try {
          if (frameWin.document.body) {
            void frameWin.document.body.offsetHeight;
          }
        } catch {
          // ignore reflow probe error
        }

        frameWin.focus();

        let isDone = false;
        const cleanup = () => {
          if (isDone) return;
          isDone = true;
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve(true);
          }, 150);
        };

        frameWin.onafterprint = cleanup;

        try {
          frameWin.print();
        } catch (e) {
          console.error('[ThermalPrinter] Iframe print invocation error:', e);
          cleanup();
        }

        // Fallback cleanup in case onafterprint doesn't trigger
        setTimeout(cleanup, 3500);
      }, 150);
    } catch (err) {
      console.error('[ThermalPrinter] printThermalReceipt failure:', err);
      resolve(false);
    }
  });
}

/**
 * Dedicated hook to trigger thermal receipt print with layout reflow guarantee
 */
export function usePrintReceipt() {
  const [isPrinting, setIsPrinting] = React.useState(false);

  const printReceipt = React.useCallback(
    async (
      targetOrData: HTMLElement | string | ReceiptOrderData = 'pos-thermal-receipt',
      title?: string
    ) => {
      setIsPrinting(true);
      try {
        await printThermalReceipt(targetOrData, { documentTitle: title });
      } finally {
        setIsPrinting(false);
      }
    },
    []
  );

  return { printReceipt, isPrinting };
}
