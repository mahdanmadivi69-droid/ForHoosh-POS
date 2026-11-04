/**
 * CAFE OS — Gate 5 Offline Network Drop & Batch Flush Simulation Suite
 * Path: tests/staging/offlineSimulation.test.ts
 *
 * Verifies Gate 5 requirements:
 * 1. Offline network drop simulation: 30 orders enqueued locally in Dexie POS database without data loss.
 * 2. Immutable tenant binding across dual cafes (100 HICH and Modendo).
 * 3. Network reconnection and batch flush via processOfflineOrderBatchSync.
 * 4. Zero duplicate billing / stock over-deduction via HTTP 409 idempotent replay resolution.
 * 5. Tampered payload conflict quarantine (security fail-closed guard).
 * 6. Cross-tenant batch contamination prevention.
 */

// Memory mock for localStorage in headless test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

import { DecomposedOfflineSyncQueue } from '../../src/services/offline-sync-queue';
import {
  processOfflineOrderSync,
  processOfflineOrderBatchSync,
  InMemoryDatabaseClient,
  SyncOrderPayload,
} from '../../src/services/sync-order-handler';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, desc: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc} | Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

export async function runGate5OfflineSimulation() {
  console.log('\n--- Running Gate 5: Offline Network Drop & 30-Order Batch Sync Simulation ---\n');

  const HICH_TENANT = 'tenant-100hich-01';
  const MODENDO_TENANT = 'tenant-modendo-01';

  // ===========================================================================
  // Step 1: Generate 30 Realistic Offline Orders (15 for 100 HICH, 15 for Modendo)
  // ===========================================================================
  const orders100Hich: SyncOrderPayload[] = [];
  const ordersModendo: SyncOrderPayload[] = [];

  for (let i = 1; i <= 15; i++) {
    const clientUuidHich = `hich-offline-uuid-${1000 + i}`;
    const priceHich = 70000 + i * 5000;
    orders100Hich.push({
      tenantId: HICH_TENANT,
      clientGeneratedId: clientUuidHich,
      source: 'POS',
      order: {
        items: [
          { productId: 'hich-espresso-blend', quantity: 2, name: `قهوه تخصصی اسپرسو شات ${i}` },
          { productId: 'hich-croissant', quantity: 1, name: 'کروسان کره فرانسوی' },
        ],
        totalNet: priceHich,
        payments: [
          {
            method: i % 2 === 0 ? 'POS_TERMINAL' : 'CASH',
            amount: priceHich,
            referenceNumber: `REF-HICH-${1000 + i}`,
          },
        ],
        createdAt: new Date(Date.now() - (30 - i) * 60000).toISOString(),
      },
    });

    const clientUuidModendo = `modendo-offline-uuid-${2000 + i}`;
    const priceModendo = 95000 + i * 8000;
    ordersModendo.push({
      tenantId: MODENDO_TENANT,
      clientGeneratedId: clientUuidModendo,
      source: 'POS',
      order: {
        items: [
          { productId: 'modendo-burger-patty', quantity: 1, name: `اسمک برگر دست‌ساز ${i}` },
          { productId: 'modendo-game-pass', quantity: 1, name: 'بلیط بازی بوردگیم ۲ ساعته' },
        ],
        totalNet: priceModendo,
        payments: [
          {
            method: 'POS_TERMINAL',
            amount: priceModendo,
            referenceNumber: `REF-MOD-${2000 + i}`,
          },
        ],
        createdAt: new Date(Date.now() - (30 - i) * 60000).toISOString(),
      },
    });
  }

  const all30Orders = [...orders100Hich, ...ordersModendo];
  assertEqual(all30Orders.length, 30, 'Generated exactly 30 distinct offline orders (15 per tenant)');

  // ===========================================================================
  // Suite 1: Network Drop Simulation & 30-Order Offline Dexie Queueing
  // ===========================================================================
  console.log('[Suite 1: Network Drop Simulation & 30-Order Offline Queueing]');
  {
    // Simulate disconnected network: fetch rejects with NetworkError
    const originalFetch = (globalThis as any).fetch;
    let networkCallCount = 0;
    (globalThis as any).fetch = async () => {
      networkCallCount++;
      throw new TypeError('Failed to fetch (Network connection dropped)');
    };

    // Initialize queues for both cafes
    const hichQueue = new DecomposedOfflineSyncQueue({
      tenantId: HICH_TENANT,
      apiBaseUrl: 'http://127.0.0.1:3001',
      baseBackoffMs: 500,
    });

    const modendoQueue = new DecomposedOfflineSyncQueue({
      tenantId: MODENDO_TENANT,
      apiBaseUrl: 'http://127.0.0.1:3001',
      baseBackoffMs: 500,
    });

    // Enqueue 15 100 HICH orders
    for (const ord of orders100Hich) {
      const rec = await hichQueue.enqueueOrderAtomic({
        ...ord.order,
        id: ord.clientGeneratedId,
        clientGeneratedId: ord.clientGeneratedId,
        tenantId: HICH_TENANT,
      });
      assertEqual(rec.syncStatus, 'QUEUED', `100 HICH order ${ord.clientGeneratedId} enqueued as QUEUED`);
      assertEqual(rec.tenantId, HICH_TENANT, '100 HICH order tenantId bound immutably');
    }

    // Enqueue 15 Modendo orders
    for (const ord of ordersModendo) {
      const rec = await modendoQueue.enqueueOrderAtomic({
        ...ord.order,
        id: ord.clientGeneratedId,
        clientGeneratedId: ord.clientGeneratedId,
        tenantId: MODENDO_TENANT,
      });
      assertEqual(rec.syncStatus, 'QUEUED', `Modendo order ${ord.clientGeneratedId} enqueued as QUEUED`);
      assertEqual(rec.tenantId, MODENDO_TENANT, 'Modendo order tenantId bound immutably');
    }

    // Inspect Queue statistics while offline
    const hichStatsOffline = await hichQueue.getQueueStats();
    assertEqual(hichStatsOffline.total, 15, '100 HICH queue holds exactly 15 offline records');
    assertEqual(hichStatsOffline.queued, 15, '100 HICH queue reports 15 orders in QUEUED state');

    const modendoStatsOffline = await modendoQueue.getQueueStats();
    assertEqual(modendoStatsOffline.total, 15, 'Modendo queue holds exactly 15 offline records');
    assertEqual(modendoStatsOffline.queued, 15, 'Modendo queue reports 15 orders in QUEUED state');

    // Clean up queues
    hichQueue.destroy();
    modendoQueue.destroy();
    (globalThis as any).fetch = originalFetch;
  }

  // ===========================================================================
  // Suite 2: Network Restoration & Batch Flush Processing
  // ===========================================================================
  console.log('\n[Suite 2: Network Restoration & Batch Flush Processing]');
  const db = new InMemoryDatabaseClient([
    { productId: 'hich-espresso-blend', availableQuantity: 100, tenantId: HICH_TENANT },
    { productId: 'hich-croissant', availableQuantity: 50, tenantId: HICH_TENANT },
    { productId: 'modendo-burger-patty', availableQuantity: 50, tenantId: MODENDO_TENANT },
    { productId: 'modendo-game-pass', availableQuantity: 50, tenantId: MODENDO_TENANT },
  ]);

  {
    // Execute Batch Flush for 100 HICH (15 orders)
    const batchResHich = await processOfflineOrderBatchSync(db, {
      tenantId: HICH_TENANT,
      mutations: orders100Hich,
    });

    assert(batchResHich.success, '100 HICH batch sync completed with success: true');
    assertEqual(batchResHich.totalProcessed, 15, '100 HICH batch processed 15 orders');
    assertEqual(batchResHich.syncedCount, 15, '100 HICH batch synced exactly 15 orders');
    assertEqual(batchResHich.alreadySyncedCount, 0, '100 HICH batch has 0 already-synced orders on initial flush');

    // Execute Batch Flush for Modendo Cafe (15 orders)
    const batchResModendo = await processOfflineOrderBatchSync(db, {
      tenantId: MODENDO_TENANT,
      mutations: ordersModendo,
    });

    assert(batchResModendo.success, 'Modendo batch sync completed with success: true');
    assertEqual(batchResModendo.totalProcessed, 15, 'Modendo batch processed 15 orders');
    assertEqual(batchResModendo.syncedCount, 15, 'Modendo batch synced exactly 15 orders');
    assertEqual(batchResModendo.alreadySyncedCount, 0, 'Modendo batch has 0 already-synced orders on initial flush');

    // Total database checks
    assertEqual(db.ordersMap.size, 30, 'Server database contains exactly 30 orders after batch flush');
    assertEqual(db.paymentsMap.size, 30, 'Server database contains exactly 30 payment records');

    // Financial reconciliation across the 30 orders
    let expectedTotalHich = 0;
    for (const o of orders100Hich) expectedTotalHich += o.order.totalNet;
    let expectedTotalModendo = 0;
    for (const o of ordersModendo) expectedTotalModendo += o.order.totalNet;

    let dbTotalHich = 0;
    let dbTotalModendo = 0;
    for (const p of db.paymentsMap.values()) {
      if (p.tenantId === HICH_TENANT) dbTotalHich += p.amount;
      if (p.tenantId === MODENDO_TENANT) dbTotalModendo += p.amount;
    }

    assertEqual(dbTotalHich, expectedTotalHich, `100 HICH total revenue (${dbTotalHich.toLocaleString()} Toman) reconciles to exact sum`);
    assertEqual(dbTotalModendo, expectedTotalModendo, `Modendo total revenue (${dbTotalModendo.toLocaleString()} Toman) reconciles to exact sum`);

    // Inventory stock assertions:
    // 15 orders * 2 espresso blends = 30 deducted (100 -> 70)
    assertEqual(db.getStock('hich-espresso-blend', HICH_TENANT), 70, '100 HICH espresso stock deducted by 30 units (100 -> 70)');
    // 15 orders * 1 croissant = 15 deducted (50 -> 35)
    assertEqual(db.getStock('hich-croissant', HICH_TENANT), 35, '100 HICH croissant stock deducted by 15 units (50 -> 35)');
    // 15 orders * 1 burger patty = 15 deducted (50 -> 35)
    assertEqual(db.getStock('modendo-burger-patty', MODENDO_TENANT), 35, 'Modendo burger patty stock deducted by 15 units (50 -> 35)');
  }

  // ===========================================================================
  // Suite 3: HTTP 409 Conflict & Idempotent Replay Resolution Cycle
  // ===========================================================================
  console.log('\n[Suite 3: HTTP 409 Conflict & Idempotent Replay Resolution Cycle]');
  {
    // Simulate network jitter / client timeout where client replays the entire 30-order batch
    const replayResHich = await processOfflineOrderBatchSync(db, {
      tenantId: HICH_TENANT,
      mutations: orders100Hich,
    });

    assert(replayResHich.success, 'Replay batch sync for 100 HICH reports success');
    assertEqual(replayResHich.totalProcessed, 15, 'Replay processed all 15 orders');
    assertEqual(replayResHich.syncedCount, 0, 'Zero new orders inserted on replay (syncedCount: 0)');
    assertEqual(replayResHich.alreadySyncedCount, 15, 'All 15 orders identified as already-synced (alreadySyncedCount: 15)');
    assert(replayResHich.results.every((r) => r.isIdempotentReplay), 'Every order flagged with isIdempotentReplay: true');
    assert(replayResHich.results.every((r) => r.status === 'ALREADY_SYNCED'), 'Every order flagged with status: ALREADY_SYNCED');

    const replayResModendo = await processOfflineOrderBatchSync(db, {
      tenantId: MODENDO_TENANT,
      mutations: ordersModendo,
    });

    assert(replayResModendo.success, 'Replay batch sync for Modendo reports success');
    assertEqual(replayResModendo.syncedCount, 0, 'Zero new Modendo orders inserted on replay');
    assertEqual(replayResModendo.alreadySyncedCount, 15, 'All 15 Modendo orders flagged as already-synced');

    // Assert absolute database idempotency invariants:
    assertEqual(db.ordersMap.size, 30, 'Order count strictly invariant: remained 30 (NOT 60)');
    assertEqual(db.paymentsMap.size, 30, 'Payment count strictly invariant: remained 30 (NOT 60)');
    assertEqual(db.getStock('hich-espresso-blend', HICH_TENANT), 70, 'Inventory stock untouched: remained 70 (NO double deduction)');
    assertEqual(db.getStock('modendo-burger-patty', MODENDO_TENANT), 35, 'Modendo stock untouched: remained 35 (NO double deduction)');

    // Now test DecomposedOfflineSyncQueue handling HTTP 409 from server bridge
    const testQueue = new DecomposedOfflineSyncQueue({
      tenantId: HICH_TENANT,
      apiBaseUrl: 'http://127.0.0.1:3001',
    });

    let queueResolvedSuccess = 0;
    const originalFetch = (globalThis as any).fetch;

    // Bridge returns HTTP 409 Conflict with isIdempotentReplay
    (globalThis as any).fetch = async () => ({
      status: 409,
      ok: false,
      json: async () => ({
        status: 'ALREADY_SYNCED',
        isIdempotentReplay: true,
        message: 'Order already synchronized in previous transaction.',
      }),
    });

    const testOrder = orders100Hich[0];
    const queuedRec = await testQueue.enqueueOrderAtomic({
      ...testOrder.order,
      id: testOrder.clientGeneratedId,
      clientGeneratedId: testOrder.clientGeneratedId,
      tenantId: HICH_TENANT,
    });

    testQueue.subscribe((stats) => {
      if (stats.total === 0) queueResolvedSuccess++;
    });

    await testQueue.syncSingleRecord(queuedRec);

    const postStats = await testQueue.getQueueStats();
    assertEqual(postStats.total, 0, 'HTTP 409 with isIdempotentReplay: true resolves cleanly and completes queue record');
    assertEqual(postStats.quarantined, 0, 'Record was NOT quarantined on legitimate idempotent replay');

    testQueue.destroy();
    (globalThis as any).fetch = originalFetch;
  }

  // ===========================================================================
  // Suite 4: Tampered Replay Detection (Quarantine Security Gate)
  // ===========================================================================
  console.log('\n[Suite 4: Tampered Replay Detection (Quarantine Security Gate)]');
  {
    const existingOrder = orders100Hich[0];
    const tamperedPayload: SyncOrderPayload = {
      ...existingOrder,
      order: {
        ...existingOrder.order,
        totalNet: 9999999, // Tampered price
      },
    };

    const quarantineQueue = new DecomposedOfflineSyncQueue({
      tenantId: HICH_TENANT,
      apiBaseUrl: 'http://127.0.0.1:3001',
    });

    const originalFetch = (globalThis as any).fetch;
    // Server rejects tampered conflict
    (globalThis as any).fetch = async () => ({
      status: 409,
      ok: false,
      json: async () => ({
        status: 'CONFLICT_MISMATCH',
        isIdempotentReplay: false,
        error: 'Order payload does not match previously synchronized order record.',
      }),
    });

    const rec = await quarantineQueue.enqueueOrderAtomic({
      ...tamperedPayload.order,
      id: tamperedPayload.clientGeneratedId,
      clientGeneratedId: tamperedPayload.clientGeneratedId,
      tenantId: HICH_TENANT,
    });

    await quarantineQueue.syncSingleRecord(rec);

    const stats = await quarantineQueue.getQueueStats();
    assertEqual(stats.quarantined, 1, 'Tampered conflict correctly transitioned to QUARANTINED');

    quarantineQueue.destroy();
    (globalThis as any).fetch = originalFetch;
  }

  // ===========================================================================
  // Suite 5: Cross-Tenant Batch Mutation Boundary Protection
  // ===========================================================================
  console.log('\n[Suite 5: Cross-Tenant Batch Mutation Boundary Protection]');
  {
    const contaminatedBatch = [
      ...orders100Hich.slice(0, 5),
      ordersModendo[0], // Modendo order injected into 100 HICH batch!
    ];

    let crossTenantErrorThrown = false;
    try {
      await processOfflineOrderBatchSync(db, {
        tenantId: HICH_TENANT,
        mutations: contaminatedBatch,
      });
    } catch (err: any) {
      if (err.message.includes('Cross-tenant batch mutation error')) {
        crossTenantErrorThrown = true;
      }
    }

    assert(crossTenantErrorThrown, 'Batch sync rejected cross-tenant contamination with fail-closed exception');
  }

  console.log(`\n========================================`);
  console.log(`Gate 5 Offline Simulation Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute directly if run as CLI script
runGate5OfflineSimulation().catch((err) => {
  console.error('Gate 5 offline simulation crashed:', err);
  process.exit(1);
});
