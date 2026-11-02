/**
 * PHASE 1D — Barista KDS Isolation Verification Suite
 * Verifies complete event and ticket isolation for Barista KDS:
 *  1. 100 HICH event delivery.
 *  2. Modendo event delivery.
 *  3. Cross-tenant event rejection (broadcast channel drops foreign tenant tickets).
 *  4. Multiple browser tabs / channel simulation.
 *  5. Channel reconnection and lifecycle cleanup.
 *  6. Ticket persistence in tenant-scoped storage.
 *  7. Tenant context validation.
 *  8. Legacy migration & rollback.
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

// Mock BroadcastChannel for Node test runner
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => any) | null = null;
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: any) {
    const peers = MockBroadcastChannel.channels.get(this.name) || new Set();
    peers.forEach((peer) => {
      if (peer !== this && peer.onmessage) {
        peer.onmessage(new MessageEvent('message', { data: message }));
      }
    });
  }

  close() {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (peers) {
      peers.delete(this);
    }
  }
}
(globalThis as any).BroadcastChannel = MockBroadcastChannel;
(globalThis as any).window = globalThis;

import {
  baristaDispatcher,
  BARISTA_STORAGE_KEYS,
  BaristaOrderTicket,
  isValidTenantId,
  VALID_TENANT_IDS,
} from '../src/services/baristaDispatcher';

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

console.log('\n--- Running Phase 1D: Barista KDS Isolation Verification Suite ---\n');

// ============================================================================
// Suite 1: 100 HICH Event Delivery & Ticket Persistence
// ============================================================================
console.log('[Suite 1: 100 HICH Event Delivery & Ticket Persistence]');

let hichReceivedTickets: BaristaOrderTicket[] = [];
const unsubHich = baristaDispatcher.subscribe((tickets) => {
  hichReceivedTickets = tickets;
}, 'tenant-100hich-01');

const hichOrder = {
  id: 'ord-hich-101',
  orderNumber: 101,
  tenantId: 'tenant-100hich-01',
  orderType: 'DINE_IN',
  tableLabel: 'میز ۲',
  customerName: 'سارا رضایی',
  items: [
    {
      id: 'it-1',
      title: 'فلت وایت',
      quantity: 2,
    },
  ],
};

baristaDispatcher.dispatchOrder(hichOrder, 'tenant-100hich-01').then((ticket) => {
  assertEqual(ticket.tenantId, 'tenant-100hich-01', 'Dispatched ticket has tenantId = tenant-100hich-01');
  assertEqual(ticket.orderNumber, 101, 'Order number matches 101');
});

// Allow sync execution
const hichTickets = baristaDispatcher.getTickets('tenant-100hich-01');
assertEqual(hichTickets.length, 1, '100 HICH has exactly 1 ticket in store');
assertEqual(hichTickets[0].orderId, 'ord-hich-101', '100 HICH ticket has correct orderId');

// Check scoped storage
const storedHich = memoryStore.get(BARISTA_STORAGE_KEYS.TICKETS('tenant-100hich-01'));
assert(storedHich !== null, 'Scoped storage key cafeos_barista_tickets_tenant-100hich-01 exists');

// ============================================================================
// Suite 2: Modendo Event Delivery & Ticket Persistence
// ============================================================================
console.log('\n[Suite 2: Modendo Event Delivery & Ticket Persistence]');

let modendoReceivedTickets: BaristaOrderTicket[] = [];
const unsubModendo = baristaDispatcher.subscribe((tickets) => {
  modendoReceivedTickets = tickets;
}, 'tenant-modendo-01');

const modendoOrder = {
  id: 'ord-mod-501',
  orderNumber: 501,
  tenantId: 'tenant-modendo-01',
  orderType: 'DINE_IN',
  tableLabel: 'میز گیم ۱',
  customerName: 'آرین گیلانی',
  items: [
    {
      id: 'it-m-1',
      title: 'برگر کلاسیک مودندو',
      quantity: 1,
    },
  ],
};

baristaDispatcher.dispatchOrder(modendoOrder, 'tenant-modendo-01').then((ticket) => {
  assertEqual(ticket.tenantId, 'tenant-modendo-01', 'Dispatched ticket has tenantId = tenant-modendo-01');
  assertEqual(ticket.orderNumber, 501, 'Order number matches 501');
});

const modendoTickets = baristaDispatcher.getTickets('tenant-modendo-01');
assertEqual(modendoTickets.length, 1, 'Modendo has exactly 1 ticket in store');
assertEqual(modendoTickets[0].orderId, 'ord-mod-501', 'Modendo ticket has correct orderId');

// CRITICAL ISOLATION: 100 HICH must NOT contain Modendo ticket
const hichTicketsCheck = baristaDispatcher.getTickets('tenant-100hich-01');
assertEqual(hichTicketsCheck.length, 1, '100 HICH tickets count remains 1');
assert(!hichTicketsCheck.some((t) => t.orderId === 'ord-mod-501'), 'Modendo ticket ord-mod-501 NEVER leaked into 100 HICH');

// Modendo must NOT contain 100 HICH ticket
assert(!modendoTickets.some((t) => t.orderId === 'ord-hich-101'), '100 HICH ticket ord-hich-101 NEVER leaked into Modendo');

// ============================================================================
// Suite 3: Cross-Tenant Event Rejection on BroadcastChannel
// ============================================================================
console.log('\n[Suite 3: Cross-Tenant Event Rejection on BroadcastChannel]');

// Create an external channel simulating a cross-tenant attacker or buggy tab
const modendoChannelName = BARISTA_STORAGE_KEYS.CHANNEL_NAME('tenant-modendo-01');
const maliciousExternalChannel = new MockBroadcastChannel(modendoChannelName);

// Malicious attempt: Broadcast a 100 HICH ticket into Modendo channel
const forgedTicket: BaristaOrderTicket = {
  orderId: 'ord-forged-999',
  orderNumber: 999,
  clientGeneratedId: 'forged-client-id',
  tenantId: 'tenant-100hich-01', // Foreign tenant!
  orderType: 'DINE_IN',
  items: [],
  paidAt: new Date().toISOString(),
  prepStatus: 'PENDING',
};

maliciousExternalChannel.postMessage({
  type: 'NEW_ORDER',
  ticket: forgedTicket,
});

// Modendo ticket list must NOT contain the forged ticket
const modendoAfterForged = baristaDispatcher.getTickets('tenant-modendo-01');
assert(!modendoAfterForged.some((t) => t.orderId === 'ord-forged-999'), 'Modendo dispatcher REJECTED cross-tenant ticket on its channel');

// ============================================================================
// Suite 4: Multi-Tab Communication Within Same Tenant
// ============================================================================
console.log('\n[Suite 4: Multi-Tab Communication Within Same Tenant]');

// Legitimate peer tab in Modendo
const legitimatePeerChannel = new MockBroadcastChannel(modendoChannelName);
const validModendoTicket: BaristaOrderTicket = {
  orderId: 'ord-mod-tab2-502',
  orderNumber: 502,
  clientGeneratedId: 'valid-peer-client',
  tenantId: 'tenant-modendo-01', // Matching tenant!
  orderType: 'TAKEAWAY',
  items: [{ itemName: 'اسپرسو', quantity: 1, modifiers: [] }],
  paidAt: new Date().toISOString(),
  prepStatus: 'PENDING',
};

legitimatePeerChannel.postMessage({
  type: 'NEW_ORDER',
  ticket: validModendoTicket,
});

const modendoAfterPeer = baristaDispatcher.getTickets('tenant-modendo-01');
assert(modendoAfterPeer.some((t) => t.orderId === 'ord-mod-tab2-502'), 'Modendo dispatcher accepted legitimate peer ticket on matching channel');

// Verify 100 HICH still untouched
assertEqual(baristaDispatcher.getTickets('tenant-100hich-01').length, 1, '100 HICH remained completely isolated during peer broadcast');

// ============================================================================
// Suite 5: Status Change & Prep Lifecycle Isolation
// ============================================================================
console.log('\n[Suite 5: Status Change & Prep Lifecycle Isolation]');

baristaDispatcher.updatePrepStatus('ord-mod-501', 'IN_PREP', 'tenant-modendo-01');

const modTicketUpdated = baristaDispatcher.getTickets('tenant-modendo-01').find((t) => t.orderId === 'ord-mod-501');
assertEqual(modTicketUpdated?.prepStatus, 'IN_PREP', 'Modendo ticket status updated to IN_PREP');

// Verify 100 HICH ticket prepStatus is still PENDING
const hichTicketCheck = baristaDispatcher.getTickets('tenant-100hich-01')[0];
assertEqual(hichTicketCheck.prepStatus, 'PENDING', '100 HICH ticket status remains PENDING');

// ============================================================================
// Suite 6: Channel Lifecycle & Clean Reconnection
// ============================================================================
console.log('\n[Suite 6: Channel Lifecycle & Clean Reconnection]');

baristaDispatcher.closeChannel('tenant-modendo-01');
const reconnectedChannel = baristaDispatcher.getBroadcastChannel('tenant-modendo-01');
assert(reconnectedChannel !== null, 'Reconnected to Modendo BroadcastChannel successfully');

// ============================================================================
// Suite 7: Legacy Barista Tickets Migration & Rollback
// ============================================================================
console.log('\n[Suite 7: Legacy Barista Tickets Migration & Rollback]');

memoryStore.clear();

const legacyTickets = [
  {
    orderId: 'ord-leg-1',
    orderNumber: 801,
    clientGeneratedId: 'client-801',
    tenantId: 'tenant-100hich-01',
    orderType: 'DINE_IN',
    items: [],
    paidAt: new Date().toISOString(),
    prepStatus: 'PENDING',
  },
  {
    orderId: 'ord-leg-2',
    orderNumber: 802,
    clientGeneratedId: 'client-802',
    tenantId: 'tenant-modendo-01',
    orderType: 'DINE_IN',
    items: [],
    paidAt: new Date().toISOString(),
    prepStatus: 'PENDING',
  },
];

memoryStore.set(BARISTA_STORAGE_KEYS.LEGACY_TICKETS, JSON.stringify(legacyTickets));

const kdsMigResult = baristaDispatcher.migrateLegacyData();
assert(kdsMigResult.migrated, 'Legacy KDS tickets migration succeeded');
assertEqual(kdsMigResult.ticketCount, 2, 'Exactly 2 legacy tickets processed');

// Verify backup was created
assert(memoryStore.get(BARISTA_STORAGE_KEYS.LEGACY_BACKUP) !== null, 'Legacy backup key created');

// Verify idempotency
const secondKdsMig = baristaDispatcher.migrateLegacyData();
assert(!secondKdsMig.migrated, 'Second KDS migration skipped idempotently');

// Verify rollback
const kdsRolledBack = baristaDispatcher.rollbackLegacyMigration();
assert(kdsRolledBack, 'Rollback succeeded');
assert(memoryStore.get(BARISTA_STORAGE_KEYS.LEGACY_TICKETS) !== null, 'Legacy key restored');

unsubHich();
unsubModendo();

// ============================================================================
// Suite 8: Missing or Invalid Tenant Context & Safety Enforcement
// ============================================================================
console.log('\n[Suite 8: Missing or Invalid Tenant Context & Safety Enforcement]');

async function runSuite8() {
  // Clear ambient storage
  localStorage.removeItem('smartorders_active_tenant_id_v2');
  localStorage.removeItem('cafeos_active_tenant_id');
  baristaDispatcher.clearTenantContext();

  // 1. Missing tenant on dispatchOrder must throw error
  let missingTenantDispatchFailed = false;
  try {
    await baristaDispatcher.dispatchOrder({
      id: 'ord-missing-tenant',
      orderNumber: 999,
      items: [],
    });
  } catch (err: any) {
    missingTenantDispatchFailed = true;
    assert(
      err.message.includes('Missing or invalid tenant context'),
      'dispatchOrder with missing tenant threw expected safety error'
    );
  }
  assert(missingTenantDispatchFailed, 'dispatchOrder without tenant context failed safely');

  // 2. Invalid tenant string on dispatchOrder must throw error
  let invalidTenantDispatchFailed = false;
  try {
    await baristaDispatcher.dispatchOrder(
      { id: 'ord-invalid-tenant', items: [] },
      'tenant-alien-99'
    );
  } catch (err: any) {
    invalidTenantDispatchFailed = true;
    assert(
      err.message.includes('Missing or invalid tenant context'),
      'dispatchOrder with invalid tenant threw expected safety error'
    );
  }
  assert(invalidTenantDispatchFailed, 'dispatchOrder with invalid tenant rejected');

  // 3. getActiveTenantId throws when no tenant context is available (No implicit fallback to 100 HICH)
  let getActiveTenantFailed = false;
  try {
    baristaDispatcher.getActiveTenantId();
  } catch (err: any) {
    getActiveTenantFailed = true;
    assert(
      err.message.includes('Missing or invalid tenant context'),
      'getActiveTenantId throws instead of silently defaulting to 100 HICH'
    );
  }
  assert(getActiveTenantFailed, 'Unsafe implicit fallback to 100 HICH is eliminated');

  // 4. Querying tickets with invalid or empty tenant returns empty array safely
  const emptyTenantTickets = baristaDispatcher.getTickets('');
  assertEqual(emptyTenantTickets.length, 0, 'getTickets with empty tenant returns empty list safely');

  const invalidTenantTickets = baristaDispatcher.getTickets('unknown-cafe');
  assertEqual(invalidTenantTickets.length, 0, 'getTickets with unknown tenant returns empty list safely');

  const invalidTenantActiveCount = baristaDispatcher.getActiveCount('unknown-cafe');
  assertEqual(invalidTenantActiveCount, 0, 'getActiveCount with unknown tenant returns 0 safely');

  // 5. updatePrepStatus with missing/invalid tenant throws error
  let updatePrepMissingTenantFailed = false;
  try {
    baristaDispatcher.updatePrepStatus('ord-mod-501', 'READY', '');
  } catch (err: any) {
    updatePrepMissingTenantFailed = true;
  }
  assert(updatePrepMissingTenantFailed, 'updatePrepStatus with empty tenant context throws error');

  let updatePrepInvalidTenantFailed = false;
  try {
    baristaDispatcher.updatePrepStatus('ord-mod-501', 'READY', 'invalid-tenant');
  } catch (err: any) {
    updatePrepInvalidTenantFailed = true;
  }
  assert(updatePrepInvalidTenantFailed, 'updatePrepStatus with invalid tenant throws error');

  // 6. Subscribing without valid tenant context fails safely and delivers no tickets
  let invalidSubReceived: any[] = [];
  const unsubInvalid = baristaDispatcher.subscribe((tickets) => {
    invalidSubReceived = tickets;
  }, 'invalid-tenant');
  assertEqual(invalidSubReceived.length, 0, 'subscribe with invalid tenant received 0 tickets');

  // Dispatch valid order for Modendo; ensure invalid subscriber is NOT notified
  await baristaDispatcher.dispatchOrder(
    {
      id: 'ord-mod-503',
      orderNumber: 503,
      tenantId: 'tenant-modendo-01',
      orderType: 'TAKEAWAY',
      items: [{ title: 'لاته', quantity: 1 }],
    },
    'tenant-modendo-01'
  );
  assertEqual(invalidSubReceived.length, 0, 'invalid subscriber was NOT notified on Modendo order dispatch');
  unsubInvalid();

  // 7. Cross-tenant STATUS_CHANGE message rejection on BroadcastChannel
  const modendoChannel = baristaDispatcher.getBroadcastChannel('tenant-modendo-01');
  assert(modendoChannel !== null, 'Modendo channel exists');

  // Post foreign tenant status change message on Modendo channel
  const foreignChannel = new MockBroadcastChannel('cafeos_barista_channel_tenant-modendo-01');
  foreignChannel.postMessage({
    type: 'STATUS_CHANGE',
    orderId: 'ord-mod-501',
    prepStatus: 'READY',
    tenantId: 'tenant-100hich-01', // Cross-tenant forgery!
  });

  // Verify ticket status was NOT changed to READY by forged cross-tenant event
  const ticketCheckAfterForgery = baristaDispatcher
    .getTickets('tenant-modendo-01')
    .find((t) => t.orderId === 'ord-mod-501');
  assert(
    ticketCheckAfterForgery?.prepStatus !== 'READY',
    'Modendo dispatcher rejected cross-tenant status change forgery on BroadcastChannel'
  );

  // 8. setTenantContext validation
  let setInvalidContextFailed = false;
  try {
    baristaDispatcher.setTenantContext('unknown-tenant');
  } catch {
    setInvalidContextFailed = true;
  }
  assert(setInvalidContextFailed, 'setTenantContext rejects invalid tenant ID');

  baristaDispatcher.setTenantContext('tenant-modendo-01');
  assertEqual(
    baristaDispatcher.getActiveTenantId(),
    'tenant-modendo-01',
    'setTenantContext successfully sets explicit tenant context'
  );
  baristaDispatcher.clearTenantContext();
}

runSuite8().then(() => {
  console.log(`\n========================================`);
  console.log(`Phase 1D Barista KDS Isolation Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
});
