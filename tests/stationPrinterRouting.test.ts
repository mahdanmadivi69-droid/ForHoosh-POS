/**
 * tests/stationPrinterRouting.test.ts
 * 
 * KarWand POS — Station-Based Printing & Routing Verification Suite
 * 
 * Tests:
 *  1. Multi-Tenant Venue Rules (100 HICH bypass vs Modendo dual-station).
 *  2. Priority Resolution: itemOverrides -> categoryRoutes -> fallback to 'none'.
 *  3. Production Ticket Invariant: Absolute exclusion of financial/price fields.
 *  4. Cart Splitting: Isolated tickets for BAR and KITCHEN only when items exist.
 *  5. Zustand Store & IndexedDB Persistence.
 */

// Memory store for localStorage in Node test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

import {
  Station,
  PrinterRoutingConfig,
  DEFAULT_100HICH_PRINTER_ROUTING,
  DEFAULT_MODENDO_PRINTER_ROUTING,
  getDefaultRoutingConfigForTenant,
} from '../src/types/printerRouting';
import { RoutingService } from '../src/services/printer/routingService';
import { usePrinterStore } from '../src/stores/usePrinterStore';
import { getCafeDatabase } from '../src/db/cafeDb';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- Running Station-Based Printing & Routing Test Suite ---\n');

  // =========================================================================
  // SUITE 1: Multi-Tenant Venue Rules & Defaults
  // =========================================================================
  console.log('[Suite 1: Multi-Tenant Venue Rules & Defaults]');
  {
    const hichConfig = getDefaultRoutingConfigForTenant('tenant-100hich-01');
    assert(hichConfig.enabled === false, 'Venue 1 (100 HICH) default config is strictly enabled: false');
    assert(Object.keys(hichConfig.categoryRoutes).length === 0, '100 HICH has empty category routes (no physical printers)');

    const modendoConfig = getDefaultRoutingConfigForTenant('tenant-modendo-01');
    assert(modendoConfig.enabled === true, 'Venue 2 (Modendo) default config is strictly enabled: true');
    assert(modendoConfig.stations.bar.id === 'bar', 'Modendo configures active BAR station');
    assert(modendoConfig.stations.kitchen.id === 'kitchen', 'Modendo configures active KITCHEN station');
    assert(modendoConfig.categoryRoutes['coffee'] === 'bar', 'Modendo routes coffee to bar');
    assert(modendoConfig.categoryRoutes['burgers'] === 'kitchen', 'Modendo routes burgers to kitchen');
    assert(modendoConfig.categoryRoutes['cat-retail-beans'] === 'none', 'Modendo routes retail beans to none');
  }

  // =========================================================================
  // SUITE 2: Priority Resolution (itemOverrides -> categoryRoutes -> 'none')
  // =========================================================================
  console.log('\n[Suite 2: Priority Resolution (itemOverrides -> categoryRoutes -> none)]');
  {
    const testConfig: PrinterRoutingConfig = {
      enabled: true,
      categoryRoutes: {
        'beverages': 'bar',
        'bakery': 'kitchen',
        'retail': 'none',
      },
      itemOverrides: {
        'item-coldbrew-can': 'none',    // Overrides 'beverages' category to none
        'item-specialty-tea': 'kitchen', // Overrides 'beverages' category to kitchen
      },
      stations: DEFAULT_MODENDO_PRINTER_ROUTING.stations,
    };

    // Category routing
    assert(
      RoutingService.resolveItemStation('item-latte', 'beverages', testConfig) === 'bar',
      'Category route resolves beverage item to bar'
    );
    assert(
      RoutingService.resolveItemStation('item-croissant', 'bakery', testConfig) === 'kitchen',
      'Category route resolves bakery item to kitchen'
    );
    assert(
      RoutingService.resolveItemStation('item-beans', 'retail', testConfig) === 'none',
      'Category route resolves retail item to none'
    );
    assert(
      RoutingService.resolveItemStation('item-unknown', 'mystery_cat', testConfig) === 'none',
      'Unmapped category defaults safely to none'
    );

    // Item-level override precedence
    assert(
      RoutingService.resolveItemStation('item-coldbrew-can', 'beverages', testConfig) === 'none',
      'Item override takes precedence over category (coldbrew beverage overridden to none)'
    );
    assert(
      RoutingService.resolveItemStation('item-specialty-tea', 'beverages', testConfig) === 'kitchen',
      'Item override takes precedence over category (specialty tea overridden to kitchen)'
    );
  }

  // =========================================================================
  // SUITE 3: Cart Splitting & Invariant Financial Field Stripping
  // =========================================================================
  console.log('\n[Suite 3: Cart Splitting & Invariant Financial Field Stripping]');
  {
    const config = DEFAULT_MODENDO_PRINTER_ROUTING;

    const mixedOrder = {
      id: 'ORD-2026-99',
      orderNumber: 104,
      tableNumber: 'M-03',
      items: [
        {
          id: 'item-latte-01',
          categoryId: 'coffee',
          title: 'کافه لاته مودندو',
          quantity: 2,
          unitPrice: 85000,
          price: 85000,
          subtotal: 170000,
          notes: 'شیر کم‌چرب',
        },
        {
          id: 'item-burger-01',
          categoryId: 'burgers',
          title: 'برگر کلاسیک',
          quantity: 1,
          unitPrice: 185000,
          price: 185000,
          subtotal: 185000,
          modifiers: [{ nameFa: 'پنیر اضافه' }],
        },
        {
          id: 'item-beans-retail',
          categoryId: 'cat-retail-beans',
          title: 'دانه قهوه اتیوپی',
          quantity: 1,
          unitPrice: 350000,
          price: 350000,
          subtotal: 350000,
        },
      ],
    };

    const res = RoutingService.splitCartByStation(mixedOrder, config);

    assert(res.barTicket !== null, 'Bar ticket generated for mixed order');
    assert(res.kitchenTicket !== null, 'Kitchen ticket generated for mixed order');
    assert(res.tickets.length === 2, 'Exactly 2 production tickets returned');
    assert(res.unroutedCount === 1, 'Exactly 1 item (retail beans) skipped with none station');

    // Bar ticket contents
    assert(res.barTicket?.station === 'bar', 'Bar ticket station is bar');
    assert(res.barTicket?.tableNumber === 'M-03', 'Bar ticket retains tableNumber');
    assert(res.barTicket?.items.length === 1, 'Bar ticket has exactly 1 item');
    assert(res.barTicket?.items[0].name === 'کافه لاته مودندو', 'Bar ticket item title matches');
    assert(res.barTicket?.items[0].quantity === 2, 'Bar ticket item quantity matches');
    assert(res.barTicket?.items[0].notes === 'شیر کم‌چرب', 'Bar ticket item notes captured');

    // Kitchen ticket contents
    assert(res.kitchenTicket?.station === 'kitchen', 'Kitchen ticket station is kitchen');
    assert(res.kitchenTicket?.items.length === 1, 'Kitchen ticket has exactly 1 item');
    assert(res.kitchenTicket?.items[0].name === 'برگر کلاسیک', 'Kitchen ticket item title matches');
    assert(res.kitchenTicket?.items[0].notes === 'پنیر اضافه', 'Kitchen ticket captures modifier as notes');

    // CRITICAL FINANCIAL INVARIANT: Verify ZERO price/financial fields in tickets
    const checkNoPrices = (ticket: any, label: string) => {
      assert(ticket.price === undefined, `${label} does not have price`);
      assert(ticket.total === undefined, `${label} does not have total`);
      assert(ticket.subtotal === undefined, `${label} does not have subtotal`);
      ticket.items.forEach((it: any) => {
        assert(it.price === undefined, `${label} item does not have price`);
        assert(it.unitPrice === undefined, `${label} item does not have unitPrice`);
        assert(it.subtotal === undefined, `${label} item does not have subtotal`);
        assert(it.cost === undefined, `${label} item does not have cost`);
      });
    };

    checkNoPrices(res.barTicket, 'Bar Ticket');
    checkNoPrices(res.kitchenTicket, 'Kitchen Ticket');

    // Single Station Cart: Drinks only
    const barOnlyOrder = {
      id: 'ORD-BAR-ONLY',
      items: [{ id: 'latte', categoryId: 'espresso', title: 'Espresso', quantity: 1 }],
    };
    const barOnlyRes = RoutingService.splitCartByStation(barOnlyOrder, config);
    assert(barOnlyRes.barTicket !== null, 'Bar ticket exists for bar-only order');
    assert(barOnlyRes.kitchenTicket === null, 'Kitchen ticket is null when no kitchen items exist');
    assert(barOnlyRes.tickets.length === 1, 'Only 1 ticket returned for bar-only order');

    // Single Station Cart: Kitchen only
    const kitchenOnlyOrder = {
      id: 'ORD-KITCHEN-ONLY',
      items: [{ id: 'burger', categoryId: 'food', title: 'Burger', quantity: 2 }],
    };
    const kitchenOnlyRes = RoutingService.splitCartByStation(kitchenOnlyOrder, config);
    assert(kitchenOnlyRes.kitchenTicket !== null, 'Kitchen ticket exists for kitchen-only order');
    assert(kitchenOnlyRes.barTicket === null, 'Bar ticket is null when no bar items exist');
    assert(kitchenOnlyRes.tickets.length === 1, 'Only 1 ticket returned for kitchen-only order');

    // Zero Prep Cart: Retail only
    const retailOnlyOrder = {
      id: 'ORD-RETAIL-ONLY',
      items: [{ id: 'beans', categoryId: 'cat-retail-beans', title: 'Coffee Beans 250g', quantity: 1 }],
    };
    const retailRes = RoutingService.splitCartByStation(retailOnlyOrder, config);
    assert(retailRes.barTicket === null, 'Bar ticket is null for retail-only order');
    assert(retailRes.kitchenTicket === null, 'Kitchen ticket is null for retail-only order');
    assert(retailRes.tickets.length === 0, 'Zero production tickets generated for retail-only order');
  }

  // =========================================================================
  // SUITE 4: Safe Dispatch Execution & Venue 1 (100 HICH) Bypass
  // =========================================================================
  console.log('\n[Suite 4: Safe Dispatch Execution & Venue 1 (100 HICH) Bypass]');
  {
    // Venue 1: Disabled
    const disabledConfig = DEFAULT_100HICH_PRINTER_ROUTING;
    const sampleOrder = {
      id: 'ORD-100HICH-01',
      items: [{ id: 'latte', categoryId: 'coffee', title: 'Latte', quantity: 1 }],
    };

    const bypassResult = await RoutingService.dispatchProductionTickets(sampleOrder, disabledConfig, 'tenant-100hich-01');
    assert(bypassResult.success === true, 'Disabled venue dispatch returns success: true');
    assert(bypassResult.bypassed === true, 'Disabled venue dispatch flags bypassed: true');
    assert(bypassResult.tickets.length === 0, 'Zero tickets dispatched across network when disabled');

    // Venue 2: Enabled
    const enabledConfig = DEFAULT_MODENDO_PRINTER_ROUTING;
    const activeResult = await RoutingService.dispatchProductionTickets(sampleOrder, enabledConfig, 'tenant-modendo-01');
    assert(activeResult.success === true, 'Enabled venue dispatch returns success: true');
    assert(activeResult.bypassed === false, 'Enabled venue dispatch flags bypassed: false');
    assert(activeResult.tickets.length === 1, 'Ticket generated and dispatched for active venue');
  }

  // =========================================================================
  // SUITE 5: Zustand Store & IndexedDB Persistence
  // =========================================================================
  console.log('\n[Suite 5: Zustand Store & IndexedDB Persistence]');
  {
    const store = usePrinterStore.getState();

    // Wire mock appSettings for IndexedDB persistence test
    const mockDbModendo = getCafeDatabase('tenant-modendo-01');
    const dbStore = new Map<string, any>();
    mockDbModendo.appSettings = {
      get: async (key: string) => dbStore.get(key),
      put: async (record: any) => { dbStore.set(record.key, record); return record.key; },
    } as any;

    await store.setTenantId('tenant-modendo-01');
    assert(usePrinterStore.getState().tenantId === 'tenant-modendo-01', 'Store active tenant set to Modendo');
    assert(usePrinterStore.getState().config.enabled === true, 'Modendo initializes with enabled: true');

    // Toggle master
    await store.setEnabled(false);
    assert(usePrinterStore.getState().config.enabled === false, 'Master toggle updated to false');
    assert(dbStore.get('printer_routing_config')?.value.enabled === false, 'Master toggle persisted to IndexedDB');

    // Set category route
    await store.setCategoryRoute('pastry', 'bar');
    assert(usePrinterStore.getState().config.categoryRoutes['pastry'] === 'bar', 'Category route updated in store');
    assert(dbStore.get('printer_routing_config')?.value.categoryRoutes['pastry'] === 'bar', 'Category route persisted to IndexedDB');

    // Set item override
    await store.setItemOverride('item-croissant-choco', 'bar');
    assert(usePrinterStore.getState().config.itemOverrides['item-croissant-choco'] === 'bar', 'Item override set in store');
    assert(dbStore.get('printer_routing_config')?.value.itemOverrides['item-croissant-choco'] === 'bar', 'Item override persisted to IndexedDB');

    // Remove item override
    await store.removeItemOverride('item-croissant-choco');
    assert(usePrinterStore.getState().config.itemOverrides['item-croissant-choco'] === undefined, 'Item override removed');

    // Reload from storage test (simulate app reload)
    const reloadedConfig = await store.loadFromStorage('tenant-modendo-01');
    assert(reloadedConfig.categoryRoutes['pastry'] === 'bar', 'Config survives reload from IndexedDB');
  }

  console.log(`\n========================================`);
  console.log(`Station Printer Routing Suite: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
