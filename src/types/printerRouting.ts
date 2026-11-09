/**
 * src/types/printerRouting.ts
 * 
 * KarWand POS — Station-Based Printing & Routing Type Definitions
 * Designed for Multi-Tenant Venues:
 *  - 100 HICH: Zero physical printers (`enabled: false`), silent local bypass.
 *  - Modendo Bistro: Dual-station routing ('bar' and 'kitchen') without financial fields.
 */

export type Station = 'bar' | 'kitchen' | 'none';

export interface StationConfig {
  id: 'bar' | 'kitchen';
  name: string;
  printerId?: string;
  ip?: string;
  port?: number;
  paperWidth?: 58 | 80;
  isThermal?: boolean;
  autoCut?: boolean;
}

export interface PrinterRoutingConfig {
  enabled: boolean;
  categoryRoutes: Record<string, Station>;
  itemOverrides: Record<string, Station>;
  stations: Record<'bar' | 'kitchen', StationConfig>;
}

export interface ProductionTicketItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface ProductionTicket {
  orderId: string;
  tableNumber?: string | number;
  station: 'bar' | 'kitchen';
  timestamp: number;
  items: ProductionTicketItem[];
}

export interface SplitCartResult {
  barTicket: ProductionTicket | null;
  kitchenTicket: ProductionTicket | null;
  tickets: ProductionTicket[];
  unroutedCount: number;
}

export interface DispatchProductionResult {
  success: boolean;
  bypassed: boolean;
  tickets: ProductionTicket[];
  message?: string;
  timestamp: number;
}

/**
 * Default routing configuration for Venue 1 (100 HICH Specialty Coffee Roasters)
 * Strictly disabled: no physical printer, local bypass.
 */
export const DEFAULT_100HICH_PRINTER_ROUTING: PrinterRoutingConfig = {
  enabled: false,
  categoryRoutes: {},
  itemOverrides: {},
  stations: {
    bar: {
      id: 'bar',
      name: 'ایستگاه بار تخصصی (100 HICH Bar)',
      paperWidth: 80,
      isThermal: true,
      autoCut: true,
    },
    kitchen: {
      id: 'kitchen',
      name: 'ایستگاه آشپزخانه و بیکری',
      paperWidth: 80,
      isThermal: true,
      autoCut: true,
    },
  },
};

/**
 * Default routing configuration for Venue 2 (Modendo Cafe & Gaming Lounge)
 * Active dual-station printing for Bar and Kitchen.
 */
export const DEFAULT_MODENDO_PRINTER_ROUTING: PrinterRoutingConfig = {
  enabled: true,
  categoryRoutes: {
    // Barista & Beverage categories -> BAR
    'coffee': 'bar',
    'espresso': 'bar',
    'beverages': 'bar',
    'drinks': 'bar',
    'cold_bar': 'bar',
    'hot_bar': 'bar',
    'tea': 'bar',
    'mocktails': 'bar',
    'cat-espresso': 'bar',
    'cat-beverages': 'bar',
    'cat-tea': 'bar',

    // Kitchen & Food categories -> KITCHEN
    'food': 'kitchen',
    'warm_food': 'kitchen',
    'burgers': 'kitchen',
    'burger': 'kitchen',
    'sandwiches': 'kitchen',
    'bakery': 'kitchen',
    'pastry': 'kitchen',
    'cat-food': 'kitchen',
    'cat-burgers': 'kitchen',
    'cat-bakery': 'kitchen',

    // Retail, merchandise & boardgame vouchers -> NONE
    'cat-retail-beans': 'none',
    'retail-beans': 'none',
    'cat-mod-gaming': 'none',
    'mod-gaming': 'none',
    'gaming': 'none',
    'merchandise': 'none',
    'merch': 'none',
  },
  itemOverrides: {},
  stations: {
    bar: {
      id: 'bar',
      name: 'چاپگر سفارشات بار (Bar Station LAN)',
      printerId: 'printer-barista-01',
      ip: '192.168.1.101',
      port: 9100,
      paperWidth: 80,
      isThermal: true,
      autoCut: true,
    },
    kitchen: {
      id: 'kitchen',
      name: 'چاپگر سفارشات آشپزخانه (Kitchen Station LAN)',
      printerId: 'printer-kitchen-02',
      ip: '192.168.1.102',
      port: 9100,
      paperWidth: 80,
      isThermal: true,
      autoCut: true,
    },
  },
};

/**
 * Resolves the initial configuration according to tenant context.
 */
export function getDefaultRoutingConfigForTenant(tenantId?: string): PrinterRoutingConfig {
  const normalized = (tenantId || '').toLowerCase();
  if (normalized.includes('modendo')) {
    return JSON.parse(JSON.stringify(DEFAULT_MODENDO_PRINTER_ROUTING));
  }
  return JSON.parse(JSON.stringify(DEFAULT_100HICH_PRINTER_ROUTING));
}
