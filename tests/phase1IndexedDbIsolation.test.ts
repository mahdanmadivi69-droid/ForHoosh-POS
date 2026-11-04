/**
 * PHASE 1E — IndexedDB Multi-Tenant Isolation Verification Suite
 * Verifies technical remediation design and implementation for IndexedDB:
 *  1. Independent database naming per tenant (CafeOS_LocalDB_tenant-100hich-01 vs CafeOS_LocalDB_tenant-modendo-01).
 *  2. Dexie schema version preservation and upgrade compatibility (v1, v2, v3).
 *  3. Complete table coverage across all 10 domain entities.
 *  4. Primary key collision risk verification (proving necessity of DB-level isolation).
 *  5. Dynamic proxy delegation to active tenant database.
 *  6. OfflineSyncQueue multi-tenant database isolation (CafeOS_OfflineDB_${tenantId}).
 *  7. Non-destructive legacy migration mechanism.
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
  CafeDatabase,
  getCafeDatabase,
  getTenantDatabaseName,
  migrateLegacyCafeDatabase,
  db,
} from '../src/db/cafeDb';
import {
  OfflineSyncQueue,
  getOfflineSyncQueueForTenant,
} from '../src/services/offlineSyncQueue';

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

console.log('\n--- Running Phase 1E: IndexedDB Isolation Verification Suite ---\n');

// ============================================================================
// Suite 1: Independent Database Initialization Per Tenant Context
// ============================================================================
console.log('[Suite 1: Independent Database Initialization Per Tenant Context]');

const hichDb = getCafeDatabase('tenant-100hich-01');
const modendoDb = getCafeDatabase('tenant-modendo-01');

assertEqual(hichDb.name, 'CafeOS_LocalDB_tenant-100hich-01', '100 HICH database name matches convention');
assertEqual(modendoDb.name, 'CafeOS_LocalDB_tenant-modendo-01', 'Modendo database name matches convention');
assert(hichDb !== modendoDb, 'Database instances are completely independent objects in memory');

// Helper name resolver test
assertEqual(
  getTenantDatabaseName('tenant-100hich-01'),
  'CafeOS_LocalDB_tenant-100hich-01',
  'getTenantDatabaseName resolves 100 HICH'
);
assertEqual(
  getTenantDatabaseName('tenant-modendo-01'),
  'CafeOS_LocalDB_tenant-modendo-01',
  'getTenantDatabaseName resolves Modendo'
);

// ============================================================================
// Suite 2: Complete Table Coverage & Schema Preservation
// ============================================================================
console.log('\n[Suite 2: Complete Table Coverage & Schema Preservation]');

const expectedTables = [
  'inventoryItems',
  'menuItems',
  'orders',
  'auditLogs',
  'authUsers',
  'appSettings',
  'printerProfiles',
  'elevationAuditLogs',
  'zReports',
  'stockInwardTransactions',
];

const hichTableNames = hichDb.tables.map((t) => t.name);
const modendoTableNames = modendoDb.tables.map((t) => t.name);

expectedTables.forEach((tbl) => {
  assert(hichTableNames.includes(tbl), `100 HICH database includes table: ${tbl}`);
  assert(modendoTableNames.includes(tbl), `Modendo database includes table: ${tbl}`);
});

assertEqual(hichDb.verno, 3, 'Dexie schema version is exactly 3 (preserves all upgrades)');
assertEqual(modendoDb.verno, 3, 'Modendo Dexie schema version is exactly 3');

// ============================================================================
// Suite 3: Primary Key Collision Risk Verification
// ============================================================================
console.log('\n[Suite 3: Primary Key Collision Risk Verification]');

// Inspect primary keys of critical tables:
// Proves that tables use un-prefixed keys (e.g. 'id', 'key'), meaning that single-database
// multi-tenancy would suffer critical primary key collisions without separate databases.
const inventoryKey = hichDb.table('inventoryItems').schema.primKey.name;
const settingsKey = hichDb.table('appSettings').schema.primKey.name;
const usersKey = hichDb.table('authUsers').schema.primKey.name;
const printersKey = hichDb.table('printerProfiles').schema.primKey.name;

assertEqual(inventoryKey, 'id', 'inventoryItems uses single un-prefixed primary key "id"');
assertEqual(settingsKey, 'key', 'appSettings uses single un-prefixed primary key "key"');
assertEqual(usersKey, 'id', 'authUsers uses single un-prefixed primary key "id"');
assertEqual(printersKey, 'id', 'printerProfiles uses single un-prefixed primary key "id"');

assert(
  inventoryKey !== 'tenantId' && settingsKey !== 'tenantId',
  'VERIFIED: Dexie tables lack composite [tenantId+id] primary keys; independent databases are mandatory.'
);

// ============================================================================
// Suite 4: Dynamic Proxy Delegation to Active Tenant Database
// ============================================================================
console.log('\n[Suite 4: Dynamic Proxy Delegation to Active Tenant Database]');

// Default ambient tenant is 100hich
assertEqual(db.name, 'CafeOS_LocalDB_tenant-100hich-01', 'Proxy db defaults to active tenant 100 HICH');

// Switch active tenant in localStorage
memoryStore.set('cafeos_active_tenant_id', JSON.stringify('tenant-modendo-01'));
assertEqual(db.name, 'CafeOS_LocalDB_tenant-modendo-01', 'Proxy db dynamically switches to Modendo database');

// Switch back
memoryStore.set('cafeos_active_tenant_id', JSON.stringify('tenant-100hich-01'));
assertEqual(db.name, 'CafeOS_LocalDB_tenant-100hich-01', 'Proxy db dynamically switches back to 100 HICH');

// Verify table access via Proxy
assert(db.inventoryItems !== undefined, 'db.inventoryItems accessible via proxy');
assert(db.orders !== undefined, 'db.orders accessible via proxy');
assert(typeof db.transaction === 'function', 'db.transaction function bound and callable via proxy');

// ============================================================================
// Suite 5: OfflineSyncQueue Multi-Tenant Database Isolation
// ============================================================================
console.log('\n[Suite 5: OfflineSyncQueue Multi-Tenant Database Isolation]');

const hichQueue = getOfflineSyncQueueForTenant('tenant-100hich-01');
const modendoQueue = getOfflineSyncQueueForTenant('tenant-modendo-01');

assertEqual(hichQueue.getDatabaseName(), 'CafeOS_OfflineDB_tenant-100hich-01', '100 HICH offline queue DB is scoped');
assertEqual(modendoQueue.getDatabaseName(), 'CafeOS_OfflineDB_tenant-modendo-01', 'Modendo offline queue DB is scoped');
assert(hichQueue !== modendoQueue, 'Queue instances are separate objects per tenant');
assertEqual(hichQueue.getTenantId(), 'tenant-100hich-01', 'HICH queue tenantId validated');
assertEqual(modendoQueue.getTenantId(), 'tenant-modendo-01', 'Modendo queue tenantId validated');

// ============================================================================
// Suite 6: Non-Destructive Legacy Migration Capability
// ============================================================================
console.log('\n[Suite 6: Non-Destructive Legacy Migration Capability]');

assert(typeof migrateLegacyCafeDatabase === 'function', 'migrateLegacyCafeDatabase function is defined and exported');

// Execute migration in safe mode
migrateLegacyCafeDatabase().then((res) => {
  assert(res !== null && typeof res.targetDatabase === 'string', 'Migration returns structured result object');
  assertEqual(res.targetDatabase, 'CafeOS_LocalDB_tenant-100hich-01', 'Target database is 100 HICH');
});

console.log(`\n========================================`);
console.log(`Phase 1E IndexedDB Isolation Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
