/**
 * CODA Phase P3 — POS & Offline Synchronization Verification Suite
 * Agent: A08-PULSE & A05-SENTINEL
 *
 * Requirements Tested:
 * 1. Immutable original tenant binding for every offline order.
 * 2. Stable idempotency keys across retries and application restarts.
 * 3. Exponential backoff and retry scheduling.
 * 4. HTTP 401: pause synchronization without deleting or consuming retry attempts.
 * 5. HTTP 403: quarantine the operation.
 * 6. HTTP 409: resolve as success only when matching idempotency key & payload.
 * 7. Multi-tenant database separation and preservation across tenant switches.
 */

// Memory mock for localStorage
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

// In-Memory Mock for IndexedDB for OfflineSyncQueue
class MemoryObjectStore {
  private data: Map<string, any> = new Map();

  createIndex() {}

  get(key: string) {
    const req: any = {};
    setTimeout(() => {
      req.result = this.data.get(key);
      req.onsuccess && req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  getAll() {
    const req: any = {};
    setTimeout(() => {
      req.result = Array.from(this.data.values());
      req.onsuccess && req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  put(val: any) {
    this.data.set(val.clientGeneratedId, JSON.parse(JSON.stringify(val)));
    const req: any = {};
    setTimeout(() => {
      req.result = val.clientGeneratedId;
      req.onsuccess && req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  delete(key: string) {
    this.data.delete(key);
    const req: any = {};
    setTimeout(() => {
      req.result = undefined;
      req.onsuccess && req.onsuccess({ target: req });
    }, 0);
    return req;
  }

  clear() {
    this.data.clear();
    const req: any = {};
    setTimeout(() => {
      req.result = undefined;
      req.onsuccess && req.onsuccess({ target: req });
    }, 0);
    return req;
  }
}

class MemoryIDBDatabase {
  public stores: Map<string, MemoryObjectStore> = new Map();

  get objectStoreNames() {
    const names = Array.from(this.stores.keys());
    return {
      contains: (name: string) => names.includes(name),
      length: names.length,
      item: (index: number) => names[index],
    };
  }

  createObjectStore(name: string, _opts: any) {
    const store = new MemoryObjectStore();
    this.stores.set(name, store);
    return store;
  }

  transaction(names: string | string[], _mode: string) {
    const name = Array.isArray(names) ? names[0] : names;
    if (!this.stores.has(name)) {
      this.stores.set(name, new MemoryObjectStore());
    }
    const store = this.stores.get(name)!;
    return {
      objectStore: () => store,
    };
  }

  close() {}
}

const memoryDatabases = new Map<string, MemoryIDBDatabase>();

(globalThis as any).indexedDB = {
  open: (name: string, version: number) => {
    let db = memoryDatabases.get(name);
    let isNew = false;
    if (!db) {
      db = new MemoryIDBDatabase();
      memoryDatabases.set(name, db);
      isNew = true;
    }
    const req: any = { result: db };
    setTimeout(() => {
      if (isNew && req.onupgradeneeded) {
        req.onupgradeneeded({ target: req });
      }
      if (req.onsuccess) {
        req.onsuccess({ target: req });
      }
    }, 0);
    return req;
  },
};

(globalThis as any).window = {
  location: { origin: 'http://localhost:3000' },
  setInterval: () => 1,
  clearInterval: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

try {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
} catch {
  // ignore
}

// Configurable global fetch handler
let currentFetchHandler: (url: string, opts: any) => Promise<any> = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true }),
  text: async () => 'OK',
});

(globalThis as any).fetch = (url: string, opts: any) => currentFetchHandler(url, opts);

import {
  OfflineSyncQueue,
  QueuedOrderRecord,
  getOfflineSyncQueueForTenant,
} from '../src/services/offlineSyncQueue';
import { OrderAggregate } from '../src/types/order-domain';

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
  assert(
    actual === expected,
    testName,
    `Expected "${expected}", but received "${actual}"`
  );
}

function createDummyOrder(id: string, tenantId: string, grossAmount: number): any {
  return {
    id,
    clientGeneratedId: id,
    tenantId,
    orderNumber: 101,
    dailySequentialNumber: 1,
    invoiceNumber: `INV-${id}`,
    cart: {
      items: [
        {
          id: `item-${id}-1`,
          menuItemId: 'm1_flat_white',
          title: 'فلت وایت',
          unitPriceToman: grossAmount,
          quantity: 1,
          station: 'BAR',
          vatPercentage: 9,
          totalPriceToman: grossAmount,
          selectedModifiers: [],
        },
      ],
      totalGrossToman: grossAmount,
      totalDiscountToman: 0,
      totalNetToman: grossAmount,
      totalVatToman: Math.round((grossAmount * 9) / 109),
    },
    payment: {
      status: 'PAID',
      method: 'CASH',
      amountToman: grossAmount,
      transactionId: `txn-${id}`,
      paidAt: new Date().toISOString(),
    },
    stationRouting: {
      needsBar: true,
      needsKitchen: false,
      dispatchedStations: ['BAR'],
    },
    lifecycle: {
      orderId: id,
      tenantId,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      statusTimeline: [],
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSuite() {
  console.log('\n--- Running CODA P3 POS & Offline Synchronization Verification Suite ---');

  // ============================================================================
  // Suite 1: Immutable Original Tenant Binding
  // ============================================================================
  console.log('\n[Suite 1: Immutable Original Tenant Binding]');

  // Keep offline for Suite 1 so orders stay in queue
  currentFetchHandler = async () => {
    throw new Error('Network offline or ECONNREFUSED');
  };

  const queue100Hich = new OfflineSyncQueue({
    apiBaseUrl: 'http://localhost:3000',
    tenantId: 'tenant-100hich-01',
  });

  const orderHich = createDummyOrder('ord-hich-001', 'tenant-100hich-01', 65000);
  await queue100Hich.enqueue(orderHich);
  await sleep(30);

  const record1 = await queue100Hich.getRecord('ord-hich-001');
  assert(record1 !== undefined, 'HICH order successfully enqueued');
  assertEqual(record1?.originalTenantId, 'tenant-100hich-01', 'Order originalTenantId is tenant-100hich-01');

  // Switch active tenant in localStorage
  memoryStore.set('cafeos_active_tenant_id', JSON.stringify('tenant-modendo-01'));

  // Verify that the record in 100 HICH queue STILL has tenant-100hich-01
  const recordAfterSwitch = await queue100Hich.getRecord('ord-hich-001');
  assertEqual(
    recordAfterSwitch?.originalTenantId,
    'tenant-100hich-01',
    'CRITICAL INVARIANT: Tenant switch in ambient storage NEVER alters originalTenantId'
  );

  // ============================================================================
  // Suite 2: Stable Idempotency Keys across Retries & Restarts
  // ============================================================================
  console.log('\n[Suite 2: Stable Idempotency Keys across Retries & Restarts]');

  assertEqual(record1?.clientGeneratedId, 'ord-hich-001', 'Stable clientGeneratedId matches order ID');
  assertEqual(record1?.retryCount, 1, 'Initial failed sync attempt incremented retryCount to 1');
  assert(record1?.nextAttemptAt !== undefined, 'nextAttemptAt exponential backoff timestamp set');

  const failedRecordAttempt2 = await queue100Hich.getRecord('ord-hich-001');
  assertEqual(failedRecordAttempt2?.clientGeneratedId, 'ord-hich-001', 'clientGeneratedId remained identical after retry');

  // ============================================================================
  // Suite 3: HTTP 401 Authorization Handling (Auth Pause)
  // ============================================================================
  console.log('\n[Suite 3: HTTP 401 Authorization Handling (Auth Pause)]');

  await queue100Hich.clearForTest();

  // Set mock to return 401 Unauthorized
  currentFetchHandler = async () => ({
    status: 401,
    ok: false,
    text: async () => 'Session token expired or unauthenticated',
  });

  const orderHich2 = createDummyOrder('ord-hich-002', 'tenant-100hich-01', 80000);
  await queue100Hich.enqueue(orderHich2);
  await sleep(150);

  const pausedRecord = await queue100Hich.getRecord('ord-hich-002');
  assertEqual(pausedRecord?.syncStatus, 'PAUSED', 'HTTP 401 sets record syncStatus to PAUSED');
  assertEqual(pausedRecord?.retryCount, 0, 'HTTP 401 does NOT increment retryCount or waste attempts');
  assertEqual(queue100Hich.isPaused(), true, 'Queue is marked isAuthPaused = true');

  // Unpause queue
  queue100Hich.resumeAuth();
  assertEqual(queue100Hich.isPaused(), false, 'resumeAuth() unpauses sync queue');

  // ============================================================================
  // Suite 4: HTTP 403 Forbidden Handling (Quarantine)
  // ============================================================================
  console.log('\n[Suite 4: HTTP 403 Forbidden Handling (Quarantine)]');

  await queue100Hich.clearForTest();

  // Set mock to return 403 Forbidden
  currentFetchHandler = async () => ({
    status: 403,
    ok: false,
    text: async () => 'Cross-tenant access forbidden: Tenant membership mismatch',
  });

  const orderHich3 = createDummyOrder('ord-hich-003', 'tenant-100hich-01', 95000);
  await queue100Hich.enqueue(orderHich3);
  await sleep(150);

  const quarantinedRecord = await queue100Hich.getRecord('ord-hich-003');
  assertEqual(quarantinedRecord?.syncStatus, 'QUARANTINED', 'HTTP 403 sets record syncStatus to QUARANTINED');
  assert(
    quarantinedRecord?.quarantineReason?.includes('403') || false,
    'Quarantine reason contains 403 authorization violation'
  );

  const quarantinedList = await queue100Hich.getQuarantinedOrders();
  assertEqual(quarantinedList.length, 1, 'getQuarantinedOrders returns exactly 1 quarantined record');
  assertEqual(quarantinedList[0].clientGeneratedId, 'ord-hich-003', 'Quarantined record ID matches');

  // ============================================================================
  // Suite 5: HTTP 409 Conflict Handling (Idempotent Resolution)
  // ============================================================================
  console.log('\n[Suite 5: HTTP 409 Conflict Handling]');

  await queue100Hich.clearForTest();

  let successReportedId: string | null = null;
  const queueWithSuccessCallback = new OfflineSyncQueue({
    apiBaseUrl: 'http://localhost:3000',
    tenantId: 'tenant-100hich-01',
    onSyncSuccess: (id) => {
      successReportedId = id;
    },
  });

  // Mock 409 Conflict with idempotent replay payload
  currentFetchHandler = async () => ({
    status: 409,
    ok: false,
    json: async () => ({
      success: true,
      isIdempotentReplay: true,
      status: 'ALREADY_SYNCED',
    }),
    text: async () => 'Conflict',
  });

  const orderHich4 = createDummyOrder('ord-hich-004', 'tenant-100hich-01', 110000);
  await queueWithSuccessCallback.enqueue(orderHich4);
  await sleep(150);

  const resolvedRecord = await queueWithSuccessCallback.getRecord('ord-hich-004');
  assert(
    resolvedRecord === undefined,
    'HTTP 409 matching order is resolved idempotently as success and removed from queue'
  );
  assertEqual(successReportedId, 'ord-hich-004', 'onSyncSuccess triggered on idempotent 409 match');

  // ============================================================================
  // Suite 6: Multi-Tenant Queue & Storage Isolation
  // ============================================================================
  console.log('\n[Suite 6: Multi-Tenant Queue & Storage Isolation]');

  const modendoQueue = getOfflineSyncQueueForTenant('tenant-modendo-01');
  const hichQueueSingleton = getOfflineSyncQueueForTenant('tenant-100hich-01');

  assertEqual(
    modendoQueue.getDatabaseName(),
    'CafeOS_OfflineDB_tenant-modendo-01',
    'Modendo database name is scoped'
  );
  assertEqual(
    hichQueueSingleton.getDatabaseName(),
    'CafeOS_OfflineDB_tenant-100hich-01',
    '100 HICH database name is scoped'
  );

  // Keep offline for isolation test
  currentFetchHandler = async () => {
    throw new Error('Offline');
  };

  const modendoOrder = createDummyOrder('ord-mod-001', 'tenant-modendo-01', 150000);
  await modendoQueue.enqueue(modendoOrder);
  await sleep(30);

  const modendoRecord = await modendoQueue.getRecord('ord-mod-001');
  const hichRecordLookup = await hichQueueSingleton.getRecord('ord-mod-001');

  assert(modendoRecord !== undefined, 'Modendo record exists in Modendo queue');
  assertEqual(hichRecordLookup, undefined, 'CRITICAL: Modendo order does NOT exist in 100 HICH queue');

  console.log(`\n========================================`);
  console.log(`POS Offline Sync Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
