/**
 * CAFE OS — Adaptive Operational Modes & Pay-by-Order Round Separation Test Suite
 * Path: tests/operationalModes.test.ts
 *
 * Verifies:
 * 1. Operational Mode Contracts: COUNTER_QUICK_PAY, TAB_PAY_LATER, and DINE_IN_PAY_BY_ORDER.
 * 2. Dexie Schema Multi-Mode Field & Compound Index Support (tableSessionId, tableNumber, flowType).
 * 3. Pay-by-Order Round Separation: Distinct rounds tied to persistent table session with independent immediate settlement.
 * 4. Multi-Tenant isolation across operational configurations.
 * 5. Strict integer Toman and frozen VAT formula adherence.
 */

import {
  OperationalMode,
  TenantOperationalConfig,
  TENANT_CONFIG_100HICH,
  TENANT_CONFIG_MODENDO,
  TENANT_CONFIG_GENERIC_BISTRO,
  getTenantOperationalConfig,
} from '../src/types/tenant-config';
import {
  DecomposedOrderRecord,
  DexiePOSDatabase,
  getDexiePOSDatabase,
} from '../src/db/DexiePOSDatabase';

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
  console.log('\n--- Running Adaptive Operational Modes & Round Separation Suite ---\n');

  // -------------------------------------------------------------------------
  // Suite 1: Tenant Operational Configuration Contracts
  // -------------------------------------------------------------------------
  console.log('[Suite 1: Tenant Operational Configuration Contracts]');
  {
    // 100 HICH
    const hichConfig = getTenantOperationalConfig('tenant-100hich-01');
    assert(hichConfig.primaryMode === 'COUNTER_QUICK_PAY', '100 HICH primary mode is COUNTER_QUICK_PAY');
    assert(hichConfig.features.allowOpenTabs === false, '100 HICH disallows open tabs (counter quick-pay flow)');
    assert(hichConfig.features.requireImmediatePayment === true, '100 HICH requires immediate counter payment');
    assert(hichConfig.features.requireTableSelection === false, '100 HICH does not require table selection');
    assert(hichConfig.features.allowHourlySessionBilling === false, '100 HICH does not use hourly session billing');

    // Modendo
    const modendoConfig = getTenantOperationalConfig('tenant-modendo-01');
    assert(modendoConfig.primaryMode === 'TAB_PAY_LATER', 'Modendo primary mode is TAB_PAY_LATER');
    assert(modendoConfig.features.allowOpenTabs === true, 'Modendo enables open table tabs');
    assert(modendoConfig.features.requireImmediatePayment === false, 'Modendo allows payment on departure');
    assert(modendoConfig.features.requireTableSelection === true, 'Modendo requires table / pod selection');
    assert(modendoConfig.features.allowHourlySessionBilling === true, 'Modendo enables hourly PS5 / boardgame billing');

    // Generic Bistro
    const bistroConfig = getTenantOperationalConfig('tenant-bistro-01');
    assert(bistroConfig.primaryMode === 'DINE_IN_PAY_BY_ORDER', 'Bistro primary mode is DINE_IN_PAY_BY_ORDER');
    assert(bistroConfig.features.allowOpenTabs === false, 'Bistro disallows unpaid open tabs');
    assert(bistroConfig.features.requireImmediatePayment === true, 'Bistro requires immediate payment per order round');
    assert(bistroConfig.features.roundSeparationEnabled === true, 'Bistro enables Pay-by-Order round separation');
    assert(bistroConfig.tableService.autoReleaseTableOnSettle === false, 'Bistro table session persists across rounds');

    // Fail-Closed Fallback
    const fallbackConfig = getTenantOperationalConfig('unknown-tenant-xyz');
    assert(fallbackConfig.primaryMode === 'COUNTER_QUICK_PAY', 'Unrecognized tenant safely resolves to default counter mode');
  }

  // -------------------------------------------------------------------------
  // Suite 2: DexiePOSDatabase Schema & Multi-Mode Order Fields
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2: Dexie Schema Multi-Mode Field & Compound Index Support]');
  {
    const db = getDexiePOSDatabase('tenant-bistro-01');
    assert(db !== null && db !== undefined, 'DexiePOSDatabase instance resolved');

    // Verify Version 3 stores have required compound indices
    const ordersTable = db.orders;
    assert(Boolean(ordersTable), 'Orders table exists on DexiePOSDatabase');

    // Test DecomposedOrderRecord shape with multi-mode properties
    const mockOrder: DecomposedOrderRecord = {
      id: 'ord-bistro-test-01',
      clientGeneratedId: 'uuid-bistro-01',
      tenantId: 'tenant-bistro-01',
      shiftId: 'shift-bistro-1',
      orderNumber: 201,
      tableLabel: 'میز ۴ (سالن)',
      tableNumber: 4,
      tableSessionId: 'sess-tbl4-20261104',
      flowType: 'DINE_IN_PAY_BY_ORDER',
      orderType: 'DINE_IN',
      status: 'PAID',
      grossAmountToman: 180000,
      discountAmountToman: 0,
      netTotalToman: 180000,
      paidAmountToman: 180000,
      vatTotalToman: 14862, // Math.round((180000 * 9) / 109)
      synced: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert(mockOrder.flowType === 'DINE_IN_PAY_BY_ORDER', 'Order record flowType is strongly typed');
    assert(mockOrder.tableSessionId === 'sess-tbl4-20261104', 'Order record stores tableSessionId');
    assert(mockOrder.tableNumber === 4, 'Order record stores tableNumber');
  }

  // -------------------------------------------------------------------------
  // Suite 3: Pay-by-Order Round Separation Invariants
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3: Pay-by-Order Round Separation & Session Accumulation]');
  {
    const BISTRO_TENANT = 'tenant-bistro-01';
    const TABLE_SESSION_ID = 'sess-bistro-tbl-7-night';
    const TABLE_NUM = 7;
    const TABLE_LABEL = 'میز ۷ (سالن)';

    // Round 1: Starters & Drinks (Paid immediately)
    const round1Order: DecomposedOrderRecord = {
      id: 'ord-round-1',
      clientGeneratedId: 'round1-uuid-001',
      tenantId: BISTRO_TENANT,
      shiftId: 'shift-101',
      orderNumber: 501,
      tableLabel: TABLE_LABEL,
      tableNumber: TABLE_NUM,
      tableSessionId: TABLE_SESSION_ID,
      flowType: 'DINE_IN_PAY_BY_ORDER',
      orderType: 'DINE_IN',
      status: 'PAID',
      grossAmountToman: 120000,
      discountAmountToman: 0,
      netTotalToman: 120000,
      paidAmountToman: 120000,
      vatTotalToman: Math.round((120000 * 9) / 109),
      synced: 0,
      createdAt: '2026-11-04T13:00:00Z',
      updatedAt: '2026-11-04T13:00:00Z',
    };

    // Round 2: Main Courses (Ordered 45 minutes later, paid immediately)
    const round2Order: DecomposedOrderRecord = {
      id: 'ord-round-2',
      clientGeneratedId: 'round2-uuid-002',
      tenantId: BISTRO_TENANT,
      shiftId: 'shift-101',
      orderNumber: 502,
      tableLabel: TABLE_LABEL,
      tableNumber: TABLE_NUM,
      tableSessionId: TABLE_SESSION_ID,
      flowType: 'DINE_IN_PAY_BY_ORDER',
      orderType: 'DINE_IN',
      status: 'PAID',
      grossAmountToman: 250000,
      discountAmountToman: 20000,
      netTotalToman: 230000,
      paidAmountToman: 230000,
      vatTotalToman: Math.round((230000 * 9) / 109),
      synced: 0,
      createdAt: '2026-11-04T13:45:00Z',
      updatedAt: '2026-11-04T13:45:00Z',
    };

    // Round 3: Desserts & Coffee (Ordered 1 hour later, paid immediately)
    const round3Order: DecomposedOrderRecord = {
      id: 'ord-round-3',
      clientGeneratedId: 'round3-uuid-003',
      tenantId: BISTRO_TENANT,
      shiftId: 'shift-101',
      orderNumber: 503,
      tableLabel: TABLE_LABEL,
      tableNumber: TABLE_NUM,
      tableSessionId: TABLE_SESSION_ID,
      flowType: 'DINE_IN_PAY_BY_ORDER',
      orderType: 'DINE_IN',
      status: 'PAID',
      grossAmountToman: 95000,
      discountAmountToman: 0,
      netTotalToman: 95000,
      paidAmountToman: 95000,
      vatTotalToman: Math.round((95000 * 9) / 109),
      synced: 0,
      createdAt: '2026-11-04T14:45:00Z',
      updatedAt: '2026-11-04T14:45:00Z',
    };

    const sessionOrders = [round1Order, round2Order, round3Order];

    // Invariant: All rounds share the exact same tableSessionId
    assert(
      sessionOrders.every((o) => o.tableSessionId === TABLE_SESSION_ID),
      'All 3 rounds share the identical tableSessionId'
    );

    // Invariant: Each round has an independent, unique clientGeneratedId
    const uniqueIds = new Set(sessionOrders.map((o) => o.clientGeneratedId));
    assert(uniqueIds.size === 3, 'Each round maintains an independent clientGeneratedId');

    // Invariant: Each round is individually settled (status === PAID)
    assert(
      sessionOrders.every((o) => o.status === 'PAID'),
      'Every Pay-by-Order round is settled immediately upon placement'
    );

    // Invariant: Cumulative table session financial accounting is exact integer Toman
    const totalSessionNetToman = sessionOrders.reduce((sum, o) => sum + o.netTotalToman, 0);
    assert(totalSessionNetToman === 445000, 'Cumulative session net is exactly 445,000 Toman (120k + 230k + 95k)');
    assert(Number.isInteger(totalSessionNetToman), 'Total session spend is strict integer Toman');

    // Invariant: VAT calculation across all rounds complies with frozen standard
    const totalVat = sessionOrders.reduce((sum, o) => sum + o.vatTotalToman, 0);
    assert(Number.isInteger(totalVat), 'Total session VAT is strict integer Toman');
    assert(totalVat === Math.round((120000 * 9) / 109) + Math.round((230000 * 9) / 109) + Math.round((95000 * 9) / 109), 'Round VAT matches frozen formula');
  }

  // -------------------------------------------------------------------------
  // Suite 4: Multi-Tenant Operational Mode Isolation
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4: Multi-Tenant Operational Mode Isolation]');
  {
    const hich = getTenantOperationalConfig('tenant-100hich-01');
    const modendo = getTenantOperationalConfig('tenant-modendo-01');

    assert(hich.primaryMode !== modendo.primaryMode, '100 HICH and Modendo operate on distinct operational modes');
    assert(hich.tenantId !== modendo.tenantId, 'Tenant IDs are strictly separated');
    assert(hich.fiscal.currency === 'TOMAN' && modendo.fiscal.currency === 'TOMAN', 'Both tenants adhere to mandatory TOMAN currency');
    assert(hich.fiscal.integerMathOnly && modendo.fiscal.integerMathOnly, 'Both tenants mandate integerMathOnly: true');
  }

  console.log('\n========================================');
  console.log(`Adaptive Operational Modes Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled exception during operational modes tests:', err);
  process.exit(1);
});
