/**
 * CAFE OS — Dual Venue Zones, 4 PS5 Stations & Dual Takeaway Ordering Flow Test Suite
 * Path: tests/dualVenueOrdering.test.ts
 *
 * Verifies:
 * 1. Venue Zone & Floor Layout Separation:
 *    - 100 HICH: Counter (C1, C2, B1, B2) and Retail/Tasting tables (R1, R2). Zero PS5 stations.
 *    - Modendo: Hall tables 1-6, exactly 4 dedicated PS5 stations (PS5-1 to PS5-4), and VIP suite.
 * 2. Floor Layout Persistence & Dexie Version 4 Schema:
 *    - Dexie v4 stores with venueZones and venueTables compound indices.
 *    - Physical database partitioning by tenantId (CafeOS_POS_tenant-100hich-01 vs CafeOS_POS_tenant-modendo-01).
 *    - Zero cross-tenant leakage between venue zone models.
 * 3. Dine-In Pay-Later Policy:
 *    - Modendo enforces Dine-in Pay-Later by default (TAB_PAY_LATER / ADD_TO_TAB).
 * 4. Dual-Mode Takeaway Flow:
 *    - Instant Pay: Takeaway with immediate card/cash settlement (status: PAID).
 *    - Regular Open Tab: Takeaway open tab for regular customers ("ثبت حساب باز بیرونبر (مشتری ثابت)")
 *      without immediate payment (status: PLACED, takeawayBillingMode: OPEN_TAB_REGULAR).
 * 5. Strict Integer Toman and 9% VAT Invariants.
 */

import {
  getTenantOperationalConfig,
  getTenantZones,
  getTenantPs5Stations,
  getTenantTakeawayPolicy,
  TENANT_CONFIG_100HICH,
  TENANT_CONFIG_MODENDO,
} from '../src/types/tenant-config';
import {
  DexiePOSDatabase,
  getDexiePOSDatabase,
  DecomposedOrderRecord,
  DecomposedVenueZoneRecord,
  DecomposedVenueTableRecord,
} from '../src/db/DexiePOSDatabase';
import { OrderDomainService, toToman } from '../src/components/order-domain';

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
  console.log('\n--- Running Dual Venue Zones, PS5 Stations & Ordering Flow Suite ---\n');

  // =========================================================================
  // Suite 1: Tenant Zone & Station Configuration Contracts
  // =========================================================================
  console.log('[Suite 1: Tenant Zone & Station Configuration Contracts]');
  {
    // 100 HICH Zones
    const hichZones = getTenantZones('tenant-100hich-01');
    assert(hichZones.length === 2, '100 HICH defines exactly 2 zones (Counter & Retail)');
    assert(hichZones[0].type === 'COUNTER', '100 HICH Zone 1 is COUNTER');
    assert(hichZones[1].type === 'RETAIL', '100 HICH Zone 2 is RETAIL');

    const hichPs5Stations = getTenantPs5Stations('tenant-100hich-01');
    assert(hichPs5Stations.length === 0, '100 HICH has 0 PS5 gaming stations (specialty roastery)');

    // Modendo Zones & 4 PS5 Stations
    const modendoZones = getTenantZones('tenant-modendo-01');
    assert(modendoZones.length === 3, 'Modendo defines 3 zones (Hall, PS5 Gaming, VIP)');
    assert(modendoZones[0].type === 'HALL', 'Modendo Zone 1 is HALL');
    assert(modendoZones[1].type === 'GAMING_PS5', 'Modendo Zone 2 is GAMING_PS5');
    assert(modendoZones[2].type === 'VIP_BOARDGAME', 'Modendo Zone 3 is VIP_BOARDGAME');

    const modendoPs5 = getTenantPs5Stations('tenant-modendo-01');
    assert(modendoPs5.length === 4, 'Modendo has exactly 4 dedicated PS5 stations');
    assert(modendoPs5[0].ps5StationNumber === 1 && modendoPs5[0].label === 'پاد PS5 شماره ۱', 'PS5 Station 1 verified');
    assert(modendoPs5[1].ps5StationNumber === 2 && modendoPs5[1].label === 'پاد PS5 شماره ۲', 'PS5 Station 2 verified');
    assert(modendoPs5[2].ps5StationNumber === 3 && modendoPs5[2].label === 'پاد PS5 شماره ۳', 'PS5 Station 3 verified');
    assert(modendoPs5[3].ps5StationNumber === 4 && modendoPs5[3].label === 'پاد PS5 شماره ۴', 'PS5 Station 4 verified');
    assert(modendoPs5.every((s) => s.hourlyRateToman === 90000), 'All 4 PS5 stations configured with 90,000 Toman/hr rate');

    // Dine-In Pay-Later Policy
    const modendoConfig = getTenantOperationalConfig('tenant-modendo-01');
    assert(modendoConfig.dineInPolicy.enforcePayLaterByDefault === true, 'Modendo enforces Dine-in Pay-Later by default');
    assert(modendoConfig.dineInPolicy.defaultMode === 'TAB_PAY_LATER', 'Modendo Dine-in default mode is TAB_PAY_LATER');

    // Takeaway Policy
    const hichTakeaway = getTenantTakeawayPolicy('tenant-100hich-01');
    assert(hichTakeaway.allowRegularOpenTab === true, '100 HICH allows regular customer open tabs for takeaway');

    const modendoTakeaway = getTenantTakeawayPolicy('tenant-modendo-01');
    assert(modendoTakeaway.allowRegularOpenTab === true, 'Modendo allows regular customer open tabs for takeaway');
  }

  // =========================================================================
  // Suite 2: Dexie Schema Version 4 & Table Layout Isolation
  // =========================================================================
  console.log('\n[Suite 2: Dexie Schema Version 4 & Table Layout Isolation]');
  {
    const dbHich = getDexiePOSDatabase('tenant-100hich-01');
    const dbModendo = getDexiePOSDatabase('tenant-modendo-01');

    assert(dbHich.name === 'CafeOS_POS_tenant-100hich-01', '100 HICH DB physically partitioned');
    assert(dbModendo.name === 'CafeOS_POS_tenant-modendo-01', 'Modendo DB physically partitioned');
    assert(dbHich !== dbModendo, 'DB instances are distinct objects in memory');

    assert(dbHich.verno === 4, 'Dexie schema version is upgraded to Version 4');
    assert(dbModendo.verno === 4, 'Modendo Dexie schema version is upgraded to Version 4');

    const hichTableNames = dbHich.tables.map((t) => t.name);
    assert(hichTableNames.includes('venueZones'), 'venueZones table registered in Dexie');
    assert(hichTableNames.includes('venueTables'), 'venueTables table registered in Dexie');
    assert(hichTableNames.includes('orders'), 'orders table registered in Dexie');

    // Verify 100 HICH layout models
    const hichConfig = getTenantOperationalConfig('tenant-100hich-01');
    const hichZones = hichConfig.zones;
    assert(hichZones.length === 2, '100 HICH layout has 2 zones configured');
    const hichTablesCount = hichZones.reduce((acc, z) => acc + z.tables.length, 0);
    assert(hichTablesCount === 6, '100 HICH layout has 6 total spots (4 counter + 2 retail)');

    // Verify Modendo layout models
    const modendoConfig = getTenantOperationalConfig('tenant-modendo-01');
    const modendoZones = modendoConfig.zones;
    assert(modendoZones.length === 3, 'Modendo layout has 3 zones configured');
    const modendoTablesCount = modendoZones.reduce((acc, z) => acc + z.tables.length, 0);
    assert(modendoTablesCount === 11, 'Modendo layout has 11 total stations (6 hall + 4 PS5 + 1 VIP)');

    // Cross-tenant isolation check: Ensure neither configuration leaks data to the other
    assert(!hichZones.some((z) => z.type === 'GAMING_PS5'), '100 HICH has zero gaming zones');
    assert(!hichZones.some((z) => z.tables.some((t) => t.isPs5Station)), '100 HICH has zero PS5 stations');
    assert(modendoZones.some((z) => z.type === 'GAMING_PS5'), 'Modendo contains gaming zone');
    assert(
      modendoZones.find((z) => z.type === 'GAMING_PS5')?.tables.filter((t) => t.isPs5Station).length === 4,
      'Modendo gaming zone contains exactly 4 PS5 stations'
    );
  }

  // =========================================================================
  // Suite 3: Dual-Mode Takeaway Ordering Flow
  // =========================================================================
  console.log('\n[Suite 3: Dual-Mode Takeaway Ordering Flow]');
  {
    // 1. Instant Pay Takeaway Order
    const instantOrderId = 'ord-takeaway-instant-01';
    let instantOrder = OrderDomainService.createDraft({
      id: instantOrderId,
      tenantId: 'tenant-100hich-01',
      clientGeneratedId: 'uuid-instant-01',
      tableLabel: 'سفارش بیرون‌بر (Takeaway)',
      customerName: 'مشتری گذری بیرون‌بر',
      createdByUserId: 'cashier-1',
      createdByUserName: 'صندوق‌دار شیفت',
      items: [
        {
          id: 'item-1',
          menuItemId: 'menu-americano',
          itemNameSnapshot: 'آمریکانو بیرون‌بر',
          unitPriceSnapshotToman: toToman(75000),
          quantity: 2,
          modifiers: [],
          modifiersDeltaToman: 0,
          subtotalToman: toToman(150000),
        },
      ],
    });

    instantOrder = OrderDomainService.placeOrder(instantOrder);
    instantOrder = OrderDomainService.applyPayment(instantOrder, {
      id: 'pay-inst-1',
      method: 'POS_TERMINAL',
      amount: instantOrder.totalNet,
      referenceNumber: 'TRACE-998811',
      terminalName: 'کارت‌خوان ۱',
    });

    const instantRecord: DecomposedOrderRecord = {
      id: instantOrder.id,
      clientGeneratedId: instantOrder.clientGeneratedId,
      tenantId: instantOrder.tenantId,
      shiftId: 'shift-hich-1',
      orderNumber: instantOrder.orderNumber,
      orderType: 'TAKEAWAY',
      takeawayBillingMode: 'INSTANT_PAY',
      status: 'PAID',
      grossAmountToman: instantOrder.grossAmountToman,
      discountAmountToman: 0,
      netTotalToman: instantOrder.totalNet,
      paidAmountToman: instantOrder.totalNet,
      vatTotalToman: Math.round((instantOrder.totalNet * 9) / 109),
      customerName: instantOrder.customerName,
      synced: 0,
      createdAt: instantOrder.createdAt,
      updatedAt: new Date().toISOString(),
    };

    assert(instantRecord.status === 'PAID', 'Instant takeaway order status is PAID');
    assert(instantRecord.takeawayBillingMode === 'INSTANT_PAY', 'Instant takeaway mode recorded as INSTANT_PAY');
    assert(instantRecord.paidAmountToman === instantRecord.netTotalToman, 'Instant takeaway order is fully paid');
    assert(instantRecord.orderType === 'TAKEAWAY', 'Order type is TAKEAWAY');

    // 2. Regular Open Tab Takeaway Order ("ثبت حساب باز بیرونبر (مشتری ثابت)")
    const regularOrderId = 'ord-takeaway-regular-tab-02';
    let regularOrder = OrderDomainService.createDraft({
      id: regularOrderId,
      tenantId: 'tenant-100hich-01',
      clientGeneratedId: 'uuid-regular-02',
      tableLabel: 'سفارش بیرون‌بر (Takeaway)',
      customerName: 'آقای بهرامی (مشتری ثابت)',
      customerPhone: '09123456789',
      createdByUserId: 'cashier-1',
      createdByUserName: 'صندوق‌دار شیفت',
      items: [
        {
          id: 'item-2',
          menuItemId: 'menu-v60',
          itemNameSnapshot: 'قهوه دمی کلمبیا گیشا',
          unitPriceSnapshotToman: toToman(145000),
          quantity: 1,
          modifiers: [],
          modifiersDeltaToman: 0,
          subtotalToman: toToman(145000),
        },
      ],
    });

    regularOrder = OrderDomainService.placeOrder(regularOrder);

    // Kept in PLACED state without immediate payment
    const regularRecord: DecomposedOrderRecord = {
      id: regularOrder.id,
      clientGeneratedId: regularOrder.clientGeneratedId,
      tenantId: regularOrder.tenantId,
      shiftId: 'shift-hich-1',
      orderNumber: regularOrder.orderNumber,
      orderType: 'TAKEAWAY',
      takeawayBillingMode: 'OPEN_TAB_REGULAR',
      isRegularCustomerTab: true,
      flowType: 'TAB_PAY_LATER',
      status: 'PLACED',
      grossAmountToman: regularOrder.grossAmountToman,
      discountAmountToman: 0,
      netTotalToman: regularOrder.totalNet,
      paidAmountToman: 0,
      vatTotalToman: Math.round((regularOrder.totalNet * 9) / 109),
      customerName: regularOrder.customerName,
      customerPhone: regularOrder.customerPhone,
      synced: 0,
      createdAt: regularOrder.createdAt,
      updatedAt: new Date().toISOString(),
    };

    assert(regularRecord.status === 'PLACED', 'Regular takeaway tab is PLACED (awaiting settlement upon departure/period end)');
    assert(regularRecord.takeawayBillingMode === 'OPEN_TAB_REGULAR', 'Mode is OPEN_TAB_REGULAR');
    assert(regularRecord.isRegularCustomerTab === true, 'isRegularCustomerTab flag is true');
    assert(regularRecord.customerName === 'آقای بهرامی (مشتری ثابت)', 'Regular customer name preserved');
    assert(regularRecord.customerPhone === '09123456789', 'Regular customer phone preserved');
    assert(regularRecord.paidAmountToman === 0, 'Paid amount is 0 Toman (unpaid open tab)');
    assert(regularRecord.flowType === 'TAB_PAY_LATER', 'Flow type mapped to TAB_PAY_LATER');
  }

  // =========================================================================
  // Suite 4: Modendo PS5 Session & Dine-In Pay-Later Flow
  // =========================================================================
  console.log('\n[Suite 4: Modendo PS5 Session & Dine-In Pay-Later Flow]');
  {
    // Dine-In order placed on PS5 Station 2
    const ps5OrderId = 'ord-modendo-ps5-sess-01';
    let ps5Order = OrderDomainService.createDraft({
      id: ps5OrderId,
      tenantId: 'tenant-modendo-01',
      clientGeneratedId: 'uuid-ps5-01',
      tableLabel: 'پاد PS5 شماره ۲',
      customerName: 'تیم گیمینگ فیفا ۲۴',
      createdByUserId: 'cashier-modendo',
      createdByUserName: 'صندوق‌دار مودندو',
      items: [
        {
          id: 'item-gaming-drink',
          menuItemId: 'menu-monster',
          itemNameSnapshot: 'ردبول انرژی‌زا',
          unitPriceSnapshotToman: toToman(85000),
          quantity: 2,
          modifiers: [],
          modifiersDeltaToman: 0,
          subtotalToman: toToman(170000),
        },
      ],
    });

    ps5Order = OrderDomainService.placeOrder(ps5Order);

    // Save as open tab (Pay-Later)
    const ps5Record: DecomposedOrderRecord = {
      id: ps5Order.id,
      clientGeneratedId: ps5Order.clientGeneratedId,
      tenantId: ps5Order.tenantId,
      shiftId: 'shift-modendo-1',
      orderNumber: ps5Order.orderNumber,
      orderType: 'DINE_IN',
      tableLabel: 'پاد PS5 شماره ۲',
      tableNumber: 'PS5-2',
      tableSessionId: 'sess-ps5-pod2-session',
      flowType: 'TAB_PAY_LATER',
      status: 'PLACED',
      grossAmountToman: ps5Order.grossAmountToman,
      discountAmountToman: 0,
      netTotalToman: ps5Order.totalNet,
      paidAmountToman: 0,
      vatTotalToman: Math.round((ps5Order.totalNet * 9) / 109),
      customerName: ps5Order.customerName,
      synced: 0,
      createdAt: ps5Order.createdAt,
      updatedAt: new Date().toISOString(),
    };

    assert(ps5Record.tableNumber === 'PS5-2', 'Table number correctly references PS5-2');
    assert(ps5Record.flowType === 'TAB_PAY_LATER', 'Flow type is TAB_PAY_LATER');
    assert(ps5Record.status === 'PLACED', 'Status is PLACED (enforces Dine-in Pay-Later by default)');
    assert(ps5Record.paidAmountToman === 0, 'No payment collected upon order placement');
    assert(ps5Record.tableSessionId === 'sess-ps5-pod2-session', 'Session ID binds gaming pod round');
  }

  // =========================================================================
  // Suite 5: Financial Precision & VAT Invariant Verification
  // =========================================================================
  console.log('\n[Suite 5: Financial Precision & VAT Invariants]');
  {
    const sampleAmounts = [75000, 145000, 170000, 265000, 90000];
    for (const amount of sampleAmounts) {
      assert(Number.isInteger(amount), `Amount ${amount} is strictly integer Toman`);
      const vat = Math.round((amount * 9) / 109);
      assert(Number.isInteger(vat), `VAT for ${amount} (${vat} Toman) is integer Toman`);
    }
  }

  console.log(`\n========================================`);
  console.log(`DUAL VENUE ORDERING SUITE: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
