/**
 * CAFE OS — Virtual ESC/POS Thermal Printer & Receipt Stream Validator
 * Path: tests/virtualEscPosPrinter.ts
 *
 * Emulates Gate 4 (Physical Hardware Acceptance) in software:
 * 1. 576-dot raster byte stream validation for standard 80mm thermal printers (203 DPI, 72 bytes/row).
 * 2. Full ESC/POS opcode parser, state machine, and command invariant validation.
 * 3. Validation of production KDS ticket layout buffers and Shift Closeout Z-Reports.
 * 4. Hardware fault simulation and malformed stream rejection.
 */

import {
  TicketLayoutEngine,
  ESC_POS_COMMANDS,
  TICKET_SPEC,
} from '../src/templates/KitchenTicketTemplate';
import { ShiftCloseoutService } from '../src/services/ShiftCloseoutService';
import { convertCanvasToEscPosRaster } from '../src/services/escposThermalPrinter';

// =============================================================================
// Virtual ESC/POS Printer Types & Definitions
// =============================================================================

export type TextJustification = 'left' | 'center' | 'right';
export type CutType = 'full' | 'partial' | 'feed_and_cut';

export interface RasterImageDescriptor {
  widthDots: number;
  widthBytes: number;
  heightDots: number;
  mode: number;
  dataSize: number;
  blackPixelCount: number;
  whitePixelCount: number;
  density: number; // black / total
  bits: Uint8Array;
}

export interface VirtualPrinterState {
  isInitialized: boolean;
  justification: TextJustification;
  isBold: boolean;
  isDoubleStrike: boolean;
  charSize: {
    widthMultiplier: number;
    heightMultiplier: number;
  };
  isCut: boolean;
  cutType?: CutType;
  feedLinesAfterCut?: number;
  opcodesSeen: string[];
  printedText: string;
  rasterImages: RasterImageDescriptor[];
}

export interface StreamValidationResult {
  isValid: boolean;
  state: VirtualPrinterState;
  errors: string[];
  warnings: string[];
}

export interface Raster576ValidationResult {
  isValid: boolean;
  widthDots: number;
  widthBytes: number;
  heightDots: number;
  totalBytes: number;
  rasterPayloadBytes: number;
  hasInit: boolean;
  hasCut: boolean;
  errors: string[];
}

// =============================================================================
// Virtual ESC/POS Printer Hardware Emulator
// =============================================================================

export class VirtualEscPosPrinter {
  public static readonly DOTS_PER_LINE_80MM = 576;
  public static readonly BYTES_PER_LINE_80MM = 72; // 576 / 8

  private state: VirtualPrinterState = this.createDefaultState();
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.state = this.createDefaultState();
    this.errors = [];
    this.warnings = [];
  }

  private createDefaultState(): VirtualPrinterState {
    return {
      isInitialized: false,
      justification: 'left',
      isBold: false,
      isDoubleStrike: false,
      charSize: { widthMultiplier: 1, heightMultiplier: 1 },
      isCut: false,
      opcodesSeen: [],
      printedText: '',
      rasterImages: [],
    };
  }

  public getState(): Readonly<VirtualPrinterState> {
    return this.state;
  }

  /**
   * Parses an ESC/POS binary byte stream, tracking printer hardware state.
   */
  public parseStream(buffer: Uint8Array): StreamValidationResult {
    this.reset();
    let offset = 0;
    const len = buffer.length;
    const decoder = new TextDecoder('utf-8', { fatal: false });

    while (offset < len) {
      const b = buffer[offset];

      // 1. ESC Opcodes (0x1B)
      if (b === 0x1b) {
        if (offset + 1 >= len) {
          this.errors.push(`Premature end of stream after ESC at offset ${offset}`);
          break;
        }
        const b2 = buffer[offset + 1];

        // ESC @ (0x1B 0x40): Initialize
        if (b2 === 0x40) {
          this.state.isInitialized = true;
          this.state.justification = 'left';
          this.state.isBold = false;
          this.state.isDoubleStrike = false;
          this.state.charSize = { widthMultiplier: 1, heightMultiplier: 1 };
          this.state.opcodesSeen.push('ESC_INIT');
          offset += 2;
          continue;
        }

        // ESC a (0x1B 0x61 n): Justification
        if (b2 === 0x61) {
          if (offset + 2 >= len) {
            this.errors.push(`Missing parameter for ESC a at offset ${offset}`);
            break;
          }
          const n = buffer[offset + 2];
          if (n === 0 || n === 48) this.state.justification = 'left';
          else if (n === 1 || n === 49) this.state.justification = 'center';
          else if (n === 2 || n === 50) this.state.justification = 'right';
          else this.warnings.push(`Unknown justification code ${n} for ESC a`);

          this.state.opcodesSeen.push(`ESC_ALIGN_${this.state.justification.toUpperCase()}`);
          offset += 3;
          continue;
        }

        // ESC E (0x1B 0x45 n): Emphasized (Bold) mode
        if (b2 === 0x45) {
          if (offset + 2 >= len) {
            this.errors.push(`Missing parameter for ESC E at offset ${offset}`);
            break;
          }
          const n = buffer[offset + 2];
          this.state.isBold = n === 1 || n === 49;
          this.state.opcodesSeen.push(`ESC_BOLD_${this.state.isBold ? 'ON' : 'OFF'}`);
          offset += 3;
          continue;
        }

        // ESC G (0x1B 0x47 n): Double-strike mode
        if (b2 === 0x47) {
          if (offset + 2 >= len) {
            this.errors.push(`Missing parameter for ESC G at offset ${offset}`);
            break;
          }
          const n = buffer[offset + 2];
          this.state.isDoubleStrike = n === 1 || n === 49;
          this.state.opcodesSeen.push(`ESC_DOUBLE_STRIKE_${this.state.isDoubleStrike ? 'ON' : 'OFF'}`);
          offset += 3;
          continue;
        }

        // Unknown ESC command
        this.warnings.push(`Unhandled ESC command: 0x1B 0x${b2.toString(16)} at offset ${offset}`);
        offset += 2;
        continue;
      }

      // 2. GS Opcodes (0x1D)
      if (b === 0x1d) {
        if (offset + 1 >= len) {
          this.errors.push(`Premature end of stream after GS at offset ${offset}`);
          break;
        }
        const b2 = buffer[offset + 1];

        // GS ! (0x1D 0x21 n): Select character size
        if (b2 === 0x21) {
          if (offset + 2 >= len) {
            this.errors.push(`Missing parameter for GS ! at offset ${offset}`);
            break;
          }
          const n = buffer[offset + 2];
          const heightMult = (n & 0x0f) + 1;
          const widthMult = ((n >> 4) & 0x0f) + 1;
          this.state.charSize = { widthMultiplier: widthMult, heightMultiplier: heightMult };
          this.state.opcodesSeen.push(`GS_CHAR_SIZE_${widthMult}x${heightMult}`);
          offset += 3;
          continue;
        }

        // GS V (0x1D 0x56): Cut Paper
        if (b2 === 0x56) {
          if (offset + 2 >= len) {
            this.errors.push(`Missing parameter for GS V at offset ${offset}`);
            break;
          }
          const m = buffer[offset + 2];
          if (m === 0 || m === 48) {
            this.state.isCut = true;
            this.state.cutType = 'full';
            this.state.opcodesSeen.push('GS_CUT_FULL');
            offset += 3;
            continue;
          } else if (m === 1 || m === 49) {
            this.state.isCut = true;
            this.state.cutType = 'partial';
            this.state.opcodesSeen.push('GS_CUT_PARTIAL');
            offset += 3;
            continue;
          } else if (m === 65 || m === 66) {
            // Function B: GS V m n (Feed paper and cut)
            if (offset + 3 >= len) {
              this.errors.push(`Missing feed parameter for GS V function B at offset ${offset}`);
              break;
            }
            const n = buffer[offset + 3];
            this.state.isCut = true;
            this.state.cutType = 'feed_and_cut';
            this.state.feedLinesAfterCut = n;
            this.state.opcodesSeen.push(`GS_FEED_CUT_${n}`);
            offset += 4;
            continue;
          } else {
            this.warnings.push(`Unknown cut mode ${m} for GS V at offset ${offset}`);
            offset += 3;
            continue;
          }
        }

        // GS v 0 (0x1D 0x76 0x30 m xL xH yL yH): Print raster bit image
        if (b2 === 0x76) {
          if (offset + 7 >= len) {
            this.errors.push(`Incomplete GS v 0 raster header at offset ${offset}`);
            break;
          }
          const subOpcode = buffer[offset + 2]; // 0x30 ('0')
          if (subOpcode !== 0x30 && subOpcode !== 0) {
            this.errors.push(`Invalid sub-opcode for GS v at offset ${offset}: 0x${subOpcode.toString(16)}`);
            offset += 3;
            continue;
          }

          const m = buffer[offset + 3]; // Mode: 0 (Normal), 1 (Double-width), 2 (Double-height), 3 (Quad)
          const xL = buffer[offset + 4];
          const xH = buffer[offset + 5];
          const yL = buffer[offset + 6];
          const yH = buffer[offset + 7];

          const widthBytes = xL + (xH << 8);
          const heightDots = yL + (yH << 8);
          const widthDots = widthBytes * 8;
          const expectedDataSize = widthBytes * heightDots;

          const dataStart = offset + 8;
          const dataEnd = dataStart + expectedDataSize;

          if (dataEnd > len) {
            this.errors.push(
              `Truncated raster data: expected ${expectedDataSize} bytes (${widthBytes}x${heightDots}), available: ${len - dataStart}`
            );
            break;
          }

          const rasterBits = buffer.slice(dataStart, dataEnd);
          let blackPixels = 0;
          let whitePixels = 0;

          for (let i = 0; i < rasterBits.length; i++) {
            const byte = rasterBits[i];
            for (let bit = 0; bit < 8; bit++) {
              if ((byte & (0x80 >> bit)) !== 0) {
                blackPixels++;
              } else {
                whitePixels++;
              }
            }
          }

          const totalPixels = blackPixels + whitePixels;
          const density = totalPixels > 0 ? blackPixels / totalPixels : 0;

          const descriptor: RasterImageDescriptor = {
            widthDots,
            widthBytes,
            heightDots,
            mode: m,
            dataSize: expectedDataSize,
            blackPixelCount: blackPixels,
            whitePixelCount: whitePixels,
            density,
            bits: rasterBits,
          };

          this.state.rasterImages.push(descriptor);
          this.state.opcodesSeen.push(`GS_RASTER_${widthDots}x${heightDots}`);

          offset = dataEnd;
          continue;
        }

        // Unknown GS command
        this.warnings.push(`Unhandled GS command: 0x1D 0x${b2.toString(16)} at offset ${offset}`);
        offset += 2;
        continue;
      }

      // 3. Regular printable ASCII / UTF-8 text character or control code
      let textChunkEnd = offset;
      while (textChunkEnd < len && buffer[textChunkEnd] !== 0x1b && buffer[textChunkEnd] !== 0x1d) {
        textChunkEnd++;
      }

      const textChunk = buffer.subarray(offset, textChunkEnd);
      this.state.printedText += decoder.decode(textChunk);
      offset = textChunkEnd;
    }

    const isValid = this.errors.length === 0;
    return {
      isValid,
      state: this.state,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Specialized validator for 576-dot raster byte streams (80mm Thermal Receipt Standard).
   */
  public validateRaster576(buffer: Uint8Array): Raster576ValidationResult {
    const parseResult = this.parseStream(buffer);
    const errors: string[] = [...parseResult.errors];

    // Check initialization
    const hasInit = parseResult.state.isInitialized;
    if (!hasInit) {
      errors.push('Stream missing ESC @ [0x1B, 0x40] printer initialization');
    }

    // Check raster image presence
    if (parseResult.state.rasterImages.length === 0) {
      errors.push('Stream does not contain any GS v 0 raster image');
      return {
        isValid: false,
        widthDots: 0,
        widthBytes: 0,
        heightDots: 0,
        totalBytes: buffer.length,
        rasterPayloadBytes: 0,
        hasInit,
        hasCut: parseResult.state.isCut,
        errors,
      };
    }

    const raster = parseResult.state.rasterImages[0];

    // Check dot width
    if (raster.widthDots !== VirtualEscPosPrinter.DOTS_PER_LINE_80MM) {
      errors.push(
        `Invalid raster width: ${raster.widthDots} dots (${raster.widthBytes} bytes). Expected exactly 576 dots (72 bytes).`
      );
    }

    // Check height
    if (raster.heightDots <= 0) {
      errors.push(`Invalid raster height: ${raster.heightDots} lines.`);
    }

    // Check paper cut
    const hasCut = parseResult.state.isCut;
    if (!hasCut) {
      errors.push('Stream missing final GS V paper cut command');
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      widthDots: raster.widthDots,
      widthBytes: raster.widthBytes,
      heightDots: raster.heightDots,
      totalBytes: buffer.length,
      rasterPayloadBytes: raster.dataSize,
      hasInit,
      hasCut,
      errors,
    };
  }
}

// =============================================================================
// Verification Test Suites (Gate 4 Software Emulation)
// =============================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, desc: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc} | Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

export async function runVirtualPrinterVerification() {
  console.log('\n--- Running Virtual ESC/POS Printer & Stream Validator (Gate 4 Emulation) ---\n');

  const printer = new VirtualEscPosPrinter();

  // ===========================================================================
  // Suite 1: Parser & Opcode State Compliance
  // ===========================================================================
  console.log('[Suite 1: Parser & Opcode State Compliance]');
  {
    // Build byte sequence: Init -> Center -> Bold On -> "100 HICH" -> Bold Off -> Cut Full
    const stream = new Uint8Array([
      0x1b, 0x40,             // ESC @ (Init)
      0x1b, 0x61, 0x01,       // ESC a 1 (Center)
      0x1b, 0x45, 0x01,       // ESC E 1 (Bold On)
      0x1b, 0x47, 0x01,       // ESC G 1 (Double Strike On)
      0x1d, 0x21, 0x11,       // GS ! 17 (Double width & height)
      0x43, 0x61, 0x66, 0x65, // "Cafe"
      0x1b, 0x45, 0x00,       // ESC E 0 (Bold Off)
      0x1b, 0x47, 0x00,       // ESC G 0 (Double Strike Off)
      0x1d, 0x21, 0x00,       // GS ! 0 (Normal size)
      0x1d, 0x56, 0x00,       // GS V 0 (Cut Full)
    ]);

    const result = printer.parseStream(stream);
    assert(result.isValid, 'Synthetic ESC/POS opcode stream parsed without errors');
    assert(result.state.isInitialized, 'Printer recognized ESC @ initialization');
    assertEqual(result.state.justification, 'center', 'Printer recognized ESC a 1 center justification');
    assert(result.state.isCut, 'Printer recognized GS V 0 paper cut');
    assertEqual(result.state.cutType, 'full', 'Cut type identified as full cut');
    assertEqual(result.state.charSize.widthMultiplier, 1, 'Final character width multiplier reset to 1');
    assertEqual(result.state.charSize.heightMultiplier, 1, 'Final character height multiplier reset to 1');
    assert(result.state.printedText.includes('Cafe'), 'Printed text captured accurately');
  }

  // ===========================================================================
  // Suite 2: 576-Dot Raster Byte Stream Validation (Standard 80mm)
  // ===========================================================================
  console.log('\n[Suite 2: 576-Dot Raster Byte Stream Validation]');
  {
    // Synthetic Canvas mocking 576px wide canvas (standard 80mm printer raster)
    const mockHeight = 120;
    const mockCanvas = {
      width: 576,
      height: mockHeight,
      getContext: () => ({
        getImageData: (x: number, y: number, w: number, h: number) => {
          const data = new Uint8ClampedArray(w * h * 4);
          // Create diagonal cross pattern
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const idx = (row * w + col) * 4;
              const isDark = (col % 20 < 2) || (row % 20 < 2);
              const color = isDark ? 0 : 255;
              data[idx] = color;     // R
              data[idx + 1] = color; // G
              data[idx + 2] = color; // B
              data[idx + 3] = 255;   // A
            }
          }
          return { data, width: w, height: h };
        },
      }),
    } as any as HTMLCanvasElement;

    const rasterBytes = convertCanvasToEscPosRaster(mockCanvas);

    // Validate using VirtualEscPosPrinter
    const rasterResult = printer.validateRaster576(rasterBytes);
    assert(rasterResult.isValid, 'convertCanvasToEscPosRaster output validated as 100% compliant');
    assertEqual(rasterResult.widthDots, 576, 'Raster width is exactly 576 dots');
    assertEqual(rasterResult.widthBytes, 72, 'Raster width bytes is exactly 72 bytes (576 / 8)');
    assertEqual(rasterResult.heightDots, mockHeight, `Raster height is exactly ${mockHeight} lines`);
    assert(rasterResult.hasInit, 'Raster stream includes ESC @ initialization');
    assert(rasterResult.hasCut, 'Raster stream includes GS V cut command');

    // Expected byte calculation: 2 (Init) + 8 (GS v 0 header) + (72 * 120) + 4 (Cut GS V 65 16)
    const expectedByteCount = 2 + 8 + (72 * mockHeight) + 4;
    assertEqual(rasterBytes.length, expectedByteCount, `Exact byte count matches invariant (${expectedByteCount} bytes)`);

    // Verify bit unpacking & pixel density
    const descriptor = printer.getState().rasterImages[0];
    assert(descriptor.density > 0 && descriptor.density < 1, `Calculated non-trivial density: ${(descriptor.density * 100).toFixed(2)}%`);
    assert(descriptor.blackPixelCount > 0, 'Black pixels successfully extracted into monochrome 1-bit grid');
  }

  // ===========================================================================
  // Suite 3: Production KDS Ticket Layout Engine Validation
  // ===========================================================================
  console.log('\n[Suite 3: Production KDS Ticket Layout Engine Validation]');
  {
    const sampleTicket = {
      ticketId: 'KDS-8842',
      orderNumber: 1042,
      tableLabel: 'میز ۷',
      cashierName: 'امیرحسین',
      timeStr: '14:22',
      station: 'BAR' as const,
      stationTitle: 'بار سرد و گرم (BAR)',
      isDelta: true,
      deltaHeaderFlag: 'سفارش تکمیلی / ADDITIONAL ORDER',
      items: [
        {
          id: 'item-1',
          menuItemId: 'flat-white',
          title: 'فلت وایت',
          quantity: 2,
          unitPrice: 75000,
          subtotal: 150000,
          modifiers: ['شیر جو دوسر', 'سینگل شات'],
          notes: 'کم‌شیرین سرو شود',
        },
      ],
      orderNotes: 'مشتری عجله دارد',
    };

    const kdsBytes = TicketLayoutEngine.renderEscPosBinary(sampleTicket);
    const kdsResult = printer.parseStream(kdsBytes);

    assert(kdsResult.isValid, 'Production KDS dispatch ticket stream parsed cleanly');
    assert(kdsResult.state.isInitialized, 'KDS ticket starts with ESC @');
    assert(kdsResult.state.isCut, 'KDS ticket terminates with paper cut');
    assertEqual(kdsResult.state.cutType, 'full', 'KDS cut type is full cut (GS V 0)');
    assert(kdsResult.state.opcodesSeen.includes('ESC_BOLD_ON'), 'KDS ticket uses emphasized bold formatting');
    assert(kdsResult.state.opcodesSeen.includes('GS_CHAR_SIZE_2x2'), 'KDS ticket uses double-size station title');
    assert(kdsResult.state.printedText.includes('KDS-8842'), 'KDS ticket contains ticket ID');
    assert(kdsResult.state.printedText.includes('ADDITIONAL ORDER'), 'KDS ticket renders delta ordering banner');
  }

  // ===========================================================================
  // Suite 4: Production Shift Closeout Z-Report Ticket Validation
  // ===========================================================================
  console.log('\n[Suite 4: Production Shift Closeout Z-Report Ticket Validation]');
  {
    const sampleZReport: any = {
      id: 'zrep-104',
      report_number: 104,
      shift_id: 'shift-audit-99',
      tenant_id: 'tenant-100hich-01',
      tenantId: 'tenant-100hich-01',
      opened_at: '2026-11-04T08:00:00.000Z',
      closed_at: '2026-11-04T16:00:00.000Z',
      opened_by: 'مدیر شیفت',
      closed_by: 'مدیر شیفت',
      gross_sales: 500000,
      discounts_total: 0,
      net_sales: 500000,
      vat_total: 41284,
      opening_cash: 600000,
      counted_cash_float: 750000,
      payment_methods: {
        pos_card: 300000,
        cash: 200000,
      },
      expenses_total: 50000,
      expenses_cash_drawer: 50000,
      expected_cash: 750000,
      discrepancy: 0,
      is_balanced: true,
      is_shortage: false,
      is_overage: false,
      order_count: 8,
      material_depletions: [],
      timestamp: '2026-11-04T16:00:00.000Z',
    };

    // 100 HICH Z-Report ESC/POS validation
    const bytes100 = ShiftCloseoutService.generateEscPosBytes(sampleZReport, 'tenant-100hich-01');
    const result100 = printer.parseStream(bytes100);
    assert(result100.isValid, '100 HICH Z-Report ESC/POS stream parsed without errors');
    assert(result100.state.isInitialized, '100 HICH Z-Report initialized with ESC @');
    assert(result100.state.isDoubleStrike, '100 HICH Z-Report applies double-strike mode');
    assert(result100.state.isCut, '100 HICH Z-Report executes paper cut');
    assert(result100.state.printedText.includes('100 HICH'), '100 HICH header rendered');
    assert(!result100.state.printedText.toLowerCase().includes('modendo'), 'Zero Modendo brand leakage in 100 HICH');

    // Modendo Cafe Z-Report ESC/POS validation
    const sampleZReportModendo = { ...sampleZReport, tenantId: 'tenant-modendo-01' };
    const bytesMod = ShiftCloseoutService.generateEscPosBytes(sampleZReportModendo, 'tenant-modendo-01');
    const resultMod = printer.parseStream(bytesMod);
    assert(resultMod.isValid, 'Modendo Z-Report ESC/POS stream parsed without errors');
    assert(resultMod.state.isInitialized, 'Modendo Z-Report initialized with ESC @');
    assert(resultMod.state.isCut, 'Modendo Z-Report executes paper cut');
    assert(resultMod.state.printedText.includes('MODENDO CAFE'), 'Modendo header rendered');
    assert(!resultMod.state.printedText.toLowerCase().includes('100hich'), 'Zero 100 HICH brand leakage in Modendo');
  }

  // ===========================================================================
  // Suite 5: Malformed Stream Rejection & Hardware Fault Simulation (Gate 4 Hardening)
  // ===========================================================================
  console.log('\n[Suite 5: Malformed Stream Rejection & Hardware Fault Simulation]');
  {
    // Test 1: Truncated raster buffer (cut off midway)
    const truncatedRaster = new Uint8Array([
      0x1b, 0x40,                               // ESC @
      0x1d, 0x76, 0x30, 0x00, 72, 0, 10, 0,    // GS v 0 (72 x 10 lines = 720 bytes)
      0x01, 0x02, 0x03,                         // Only 3 bytes supplied!
    ]);
    const truncRes = printer.validateRaster576(truncatedRaster);
    assert(!truncRes.isValid, 'Truncated raster stream correctly rejected as invalid');
    assert(truncRes.errors.some((e) => e.includes('Truncated raster data')), 'Descriptive error identifies truncated payload');

    // Test 2: Invalid horizontal dot width (e.g. 48 bytes = 384 dots instead of 72 bytes = 576 dots)
    const badWidth = 48; // 384 dots (58mm printer format)
    const badWidthRaster = new Uint8Array(2 + 8 + (badWidth * 10) + 4);
    badWidthRaster.set([0x1b, 0x40], 0);
    badWidthRaster.set([0x1d, 0x76, 0x30, 0x00, badWidth, 0, 10, 0], 2);
    badWidthRaster.set([0x1d, 0x56, 0x00], 2 + 8 + (badWidth * 10));

    const widthRes = printer.validateRaster576(badWidthRaster);
    assert(!widthRes.isValid, '58mm (384-dot) raster stream rejected when asserting 80mm (576-dot) standard');
    assert(widthRes.errors.some((e) => e.includes('Invalid raster width: 384 dots')), 'Error specifies exact dot mismatch');

    // Test 3: Missing paper cut opcode
    const noCutStream = new Uint8Array([
      0x1b, 0x40,
      0x48, 0x65, 0x6c, 0x6c, 0x6f,
    ]);
    const noCutRes = printer.validateRaster576(noCutStream);
    assert(!noCutRes.isValid, 'Missing cut opcode flagged as incomplete ticket');

    // Test 4: Missing initialization opcode
    const noInitStream = new Uint8Array([
      0x1d, 0x76, 0x30, 0x00, 72, 0, 5, 0,
      ...new Array(72 * 5).fill(0),
      0x1d, 0x56, 0x00,
    ]);
    const noInitRes = printer.validateRaster576(noInitStream);
    assert(!noInitRes.isValid, 'Missing initialization opcode flagged');
  }

  console.log(`\n========================================`);
  console.log(`Virtual ESC/POS Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute directly if run as CLI script
runVirtualPrinterVerification().catch((err) => {
  console.error('Virtual printer verification crashed:', err);
  process.exit(1);
});
