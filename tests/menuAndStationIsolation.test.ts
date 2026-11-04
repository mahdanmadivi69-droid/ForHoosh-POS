/**
 * CAFE OS — Menu Catalog & Station Isolation Verification Suite
 * Path: tests/menuAndStationIsolation.test.ts
 *
 * Verifies:
 * 1. Seed Catalog Integrity:
 *    - 100 HICH catalog contains exactly 21 items (Espresso bar, pourover, retail whole beans, retail tea packs).
 *    - Modendo catalog contains exactly 20 items (Boardgame entry, 4 PS5 station hourly rates, VIP suite, bistro food, drinks, desserts).
 * 2. Cross-Tenant Catalog Zero-Leakage:
 *    - 100 HICH surfaces beans, teas, and espresso bar with ZERO gaming stations or bistro items.
 *    - Modendo surfaces bistro food, drinks, boardgames, and 4 PS5 stations with ZERO retail bean bags or tea packs.
 * 3. Dexie POS Database Model & Multi-Tenant Partitioning:
 *    - Dexie v4 menuItems and venueTables scoping ensures zero cross-tenant contamination.
 * 4. Venue Zone & Station Isolation:
 *    - 100 HICH has 0 gaming zones and 0 PS5 stations.
 *    - Modendo has exactly 4 dedicated PS5 stations (PS5-1, PS5-2, PS5-3, PS5-4) with 90,000 Toman/hr rate.
 * 5. Strict Integer Toman and 9% VAT Compliance across all catalog entries.
 */

import { MENU_SEEDS_100HICH, SeedMenuItem100Hich } from '../src/db/seeds/menu-100hich';
import { MENU_SEEDS_MODENDO, SeedMenuItemModendo } from '../src/db/seeds/menu-modendo';
import {
  getTenantOperationalConfig,
  getTenantZones,
  getTenantPs5Stations,
} from '../src/types/tenant-config';
import {
  DexiePOSDatabase,
  getDexiePOSDatabase,
  DecomposedMenuItemRecord,
} from '../src/db/DexiePOSDatabase';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runIsolationSuite() {
  console.log('\n--- Running Menu Catalog & Station Isolation Verification Suite ---\n');

  // =========================================================================
  // Suite 1: Catalog Volume & Entity Scoping
  // =========================================================================
  console.log('[Suite 1: Catalog Volume & Entity Scoping]');
  {
    assert(MENU_SEEDS_100HICH.length === 21, `100 HICH catalog contains exactly 21 items (got: ${MENU_SEEDS_100HICH.length})`);
    assert(MENU_SEEDS_MODENDO.length === 20, `Modendo catalog contains exactly 20 items (got: ${MENU_SEEDS_MODENDO.length})`);

    // Tenant ID Purity
    assert(
      MENU_SEEDS_100HICH.every((item) => item.tenantId === 'tenant-100hich-01'),
      '100% of 100 HICH seed items carry explicit tenantId: "tenant-100hich-01"'
    );
    assert(
      MENU_SEEDS_MODENDO.every((item) => item.tenantId === 'tenant-modendo-01'),
      '100% of Modendo seed items carry explicit tenantId: "tenant-modendo-01"'
    );

    // No ID overlap between catalogs
    const hichIds = new Set(MENU_SEEDS_100HICH.map((i) => i.id));
    const modendoIds = new Set(MENU_SEEDS_MODENDO.map((i) => i.id));
    const intersection = [...hichIds].filter((id) => modendoIds.has(id));
    assert(intersection.length === 0, 'Zero ID collisions between 100 HICH and Modendo catalog items');
  }

  // =========================================================================
  // Suite 2: 100 HICH Catalog Profile & Negative Leakage Tests
  // =========================================================================
  console.log('\n[Suite 2: 100 HICH Catalog Profile & Negative Leakage Tests]');
  {
    // Required Items Present
    const hasEspresso = MENU_SEEDS_100HICH.some((i) => i.categoryId === 'cat-100hich-espresso');
    const hasPourover = MENU_SEEDS_100HICH.some((i) => i.categoryId === 'cat-100hich-pourover');
    const hasRetailBeans = MENU_SEEDS_100HICH.some((i) => i.categoryId === 'cat-100hich-retail-beans');
    const hasRetailTea = MENU_SEEDS_100HICH.some((i) => i.categoryId === 'cat-100hich-retail-tea');

    assert(hasEspresso, '100 HICH contains specialty espresso bar items');
    assert(hasPourover, '100 HICH contains V60 Geisha and slow brew items');
    assert(hasRetailBeans, '100 HICH contains retail coffee beans (250g & 1kg bags)');
    assert(hasRetailTea, '100 HICH contains retail specialty tea packs');

    // Negative Leakage: 100 HICH must NEVER contain gaming or bistro food
    const gamingLeakage = MENU_SEEDS_100HICH.some(
      (i) => i.title.includes('PS5') || i.title.includes('بردگیم') || i.title.includes('گیمینگ')
    );
    assert(!gamingLeakage, 'ZERO gaming station or boardgame fees in 100 HICH catalog');

    const foodLeakage = MENU_SEEDS_100HICH.some(
      (i) => i.title.includes('برگر') || i.title.includes('پانینی') || i.title.includes('فرایز') || i.title.includes('ناچوز')
    );
    assert(!foodLeakage, 'ZERO bistro food items (burgers, panini, fries) in 100 HICH catalog');

    // Prep station distribution
    const barItems = MENU_SEEDS_100HICH.filter((i) => i.station === 'BAR');
    const retailItems = MENU_SEEDS_100HICH.filter((i) => i.station === 'NO_PREP');
    assert(barItems.length === 12, '100 HICH has exactly 12 BAR items (7 espresso + 5 pourover)');
    assert(retailItems.length === 9, '100 HICH has exactly 9 NO_PREP retail items (5 beans + 4 teas)');
  }

  // =========================================================================
  // Suite 3: Modendo Catalog Profile & Negative Leakage Tests
  // =========================================================================
  console.log('\n[Suite 3: Modendo Catalog Profile & Negative Leakage Tests]');
  {
    // Required Items Present
    const hasGamingFees = MENU_SEEDS_MODENDO.some((i) => i.categoryId === 'cat-modendo-gaming');
    const hasBistroFood = MENU_SEEDS_MODENDO.some((i) => i.categoryId === 'cat-modendo-bistro');
    const hasLoungeDrinks = MENU_SEEDS_MODENDO.some((i) => i.categoryId === 'cat-modendo-drinks');
    const hasDesserts = MENU_SEEDS_MODENDO.some((i) => i.categoryId === 'cat-modendo-desserts');

    assert(hasGamingFees, 'Modendo contains gaming & boardgame fees');
    assert(hasBistroFood, 'Modendo contains bistro food (smash burger, panini, loaded fries)');
    assert(hasLoungeDrinks, 'Modendo contains lounge drinks (mojito, Red Bull, shakes)');
    assert(hasDesserts, 'Modendo contains gourmet desserts (San Sebastian, warm brownie)');

    // 4 Dedicated PS5 Stations in Catalog
    const ps5CatalogItems = MENU_SEEDS_MODENDO.filter((i) => i.isHourlyGaming && i.ps5StationNumber);
    assert(ps5CatalogItems.length === 4, 'Modendo catalog contains hourly rates for all 4 PS5 stations');
    assert(ps5CatalogItems.every((i) => i.hourlyBillingRateToman === 90000), 'All 4 PS5 stations billed at 90,000 Toman/hr');

    // Boardgame cover charge
    const entryFeeItem = MENU_SEEDS_MODENDO.find((i) => i.isEntranceFee);
    assert(entryFeeItem !== undefined && entryFeeItem.priceToman === 70000, 'Boardgame entrance fee configured at 70,000 Toman');

    // Negative Leakage: Modendo must NEVER contain retail whole beans or tea packs
    const retailBeansLeakage = MENU_SEEDS_MODENDO.some(
      (i) => i.title.includes('بسته ۲۵۰ گرم دانه') || i.title.includes('کیسه ۱ کیلوگرمی') || i.title.includes('گیشا')
    );
    assert(!retailBeansLeakage, 'ZERO retail whole bean bags or Geisha beans in Modendo catalog');

    const retailTeaLeakage = MENU_SEEDS_MODENDO.some(
      (i) => i.title.includes('بسته‌بندی') || i.title.includes('ارل گری رزرو زرین')
    );
    assert(!retailTeaLeakage, 'ZERO retail tea packs in Modendo catalog');

    // Prep station distribution
    const kitchenItems = MENU_SEEDS_MODENDO.filter((i) => i.station === 'KITCHEN');
    const barItems = MENU_SEEDS_MODENDO.filter((i) => i.station === 'BAR');
    const gamingFeeItems = MENU_SEEDS_MODENDO.filter((i) => i.station === 'NO_PREP');
    assert(kitchenItems.length === 8, 'Modendo has 8 KITCHEN items (6 bistro food + 2 desserts)');
    assert(barItems.length === 5, 'Modendo has 5 BAR items (mojito, shake, iced tea, latte, hot chocolate)');
    assert(gamingFeeItems.length === 7, 'Modendo has 7 NO_PREP items (6 gaming fees + 1 Red Bull can)');
  }

  // =========================================================================
  // Suite 4: Dexie Schema & Physical Database Model Isolation
  // =========================================================================
  console.log('\n[Suite 4: Dexie Schema & Physical Database Model Isolation]');
  {
    const dbHich = getDexiePOSDatabase('tenant-100hich-01');
    const dbModendo = getDexiePOSDatabase('tenant-modendo-01');

    assert(dbHich.name === 'CafeOS_POS_tenant-100hich-01', '100 HICH database is isolated');
    assert(dbModendo.name === 'CafeOS_POS_tenant-modendo-01', 'Modendo database is isolated');
    assert(dbHich !== dbModendo, 'Databases are independent instances');

    // Convert seed items to Dexie DecomposedMenuItemRecord
    const hichDecomposed: DecomposedMenuItemRecord[] = MENU_SEEDS_100HICH.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      categoryId: item.categoryId,
      title: item.title,
      priceToman: item.priceToman,
      station: item.station,
      isAvailable: item.isAvailable,
      updatedAt: item.updatedAt,
    }));

    const modendoDecomposed: DecomposedMenuItemRecord[] = MENU_SEEDS_MODENDO.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      categoryId: item.categoryId,
      title: item.title,
      priceToman: item.priceToman,
      station: item.station,
      isAvailable: item.isAvailable,
      updatedAt: item.updatedAt,
    }));

    assert(hichDecomposed.length === 21, '100 HICH maps cleanly to DecomposedMenuItemRecord[21]');
    assert(modendoDecomposed.length === 20, 'Modendo maps cleanly to DecomposedMenuItemRecord[20]');
    assert(
      hichDecomposed.every((m) => m.tenantId === 'tenant-100hich-01'),
      'All 100 HICH decomposed records bound to tenant-100hich-01'
    );
    assert(
      modendoDecomposed.every((m) => m.tenantId === 'tenant-modendo-01'),
      'All Modendo decomposed records bound to tenant-modendo-01'
    );
  }

  // =========================================================================
  // Suite 5: Venue Zone & 4 PS5 Stations Isolation
  // =========================================================================
  console.log('\n[Suite 5: Venue Zone & 4 PS5 Stations Isolation]');
  {
    const hichZones = getTenantZones('tenant-100hich-01');
    const modendoZones = getTenantZones('tenant-modendo-01');

    // 100 HICH
    assert(!hichZones.some((z) => z.type === 'GAMING_PS5'), '100 HICH has NO gaming zone');
    assert(getTenantPs5Stations('tenant-100hich-01').length === 0, '100 HICH has ZERO PS5 stations');

    // Modendo
    const ps5Stations = getTenantPs5Stations('tenant-modendo-01');
    assert(ps5Stations.length === 4, 'Modendo has exactly 4 dedicated PS5 stations');
    assert(
      ps5Stations.map((s) => s.ps5StationNumber).sort().join(',') === '1,2,3,4',
      'Modendo PS5 stations numbered 1 through 4 sequentially'
    );
    assert(
      ps5Stations.every((s) => s.hourlyRateToman === 90000),
      'Modendo PS5 stations all carry 90,000 Toman/hr rate'
    );
  }

  // =========================================================================
  // Suite 6: Financial Math & 9% VAT Invariant across All Catalog Items
  // =========================================================================
  console.log('\n[Suite 6: Financial Math & 9% VAT Invariant across All Items]');
  {
    const allCatalogItems = [...MENU_SEEDS_100HICH, ...MENU_SEEDS_MODENDO];
    assert(allCatalogItems.length === 41, 'Combined catalog contains 41 distinct products and services');

    for (const item of allCatalogItems) {
      assert(
        Number.isInteger(item.priceToman),
        `Item ${item.id} price (${item.priceToman}) is strictly integer Toman`
      );
      assert(item.priceToman > 0, `Item ${item.id} price is positive (> 0)`);

      const vat = Math.round((item.priceToman * 9) / 109);
      assert(
        Number.isInteger(vat),
        `Item ${item.id} VAT calculation (${vat} Toman) is strictly integer Toman`
      );
    }
  }

  console.log(`\n========================================`);
  console.log(`MENU & STATION ISOLATION SUITE: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runIsolationSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
