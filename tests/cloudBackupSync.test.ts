/**
 * CAFE OS — Cloud PostgreSQL Backup & Periodic Offline Queue Sync Test Suite
 * Verifies:
 * 1. Cloud connection health check and fallback handling
 * 2. Multi-tenant daily backup persistence and strict tenant isolation
 * 3. Daily backup payload integrity (integer Toman calculations, snapshot preservation)
 * 4. OfflineSyncQueue integration and scheduler reactivity
 */

import { cloudBackupDb, DailyBackupPayload } from '../src/services/cloudBackupDb';
import { dailyBackupScheduler } from '../src/services/dailyBackupScheduler';
import { OrderAggregate } from '../src/types/order-domain';

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
  console.log('\n--- Running Cloud PostgreSQL Backup & Periodic Sync Test Suite ---\n');

  const MODENDO_TENANT = 'tenant-modendo-01';
  const HICH_TENANT = 'tenant-100hich-01';

  // -------------------------------------------------------------
  // Suite 1: Cloud Connection Status & Resilient Fallback
  // -------------------------------------------------------------
  console.log('[Suite 1: Cloud Connection Status & Resilient Fallback]');
  const status = await cloudBackupDb.testConnection();
  assert(status !== null && status !== undefined, 'Connection test returns non-null status');
  assert(typeof status.connected === 'boolean', 'Status defines boolean connected flag');
  assert(
    status.provider === 'PostgreSQL-Cloud' || status.provider === 'In-Memory-Fallback',
    `Provider is either PostgreSQL-Cloud or In-Memory-Fallback (got: ${status.provider})`
  );

  // -------------------------------------------------------------
  // Suite 2: Multi-Tenant Daily Backup Persistence & Invariants
  // -------------------------------------------------------------
  console.log('\n[Suite 2: Multi-Tenant Daily Backup Persistence & Invariants]');
  const today = '2026-11-01';

  // 2a. Modendo Backup
  const modendoPayload: DailyBackupPayload = {
    tenantId: MODENDO_TENANT,
    backupDate: today,
    tenant: { id: MODENDO_TENANT, nameFa: 'کافه مودندو' },
    categories: [{ id: 'cat-1', nameFa: 'اسپرسو بار' }],
    menuItems: [{ id: 'item-1', nameFa: 'اسپرسو دوبل', priceToman: 45000 }],
    shifts: [{ id: 'shift-1', shiftNumber: 1, openingCashToman: 500000 }],
    orders: [
      {
        id: 'ord-m1',
        orderNumber: 101,
        status: 'COMPLETED',
        netTotalToman: 90000,
      },
    ],
    payments: [{ id: 'pay-m1', amountToman: 90000, method: 'POS_TERMINAL' }],
    expenses: [{ id: 'exp-m1', amountToman: 20000, title: 'شیر تازه' }],
    auditLogs: [{ id: 'log-m1', action: 'SHIFT_OPEN' }],
    metadata: {
      totalOrders: 1,
      totalRevenueToman: 90000,
      totalExpensesToman: 20000,
      exportedBy: 'مدیر مودندو',
    },
  };

  const modendoSaved = await cloudBackupDb.saveDailyBackup(modendoPayload);
  assert(Boolean(modendoSaved), 'Modendo daily backup saved successfully');
  assert(modendoSaved.tenantId === MODENDO_TENANT, 'Modendo backup tenantId matches tenant-modendo-01');
  assert(modendoSaved.totalOrders === 1, 'Modendo backup records exactly 1 order');
  assert(modendoSaved.totalRevenueToman === 90000, 'Modendo total revenue is exactly 90,000 Toman');
  assert(Number.isInteger(modendoSaved.totalRevenueToman), 'Modendo total revenue is strict integer Toman');

  // 2b. 100 Hich Backup
  const hichPayload: DailyBackupPayload = {
    tenantId: HICH_TENANT,
    backupDate: today,
    tenant: { id: HICH_TENANT, nameFa: 'کافه روستر ۱۰۰ هیچ' },
    categories: [{ id: 'cat-h1', nameFa: 'دمی و تخصصی' }],
    menuItems: [{ id: 'item-h1', nameFa: 'کمکس اتیوپی', priceToman: 85000 }],
    shifts: [{ id: 'shift-h1', shiftNumber: 1, openingCashToman: 1000000 }],
    orders: [
      {
        id: 'ord-h1',
        orderNumber: 201,
        status: 'COMPLETED',
        netTotalToman: 170000,
      },
    ],
    payments: [{ id: 'pay-h1', amountToman: 170000, method: 'CASH' }],
    expenses: [{ id: 'exp-h1', amountToman: 50000, title: 'فیلتر کاغذی' }],
    auditLogs: [{ id: 'log-h1', action: 'SHIFT_OPEN' }],
    metadata: {
      totalOrders: 1,
      totalRevenueToman: 170000,
      totalExpensesToman: 50000,
      exportedBy: 'مدیر ۱۰۰ هیچ',
    },
  };

  const hichSaved = await cloudBackupDb.saveDailyBackup(hichPayload);
  assert(Boolean(hichSaved), '100 Hich daily backup saved successfully');
  assert(hichSaved.tenantId === HICH_TENANT, '100 Hich backup tenantId matches tenant-100hich-01');
  assert(hichSaved.totalOrders === 1, '100 Hich backup records exactly 1 order');
  assert(hichSaved.totalRevenueToman === 170000, '100 Hich total revenue is exactly 170,000 Toman');
  assert(Number.isInteger(hichSaved.totalRevenueToman), '100 Hich total revenue is strict integer Toman');

  // -------------------------------------------------------------
  // Suite 3: Multi-Tenant Data Isolation in Daily Backups
  // -------------------------------------------------------------
  console.log('\n[Suite 3: Multi-Tenant Data Isolation in Daily Backups]');
  const modendoBackups = await cloudBackupDb.getDailyBackups(MODENDO_TENANT);
  assert(modendoBackups.length > 0, `Modendo has ${modendoBackups.length} backup records`);
  let modendoLeaked = false;
  modendoBackups.forEach((b) => {
    if ((b.tenantId || (b as any).tenant_id) !== MODENDO_TENANT) {
      modendoLeaked = true;
    }
  });
  assert(!modendoLeaked, 'Modendo query returns ONLY tenant-modendo-01 backups (zero leakage)');

  const hichBackups = await cloudBackupDb.getDailyBackups(HICH_TENANT);
  assert(hichBackups.length > 0, `100 Hich has ${hichBackups.length} backup records`);
  let hichLeaked = false;
  hichBackups.forEach((b) => {
    if ((b.tenantId || (b as any).tenant_id) !== HICH_TENANT) {
      hichLeaked = true;
    }
  });
  assert(!hichLeaked, '100 Hich query returns ONLY tenant-100hich-01 backups (zero leakage)');

  // -------------------------------------------------------------
  // Suite 4: Atomic Order Aggregate Sync & Idempotency
  // -------------------------------------------------------------
  console.log('\n[Suite 4: Atomic Order Aggregate Sync & Idempotency]');
  const dummyOrder: OrderAggregate = {
    id: 'cloud-test-ord-1',
    clientGeneratedId: 'idem-uuid-cloud-test-001',
    orderNumber: 888,
    tenantId: MODENDO_TENANT,
    state: 'PAID',
    orderType: 'DINE_IN',
    grossAmountToman: 110000,
    grossAmount: 110000,
    discountAmountToman: 0,
    discountAmount: 0,
    netTotalToman: 110000,
    totalNet: 110000,
    paidAmountToman: 110000,
    paidAmount: 110000,
    shiftId: 'shift-1',
    createdByUserId: 'usr-1',
    createdByUserName: 'صندوق‌دار',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-ag-1',
        menuItemId: 'item-1',
        itemNameSnapshot: 'لاته کلاسیک',
        quantity: 2,
        unitPriceSnapshotToman: 55000,
        modifiersDeltaToman: 0,
        modifiers: [],
        subtotalToman: 110000,
      },
    ],
    payments: [
      {
        id: 'pay-ag-1',
        orderId: 'cloud-test-ord-1',
        clientGeneratedId: 'pay-idem-001',
        tenantId: MODENDO_TENANT,
        shiftId: 'shift-1',
        receivedByUserId: 'usr-1',
        paymentMethod: 'POS_TERMINAL',
        amountToman: 110000,
        status: 'SUCCESSFUL',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const result1 = await cloudBackupDb.syncOrderAggregate(MODENDO_TENANT, dummyOrder);
  assert(result1.success === true, 'First order sync succeeds');
  assert(result1.orderNumber === 888, 'First order sync returns correct orderNumber 888');

  const result2 = await cloudBackupDb.syncOrderAggregate(MODENDO_TENANT, dummyOrder);
  assert(result2.success === true, 'Idempotent replay sync succeeds without error');
  assert(result2.isIdempotentReplay === true, 'Second sync correctly flags isIdempotentReplay = true');

  // -------------------------------------------------------------
  // Suite 5: Daily Backup Scheduler Subscription & State
  // -------------------------------------------------------------
  console.log('\n[Suite 5: Daily Backup Scheduler Subscription & State]');
  let capturedStatus: any = null;
  const unsub = dailyBackupScheduler.subscribe((status) => {
    capturedStatus = status;
  });

  assert(Boolean(capturedStatus), 'Scheduler listener called on subscription');
  assert(typeof capturedStatus.isCloudConnected === 'boolean', 'Scheduler status has isCloudConnected');
  assert(typeof capturedStatus.isSyncing === 'boolean', 'Scheduler status has isSyncing');
  assert(Boolean(capturedStatus.queueStats), 'Scheduler status includes queueStats');
  unsub();

  console.log('\n========================================');
  console.log(`Cloud Backup & Sync Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled exception during cloud backup tests:', err);
  process.exit(1);
});
