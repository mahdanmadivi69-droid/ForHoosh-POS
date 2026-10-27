/**
 * CAFE OS — Direct Hardware ESC/POS 80mm Raster Thermal Printer Driver
 * Driver-free WebUSB & Web Bluetooth communication with 576-dot Canvas Rasterization for Persian script.
 */

import { OrderAggregate } from '../types/order-domain';
import { Tenant } from '../types/domain';
import { formatToman } from './financialMath';

export interface PrinterConnectResult {
  success: boolean;
  type: 'WEB_USB' | 'WEB_BLUETOOTH' | 'CANVAS_FALLBACK';
  message: string;
}

/**
 * Standard ESC/POS Commands
 */
const ESC_INIT = new Uint8Array([0x1b, 0x40]); // ESC @ (Initialize printer)
const ESC_CUT_PAPER = new Uint8Array([0x1d, 0x56, 0x41, 0x10]); // GS V 65 16 (Feed and full cut)

/**
 * Renders high-fidelity Persian receipt on a 576px wide canvas (standard 80mm printer raster).
 */
export function renderReceiptToCanvas(
  order: OrderAggregate,
  tenant: Tenant,
  cashTendered?: number,
  changeDue?: number
): HTMLCanvasElement {
  const width = 576;
  // Calculate dynamic height based on item count
  const estimatedHeight = 650 + order.items.length * 75 + (order.payments.length > 0 ? 120 : 60);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = estimatedHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D context from canvas');

  // Pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Text setup
  ctx.fillStyle = '#000000';
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  let y = 45;

  // Header
  ctx.font = 'bold 28px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(tenant.name || 'قهوه‌فروشی ۱۰۰هیچ', width / 2, y);
  y += 35;

  ctx.font = '18px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText('تخصصی‌ترین قهوه تجربی و اسپشیالتی', width / 2, y);
  y += 30;

  if (tenant.phone) {
    ctx.font = '16px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(`تلفن تماس: ${tenant.phone}`, width / 2, y);
    y += 26;
  }

  // Separator line
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(25, y);
  ctx.lineTo(width - 25, y);
  ctx.stroke();
  y += 35;

  // Order Details
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(`شماره سفارش: #${order.orderNumber || 1001}`, width - 35, y);

  ctx.textAlign = 'left';
  const orderTypeFa = order.orderType === 'DINE_IN' ? 'سالن' : order.orderType === 'TAKEAWAY' ? 'بیرون‌بر' : 'ارسال';
  ctx.fillText(`نوع: ${orderTypeFa}`, 35, y);
  y += 30;

  ctx.textAlign = 'right';
  ctx.font = '18px Vazirmatn, Tahoma, sans-serif';
  if (order.tableLabel) {
    ctx.fillText(`محل: ${order.tableLabel}`, width - 35, y);
  }
  if (order.customerName) {
    ctx.textAlign = 'left';
    ctx.fillText(`مشتری: ${order.customerName}`, 35, y);
  }
  y += 30;

  ctx.textAlign = 'right';
  ctx.font = '16px Vazirmatn, Tahoma, sans-serif';
  const orderDate = new Date(order.createdAt).toLocaleDateString('fa-IR');
  const orderTime = new Date(order.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(`تاریخ: ${orderDate} - ساعت: ${orderTime}`, width - 35, y);
  y += 30;

  // Dashed separator
  drawDashedLine(ctx, 25, y, width - 25);
  y += 30;

  // Table header
  ctx.font = 'bold 18px Vazirmatn, Tahoma, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('شرح کالا', width - 35, y);
  ctx.textAlign = 'center';
  ctx.fillText('تعداد', width / 2, y);
  ctx.textAlign = 'left';
  ctx.fillText('مبلغ (تومان)', 35, y);
  y += 24;

  drawDashedLine(ctx, 25, y, width - 25);
  y += 28;

  // Items
  for (const item of order.items) {
    ctx.font = 'bold 19px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(item.itemNameSnapshot, width - 35, y);

    ctx.font = '18px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(item.quantity), width / 2, y);

    ctx.textAlign = 'left';
    ctx.fillText(formatToman(item.subtotalToman), 35, y);
    y += 26;

    // Modifiers list
    if (item.modifiers && item.modifiers.length > 0) {
      ctx.font = '15px Vazirmatn, Tahoma, sans-serif';
      ctx.fillStyle = '#333333';
      for (const mod of item.modifiers) {
        ctx.textAlign = 'right';
        const modPriceText = mod.priceDeltaToman > 0 ? ` (+${formatToman(mod.priceDeltaToman)})` : '';
        ctx.fillText(`+ ${mod.nameFa}${modPriceText}`, width - 55, y);
        y += 22;
      }
      ctx.fillStyle = '#000000';
    }

    if (item.notes) {
      ctx.font = 'italic 15px Vazirmatn, Tahoma, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`یادداشت: ${item.notes}`, width - 55, y);
      y += 22;
    }

    y += 8;
  }

  // Dashed separator
  drawDashedLine(ctx, 25, y, width - 25);
  y += 32;

  // Financial Totals
  ctx.font = '18px Vazirmatn, Tahoma, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('جمع اقلام:', width - 35, y);
  ctx.textAlign = 'left';
  ctx.fillText(`${formatToman(order.grossAmountToman)} تومان`, 35, y);
  y += 28;

  if (order.discountAmountToman > 0) {
    ctx.fillText('تخفیف:', width - 35, y);
    ctx.textAlign = 'left';
    ctx.fillText(`- ${formatToman(order.discountAmountToman)} تومان`, 35, y);
    y += 28;
  }

  // Net Total (Bold Highlight)
  ctx.font = 'bold 24px Vazirmatn, Tahoma, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('مبلغ قابل پرداخت:', width - 35, y);
  ctx.textAlign = 'left';
  ctx.fillText(`${formatToman(order.netTotalToman)} تومان`, 35, y);
  y += 35;

  drawDashedLine(ctx, 25, y, width - 25);
  y += 28;

  // Payments
  ctx.font = 'bold 18px Vazirmatn, Tahoma, sans-serif';
  ctx.textAlign = 'right';
  if (order.payments.length > 0) {
    const p = order.payments[0];
    const payMethodFa = p.paymentMethod === 'CARD_MANUAL' ? 'کارت‌خوان بانکی' : 'پرداخت نقدی';
    ctx.fillText(`روش پرداخت: ${payMethodFa}`, width - 35, y);
    y += 26;

    if (p.referenceCode) {
      ctx.font = '16px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(`کد پیگیری: ${p.referenceCode}`, width - 35, y);
      y += 24;
    }

    if (cashTendered !== undefined) {
      ctx.fillText(`مبلغ دریافتی: ${formatToman(cashTendered)} تومان`, width - 35, y);
      y += 24;
      if (changeDue !== undefined && changeDue > 0) {
        ctx.fillText(`باقی‌مانده / برگشتی: ${formatToman(changeDue)} تومان`, width - 35, y);
        y += 24;
      }
    }
  }

  // Footer message
  y += 15;
  ctx.font = '17px Vazirmatn, Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('از همراهی شما با قهوه‌فروشی ۱۰۰هیچ سپاسگزاریم', width / 2, y);
  y += 25;
  ctx.font = '14px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText('نرم‌افزار مدیریت هوشمند کافه — CAFE OS', width / 2, y);

  return canvas;
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Converts a Canvas element to raw 576-dot ESC/POS raster byte buffer using GS v 0 command.
 */
export function convertCanvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const width = 576; // Standard 80mm printer dot width
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot get canvas context');

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const widthBytes = width / 8; // 72 bytes per raster row
  const rasterDataSize = widthBytes * height;

  // Header: GS v 0 m xL xH yL yH (8 bytes)
  // GS = 0x1D, v = 0x76, 0 = 0x30, m = 0x00
  const xL = widthBytes & 0xff; // 72
  const xH = (widthBytes >> 8) & 0xff; // 0
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const totalLength = ESC_INIT.length + 8 + rasterDataSize + ESC_CUT_PAPER.length;
  const buffer = new Uint8Array(totalLength);

  let offset = 0;

  // 1. Initialize
  buffer.set(ESC_INIT, offset);
  offset += ESC_INIT.length;

  // 2. GS v 0 Header
  buffer[offset++] = 0x1d; // GS
  buffer[offset++] = 0x76; // v
  buffer[offset++] = 0x30; // 0
  buffer[offset++] = 0x00; // m = 0 (Normal)
  buffer[offset++] = xL;
  buffer[offset++] = xH;
  buffer[offset++] = yL;
  buffer[offset++] = yH;

  // 3. Raster Pixel Bits (1 = Black, 0 = White)
  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        const pixelIdx = (y * width + x) * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        // Black pixel threshold (threshold 160)
        if (brightness < 160) {
          byteVal |= 0x80 >> bit;
        }
      }
      buffer[offset++] = byteVal;
    }
  }

  // 4. Cut command (GS V 65 16)
  buffer.set(ESC_CUT_PAPER, offset);

  return buffer;
}

/**
 * Direct WebUSB Printer Transport
 */
export async function printDirectWebUSB(rawBytes: Uint8Array): Promise<PrinterConnectResult> {
  if (typeof navigator === 'undefined' || !(navigator as any).usb) {
    throw new Error('WebUSB در این مرورگر پشتیبانی نمی‌شود.');
  }

  const usb = (navigator as any).usb;
  const device = await usb.requestDevice({ filters: [] });
  await device.open();

  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Claim the first interface
  const iface = device.configuration.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);

  // Find OUT endpoint for printer
  const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === 'out');
  if (!endpoint) {
    throw new Error('درگاه خروجی پرینتر USB یافت نشد.');
  }

  await device.transferOut(endpoint.endpointNumber, rawBytes);
  await device.close();

  return {
    success: true,
    type: 'WEB_USB',
    message: 'فیش فاکتور با موفقیت مستقیماً به پرینتر حرارتی ارسال شد.',
  };
}

/**
 * Direct Web Bluetooth Printer Transport
 */
export async function printDirectWebBluetooth(rawBytes: Uint8Array): Promise<PrinterConnectResult> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    throw new Error('Web Bluetooth در این مرورگر پشتیبانی نمی‌شود.');
  }

  const bt = (navigator as any).bluetooth;
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', 0xff00],
  });

  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  if (services.length === 0) {
    throw new Error('سرویس چاپ بلوتوث روی دستگاه پیدا نشد.');
  }

  const service = services[0];
  const characteristics = await service.getCharacteristics();
  const writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

  if (!writeChar) {
    throw new Error('کانال ارسال داده روی پرینتر بلوتوث یافت نشد.');
  }

  // Send in chunks of 512 bytes for Bluetooth MTU
  const chunkSize = 512;
  for (let i = 0; i < rawBytes.length; i += chunkSize) {
    const chunk = rawBytes.slice(i, i + chunkSize);
    await writeChar.writeValue(chunk);
  }

  return {
    success: true,
    type: 'WEB_BLUETOOTH',
    message: 'فاکتور با موفقیت از طریق بلوتوث چاپ شد.',
  };
}
