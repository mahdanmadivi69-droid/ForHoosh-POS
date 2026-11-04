/**
 * PHASE 1C — Open Table & Floor Session Isolation Verification Suite
 * Verifies complete data isolation for Open Tabs & Table Reservations:
 *  1. Independent table sessions (100 HICH vs Modendo).
 *  2. Independent table reservations.
 *  3. Multiple concurrent open tabs.
 *  4. Session restoration from tenant-scoped storage.
 *  5. Correct Barista Dispatch ownership (No hardcoded tenant ID).
 *  6. Cross-tenant access rejection.
 *  7. Legacy migration of open table tabs.
 *  8. Idempotency & Rollback strategy.
 */

// Mock localStorage for Node test runner
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
  openTabService,
  OPEN_TAB_STORAGE_KEYS,
  DEFAULT_TABLES,
} from '../src/services/openTabService';
import { baristaDispatcher } from '../src/services/baristaDispatcher';
import { TabCartItem } from '../src/types/inventory-tab';

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

console.log('\n--- Running Phase 1C: Open Table Isolation Verification Suite ---\n');

// ============================================================================
// Suite 1: Independent Table Sessions
// ============================================================================
console.log('[Suite 1: Independent Table Sessions]');

// Open Tab in 100 HICH on Table 1 (t1)
const hichItems: TabCartItem[] = [
  {
    id: 'it-esp-1',
    menuItemId: 'm-esp-double',
    title: 'اسپرسو دبل',
    quantity: 1,
    unitPrice: 65000,
    subtotal: 65000,
  },
];
const hichTab1 = openTabService.openTab(
  't1',
  'میز ۱',
  'سارا رضایی',
  2,
  hichItems,
  'tenant-100hich-01'
);

assert(hichTab1 !== undefined && hichTab1.tab_id !== undefined, '100 HICH openTab succeeded');
assertEqual(hichTab1.tenantId, 'tenant-100hich-01', 'Tab tenantId is tenant-100hich-01');

// Verify Modendo DOES NOT see this tab
const modendoTabOnT1 = openTabService.getTabForTable('t1', 'tenant-modendo-01');
assert(modendoTabOnT1 === undefined, 'Modendo cannot see 100 HICH tab on Table 1');

const modendoActiveTabs = openTabService.getAllActiveTabs('tenant-modendo-01');
assertEqual(modendoActiveTabs.length, 0, 'Modendo active tabs count is 0');

// Now open a tab in Modendo on the SAME table identifier ('t1')
const modendoItems: TabCartItem[] = [
  {
    id: 'it-mod-bg',
    menuItemId: 'item-mod-bg-hourly',
    title: 'ورودی بردگیم',
    quantity: 3,
    unitPrice: 50000,
    subtotal: 150000,
  },
];
const modendoTab1 = openTabService.openTab(
  't1',
  'میز ۱ (گیم)',
  'آرین گیلانی',
  3,
  modendoItems,
  'tenant-modendo-01'
);

assert(modendoTab1 !== undefined, 'Modendo openTab on Table 1 succeeded independently');
assertEqual(modendoTab1.tenantId, 'tenant-modendo-01', 'Modendo tab tenantId is tenant-modendo-01');
assert(modendoTab1.tab_id !== hichTab1.tab_id, 'Tab IDs across tenants are completely independent');

// Verify 100 HICH Table 1 still retains its original specialty coffee tab
const hichTabCheck = openTabService.getTabForTable('t1', 'tenant-100hich-01');
assertEqual(hichTabCheck?.tab_id, hichTab1.tab_id, '100 HICH Table 1 tab remains unchanged');
assertEqual(hichTabCheck?.server_name, 'سارا رضایی', '100 HICH server name preserved');
assertEqual(hichTabCheck?.subtotal, 65000, '100 HICH subtotal preserved');

// Verify Modendo Table 1 retains its boardgame tab
const modendoTabCheck = openTabService.getTabForTable('t1', 'tenant-modendo-01');
assertEqual(modendoTabCheck?.tab_id, modendoTab1.tab_id, 'Modendo Table 1 tab retrieved accurately');
assertEqual(modendoTabCheck?.server_name, 'آرین گیلانی', 'Modendo server name preserved');
assertEqual(modendoTabCheck?.subtotal, 150000, 'Modendo subtotal preserved');

// ============================================================================
// Suite 2: Independent Table Reservations
// ============================================================================
console.log('\n[Suite 2: Independent Table Reservations]');

// Reserve Table 3 (t3) in Modendo
const reserveModendo = openTabService.toggleTableReservation('t3', 'tenant-modendo-01');
assert(reserveModendo, 'Table 3 successfully reserved in Modendo');

// Check lifecycle state in Modendo vs 100 HICH
const stateModendo = openTabService.getTableLifecycleState('t3', 'tenant-modendo-01');
assertEqual(stateModendo, 'reserved', 'Modendo Table 3 lifecycle state is "reserved"');

const stateHich = openTabService.getTableLifecycleState('t3', 'tenant-100hich-01');
assertEqual(stateHich, 'idle_empty', '100 HICH Table 3 lifecycle state remains "idle_empty" (NOT reserved)');

// Can open table in 100 HICH on Table 3 without conflict
const hichTab3 = openTabService.openTab('t3', 'میز ۳', 'نیما باریستا', 2, [], 'tenant-100hich-01');
assert(hichTab3 !== undefined, '100 HICH successfully opens Table 3 while Modendo Table 3 is reserved');

// ============================================================================
// Suite 3: Multiple Open Tabs Across Tenants
// ============================================================================
console.log('\n[Suite 3: Multiple Open Tabs Across Tenants]');

openTabService.openTab('t4', 'میز ۴', 'سارا رضایی', 4, [], 'tenant-100hich-01');
openTabService.openTab('bar', 'کانتر بار', 'سارا رضایی', 1, [], 'tenant-100hich-01');

openTabService.openTab('t2', 'میز ۲', 'مهسا صندوق‌دار', 2, [], 'tenant-modendo-01');

const totalHichTabs = openTabService.getAllActiveTabs('tenant-100hich-01');
const totalModendoTabs = openTabService.getAllActiveTabs('tenant-modendo-01');

assertEqual(totalHichTabs.length, 4, '100 HICH has exactly 4 active open tabs (demo t2, t1, t3, t4)');
assertEqual(totalModendoTabs.length, 2, 'Modendo has exactly 2 active open tabs (t1, t2)');

// ============================================================================
// Suite 4: Session Restoration from Tenant-Scoped Storage
// ============================================================================
console.log('\n[Suite 4: Session Restoration from Tenant-Scoped Storage]');

const rawHichStorage = memoryStore.get(OPEN_TAB_STORAGE_KEYS.TABLE_TABS('tenant-100hich-01'));
assert(rawHichStorage !== null, 'Scoped storage key cafeos_table_tabs_tenant-100hich-01_v2 exists');

const rawModendoStorage = memoryStore.get(OPEN_TAB_STORAGE_KEYS.TABLE_TABS('tenant-modendo-01'));
assert(rawModendoStorage !== null, 'Scoped storage key cafeos_table_tabs_tenant-modendo-01_v2 exists');

const parsedHichTabs = JSON.parse(rawHichStorage!);
const parsedModendoTabs = JSON.parse(rawModendoStorage!);

assert(parsedHichTabs.every((t: any) => t.tenantId === 'tenant-100hich-01'), 'All persisted 100 HICH tabs have tenantId = tenant-100hich-01');
assert(parsedModendoTabs.every((t: any) => t.tenantId === 'tenant-modendo-01'), 'All persisted Modendo tabs have tenantId = tenant-modendo-01');

// ============================================================================
// Suite 5: Barista Dispatch Ownership (Line 339 Remediation)
// ============================================================================
console.log('\n[Suite 5: Barista Dispatch Ownership (No Hardcoded Tenant)]');

let lastDispatchedTicket: any = null;
const origDispatch = baristaDispatcher.dispatchPaidOrder;
baristaDispatcher.dispatchPaidOrder = async (order: any) => {
  lastDispatchedTicket = order;
  return origDispatch.call(baristaDispatcher, order);
};

// Add round to Modendo tab
const newModendoRoundItems: TabCartItem[] = [
  {
    id: 'it-burger-round2',
    menuItemId: 'mod-burger-classic',
    title: 'برگر کلاسیک مودندو',
    quantity: 1,
    unitPrice: 295000,
    subtotal: 295000,
  },
];

openTabService.addRoundToTab(modendoTab1.tab_id, newModendoRoundItems, true, 'tenant-modendo-01');

assert(lastDispatchedTicket !== null, 'Barista dispatcher was called for round addition');
assertEqual(lastDispatchedTicket.tenantId, 'tenant-modendo-01', 'CRITICAL: Dispatched order has tenantId = tenant-modendo-01 (NOT hardcoded 100hich)');
assertEqual(lastDispatchedTicket.customerName, 'آرین گیلانی', 'Dispatched customer name matches Modendo server');

// Restore original dispatcher
baristaDispatcher.dispatchPaidOrder = origDispatch;

// ============================================================================
// Suite 6: Cross-Tenant Access Rejection
// ============================================================================
console.log('\n[Suite 6: Cross-Tenant Access Rejection]');

// 1. Modendo attempts to add a round to 100 HICH's tab
const rejectedAdd = openTabService.addRoundToTab(
  hichTab1.tab_id,
  [{ id: 'malicious', menuItemId: 'hack', title: 'Hack', quantity: 1, unitPrice: 0, subtotal: 0 }],
  true,
  'tenant-modendo-01' // Requesting with Modendo tenant context
);
assert(rejectedAdd === null, 'Cross-tenant addRoundToTab REJECTED (returns null)');

// 2. Modendo attempts to mark delivered a 100 HICH round
const rejectedDelivered = openTabService.markRoundDelivered(hichTab1.tab_id, 1, 'tenant-modendo-01');
assert(rejectedDelivered === null, 'Cross-tenant markRoundDelivered REJECTED (returns null)');

// 3. Modendo attempts to request bill on 100 HICH tab
const rejectedBill = openTabService.requestBill(hichTab1.tab_id, 'tenant-modendo-01');
assert(rejectedBill === null, 'Cross-tenant requestBill REJECTED (returns null)');

// 4. Modendo attempts to settle 100 HICH tab
let settleThrew = false;
try {
  openTabService.settleTab(hichTab1.tab_id, { paymentMethod: 'CASH' }, 'tenant-modendo-01');
} catch {
  settleThrew = true;
}
assert(settleThrew, 'Cross-tenant settleTab REJECTED with error');

// 5. Modendo attempts to void 100 HICH tab
const voidRejected = openTabService.voidTab(hichTab1.tab_id, 'tenant-modendo-01');
assert(!voidRejected, 'Cross-tenant voidTab REJECTED (returns false)');

// Verify 100 HICH tab is intact
const intactTab = openTabService.getTabForTable('t1', 'tenant-100hich-01');
assertEqual(intactTab?.status, 'open', '100 HICH tab remains open and unmolested');

// ============================================================================
// Suite 7: Legacy Open Tab Migration & Rollback
// ============================================================================
console.log('\n[Suite 7: Legacy Open Tab Migration & Rollback]');

memoryStore.clear();

const legacyTabs = [
  {
    tab_id: 'tab-legacy-t2',
    table_id: 't2',
    table_label: 'میز ۲',
    server_name: 'سارا رضایی',
    guest_count: 2,
    status: 'open',
    opened_at: new Date().toISOString(),
    rounds: [],
    subtotal: 170000,
    vat: 0,
    discount: 0,
    total_due: 170000,
  },
];

memoryStore.set(OPEN_TAB_STORAGE_KEYS.LEGACY_TABLE_TABS, JSON.stringify(legacyTabs));

const migResult = openTabService.migrateLegacyData();
assert(migResult.migrated, 'Legacy table migration succeeded');
assertEqual(migResult.tabCount, 1, 'Exactly 1 legacy tab migrated');
assertEqual(migResult.targetTenant, 'tenant-100hich-01', 'Migrated to verified owner: tenant-100hich-01');

// Verify backup was created
const backupTabs = memoryStore.get(OPEN_TAB_STORAGE_KEYS.LEGACY_BACKUP_TABS);
assert(backupTabs !== null, 'Legacy backup key created');

// Verify idempotency
const secondMig = openTabService.migrateLegacyData();
assert(!secondMig.migrated, 'Second migration skipped idempotently');

// Verify rollback
const rolledBack = openTabService.rollbackLegacyMigration();
assert(rolledBack, 'Rollback succeeded');
assert(memoryStore.get(OPEN_TAB_STORAGE_KEYS.LEGACY_TABLE_TABS) !== null, 'Legacy key restored');

console.log(`\n========================================`);
console.log(`Phase 1C Open Table Isolation Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
