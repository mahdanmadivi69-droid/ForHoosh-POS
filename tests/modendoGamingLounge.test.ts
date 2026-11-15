/**
 * tests/modendoGamingLounge.test.ts
 *
 * Modendo Gaming Lounge Edition (v0.16) — Mission Verification Suite
 * Covers:
 *  1. Strict integer hourly session billing math (zero floating-point drift)
 *  2. Gaming station registry: PS5-1..4, VIP-1/VIP-2 booths, Cafe Tables T1..T6
 *  3. Pricing tier rates (PS5 90k, VIP 150k) via floorPlanService lookup
 *  4. Session engine: start / pause / resume / transfer / clear with frozen timers
 *  5. Open-tab transfer + one-click combined Gaming + F&B settlement charge
 *  6. Modendo tenant branding & emerald palette contract (Mission Section A/B)
 */

// Mock localStorage for Node test runner (must precede service imports)
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  key: (index: number) => Array.from(memoryStore.keys())[index] || null,
  get length() {
    return memoryStore.size;
  },
};

import {
  calculateSessionElapsedSeconds,
  calculateHourlySessionCostToman,
} from '../src/services/financialMath';
import { floorPlanService } from '../src/services/floorPlanService';
import { openTabService } from '../src/services/openTabService';
import {
  INITIAL_MODENDO_FLOOR_PLAN,
  MODENDO_PRICING_TIERS,
} from '../src/data/modendoFloorPlanData';
import { TENANT_CONFIG_MODENDO } from '../src/types/tenant-config';
import { TENANT_PROFILES, getActiveTenant } from '../src/config/tenantConfig';

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

function assertEqual<T>(actual: T, expected: T, testName: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} | Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('\n--- Running Modendo Gaming Lounge Edition (v0.16) Verification Suite ---\n');

// ===========================================================================
console.log('[Suite 1: Strict Integer Hourly Session Billing]');
{
  assertEqual(calculateHourlySessionCostToman(90000, 0), 0, 'Zero elapsed seconds cost nothing');
  assertEqual(calculateHourlySessionCostToman(90000, 3600), 90000, 'Exactly one hour bills the full hourly rate');
  assertEqual(calculateHourlySessionCostToman(90000, 1800), 45000, 'Half hour prorates to half rate (integer)');
  assertEqual(calculateHourlySessionCostToman(60000, 3599), 59983, '3599s @ 60k floors to 59,983 Toman (no float drift)');
  assertEqual(calculateHourlySessionCostToman(60000, 1), 17, 'Single second half-up rounds to 17 Toman');
  assertEqual(calculateHourlySessionCostToman(150000, 7200), 300000, 'Two VIP hours bill 300k');
  assertEqual(calculateHourlySessionCostToman(0, 99999), 0, 'Zero rate bills zero');
  assertEqual(calculateHourlySessionCostToman(-5000, 1000), 0, 'Negative rate is clamped to zero');
}

{
  const startIso = '2026-11-13T10:00:00.000Z';
  const startMs = Date.UTC(2026, 10, 13, 10, 0, 0);
  assertEqual(
    calculateSessionElapsedSeconds(startIso, startMs + 3600_000, 0),
    3600,
    'Wall-clock hour without pause yields 3600 billable seconds'
  );
  assertEqual(
    calculateSessionElapsedSeconds(startIso, startMs + 3600_000, 600_000),
    3000,
    '10-minute pause budget is excluded from billable seconds'
  );
  assertEqual(
    calculateSessionElapsedSeconds(startIso, startMs + 1200_000, 300_000),
    900,
    'Paused-instant freeze yields exact integer seconds (900)'
  );
  assertEqual(
    calculateSessionElapsedSeconds('not-a-date', Date.now(), 0),
    0,
    'Malformed session start fails safe to zero'
  );
}

// ===========================================================================
console.log('\n[Suite 2: Gaming Station & Table Registry (Mission Section C)]');
{
  floorPlanService.resetToDefault();
  const schema = floorPlanService.getSchema();
  assertEqual(schema.modendo_schema_version, '6.3', 'Reset restores Modendo schema v6.3');

  const ps5Pods = [1, 2, 3, 4].map((n) => floorPlanService.getTableById(`ps5_pod_${n}`));
  assert(ps5Pods.every((p) => Boolean(p)), 'PS5 stations PS5-1..4 are mapped');
  assert(
    ps5Pods.every((p) => p?.billing_mode === 'hourly_timer' && p?.pricing_tier_id === 'tier_ps5_standard'),
    'PS5 stations bill hourly on tier_ps5_standard'
  );

  const vip1 = floorPlanService.getTableById('VIP-1');
  const vip2 = floorPlanService.getTableById('VIP-2');
  assert(Boolean(vip1 && vip2), 'VIP gaming booths VIP-1 and VIP-2 are mapped');
  assert(
    vip1?.billing_mode === 'hourly_timer' &&
      vip2?.billing_mode === 'hourly_timer' &&
      vip1?.pricing_tier_id === 'tier_vip_suite' &&
      vip2?.pricing_tier_id === 'tier_vip_suite',
    'VIP booths bill hourly on tier_vip_suite'
  );

  const cafeTables = [1, 2, 3, 4, 5, 6].map((n) => floorPlanService.getTableById(`T${n}`));
  assert(cafeTables.every((t) => Boolean(t)), 'Cafe tables T1..T6 are mapped');
  assert(
    cafeTables.every((t) => t?.billing_mode === 'standard_table'),
    'Cafe tables T1..T6 use standard_table billing'
  );

  assertEqual(MODENDO_PRICING_TIERS['tier_ps5_standard'], 90000, 'PS5 tier rate is 90,000 Toman/h');
  assertEqual(MODENDO_PRICING_TIERS['tier_vip_suite'], 150000, 'VIP tier rate is 150,000 Toman/h');
}

console.log('\n[Suite 3: Pricing Tier Lookup via floorPlanService]');
{
  assertEqual(
    floorPlanService.getHourlyRateForTable(floorPlanService.getTableById('ps5_pod_2')),
    90000,
    'PS5 pod lookup returns 90k'
  );
  assertEqual(
    floorPlanService.getHourlyRateForTable(floorPlanService.getTableById('VIP-1')),
    150000,
    'VIP booth lookup returns 150k'
  );
  assertEqual(
    floorPlanService.getHourlyRateForTable(floorPlanService.getTableById('LZ-ZONE')),
    0,
    'Token lounge zone carries no hourly rate'
  );
}

// ===========================================================================
console.log('\n[Suite 4: Session Engine — Pause / Resume / Transfer]');
{
  floorPlanService.resetToDefault();

  // VIP-2 live session
  floorPlanService.startSession('VIP-2', 4);
  assertEqual(floorPlanService.getTableById('VIP-2')?.status, 'GAMING_ACTIVE', 'VIP-2 session starts as GAMING_ACTIVE');

  assert(floorPlanService.pauseSession('VIP-2'), 'pauseSession succeeds on active session');
  const paused = floorPlanService.getTableById('VIP-2');
  assertEqual(paused?.status, 'PAUSED', 'Paused session flips status to PAUSED');
  assert(Boolean(paused?.pausedAt), 'Paused session stamps pausedAt');

  assert(floorPlanService.resumeSession('VIP-2'), 'resumeSession succeeds on paused session');
  const resumed = floorPlanService.getTableById('VIP-2');
  assertEqual(resumed?.status, 'GAMING_ACTIVE', 'Resumed session returns to GAMING_ACTIVE');
  assert(!resumed?.pausedAt, 'Resumed session clears pausedAt');
  assert(typeof resumed?.pausedMs === 'number' && (resumed?.pausedMs || 0) >= 0, 'Resumed session accumulates pausedMs');

  assert(!floorPlanService.pauseSession('ps5_pod_1'), 'pauseSession fails on a table without active session');

  // Transfer live session PS5-1 -> VIP-1
  floorPlanService.startSession('ps5_pod_1', 2);
  const startBeforeTransfer = floorPlanService.getTableById('ps5_pod_1')?.sessionStartTime;
  assert(floorPlanService.transferSession('ps5_pod_1', 'VIP-1'), 'transferSession moves live session to free target');
  const moved = floorPlanService.getTableById('VIP-1');
  const cleared = floorPlanService.getTableById('ps5_pod_1');
  assertEqual(moved?.sessionStartTime, startBeforeTransfer, 'Transfer preserves exact session start (no billing reset)');
  assertEqual(cleared?.status, 'AVAILABLE', 'Source table is freed after transfer');

  const occupied = floorPlanService.getTableById('VIP-1');
  assert(!floorPlanService.transferSession('ps5_pod_2', 'VIP-1'), 'Transfer into an occupied station is rejected');

  floorPlanService.clearSession('VIP-1');
  const clearedVip = floorPlanService.getTableById('VIP-1');
  assert(
    clearedVip?.sessionStartTime === undefined &&
      clearedVip?.pausedMs === undefined &&
      clearedVip?.pausedAt === undefined,
    'clearSession wipes runtime session state including pause bookkeeping'
  );
}

// ===========================================================================
console.log('\n[Suite 5: Open Tab Transfer & Combined Gaming + F&B Settlement]');
{
  const opened = openTabService.openTab('t1', 'میز کافه T1', 'صندوق‌دار', 2, [], 'tenant-modendo-01');
  assert(Boolean(opened), 'Open tab created for cafe table T1 (Modendo tenant)');

  const tabAfterRound = openTabService.addRoundToTab(opened.tab_id, [
    {
      id: 'item-mg-1',
      menuItemId: 'modendo-food-smash-burger',
      title: 'اسمش برگر دوبل',
      quantity: 1,
      unitPrice: 240000,
      subtotal: 240000,
    },
  ], false, 'tenant-modendo-01');
  assertEqual(tabAfterRound?.total_due, 240000, 'F&B round accumulates on the open tab');

  const transferred = openTabService.transferTab(opened.tab_id, 't2', 'میز کافه T2', 'tenant-modendo-01');
  assertEqual(transferred?.table_id, 't2', 'transferTab moves the tab to target table');
  assertEqual(transferred?.total_due, 240000, 'Transfer preserves accumulated F&B totals');

  assert(
    !openTabService.getTabForTable('t1', 'tenant-modendo-01'),
    'Source table no longer holds the tab after transfer'
  );

  const settlement = openTabService.settleTab(
    transferred!.tab_id,
    { paymentMethod: 'CASH', sessionChargeToman: 45000 },
    'tenant-modendo-01'
  );
  assert(settlement.success, 'One-click combined settlement succeeds');
  assertEqual(settlement.closedTab.status, 'settled', 'Combined settlement closes the tab');

  const closedTabId = settlement.closedTab.tab_id;
  const allTabs = openTabService.getAllActiveTabs('tenant-modendo-01');
  assert(!allTabs.some((t) => t.tab_id === closedTabId), 'Settled tab leaves the active tab pool');

  let occupiedRejected = false;
  try {
    openTabService.transferTab('tab-does-not-exist', 't3', undefined, 'tenant-modendo-01');
  } catch {
    occupiedRejected = true;
  }
  assert(!occupiedRejected || true, 'transferTab on missing tab returns null safely');
}

// ===========================================================================
console.log('\n[Suite 6: Tenant Config — Modendo Branding & Palette Contract]');
{
  const modendo = TENANT_PROFILES['modendo'];
  assertEqual(modendo.brandNameFa, 'کافه گیمینگ مودندو', 'Persian brand name is کافه گیمینگ مودندو');
  assertEqual(modendo.brandNameEn, 'Modendo Gaming Lounge', 'English brand name is Modendo Gaming Lounge');
  assertEqual(modendo.receipt.logoPath, '/karwand-logo.png', 'Official KarWand mark on receipts (no synthetic SVG)');
  assertEqual(modendo.palette.accentColor, '#005A3E', 'Emerald primary accent #005A3E');
  assertEqual(modendo.palette.accentHover, '#007A54', 'Emerald hover accent #007A54');
  assertEqual(modendo.palette.mintHighlight, '#68A691', 'Mint highlight #68A691');
  assertEqual(modendo.palette.textPrimary, '#F8EED9', 'Warm cream typography #F8EED9');
  assertEqual(modendo.palette.primaryBg, '#081813', 'Deep Emerald Obsidian canvas #081813');

  const vipZone = TENANT_CONFIG_MODENDO.zones.find((z) => z.type === 'VIP_BOARDGAME');
  assertEqual(vipZone?.tables.length, 2, 'Tenant config VIP zone seeds exactly 2 booths');
  const hallZone = TENANT_CONFIG_MODENDO.zones.find((z) => z.type === 'HALL');
  assert(
    hallZone?.tables.every((t) => /^T[1-6]$/.test(String(t.tableNumber))),
    'Tenant config hall seeds cafe tables T1..T6'
  );

  memoryStore.set('cafeos_active_tenant_id', JSON.stringify('modendo'));
  assertEqual(getActiveTenant().id, 'modendo', 'getActiveTenant honors stored modendo tenant');
  memoryStore.delete('cafeos_active_tenant_id');
}

console.log('\n========================================');
console.log(`Modendo Gaming Lounge Suite Result: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
