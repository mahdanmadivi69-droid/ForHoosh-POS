/**
 * src/services/catalog/catalogService.ts
 * 
 * KarWand POS — 100 HICH Core & Sensory Lab Engine
 * Implements:
 *  - Strict Integer Toman Invariant (zero float leaks).
 *  - Dual-Bean Matrix (100% Arabica vs 50/50 Signature Blend).
 *  - Pure cart state management (addItemToCart).
 *  - Table Tab Lifecycle (holdCurrentCartAsTab, recallTabToCart).
 *  - BOM calculations (calculateOrderBom) linking orders to grain silos.
 */

import {
  SelectedBean,
  CatalogMenuItem,
  CatalogCartItem,
  OrderBomCalculation,
  InventoryGrainLedgerEntry,
} from '../../types/catalog';
import {
  OpenTabRecord,
  OrderRecord,
  OrderItemRecord,
  InventoryGrainLedgerRecord,
  assertIntegerToman,
} from '../../db/schema';
import { getCafeDatabase } from '../../db/cafeDb';

// In-memory tab and ledger store for rapid offline execution
const memoryTabs = new Map<string, OpenTabRecord>();
const memoryGrainLedger: InventoryGrainLedgerRecord[] = [];

export interface BomItemBreakdown {
  cartItemId: string;
  title: string;
  quantity: number;
  selectedBean: SelectedBean;
  arabicaGrams: number;
  robustaGrams: number;
  totalGrams: number;
}

export interface DetailedOrderBomCalculation extends OrderBomCalculation {
  itemsBreakdown: BomItemBreakdown[];
}

export class CatalogService {
  /**
   * Adds an item to the cart with strict Integer Toman pricing based on dual-bean selection.
   * Pure, immutable function.
   */
  public static addItemToCart(
    currentCart: CatalogCartItem[],
    item: CatalogMenuItem,
    selectedBean: SelectedBean = 'arabica',
    quantity: number = 1,
    notes?: string
  ): CatalogCartItem[] {
    const qty = Math.max(1, Math.round(quantity));

    // Strict validation on all item price properties
    if (item.priceToman !== undefined) assertIntegerToman(item.priceToman, `priceToman for ${item.nameFa}`);
    if (item.basePriceToman !== undefined) assertIntegerToman(item.basePriceToman, `basePriceToman for ${item.nameFa}`);
    if (item.priceArabica !== undefined) assertIntegerToman(item.priceArabica, `priceArabica for ${item.nameFa}`);
    if (item.priceBlend !== undefined) assertIntegerToman(item.priceBlend, `priceBlend for ${item.nameFa}`);

    // Resolve price with Integer Toman precision
    let unitPrice = item.priceToman ?? item.basePriceToman ?? 0;
    if (item.hasDualBean) {
      if (selectedBean === 'blend' && item.priceBlend !== undefined) {
        unitPrice = item.priceBlend;
      } else if (item.priceArabica !== undefined) {
        unitPrice = item.priceArabica;
      }
    }

    // Strict validation: No decimals allowed
    assertIntegerToman(unitPrice, `Item price for ${item.nameFa}`);

    const cleanNotes = notes?.trim() || undefined;

    // Check if an identical line item already exists in the cart
    const existingIndex = currentCart.findIndex(
      (c) =>
        c.menuItemId === item.id &&
        c.selectedBean === selectedBean &&
        c.notes === cleanNotes
    );

    if (existingIndex > -1) {
      const updatedCart = [...currentCart];
      const existing = updatedCart[existingIndex];
      const newQty = existing.quantity + qty;
      const subtotal = unitPrice * newQty;
      assertIntegerToman(subtotal, `Subtotal for ${item.nameFa}`);

      updatedCart[existingIndex] = {
        ...existing,
        quantity: newQty,
        unitPriceToman: unitPrice,
        unitPriceSnapshotToman: unitPrice,
        subtotalToman: subtotal,
      };
      return updatedCart;
    }

    // Append new line item
    const subtotal = unitPrice * qty;
    assertIntegerToman(subtotal, `Subtotal for ${item.nameFa}`);

    const newItem: CatalogCartItem = {
      cartItemId: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      menuItemId: item.id,
      title: item.nameFa,
      selectedBean,
      unitPriceToman: unitPrice,
      unitPriceSnapshotToman: unitPrice,
      quantity: qty,
      subtotalToman: subtotal,
      bomGramsPerCup: item.bomGramsPerCup || 18.0,
      notes: cleanNotes,
    };

    return [...currentCart, newItem];
  }

  /**
   * Holds current cart as an open table/customer tab.
   * Persists to memory immediately and writes to IndexedDB in background.
   */
  public static holdCurrentCartAsTab(
    cart: CatalogCartItem[],
    tableOrCustomer: string,
    tenantId: string = 'tenant-100hich-01'
  ): OpenTabRecord {
    if (!cart || cart.length === 0) {
      throw new Error('[CatalogService] Cannot hold an empty cart as a tab');
    }

    const totalToman = cart.reduce((acc, item) => acc + item.subtotalToman, 0);
    assertIntegerToman(totalToman, 'Tab Total');

    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tabRecord: OpenTabRecord = {
      tab_id: tabId,
      tabId,
      tenant_id: tenantId,
      table_or_customer: tableOrCustomer.trim() || 'میز موقت',
      tableOrCustomer: tableOrCustomer.trim() || 'میز موقت',
      raw_cart_json: JSON.stringify(cart),
      total_toman: totalToman,
      totalToman,
      status: 'OPEN',
      opened_at: Date.now(),
    };

    // Store in memory
    memoryTabs.set(tabRecord.tab_id, tabRecord);

    // Persist asynchronously to Dexie
    try {
      const db = getCafeDatabase(tenantId);
      db.appSettings.put({
        key: `tab_${tabRecord.tab_id}`,
        value: tabRecord,
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }

    return tabRecord;
  }

  /**
   * Recalls an open tab back to active cart state and closes the tab.
   */
  public static recallTabToCart(
    tabOrId: string | OpenTabRecord,
    tenantId: string = 'tenant-100hich-01'
  ): { cart: CatalogCartItem[]; tab: OpenTabRecord } {
    let tab: OpenTabRecord | undefined;

    if (typeof tabOrId === 'string') {
      tab = memoryTabs.get(tabOrId);
    } else {
      tab = memoryTabs.get(tabOrId.tab_id) || tabOrId;
    }

    if (!tab) {
      throw new Error(`[CatalogService] Tab not found`);
    }

    if (tab.status !== 'OPEN') {
      throw new Error(`[CatalogService] Cannot recall tab with status: ${tab.status}`);
    }

    // Mark closed
    const updatedTab: OpenTabRecord = {
      ...tab,
      status: 'CLOSED',
      closed_at: Date.now(),
    };
    memoryTabs.set(updatedTab.tab_id, updatedTab);

    try {
      const db = getCafeDatabase(tenantId);
      db.appSettings.put({
        key: `tab_${updatedTab.tab_id}`,
        value: updatedTab,
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }

    const cart: CatalogCartItem[] = JSON.parse(updatedTab.raw_cart_json);
    return { cart, tab: updatedTab };
  }

  /**
   * Recalls an open tab into the active cart for real-time additions/modifications
   * without closing the tab (retains active tab identity).
   */
  public static recallTabForEditing(
    tabOrId: string | OpenTabRecord,
    tenantId: string = 'tenant-100hich-01'
  ): { cart: CatalogCartItem[]; tab: OpenTabRecord } {
    let tab: OpenTabRecord | undefined;

    if (typeof tabOrId === 'string') {
      tab = memoryTabs.get(tabOrId);
    } else {
      tab = memoryTabs.get(tabOrId.tab_id) || tabOrId;
    }

    if (!tab) {
      throw new Error(`[CatalogService] Tab not found`);
    }

    if (tab.status !== 'OPEN') {
      throw new Error(`[CatalogService] Cannot recall tab with status: ${tab.status}`);
    }

    const cart: CatalogCartItem[] = JSON.parse(tab.raw_cart_json);
    return { cart, tab };
  }

  /**
   * Updates an existing open tab in place (mutates rather than duplicating).
   */
  public static updateOpenTab(
    tabId: string,
    cart: CatalogCartItem[],
    tableOrCustomer?: string,
    tenantId: string = 'tenant-100hich-01'
  ): OpenTabRecord {
    const existing = memoryTabs.get(tabId);
    if (!existing) {
      throw new Error(`[CatalogService] Tab "${tabId}" not found for update`);
    }
    if (existing.status !== 'OPEN') {
      throw new Error(`[CatalogService] Cannot update tab "${tabId}" with status ${existing.status}`);
    }
    if (!cart || cart.length === 0) {
      throw new Error('[CatalogService] Cannot update tab with an empty cart');
    }

    const totalToman = cart.reduce((acc, item) => acc + item.subtotalToman, 0);
    assertIntegerToman(totalToman, 'Tab Total');

    const updatedTab: OpenTabRecord = {
      ...existing,
      table_or_customer: tableOrCustomer?.trim() || existing.table_or_customer,
      tableOrCustomer: tableOrCustomer?.trim() || existing.table_or_customer,
      raw_cart_json: JSON.stringify(cart),
      total_toman: totalToman,
      totalToman,
      updated_at: Date.now(),
    };

    memoryTabs.set(tabId, updatedTab);

    try {
      const db = getCafeDatabase(tenantId);
      db.appSettings.put({
        key: `tab_${tabId}`,
        value: updatedTab,
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }

    return updatedTab;
  }

  /**
   * Settles and closes an active tab when an order is completed.
   */
  public static settleAndCloseTab(
    tabId: string,
    orderId?: string,
    tenantId: string = 'tenant-100hich-01'
  ): OpenTabRecord {
    const existing = memoryTabs.get(tabId);
    if (!existing) {
      throw new Error(`[CatalogService] Tab "${tabId}" not found to settle`);
    }

    const closedTab: OpenTabRecord = {
      ...existing,
      status: 'CLOSED',
      closed_at: Date.now(),
      updated_at: Date.now(),
    };

    memoryTabs.set(tabId, closedTab);

    try {
      const db = getCafeDatabase(tenantId);
      db.appSettings.put({
        key: `tab_${tabId}`,
        value: closedTab,
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }

    return closedTab;
  }

  /**
   * Voids an open tab.
   */
  public static voidOpenTab(
    tabId: string,
    tenantId: string = 'tenant-100hich-01'
  ): OpenTabRecord {
    const existing = memoryTabs.get(tabId);
    if (!existing) {
      throw new Error(`[CatalogService] Tab "${tabId}" not found to void`);
    }

    const voidedTab: OpenTabRecord = {
      ...existing,
      status: 'VOID',
      closed_at: Date.now(),
      updated_at: Date.now(),
    };

    memoryTabs.set(tabId, voidedTab);

    try {
      const db = getCafeDatabase(tenantId);
      db.appSettings.put({
        key: `tab_${tabId}`,
        value: voidedTab,
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }

    return voidedTab;
  }

  /**
   * Calculates the exact BOM grain deductions by silo for an order.
   * Differentiates 100% Arabica vs 50/50 Signature Blend.
   */
  public static calculateOrderBom(
    cart: CatalogCartItem[],
    orderId: string
  ): DetailedOrderBomCalculation {
    let totalArabicaGrams = 0.0;
    let totalRobustaGrams = 0.0;
    const itemsBreakdown: BomItemBreakdown[] = [];

    for (const item of cart) {
      const gramsPerServing = Number(item.bomGramsPerCup) || 18.0;
      const itemTotalGrams = item.quantity * gramsPerServing;

      if (item.selectedBean === 'blend') {
        const arabicaPart = itemTotalGrams * 0.5;
        const robustaPart = itemTotalGrams * 0.5;
        totalArabicaGrams += arabicaPart;
        totalRobustaGrams += robustaPart;

        itemsBreakdown.push({
          cartItemId: item.cartItemId,
          title: item.title,
          quantity: item.quantity,
          selectedBean: 'blend',
          arabicaGrams: arabicaPart,
          robustaGrams: robustaPart,
          totalGrams: itemTotalGrams,
        });
      } else {
        totalArabicaGrams += itemTotalGrams;

        itemsBreakdown.push({
          cartItemId: item.cartItemId,
          title: item.title,
          quantity: item.quantity,
          selectedBean: 'arabica',
          arabicaGrams: itemTotalGrams,
          robustaGrams: 0,
          totalGrams: itemTotalGrams,
        });
      }
    }

    const roundedArabica = Math.round(totalArabicaGrams * 10) / 10;
    const roundedRobusta = Math.round(totalRobustaGrams * 10) / 10;
    const totalDeducted = Math.round((roundedArabica + roundedRobusta) * 10) / 10;

    const ledgerEntries: InventoryGrainLedgerEntry[] = [];
    if (roundedArabica > 0) {
      ledgerEntries.push({
        siloId: 'SILO_ARABICA_01',
        batchRoastCode: 'HICH-ETH-ARABICA-B04',
        gramsDelta: -roundedArabica,
        reason: `ORDER_PREP_100_ARABICA (#${orderId})`,
      });
    }
    if (roundedRobusta > 0) {
      ledgerEntries.push({
        siloId: 'SILO_BLEND_02',
        batchRoastCode: 'HICH-5050-BLEND-B01',
        gramsDelta: -roundedRobusta,
        reason: `ORDER_PREP_5050_BLEND (#${orderId})`,
      });
    }

    return {
      orderId,
      totalGramsArabica: roundedArabica,
      totalGramsBlend: roundedRobusta,
      totalArabicaGrams: roundedArabica,
      totalRobustaGrams: roundedRobusta,
      totalGramsDeducted: totalDeducted,
      itemsBreakdown,
      ledgerEntries,
    };
  }

  /**
   * Records grain deductions directly into the inventory grain ledger.
   */
  public static recordGrainDeductions(
    calculation: DetailedOrderBomCalculation | OrderBomCalculation,
    batchRoastCodeOverride?: string,
    tenantId: string = 'tenant-100hich-01'
  ): InventoryGrainLedgerRecord[] {
    const timestamp = Date.now();
    const records: InventoryGrainLedgerRecord[] = calculation.ledgerEntries.map((entry, idx) => ({
      id: `grain_deduct_${calculation.orderId}_${idx}_${timestamp}`,
      tenant_id: tenantId,
      silo_id: entry.siloId,
      siloId: entry.siloId,
      batch_roast_code: batchRoastCodeOverride || entry.batchRoastCode,
      batchRoastCode: batchRoastCodeOverride || entry.batchRoastCode,
      grams_delta: entry.gramsDelta,
      gramsDelta: entry.gramsDelta,
      reason: entry.reason,
      order_id: calculation.orderId,
      orderId: calculation.orderId,
      timestamp,
    }));

    memoryGrainLedger.push(...records);

    // Save to Dexie in background
    try {
      const db = getCafeDatabase(tenantId);
      for (const record of records) {
        db.auditLogs.add({
          id: record.id,
          orderId: calculation.orderId,
          action: 'edit_items',
          userId: 'BOM_GRAIN_ROUTER',
          details: `Deducted ${Math.abs(record.grams_delta)}g from ${record.silo_id} (${record.batch_roast_code}). Reason: ${record.reason}`,
          timestamp,
        }).catch(() => {});
      }
    } catch {
      // Non-blocking
    }

    return records;
  }

  /**
   * Returns active open tabs.
   */
  public static getOpenTabs(): OpenTabRecord[] {
    return Array.from(memoryTabs.values()).filter((t) => t.status === 'OPEN');
  }

  /**
   * Clears memory tabs (for testing).
   */
  public static clearMemoryState(): void {
    memoryTabs.clear();
    memoryGrainLedger.length = 0;
  }
}

// Standalone function exports for modular ergonomic usage
export const addItemToCart = CatalogService.addItemToCart;
export const holdCurrentCartAsTab = CatalogService.holdCurrentCartAsTab;
export const recallTabToCart = CatalogService.recallTabToCart;
export const recallTabForEditing = CatalogService.recallTabForEditing;
export const updateOpenTab = CatalogService.updateOpenTab;
export const settleAndCloseTab = CatalogService.settleAndCloseTab;
export const voidOpenTab = CatalogService.voidOpenTab;
export const getOpenTabs = CatalogService.getOpenTabs;
export const calculateOrderBom = CatalogService.calculateOrderBom;
export const recordGrainDeductions = CatalogService.recordGrainDeductions;
