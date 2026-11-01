/**
 * CAFE OS — Ticket Layout Engine & Thermal Template Generator
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0
 *
 * Implements:
 *  - 42-char per line fixed-width monospace thermal formatting (80mm paper roll).
 *  - ESC/POS binary command buffer generation.
 *  - Headless iframe HTML template for staging/fallback printing.
 *  - Delta print banner ("سفارش تکمیلی / ADDITIONAL ORDER").
 *  - 2-column grid layout, indented modifiers, and conditional notes.
 */

import { StationDispatchTicket, RoutableCartItem } from '../services/StationRouter';

export const ESC_POS_COMMANDS = {
  init: new Uint8Array([27, 64]), // ESC @
  align_center: new Uint8Array([27, 97, 1]), // ESC a 1
  align_left: new Uint8Array([27, 97, 0]), // ESC a 0
  align_right: new Uint8Array([27, 97, 2]), // ESC a 2
  bold_on: new Uint8Array([27, 69, 1]), // ESC E 1
  bold_off: new Uint8Array([27, 69, 0]), // ESC E 0
  text_double_size: new Uint8Array([29, 33, 17]), // GS ! 17 (Double width & height)
  text_normal_size: new Uint8Array([29, 33, 0]), // GS ! 0
  paper_cut: new Uint8Array([29, 86, 0]), // GS V 0 (Full cut)
} as const;

export const TICKET_SPEC = {
  paper_width_mm: 80,
  char_per_line: 42,
  divider_char: '=',
  sub_divider_char: '-',
} as const;

/**
 * Helper to combine multiple Uint8Arrays into a single buffer.
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, a) => acc + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export class TicketLayoutEngine {
  private static readonly encoder = new TextEncoder();

  /**
   * Pads or aligns a 2-column grid row to exactly 42 characters.
   */
  public static formatTwoColumns(left: string, right: string, totalWidth: number = 42): string {
    const leftStr = left || '';
    const rightStr = right || '';
    const spacesNeeded = Math.max(1, totalWidth - leftStr.length - rightStr.length);
    return `${leftStr}${' '.repeat(spacesNeeded)}${rightStr}`;
  }

  /**
   * Formats a single item row with quantity (width 4) and item title (width 26).
   */
  public static formatItemRow(item: RoutableCartItem): string {
    const qtyStr = `${item.quantity}x`.padEnd(4, ' ');
    const titleStr = item.title.slice(0, 26).padEnd(26, ' ');
    const priceStr = item.subtotal ? `${item.subtotal.toLocaleString('fa-IR')} T` : '';
    const rightPadding = Math.max(1, TICKET_SPEC.char_per_line - qtyStr.length - titleStr.length - priceStr.length);
    return `${qtyStr}${titleStr}${' '.repeat(rightPadding)}${priceStr}`.trimEnd();
  }

  /**
   * Generates formatted Plain-Text representation of the kitchen ticket.
   */
  public static renderPlainText(ticket: StationDispatchTicket): string {
    const lines: string[] = [];
    const divider = TICKET_SPEC.divider_char.repeat(TICKET_SPEC.char_per_line);
    const subDivider = TICKET_SPEC.sub_divider_char.repeat(TICKET_SPEC.char_per_line);

    // 1. HEADER
    lines.push(divider);
    lines.push(`=== [ ${ticket.stationTitle} ] ===`);
    lines.push(divider);

    // DELTA PRINT HEADER FLAG
    if (ticket.isDelta) {
      lines.push('******************************************');
      lines.push(`  ${ticket.deltaHeaderFlag || 'سفارش تکمیلی / ADDITIONAL ORDER'}  `);
      lines.push('******************************************');
    }

    // 2. GRID 2-COL DETAILS
    lines.push(
      this.formatTwoColumns(
        `TICKET: #${ticket.ticketId}`,
        `TABLE: ${ticket.tableLabel}`
      )
    );
    lines.push(
      this.formatTwoColumns(
        `SERVER: ${ticket.cashierName}`,
        `TIME: ${ticket.timeStr}`
      )
    );

    // 3. SEPARATOR
    lines.push(subDivider);

    // 4. ITEMS LOOP
    if (ticket.items.length === 0) {
      lines.push('       [ بدون آیتم جدید جهت آماده‌سازی ]       ');
    } else {
      for (const item of ticket.items) {
        lines.push(this.formatItemRow(item));

        // Indented Modifiers
        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            const modName = typeof mod === 'string' ? mod : mod.nameFa || mod.id;
            lines.push(`    + ${modName}`);
          }
        }

        // Indented Notes
        if (item.notes) {
          const notesStr = Array.isArray(item.notes) ? item.notes.join('، ') : item.notes;
          lines.push(`    * توجه: ${notesStr}`);
        }
      }
    }

    // 5. SEPARATOR
    lines.push(subDivider);

    // 6. CONDITIONAL ORDER NOTES
    if (ticket.orderNotes) {
      lines.push(`NOTE: ${ticket.orderNotes}`);
      lines.push(subDivider);
    }

    // Footer spacing
    lines.push(`100 HICH SPECIALTY COFFEE - KDS DISPATCH`);
    lines.push('\n\n');

    return lines.join('\n');
  }

  /**
   * Generates ESC/POS Binary Buffer for direct USB, Serial or Network Socket printing.
   */
  public static renderEscPosBinary(ticket: StationDispatchTicket): Uint8Array {
    const buffers: Uint8Array[] = [];

    // 1. Initialize
    buffers.push(ESC_POS_COMMANDS.init);

    // 2. Station Header (Centered & Double Size)
    buffers.push(ESC_POS_COMMANDS.align_center);
    buffers.push(ESC_POS_COMMANDS.bold_on);
    buffers.push(ESC_POS_COMMANDS.text_double_size);
    buffers.push(this.encoder.encode(`\n[ ${ticket.station} ]\n`));
    buffers.push(ESC_POS_COMMANDS.text_normal_size);
    buffers.push(this.encoder.encode(`${ticket.stationTitle}\n`));
    buffers.push(ESC_POS_COMMANDS.bold_off);

    // DELTA BANNER IF APPLICABLE
    if (ticket.isDelta) {
      buffers.push(ESC_POS_COMMANDS.bold_on);
      buffers.push(this.encoder.encode(`\n*** ${ticket.deltaHeaderFlag || 'سفارش تکمیلی / ADDITIONAL ORDER'} ***\n\n`));
      buffers.push(ESC_POS_COMMANDS.bold_off);
    }

    // 3. Ticket and Table Metadata (Left aligned normal text)
    buffers.push(ESC_POS_COMMANDS.align_left);
    const divider = TICKET_SPEC.divider_char.repeat(TICKET_SPEC.char_per_line) + '\n';
    const subDivider = TICKET_SPEC.sub_divider_char.repeat(TICKET_SPEC.char_per_line) + '\n';

    buffers.push(this.encoder.encode(divider));
    buffers.push(
      this.encoder.encode(
        this.formatTwoColumns(`TICKET: #${ticket.ticketId}`, `TABLE: ${ticket.tableLabel}`) + '\n'
      )
    );
    buffers.push(
      this.encoder.encode(
        this.formatTwoColumns(`SERVER: ${ticket.cashierName}`, `TIME: ${ticket.timeStr}`) + '\n'
      )
    );
    buffers.push(this.encoder.encode(subDivider));

    // 4. Items Loop (Bold item titles)
    for (const item of ticket.items) {
      buffers.push(ESC_POS_COMMANDS.bold_on);
      buffers.push(this.encoder.encode(`${this.formatItemRow(item)}\n`));
      buffers.push(ESC_POS_COMMANDS.bold_off);

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modName = typeof mod === 'string' ? mod : mod.nameFa || mod.id;
          buffers.push(this.encoder.encode(`    + ${modName}\n`));
        }
      }

      if (item.notes) {
        const notesStr = Array.isArray(item.notes) ? item.notes.join('، ') : item.notes;
        buffers.push(this.encoder.encode(`    * NOTE: ${notesStr}\n`));
      }
    }

    buffers.push(this.encoder.encode(subDivider));

    // 5. Conditional Notes
    if (ticket.orderNotes) {
      buffers.push(ESC_POS_COMMANDS.bold_on);
      buffers.push(this.encoder.encode(`NOTE: ${ticket.orderNotes}\n`));
      buffers.push(ESC_POS_COMMANDS.bold_off);
      buffers.push(this.encoder.encode(subDivider));
    }

    // 6. Paper Feed and Cut
    buffers.push(this.encoder.encode('\n\n\n\n'));
    buffers.push(ESC_POS_COMMANDS.paper_cut);

    return concatUint8Arrays(buffers);
  }

  /**
   * Generates High-Resolution HTML string for the Headless Iframe Sandbox Fallback.
   * Matches container selector: #thermal-receipt-staging
   */
  public static renderHtml(ticket: StationDispatchTicket): string {
    const isKitchen = ticket.station === 'KITCHEN';
    const accentColor = isKitchen ? '#D97706' : '#2563EB'; // Amber for Kitchen, Blue for Bar

    return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <title>Ticket #${ticket.ticketId} - ${ticket.station}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, 'Vazirmatn', Tahoma, sans-serif;
      width: 80mm;
      max-width: 80mm;
      padding: 3mm 4mm;
      background: #ffffff;
      color: #000000;
      font-size: 13px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket-container {
      width: 100%;
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .station-badge {
      font-size: 16px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .delta-banner {
      background: #000000;
      color: #ffffff;
      font-weight: 900;
      font-size: 12px;
      padding: 4px;
      text-align: center;
      margin: 6px 0;
      border-radius: 2px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .divider {
      border-bottom: 1px dashed #000;
      margin: 6px 0;
    }
    .double-divider {
      border-bottom: 2px solid #000;
      margin: 6px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 800;
      margin-top: 5px;
    }
    .item-qty {
      min-width: 28px;
      font-weight: 900;
    }
    .item-name {
      flex: 1;
      text-align: right;
      padding-right: 4px;
    }
    .modifier-line {
      font-size: 11px;
      font-weight: normal;
      padding-right: 28px;
      color: #222;
    }
    .note-line {
      font-size: 11px;
      font-weight: bold;
      padding-right: 28px;
      font-style: italic;
    }
    .order-notes {
      background: #f4f4f4;
      border: 1px solid #ccc;
      padding: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-top: 6px;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px dashed #aaa;
    }
  </style>
</head>
<body>
  <div id="thermal-receipt-staging" class="ticket-container">
    <div class="header">
      <div class="station-badge">=== [ ${ticket.stationTitle} ] ===</div>
      <div style="font-size: 11px;">100 HICH COFFEE ROASTERS</div>
    </div>

    ${
      ticket.isDelta
        ? `<div class="delta-banner">⚠️ ${ticket.deltaHeaderFlag || 'سفارش تکمیلی / ADDITIONAL ORDER'} ⚠️</div>`
        : ''
    }

    <div class="meta-row">
      <span>TICKET: #${ticket.ticketId}</span>
      <span>TABLE: ${ticket.tableLabel}</span>
    </div>
    <div class="meta-row">
      <span>SERVER: ${ticket.cashierName}</span>
      <span>TIME: ${ticket.timeStr}</span>
    </div>

    <div class="divider"></div>

    <div class="items-list">
      ${ticket.items
        .map(
          (item) => `
        <div class="item-block">
          <div class="item-row">
            <span class="item-qty">${item.quantity}×</span>
            <span class="item-name">${item.title}</span>
          </div>
          ${(item.modifiers || [])
            .map(
              (m) =>
                `<div class="modifier-line">+ ${typeof m === 'string' ? m : m.nameFa || m.id}</div>`
            )
            .join('')}
          ${item.notes ? `<div class="note-line">* ${Array.isArray(item.notes) ? item.notes.join('، ') : item.notes}</div>` : ''}
        </div>
      `
        )
        .join('')}
    </div>

    <div class="divider"></div>

    ${
      ticket.orderNotes
        ? `
      <div class="order-notes">
        NOTE: ${ticket.orderNotes}
      </div>
      <div class="divider"></div>
    `
        : ''
    }

    <div class="footer">
      <span>CafeOS Dual Thermal Dispatch • Zero Viewport Leakage</span>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
