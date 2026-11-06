/**
 * VITEST SUITE ?" PERSIAN ESC/POS & FONT B 56-COLUMN ENGINE
 * Path: tests/persianEscPos.test.ts
 *
 * Verifies:
 * 1. Persian Presentation Forms-B character reshaping of 'لاته' and other menu items.
 * 2. RTL BiDi reordering for LTR thermal printheads preserving numbers and Latin terms.
 * 3. 56-Column width invariants across dividers, centered banners, and two-column justified rows.
 * 4. Exact ESC/POS binary opcode sequences:
 *    - ESC @  [0x1B, 0x40]
 *    - ESC M 1 [0x1B, 0x4D, 0x01]
 *    - GS V 0 [0x1D, 0x56, 0x00]
 */

import { describe, it, expect } from 'vitest';
import net from 'net';
import { dispatchPrintJob, LocalPrintSpoolerBridge } from '../src/hardware/printerBridge';
import {
  reshapePersian,
  bidiReorder,
  formatPersianText,
  dividerLine,
  centerText,
  formatTwoColumns,
  PersianEscPosRenderer,
  ESC_POS_OPCODES,
  FONT_B_COLUMNS,
} from '../src/hardware/persianEscPos';

describe('Persian ESC/POS & Thermal Layout Engine', () => {
  // -------------------------------------------------------------
  // SUITE 1: Persian Character Shaping (Presentation Forms-B)
  // -------------------------------------------------------------
  describe('Persian Character Shaping', () => {
    it("validates exact reshaping of 'لاته' (Lam-Alef isolated + Te initial + He final)", () => {
      const input = 'لاته';
      const shaped = reshapePersian(input);

      // 'ل' + 'ا' forms isolated Lam-Alef: \uFEFB (0xFEFB)
      // 'ت' joins to 'ه' -> initial Te: \uFE97 (0xFE97)
      // 'ه' preceded by 'ت' -> final He: \uFEEA (0xFEEA)
      const expected = '\uFEFB\uFE97\uFEEA';

      expect(shaped).toBe(expected);
      expect(shaped.charCodeAt(0)).toBe(0xfefb); // ARABIC LIGATURE LAM WITH ALEF ISOLATED FORM
      expect(shaped.charCodeAt(1)).toBe(0xfe97); // ARABIC LETTER TEH INITIAL FORM
      expect(shaped.charCodeAt(2)).toBe(0xfeea); // ARABIC LETTER HEH FINAL FORM
    });

    it("reshapes 'قهوه' with initial, medial, and final forms", () => {
      const shaped = reshapePersian('قهوه');
      // ق: initial (\uFED7)
      // ه: medial (\uFEEC)
      // و: final (\uFEEE)
      // ه: isolated (\uFEE9)
      expect(shaped).toBe('\uFED7\uFEEC\uFEEE\uFEE9');
    });

    it("reshapes 'چای' and 'آب' correctly", () => {
      const shapedChai = reshapePersian('چای');
      expect(shapedChai.charCodeAt(0)).toBe(0xfb7c); // Che initial
      expect(shapedChai.charCodeAt(1)).toBe(0xfe8e); // Alef final
      expect(shapedChai.charCodeAt(2)).toBe(0xfbfc); // Persian Ye isolated

      const shapedAb = reshapePersian('آب');
      expect(shapedAb.charCodeAt(0)).toBe(0xfe81); // Alef with Madda isolated
      expect(shapedAb.charCodeAt(1)).toBe(0xfe8f); // Be isolated
    });
  });

  // -------------------------------------------------------------
  // SUITE 2: RTL BiDi Reordering for LTR Thermal Printers
  // -------------------------------------------------------------
  describe('RTL BiDi Reordering', () => {
    it("reverses shaped 'لاته' so it prints correctly on an LTR thermal printhead", () => {
      const processed = formatPersianText('لاته');
      // For an LTR printer: characters must be reversed (\uFEEA\uFE97\uFEFB)
      // When read from right to left on the printed paper, it reads 'لاته'
      expect(processed).toBe('\uFEEA\uFE97\uFEFB');
    });

    it('preserves internal LTR order for numbers within Persian text', () => {
      const processed = formatPersianText('میز ۱۲');
      // Number '۱۲' must remain intact in LTR reading order
      expect(processed).toContain('۱۲');
    });

    it('preserves English / Latin alphanumeric tokens in LTR order', () => {
      const processed = formatPersianText('قهوه V60');
      expect(processed).toContain('V60');
    });
  });

  // -------------------------------------------------------------
  // SUITE 3: Font B (56 Columns) Fixed-Width Layout Invariants
  // -------------------------------------------------------------
  describe('Font B 56-Column Width Invariants', () => {
    it('enforces FONT_B_COLUMNS constant to be strictly 56', () => {
      expect(FONT_B_COLUMNS).toBe(56);
    });

    it('generates divider lines of exactly 56 columns', () => {
      const dashDivider = dividerLine('-');
      expect(dashDivider.length).toBe(56);
      expect(dashDivider).toBe('-'.repeat(56));

      const equalDivider = dividerLine('=');
      expect(equalDivider.length).toBe(56);
      expect(equalDivider).toBe('='.repeat(56));
    });

    it('centers Persian text with exact 56-column width', () => {
      const centered = centerText('کافه ۱۰۰ هیچ', 56);
      expect(centered.length).toBe(56);
      expect(centered.trim().length).toBeGreaterThan(0);
    });

    it('formats two-column justified rows strictly matching 56 columns', () => {
      // Row 1: Item and Price
      const row1 = formatTwoColumns('145,000 T', 'لاته', 56);
      expect(row1.length).toBe(56);
      expect(row1.startsWith('145,000 T')).toBe(true);

      // Row 2: Quantity and Item
      const row2 = formatTwoColumns('2x', 'اسپرسو دبل', 56);
      expect(row2.length).toBe(56);
      expect(row2.startsWith('2x')).toBe(true);

      // Row 3: Mixed English and Persian
      const row3 = formatTwoColumns('#101', 'میز ۴', 56);
      expect(row3.length).toBe(56);
      expect(row3.startsWith('#101')).toBe(true);
    });

    it('prevents column overflow when strings exceed width', () => {
      const veryLong = 'این یک نام بسیار بسیار طولانی برای تست رفتار سرریز ستون است';
      const row = formatTwoColumns('100,000 T', veryLong, 56);
      expect(row.length).toBe(56);
    });
  });

  // -------------------------------------------------------------
  // SUITE 4: Raw ESC/POS Binary Opcode Sequences
  // -------------------------------------------------------------
  describe('Raw ESC/POS Binary Opcode Sequences', () => {
    it('validates ESC @ [0x1B, 0x40] printer initialization opcode', () => {
      expect(ESC_POS_OPCODES.INIT).toEqual(Buffer.from([0x1b, 0x40]));
    });

    it('validates ESC M 1 [0x1B, 0x4D, 0x01] Font B selection opcode', () => {
      expect(ESC_POS_OPCODES.FONT_B).toEqual(Buffer.from([0x1b, 0x4d, 0x01]));
    });

    it('validates GS V 0 [0x1D, 0x56, 0x00] paper cut opcode', () => {
      expect(ESC_POS_OPCODES.PAPER_CUT).toEqual(Buffer.from([0x1d, 0x56, 0x00]));
    });

    it('builds a binary ticket buffer starting with ESC @, ESC M 1 and ending with GS V 0', () => {
      const renderer = new PersianEscPosRenderer(56);
      renderer
        .init()
        .line('لاته')
        .cut();

      const buffer = renderer.toBuffer();

      // Check header: ESC @ [0x1B, 0x40] followed by ESC M 1 [0x1B, 0x4D, 0x01]
      expect(buffer[0]).toBe(0x1b);
      expect(buffer[1]).toBe(0x40);
      expect(buffer[2]).toBe(0x1b);
      expect(buffer[3]).toBe(0x4d);
      expect(buffer[4]).toBe(0x01);

      // Check footer: GS V 0 [0x1D, 0x56, 0x00]
      const len = buffer.length;
      expect(buffer[len - 3]).toBe(0x1d);
      expect(buffer[len - 2]).toBe(0x56);
      expect(buffer[len - 1]).toBe(0x00);
    });

    it('verifies dispatchPrintJob formats Persian Font B ticket before raw TCP transmission', async () => {
      // Create mock thermal printer TCP server
      const receivedBuffers: Buffer[] = [];
      const server = net.createServer((socket) => {
        socket.on('data', (chunk) => {
          receivedBuffers.push(chunk);
        });
      });

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });

      const port = (server.address() as net.AddressInfo).port;

      try {
        const testSpooler = new LocalPrintSpoolerBridge({
          BAR: {
            host: '127.0.0.1',
            port: port,
            timeoutMs: 2000,
            maxRetries: 1,
            retryDelayMs: 50,
          },
        });

        const result = await dispatchPrintJob(
          'BAR',
          'لاته داغ',
          { host: '127.0.0.1', port: port, timeoutMs: 2000, maxRetries: 1, retryDelayMs: 50 },
          testSpooler
        );

        expect(result.success).toBe(true);
        expect(result.station).toBe('BAR');
        expect(result.bytesWritten).toBeGreaterThan(0);

        // Wait a tick for data receipt
        await new Promise((r) => setTimeout(r, 50));

        const fullBuffer = Buffer.concat(receivedBuffers);
        expect(fullBuffer.length).toBeGreaterThan(0);

        // Starts with ESC @ (0x1B, 0x40) and ESC M 1 (0x1B, 0x4D, 0x01)
        expect(fullBuffer[0]).toBe(0x1b);
        expect(fullBuffer[1]).toBe(0x40);
        expect(fullBuffer[2]).toBe(0x1b);
        expect(fullBuffer[3]).toBe(0x4d);
        expect(fullBuffer[4]).toBe(0x01);

        // Ends with GS V 0 (0x1D, 0x56, 0x00)
        const lastIdx = fullBuffer.length;
        expect(fullBuffer[lastIdx - 3]).toBe(0x1d);
        expect(fullBuffer[lastIdx - 2]).toBe(0x56);
        expect(fullBuffer[lastIdx - 1]).toBe(0x00);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('renders a full ticket via PersianEscPosRenderer.renderTicket()', () => {
      const buffer = PersianEscPosRenderer.renderTicket({
        ticketId: '101',
        orderNumber: '101',
        tableLabel: 'میز ۴',
        station: 'BAR',
        brandNameFa: 'رستری تخصصی ۱۰۰ هیچ',
        items: [
          { name: 'لاته', quantity: 2, notes: 'شیر کم چرب', priceToman: 95000 },
          { name: 'اسپرسو', quantity: 1, priceToman: 65000 },
        ],
        totalAmountToman: 255000,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(50);

      // Starts with ESC @ + ESC M 1
      expect(buffer[0]).toBe(0x1b);
      expect(buffer[1]).toBe(0x40);
      expect(buffer[2]).toBe(0x1b);
      expect(buffer[3]).toBe(0x4d);
      expect(buffer[4]).toBe(0x01);

      // Ends with GS V 0
      const len = buffer.length;
      expect(buffer[len - 3]).toBe(0x1d);
      expect(buffer[len - 2]).toBe(0x56);
      expect(buffer[len - 1]).toBe(0x00);
    });
    it('prepends logoBuffer before ticket headers when using buildReceiptWithLogo()', () => {
      const mockLogo = Buffer.from([0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00, 0xff]);
      const buffer = PersianEscPosRenderer.buildReceiptWithLogo(
        {
          ticketId: '202',
          orderNumber: '202',
          tableLabel: 'میز ۱۰',
          station: 'BAR',
          brandNameFa: 'رستری تخصصی ۱۰۰ هیچ',
          items: [{ name: 'آمریکانو', quantity: 1, priceToman: 70000 }],
          totalAmountToman: 70000,
        },
        mockLogo
      );

      expect(buffer).toBeInstanceOf(Buffer);

      // Printer init: ESC @ (0x1b, 0x40) and Font B ESC M 1 (0x1b, 0x4d, 0x01)
      expect(buffer[0]).toBe(0x1b);
      expect(buffer[1]).toBe(0x40);
      expect(buffer[2]).toBe(0x1b);
      expect(buffer[3]).toBe(0x4d);
      expect(buffer[4]).toBe(0x01);

      // Followed immediately by the mock logo buffer bytes (at offset 5)
      const logoSlice = buffer.subarray(5, 5 + mockLogo.length);
      expect(logoSlice.equals(mockLogo)).toBe(true);

      // Followed by feed byte (LF = 0x0a)
      expect(buffer[5 + mockLogo.length]).toBe(0x0a);

      // Ends with paper cut GS V 0
      const len = buffer.length;
      expect(buffer[len - 3]).toBe(0x1d);
      expect(buffer[len - 2]).toBe(0x56);
      expect(buffer[len - 1]).toBe(0x00);
    });
  });
});