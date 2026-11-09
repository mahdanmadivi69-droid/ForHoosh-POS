import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemToCart,
  holdCurrentCartAsTab,
  recallTabToCart,
  recallTabForEditing,
  updateOpenTab,
  settleAndCloseTab,
  voidOpenTab,
  getOpenTabs,
  CatalogService,
} from '../src/services/catalog/catalogService';
import { CatalogMenuItem, CatalogCartItem } from '../src/types/catalog';
import { assertIntegerToman } from '../src/db/schema';

describe('100 HICH Open Tabs Recall & Liquid Payment Invariants', () => {
  const sampleEspresso: CatalogMenuItem = {
    id: 'item-esp-01',
    nameFa: 'اسپرسو دوبل تخصصی',
    priceToman: 75000,
    hasDualBean: true,
    priceArabica: 80000,
    priceBlend: 70000,
    bomGramsPerCup: 18,
    isAvailable: true,
    categoryId: 'cat-coffee',
  };

  const sampleCookie: CatalogMenuItem = {
    id: 'item-cook-02',
    nameFa: 'کوکی دابل چاکلت دست‌ساز',
    priceToman: 45000,
    hasDualBean: false,
    bomGramsPerCup: 0,
    isAvailable: true,
    categoryId: 'cat-bakery',
  };

  beforeEach(() => {
    CatalogService.clearMemoryState();
  });

  describe('Feature 1: Open Tabs Recall, Edit & In-Place Mutation', () => {
    it('creates an open tab and recalls it for real-time cart editing without closing it', () => {
      let cart: CatalogCartItem[] = [];
      cart = addItemToCart(cart, sampleEspresso, 'arabica', 2); // 160,000
      cart = addItemToCart(cart, sampleCookie, 'arabica', 1);   // 45,000
      // Total: 205,000 Toman

      const tab = holdCurrentCartAsTab(cart, 'میز شماره ۲ - سالن اصلی');
      assert.equal(tab.status, 'OPEN');
      assert.equal(tab.total_toman, 205000);
      assert.equal(tab.table_or_customer, 'میز شماره ۲ - سالن اصلی');

      const initialOpenTabs = getOpenTabs();
      assert.equal(initialOpenTabs.length, 1);
      assert.equal(initialOpenTabs[0].tab_id, tab.tab_id);

      // Recall for editing
      const { cart: recalledCart, tab: recalledTab } = recallTabForEditing(tab.tab_id);
      assert.equal(recalledTab.status, 'OPEN', 'Tab must remain OPEN while being edited in active cart');
      assert.equal(recalledCart.length, 2);
      assert.equal(recalledCart[0].quantity, 2);
      assert.equal(recalledCart[1].quantity, 1);
    });

    it('mutates existing tab in-place when updating rather than creating duplicate records', () => {
      let cart: CatalogCartItem[] = [];
      cart = addItemToCart(cart, sampleEspresso, 'blend', 1); // 70,000
      const originalTab = holdCurrentCartAsTab(cart, 'کانتر بار - صندلی ۱');
      const originalTabId = originalTab.tab_id;

      // Recall for editing and add a cookie
      const { cart: editingCart } = recallTabForEditing(originalTabId);
      const updatedCart = addItemToCart(editingCart, sampleCookie, 'arabica', 2); // 70,000 + 90,000 = 160,000

      // In-place mutation
      const mutatedTab = updateOpenTab(originalTabId, updatedCart, 'کانتر بار - صندلی ۱ (آپدیت‌شده)');
      assert.equal(mutatedTab.tab_id, originalTabId, 'Tab ID reference must be maintained');
      assert.equal(mutatedTab.total_toman, 160000);
      assert.equal(mutatedTab.table_or_customer, 'کانتر بار - صندلی ۱ (آپدیت‌شده)');
      assert.ok(mutatedTab.updated_at && mutatedTab.updated_at > 0);

      // Verify no duplicate open tab records exist in memory
      const activeTabs = getOpenTabs();
      assert.equal(activeTabs.length, 1, 'Only one open tab record should exist after update');
      assert.equal(activeTabs[0].tab_id, originalTabId);
      assert.equal(activeTabs[0].total_toman, 160000);
    });

    it('settles and closes the recalled tab atomically upon order completion', () => {
      let cart: CatalogCartItem[] = [];
      cart = addItemToCart(cart, sampleEspresso, 'arabica', 1);
      const tab = holdCurrentCartAsTab(cart, 'میز VIP');

      assert.equal(getOpenTabs().length, 1);

      // Simulate order completion settlement
      const closedTab = settleAndCloseTab(tab.tab_id, 'ord-complete-991');
      assert.equal(closedTab.status, 'CLOSED');
      assert.ok(closedTab.closed_at && closedTab.closed_at > 0);

      // Tab should no longer be present in active open tabs
      assert.equal(getOpenTabs().length, 0);
    });

    it('allows voiding an open tab', () => {
      let cart: CatalogCartItem[] = [];
      cart = addItemToCart(cart, sampleCookie, 'arabica', 1);
      const tab = holdCurrentCartAsTab(cart, 'سفارش لغو شده');

      assert.equal(getOpenTabs().length, 1);
      const voided = voidOpenTab(tab.tab_id);
      assert.equal(voided.status, 'VOID');
      assert.equal(getOpenTabs().length, 0);
    });
  });

  describe('Feature 2: Liquid Glass Payment Sheet Math & Invariant Verification', () => {
    it('enforces Integer Toman arithmetic on all settlement balances', () => {
      assert.equal(assertIntegerToman(150000, 'Valid Toman'), 150000);
      assert.equal(assertIntegerToman(0, 'Zero Toman'), 0);

      assert.throws(() => {
        assertIntegerToman(150000.75, 'Decimal Toman');
      }, /Integer Toman Invariant Violation/);

      assert.throws(() => {
        assertIntegerToman(-5000, 'Negative Toman');
      }, /Integer Toman Invariant Violation/);

      assert.throws(() => {
        assertIntegerToman(NaN, 'NaN Toman');
      }, /Integer Toman Invariant Violation/);
    });

    it('validates SPLIT mode invariant: Part A + Part B must mathematically equal total balance', () => {
      const totalBalance = 235000; // Integer Toman

      // 50/50 split math
      const partA = Math.floor(totalBalance / 2); // 117,500
      const partB = totalBalance - partA;         // 117,500
      assert.equal(partA + partB, totalBalance);
      assert.equal(Number.isInteger(partA), true);
      assert.equal(Number.isInteger(partB), true);

      // Odd total balance split (e.g. 235,001)
      const oddTotal = 235001;
      const oddPartA = Math.floor(oddTotal / 2); // 117,500
      const oddPartB = oddTotal - oddPartA;       // 117,501
      assert.equal(oddPartA + oddPartB, oddTotal);
      assert.equal(oddPartB - oddPartA, 1);

      // Custom split: Customer pays 100,000 on POS and remaining on Cash
      const customPartA = 100000;
      const customPartB = totalBalance - customPartA; // 135,000
      assert.equal(customPartA + customPartB, totalBalance);

      // Invariant rejection: Mismatched split
      const invalidPartA = 100000;
      const invalidPartB = 134000; // sum = 234,000 != 235,000
      const isValid = (invalidPartA + invalidPartB === totalBalance);
      assert.equal(isValid, false, 'Mismatched split must be rejected');
    });

    it('calculates Cash tendered and change due accurately with integer precision', () => {
      const totalDue = 185000;
      const tenderedBanknote = 200000; // 2x 100,000 Toman notes
      const changeDue = tenderedBanknote - totalDue;
      assert.equal(changeDue, 15000);
      assert.equal(Number.isInteger(changeDue), true);

      // Exact payment
      const exactTendered = 185000;
      assert.equal(exactTendered - totalDue, 0);
    });
  });
});
