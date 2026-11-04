/**
 * CAFE OS — Backend Order Sync Idempotency & Batch Mutation Test Suite
 * Path: tests/syncOrderHandlerIdempotency.test.ts
 *
 * Verifies:
 * 1. Strict clientGeneratedId idempotency and deduplication (ON CONFLICT DO NOTHING semantics)
 * 2. Replay of identical clientGeneratedId yields ALREADY_SYNCED and isIdempotentReplay = true
 * 3. Zero duplicated financial or payment records on repeated submission
 * 4. Transactional tenant context setting (setTenantContext) and fail-closed cross-tenant guards
 * 5. Batch mutation ingestion (processOfflineOrderBatchSync) from DecomposedOfflineSyncQueue
 * 6. Inventory stockout overdraft warning tracking without financial disruption
 */

import {
  processOfflineOrderSync,
  processOfflineOrderBatchSync,
  InMemoryDatabaseClient,
  SyncOrderPayload,
  validateTenantIdentity,
  validateIdempotencyKey,
} from '../src/services/sync-order-handler';

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

async function runTests() {
  console.log('\n--- Running Backend Sync Idempotency & Batch Mutation Suite ---\n');

  const HICH_TENANT = 'tenant-100hich-01';
  const MODENDO_TENANT = 'tenant-modendo-01';

  // -------------------------------------------------------------------------
  // Suite 1: Idempotency Key & Tenant Identity Validation
  // -------------------------------------------------------------------------
  console.log('[Suite 1: Fail-Closed Tenant & Idempotency Key Validation]');
  {
    assert(validateTenantIdentity(HICH_TENANT) === HICH_TENANT, 'Valid tenant identity accepted');
    let tenantErr = false;
    try {
      validateTenantIdentity('');
    } catch {
      tenantErr = true;
    }
    assert(tenantErr, 'Empty tenant identifier throws fail-closed error');

    const idemKey = 'uuid-client-gen-001';
    assert(validateIdempotencyKey(idemKey) === idemKey, 'Valid clientGeneratedId accepted');
    let keyErr = false;
    try {
      validateIdempotencyKey('');
    } catch {
      keyErr = true;
    }
    assert(keyErr, 'Empty clientGeneratedId throws fail-closed error');
  }

  // -------------------------------------------------------------------------
  // Suite 2: Single Order Idempotent Replay & Deduplication
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2: Single Order Idempotency (ON CONFLICT DO NOTHING)]');
  {
    const db = new InMemoryDatabaseClient([
      { productId: 'beans-blend', availableQuantity: 50, tenantId: HICH_TENANT },
    ]);

    const clientGeneratedId = 'order-idem-uuid-001';
    const singleOrderPayload: SyncOrderPayload = {
      tenantId: HICH_TENANT,
      clientGeneratedId,
      source: 'POS',
      order: {
        items: [{ productId: 'beans-blend', quantity: 2, name: 'Ethiopia Blend' }],
        totalNet: 140000,
        payments: [{ method: 'POS_TERMINAL', amount: 140000, referenceNumber: 'REF-101' }],
        createdAt: '2026-11-04T12:00:00Z',
      },
    };

    // 1. Initial ingestion
    const res1 = await processOfflineOrderSync(db, singleOrderPayload);
    assert(res1.status === 'SYNCED_SUCCESSFULLY', 'First sync yields SYNCED_SUCCESSFULLY');
    assert(res1.isIdempotentReplay === false, 'First sync isIdempotentReplay is false');
    assert(Boolean(res1.orderId), 'First sync assigns valid orderId');
    assert(db.ordersMap.size === 1, 'Exactly 1 order registered in database');
    assert(db.paymentsMap.size === 1, 'Exactly 1 payment registered in database');
    assert(db.getStock('beans-blend', HICH_TENANT) === 48, 'Stock depleted by 2 (50 -> 48)');

    // 2. Replay identical order with same clientGeneratedId
    const res2 = await processOfflineOrderSync(db, singleOrderPayload);
    assert(res2.status === 'ALREADY_SYNCED', 'Replay sync yields ALREADY_SYNCED');
    assert(res2.isIdempotentReplay === true, 'Replay sync isIdempotentReplay is true');
    assert(res2.orderId === res1.orderId, 'Replay returns matching original orderId');
    assert(db.ordersMap.size === 1, 'Database orders count remains strictly 1 (no duplicate insertion)');
    assert(db.paymentsMap.size === 1, 'Database payments count remains strictly 1 (no duplicate payment)');
    assert(db.getStock('beans-blend', HICH_TENANT) === 48, 'Stock count remains unchanged on idempotent replay');
  }

  // -------------------------------------------------------------------------
  // Suite 3: Transactional Tenant Context & Cross-Tenant Isolation
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3: Transactional Tenant Context & Cross-Tenant Boundary]');
  {
    const db = new InMemoryDatabaseClient();

    // Verify tenant context setting
    let capturedContext: string | null = null;
    await db.transaction(async (tx) => {
      await tx.setTenantContext(MODENDO_TENANT);
      capturedContext = tx.getTenantContext();
    });
    assert(capturedContext === MODENDO_TENANT, 'setTenantContext sets transactional tenant context');
    assert(db.currentTenantContext === null, 'Tenant context cleared after transaction completes');

    // Distinct orders for different tenants
    const hichPayload: SyncOrderPayload = {
      tenantId: HICH_TENANT,
      clientGeneratedId: 'hich-unique-uuid-001',
      source: 'POS',
      order: {
        items: [{ productId: 'item-1', quantity: 1, name: 'Espresso' }],
        totalNet: 45000,
        payments: [{ method: 'CASH', amount: 45000 }],
        createdAt: '2026-11-04T12:00:00Z',
      },
    };
    const modendoPayload: SyncOrderPayload = {
      tenantId: MODENDO_TENANT,
      clientGeneratedId: 'modendo-unique-uuid-002',
      source: 'POS',
      order: {
        items: [{ productId: 'item-mod-1', quantity: 1, name: 'Modendo Latte' }],
        totalNet: 60000,
        payments: [{ method: 'CASH', amount: 60000 }],
        createdAt: '2026-11-04T12:01:00Z',
      },
    };

    const hichRes = await processOfflineOrderSync(db, hichPayload);
    assert(hichRes.status === 'SYNCED_SUCCESSFULLY', '100 HICH order synced successfully');

    const modendoRes = await processOfflineOrderSync(db, modendoPayload);
    assert(modendoRes.status === 'SYNCED_SUCCESSFULLY', 'Modendo order synced successfully');

    // Cross-tenant lookup boundary: HICH query cannot find Modendo order
    await db.transaction(async (tx) => {
      await tx.setTenantContext(HICH_TENANT);
      const crossFound = await tx.orders.findByClientId(HICH_TENANT, 'modendo-unique-uuid-002');
      assert(crossFound === null, 'HICH cannot find Modendo order by clientGeneratedId (zero leakage)');
      const modendoSelf = await tx.orders.findByClientId(MODENDO_TENANT, 'modendo-unique-uuid-002');
      assert(modendoSelf !== null, 'Modendo order found under MODENDO_TENANT parameter');
    });

    // Enforce transactional tenant mismatch fail-closed
    let mismatchCaught = false;
    try {
      await db.transaction(async (tx) => {
        await tx.setTenantContext(HICH_TENANT);
        // Attempting to run modendoPayload inside HICH locked transaction
        await processOfflineOrderSync(
          {
            transaction: async (cb) => cb(tx),
          },
          modendoPayload
        );
      });
    } catch (e: any) {
      mismatchCaught = true;
      assert(e.message.includes('Transactional tenant violation'), 'Mismatch throws Transactional tenant violation');
    }
    assert(mismatchCaught, 'Tenant mismatch inside transaction strictly caught');
  }

  // -------------------------------------------------------------------------
  // Suite 4: Batch Mutation Processing (processOfflineOrderBatchSync)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4: Batch Mutation Ingestion from Offline Queue]');
  {
    const db = new InMemoryDatabaseClient([
      { productId: 'item-tea', availableQuantity: 5, tenantId: MODENDO_TENANT },
    ]);

    const batch: SyncOrderPayload[] = [
      {
        tenantId: MODENDO_TENANT,
        clientGeneratedId: 'batch-order-001',
        source: 'POS',
        order: {
          items: [{ productId: 'item-tea', quantity: 2, name: 'Green Tea' }],
          totalNet: 50000,
          payments: [{ method: 'POS_TERMINAL', amount: 50000 }],
          createdAt: '2026-11-04T12:10:00Z',
        },
      },
      {
        tenantId: MODENDO_TENANT,
        clientGeneratedId: 'batch-order-002',
        source: 'POS',
        order: {
          items: [{ productId: 'item-tea', quantity: 2, name: 'Green Tea' }],
          totalNet: 50000,
          payments: [{ method: 'POS_TERMINAL', amount: 50000 }],
          createdAt: '2026-11-04T12:11:00Z',
        },
      },
      // Duplicate of batch-order-001 within the same batch stream
      {
        tenantId: MODENDO_TENANT,
        clientGeneratedId: 'batch-order-001',
        source: 'POS',
        order: {
          items: [{ productId: 'item-tea', quantity: 2, name: 'Green Tea' }],
          totalNet: 50000,
          payments: [{ method: 'POS_TERMINAL', amount: 50000 }],
          createdAt: '2026-11-04T12:10:00Z',
        },
      },
    ];

    const batchResult = await processOfflineOrderBatchSync(db, {
      tenantId: MODENDO_TENANT,
      mutations: batch,
    });

    assert(batchResult.success === true, 'Batch mutation returns success: true');
    assert(batchResult.totalProcessed === 3, 'Batch processed exactly 3 mutations');
    assert(batchResult.syncedCount === 2, 'Exactly 2 distinct orders newly synced');
    assert(batchResult.alreadySyncedCount === 1, 'Exactly 1 duplicate mutation flagged as already synced');
    assert(batchResult.results.length === 3, 'Batch contains 3 individual mutation results');
    assert(batchResult.results[2].isIdempotentReplay === true, 'Duplicate mutation result flags isIdempotentReplay: true');
  }

  // -------------------------------------------------------------------------
  // Suite 5: Inventory Stockout Overdraft Conflict Auditing
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5: Inventory Overdraft Conflict Handling]');
  {
    const db = new InMemoryDatabaseClient([
      { productId: 'rare-beans', availableQuantity: 1, tenantId: HICH_TENANT },
    ]);

    const overdraftPayload: SyncOrderPayload = {
      tenantId: HICH_TENANT,
      clientGeneratedId: 'overdraft-uuid-101',
      source: 'POS',
      order: {
        items: [{ productId: 'rare-beans', quantity: 3, name: 'Geisha Single Origin' }],
        totalNet: 300000,
        payments: [{ method: 'POS_TERMINAL', amount: 300000 }],
        createdAt: '2026-11-04T12:30:00Z',
      },
    };

    const res = await processOfflineOrderSync(db, overdraftPayload);
    assert(res.status === 'SYNCED_SUCCESSFULLY', 'Financial settlement succeeds despite inventory overdraft');
    assert(res.hasInventoryConflicts === true, 'hasInventoryConflicts is true');
    assert(Boolean(res.conflicts && res.conflicts.length === 1), 'Exactly 1 audit conflict incident recorded');
    assert(res.conflicts?.[0].details.deficit === 2, 'Recorded deficit is exactly 2 units (requested 3, available 1)');
    assert(res.conflicts?.[0].type === 'STOCKOUT_OVERDRAFT', 'Conflict type is STOCKOUT_OVERDRAFT');
    assert(db.auditLogsList.length === 1, 'Database auditLogsList records conflict for warehouse audit');
    assert(db.getStock('rare-beans', HICH_TENANT) === -2, 'Inventory safely overdrafted to -2 to preserve financial flow');
  }

  // -------------------------------------------------------------------------
  // Suite 6: Cross-Tenant Batch Mutation Fail-Closed Guard
  // -------------------------------------------------------------------------
  console.log('\n[Suite 6: Cross-Tenant Batch Mutation Fail-Closed Guard]');
  {
    const db = new InMemoryDatabaseClient();
    const poisonedBatch: SyncOrderPayload[] = [
      {
        tenantId: HICH_TENANT,
        clientGeneratedId: 'hich-mut-1',
        source: 'POS',
        order: { items: [], totalNet: 10000, payments: [], createdAt: '2026-11-04T12:00:00Z' },
      },
      {
        tenantId: MODENDO_TENANT, // Foreign tenant in batch
        clientGeneratedId: 'modendo-mut-cross',
        source: 'POS',
        order: { items: [], totalNet: 20000, payments: [], createdAt: '2026-11-04T12:00:00Z' },
      },
    ];

    let crossTenantCaught = false;
    try {
      await processOfflineOrderBatchSync(db, {
        tenantId: HICH_TENANT,
        mutations: poisonedBatch,
      });
    } catch (e: any) {
      crossTenantCaught = true;
      assert(e.message.includes('Cross-tenant batch mutation error'), 'Error specifies cross-tenant mutation detection');
    }
    assert(crossTenantCaught, 'Cross-tenant batch mutation strictly rejected fail-closed');
  }

  console.log('\n========================================');
  console.log(`Sync Idempotency & Batch Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled exception during sync idempotency tests:', err);
  process.exit(1);
});
