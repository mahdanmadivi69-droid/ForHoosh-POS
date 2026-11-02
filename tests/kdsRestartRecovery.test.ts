/**
 * CAFE OS — Test Suite: KDS Restart Recovery & Station Isolation Invariants
 * File: tests/kdsRestartRecovery.test.ts
 * Owner: A06-TITAN / A05-SENTINEL
 *
 * Acceptance Criteria Verified:
 * 1. Persistent storage & complete server restart recovery.
 * 2. Uncompleted tickets resume with exact prep status and startedAt timestamps.
 * 3. Strict tenant isolation between 100 HICH and Modendo.
 * 4. Independent station completion: completing BAR leaves KITCHEN ticket untouched.
 * 5. Station security guard: BAR barista cannot complete KITCHEN tickets.
 * 6. NO_PREP exclusion: retail beans, gaming sessions, and merchandise never create KDS tickets.
 * 7. Delta ordering sequencing on supplemental dispatches.
 */

import path from 'path';
import fs from 'fs';
import {
  KdsService,
  TenantIsolationViolationError,
  StationSecurityViolationError,
} from '../server/kdsService';

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

async function runKdsTests() {
  console.log('\n--- Running CODA P2 KDS Restart Recovery & Station Isolation Verification Suite ---\n');

  const testStorageDir = path.resolve(process.cwd(), '.kds_test_storage');
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }

  const TENANT_HICH = 'tenant-100hich-01';
  const TENANT_MODENDO = 'tenant-modendo-01';

  // =========================================================================
  // SUITE 1: Server Restart Recovery & Snapshot Persistence
  // =========================================================================
  console.log('[Suite 1: Server Restart Recovery & Snapshot Persistence]');
  {
    // Boot server instance 1
    const server1 = new KdsService({
      storageDir: testStorageDir,
      storageFilename: 'kds_boot_test.json',
      persistToDisk: true,
    });

    const dispatchResult = server1.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-1001',
      orderNumber: 201,
      tableLabel: 'میز ۲',
      cashierName: 'رضا',
      items: [
        { id: 'it-1', categoryId: 'espresso', title: 'دوبل اسپرسو', quantity: 2 },
        { id: 'it-2', categoryId: 'bakery', title: 'کراسان شکلات', quantity: 1 },
      ],
    });

    assert(!!dispatchResult.barTicket, 'Server 1: BAR ticket created');
    assert(!!dispatchResult.kitchenTicket, 'Server 1: KITCHEN ticket created');

    const barTicketId = dispatchResult.barTicket!.id;
    const kitchenTicketId = dispatchResult.kitchenTicket!.id;

    // Transition BAR ticket to IN_PREP
    const inPrepBar = server1.updateTicketStatus(TENANT_HICH, barTicketId, 'IN_PREP');
    assert(inPrepBar.status === 'IN_PREP', 'BAR ticket transitioned to IN_PREP');
    assert(!!inPrepBar.startedAt, 'startedAt timestamp recorded on BAR ticket');
    const originalStartedAt = inPrepBar.startedAt;

    // SIMULATE CRASH & REBOOT: instantiate Server 2 against identical storage
    const server2 = new KdsService({
      storageDir: testStorageDir,
      storageFilename: 'kds_boot_test.json',
      persistToDisk: true,
    });

    const recoveredTickets = server2.getTickets(TENANT_HICH);
    assert(recoveredTickets.length === 2, `Server 2 (Post-Reboot): Recovered 2 tickets (found ${recoveredTickets.length})`);

    const recoveredBar = recoveredTickets.find((t) => t.id === barTicketId);
    assert(!!recoveredBar, 'Recovered BAR ticket exists after reboot');
    assert(recoveredBar?.status === 'IN_PREP', 'Recovered BAR ticket preserved IN_PREP status');
    assert(recoveredBar?.startedAt === originalStartedAt, 'Recovered BAR ticket retained exact startedAt timestamp');
    assert(recoveredBar?.orderNumber === 201, 'Recovered BAR ticket retained order number 201');
    assert(recoveredBar?.tableLabel === 'میز ۲', 'Recovered BAR ticket retained table label');
    assert(recoveredBar?.items.length === 1, 'Recovered BAR ticket has 1 item');
    assert(recoveredBar?.items[0].title === 'دوبل اسپرسو', 'Recovered BAR item is دوبل اسپرسو');

    const recoveredKitchen = recoveredTickets.find((t) => t.id === kitchenTicketId);
    assert(!!recoveredKitchen, 'Recovered KITCHEN ticket exists after reboot');
    assert(recoveredKitchen?.status === 'PENDING', 'Recovered KITCHEN ticket preserved PENDING status');
    assert(recoveredKitchen?.items[0].title === 'کراسان شکلات', 'Recovered KITCHEN item is کراسان شکلات');
  }

  // =========================================================================
  // SUITE 2: Strict Multi-Tenant Isolation
  // =========================================================================
  console.log('\n[Suite 2: Strict Multi-Tenant Isolation]');
  {
    const kds = new KdsService({
      storageDir: testStorageDir,
      storageFilename: 'kds_tenant_test.json',
      persistToDisk: true,
    });

    // Dispatch for 100 HICH
    const hichDispatch = kds.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-HICH-1',
      orderNumber: 301,
      items: [{ id: 'h-1', categoryId: 'espresso', title: 'کاپوچینو هیک', quantity: 1 }],
    });

    // Dispatch for Modendo
    const modendoDispatch = kds.dispatchOrder(TENANT_MODENDO, {
      orderId: 'ORD-MOD-1',
      orderNumber: 401,
      items: [{ id: 'm-1', categoryId: 'espresso', title: 'لاته مودندو', quantity: 1 }],
    });

    // Query 100 HICH
    const hichTickets = kds.getTickets(TENANT_HICH);
    assert(hichTickets.length === 1, '100 HICH receives only 1 ticket');
    assert(hichTickets[0].items[0].title === 'کاپوچینو هیک', '100 HICH ticket matches its own order');

    // Query Modendo
    const modendoTickets = kds.getTickets(TENANT_MODENDO);
    assert(modendoTickets.length === 1, 'Modendo receives only 1 ticket');
    assert(modendoTickets[0].items[0].title === 'لاته مودندو', 'Modendo ticket matches its own order');

    // Cross-tenant query safety
    const crossCheckHich = hichTickets.some((t) => t.tenantId === TENANT_MODENDO);
    assert(!crossCheckHich, 'ZERO Modendo tickets present in 100 HICH query results');

    const crossCheckMod = modendoTickets.some((t) => t.tenantId === TENANT_HICH);
    assert(!crossCheckMod, 'ZERO 100 HICH tickets present in Modendo query results');

    // Cross-tenant mutation attempt
    let crossMutationBlocked = false;
    try {
      kds.updateTicketStatus(TENANT_MODENDO, hichDispatch.barTicket!.id, 'COMPLETED');
    } catch (err) {
      if (err instanceof TenantIsolationViolationError) {
        crossMutationBlocked = true;
      }
    }
    assert(crossMutationBlocked, 'Modendo tenant REJECTED when attempting to update 100 HICH ticket');

    // Missing tenant validation
    let missingTenantBlocked = false;
    try {
      kds.getTickets('');
    } catch (err) {
      if (err instanceof TenantIsolationViolationError) {
        missingTenantBlocked = true;
      }
    }
    assert(missingTenantBlocked, 'Empty tenant context rejected on getTickets');
  }

  // =========================================================================
  // SUITE 3: Independent Station Completion & Security Guards
  // =========================================================================
  console.log('\n[Suite 3: Independent Station Completion & Security Guards]');
  {
    const kds = new KdsService({
      storageDir: testStorageDir,
      storageFilename: 'kds_stations_test.json',
      persistToDisk: true,
    });

    const dispatch = kds.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-SPLIT-1',
      orderNumber: 501,
      items: [
        { id: 'b-1', categoryId: 'espresso', title: 'آمریکانو', quantity: 1 },
        { id: 'k-1', categoryId: 'bakery', title: 'چیزکیک', quantity: 1 },
      ],
    });

    const barTicketId = dispatch.barTicket!.id;
    const kitchenTicketId = dispatch.kitchenTicket!.id;

    // Cross-station mutation guard: BAR barista cannot mark KITCHEN ticket
    let crossStationBlocked = false;
    try {
      kds.updateTicketStatus(TENANT_HICH, kitchenTicketId, 'COMPLETED', 'BAR');
    } catch (err) {
      if (err instanceof StationSecurityViolationError) {
        crossStationBlocked = true;
      }
    }
    assert(crossStationBlocked, 'Station guard: BAR station caller CANNOT complete KITCHEN ticket');

    // Barista completes BAR ticket
    const completedBar = kds.updateTicketStatus(TENANT_HICH, barTicketId, 'COMPLETED', 'BAR');
    assert(completedBar.status === 'COMPLETED', 'BAR ticket marked COMPLETED');
    assert(!!completedBar.completedAt, 'BAR ticket completedAt recorded');

    // INVARIANT: KITCHEN ticket must remain untouched in PENDING status!
    const activeTickets = kds.getTickets(TENANT_HICH);
    const kitchenTicket = activeTickets.find((t) => t.id === kitchenTicketId);
    assert(kitchenTicket?.status === 'PENDING', 'INVARIANT ENFORCED: KITCHEN ticket remains PENDING after BAR completes');
    assert(!kitchenTicket?.completedAt, 'KITCHEN ticket completedAt is undefined');

    // Counts verification
    const counts = kds.getActiveCounts(TENANT_HICH);
    assert(counts.bar === 0, 'Active BAR count is 0 (completed)');
    assert(counts.kitchen === 1, 'Active KITCHEN count is 1 (still pending)');
    assert(counts.total === 1, 'Total active count is 1');
  }

  // =========================================================================
  // SUITE 4: NO_PREP Filtering & Retail/Gaming Exclusion
  // =========================================================================
  console.log('\n[Suite 4: NO_PREP Filtering & Retail/Gaming Exclusion]');
  {
    const kds = new KdsService({
      storageDir: testStorageDir,
      storageFilename: 'kds_noprep_test.json',
      persistToDisk: true,
    });

    const mixedOrder = kds.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-NOPREP-1',
      orderNumber: 601,
      items: [
        { id: 'item-1', categoryId: 'cat-retail-beans', title: 'دانه قهوه اتیوپی ۲۵۰ گرمی', quantity: 1 },
        { id: 'item-2', categoryId: 'cat-mod-gaming', title: 'ساعت بازی بردگیم', quantity: 2 },
        { id: 'item-3', categoryId: 'merchandise', title: 'ماگ سرامیکی', quantity: 1 },
        { id: 'item-4', categoryId: 'espresso', title: 'آیس لاته', quantity: 1 },
      ],
    });

    assert(mixedOrder.noPrepCount === 3, `Identified 3 NO_PREP items (found ${mixedOrder.noPrepCount})`);
    assert(mixedOrder.dispatchedCount === 1, `Dispatched exactly 1 item (found ${mixedOrder.dispatchedCount})`);
    assert(!!mixedOrder.barTicket, 'BAR ticket created for آیس لاته');
    assert(!mixedOrder.kitchenTicket, 'Zero KITCHEN ticket created (no food items)');

    const barItems = mixedOrder.barTicket!.items;
    assert(barItems.length === 1, 'BAR ticket contains only 1 item');
    assert(barItems[0].title === 'آیس لاته', 'BAR item is solely آیس لاته');

    // Pure retail order
    const pureRetail = kds.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-RETAIL-ONLY',
      orderNumber: 602,
      items: [
        { id: 'ret-1', categoryId: 'cat-retail-beans', title: 'قهوه برزیل', quantity: 2 },
      ],
    });

    assert(!pureRetail.barTicket, 'Pure retail: ZERO BAR ticket created');
    assert(!pureRetail.kitchenTicket, 'Pure retail: ZERO KITCHEN ticket created');
    assert(pureRetail.noPrepCount === 1, 'Pure retail item safely classified as NO_PREP');
  }

  // =========================================================================
  // SUITE 5: Delta Order Dispatch & Sequencing
  // =========================================================================
  console.log('\n[Suite 5: Delta Order Dispatch & Sequencing]');
  {
    const kds = new KdsService({
      storageDir: testStorageDir,
      storageFilename: 'kds_delta_test.json',
      persistToDisk: true,
    });

    // Round 1: Table 4 orders 1 Americano
    const round1 = kds.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-TABLE-4',
      orderNumber: 701,
      tableLabel: 'میز ۴',
      items: [{ id: 't4-item-1', categoryId: 'espresso', title: 'آمریکانو', quantity: 1 }],
    });

    assert(!round1.barTicket!.isDelta, 'Round 1 ticket is NOT delta (initial)');
    assert(round1.barTicket!.deltaSequence === 0, 'Round 1 deltaSequence is 0');

    // Round 2: Table 4 adds 1 Flat White (BAR) and 1 Panini (KITCHEN)
    const round2 = kds.dispatchOrder(TENANT_HICH, {
      orderId: 'ORD-TABLE-4',
      orderNumber: 701,
      tableLabel: 'میز ۴',
      alreadyDispatchedIds: ['t4-item-1'],
      items: [
        { id: 't4-item-1', categoryId: 'espresso', title: 'آمریکانو', quantity: 1, status: 'SERVED' },
        { id: 't4-item-2', categoryId: 'espresso', title: 'فلت وایت', quantity: 1 },
        { id: 't4-item-3', categoryId: 'sandwiches', title: 'ساندویچ پنینی', quantity: 1 },
      ],
    });

    assert(round2.barTicket!.isDelta, 'Round 2 BAR ticket flagged as isDelta');
    assert(round2.barTicket!.deltaSequence === 1, 'Round 2 BAR deltaSequence incremented to 1');
    assert(!!round2.barTicket!.deltaHeaderFlag, 'Round 2 BAR ticket carries deltaHeaderFlag');
    assert(round2.barTicket!.items.length === 1, 'Round 2 BAR ticket has ONLY the new Flat White');
    assert(round2.barTicket!.items[0].title === 'فلت وایت', 'Item is فلت وایت');

    assert(round2.kitchenTicket!.isDelta, 'Round 2 KITCHEN ticket flagged as isDelta');
    assert(round2.kitchenTicket!.items.length === 1, 'Round 2 KITCHEN ticket has Panini');
    assert(round2.kitchenTicket!.items[0].title === 'ساندویچ پنینی', 'Item is ساندویچ پنینی');
  }

  // Cleanup test storage
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }

  console.log('\n========================================');
  console.log(`KDS Restart Recovery Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runKdsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
