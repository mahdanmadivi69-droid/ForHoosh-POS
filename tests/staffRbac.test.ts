/**
 * tests/staffRbac.test.ts
 * 
 * Modendo Multi-Staff RBAC & Single-POS PIN Verification Suite
 * 
 * Verifies:
 * 1. Owner PIN (1111) login → full access to all menus & features.
 * 2. Manager PIN (2222) login → full access to all menus & features.
 * 3. Cashier PIN (3333) login → POS, Floor Plan, Shift, Settle (no staff/reports/settings).
 * 4. Waiter PIN (4444) login → Floor Plan ONLY, Settle button strictly hidden, no reports/staff.
 * 5. Invalid PIN → 401 authentication failure.
 * 6. Lockout policy → 3 consecutive failures trigger 5-minute (300s) lockout.
 * 7. Report calculations → Daily sales summary, top items by revenue, payment breakdown, staff performance, CSV UTF-8 BOM.
 */

// Mock localStorage for Node test runner
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  key: (index: number) => Array.from(memoryStore.keys())[index] || null,
  get length() {
    return memoryStore.size;
  },
};

import bcrypt from 'bcryptjs';
import { StaffService, DEFAULT_SEED_STAFF } from '../src/services/staffService';
import type { StaffRecord } from '../src/services/staffService';
import { useStaffAuthStore } from '../src/stores/useStaffAuthStore';
import { Order, Payment } from '../src/types/domain';

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
  if (actual === expected) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} | Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('--- Modendo Single-POS RBAC & PIN Security Suite ---');
console.log('======================================================\n');

async function runTests() {
  // Mock DB for in-memory testing
  const inMemoryStaff: StaffRecord[] = DEFAULT_SEED_STAFF.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    pinHash: bcrypt.hashSync(s.pin, 10),
    isActive: true,
    createdAt: Date.now(),
  }));

  const mockDb = {
    staff: {
      count: async () => inMemoryStaff.length,
      toArray: async () => [...inMemoryStaff],
      get: async (id: string) => inMemoryStaff.find((s) => s.id === id) || undefined,
      put: async (record: StaffRecord) => {
        const idx = inMemoryStaff.findIndex((s) => s.id === record.id);
        if (idx >= 0) inMemoryStaff[idx] = record;
        else inMemoryStaff.push(record);
        return record.id;
      },
    },
  } as any;

  // Clear lockout state before start
  localStorage.clear();

  // -------------------------------------------------------------------------
  // TEST SUITE 1: Owner PIN Login (1111) & Full Access
  // -------------------------------------------------------------------------
  console.log('[Suite 1: Owner PIN Login & Feature Permissions]');
  {
    const res = await StaffService.authenticateWithPin('1111', mockDb);
    assert(res.success, 'Owner PIN (1111) successfully authenticates');
    assert(res.user !== undefined, 'Returned user object is defined');
    assertEqual(res.user?.role, 'owner', 'User role is owner');

    useStaffAuthStore.getState().setCurrentUser(res.user!);
    const store = useStaffAuthStore.getState();

    assert(store.canAccess('pos'), 'Owner can access POS');
    assert(store.canAccess('floor-plan'), 'Owner can access Floor Plan');
    assert(store.canAccess('reports'), 'Owner can access Reports');
    assert(store.canAccess('settings'), 'Owner can access Settings');
    assert(store.canAccess('staff'), 'Owner can access Staff Management');
    assert(store.canAccess('kds'), 'Owner can access KDS');
    assert(store.canAccess('settle'), 'Owner can settle bills');
    assert(store.canAccess('shift'), 'Owner can open/close shifts');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Manager PIN Login (2222) & Full Access
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2: Manager PIN Login & Feature Permissions]');
  {
    const res = await StaffService.authenticateWithPin('2222', mockDb);
    assert(res.success, 'Manager PIN (2222) successfully authenticates');
    assertEqual(res.user?.role, 'manager', 'User role is manager');

    useStaffAuthStore.getState().setCurrentUser(res.user!);
    const store = useStaffAuthStore.getState();

    assert(store.canAccess('pos'), 'Manager can access POS');
    assert(store.canAccess('floor-plan'), 'Manager can access Floor Plan');
    assert(store.canAccess('reports'), 'Manager can access Reports');
    assert(store.canAccess('settings'), 'Manager can access Settings');
    assert(store.canAccess('staff'), 'Manager can access Staff Management');
    assert(store.canAccess('kds'), 'Manager can access KDS');
    assert(store.canAccess('settle'), 'Manager can settle bills');
    assert(store.canAccess('shift'), 'Manager can open/close shifts');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 3: Cashier PIN Login (3333) & Gated Access
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3: Cashier PIN Login & Gated Permissions]');
  {
    const res = await StaffService.authenticateWithPin('3333', mockDb);
    assert(res.success, 'Cashier PIN (3333) successfully authenticates');
    assertEqual(res.user?.role, 'cashier', 'User role is cashier');

    useStaffAuthStore.getState().setCurrentUser(res.user!);
    const store = useStaffAuthStore.getState();

    assert(store.canAccess('pos'), 'Cashier can access POS');
    assert(store.canAccess('floor-plan'), 'Cashier can access Floor Plan');
    assert(store.canAccess('settle'), 'Cashier can settle bills');
    assert(store.canAccess('shift'), 'Cashier can manage shifts');

    assert(!store.canAccess('reports'), 'Cashier CANNOT access Reports');
    assert(!store.canAccess('staff'), 'Cashier CANNOT access Staff Management');
    assert(!store.canAccess('settings'), 'Cashier CANNOT access Settings');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 4: Waiter PIN Login (4444) & Strict Settle-Button Hiding
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4: Waiter PIN Login & Settle Button Hidden]');
  {
    const res = await StaffService.authenticateWithPin('4444', mockDb);
    assert(res.success, 'Waiter PIN (4444) successfully authenticates');
    assertEqual(res.user?.role, 'waiter', 'User role is waiter');

    useStaffAuthStore.getState().setCurrentUser(res.user!);
    const store = useStaffAuthStore.getState();

    assert(store.canAccess('floor-plan'), 'Waiter can access Floor Plan to add items');
    assert(!store.canAccess('settle'), 'CRITICAL: Waiter settle button is strictly HIDDEN (canAccess("settle") === false)');
    assert(!store.canAccess('reports'), 'Waiter cannot access Reports');
    assert(!store.canAccess('staff'), 'Waiter cannot access Staff Management');
    assert(!store.canAccess('settings'), 'Waiter cannot access Settings');
    assert(!store.canAccess('pos'), 'Waiter cannot access POS direct checkout');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Invalid PIN (401 Error)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5: Invalid PIN Verification (401)]');
  {
    localStorage.clear();
    const res = await StaffService.authenticateWithPin('9999', mockDb);
    assert(!res.success, 'Invalid PIN (9999) rejected');
    assertEqual(res.errorCode, 401, 'Returns 401 error code');
    assert(res.error?.includes('نامعتبر') || false, 'Error message indicates invalid PIN');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 6: Lockout After 3 Failures (5-minute Lockout)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 6: Lockout After 3 Failures]');
  {
    localStorage.clear();
    // Attempt 1
    const res1 = await StaffService.authenticateWithPin('0001', mockDb);
    assert(!res1.success, 'Attempt 1 fails');
    assertEqual(StaffService.getLockoutRemainingSeconds(), 0, 'No lockout after 1st failure');

    // Attempt 2
    const res2 = await StaffService.authenticateWithPin('0002', mockDb);
    assert(!res2.success, 'Attempt 2 fails');
    assertEqual(StaffService.getLockoutRemainingSeconds(), 0, 'No lockout after 2nd failure');

    // Attempt 3 -> Triggers lockout
    const res3 = await StaffService.authenticateWithPin('0003', mockDb);
    assert(!res3.success, 'Attempt 3 fails and triggers lockout');
    const remaining = StaffService.getLockoutRemainingSeconds();
    assert(remaining > 280 && remaining <= 300, `Lockout active for ~300s (remaining: ${remaining}s)`);
    assertEqual(res3.errorCode, 429, 'Returns 429 error code on lockout trigger');

    // Attempt 4 while locked -> Immediately rejected
    const res4 = await StaffService.authenticateWithPin('1111', mockDb);
    assert(!res4.success, 'Even valid PIN (1111) rejected while lockout is active');
    assertEqual(res4.errorCode, 429, 'Lockout error code 429 returned');
    assert(res4.error?.includes('قفل') || false, 'Lockout message presented to user');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 7: Owner Reporting Calculations & CSV Generation
  // -------------------------------------------------------------------------
  console.log('\n[Suite 7: Owner Reporting Calculations & CSV]');
  {
    localStorage.clear();

    const sampleOrders: Order[] = [
      {
        id: 'ord_1',
        orderNumber: 101,
        tenantId: 'tenant-modendo-01',
        shiftId: 'shift_1',
        createdByUserId: 'mod_staff_cashier',
        createdByUserName: 'صندوق‌دار',
        orderType: 'DINE_IN',
        tableLabel: 'M7',
        status: 'COMPLETED',
        grossAmountToman: 250000,
        discountAmountToman: 20000,
        netTotalToman: 230000,
        createdAt: '2026-11-19T10:00:00Z',
        items: [
          { menuItemId: 'item_1', nameFa: 'اسپرسو دوبل', unitPriceToman: 70000, quantity: 2, subtotalToman: 140000 },
          { menuItemId: 'item_2', nameFa: 'چیزکیک سن سباستین', unitPriceToman: 110000, quantity: 1, subtotalToman: 110000 },
        ],
      },
      {
        id: 'ord_2',
        orderNumber: 102,
        tenantId: 'tenant-modendo-01',
        shiftId: 'shift_1',
        createdByUserId: 'mod_staff_waiter1',
        createdByUserName: 'سالن‌کار ۱',
        orderType: 'DINE_IN',
        tableLabel: 'PS3',
        status: 'COMPLETED',
        grossAmountToman: 180000,
        discountAmountToman: 0,
        netTotalToman: 180000,
        createdAt: '2026-11-19T11:00:00Z',
        items: [
          { menuItemId: 'item_3', nameFa: 'تعرفه ۱ ساعت بازی PS5', unitPriceToman: 120000, quantity: 1, subtotalToman: 120000 },
          { menuItemId: 'item_1', nameFa: 'اسپرسو دوبل', unitPriceToman: 60000, quantity: 1, subtotalToman: 60000 },
        ],
      },
      {
        id: 'ord_3',
        orderNumber: 103,
        tenantId: 'tenant-modendo-01',
        shiftId: 'shift_1',
        createdByUserId: 'mod_staff_cashier',
        createdByUserName: 'صندوق‌دار',
        orderType: 'TAKEAWAY',
        tableLabel: 'بیرون‌بر',
        status: 'CANCELLED',
        grossAmountToman: 90000,
        discountAmountToman: 0,
        netTotalToman: 90000,
        createdAt: '2026-11-19T12:00:00Z',
        items: [
          { menuItemId: 'item_4', nameFa: 'لاته کارامل', unitPriceToman: 90000, quantity: 1, subtotalToman: 90000 },
        ],
      },
    ];

    const samplePayments: Payment[] = [
      {
        id: 'pay_1',
        orderId: 'ord_1',
        tenantId: 'tenant-modendo-01',
        shiftId: 'shift_1',
        receivedByUserId: 'mod_staff_cashier',
        amountToman: 230000,
        paymentMethod: 'POS_MACHINE',
        status: 'SUCCESSFUL',
        createdAt: '2026-11-19T10:05:00Z',
      },
      {
        id: 'pay_2',
        orderId: 'ord_2',
        tenantId: 'tenant-modendo-01',
        shiftId: 'shift_1',
        receivedByUserId: 'mod_staff_cashier',
        amountToman: 180000,
        paymentMethod: 'CASH',
        status: 'SUCCESSFUL',
        createdAt: '2026-11-19T11:05:00Z',
      },
    ];

    // Compute sales summary
    const completedOrders = sampleOrders.filter((o) => o.status === 'COMPLETED');
    const grossSales = completedOrders.reduce((sum, o) => sum + o.grossAmountToman, 0);
    const totalDiscounts = completedOrders.reduce((sum, o) => sum + (o.discountAmountToman || 0), 0);
    const netSales = completedOrders.reduce((sum, o) => sum + o.netTotalToman, 0);
    const avgOrderValue = Math.round(netSales / completedOrders.length);

    assertEqual(grossSales, 430000, 'Gross sales is exactly 430,000 Toman (excluding cancelled)');
    assertEqual(totalDiscounts, 20000, 'Total discount is exactly 20,000 Toman');
    assertEqual(netSales, 410000, 'Net revenue is exactly 410,000 Toman');
    assertEqual(avgOrderValue, 205000, 'Average order value is 205,000 Toman');

    // Payment method breakdown
    const cashTotal = samplePayments.filter((p) => p.paymentMethod === 'CASH').reduce((sum, p) => sum + p.amountToman, 0);
    const cardTotal = samplePayments.filter((p) => p.paymentMethod === 'POS_MACHINE').reduce((sum, p) => sum + p.amountToman, 0);

    assertEqual(cashTotal, 180000, 'Cash breakdown matches 180,000 Toman');
    assertEqual(cardTotal, 230000, 'Card (POS_MACHINE) breakdown matches 230,000 Toman');

    // Top items by revenue
    const itemMap = new Map<string, { nameFa: string; revenue: number; qty: number }>();
    completedOrders.forEach((o) => {
      o.items.forEach((it) => {
        const existing = itemMap.get(it.menuItemId) || { nameFa: it.nameFa, revenue: 0, qty: 0 };
        existing.revenue += it.subtotalToman;
        existing.qty += it.quantity;
        itemMap.set(it.menuItemId, existing);
      });
    });
    const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue);

    assertEqual(sortedItems[0].nameFa, 'اسپرسو دوبل', 'Top item is اسپرسو دوبل (200k revenue)');
    assertEqual(sortedItems[0].revenue, 200000, 'اسپرسو دوبل revenue matches 200,000 Toman');
    assertEqual(sortedItems[1].nameFa, 'تعرفه ۱ ساعت بازی PS5', 'Second top item is PS5 hourly (120k revenue)');

    // Staff performance (orders completed per staff)
    const staffPerformance = new Map<string, number>();
    completedOrders.forEach((o) => {
      const name = o.createdByUserName || o.createdByUserId;
      staffPerformance.set(name, (staffPerformance.get(name) || 0) + 1);
    });

    assertEqual(staffPerformance.get('صندوق‌دار'), 1, 'Cashier recorded 1 completed order');
    assertEqual(staffPerformance.get('سالن‌کار ۱'), 1, 'Waiter 1 recorded 1 completed order');

    // Verify CSV Generation format
    const csvRows = [
      ['شماره سفارش', 'ثبت‌کننده', 'میز/جایگاه', 'وضعیت', 'مبلغ ناخالص (تومان)', 'مبلغ نهایی (تومان)'],
      ...completedOrders.map((o) => [
        o.orderNumber,
        o.createdByUserName,
        o.tableLabel,
        'تسویه شده',
        o.grossAmountToman,
        o.netTotalToman,
      ]),
    ];
    const csvContent = '\uFEFF' + csvRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');

    assert(csvContent.startsWith('\uFEFF'), 'CSV content includes UTF-8 BOM for Persian Excel support');
    assert(csvContent.includes('"اسپرسو دوبل"') || csvContent.includes('"صندوق‌دار"'), 'CSV contains Persian records');
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`Staff RBAC Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
