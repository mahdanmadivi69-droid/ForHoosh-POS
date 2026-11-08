/**
 * tests/remoteCommandSync.test.ts
 * 
 * Verification suite for RemoteCommandSync client (Phase 2 Stage A)
 * Enforces:
 *  - [TENANT_ISOLATION_MANDATORY]: Strict tenant isolation in DB and polling
 *  - [INTEGER_TOMAN_PRECISION]: Integer-only price updates, fractional values rejected
 *  - [NO_DESTRUCTIVE_DDL]: Transactional atomic updates to Dexie tables
 */

// Mock localStorage for Node test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

import {
  RemoteCommandSync,
  RemoteCommand,
  RemoteCommandPullResponse,
} from '../src/services/RemoteCommandSync';
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

async function runTests() {
  console.log('\n--- Running RemoteCommandSync Test Suite (Phase 2 Stage A) ---\n');

  // Test 1: Construction & Tenant Guard
  console.log('[Suite 1: Construction & Multi-Tenant Guard]');
  {
    let threw = false;
    try {
      new RemoteCommandSync({ tenantId: '' });
    } catch {
      threw = true;
    }
    assert(threw, 'Rejects empty tenantId to protect tenant isolation');

    const sync100 = new RemoteCommandSync({
      tenantId: '100hich',
      baseUrl: 'http://localhost:4000/',
      pollIntervalMs: 200_000,
    });
    const status100 = sync100.getStatus();
    assert(status100.tenantId === '100hich', 'Initializes with correct tenantId');
    assert(status100.lastAppliedSeq === 0, 'Initial sequence starts at 0');
    assert(!status100.isRunning, 'Not running until start() called');
  }

  // Test 2: Sequence Isolation between Tenants
  console.log('\n[Suite 2: Storage Key Isolation between Tenants]');
  {
    localStorage.setItem('cafeos_last_cmd_seq_100hich', '42');
    localStorage.setItem('cafeos_last_cmd_seq_modendo', '108');

    const sync100 = new RemoteCommandSync({ tenantId: '100hich' });
    const syncModendo = new RemoteCommandSync({ tenantId: 'modendo' });

    assert(sync100.getStatus().lastAppliedSeq === 42, 'Loads tenant-scoped sequence for 100hich (42)');
    assert(syncModendo.getStatus().lastAppliedSeq === 108, 'Loads tenant-scoped sequence for modendo (108)');
  }

  // Test 3: Polling with Mock Fetch & Tenant Filtering
  console.log('\n[Suite 3: Polling & Cross-Tenant Command Filtering]');
  {
    const mockDb100 = getCafeDatabase('tenant-test-100');
    const mockMenuItems = new Map<string, any>();
    const mockAuditLogs: any[] = [];

    mockMenuItems.set('item-latte-01', {
      id: 'item-latte-01',
      title: 'Espresso Single',
      categoryId: 'coffee',
      price: 65000,
      isAvailable: true,
      recipe: [],
    });

    mockDb100.transaction = (async (_mode: string, _tables: any[], cb: () => Promise<any>) => {
      return await cb();
    }) as any;

    mockDb100.menuItems = {
      get: async (id: string) => mockMenuItems.get(id),
      put: async (item: any) => { mockMenuItems.set(item.id, item); },
      update: async (id: string, changes: any) => {
        const item = mockMenuItems.get(id);
        if (item) Object.assign(item, changes);
      },
      clear: async () => mockMenuItems.clear(),
    } as any;

    mockDb100.auditLogs = {
      add: async (log: any) => { mockAuditLogs.push(log); return log.id; },
      count: async () => mockAuditLogs.length,
      clear: async () => { mockAuditLogs.length = 0; },
    } as any;

    const mockCommands: RemoteCommand[] = [
      {
        commandId: 'cmd-01',
        tenantId: 'tenant-test-100',
        seq: 1,
        type: 'UPDATE_PRICE',
        payload: {
          productId: 'item-latte-01',
          newPriceToman: 75000,
          reason: 'Global bean price adjustment',
        },
        issuedAt: Date.now(),
      },
      {
        commandId: 'cmd-02',
        tenantId: 'tenant-test-MODENDO', // Foreign tenant
        seq: 2,
        type: 'UPDATE_PRICE',
        payload: {
          productId: 'item-latte-01',
          newPriceToman: 99999,
        },
        issuedAt: Date.now(),
      },
      {
        commandId: 'cmd-03',
        tenantId: 'tenant-test-100',
        seq: 3,
        type: 'TOGGLE_STOCK',
        payload: {
          productId: 'item-latte-01',
          inStock: false,
          reason: 'Milk shortage',
        },
        issuedAt: Date.now(),
      },
    ];

    const mockFetch = async () => {
      const resp: RemoteCommandPullResponse = {
        success: true,
        tenantId: 'tenant-test-100',
        latestSeq: 3,
        commands: mockCommands,
        serverTime: Date.now(),
      };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => resp,
      } as any;
    };

    const syncTest = new RemoteCommandSync({
      tenantId: 'tenant-test-100',
      baseUrl: 'http://test.local',
    });

    const pulled = await syncTest.pollOnce(mockFetch as any);
    assert(pulled.length === 2, 'Filtered out foreign tenant command (only 2 commands pulled)');
    assert(pulled[0].commandId === 'cmd-01', 'First command matches cmd-01');
    assert(pulled[1].commandId === 'cmd-03', 'Second command matches cmd-03');

    // Verify DB mutations
    const updatedItem = await mockDb100.menuItems.get('item-latte-01');
    assert(updatedItem !== undefined, 'Item exists in DB');
    assert(updatedItem?.price === 75000, 'Price updated to 75000 Toman');
    assert(updatedItem?.isAvailable === false, 'Stock availability toggled to false');

    // Verify audit logs
    const auditCount = await mockDb100.auditLogs.count();
    assert(auditCount === 2, 'Audit logs recorded for both atomic operations');
    assert(syncTest.getStatus().lastAppliedSeq === 3, 'Sequence advanced to 3');
  }

  // Test 4: Financial Invariant Enforcement (Integer Toman Precision)
  console.log('\n[Suite 4: Financial Invariant Enforcement]');
  {
    const mockDbFin = getCafeDatabase('tenant-financial-test');
    const mockMenuItems = new Map<string, any>();
    const mockAuditLogs: any[] = [];

    mockMenuItems.set('item-cappuccino', {
      id: 'item-cappuccino',
      title: 'Cappuccino',
      categoryId: 'coffee',
      price: 80000,
      isAvailable: true,
      recipe: [],
    });

    mockDbFin.transaction = (async (_mode: string, _tables: any[], cb: () => Promise<any>) => {
      // Snapshot state for rollback simulation
      const snapshot = new Map(mockMenuItems);
      try {
        return await cb();
      } catch (e) {
        mockMenuItems.clear();
        for (const [k, v] of snapshot.entries()) {
          mockMenuItems.set(k, { ...v });
        }
        throw e;
      }
    }) as any;

    mockDbFin.menuItems = {
      get: async (id: string) => mockMenuItems.get(id),
      put: async (item: any) => { mockMenuItems.set(item.id, item); },
      update: async (id: string, changes: any) => {
        const item = mockMenuItems.get(id);
        if (item) Object.assign(item, changes);
      },
    } as any;

    mockDbFin.auditLogs = {
      add: async (log: any) => { mockAuditLogs.push(log); return log.id; },
      count: async () => mockAuditLogs.length,
    } as any;

    const syncFinancial = new RemoteCommandSync({
      tenantId: 'tenant-financial-test',
    });

    // Test float price rejection (e.g., 85000.75)
    let floatErrorCaught = false;
    try {
      await syncFinancial.applyCommands([
        {
          commandId: 'cmd-invalid-float',
          tenantId: 'tenant-financial-test',
          seq: 10,
          type: 'UPDATE_PRICE',
          payload: {
            productId: 'item-cappuccino',
            newPriceToman: 85000.75, // VIOLATION
          },
          issuedAt: Date.now(),
        },
      ]);
    } catch (err: any) {
      floatErrorCaught = err.message.includes('Financial Invariant Violation');
    }
    assert(floatErrorCaught, 'Rejects float decimal prices (e.g. 85000.75 Toman)');

    // Ensure price remains unchanged after rolled-back transaction
    const unchangedItem = await mockDbFin.menuItems.get('item-cappuccino');
    assert(unchangedItem?.price === 80000, 'Original price 80000 Toman preserved due to atomic rollback');

    // Test negative price rejection
    let negativeErrorCaught = false;
    try {
      await syncFinancial.applyCommands([
        {
          commandId: 'cmd-invalid-neg',
          tenantId: 'tenant-financial-test',
          seq: 11,
          type: 'UPDATE_PRICE',
          payload: {
            productId: 'item-cappuccino',
            newPriceToman: -5000, // VIOLATION
          },
          issuedAt: Date.now(),
        },
      ]);
    } catch (err: any) {
      negativeErrorCaught = err.message.includes('Financial Invariant Violation');
    }
    assert(negativeErrorCaught, 'Rejects negative prices (e.g. -5000 Toman)');
  }

  console.log(`\n========================================`);
  console.log(`RemoteCommandSync Suite Result: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
