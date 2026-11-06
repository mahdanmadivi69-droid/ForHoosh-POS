/**
 * VITEST SUITE — IMAGE LOADER & ZERO-DEPENDENCY DECODER
 * Path: tests/imageLoader.test.ts
 *
 * Verifies:
 * 1. Base64 Data URI header stripping and PNG magic byte validation (0x89, 0x50, 0x4E, 0x47).
 * 2. Strict RGBA buffer dimension validation in createPixelBuffer.
 * 3. Pure Node.js PNG decoding (IHDR and IDAT chunks) via decodePng.
 * 4. Automatic fallback in fromBrowserSource when running in Node.js daemon environment.
 * 5. Full receipt generation with logo via generateReceiptWithLogo.
 */

import { describe, it, expect } from 'vitest';
import { ImageLoader } from '../src/hardware/imageLoader';
import { generateReceiptWithLogo } from '../src/services/printerBridge';
import { PersianReceiptLine } from '../src/hardware/persianEscPos';

describe('ImageLoader Helpers', () => {
  const sample1x1PngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('should clean base64 data URI header and return valid Buffer', () => {
    const buffer = ImageLoader.fromBase64ToBuffer(sample1x1PngBase64);

    expect(buffer).toBeInstanceOf(Buffer);
    // Check PNG magic bytes (0x89, 0x50, 0x4E, 0x47)
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });

  it('should validate RGBA buffer dimensions strictly', () => {
    const width = 2;
    const height = 2;
    const validData = new Uint8Array(2 * 2 * 4); // 16 bytes

    const pixelBuffer = ImageLoader.createPixelBuffer(width, height, validData);
    expect(pixelBuffer.width).toBe(2);
    expect(pixelBuffer.height).toBe(2);
    expect(pixelBuffer.data.length).toBe(16);

    const invalidData = new Uint8Array(10);
    expect(() => ImageLoader.createPixelBuffer(width, height, invalidData)).toThrow(
      /Invalid RGBA buffer length/
    );
  });

  it('should decode 1x1 PNG IDAT stream to PixelBuffer in pure Node.js', () => {
    const buffer = ImageLoader.fromBase64ToBuffer(sample1x1PngBase64);
    const pixels = ImageLoader.decodePng(buffer);

    expect(pixels.width).toBe(1);
    expect(pixels.height).toBe(1);
    expect(pixels.data.length).toBe(4); // 1 pixel * 4 bytes (RGBA)
  });

  it('should load image via fromBrowserSource in Node.js daemon fallback mode', async () => {
    const pixels = await ImageLoader.fromBrowserSource(sample1x1PngBase64);
    expect(pixels.width).toBe(1);
    expect(pixels.height).toBe(1);
    expect(pixels.data.length).toBe(4);
  });

  it('should generate complete Persian ESC/POS ticket with raster logo via generateReceiptWithLogo', async () => {
    const items: PersianReceiptLine[] = [
      { name: 'لاته', quantity: 2, notes: 'شیر کم چرب', priceToman: 95000 },
      { name: 'اسپرسو دبل', quantity: 1, priceToman: 60000 },
    ];

    const ticketBuffer = await generateReceiptWithLogo(
      sample1x1PngBase64,
      '501',
      'میز ۷',
      items
    );

    expect(ticketBuffer).toBeInstanceOf(Buffer);
    expect(ticketBuffer.length).toBeGreaterThan(50);

    // Initialized with ESC @ and Font B ESC M 1
    expect(ticketBuffer[0]).toBe(0x1b);
    expect(ticketBuffer[1]).toBe(0x40);
    expect(ticketBuffer[2]).toBe(0x1b);
    expect(ticketBuffer[3]).toBe(0x4d);
    expect(ticketBuffer[4]).toBe(0x01);

    // Contains ESC/POS GS v 0 raster command (0x1D, 0x76, 0x30)
    let hasRasterCmd = false;
    for (let i = 0; i < ticketBuffer.length - 2; i++) {
      if (
        ticketBuffer[i] === 0x1d &&
        ticketBuffer[i + 1] === 0x76 &&
        ticketBuffer[i + 2] === 0x30
      ) {
        hasRasterCmd = true;
        break;
      }
    }
    expect(hasRasterCmd).toBe(true);

    // Paper cut footer: GS V 0 (0x1D, 0x56, 0x00)
    const len = ticketBuffer.length;
    expect(ticketBuffer[len - 3]).toBe(0x1d);
    expect(ticketBuffer[len - 2]).toBe(0x56);
    expect(ticketBuffer[len - 1]).toBe(0x00);
  });

  it('should gracefully fall back to text header when logoBase64 is null', async () => {
    const items: PersianReceiptLine[] = [
      { name: 'چای دمی', quantity: 1, priceToman: 40000 },
    ];

    const ticketBuffer = await generateReceiptWithLogo(
      null,
      '502',
      'میز ۳',
      items
    );

    expect(ticketBuffer).toBeInstanceOf(Buffer);
    expect(ticketBuffer.length).toBeGreaterThan(30);

    // Starts with ESC @
    expect(ticketBuffer[0]).toBe(0x1b);
    expect(ticketBuffer[1]).toBe(0x40);

    // Ends with paper cut GS V 0
    const len = ticketBuffer.length;
    expect(ticketBuffer[len - 3]).toBe(0x1d);
    expect(ticketBuffer[len - 2]).toBe(0x56);
    expect(ticketBuffer[len - 1]).toBe(0x00);
  });
});
