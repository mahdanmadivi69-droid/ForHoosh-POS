/**
 * CAFE OS — Persistent KDS Backend & Station Recovery Verification Suite
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0 & CODA P2 Invariants
 *
 * Authored by: A05-SENTINEL (QA and Regression Engineer)
 * Target under test: server/kdsService.ts (owned by A06-TITAN)
 */

import fs from 'fs';
import path from 'path';
import {
  KdsService,
  TenantIsolationViolationError,
  StationSecurityViolationError,
} from '../server/kdsService';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual !== expected) {
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
    throw new Error(`Assertion failed: ${message} (Expected: ${expected}, Got: ${actual})`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

console.log('\n--- Running CODA P2 KDS Persistent Backend Verification Suite ---');

const testStorageDir = path.resolve(process.cwd(), '.kds_test_tmp');
const testStorageFile = 'test_kds_store.json';

// Cleanup any old test storage
if (fs.existsSync(testStorageDir)) {
  fs.rmSync(testStorageDir, { recursive: true, force: true });
}

const kds = new KdsService({
  storageDir: testStorageDir,
  storageFilename: testStorageFile,
  persistToDisk: true,
});

// =========================================================================
// Suite 1: BAR and KITCHEN Partitioning & Ticket Persistence
// =========================================================================
console.log('\n[Suite 1: BAR and KITCHEN Partitioning & Ticket Persistence]');

const mixedOrderPayload = {
  orderId: 'ord_hich_801',
  orderNumber: 801,
  tableLabel: 'میز ۲',
  cashierName: 'رضا',
  orderNotes: 'کم شیرین',
  items: [
    { id: 'it_esp_1', title: 'اسپرسو دوبل تخصصی', categoryId: 'espresso', quantity: 2, notes: 'دبل شات' },
    { id: 'it_brg_1', title: 'ساندویچ مرغ گریل', categoryId: 'sandwiches', quantity: 1, notes: 'بدون پیاز' },
  ],
};

const dispatchResult = kds.dispatchOrder('tenant-100hich-01', mixedOrderPayload);

assert(!!dispatchResult.barTicket, 'BAR ticket generated for coffee item');
assert(!!dispatchResult.kitchenTicket, 'KITCHEN ticket generated for sandwich item');
assertEqual(dispatchResult.barTicket?.station, 'BAR', 'BAR ticket station is BAR');
assertEqual(dispatchResult.kitchenTicket?.station, 'KITCHEN', 'KITCHEN ticket station is KITCHEN');
assertEqual(dispatchResult.barTicket?.items.length, 1, 'BAR ticket contains 1 item');
assertEqual(dispatchResult.barTicket?.items[0].title, 'اسپرسو دوبل تخصصی', 'BAR item is espresso');
assertEqual(dispatchResult.kitchenTicket?.items.length, 1, 'KITCHEN ticket contains 1 item');
assertEqual(dispatchResult.kitchenTicket?.items[0].title, 'ساندویچ مرغ گریل', 'KITCHEN item is chicken sandwich');
assertEqual(dispatchResult.dispatchedCount, 2, 'Total 2 items dispatched to stations');

// =========================================================================
// Suite 2: Strict NO_PREP Exclusion (Retail, Gaming, Merchandise)
// =========================================================================
console.log('\n[Suite 2: Strict NO_PREP Exclusion]');

const retailGamingPayload = {
  orderId: 'ord_mod_901',
  orderNumber: 901,
  tableLabel: 'پاد PS5 شماره ۱',
  items: [
    { id: 'it_ret_1', title: 'بسته ۲۵۰ گرمی دان قهوه', categoryId: 'cat-retail-beans', quantity: 2 },
    { id: 'it_gam_1', title: 'سشن بازی PS5 ۲ نفره', categoryId: 'cat-mod-gaming', quantity: 1 },
    { id: 'it_mch_1', title: 'ماگ سرامیکی قرمز', categoryId: 'merchandise', quantity: 1 },
  ],
};

const noPrepResult = kds.dispatchOrder('tenant-modendo-01', retailGamingPayload);

assert(!noPrepResult.barTicket, 'CRITICAL: Zero BAR tickets created for pure retail/gaming order');
assert(!noPrepResult.kitchenTicket, 'CRITICAL: Zero KITCHEN tickets created for pure retail/gaming order');
assertEqual(noPrepResult.dispatchedCount, 0, 'dispatchedCount is strictly 0');
assertEqual(noPrepResult.noPrepCount, 3, 'All 3 items recognized as NO_PREP');

// =========================================================================
// Suite 3: Idempotent Duplicate Dispatch Prevention
// =========================================================================
console.log('\n[Suite 3: Idempotent Duplicate Dispatch Prevention]');

const duplicateResult = kds.dispatchOrder('tenant-100hich-01', mixedOrderPayload);

assert(duplicateResult.isIdempotentReplay === true, 'Re-dispatching identical order flags isIdempotentReplay');
assertEqual(duplicateResult.dispatchedCount, 0, 'Zero new items dispatched on replay');
assertEqual(duplicateResult.barTicket?.id, dispatchResult.barTicket?.id, 'Returns original BAR ticket ID');
assertEqual(duplicateResult.kitchenTicket?.id, dispatchResult.kitchenTicket?.id, 'Returns original KITCHEN ticket ID');

// Verify active ticket counts were NOT duplicated
const hichCounts = kds.getActiveCounts('tenant-100hich-01');
assertEqual(hichCounts.bar, 1, 'BAR active ticket count remains exactly 1');
assertEqual(hichCounts.kitchen, 1, 'KITCHEN active ticket count remains exactly 1');

// =========================================================================
// Suite 4: Delta Sequencing for Supplemental Orders
// =========================================================================
console.log('\n[Suite 4: Delta Sequencing for Supplemental Orders]');

const supplementalPayload = {
  orderId: 'ord_hich_801',
  orderNumber: 801,
  tableLabel: 'میز ۲',
  items: [
    ...mixedOrderPayload.items,
    { id: 'it_lat_1', title: 'آیس لاته کارامل', categoryId: 'espresso', quantity: 1 },
  ],
  alreadyDispatchedIds: ['it_esp_1', 'it_brg_1'],
};

const deltaResult = kds.dispatchOrder('tenant-100hich-01', supplementalPayload);

assert(!!deltaResult.barTicket, 'Delta BAR ticket generated for new drink');
assert(!deltaResult.kitchenTicket, 'Zero KITCHEN tickets generated because no new kitchen items added');
assertEqual(deltaResult.barTicket?.isDelta, true, 'Ticket flagged as isDelta = true');
assertEqual(deltaResult.barTicket?.deltaSequence, 1, 'Delta sequence is 1');
assert(
  deltaResult.barTicket?.deltaHeaderFlag?.includes('سفارش تکمیلی') === true,
  'Delta header flag attached: "سفارش تکمیلی / ADDITIONAL ORDER"'
);
assertEqual(deltaResult.dispatchedCount, 1, 'Only the 1 new drink dispatched');

// =========================================================================
// Suite 5: Independent Station Completion & Cross-Station Security
// =========================================================================
console.log('\n[Suite 5: Independent Station Completion & Cross-Station Security]');

const barTicketId = dispatchResult.barTicket!.id;
const kitchenTicketId = dispatchResult.kitchenTicket!.id;

// 1. Advance BAR ticket: PENDING -> IN_PREP -> COMPLETED
const inPrepBar = kds.updateTicketStatus('tenant-100hich-01', barTicketId, 'IN_PREP', 'BAR');
assertEqual(inPrepBar.status, 'IN_PREP', 'BAR ticket transitioned to IN_PREP');
assert(!!inPrepBar.startedAt, 'startedAt timestamp recorded');

const completedBar = kds.updateTicketStatus('tenant-100hich-01', barTicketId, 'COMPLETED', 'BAR');
assertEqual(completedBar.status, 'COMPLETED', 'BAR ticket transitioned to COMPLETED');
assert(!!completedBar.completedAt, 'completedAt timestamp recorded');

// Verify KITCHEN ticket remains PENDING (completely independent lifecycle)
const kitchenTickets = kds.getTickets('tenant-100hich-01', { station: 'KITCHEN' });
assertEqual(kitchenTickets[0].status, 'PENDING', 'INVARIANT: KITCHEN ticket status remains PENDING');

// 2. Cross-Station Security Guard: Barista at BAR cannot alter KITCHEN ticket
let stationViolationCaught = false;
try {
  kds.updateTicketStatus('tenant-100hich-01', kitchenTicketId, 'COMPLETED', 'BAR');
} catch (err: any) {
  if (err instanceof StationSecurityViolationError) {
    stationViolationCaught = true;
  }
}
assert(stationViolationCaught, 'CRITICAL: StationSecurityViolationError thrown when BAR caller mutates KITCHEN ticket');

// =========================================================================
// Suite 6: Safe Cancellation and Reopen Lifecycle
// =========================================================================
console.log('\n[Suite 6: Safe Cancellation and Reopen Lifecycle]');

const cancelledKitchen = kds.cancelTicket(
  'tenant-100hich-01',
  kitchenTicketId,
  'مشتری منصرف شد',
  'KITCHEN'
);
assertEqual(cancelledKitchen.status, 'CANCELLED', 'KITCHEN ticket cancelled safely');
assert(cancelledKitchen.orderNotes?.includes('مشتری منصرف شد') === true, 'Cancellation reason preserved');

const reopenedKitchen = kds.reopenTicket('tenant-100hich-01', kitchenTicketId, 'KITCHEN');
assertEqual(reopenedKitchen.status, 'PENDING', 'KITCHEN ticket reopened to PENDING state');
assertEqual(reopenedKitchen.completedAt, undefined, 'completedAt reset upon reopen');

// =========================================================================
// Suite 7: Complete Server Restart Recovery
// =========================================================================
console.log('\n[Suite 7: Complete Server Restart Recovery]');

// Instantiate a brand new KdsService pointing to the same disk file (simulating reboot)
const rebootedKds = new KdsService({
  storageDir: testStorageDir,
  storageFilename: testStorageFile,
  persistToDisk: true,
});

const restoredTickets = rebootedKds.getTickets('tenant-100hich-01');
assert(restoredTickets.length >= 3, 'All tickets restored from disk snapshot after restart');

const restoredBarCompleted = restoredTickets.find((t) => t.id === barTicketId);
assert(!!restoredBarCompleted, 'Completed BAR ticket recovered');
assertEqual(restoredBarCompleted?.status, 'COMPLETED', 'Recovered BAR ticket retains COMPLETED status');

const restoredKitchen = restoredTickets.find((t) => t.id === kitchenTicketId);
assert(!!restoredKitchen, 'Reopened KITCHEN ticket recovered');
assertEqual(restoredKitchen?.status, 'PENDING', 'Recovered KITCHEN ticket retains PENDING status');
assertEqual(restoredKitchen?.orderId, 'ord_hich_801', 'Order ID preserved after restart');
assertEqual(restoredKitchen?.items[0].title, 'ساندویچ مرغ گریل', 'Item details preserved after restart');

// =========================================================================
// Suite 8: Cross-Tenant Boundary Enforcement
// =========================================================================
console.log('\n[Suite 8: Cross-Tenant Boundary Enforcement]');

// Modendo tries to view 100 HICH tickets
const modendoView = rebootedKds.getTickets('tenant-modendo-01');
const leakedHichTicket = modendoView.find((t) => t.id === barTicketId);
assert(!leakedHichTicket, 'INVARIANT: Modendo cannot see 100 HICH tickets');

// Modendo tries to update 100 HICH ticket
let tenantViolationCaught = false;
try {
  rebootedKds.updateTicketStatus('tenant-modendo-01', barTicketId, 'PENDING');
} catch (err: any) {
  if (err instanceof TenantIsolationViolationError) {
    tenantViolationCaught = true;
  }
}
assert(tenantViolationCaught, 'CRITICAL: TenantIsolationViolationError thrown on cross-tenant mutation');

// Modendo tries to cancel 100 HICH ticket
let tenantCancelViolationCaught = false;
try {
  rebootedKds.cancelTicket('tenant-modendo-01', barTicketId, 'تلاش غیرمجاز');
} catch (err: any) {
  if (err instanceof TenantIsolationViolationError) {
    tenantCancelViolationCaught = true;
  }
}
assert(tenantCancelViolationCaught, 'CRITICAL: TenantIsolationViolationError thrown on cross-tenant cancel');

// Clean up test directory
try {
  fs.rmSync(testStorageDir, { recursive: true, force: true });
} catch {
  // ignore
}

// =========================================================================
// Summary
// =========================================================================
console.log('\n========================================');
console.log(`KDS Persistent Backend Summary: ${passedTests} Passed, 0 Failed`);
console.log('========================================\n');
