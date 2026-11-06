/**
 * CAFE OS ?" PERSIAN ESC/POS RENDERER & THERMAL LAYOUT ENGINE
 * Target Path: src/hardware/persianEscPos.ts
 *
 * Implements:
 * 1. Persian Presentation Forms-B character shaping (Arabic Presentation Forms-A & B).
 *    - Isolated, Initial, Medial, Final glyph selection based on Arabic/Persian connection rules.
 *    - Lam-Alef ligature combinations (لا, لآ, لأ, لإ).
 * 2. RTL BiDi Reordering for standard LTR thermal receipt printers:
 *    - Preserves internal reading order of numbers (ASCII & Persian/Arabic digits) and Latin terms.
 *    - Visually reverses Persian character runs so they read correctly on LTR thermal printheads.
 * 3. Font B (56 columns) Fixed-Width Layout Formatter:
 *    - 56-column width invariants across dividers, two-column justified rows, and centered banners.
 * 4. Raw ESC/POS Binary Ticket Builder:
 *    - ESC @  (0x1B, 0x40) - Printer Initialization
 *    - ESC M 1 (0x1B, 0x4D, 0x01) - Font B (9x17, 56 columns on 80mm roll)
 *    - ESC E 1 / ESC E 0 (0x1B, 0x45, n) - Bold On/Off
 *    - ESC a 0 / 1 / 2 (0x1B, 0x61, n) - Alignment Left/Center/Right
 *    - GS V 0 (0x1D, 0x56, 0x00) - Full Paper Cut
 */

export const FONT_B_COLUMNS = 56;
export const FONT_A_COLUMNS = 42;

export const ESC_POS_OPCODES = {
  INIT: Buffer.from([0x1b, 0x40]), // ESC @
  FONT_B: Buffer.from([0x1b, 0x4d, 0x01]), // ESC M 1 (Select Font B, 56 cols)
  FONT_A: Buffer.from([0x1b, 0x4d, 0x00]), // ESC M 0 (Select Font A, 42 cols)
  BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]), // ESC E 1
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]), // ESC E 0
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]), // ESC a 0
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]), // ESC a 1
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]), // ESC a 2
  PAPER_CUT: Buffer.from([0x1d, 0x56, 0x00]), // GS V 0 (Full Cut)
  PAPER_CUT_PARTIAL: Buffer.from([0x1d, 0x56, 0x01]), // GS V 1 (Partial Cut)
  LINE_FEED: Buffer.from([0x0a]), // LF
  BUZZER: Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]), // Pulse drawer / buzzer
} as const;

// -------------------------------------------------------------
// Persian Glyph Dictionary (Presentation Forms-B & A)
// -------------------------------------------------------------
interface GlyphForm {
  iso: number; // Isolated
  fin: number; // Final
  ini: number; // Initial
  med: number; // Medial
  joinsLeft: boolean; // Does this character join to the following letter?
}

const GLYPH_MAP: Record<number, GlyphForm> = {
  // Alef with Madda / Hamza
  0x0622: { iso: 0xfe81, fin: 0xfe82, ini: 0xfe81, med: 0xfe82, joinsLeft: false }, // آ
  0x0623: { iso: 0xfe83, fin: 0xfe84, ini: 0xfe83, med: 0xfe84, joinsLeft: false }, // أ
  0x0625: { iso: 0xfe87, fin: 0xfe88, ini: 0xfe87, med: 0xfe88, joinsLeft: false }, // إ
  0x0627: { iso: 0xfe8d, fin: 0xfe8e, ini: 0xfe8d, med: 0xfe8e, joinsLeft: false }, // ا

  // Be, Pe, Te, Se
  0x0628: { iso: 0xfe8f, fin: 0xfe90, ini: 0xfe91, med: 0xfe92, joinsLeft: true }, // ب
  0x067e: { iso: 0xfb56, fin: 0xfb57, ini: 0xfb58, med: 0xfb59, joinsLeft: true }, // پ
  0x062a: { iso: 0xfe95, fin: 0xfe96, ini: 0xfe97, med: 0xfe98, joinsLeft: true }, // ت
  0x062b: { iso: 0xfe99, fin: 0xfe9a, ini: 0xfe9b, med: 0xfe9c, joinsLeft: true }, // ث

  // Jim, Che, He, Khe
  0x062c: { iso: 0xfe9d, fin: 0xfe9e, ini: 0xfe9f, med: 0xfea0, joinsLeft: true }, // ج
  0x0686: { iso: 0xfb7a, fin: 0xfb7b, ini: 0xfb7c, med: 0xfb7d, joinsLeft: true }, // چ
  0x062d: { iso: 0xfea1, fin: 0xfea2, ini: 0xfea3, med: 0xfea4, joinsLeft: true }, // ح
  0x062e: { iso: 0xfea5, fin: 0xfea6, ini: 0xfea7, med: 0xfea8, joinsLeft: true }, // خ

  // Dal, Zal
  0x062f: { iso: 0xfea9, fin: 0xfeaa, ini: 0xfea9, med: 0xfeaa, joinsLeft: false }, // د
  0x0630: { iso: 0xfeab, fin: 0xfeac, ini: 0xfeab, med: 0xfeac, joinsLeft: false }, // ذ

  // Re, Ze, Zhe
  0x0631: { iso: 0xfead, fin: 0xfeae, ini: 0xfead, med: 0xfeae, joinsLeft: false }, // ر
  0x0632: { iso: 0xfeaf, fin: 0xfeb0, ini: 0xfeaf, med: 0xfeb0, joinsLeft: false }, // ز
  0x0698: { iso: 0xfb8a, fin: 0xfb8b, ini: 0xfb8a, med: 0xfb8b, joinsLeft: false }, // ژ

  // Sin, Shin
  0x0633: { iso: 0xfeb1, fin: 0xfeb2, ini: 0xfeb3, med: 0xfeb4, joinsLeft: true }, // س
  0x0634: { iso: 0xfeb5, fin: 0xfeb6, ini: 0xfeb7, med: 0xfeb8, joinsLeft: true }, // ش

  // Sad, Zad
  0x0635: { iso: 0xfeb9, fin: 0xfeba, ini: 0xfebb, med: 0xfebc, joinsLeft: true }, // ص
  0x0636: { iso: 0xfebd, fin: 0xfebe, ini: 0xfebf, med: 0xfec0, joinsLeft: true }, // ض

  // Ta, Za
  0x0637: { iso: 0xfec1, fin: 0xfec2, ini: 0xfec3, med: 0xfec4, joinsLeft: true }, // ط
  0x0638: { iso: 0xfec5, fin: 0xfec6, ini: 0xfec7, med: 0xfec8, joinsLeft: true }, // ظ

  // Ayn, Ghayn
  0x0639: { iso: 0xfec9, fin: 0xfeca, ini: 0xfecb, med: 0xfecc, joinsLeft: true }, // ع
  0x063a: { iso: 0xfecd, fin: 0xfece, ini: 0xfecf, med: 0xfed0, joinsLeft: true }, // غ

  // Fe, Qaf
  0x0641: { iso: 0xfed1, fin: 0xfed2, ini: 0xfed3, med: 0xfed4, joinsLeft: true }, // ف
  0x0642: { iso: 0xfed5, fin: 0xfed6, ini: 0xfed7, med: 0xfed8, joinsLeft: true }, // ق

  // Kaf (Persian & Arabic), Gaf
  0x06a9: { iso: 0xfb8e, fin: 0xfb8f, ini: 0xfb90, med: 0xfb91, joinsLeft: true }, // ک (Persian)
  0x0643: { iso: 0xfed9, fin: 0xfeda, ini: 0xfedb, med: 0xfedc, joinsLeft: true }, // ك (Arabic)
  0x06af: { iso: 0xfb92, fin: 0xfb93, ini: 0xfb94, med: 0xfb95, joinsLeft: true }, // گ

  // Lam, Mim, Nun
  0x0644: { iso: 0xfedd, fin: 0xfede, ini: 0xfedf, med: 0xfee0, joinsLeft: true }, // ل
  0x0645: { iso: 0xfee1, fin: 0xfee2, ini: 0xfee3, med: 0xfee4, joinsLeft: true }, // م
  0x0646: { iso: 0xfee5, fin: 0xfee6, ini: 0xfee7, med: 0xfee8, joinsLeft: true }, // ن

  // Vav, Vav with Hamza
  0x0648: { iso: 0xfeed, fin: 0xfeee, ini: 0xfeed, med: 0xfeee, joinsLeft: false }, // و
  0x0624: { iso: 0xfe85, fin: 0xfe86, ini: 0xfe85, med: 0xfe86, joinsLeft: false }, // ؤ

  // He, Ta Marbuta, He with Hamza
  0x0647: { iso: 0xfee9, fin: 0xfeea, ini: 0xfeeb, med: 0xfeec, joinsLeft: true }, // ه
  0x0629: { iso: 0xfe93, fin: 0xfe94, ini: 0xfe93, med: 0xfe94, joinsLeft: false }, // ة
  0x06c0: { iso: 0xfba4, fin: 0xfba5, ini: 0xfba4, med: 0xfba5, joinsLeft: false }, // ۀ

  // Ye (Persian, Arabic, Alef Maksura)
  0x06cc: { iso: 0xfbfc, fin: 0xfbfd, ini: 0xfbfe, med: 0xfbff, joinsLeft: true }, // ی (Persian)
  0x064a: { iso: 0xfef1, fin: 0xfef2, ini: 0xfef3, med: 0xfef4, joinsLeft: true }, // ي (Arabic)
  0x0649: { iso: 0xfeef, fin: 0xfef0, ini: 0xfeef, med: 0xfef0, joinsLeft: true }, // ى (Alef Maksura)
  0x0626: { iso: 0xfe89, fin: 0xfe8a, ini: 0xfe8b, med: 0xfe8c, joinsLeft: true }, // ئ (Hamza on Ye)
};

// Lam-Alef Ligature Table (Isolated & Final)
const LAM_ALEF_LIGATURES: Record<number, { iso: number; fin: number }> = {
  0x0622: { iso: 0xfef5, fin: 0xfef6 }, // لآ
  0x0623: { iso: 0xfef7, fin: 0xfef8 }, // لأ
  0x0625: { iso: 0xfef9, fin: 0xfefa }, // لإ
  0x0627: { iso: 0xfefb, fin: 0xfefc }, // لا
};

/**
 * Reshapes Persian/Arabic text into Presentation Forms-B & A Unicode characters.
 * Transforms characters into isolated, initial, medial, or final forms based on connectivity,
 * with complete handling of Lam-Alef ligatures (e.g. 'لاته' -> '\uFEFB\uFE97\uFEEA').
 */
export function reshapePersian(text: string): string {
  if (!text) return '';

  const chars: number[] = [];
  for (let i = 0; i < text.length; i++) {
    chars.push(text.charCodeAt(i));
  }

  const result: string[] = [];
  let prevJoinsLeft = false;
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    // Check for Lam-Alef ligature (0x0644 + Alef variant)
    if (c === 0x0644 && i + 1 < chars.length && LAM_ALEF_LIGATURES[chars[i + 1]]) {
      const alefCode = chars[i + 1];
      const lig = LAM_ALEF_LIGATURES[alefCode];
      const glyphCode = prevJoinsLeft ? lig.fin : lig.iso;
      result.push(String.fromCharCode(glyphCode));

      // Lam-Alef ends with an Alef, which never joins to the left
      prevJoinsLeft = false;
      i += 2;
      continue;
    }

    const glyph = GLYPH_MAP[c];
    if (!glyph) {
      // Non-Persian character (ASCII, punctuation, space, number, etc.)
      result.push(String.fromCharCode(c));
      prevJoinsLeft = false;
      i++;
      continue;
    }

    // Determine if the following character can connect with this character
    let nextJoinsRight = false;
    if (i + 1 < chars.length) {
      const nextChar = chars[i + 1];
      if (GLYPH_MAP[nextChar]) {
        nextJoinsRight = true;
      }
    }

    let shapedCode: number;
    if (!prevJoinsLeft && !nextJoinsRight) {
      shapedCode = glyph.iso;
    } else if (!prevJoinsLeft && nextJoinsRight) {
      shapedCode = glyph.ini;
    } else if (prevJoinsLeft && nextJoinsRight) {
      shapedCode = glyph.med;
    } else {
      shapedCode = glyph.fin;
    }

    result.push(String.fromCharCode(shapedCode));
    prevJoinsLeft = glyph.joinsLeft;
    i++;
  }

  return result.join('');
}

/**
 * Checks if a Unicode character is within Arabic/Persian/Presentation Forms range.
 */
function isRtlChar(code: number): boolean {
  return (
    (code >= 0x0600 && code <= 0x06ff) || // Arabic / Persian
    (code >= 0xfb50 && code <= 0xfdff) || // Presentation Forms-A
    (code >= 0xfe70 && code <= 0xfeff)    // Presentation Forms-B
  );
}

/**
 * Checks if a character belongs to a number or Latin word sequence (which must read LTR).
 */
function isDigitChar(code: number): boolean {
  return (
    (code >= 0x0030 && code <= 0x0039) || // 0-9
    (code >= 0x06f0 && code <= 0x06f9) || // ۰-۹ Persian
    (code >= 0x0660 && code <= 0x0669)    // ٠-٩ Arabic
  );
}

function isLtrTokenChar(char: string, code: number): boolean {
  if (isDigitChar(code)) return true;
  return /[a-zA-Z.,:\-_#/$%+]/.test(char);
}

/**
 * Reorders a shaped Persian/Arabic line for Left-To-Right thermal receipt printers.
 * Reverses RTL character sequences so that they print correctly on LTR thermal printheads,
 * while strictly preserving the internal LTR order of numbers and Latin text.
 */
export function bidiReorder(text: string): string {
  if (!text) return '';

  interface Token {
    type: 'RTL' | 'LTR' | 'SPACE' | 'NEUTRAL';
    text: string;
  }

  const tokens: Token[] = [];
  let currentType: Token['type'] | null = null;
  let currentBuffer = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);

    let charType: Token['type'];
    if (char === ' ') {
      charType = 'SPACE';
    } else if (isLtrTokenChar(char, code)) {
      charType = 'LTR';
    } else if (isRtlChar(code)) {
      charType = 'RTL';
    } else {
      charType = 'NEUTRAL';
    }

    if (charType !== currentType) {
      if (currentBuffer.length > 0 && currentType !== null) {
        tokens.push({ type: currentType, text: currentBuffer });
      }
      currentType = charType;
      currentBuffer = char;
    } else {
      currentBuffer += char;
    }
  }

  if (currentBuffer.length > 0 && currentType !== null) {
    tokens.push({ type: currentType, text: currentBuffer });
  }

  // If there are no RTL characters at all, return unchanged
  const hasRtl = tokens.some((t) => t.type === 'RTL');
  if (!hasRtl) {
    return text;
  }

  // Reverse the token array so the rightmost Persian word appears at the far right
  const reversedTokens = tokens.reverse();

  // Within each RTL token, reverse characters because printer renders LTR
  const processedTokens = reversedTokens.map((t) => {
    if (t.type === 'RTL') {
      return Array.from(t.text).reverse().join('');
    }
    // LTR numbers and Latin words remain in their native LTR character sequence
    return t.text;
  });

  return processedTokens.join('');
}

/**
 * Complete Persian line processor: Reshapes characters and reorders BiDi.
 */
export function formatPersianText(text: string): string {
  const shaped = reshapePersian(text);
  return bidiReorder(shaped);
}

// -------------------------------------------------------------
// Font B (56 columns) Fixed-Width Layout Formatter
// -------------------------------------------------------------

/**
 * Returns a divider line of exactly `width` columns (default: 56).
 */
export function dividerLine(char: string = '-', width: number = FONT_B_COLUMNS): string {
  const c = char.charAt(0) || '-';
  return c.repeat(width);
}

/**
 * Centers text within `width` columns (default: 56), padding evenly with spaces.
 * Invariant: Returned string is guaranteed to be exactly `width` characters long.
 */
export function centerText(text: string, width: number = FONT_B_COLUMNS): string {
  const processed = formatPersianText(text);
  const len = processed.length;
  if (len >= width) return processed.slice(0, width);

  const totalPadding = width - len;
  const leftPad = Math.floor(totalPadding / 2);
  const rightPad = totalPadding - leftPad;

  return ' '.repeat(leftPad) + processed + ' '.repeat(rightPad);
}

/**
 * Formats a two-column justified row within `width` columns (default: 56).
 * Left column (e.g. price, quantity) is positioned on the left.
 * Right column (e.g. item name in Persian) is positioned on the right.
 * Invariant: Returned string is guaranteed to be exactly `width` characters long.
 */
export function formatTwoColumns(
  leftText: string,
  rightText: string,
  width: number = FONT_B_COLUMNS
): string {
  const formattedLeft = isRtlString(leftText) ? formatPersianText(leftText) : leftText;
  const formattedRight = isRtlString(rightText) ? formatPersianText(rightText) : rightText;

  const leftLen = formattedLeft.length;
  const rightLen = formattedRight.length;

  if (leftLen + rightLen >= width) {
    // If text exceeds width, truncate right column with ellipsis
    const maxRightLen = Math.max(1, width - leftLen - 1);
    const truncatedRight = formattedRight.slice(0, maxRightLen);
    const spaces = Math.max(1, width - leftLen - truncatedRight.length);
    return formattedLeft + ' '.repeat(spaces) + truncatedRight;
  }

  const spaces = width - leftLen - rightLen;
  return formattedLeft + ' '.repeat(spaces) + formattedRight;
}

function isRtlString(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (isRtlChar(str.charCodeAt(i))) return true;
  }
  return false;
}

// -------------------------------------------------------------
// Raw ESC/POS Binary Ticket Builder
// -------------------------------------------------------------

export interface ThermalTicketOptions {
  ticketId?: string | number;
  orderNumber?: string | number;
  tableLabel?: string;
  station?: string;
  brandNameFa?: string;
  items?: Array<{ name: string; quantity: number; notes?: string; priceToman?: number }>;
  totalAmountToman?: number;
  timestamp?: string | number;
  logoBuffer?: Buffer;
}

export class PersianEscPosRenderer {
  private chunks: Buffer[] = [];
  private readonly columns: number;

  constructor(columns: number = FONT_B_COLUMNS) {
    this.columns = columns;
  }

  /**
   * Initializes printer with ESC @ and selects Font B (56 columns).
   */
  public init(): this {
    this.chunks.push(ESC_POS_OPCODES.INIT);
    this.chunks.push(ESC_POS_OPCODES.FONT_B);
    return this;
  }

  /**
   * Selects Font B (9x17 font, 56 columns on 80mm).
   */
  public selectFontB(): this {
    this.chunks.push(ESC_POS_OPCODES.FONT_B);
    return this;
  }

  /**
   * Selects Font A (12x24 font, 42 columns on 80mm).
   */
  public selectFontA(): this {
    this.chunks.push(ESC_POS_OPCODES.FONT_A);
    return this;
  }

  public bold(enable: boolean = true): this {
    this.chunks.push(enable ? ESC_POS_OPCODES.BOLD_ON : ESC_POS_OPCODES.BOLD_OFF);
    return this;
  }

  public alignLeft(): this {
    this.chunks.push(ESC_POS_OPCODES.ALIGN_LEFT);
    return this;
  }

  public alignCenter(): this {
    this.chunks.push(ESC_POS_OPCODES.ALIGN_CENTER);
    return this;
  }

  public alignRight(): this {
    this.chunks.push(ESC_POS_OPCODES.ALIGN_RIGHT);
    return this;
  }

  public feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.chunks.push(ESC_POS_OPCODES.LINE_FEED);
    }
    return this;
  }

  /**
   * Appends raw binary opcode sequence.
   */
  /**
   * Appends pre-rendered ESC/POS raster graphics buffer (e.g., from RasterLogoRenderer).
   */
  public logo(buffer: Buffer): this {
    this.chunks.push(buffer);
    this.feed(1);
    return this;
  }

  public raw(buffer: Buffer): this {
    this.chunks.push(buffer);
    return this;
  }

  /**
   * Appends text, automatically applying Persian Presentation Forms-B shaping & BiDi reordering.
   */
  public text(str: string): this {
    const formatted = formatPersianText(str);
    this.chunks.push(Buffer.from(formatted, 'utf-8'));
    return this;
  }

  /**
   * Appends a line of text followed by a line feed.
   */
  public line(str: string = ''): this {
    if (str.length > 0) {
      this.text(str);
    }
    this.feed(1);
    return this;
  }

  /**
   * Appends a centered Persian text line conforming to the column width.
   */
  public centeredLine(str: string): this {
    const centered = centerText(str, this.columns);
    this.chunks.push(Buffer.from(centered, 'utf-8'));
    this.feed(1);
    return this;
  }

  /**
   * Appends a full divider line conforming to the 56-column width invariant.
   */
  public divider(char: string = '-'): this {
    const div = dividerLine(char, this.columns);
    this.chunks.push(Buffer.from(div, 'utf-8'));
    this.feed(1);
    return this;
  }

  /**
   * Appends a two-column justified row conforming strictly to the 56-column width invariant.
   */
  public twoColumn(left: string, right: string): this {
    const row = formatTwoColumns(left, right, this.columns);
    this.chunks.push(Buffer.from(row, 'utf-8'));
    this.feed(1);
    return this;
  }

  /**
   * Appends buzzer pulse to alert kitchen/bar staff.
   */
  public buzzer(): this {
    this.chunks.push(ESC_POS_OPCODES.BUZZER);
    return this;
  }

  /**
   * Appends GS V 0 (full paper cut).
   */
  public cut(partial: boolean = false): this {
    this.feed(3);
    this.chunks.push(partial ? ESC_POS_OPCODES.PAPER_CUT_PARTIAL : ESC_POS_OPCODES.PAPER_CUT);
    return this;
  }

  /**
   * Builds the final concatenated binary buffer for raw TCP transmission.
   */
  public toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Convenience helper to render a complete order or station dispatch ticket into Font B binary ESC/POS.
   */
  public static renderTicket(ticket: ThermalTicketOptions): Buffer {
    const renderer = new PersianEscPosRenderer(FONT_B_COLUMNS);
    const brand = ticket.brandNameFa || 'رستری تخصصی ۱۰۰ هیچ';
    const stationLabel = ticket.station === 'BAR' ? 'ایستگاه بار (BAR)' : 'ایستگاه آشپزخانه (KITCHEN)';
    const orderNo = ticket.orderNumber || ticket.ticketId || '101';
    const table = ticket.tableLabel || 'میز ۴';

    renderer.init();

    if (ticket.logoBuffer && ticket.logoBuffer.length > 0) {
      renderer.logo(ticket.logoBuffer);
    }

    renderer
      .alignCenter()
      .bold(true)
      .line(brand)
      .bold(false)
      .line(stationLabel)
      .divider('=')
      .twoColumn(`#${orderNo}`, table)
      .divider('-')
      .alignLeft();

    if (Array.isArray(ticket.items)) {
      for (const item of ticket.items) {
        const qtyPrefix = `${item.quantity}x`;
        renderer.twoColumn(qtyPrefix, item.name);
        if (item.notes) {
          renderer.twoColumn('', `* ${item.notes}`);
        }
      }
    }

    renderer
      .divider('=')
      .twoColumn(
        ticket.totalAmountToman !== undefined ? `${ticket.totalAmountToman.toLocaleString('en-US')} T` : '',
        'مجموع فاکتور'
      )
      .divider('-')
      .alignCenter()
      .line('سفارش ثبت شده در سیستم مرکزی CafeOS')
      .cut();

    return renderer.toBuffer();
  }

  /**
   * Prepend branded raster logo before rendering standard Persian ESC/POS ticket.
   */
  public static buildReceiptWithLogo(ticket: ThermalTicketOptions, logoBuffer: Buffer): Buffer {
    return this.renderTicket({
      ...ticket,
      logoBuffer,
    });
  }
}
