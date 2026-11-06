/**
 * VITEST SUITE — THERMAL RASTER GRAPHICS & ESC/POS LOGO ENGINE
 * Path: tests/rasterLogoRenderer.test.ts
 *
 * Verifies:
 * 1. 16x16 solid black block generation:
 *    - Validates ESC a 1 (centering), GS v 0 header bytes (m=0, xL=2, xH=0, yL=16, yH=0).
 *    - 32-byte payload consisting exclusively of 0xFF (black dots).
 *    - Reset to ESC a 0 (left align).
 * 2. 8x8 transparent alpha blending over white background:
 *    - Ensures alpha=0 renders as unprinted white space (0x00 bytes).
 * 3. 8x8 solid white block produces 0x00 payload.
 * 4. Floyd-Steinberg dithering execution on mid-gray gradients.
 * 5. Invert option behavior.
 * 6. Width clamping to maxPrinterDots (576 dots for 80mm roll).
 */

import { describe, it, expect } from 'vitest';
import { RasterLogoRenderer, PixelBuffer, RasterOptions } from '../src/hardware/rasterLogoRenderer';

describe('RasterLogoRenderer (ESC/POS GS v 0 Engine)', () => {
  it('converts a 16x16 solid black square into valid GS v 0 raster buffer with 0xFF payload', () => {
    const width = 16;
    const height = 16;
    const data = new Uint8Array(width * height * 4);

    // Fill with solid opaque black RGBA(0, 0, 0, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;     // R
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
      data[i + 3] = 255; // A
    }

    const pixels: PixelBuffer = { width, height, data };
    const buffer = RasterLogoRenderer.toEscPosRaster(pixels, {
      centerAlign: true,
      dither: false,
    });

    // 1. Alignment prefix: ESC a 1 [0x1B, 0x61, 0x01]
    expect(buffer[0]).toBe(0x1b);
    expect(buffer[1]).toBe(0x61);
    expect(buffer[2]).toBe(0x01);

    // 2. GS v 0 Header: [0x1D, 0x76, 0x30, m, xL, xH, yL, yH]
    expect(buffer[3]).toBe(0x1d); // GS
    expect(buffer[4]).toBe(0x76); // v
    expect(buffer[5]).toBe(0x30); // 0
    expect(buffer[6]).toBe(0x00); // m = 0 (Normal 203 DPI)
    expect(buffer[7]).toBe(0x02); // xL = 2 bytes (16 dots / 8)
    expect(buffer[8]).toBe(0x00); // xH = 0
    expect(buffer[9]).toBe(0x10); // yL = 16 dots
    expect(buffer[10]).toBe(0x00); // yH = 0

    // 3. Payload: 2 bytes * 16 rows = 32 bytes. All pixels are black => 0xFF.
    const payloadStart = 11;
    const payloadLength = 32;
    const payload = buffer.subarray(payloadStart, payloadStart + payloadLength);
    expect(payload.length).toBe(32);
    for (let i = 0; i < payload.length; i++) {
      expect(payload[i]).toBe(0xff);
    }

    // 4. Alignment suffix: ESC a 0 [0x1B, 0x61, 0x00]
    const suffixStart = payloadStart + payloadLength;
    expect(buffer[suffixStart]).toBe(0x1b);
    expect(buffer[suffixStart + 1]).toBe(0x61);
    expect(buffer[suffixStart + 2]).toBe(0x00);

    // Total length: 3 + 8 + 32 + 3 = 46 bytes
    expect(buffer.length).toBe(46);
  });

  it('renders transparent pixels (alpha = 0) as blank white space (0x00 bytes)', () => {
    const width = 8;
    const height = 8;
    const data = new Uint8Array(width * height * 4);

    // Transparent black: RGBA(0, 0, 0, 0)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0; // Alpha = 0 (transparent)
    }

    const pixels: PixelBuffer = { width, height, data };
    const buffer = RasterLogoRenderer.toEscPosRaster(pixels, {
      centerAlign: false,
      dither: false,
    });

    // Alignment prefix: ESC a 0 [0x1B, 0x61, 0x00]
    expect(buffer[0]).toBe(0x1b);
    expect(buffer[1]).toBe(0x61);
    expect(buffer[2]).toBe(0x00);

    // GS v 0 header
    expect(buffer[3]).toBe(0x1d);
    expect(buffer[7]).toBe(0x01); // xL = 1 byte (8 dots)
    expect(buffer[9]).toBe(0x08); // yL = 8 dots

    // Payload: 8 bytes of 0x00 (pure white background)
    const payload = buffer.subarray(11, 11 + 8);
    for (let i = 0; i < payload.length; i++) {
      expect(payload[i]).toBe(0x00);
    }
  });

  it('correctly inverts monochrome output when invert: true', () => {
    const width = 8;
    const height = 1;
    const data = new Uint8Array(width * height * 4);

    // Solid black
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    const pixels: PixelBuffer = { width, height, data };
    const invertedBuffer = RasterLogoRenderer.toEscPosRaster(pixels, {
      centerAlign: false,
      dither: false,
      invert: true,
    });

    // Inverted black becomes white => 0x00
    const payload = invertedBuffer.subarray(11, 12);
    expect(payload[0]).toBe(0x00);
  });

  it('applies Floyd-Steinberg dithering on mid-gray gradients to avoid harsh solid cutoffs', () => {
    const width = 16;
    const height = 16;
    const data = new Uint8Array(width * height * 4);

    // Mid-gray RGBA(128, 128, 128, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }

    const pixels: PixelBuffer = { width, height, data };
    const ditheredBuffer = RasterLogoRenderer.toEscPosRaster(pixels, {
      centerAlign: false,
      dither: true,
      threshold: 128,
    });

    const payload = ditheredBuffer.subarray(11, 11 + 32);

    // In a dithered 128-gray image, we should see both 1s and 0s distributed
    // i.e., neither all 0x00 nor all 0xFF
    let hasZero = false;
    let hasNonZero = false;
    let hasPartialByte = false;

    for (let i = 0; i < payload.length; i++) {
      if (payload[i] === 0x00) hasZero = true;
      if (payload[i] === 0xff) hasNonZero = true;
      if (payload[i] !== 0x00 && payload[i] !== 0xff) hasPartialByte = true;
    }

    // Error diffusion must create a dispersed pattern (mixed bytes like 0xAA, 0x55, etc.)
    expect(hasPartialByte || (hasZero && hasNonZero)).toBe(true);
  });

  it('clamps width to maxPrinterDots (e.g. 576 dots for 80mm roll)', () => {
    const width = 600; // Exceeds 576
    const height = 2;
    const data = new Uint8Array(width * height * 4);

    const pixels: PixelBuffer = { width, height, data };
    const buffer = RasterLogoRenderer.toEscPosRaster(pixels, {
      maxPrinterDots: 576,
    });

    // Target width clamped to 576 dots => 576 / 8 = 72 bytes
    const xL = buffer[7];
    const xH = buffer[8];
    const xBytes = xL | (xH << 8);

    expect(xBytes).toBe(72);
  });

  it('pads horizontal pixels to 8-bit byte boundary when width is not divisible by 8', () => {
    const width = 10; // 10 dots => ceil(10/8) = 2 bytes (16 padded dots)
    const height = 2;
    const data = new Uint8Array(width * height * 4);

    // Fill with solid black
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    const pixels: PixelBuffer = { width, height, data };
    const buffer = RasterLogoRenderer.toEscPosRaster(pixels, {
      centerAlign: false,
      dither: false,
    });

    const xL = buffer[7];
    expect(xL).toBe(2); // 2 bytes per line

    // Line 1: first byte has 8 bits black (0xFF), second byte has 2 bits black + 6 bits padded white
    // 2 bits set at MSB = 0b11000000 = 0xC0
    const payload = buffer.subarray(11, 11 + 4);
    expect(payload[0]).toBe(0xff);
    expect(payload[1]).toBe(0xc0);
    expect(payload[2]).toBe(0xff);
    expect(payload[3]).toBe(0xc0);
  });
});
