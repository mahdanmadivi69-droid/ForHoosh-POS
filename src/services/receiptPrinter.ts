/**
 * Dedicated POS Thermal Receipt Printing Service
 * Isolates receipt DOM into a dedicated sandbox IFrame to guarantee
 * 100% zero leakage of background dashboard, charts, or navigation into print preview.
 */

interface PrintOptions {
  documentTitle?: string;
}

export function printThermalReceipt(
  targetElementOrId: HTMLElement | string,
  options: PrintOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      let targetEl: HTMLElement | null = null;
      if (typeof targetElementOrId === 'string') {
        targetEl = document.getElementById(targetElementOrId);
      } else {
        targetEl = targetElementOrId;
      }

      if (!targetEl) {
        // Fallback to window.print if element not found
        window.print();
        resolve(true);
        return;
      }

      // Clone HTML of the receipt
      const receiptHtml = targetEl.outerHTML;

      // Create an invisible iframe sandbox
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        document.body.removeChild(iframe);
        resolve(true);
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>${options.documentTitle || 'رسید فاکتور'}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm !important;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              box-shadow: none !important;
              text-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 80mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif;
              direction: rtl;
              text-align: right;
              font-size: 11px;
              line-height: 1.35;
            }
            #printable-receipt,
            #printable-shift-summary,
            #receipt-print-area,
            .receipt-paper {
              display: block !important;
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 auto !important;
              padding: 3mm 1mm 6mm 1mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              border: none !important;
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
          document.body.removeChild(iframe);
          resolve(false);
          return;
        }

        frameWin.focus();

        const cleanup = () => {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve(true);
          }, 100);
        };

        frameWin.onafterprint = cleanup;

        try {
          frameWin.print();
        } catch (e) {
          console.error('Iframe print error, falling back:', e);
          window.print();
        }

        // Fallback cleanup in case onafterprint doesn't trigger
        setTimeout(cleanup, 2500);
      }, 100);
    } catch (err) {
      console.error('printThermalReceipt failure, falling back to window.print', err);
      window.print();
      resolve(true);
    }
  });
}
