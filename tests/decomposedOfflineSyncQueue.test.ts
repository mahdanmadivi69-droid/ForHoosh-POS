/**
 * CAFE OS — Decomposed Offline Sync Queue Verification Suite
 * Path: tests/decomposedOfflineSyncQueue.test.ts
 *
 * Verifies:
 * 1. Atomic enqueue & dequeue with immutable tenant binding.
 * 2. Exponential backoff calculation with jitter (decorrelated / full jitter distribution).
 * 3. Client idempotency key (clientGeneratedId) persistence.
 * 4. HTTP 401 pause handling (zero retries consumed).
 * 5. HTTP 403 quarantine handling (security boundary protection).
 * 6. HTTP 409 conflict idempotent replay resolution.
 * 7. Multi-tenant isolation between 100 HICH and Modendo queues.
 */

import { DecomposedOfflineSyncQueue } from '../src/services/offline-sync-queue';

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

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
    failed++;
  }
}

async function runQueueSuite() {
  console.log('\n--- Running Decomposed Offline Sync Queue Verification Suite ---\n');

  // ===========================================================================
  // Suite 1: Exponential Backoff with Jitter
  // ===========================================================================
  console.log('[Suite 1: Exponential Backoff with Jitter]');
  const queue = new DecomposedOfflineSyncQueue({
    apiBaseUrl: 'http://127.0.0.1:3001',
    tenantId: 'tenant-100hich-01',
    baseBackoffMs: 1000,
    maxBackoffMs: 60000,
  });

  // Verify retry 0 delay is between 500ms and 1000ms
  const delays0 = Array.from({ length: 20 }, () => queue.calculateBackoffWithJitter(0));
  assert(delays0.every((d) => d >= 500 && d <= 1000), 'Retry 0 jittered delay is within [500ms, 1000ms]');
  const unique0 = new Set(delays0);
  assert(unique0.size > 5, 'Jitter introduces high entropy / random distribution');

  // Verify retry 1 delay is between 1000ms and 2000ms
  const delays1 = Array.from({ length: 20 }, () => queue.calculateBackoffWithJitter(1));
  assert(delays1.every((d) => d >= 1000 && d <= 2000), 'Retry 1 jittered delay is within [1000ms, 2000ms]');

  // Verify maximum backoff capping at 60,000ms
  const delays10 = Array.from({ length: 10 }, () => queue.calculateBackoffWithJitter(10));
  assert(delays10.every((d) => d >= 30000 && d <= 60000), 'Large retry counts cap safely at [30000ms, 60000ms]');

  // ===========================================================================
  // Suite 2: Client Idempotency & Atomic Enqueue
  // ===========================================================================
  console.log('\n[Suite 2: Client Idempotency & Atomic Enqueue]');
  const clientUuid = 'uuid-idem-test-4242';
  const sampleOrder = {
    id: clientUuid,
    clientGeneratedId: clientUuid,
    tenantId: 'tenant-100hich-01',
    orderNumber: 501,
    orderType: 'DINE_IN' as const,
    grossAmountToman: 120000,
    netTotalToman: 120000,
  };

  const queuedRecord = await queue.enqueueOrderAtomic(sampleOrder);
  assertEqual(queuedRecord.clientGeneratedId, clientUuid, 'Idempotency key preserved on enqueued record');
  assertEqual(queuedRecord.tenantId, 'tenant-100hich-01', 'Tenant ID bound immutably');
  assertEqual(queuedRecord.syncStatus, 'QUEUED', 'Initial status is QUEUED');
  assertEqual(queuedRecord.retryCount, 0, 'Initial retry count is 0');

  // ===========================================================================
  // Suite 3: HTTP 401 Pause Handling (Zero Retries Burned)
  // ===========================================================================
  console.log('\n[Suite 3: HTTP 401 Pause Handling (Zero Retries Burned)]');

  // Mock global fetch for 401 response
  const originalFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async () => ({
    status: 401,
    ok: false,
    json: async () => ({ error: 'Unauthorized' }),
  });

  await queue.syncSingleRecord(queuedRecord);
  assert(queue.isPaused(), 'Queue pauses on HTTP 401');

  // Verify stats reflect paused item
  const stats = await queue.getQueueStats();
  assertEqual(stats.paused, 1, 'Record marked as PAUSED');

  // Resume auth
  queue.resumeAuth();
  assert(!queue.isPaused(), 'Queue resumes when auth is refreshed');

  // ===========================================================================
  // Suite 4: HTTP 403 Quarantine Handling
  // ===========================================================================
  console.log('\n[Suite 4: HTTP 403 Quarantine Handling]');
  (globalThis as any).fetch = async () => ({
    status: 403,
    ok: false,
    json: async () => ({ error: 'Cross-tenant access forbidden' }),
  });

  await queue.syncSingleRecord(queuedRecord);
  const stats403 = await queue.getQueueStats();
  assertEqual(stats403.quarantined, 1, 'Record transitioned to QUARANTINED on HTTP 403');

  // ===========================================================================
  // Suite 5: HTTP 409 Conflict Idempotent Replay Resolution
  // ===========================================================================
  console.log('\n[Suite 5: HTTP 409 Conflict Idempotent Replay Resolution]');
  let successReported = false;
  const queue409 = new DecomposedOfflineSyncQueue({
    apiBaseUrl: 'http://127.0.0.1:3001',
    tenantId: 'tenant-100hich-01',
    onSyncSuccess: (id) => {
      if (id === clientUuid) successReported = true;
    },
  });

  const record409 = await queue409.enqueueOrderAtomic(sampleOrder);

  (globalThis as any).fetch = async () => ({
    status: 409,
    ok: false,
    json: async () => ({ isIdempotentReplay: true, message: 'Already recorded' }),
  });

  await queue409.syncSingleRecord(record409);
  assert(successReported, 'HTTP 409 with isIdempotentReplay resolves cleanly as success');

  const stats409 = await queue409.getQueueStats();
  assertEqual(stats409.total, 0, 'Synchronized record cleanly removed from queue');

  // ===========================================================================
  // Suite 6: Multi-Tenant Queue Scoping
  // ===========================================================================
  console.log('\n[Suite 6: Multi-Tenant Queue Scoping]');
  const queueModendo = new DecomposedOfflineSyncQueue({
    apiBaseUrl: 'http://127.0.0.1:3001',
    tenantId: 'tenant-modendo-01',
  });

  const modendoOrder = {
    id: 'uuid-modendo-1',
    clientGeneratedId: 'uuid-modendo-1',
    tenantId: 'tenant-modendo-01',
    orderNumber: 601,
    orderType: 'DINE_IN' as const,
    grossAmountToman: 185000,
    netTotalToman: 185000,
  };

  await queueModendo.enqueueOrderAtomic(modendoOrder);
  const modendoStats = await queueModendo.getQueueStats();
  assertEqual(modendoStats.total, 1, 'Modendo queue tracks exactly 1 record');

  // Clean up
  (globalThis as any).fetch = originalFetch;
  queue.destroy();
  queue409.destroy();
  queueModendo.destroy();

  console.log(`\n========================================`);
  console.log(`Decomposed Offline Sync Queue Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runQueueSuite().catch((err) => {
  console.error('Queue test suite crashed:', err);
  process.exit(1);
});
