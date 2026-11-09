/**
 * src/types/catalog.ts
 * 
 * KarWand POS — 100 HICH Core & Sensory Lab Catalog Types
 * Enforces:
 *  - Integer Toman Invariant (zero fractional currency amounts).
 *  - Dual-Bean Matrix: arabica vs blend pricing and BOM grams per cup.
 */

export type SelectedBean = 'arabica' | 'blend';

export interface CatalogMenuItem {
  id: string;
  nameFa: string;
  nameEn?: string;
  categoryId: string;
  description?: string;
  roastLevelText?: string;
  badge?: string;
  isAvailable: boolean;

  // Base pricing
  basePriceToman?: number; // Integer Toman
  priceToman: number;      // Integer Toman

  // Dual-Bean Matrix
  hasDualBean: boolean;
  priceArabica?: number; // Integer Toman for 100% Arabica
  priceBlend?: number;   // Integer Toman for 50/50 Signature Blend
  bomGramsPerCup: number; // e.g. 18.0g or 20.0g per shot/serving
}

export interface CatalogCartItem {
  cartItemId: string;
  menuItemId: string;
  title: string;
  selectedBean?: SelectedBean;
  unitPriceToman: number; // Integer Toman
  unitPriceSnapshotToman?: number; // Alias for compatibility
  quantity: number;
  subtotalToman: number; // quantity * unitPriceToman (Integer Toman)
  bomGramsPerCup: number;
  notes?: string;
}

export interface InventoryGrainLedgerEntry {
  siloId: string;
  batchRoastCode: string;
  gramsDelta: number; // negative for deduction
  reason: string;
}

export interface OrderBomCalculation {
  orderId: string;
  totalGramsArabica: number;
  totalArabicaGrams?: number;
  totalGramsBlend: number;
  totalRobustaGrams?: number;
  totalGramsDeducted: number;
  ledgerEntries: InventoryGrainLedgerEntry[];
}
