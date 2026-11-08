/**
 * tests/phase2E2eSmoke.test.ts
 * 
 * KarWand CafeOS / SmartOrders Phase 2 Stage B
 * End-to-End Integration Smoke Test
 * 
 * Verifies complete operational cycle:
 * 1. Spins up a live local HTTP server hosting CloudTelemetryService + CloudTelemetryRoutes.
 * 2. Seeds tenant database for 'modendo' with initial menu item (e.g. Latte @ 70,000 Toman).
 * 3. Dispatches simulated UPDATE_PRICE command via HTTP POST /api/v1/commands/push (Latte -> 95,000 Toman).
 * 4. Triggers RemoteCommandSync live pull loop via HTTP GET /api/v1/sync/pull.
 * 5. Verifies atomic Dexie mutation:
 *    - Price updated to 95,000 Toman.
 *    - Audit log entry recorded with CLOUD_DISPATCHER action and Toman delta.
 *    - Sequence counter advances in tenant-scoped storage.
 * 6. Verifies Financial Invariant Protection:
 *    - Attempting decimal price (e.g. 95000.5) is rejected with HTTP 400 Bad Request.
 *    - Local database remains untouched (atomic invariant).
 * 7. Verifies Cross-Tenant Isolation:
 *    - 100 HICH database is completely unmutated.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

// Mock localStorage for Node test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

// Mock window for CustomEvent dispatching
const customEvents: any[] = [];
(globalThis as any).window = {
  dispatchEvent: (event: any) => {
    customEvents.push(event);
    return true;
  },
};
(globalThis as any).CustomEvent = class {
  type: string;
  detail: any;
  constructor(type: string, params: any) {
    this.type = type;
    this.detail = params?.detail;
  }
};

import { CloudTelemetryService } from '../server/cloudTelemetryService';
import { handleNativeHttpRequest } from '../server/cloudTelemetryRoutes';
import { RemoteCommandSync } from '../src/services/RemoteCommandSync';
import { getCafeDatabase } from '../src/db/cafeDb';

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

async function runE2ESmokeTest() {
  console.log('\n--- Running KarWand Phase 2 Stage B: E2E Integration Smoke Test ---\n');

  const testTmpDir = path.resolve(process.cwd(), '.test_e2e_smoke_tmp');
  if (fs.existsSync(testTmpDir)) {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
  }

  // 1. Initialize local CloudTelemetryService instance
  const telemetryService = new CloudTelemetryService({
    storageDir: testTmpDir,
    jwtSecret: 'e2e_smoke_secret_2026',
  });

  // 2. Spin up live HTTP server
  const server = http.createServer((req, res) => {
    handleNativeHttpRequest(req, res, telemetryService);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`  [Setup] Local CloudTelemetryService active at: ${baseUrl}`);

  try {
    // 3. Setup Mock Dexie stores for tenant 'modendo' and tenant '100hich'
    console.log('\n[Suite 1: Tenant Database Setup & Initial Seeding]');
    const modendoDb = getCafeDatabase('modendo');
    const hichDb = getCafeDatabase('100hich');

    const modendoMenuItems = new Map<string, any>();
    const modendoAuditLogs: any[] = [];
    const hichMenuItems = new Map<string, any>();
    const hichAuditLogs: any[] = [];

    // Seed Modendo item: Latte @ 70,000 Toman
    modendoMenuItems.set('item-latte-01', {
      id: 'item-latte-01',
      title: 'Modendo Caffe Latte',
      categoryId: 'coffee',
      price: 70000,
      isAvailable: true,
      recipe: [{ ingredientId: 'milk-01', amount: 200 }],
    });

    // Seed 100 HICH item: Latte @ 80,000 Toman
    hichMenuItems.set('item-latte-01', {
      id: 'item-latte-01',
      title: '100 HICH Specialty Latte',
      categoryId: 'coffee',
      price: 80000,
      isAvailable: true,
      recipe: [{ ingredientId: 'specialty-milk', amount: 220 }],
    });

    // Wire transactional mock for Modendo
    modendoDb.transaction = (async (_mode: string, _tables: any[], cb: () => Promise<any>) => {
      // Snapshot before transaction
      const snapshotMenu = new Map(JSON.parse(JSON.stringify(Array.from(modendoMenuItems.entries()))));
      const snapshotAudit = [...modendoAuditLogs];
      try {
        return await cb();
      } catch (e) {
        // Rollback
        modendoMenuItems.clear();
        for (const [k, v] of snapshotMenu) modendoMenuItems.set(k, v);
        modendoAuditLogs.length = 0;
        modendoAuditLogs.push(...snapshotAudit);
        throw e;
      }
    }) as any;

    modendoDb.menuItems = {
      get: async (id: string) => modendoMenuItems.get(id),
      put: async (item: any) => { modendoMenuItems.set(item.id, item); },
      update: async (id: string, changes: any) => {
        const item = modendoMenuItems.get(id);
        if (item) Object.assign(item, changes);
      },
      clear: async () => modendoMenuItems.clear(),
    } as any;

    modendoDb.auditLogs = {
      add: async (log: any) => { modendoAuditLogs.push(log); return log.id; },
      count: async () => modendoAuditLogs.length,
      clear: async () => { modendoAuditLogs.length = 0; },
    } as any;

    // Wire transactional mock for 100 HICH
    hichDb.transaction = (async (_mode: string, _tables: any[], cb: () => Promise<any>) => {
      return await cb();
    }) as any;
    hichDb.menuItems = {
      get: async (id: string) => hichMenuItems.get(id),
      put: async (item: any) => { hichMenuItems.set(item.id, item); },
      update: async (id: string, changes: any) => {
        const item = hichMenuItems.get(id);
        if (item) Object.assign(item, changes);
      },
    } as any;
    hichDb.auditLogs = {
      add: async (log: any) => { hichAuditLogs.push(log); return log.id; },
    } as any;

    assert((await modendoDb.menuItems.get('item-latte-01')).price === 70000, 'Initial Modendo Latte price is 70,000 Toman');
    assert((await hichDb.menuItems.get('item-latte-01')).price === 80000, 'Initial 100 HICH Latte price is 80,000 Toman');

    // 4. Dispatch simulated command to server via HTTP POST /api/v1/commands/push
    console.log('\n[Suite 2: Remote Command Dispatch via HTTP API]');
    const pushRes = await fetch(`${baseUrl}/api/v1/commands/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'modendo',
        type: 'UPDATE_PRICE',
        payload: {
          productId: 'item-latte-01',
          newPriceToman: 95000,
          reason: 'CEO Sign-Off E2E Smoke Test Adjustment',
        },
      }),
    });

    assert(pushRes.status === 201 || pushRes.status === 200, 'HTTP POST /api/v1/commands/push returned 201 Created');
    const pushJson: any = await pushRes.json();
    assert(pushJson.success === true, 'Command pushed successfully to queue');
    assert(pushJson.command.seq === 1, 'Command assigned sequence 1 for tenant modendo');
    assert(pushJson.command.payload.newPriceToman === 95000, 'Command payload contains 95,000 Toman');

    // 5. Trigger RemoteCommandSync pull loop for Modendo
    console.log('\n[Suite 3: Client Pull Loop & Atomic Dexie Mutation]');
    const modendoSync = new RemoteCommandSync({
      tenantId: 'modendo',
      baseUrl,
      terminalId: 'MODENDO_POS_PRIMARY',
    });

    const pulledCommands = await modendoSync.pollOnce();
    assert(pulledCommands.length === 1, 'RemoteCommandSync pulled exactly 1 command for Modendo');
    assert(pulledCommands[0].payload.newPriceToman === 95000, 'Pulled command specifies new price 95,000 Toman');

    // 6. Verify Dexie mutations in Modendo database
    const updatedLatte = await modendoDb.menuItems.get('item-latte-01');
    assert(updatedLatte.price === 95000, 'CRITICAL: Modendo Latte price atomically updated to 95,000 Toman');

    assert(modendoAuditLogs.length === 1, 'Audit log recorded for atomic price update');
    const audit = modendoAuditLogs[0];
    assert(audit.action === 'edit_items', 'Audit action is edit_items');
    assert(audit.userId === 'CLOUD_DISPATCHER', 'Audit user ID is CLOUD_DISPATCHER');
    assert(audit.details.includes('70000 Toman to 95000 Toman'), 'Audit details track 70,000 -> 95,000 Toman transition');

    // Verify stored sequence in localStorage
    const savedSeq = localStorage.getItem('cafeos_last_cmd_seq_modendo');
    assert(savedSeq === '1', 'Modendo sequence advanced to 1 in local storage');

    // 7. Cross-Tenant Isolation Verification
    console.log('\n[Suite 4: Cross-Tenant Isolation Verification]');
    const hichLatte = await hichDb.menuItems.get('item-latte-01');
    assert(hichLatte.price === 80000, 'CRITICAL: 100 HICH Latte price untouched (still 80,000 Toman)');
    assert(hichAuditLogs.length === 0, '100 HICH audit logs completely empty');

    // Verify pulling for 100 HICH returns 0 commands
    const hichSync = new RemoteCommandSync({
      tenantId: '100hich',
      baseUrl,
      terminalId: 'HICH_BARISTA_01',
    });
    const hichPulled = await hichSync.pollOnce();
    assert(hichPulled.length === 0, '100 HICH pull loop returns 0 commands (zero cross-tenant leakage)');

    // 8. Financial Invariant Rejection at Server and Client
    console.log('\n[Suite 5: Financial Invariant Protection (Integer Toman)]');
    const floatPushRes = await fetch(`${baseUrl}/api/v1/commands/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'modendo',
        type: 'UPDATE_PRICE',
        payload: {
          productId: 'item-latte-01',
          newPriceToman: 95000.5, // VIOLATION
        },
      }),
    });
    assert(floatPushRes.status === 400, 'Server rejects float price 95000.5 with HTTP 400 Bad Request');
    const floatJson: any = await floatPushRes.json();
    assert(floatJson.error.includes('Financial Invariant Violation'), 'Server returned invariant violation error message');

    // Final state of Modendo Latte remains 95000
    const finalLatte = await modendoDb.menuItems.get('item-latte-01');
    assert(finalLatte.price === 95000, 'Modendo Latte price remained intact at 95,000 Toman');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 2 E2E Smoke Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ESmokeTest().catch((err) => {
  console.error('Unhandled error in E2E smoke test:', err);
  process.exit(1);
});
