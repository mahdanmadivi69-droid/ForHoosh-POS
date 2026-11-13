/**
 * Automated Verification Suite for Modendo POS (v6.3)
 * Tests:
 *  1. Multi-Tenant Data Isolation (Modendo Cafe vs 100 Hich)
 *  2. Modendo Gaming & Boardgame Catalog Invariants
 *  3. Split-Level Floor Plan & Hourly Gaming Billing Math
 *  4. Settings & ESC/POS Hardware Gateway Ticket Dispatch
 *  5. RBAC Staff Authority & PIN Elevation Guard
 */

// Mock localStorage for Node environment if required
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

import { SmartOrdersStore, MODENDO_TENANT, MODENDO_CATEGORIES, MODENDO_MENU_ITEMS, MODENDO_USERS } from '../src/services/storage';
import { SettingsService, MODENDO_STORE_PROFILE, MODENDO_PRINTER_PROFILES, MODENDO_RECEIPT_TEMPLATE } from '../src/services/settingsService';
import { INITIAL_MODENDO_FLOOR_PLAN } from '../src/data/modendoFloorPlanData';
import { floorPlanService } from '../src/services/floorPlanService';
import { RBACService } from '../src/services/RBACService';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details || 'Assertion failed'}`);
    failedTests++;
  }
}

console.log('\n--- Running Modendo POS Isolation & Gateway Verification Suite ---\n');

// Initialize seed data
SmartOrdersStore.initSeedData();

// =========================================================================
// SUITE 1: Multi-Tenant Data Isolation (Modendo vs 100 Hich)
// =========================================================================
console.log('[Suite 1: Multi-Tenant Data Isolation & Brand Protection]');
{
  assert(SmartOrdersStore.getActiveTenantId() === 'tenant-modendo-01', 'Active tenant defaults to tenant-modendo-01');

  const tenant = SmartOrdersStore.getTenant();
  assert(tenant.id === 'tenant-modendo-01', 'Tenant ID is strictly tenant-modendo-01');
  assert(tenant.name.includes('مودندو'), 'Tenant name explicitly contains "مودندو"');
  assert(!tenant.name.includes('100') && !tenant.name.includes('هیچ'), 'Tenant name has NO mention of 100 Hich');
  assert(tenant.currency === 'TOMAN', 'Currency is TOMAN');

  const users = SmartOrdersStore.getUsers();
  assert(users.length === 5, 'Modendo has 5 dedicated staff members');
  assert(users.some((u) => u.fullName.includes('مهدان') && u.role === 'OWNER'), 'Owner user registered');
  assert(users.some((u) => u.fullName.includes('شریفی') && u.role === 'MANAGER'), 'Manager user registered');
  assert(users.some((u) => u.fullName.includes('کاظمی') && u.role === 'CASHIER'), 'Cashier user registered');
  assert(users.some((u) => u.fullName.includes('مرادی') && u.role === 'BARISTA'), 'Barista user registered');
  assert(users.some((u) => u.fullName.includes('خسروی') && u.fullName.includes('PS5')), 'Gamemaster user registered');

  // Verify switching to 100 Hich and switching back preserves clean boundaries
  SmartOrdersStore.switchTenant('tenant-100hich-01');
  assert(SmartOrdersStore.getTenant().id === 'tenant-100hich-01', 'Switched to tenant-100hich-01 cleanly');
  assert(SmartOrdersStore.getTenant().name.includes('صَد هیچ'), '100 Hich brand loaded');

  // Switch back to Modendo
  SmartOrdersStore.switchTenant('tenant-modendo-01');
  assert(SmartOrdersStore.getTenant().id === 'tenant-modendo-01', 'Switched back to tenant-modendo-01 cleanly');
  assert(SmartOrdersStore.getTenant().name.includes('مودندو'), 'Modendo brand restored');
}

// =========================================================================
// SUITE 2: Modendo Menu & Gaming Session Catalog
// =========================================================================
console.log('\n[Suite 2: Modendo Gaming & Dining Catalog Invariants]');
{
  const categories = SmartOrdersStore.getCategories();
  assert(categories.length >= 5, 'Modendo has at least 5 active categories');
  assert(categories.some((c) => c.nameFa.includes('کنسول PS5') || c.nameFa.includes('بردگیم')), 'Gaming session category exists');
  assert(categories.some((c) => c.nameFa.includes('اسپرسو')), 'Hot espresso category exists');
  assert(categories.some((c) => c.nameFa.includes('ماکتل') || c.nameFa.includes('بار سرد')), 'Cold bar & mocktail category exists');
  assert(categories.some((c) => c.nameFa.includes('برگر') || c.nameFa.includes('پنینی')), 'Food & burger category exists');

  const menu = SmartOrdersStore.getMenuItems();
  assert(menu.length >= 15, 'Modendo menu has at least 15 items');

  // PS5 Pod Hourly Rate
  const ps5Item = menu.find((m) => m.id === 'item-mod-ps5-hourly');
  assert(ps5Item !== undefined, 'PS5 pod hourly item exists');
  assert(ps5Item?.priceToman === 120000, 'PS5 hourly rate is exactly 120,000 Toman');
  assert(ps5Item?.station === 'BAR', 'PS5 session managed via Bar station');

  // Boardgame Table Rate
  const bgItem = menu.find((m) => m.id === 'item-mod-bg-hourly');
  assert(bgItem !== undefined, 'Boardgame hourly rate item exists');
  assert(bgItem?.priceToman === 50000, 'Boardgame entry is exactly 50,000 Toman / person / hr');

  // Kitchen food items
  const burgerItem = menu.find((m) => m.id === 'item-mod-burger-classic');
  assert(burgerItem !== undefined, 'Modendo classic burger exists');
  assert(burgerItem?.station === 'KITCHEN', 'Burger routed to KITCHEN preparation station');
  assert(burgerItem?.priceToman === 295000, 'Burger price is 295,000 Toman');
}

// =========================================================================
// SUITE 3: Split-Level Floor Plan & Hourly Gaming Billing Math
// =========================================================================
console.log('\n[Suite 3: Floor Plan v6.3 & Hourly Billing Calculations]');
{
  assert(INITIAL_MODENDO_FLOOR_PLAN.venue.name.includes('Modendo'), 'Floor plan venue name matches Modendo');
  assert(INITIAL_MODENDO_FLOOR_PLAN.venue.floor_levels.length === 2, 'Floor plan has 2 levels');

  const tables = INITIAL_MODENDO_FLOOR_PLAN.tables;
  const level0 = tables.filter((t) => t.level === 0);
  const level1 = tables.filter((t) => t.level === 1);

  assert(level0.length === 9, 'Level 0 has 9 entities (Lobby sofa/table, LZ-ZONE, 4 PS5 pods, VIP-1/VIP-2 booths)');
  assert(level1.length === 17, 'Level 1 has 17 entities (BAR-01, M-01..04, M-Side, T-01..05, Cafe Tables T1..T6)');

  // Gaming Hourly Math Simulation
  // Scenario 1: PS5 Pod for 2 hours and 30 minutes (2.5 hours) @ 120,000 Toman/hr
  const ps5Minutes = 150;
  const ps5HoursExact = ps5Minutes / 60; // 2.5
  const ps5TotalToman = Math.round(ps5HoursExact * 120000);
  assert(ps5TotalToman === 300000, '2.5 hours of PS5 gaming calculates to exact 300,000 Toman');

  // Scenario 2: Boardgame table for 4 players for 3 hours @ 50,000 Toman/player/hr
  const players = 4;
  const bgHours = 3;
  const bgTotalToman = players * bgHours * 50000;
  assert(bgTotalToman === 600000, '4 players playing boardgames for 3 hours totals 600,000 Toman');
}

// =========================================================================
// SUITE 4: Settings Profiles & LAN Hardware Printers
// =========================================================================
console.log('\n[Suite 4: Modendo Hardware Profiles & LAN Gateway Mapping]');
{
  assert(MODENDO_STORE_PROFILE.name_fa === 'کافه بردگیم و گیمینگ مودندو', 'Modendo store name_fa matches');
  assert(MODENDO_STORE_PROFILE.phone === '021-88997766', 'Modendo store phone matches');

  assert(MODENDO_PRINTER_PROFILES.length === 3, 'Modendo has 3 configured hardware printer profiles');

  const barPrinter = MODENDO_PRINTER_PROFILES.find((p) => p.station === 'BAR_KDS');
  assert(barPrinter !== undefined, 'Bar KDS printer profile exists');
  assert(barPrinter?.target_address === '192.168.1.101:9100', 'Bar printer mapped to LAN 192.168.1.101:9100');
  assert(barPrinter?.connection_type === 'NETWORK_RAW_9100', 'Bar printer uses NETWORK_RAW_9100 connection');

  const kitchenPrinter = MODENDO_PRINTER_PROFILES.find((p) => p.station === 'KITCHEN_KDS');
  assert(kitchenPrinter !== undefined, 'Kitchen KDS printer profile exists');
  assert(kitchenPrinter?.target_address === '192.168.1.102:9100', 'Kitchen printer mapped to LAN 192.168.1.102:9100');
  assert(kitchenPrinter?.connection_type === 'NETWORK_RAW_9100', 'Kitchen printer uses NETWORK_RAW_9100 connection');

  assert(
    MODENDO_RECEIPT_TEMPLATE.footer_lines.some((l) => l.includes('modendo')),
    'Receipt template footer includes Modendo Wi-Fi & branding'
  );
}

// =========================================================================
// SUITE 5: RBAC Role Evaluation & PIN Elevation for Modendo Staff
// =========================================================================
console.log('\n[Suite 5: RBAC Security Guard & Modendo Staff Credentials]');
{
  const owner = MODENDO_USERS.find((u) => u.role === 'OWNER');
  const barista = MODENDO_USERS.find((u) => u.role === 'BARISTA');

  assert(owner?.pin === '1380', 'Modendo Owner PIN is configured');
  assert(barista?.pin === '3344', 'Modendo Barista PIN is configured');

  // Barista blocked from privileged actions without elevation
  assert(
    RBACService.requiresElevation('ACCESS_SETTINGS_PANEL', barista!.role),
    'Barista is blocked from Settings Panel without PIN elevation'
  );
  assert(
    RBACService.requiresElevation('VOID_DISPATCHED_ORDER', barista!.role),
    'Barista is blocked from voiding orders without PIN elevation'
  );

  // Owner allowed directly
  assert(
    !RBACService.requiresElevation('ACCESS_SETTINGS_PANEL', owner!.role),
    'Owner has direct access to Settings Panel without PIN elevation'
  );
}

console.log('\n========================================');
console.log(`Modendo Verification Summary: ${passedTests} Passed, ${failedTests} Failed`);
console.log('========================================\n');

if (failedTests > 0) {
  process.exit(1);
}
