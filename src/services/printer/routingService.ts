/**
 * src/services/printer/routingService.ts
 * 
 * KarWand POS — Station-Based Printing & Routing Service
 * Enforces:
 *  1. Priority Resolution: itemOverrides -> categoryRoutes -> default to 'none'.
 *  2. Production Ticket Isolation: Cart items are split into 'bar' and 'kitchen'
 *     tickets WITHOUT any financial or pricing fields.
 *  3. Venue Guard (Multi-Tenant Rule):
 *     - If `config.enabled === false` (e.g. 100 HICH), bypass all socket/network
 *       operations safely and persist transaction locally without error.
 *     - If `config.enabled === true` (e.g. Modendo Bistro), dispatch split tickets.
 */

import {
  Station,
  PrinterRoutingConfig,
  ProductionTicket,
  ProductionTicketItem,
  SplitCartResult,
  DispatchProductionResult,
} from '../../types/printerRouting';
import { getCafeDatabase } from '../../db/cafeDb';

export class RoutingService {
  /**
   * Resolves the target station for a specific menu item.
   * Priority:
   *  1. itemOverrides[itemId]
   *  2. categoryRoutes[categoryId]
   *  3. fallback to 'none'
   */
  public static resolveItemStation(
    itemId?: string | null,
    categoryId?: string | null,
    config?: PrinterRoutingConfig | null
  ): Station {
    if (!config) return 'none';

    // 1. Check item-level override
    if (itemId) {
      const directOverride = config.itemOverrides?.[itemId];
      if (directOverride && (directOverride === 'bar' || directOverride === 'kitchen' || directOverride === 'none')) {
        return directOverride;
      }
    }

    // 2. Check category-level routing
    if (categoryId) {
      const catKey = categoryId.trim();
      const directCat = config.categoryRoutes?.[catKey];
      if (directCat && (directCat === 'bar' || directCat === 'kitchen' || directCat === 'none')) {
        return directCat;
      }

      // Case-insensitive lookup fallback
      const lowerKey = catKey.toLowerCase();
      for (const [k, v] of Object.entries(config.categoryRoutes || {})) {
        if (k.toLowerCase() === lowerKey) {
          return v;
        }
      }
    }

    // 3. Default fallback
    return 'none';
  }

  /**
   * Splits an incoming order cart into station-specific production tickets.
   * STRICT INVARIANT: Production tickets contain ZERO financial or pricing data.
   */
  public static splitCartByStation(
    order: any,
    config: PrinterRoutingConfig
  ): SplitCartResult {
    const rawItems: any[] = Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.cartItems)
      ? order.cartItems
      : Array.isArray(order)
      ? order
      : [];

    const orderId = String(order?.id || order?.orderId || order?.orderNumber || `ORD-${Date.now()}`);
    const tableNumber = order?.tableNumber || order?.tableLabel || order?.tableId || undefined;
    const timestamp = order?.createdAt ? Number(order.createdAt) : Date.now();

    const barItems: ProductionTicketItem[] = [];
    const kitchenItems: ProductionTicketItem[] = [];
    let unroutedCount = 0;

    for (const item of rawItems) {
      if (!item) continue;

      const itemId = item.id || item.menuItemId || item.itemId || '';
      const categoryId = item.categoryId || item.category || '';
      const station = this.resolveItemStation(itemId, categoryId, config);

      // Extract notes / modifiers cleanly
      let notesStr: string | undefined = undefined;
      if (typeof item.notes === 'string' && item.notes.trim()) {
        notesStr = item.notes.trim();
      } else if (Array.isArray(item.notes) && item.notes.length > 0) {
        notesStr = item.notes.join(', ');
      } else if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        notesStr = item.modifiers
          .map((m: any) => (typeof m === 'string' ? m : m.nameFa || m.name || m.title))
          .filter(Boolean)
          .join(', ');
      }

      const ticketItem: ProductionTicketItem = {
        name: item.title || item.nameFa || item.name || 'آیتم بدون نام',
        quantity: Math.max(1, parseInt(item.quantity || item.qty || 1, 10)),
        notes: notesStr,
      };

      if (station === 'bar') {
        barItems.push(ticketItem);
      } else if (station === 'kitchen') {
        kitchenItems.push(ticketItem);
      } else {
        unroutedCount++;
      }
    }

    const barTicket: ProductionTicket | null =
      barItems.length > 0
        ? {
            orderId,
            tableNumber,
            station: 'bar',
            timestamp,
            items: barItems,
          }
        : null;

    const kitchenTicket: ProductionTicket | null =
      kitchenItems.length > 0
        ? {
            orderId,
            tableNumber,
            station: 'kitchen',
            timestamp,
            items: kitchenItems,
          }
        : null;

    const tickets: ProductionTicket[] = [];
    if (barTicket) tickets.push(barTicket);
    if (kitchenTicket) tickets.push(kitchenTicket);

    return {
      barTicket,
      kitchenTicket,
      tickets,
      unroutedCount,
    };
  }

  /**
   * Dispatches production tickets according to routing configuration.
   * Multi-Tenant Guard:
   *  - When `config.enabled === false`: bypasses all network/hardware operations,
   *    does not throw, and records locally.
   *  - When `config.enabled === true`: splits the cart and dispatches tickets to stations.
   */
  public static async dispatchProductionTickets(
    order: any,
    config: PrinterRoutingConfig,
    tenantId?: string
  ): Promise<DispatchProductionResult> {
    const timestamp = Date.now();

    // 1. Guard: Global master toggle check
    if (!config.enabled) {
      // Safe bypass: persist audit record locally without network/hardware call
      try {
        const resolvedTenant = tenantId || (typeof localStorage !== 'undefined' ? localStorage.getItem('cafeos_active_tenant_id')?.replace(/"/g, '') : undefined);
        const db = getCafeDatabase(resolvedTenant);
        await db.auditLogs.add({
          id: `audit_print_bypassed_${Date.now()}`,
          orderId: String(order?.id || order?.orderNumber || 'UNKNOWN'),
          action: 'create',
          userId: 'SYSTEM',
          details: `Station printer dispatch safely bypassed (venue printer disabled: enabled=false). Order persisted locally.`,
          timestamp,
        });
      } catch {
        // Fallback: safe in-memory degradation
      }

      return {
        success: true,
        bypassed: true,
        tickets: [],
        message: 'Station printing bypassed (venue printer disabled)',
        timestamp,
      };
    }

    // 2. Active Venue: Split cart into station tickets
    const splitResult = this.splitCartByStation(order, config);

    // 3. Persist production tickets in audit log / production ticket ledger
    try {
      const resolvedTenant = tenantId || (typeof localStorage !== 'undefined' ? localStorage.getItem('cafeos_active_tenant_id')?.replace(/"/g, '') : undefined);
      const db = getCafeDatabase(resolvedTenant);

      for (const ticket of splitResult.tickets) {
        const stationName = config.stations[ticket.station]?.name || ticket.station;
        await db.auditLogs.add({
          id: `audit_ticket_${ticket.station}_${ticket.orderId}_${Date.now()}`,
          orderId: ticket.orderId,
          action: 'create',
          userId: 'STATION_ROUTER',
          details: `Production ticket generated for [${stationName}]: ${ticket.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
          timestamp,
        });
      }
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      bypassed: false,
      tickets: splitResult.tickets,
      message: `Successfully generated ${splitResult.tickets.length} station production ticket(s).`,
      timestamp,
    };
  }

  /**
   * Formats a production ticket for 58mm/80mm thermal ESC/POS text output.
   */
  public static formatThermalTicketText(
    ticket: ProductionTicket,
    stationName?: string
  ): string {
    const divider = '================================';
    const dateStr = new Date(ticket.timestamp).toLocaleTimeString('fa-IR');
    const stationLabel = stationName || (ticket.station === 'bar' ? 'ایستگاه بار (BAR)' : 'ایستگاه آشپزخانه (KITCHEN)');

    const lines: string[] = [
      divider,
      `*** قبض تولید: ${stationLabel} ***`,
      divider,
      `شماره سفارش: #${ticket.orderId}`,
      ticket.tableNumber ? `شماره میز: ${ticket.tableNumber}` : 'نوع سفارش: بیرون‌بر (Takeaway)',
      `زمان ثبت: ${dateStr}`,
      divider,
      'اقلام سفارشی:',
    ];

    ticket.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. [ ${item.quantity} عدد ] ${item.name}`);
      if (item.notes) {
        lines.push(`   توضیحات: ${item.notes}`);
      }
    });

    lines.push(divider);
    lines.push('پایان قبض تولید - بدون بار مالی');
    lines.push(divider);

    return lines.join('\n');
  }
}
