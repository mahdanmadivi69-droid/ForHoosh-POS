/**
 * CAFE OS ?" ESC/POS RASTER GRAPHICS & THERMAL LOGO ENGINE
 * Path: src/hardware/rasterLogoRenderer.ts
 *
 * Implements:
 * 1. 1-bit monochrome raster quantization for thermal receipt printers.
 * 2. BT.601 luminance conversion (0.299R + 0.587G + 0.114B) with alpha blending over white.
 * 3. Floyd-Steinberg error diffusion dithering for smooth gradients and photographic fidelity.
 * 4. GS v 0 (0x1D, 0x76, 0x30) standard density raster opcode encoding (203 DPI).
 * 5. Horizontal byte-alignment (8 pixels per byte) and roll width clamping (576 dots on 80mm).
 */

export interface RasterOptions {
  threshold?: number;          // Luminance cutoff 0-255 (default: 128)
  dither?: boolean;            // Enable Floyd-Steinberg error diffusion (default: true)
  centerAlign?: boolean;       // Center the raster image on 80mm roll (576 dots)
  maxPrinterDots?: number;     // 576 dots for 80mm, 384 dots for 58mm
  invert?: boolean;            // Invert black/white
}

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array; // Raw RGBA bytes (4 bytes per pixel)
}

export class RasterLogoRenderer {
  private static readonly GS = 0x1d;
  private static readonly CMD_RASTER = [0x1d, 0x76, 0x30]; // GS v 0

  /**
   * Converts RGBA pixel data into ESC/POS GS v 0 raw binary command buffer.
   */
  public static toEscPosRaster(pixels: PixelBuffer, options: RasterOptions = {}): Buffer {
    const {
      threshold = 128,
      dither = true,
      centerAlign = true,
      maxPrinterDots = 576,
      invert = false,
    } = options;

    const srcWidth = pixels.width;
    const srcHeight = pixels.height;

    // 1. Calculate horizontal byte width (aligned to 8 pixels)
    const targetWidth = Math.min(srcWidth, maxPrinterDots);
    const xBytes = Math.ceil(targetWidth / 8);
    const paddedWidth = xBytes * 8; // Width aligned to 8-bit boundaries
    const yHeight = srcHeight;

    // 2. Convert to Grayscale luminance array (BT.601 standard)
    const gray = new Float32Array(paddedWidth * yHeight);
    for (let y = 0; y < yHeight; y++) {
      for (let x = 0; x < paddedWidth; x++) {
        if (x < srcWidth) {
          const idx = (y * srcWidth + x) * 4;
          const r = pixels.data[idx];
          const g = pixels.data[idx + 1];
          const b = pixels.data[idx + 2];
          const a = pixels.data[idx + 3];

          // Alpha blending on white background
          if (a === 0) {
            gray[y * paddedWidth + x] = 255;
          } else {
            const alpha = a / 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            gray[y * paddedWidth + x] = lum * alpha + 255 * (1 - alpha);
          }
        } else {
          gray[y * paddedWidth + x] = 255; // Pad with white
        }
      }
    }

    // 3. 1-bit Quantization (Floyd-Steinberg Dithering or Threshold)
    const bitmap = new Uint8Array(paddedWidth * yHeight);

    if (dither) {
      for (let y = 0; y < yHeight; y++) {
        for (let x = 0; x < paddedWidth; x++) {
          const idx = y * paddedWidth + x;
          const oldVal = gray[idx];
          const newVal = oldVal < threshold ? 0 : 255;
          bitmap[idx] = newVal === 0 ? (invert ? 0 : 1) : (invert ? 1 : 0);

          const err = oldVal - newVal;

          // Diffuse quantization error to neighboring pixels
          if (x + 1 < paddedWidth) {
            gray[idx + 1] += (err * 7) / 16;
          }
          if (x - 1 >= 0 && y + 1 < yHeight) {
            gray[(y + 1) * paddedWidth + (x - 1)] += (err * 3) / 16;
          }
          if (y + 1 < yHeight) {
            gray[(y + 1) * paddedWidth + x] += (err * 5) / 16;
          }
          if (x + 1 < paddedWidth && y + 1 < yHeight) {
            gray[(y + 1) * paddedWidth + (x + 1)] += (err * 1) / 16;
          }
        }
      }
    } else {
      for (let i = 0; i < gray.length; i++) {
        bitmap[i] = gray[i] < threshold ? (invert ? 0 : 1) : (invert ? 1 : 0);
      }
    }

    // 4. Pack 1-bit pixels into 8-bit bytes (MSB first)
    const rawData = new Uint8Array(xBytes * yHeight);
    for (let y = 0; y < yHeight; y++) {
      for (let xByte = 0; xByte < xBytes; xByte++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = xByte * 8 + bit;
          const pixelBit = bitmap[y * paddedWidth + pixelX];
          if (pixelBit === 1) {
            byteVal |= 0x80 >> bit; // High bit is leftmost pixel
          }
        }
        rawData[y * xBytes + xByte] = byteVal;
      }
    }

    // 5. Construct ESC/POS GS v 0 binary envelope
    // Format: GS v 0 m xL xH yL yH d1...dk
    const m = 0; // Mode 0 = Normal density (203 DPI)
    const xL = xBytes & 0xff;
    const xH = (xBytes >> 8) & 0xff;
    const yL = yHeight & 0xff;
    const yH = (yHeight >> 8) & 0xff;

    const header = Buffer.from([
      this.GS,
      0x76,
      0x30,
      m,
      xL,
      xH,
      yL,
      yH,
    ]);

    const alignmentCommand = centerAlign
      ? Buffer.from([0x1b, 0x61, 0x01]) // ESC a 1 (Center)
      : Buffer.from([0x1b, 0x61, 0x00]); // ESC a 0 (Left)

    return Buffer.concat([
      alignmentCommand,
      header,
      Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength),
      Buffer.from([0x1b, 0x61, 0x00]), // Reset to Left align
    ]);
  }
}
