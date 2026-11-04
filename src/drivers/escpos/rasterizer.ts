/**
 * CAFE OS — ESC/POS 203 DPI Monochrome Canvas & Bitmap Rasterizer Driver
 * Path: src/drivers/escpos/rasterizer.ts
 *
 * Implements:
 * 1. 203 DPI (8 dots/mm) monochrome conversion for 80mm (576 dots) & 58mm (384 dots) rolls.
 * 2. Thresholding and Floyd-Steinberg error diffusion dithering for graphics & typography.
 * 3. 1-bit per pixel bit-packing (MSB first, 8 pixels per byte, 1 = black, 0 = white).
 * 4. GS v 0 (Raster Bit Image) ESC/POS command generation.
 * 5. Full-ticket paper feed & cut sequence.
 */

export interface RasterizerOptions {
  paperWidthMm?: 80 | 58;
  dotsPerLine?: number;
  dithering?: 'threshold' | 'floyd-steinberg';
  threshold?: number; // 0-255, default 128
  mode?: 0 | 1 | 2 | 3; // 0: Normal, 1: Double-width, 2: Double-height, 3: Quadruple
  feedLines?: number;
  cutPaper?: boolean;
}

export interface RawPixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export class EscPosRasterizer {
  public static readonly DPI = 203;
  public static readonly DOTS_80MM = 576;
  public static readonly DOTS_58MM = 384;

  /**
   * Rasterizes raw RGBA pixel data into a complete ESC/POS binary stream.
   */
  public static rasterizePixelBuffer(
    buffer: RawPixelBuffer,
    options: RasterizerOptions = {}
  ): Uint8Array {
    const {
      paperWidthMm = 80,
      dotsPerLine = paperWidthMm === 80 ? this.DOTS_80MM : this.DOTS_58MM,
      dithering = 'floyd-steinberg',
      threshold = 128,
      mode = 0,
      feedLines = 3,
      cutPaper = true,
    } = options;

    const width = buffer.width;
    const height = buffer.height;

    // 1. Convert RGBA to Grayscale
    const grayscale = this.rgbaToGrayscale(buffer.data, width, height);

    // 2. Apply Binarization / Dithering (1 = Black dot, 0 = White)
    const binary = dithering === 'floyd-steinberg'
      ? this.applyFloydSteinbergDithering(grayscale, width, height)
      : this.applyThresholdDithering(grayscale, width, height, threshold);

    // 3. Pack 8 horizontal bits into 1 byte (MSB first)
    // Width in bytes must be rounded up to whole byte boundary
    const widthInBytes = Math.ceil(width / 8);
    const packedBytes = this.packBits(binary, width, height, widthInBytes);

    // 4. Build ESC/POS command buffer
    const chunks: number[] = [];

    // Initialize Printer: ESC @ [0x1B, 0x40]
    chunks.push(0x1b, 0x40);

    // Center Alignment: ESC a 1 [0x1B, 0x61, 0x01]
    chunks.push(0x1b, 0x61, 0x01);

    // GS v 0 <m> <xL> <xH> <yL> <yH> <data...>
    // xL, xH: number of horizontal bytes
    // yL, yH: number of vertical dots
    const xL = widthInBytes & 0xff;
    const xH = (widthInBytes >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    chunks.push(0x1d, 0x76, 0x30, mode, xL, xH, yL, yH);

    // Append packed bitmap data
    for (let i = 0; i < packedBytes.length; i++) {
      chunks.push(packedBytes[i]);
    }

    // Feed lines: ESC d <n>
    if (feedLines > 0) {
      chunks.push(0x1b, 0x64, Math.min(feedLines, 10));
    }

    // Cut Paper: GS V 0 [0x1D, 0x56, 0x00]
    if (cutPaper) {
      chunks.push(0x1d, 0x56, 0x00);
    }

    return new Uint8Array(chunks);
  }

  /**
   * Rasterize an HTMLCanvasElement (in browser environments).
   */
  public static rasterizeCanvas(
    canvas: { width: number; height: number; getContext: (type: string) => any },
    options: RasterizerOptions = {}
  ): Uint8Array {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('EscPosRasterizer: Failed to acquire 2D rendering context from canvas');
    }
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return this.rasterizePixelBuffer({
      width: canvas.width,
      height: canvas.height,
      data: imgData.data,
    }, options);
  }

  /**
   * Converts RGBA pixel data to 8-bit luminance grayscale [0..255].
   * Standard ITU-R BT.601 coefficients: 0.299 R + 0.587 G + 0.114 B.
   */
  private static rgbaToGrayscale(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number
  ): Float32Array {
    const totalPixels = width * height;
    const grayscale = new Float32Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const a = rgba[idx + 3] / 255;

      // Blend over white background for transparent pixels
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
      grayscale[i] = lum;
    }

    return grayscale;
  }

  /**
   * Simple threshold binarization.
   * Luminance < threshold => 1 (Dot/Black), else 0 (White).
   */
  private static applyThresholdDithering(
    grayscale: Float32Array,
    width: number,
    height: number,
    threshold: number
  ): Uint8Array {
    const total = width * height;
    const binary = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      binary[i] = grayscale[i] < threshold ? 1 : 0;
    }
    return binary;
  }

  /**
   * Floyd-Steinberg error diffusion dithering.
   * Preserves gradients and detailed Persian typography strokes.
   */
  private static applyFloydSteinbergDithering(
    grayscale: Float32Array,
    width: number,
    height: number
  ): Uint8Array {
    // Clone array to allow in-place error diffusion
    const buffer = new Float32Array(grayscale);
    const binary = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldPixel = buffer[idx];
        const newPixel = oldPixel < 128 ? 0 : 255;
        binary[idx] = newPixel === 0 ? 1 : 0; // 1 = Black dot, 0 = White
        const quantError = oldPixel - newPixel;

        // Distribute quantization error to neighboring pixels:
        //      *    7/16
        // 3/16 5/16 1/16
        if (x + 1 < width) {
          buffer[idx + 1] += (quantError * 7) / 16;
        }
        if (y + 1 < height) {
          if (x > 0) {
            buffer[idx + width - 1] += (quantError * 3) / 16;
          }
          buffer[idx + width] += (quantError * 5) / 16;
          if (x + 1 < width) {
            buffer[idx + width + 1] += (quantError * 1) / 16;
          }
        }
      }
    }

    return binary;
  }

  /**
   * Packs 1-bit binary dot array into ESC/POS MSB-first format:
   * Bit 7 is leftmost dot, Bit 0 is rightmost dot in each byte.
   */
  private static packBits(
    binaryDots: Uint8Array,
    width: number,
    height: number,
    widthInBytes: number
  ): Uint8Array {
    const packed = new Uint8Array(widthInBytes * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dot = binaryDots[y * width + x];
        if (dot === 1) {
          const byteIdx = y * widthInBytes + (x >> 3);
          const bitPos = 7 - (x & 7); // MSB first
          packed[byteIdx] |= (1 << bitPos);
        }
      }
    }

    return packed;
  }
}
