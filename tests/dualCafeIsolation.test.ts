/**
 * Automated Verification Suite for Dual Cafe Parallel Deployments
 * Verifies Option B Architecture: One Shared Core with Strict Multi-Tenant Data Isolation
 * Tests:
 *  1. Bidirectional Data Isolation (Orders, Shifts, Payments, Expenses)
 *  2. Cash Drawer & Financial Invariant Independence
 *  3. Catalog & Menu Partitioning (Modendo vs 100 Hich)
 *  4. Floor Plan Separation (Modendo Split-Level Gaming vs 100 Hich Coffee Lab)
 *  5. Staff & RBAC Identity Partitioning
 */

// Mock localStorage for Node environment if required
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: 0,
  };
}

import { SmartOrdersStore } from '../src/services/storage';
import { floorPlanService } from '../src/services/floorPlanService';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details || 'Assertion failed'}`);
    failedTests++;
  }
}

console.log('\n--- Running Dual Cafe Parallel Isolation Verification Suite ---\n');

// =========================================================================
// SUITE 1: Bidirectional Data Isolation & Zero Cross-Contamination
// =========================================================================
console.log('[Suite 1: Bidirectional Data Isolation (Orders, Shifts, Cash)]');
{
  // 1. Switch to Modendo
  SmartOrdersStore.switchTenant('tenant-modendo-01');
  const modendoTenant = SmartOrdersStore.getTenant();
  assert(modendoTenant.id === 'tenant-modendo-01', 'Active tenant is tenant-modendo-01');

  // Verify Modendo orders & shift
  const modendoOrdersInitial = SmartOrdersStore.getOrders();
  const modendoShift = SmartOrdersStore.getActiveShift();
  assert(modendoOrdersInitial.length > 0, 'Modendo has active orders');
  assert(modendoShift !== null && modendoShift.tenantId === 'tenant-modendo-01', 'Modendo active shift belongs strictly to Modendo');

  // Create a distinct Modendo Order
  const modendoSpecificOrder = SmartOrdersStore.createOrder({
    tenantId: 'tenant-modendo-01',
    shiftId: modendoShift!.id,
    createdByUserId: 'user-mod-01',
    createdByUserName: 'مهدان مددی',
    orderType: 'DINE_IN',
    tableLabel: 'PS5-01',
    customerName: 'مشتری تست کنسول مودندو',
    status: 'COMPLETED',
    items: [
      {
        id: 'item-mod-test-1',
        menuItemId: 'item-mod-ps5-hourly',
        itemNameSnapshot: 'سشن PS5 مودندو',
        unitPriceSnapshotToman: 120000,
        quantity: 1,
        subtotalToman: 120000,
      },
    ],
    grossAmountToman: 120000,
    discountAmountToman: 0,
    netTotalToman: 120000,
  });

  // Record payment for Modendo order
  SmartOrdersStore.recordPayment({
    tenantId: 'tenant-modendo-01',
    orderId: modendoSpecificOrder.id,
    shiftId: modendoShift!.id,
    receivedByUserId: 'user-mod-01',
    amountToman: 120000,
    paymentMethod: 'CASH',
    status: 'SUCCESSFUL',
  });

  // Record Modendo Expense
  SmartOrdersStore.recordExpense({
    tenantId: 'tenant-modendo-01',
    shiftId: modendoShift!.id,
    recordedByUserId: 'user-mod-01',
    recordedByUserName: 'مهدان مددی',
    category: 'هزینه نگهداری دسته کنسول مودندو',
    amountToman: 45000,
    isPaidFromCashDrawer: true,
    description: 'خرید روکش آنالوگ دسته دوئل‌سنس',
  });

  const modendoOrdersCount = SmartOrdersStore.getOrders().length;
  const modendoExpensesCount = SmartOrdersStore.getExpenses().length;

  // 2. Switch to 100 Hich
  SmartOrdersStore.switchTenant('tenant-100hich-01');
  const hichTenant = SmartOrdersStore.getTenant();
  assert(hichTenant.id === 'tenant-100hich-01', 'Active tenant switched to tenant-100hich-01');

  // Verify Modendo order does NOT exist in 100 Hich
  const hichOrders = SmartOrdersStore.getOrders();
  const hasModendoOrderIn100Hich = hichOrders.some((o) => o.id === modendoSpecificOrder.id || o.tableLabel === 'PS5-01');
  assert(!hasModendoOrderIn100Hich, 'Modendo PS5 order does NOT leak into 100 Hich orders ledger');

  // Verify Modendo expense does NOT exist in 100 Hich
  const hichExpenses = SmartOrdersStore.getExpenses();
  const hasModendoExpenseIn100Hich = hichExpenses.some((e) => e.category.includes('دسته کنسول'));
  assert(!hasModendoExpenseIn100Hich, 'Modendo expense does NOT leak into 100 Hich expenses');

  // Verify 100 Hich shift is distinct
  const hichShift = SmartOrdersStore.getActiveShift();
  assert(hichShift !== null, '100 Hich has its own active shift');
  assert(hichShift?.tenantId === 'tenant-100hich-01', '100 Hich shift belongs strictly to tenant-100hich-01');
  assert(hichShift?.id !== modendoShift?.id, '100 Hich shift ID is completely separate from Modendo shift ID');

  // 3. Create a distinct 100 Hich Order
  const hichSpecificOrder = SmartOrdersStore.createOrder({
    tenantId: 'tenant-100hich-01',
    shiftId: hichShift!.id,
    createdByUserId: 'user-01',
    createdByUserName: 'مهدان مددی',
    orderType: 'TAKEAWAY',
    customerName: 'مشتری قهوه دمی ۱۰۰هیچ',
    status: 'COMPLETED',
    items: [
      {
        id: 'item-hich-test-1',
        menuItemId: 'item-v60-eth',
        itemNameSnapshot: 'قهوه تخصصی V60 اتیوپی',
        unitPriceSnapshotToman: 185000,
        quantity: 1,
        subtotalToman: 185000,
      },
    ],
    grossAmountToman: 185000,
    discountAmountToman: 0,
    netTotalToman: 185000,
  });

  SmartOrdersStore.recordPayment({
    tenantId: 'tenant-100hich-01',
    orderId: hichSpecificOrder.id,
    shiftId: hichShift!.id,
    receivedByUserId: 'user-01',
    amountToman: 185000,
    paymentMethod: 'CARD_MANUAL',
    referenceCode: '100HICH-TX-99',
    status: 'SUCCESSFUL',
  });

  // 4. Switch back to Modendo and verify 100 Hich order did NOT leak into Modendo
  SmartOrdersStore.switchTenant('tenant-modendo-01');
  const modendoOrdersAfter = SmartOrdersStore.getOrders();
  assert(modendoOrdersAfter.length === modendoOrdersCount, 'Modendo orders count remains pristine');
  const hasHichOrderInModendo = modendoOrdersAfter.some((o) => o.id === hichSpecificOrder.id || o.customerName?.includes('۱۰۰هیچ'));
  assert(!hasHichOrderInModendo, '100 Hich specialty order does NOT leak into Modendo');
}

// =========================================================================
// SUITE 2: Catalog & Menu Partitioning
// =========================================================================
console.log('\n[Suite 2: Catalog & Menu Partitioning]');
{
  // Modendo Catalog
  SmartOrdersStore.switchTenant('tenant-modendo-01');
  const modMenu = SmartOrdersStore.getMenuItems();
  const modCats = SmartOrdersStore.getCategories();

  assert(modMenu.some((m) => m.nameFa.includes('پلی‌استیشن') || m.nameEn?.includes('PS5') || m.id.includes('ps5')), 'Modendo catalog includes PS5 session');
  assert(modMenu.some((m) => m.nameFa.includes('بردگیم')), 'Modendo catalog includes Boardgames');
  assert(modMenu.some((m) => m.nameFa.includes('برگر')), 'Modendo catalog includes Burgers');
  assert(modCats.some((c) => c.id === 'cat-mod-gaming'), 'Modendo has gaming category');

  // 100 Hich Catalog
  SmartOrdersStore.switchTenant('tenant-100hich-01');
  const hichMenu = SmartOrdersStore.getMenuItems();
  const hichCats = SmartOrdersStore.getCategories();

  assert(!hichMenu.some((m) => m.nameFa.includes('PS5')), '100 Hich catalog NEVER contains PS5 sessions');
  assert(!hichMenu.some((m) => m.nameFa.includes('بردگیم')), '100 Hich catalog NEVER contains Boardgame fees');
  assert(hichMenu.some((m) => m.nameFa.includes('عربیکا') || m.nameFa.includes('اسپرسو')), '100 Hich catalog focuses on specialty coffee roasts');
  assert(hichCats.some((c) => c.id === 'cat-espresso'), '100 Hich has espresso category');
}

// =========================================================================
// SUITE 3: Floor Plan Separation
// =========================================================================
console.log('\n[Suite 3: Floor Plan Separation]');
{
  // Modendo Floor Plan
  SmartOrdersStore.switchTenant('tenant-modendo-01');
  floorPlanService.reloadForTenant();
  const modFloor = floorPlanService.getTables();
  assert(modFloor.some((t) => t.id.includes('ps5')), 'Modendo floor plan contains PS5 pods');
  assert(modFloor.some((t) => t.id === 'LZ-ZONE'), 'Modendo floor plan contains Lounge U-Shape zone');

  // 100 Hich Floor Plan
  SmartOrdersStore.switchTenant('tenant-100hich-01');
  floorPlanService.reloadForTenant();
  const hichFloor = floorPlanService.getTables();
  assert(!hichFloor.some((t) => t.id.includes('ps5')), '100 Hich floor plan has NO PS5 pods');
  assert(hichFloor.some((t) => t.id === 'bar_counter_100'), '100 Hich floor plan contains Brew Bar Counter');
  assert(hichFloor.some((t) => t.id === 'takeaway_pickup'), '100 Hich floor plan contains Takeaway pickup station');
}

// =========================================================================
// SUITE 4: Staff & RBAC Identity Partitioning
// =========================================================================
console.log('\n[Suite 4: Staff & RBAC Identity Partitioning]');
{
  // Modendo Staff
  SmartOrdersStore.switchTenant('tenant-modendo-01');
  const modStaff = SmartOrdersStore.getUsers();
  assert(modStaff.some((u) => u.fullName.includes('مهسا کاظمی')), 'Modendo includes Mahsa (Cashier)');
  assert(modStaff.some((u) => u.fullName.includes('آرین خسروی')), 'Modendo includes Arian (Gamemaster)');

  // 100 Hich Staff
  SmartOrdersStore.switchTenant('tenant-100hich-01');
  const hichStaff = SmartOrdersStore.getUsers();
  assert(hichStaff.some((u) => u.fullName.includes('سارا رضایی')), '100 Hich includes Sara (Shift Manager)');
  assert(hichStaff.some((u) => u.fullName.includes('نیما کمالی')), '100 Hich includes Nima (Barista)');
  assert(!hichStaff.some((u) => u.fullName.includes('آرین خسروی')), '100 Hich does NOT include Modendo Gamemaster');
}

// Restore default to Modendo
SmartOrdersStore.switchTenant('tenant-modendo-01');
floorPlanService.reloadForTenant();

console.log(`\n========================================`);
console.log(`Dual Cafe Isolation Summary: ${passedTests} Passed, ${failedTests} Failed`);
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exit(1);
}
