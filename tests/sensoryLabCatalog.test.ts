import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemToCart,
  holdCurrentCartAsTab,
  recallTabToCart,
  calculateOrderBom,
  recordGrainDeductions,
} from '../src/services/catalog/catalogService';
import { CatalogMenuItem, CatalogCartItem } from '../src/types/catalog';
import { SQLITE_SCHEMA_DDL } from '../src/db/schema';

describe('100 HICH Sensory Lab & Catalog Engine Tests', () => {
  const sampleLatte: CatalogMenuItem = {
    id: 'item-latte-001',
    nameFa: 'لته آرت سنسوری',
    priceToman: 90000,
    hasDualBean: true,
    priceArabica: 98000,
    priceBlend: 85000,
    bomGramsPerCup: 18,
    isAvailable: true,
    categoryId: 'cat-espresso',
  };

  const sampleSingleOrigin: CatalogMenuItem = {
    id: 'item-ethiopia-002',
    nameFa: 'اتیوپی گوجی تخصصی',
    priceToman: 115000,
    hasDualBean: false,
    bomGramsPerCup: 20,
    isAvailable: true,
    categoryId: 'cat-filter',
  };

  it('enforces Integer Toman Invariant (strictly rejects floating-point currencies)', () => {
    assert.throws(
      () => {
        addItemToCart([], { ...sampleLatte, priceToman: 90000.5 }, 'arabica');
      },
      /Integer Toman Invariant Violation/,
      'Must reject float priceToman'
    );

    assert.throws(
      () => {
        addItemToCart([], { ...sampleLatte, priceArabica: 98000.75 }, 'arabica');
      },
      /Integer Toman Invariant Violation/,
      'Must reject float priceArabica'
    );

    assert.throws(
      () => {
        addItemToCart([], { ...sampleLatte, priceBlend: 85000.25 }, 'blend');
      },
      /Integer Toman Invariant Violation/,
      'Must reject float priceBlend'
    );
  });

  it('resolves dual-bean pricing matrix correctly (Arabica vs Blend)', () => {
    const cartArabica = addItemToCart([], sampleLatte, 'arabica');
    assert.equal(cartArabica.length, 1);
    assert.equal(cartArabica[0].unitPriceSnapshotToman, 98000);
    assert.equal(cartArabica[0].subtotalToman, 98000);
    assert.equal(cartArabica[0].selectedBean, 'arabica');

    const cartBlend = addItemToCart([], sampleLatte, 'blend');
    assert.equal(cartBlend.length, 1);
    assert.equal(cartBlend[0].unitPriceSnapshotToman, 85000);
    assert.equal(cartBlend[0].subtotalToman, 85000);
    assert.equal(cartBlend[0].selectedBean, 'blend');

    // Single origin without dual bean uses default priceToman
    const cartSingle = addItemToCart([], sampleSingleOrigin, 'arabica');
    assert.equal(cartSingle.length, 1);
    assert.equal(cartSingle[0].unitPriceSnapshotToman, 115000);
    assert.equal(cartSingle[0].subtotalToman, 115000);
  });

  it('aggregates same-bean cart items and separates different beans', () => {
    let cart: CatalogCartItem[] = [];
    cart = addItemToCart(cart, sampleLatte, 'arabica', 1);
    cart = addItemToCart(cart, sampleLatte, 'arabica', 2);
    assert.equal(cart.length, 1);
    assert.equal(cart[0].quantity, 3);
    assert.equal(cart[0].subtotalToman, 3 * 98000);

    // Adding blend creates separate line item
    cart = addItemToCart(cart, sampleLatte, 'blend', 1);
    assert.equal(cart.length, 2);
    assert.equal(cart[1].quantity, 1);
    assert.equal(cart[1].subtotalToman, 85000);
  });

  it('holds cart as an open tab and recalls it atomically', () => {
    let cart: CatalogCartItem[] = [];
    cart = addItemToCart(cart, sampleLatte, 'arabica', 2); // 196,000
    cart = addItemToCart(cart, sampleSingleOrigin, 'arabica', 1); // 115,000
    // Total = 311,000 Toman

    const tab = holdCurrentCartAsTab(cart, 'میز شماره ۴ - بخش VIP');
    assert.equal(tab.tableOrCustomer, 'میز شماره ۴ - بخش VIP');
    assert.equal(tab.totalToman, 311000);
    assert.equal(tab.status, 'OPEN');
    assert.ok(tab.tabId.startsWith('tab-'));

    const { cart: recalledCart, tab: updatedTab } = recallTabToCart(tab);
    assert.equal(updatedTab.status, 'CLOSED');
    assert.equal(recalledCart.length, 2);
    assert.equal(recalledCart[0].quantity, 2);
    assert.equal(recalledCart[1].quantity, 1);

    // Cannot recall already closed tab
    assert.throws(() => {
      recallTabToCart(updatedTab);
    }, /Cannot recall tab with status: CLOSED/);
  });

  it('calculates BOM grain deductions exactly for Arabica vs Blend silos', () => {
    let cart: CatalogCartItem[] = [];
    // 2 cups Latte Arabica (18g each = 36g Arabica)
    cart = addItemToCart(cart, sampleLatte, 'arabica', 2);
    // 1 cup Latte Blend (18g = 9g Arabica + 9g Robusta)
    cart = addItemToCart(cart, sampleLatte, 'blend', 1);
    // 1 cup Single Origin (20g Arabica)
    cart = addItemToCart(cart, sampleSingleOrigin, 'arabica', 1);

    const bomCalc = calculateOrderBom(cart, 'ord-test-8899');
    assert.equal(bomCalc.orderId, 'ord-test-8899');
    // Total Arabica = 36g + 9g + 20g = 65g
    assert.equal(bomCalc.totalArabicaGrams, 65);
    // Total Robusta = 9g
    assert.equal(bomCalc.totalRobustaGrams, 9);
    assert.equal(bomCalc.itemsBreakdown.length, 3);

    // Verify grain ledger records
    const ledgerEntries = recordGrainDeductions(bomCalc, 'ROAST-BATCH-2026-11');
    assert.equal(ledgerEntries.length, 2);

    const arabicaEntry = ledgerEntries.find((l) => l.siloId === 'SILO_ARABICA_01');
    const blendEntry = ledgerEntries.find((l) => l.siloId === 'SILO_BLEND_02');

    assert.ok(arabicaEntry);
    assert.equal(arabicaEntry.gramsDelta, -65);
    assert.equal(arabicaEntry.batchRoastCode, 'ROAST-BATCH-2026-11');

    assert.ok(blendEntry);
    assert.equal(blendEntry.gramsDelta, -9);
    assert.equal(blendEntry.batchRoastCode, 'ROAST-BATCH-2026-11');
  });

  it('validates SQLite schema DDL syntax and tables', () => {
    assert.ok(SQLITE_SCHEMA_DDL.includes('CREATE TABLE IF NOT EXISTS orders'));
    assert.ok(SQLITE_SCHEMA_DDL.includes('CREATE TABLE IF NOT EXISTS order_items'));
    assert.ok(SQLITE_SCHEMA_DDL.includes('CREATE TABLE IF NOT EXISTS open_tabs'));
    assert.ok(SQLITE_SCHEMA_DDL.includes('CREATE TABLE IF NOT EXISTS inventory_grain_ledger'));
    assert.ok(SQLITE_SCHEMA_DDL.includes('subtotal_toman INTEGER NOT NULL'));
    assert.ok(SQLITE_SCHEMA_DDL.includes('bom_grams_deducted REAL NOT NULL'));
  });
});
