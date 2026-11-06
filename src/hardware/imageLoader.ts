/**
 * CAFE OS — Hardware Image Loader & Zero-Dependency Decoder
 * Path: src/hardware/imageLoader.ts
 *
 * Implements:
 * 1. fromBrowserSource(src, maxWidth): HTML5 Canvas / Image decoding in Browser / Electron / WebView.
 * 2. fromBase64ToBuffer(base64): Cleans Data URI and returns standard Node.js Buffer.
 * 3. decodePng(buffer): Pure JS PNG decoder utilizing Node's built-in zlib (IHDR/IDAT parsing).
 * 4. createPixelBuffer(width, height, rgbaData): Strict validation and PixelBuffer wrapper.
 */

import zlib from 'zlib';
import { PixelBuffer } from './rasterLogoRenderer';

export class ImageLoader {
  /**
   * Helper A: Loads an image from Base64 or URL in Browser / WebView environment.
   * Uses native HTML5 Image and Canvas for zero-dependency RGBA extraction.
   * When running in Node.js daemon (where window/document is undefined),
   * falls back automatically to pure Node.js PNG decoding if source is Base64 PNG.
   */
  public static async fromBrowserSource(
    src: string,
    maxWidth = 576
  ): Promise<PixelBuffer> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // In pure Node.js runtime fallback:
      if (src.startsWith('data:image/png;base64,') || /^[A-Za-z0-9+/=\s]+$/.test(src)) {
        const buffer = this.fromBase64ToBuffer(src);
        return this.decodePng(buffer);
      }
      throw new Error('fromBrowserSource requires a browser/DOM environment (window/document)');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Auto-scale down proportionally if wider than thermal roll width (576 dots for 80mm)
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          return reject(new Error('Failed to acquire 2D canvas context'));
        }

        // Fill background white to handle transparent PNGs cleanly
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        resolve({
          width: imageData.width,
          height: imageData.height,
          data: imageData.data, // Uint8ClampedArray (RGBA)
        });
      };

      img.onerror = (err) => reject(new Error(`Failed to load image resource: ${err}`));
      img.src = src;
    });
  }

  /**
   * Helper B: Decodes raw PNG buffer or Base64 string in Node.js daemon (printerBridge)
   * Lightweight pure JS parser (reads PNG IHDR & IDAT chunks without native canvas binary)
   */
  public static fromBase64ToBuffer(base64: string): Buffer {
    // Strip Data URI scheme if present (e.g. data:image/png;base64,...)
    const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
    return Buffer.from(cleanBase64, 'base64');
  }

  /**
   * Helper C: Converts RGBA buffer directly from standard 8-bit Raw pixels
   */
  public static createPixelBuffer(
    width: number,
    height: number,
    rgbaData: Uint8Array | Uint8ClampedArray
  ): PixelBuffer {
    if (rgbaData.length !== width * height * 4) {
      throw new Error(
        `Invalid RGBA buffer length. Expected ${width * height * 4}, got ${rgbaData.length}`
      );
    }

    return {
      width,
      height,
      data: rgbaData,
    };
  }

  /**
   * Helper D: Pure Node.js PNG decoder (zero C++ dependencies, uses built-in zlib).
   * Parses PNG IHDR and IDAT chunks to produce raw 32-bit RGBA PixelBuffer.
   */
  public static decodePng(buffer: Buffer): PixelBuffer {
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47
    ) {
      throw new Error('Invalid PNG header signature');
    }

    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 8;
    let colorType = 6;
    const idatChunks: Buffer[] = [];

    while (pos + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(pos);
      const type = buffer.subarray(pos + 4, pos + 8).toString('ascii');
      const chunkDataStart = pos + 8;
      const chunkDataEnd = chunkDataStart + length;

      if (chunkDataEnd + 4 > buffer.length) {
        break;
      }

      if (type === 'IHDR') {
        width = buffer.readUInt32BE(chunkDataStart);
        height = buffer.readUInt32BE(chunkDataStart + 4);
        bitDepth = buffer[chunkDataStart + 8];
        colorType = buffer[chunkDataStart + 9];
      } else if (type === 'IDAT') {
        idatChunks.push(buffer.subarray(chunkDataStart, chunkDataEnd));
      } else if (type === 'IEND') {
        break;
      }

      pos = chunkDataEnd + 4; // Skip CRC
    }

    if (width === 0 || height === 0) {
      throw new Error('Failed to parse PNG dimensions from IHDR');
    }

    if (bitDepth !== 8) {
      throw new Error(`Unsupported PNG bit depth: ${bitDepth}. Expected 8-bit.`);
    }

    // Bytes per pixel in uncompressed scanline
    let bpp = 4;
    if (colorType === 0) bpp = 1;      // Grayscale
    else if (colorType === 2) bpp = 3; // RGB
    else if (colorType === 4) bpp = 2; // Gray + Alpha
    else if (colorType === 6) bpp = 4; // RGBA
    else {
      throw new Error(`Unsupported PNG color type: ${colorType}`);
    }

    const compressed = Buffer.concat(idatChunks);
    const uncompressed = zlib.inflateSync(compressed);

    const scanlineLength = width * bpp;
    const expectedLength = height * (1 + scanlineLength);

    if (uncompressed.length < expectedLength) {
      throw new Error('Corrupted or truncated PNG IDAT stream');
    }

    const rawRgba = new Uint8Array(width * height * 4);
    const prevRow = new Uint8Array(scanlineLength);
    const currRow = new Uint8Array(scanlineLength);

    function paethPredictor(a: number, b: number, c: number): number {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      if (pb <= pc) return b;
      return c;
    }

    let srcOffset = 0;
    for (let y = 0; y < height; y++) {
      const filterType = uncompressed[srcOffset++];
      for (let x = 0; x < scanlineLength; x++) {
        const raw = uncompressed[srcOffset++];
        const a = x >= bpp ? currRow[x - bpp] : 0;
        const b = prevRow[x];
        const c = x >= bpp ? prevRow[x - bpp] : 0;

        let val = 0;
        switch (filterType) {
          case 0: // None
            val = raw;
            break;
          case 1: // Sub
            val = (raw + a) & 0xff;
            break;
          case 2: // Up
            val = (raw + b) & 0xff;
            break;
          case 3: // Average
            val = (raw + Math.floor((a + b) / 2)) & 0xff;
            break;
          case 4: // Paeth
            val = (raw + paethPredictor(a, b, c)) & 0xff;
            break;
          default:
            val = raw;
        }
        currRow[x] = val;
      }

      // Convert scanline to RGBA
      const dstRowOffset = y * width * 4;
      for (let px = 0; px < width; px++) {
        const dstIdx = dstRowOffset + px * 4;
        const srcIdx = px * bpp;

        if (colorType === 6) {
          // RGBA
          rawRgba[dstIdx] = currRow[srcIdx];
          rawRgba[dstIdx + 1] = currRow[srcIdx + 1];
          rawRgba[dstIdx + 2] = currRow[srcIdx + 2];
          rawRgba[dstIdx + 3] = currRow[srcIdx + 3];
        } else if (colorType === 2) {
          // RGB
          rawRgba[dstIdx] = currRow[srcIdx];
          rawRgba[dstIdx + 1] = currRow[srcIdx + 1];
          rawRgba[dstIdx + 2] = currRow[srcIdx + 2];
          rawRgba[dstIdx + 3] = 255;
        } else if (colorType === 0) {
          // Grayscale
          const g = currRow[srcIdx];
          rawRgba[dstIdx] = g;
          rawRgba[dstIdx + 1] = g;
          rawRgba[dstIdx + 2] = g;
          rawRgba[dstIdx + 3] = 255;
        } else if (colorType === 4) {
          // Gray + Alpha
          const g = currRow[srcIdx];
          rawRgba[dstIdx] = g;
          rawRgba[dstIdx + 1] = g;
          rawRgba[dstIdx + 2] = g;
          rawRgba[dstIdx + 3] = currRow[srcIdx + 1];
        }
      }

      prevRow.set(currRow);
    }

    return {
      width,
      height,
      data: rawRgba,
    };
  }
}
