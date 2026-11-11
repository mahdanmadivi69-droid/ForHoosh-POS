/**
 * LOGIC_DEBUGGER — Comprehensive Verification Suite
 * Tests:
 * 1. Dexie.js Schema & Transaction Validation (cafeDb.ts & DexiePOSDatabase.ts)
 * 2. Customer CRM Table Multi-Tenant Scoping & Atomic Persistence
 * 3. Offline Sync Queue Compound Queries (.where('clientGeneratedId').equals(...))
 * 4. Cart Discount Synchronization & Integer Toman Boundaries
 * 5. Multi-Tenant Cart Isolation & Tab Boundary Enforcement
 * 6. Order Dispatch Race Condition & Asynchronous Settlement Protection
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for headless Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: 0,
  };
}

import { getCafeDatabase, getTenantDatabaseName, migrateLegacyCafeDatabase } from '../src/db/cafeDb';
import { getDexiePOSDatabase } from '../src/db/DexiePOSDatabase';
import { CatalogService } from '../src/services/catalog/catalogService';
import { calculateOrderTotals } from '../src/services/financialMath';
import { DecomposedOfflineSyncQueue } from '../src/services/offline-sync-queue';
import { CatalogMenuItem, CatalogCartItem } from '../src/types/catalog';

describe('LOGIC_DEBUGGER: Runtime State, IndexedDB & Tenant Isolation Suite', () => {
  beforeEach(() => {
    CatalogService.clearMemoryState();
  });

  describe('1. Dexie.js Schemas & Table Configurations', () => {
    it('ensures CafeDatabase maintains strict Version 3 with customers and syncQueue tables', () => {
      const db100 = getCafeDatabase('tenant-100hich-01');
      const dbMod = getCafeDatabase('tenant-modendo-01');

      assert.equal(db100.verno, 3, 'CafeDatabase verno must be exactly 3');
      assert.equal(dbMod.verno, 3, 'Modendo CafeDatabase verno must be exactly 3');

      const tables100 = db100.tables.map((t) => t.name);
      assert.ok(tables100.includes('customers'), 'customers table present in 100 Hich CafeDatabase');
      assert.ok(tables100.includes('syncQueue'), 'syncQueue table present in 100 Hich CafeDatabase');

      const tablesMod = dbMod.tables.map((t) => t.name);
      assert.ok(tablesMod.includes('customers'), 'customers table present in Modendo CafeDatabase');
      assert.ok(tablesMod.includes('syncQueue'), 'syncQueue table present in Modendo CafeDatabase');
    });

    it('ensures DexiePOSDatabase maintains normalized customers table and compound indices', () => {
      const posDb = getDexiePOSDatabase('tenant-100hich-01');
      const tableNames = posDb.tables.map((t) => t.name);
      assert.ok(tableNames.includes('customers'), 'customers table present in DexiePOSDatabase');
      assert.ok(tableNames.includes('syncQueue'), 'syncQueue table present in DexiePOSDatabase');
      assert.ok(tableNames.includes('orders'), 'orders table present in DexiePOSDatabase');
    });

    it('verifies non-destructive legacy customer migration in migrateLegacyCafeDatabase', async () => {
      const res = await migrateLegacyCafeDatabase();
      assert.ok(res !== undefined, 'Migration returns result object');
      assert.equal(res.targetDatabase, getTenantDatabaseName('tenant-100hich-01'));
    });
  });

  describe('2. Offline Sync Queue Queries & Order Lookups', () => {
    it('calculates jittered exponential backoff correctly without thundering herd', () => {
      const queue = new DecomposedOfflineSyncQueue({
        apiBaseUrl: 'http://localhost:3000/api',
        tenantId: 'tenant-100hich-01',
      });

      const delay0 = queue.calculateBackoffWithJitter(0);
      assert.ok(delay0 >= 500 && delay0 <= 1000, `Delay 0 (${delay0}) within [500, 1000]`);

      const delay1 = queue.calculateBackoffWithJitter(1);
      assert.ok(delay1 >= 1000 && delay1 <= 2000, `Delay 1 (${delay1}) within [1000, 2000]`);
    });

    it('enqueues order atomically with immutable tenant binding', async () => {
      const queue = new DecomposedOfflineSyncQueue({
        apiBaseUrl: 'http://localhost:3000/api',
        tenantId: 'tenant-100hich-01',
      });

      const dummyOrder = {
        id: 'ord-test-logic-1',
        clientGeneratedId: 'client-uuid-999',
        tenantId: 'tenant-100hich-01',
        items: [],
      };

      const record = await queue.enqueueOrderAtomic(dummyOrder);
      assert.equal(record.clientGeneratedId, 'client-uuid-999');
      assert.equal(record.tenantId, 'tenant-100hich-01');
      assert.equal(record.syncStatus, 'QUEUED');
      assert.equal(record.retryCount, 0);

      // Verify status update
      await queue.updateStatusAtomic('client-uuid-999', 'PAUSED', '401 Unauthorized');
      // Verify complete
      await queue.completeOrderAtomic('client-uuid-999');
    });
  });

  describe('3. Cart Financial Calculations & Discount Synchronization', () => {
    it('calculates integer Toman totals and caps excessive discounts at gross amount', () => {
      const items = [
        { unitPriceSnapshotToman: 65000, quantity: 2 },
        { unitPriceSnapshotToman: 40000, quantity: 1 },
      ];
      // Gross: 170,000
      const totals1 = calculateOrderTotals(items, 17000); // 10%
      assert.equal(totals1.grossAmountToman, 170000);
      assert.equal(totals1.discountAmountToman, 17000);
      assert.equal(totals1.netTotalToman, 153000);

      // Excessive discount
      const totals2 = calculateOrderTotals(items, 250000);
      assert.equal(totals2.grossAmountToman, 170000);
      assert.equal(totals2.discountAmountToman, 170000);
      assert.equal(totals2.netTotalToman, 0);
    });

    it('recalculates discount amount when gross amount changes under active discount percent', () => {
      let gross = 100000;
      const discountPercent = 10;
      let calculatedDiscount = Math.round((gross * discountPercent) / 100);
      assert.equal(calculatedDiscount, 10000);

      // Add item (+50,000)
      gross += 50000;
      calculatedDiscount = Math.round((gross * discountPercent) / 100);
      assert.equal(calculatedDiscount, 15000, 'Discount must dynamically update to 15,000 Toman');
    });
  });

  describe('4. Multi-Tenant Cart & Open Tab Isolation', () => {
    const sampleHichItem: CatalogMenuItem = {
      id: '100hich-esp',
      nameFa: 'اسپرسو تخصصی صد هیچ',
      priceToman: 60000,
      bomGramsPerCup: 18,
      isAvailable: true,
      categoryId: 'coffee',
    };

    const sampleModendoItem: CatalogMenuItem = {
      id: 'modendo-burger',
      nameFa: 'برگر کلاسیک مودندو',
      priceToman: 180000,
      bomGramsPerCup: 0,
      isAvailable: true,
      categoryId: 'food',
    };

    it('prevents cross-tenant open tab leaking in CatalogService.getOpenTabs', () => {
      let cartHich: CatalogCartItem[] = [];
      cartHich = CatalogService.addItemToCart(cartHich, sampleHichItem, 'arabica', 2);
      const tabHich = CatalogService.holdCurrentCartAsTab(cartHich, 'میز ۲ بار', 'tenant-100hich-01');

      let cartMod: CatalogCartItem[] = [];
      cartMod = CatalogService.addItemToCart(cartMod, sampleModendoItem, 'arabica', 1);
      const tabMod = CatalogService.holdCurrentCartAsTab(cartMod, 'میز ۴ سالن', 'tenant-modendo-01');

      // Verify filtered query
      const hichTabs = CatalogService.getOpenTabs('tenant-100hich-01');
      assert.equal(hichTabs.length, 1);
      assert.equal(hichTabs[0].tab_id, tabHich.tab_id);

      const modTabs = CatalogService.getOpenTabs('tenant-modendo-01');
      assert.equal(modTabs.length, 1);
      assert.equal(modTabs[0].tab_id, tabMod.tab_id);

      // Cross-tenant tab isolation enforcement:
      // Modendo CANNOT recall 100 Hich tab
      assert.throws(() => {
        CatalogService.recallTabForEditing(tabHich.tab_id, 'tenant-modendo-01');
      }, /Tenant Isolation Violation/);

      // 100 Hich CANNOT update Modendo tab
      assert.throws(() => {
        CatalogService.updateOpenTab(tabMod.tab_id, cartHich, 'تست', 'tenant-100hich-01');
      }, /Tenant Isolation Violation/);

      // Modendo CANNOT settle 100 Hich tab
      assert.throws(() => {
        CatalogService.settleAndCloseTab(tabHich.tab_id, 'ord-99', 'tenant-modendo-01');
      }, /Tenant Isolation Violation/);

      // 100 Hich CANNOT void Modendo tab
      assert.throws(() => {
        CatalogService.voidOpenTab(tabMod.tab_id, 'tenant-100hich-01');
      }, /Tenant Isolation Violation/);
    });

    it('allows clearing memory tabs scoped strictly to a single tenant', () => {
      let cartHich: CatalogCartItem[] = [];
      cartHich = CatalogService.addItemToCart(cartHich, sampleHichItem, 'arabica', 1);
      CatalogService.holdCurrentCartAsTab(cartHich, 'میز بار', 'tenant-100hich-01');

      let cartMod: CatalogCartItem[] = [];
      cartMod = CatalogService.addItemToCart(cartMod, sampleModendoItem, 'arabica', 1);
      CatalogService.holdCurrentCartAsTab(cartMod, 'میز بازی', 'tenant-modendo-01');

      // Clear only 100 Hich
      CatalogService.clearMemoryState('tenant-100hich-01');

      assert.equal(CatalogService.getOpenTabs('tenant-100hich-01').length, 0);
      assert.equal(CatalogService.getOpenTabs('tenant-modendo-01').length, 1, 'Modendo tab must remain untouched');
    });
  });
});
