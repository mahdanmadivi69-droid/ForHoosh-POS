/**
 * CAFE OS — Station Router Policy & NO_PREP Queue Exclusion Verification Suite
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0 & CODA Phase 1 Invariants
 *
 * Authored by: A05-SENTINEL (QA and Regression Engineer)
 * Target under test: src/services/StationRouter.ts (owned by A03-ROUTER)
 */

import {
  StationRouter,
  RoutableCartItem,
  DELTA_ORDERING_RULES,
} from '../src/services/StationRouter';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual !== expected) {
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
    throw new Error(`Assertion failed: ${message} (Expected: ${expected}, Got: ${actual})`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

console.log('\n--- Running CODA P1 Station Router Policy Verification Suite ---');

// =========================================================================
// Suite 1: Explicit Station Routing & Priority Resolution
// =========================================================================
console.log('\n[Suite 1: Explicit Station Routing & Priority Resolution]');

assertEqual(
  StationRouter.resolveStation({ station: 'BAR', title: 'ساندویچ مرغ' }),
  'BAR',
  'Explicit station BAR takes precedence over kitchen keywords in title'
);

assertEqual(
  StationRouter.resolveStation({ station: 'KITCHEN', title: 'اسپرسو دوبل' }),
  'KITCHEN',
  'Explicit station KITCHEN takes precedence over bar keywords in title'
);

assertEqual(
  StationRouter.resolveStation({ station: 'NO_PREP', title: 'کاپوچینو' }),
  'NO_PREP',
  'Explicit station NO_PREP takes precedence over all keywords'
);

// =========================================================================
// Suite 2: Policy-Mandated NO_PREP Category Mappings
// =========================================================================
console.log('\n[Suite 2: Policy-Mandated NO_PREP Category Mappings]');

// 1. Retail Coffee Beans
assertEqual(
  StationRouter.resolveStation({ categoryId: 'cat-retail-beans', title: 'دانه قهوه اتیوپی یرگاچف' }),
  'NO_PREP',
  'cat-retail-beans category routes strictly to NO_PREP'
);

assertEqual(
  StationRouter.resolveStation({ categoryId: 'retail', title: 'بسته قهوه تخصصی کلمبیا' }),
  'NO_PREP',
  'Retail coffee beans keyword title routes strictly to NO_PREP'
);

// 2. Modendo Gaming & Lounge Sessions
assertEqual(
  StationRouter.resolveStation({ categoryId: 'cat-mod-gaming', title: 'سشن پلی استیشن ۵ دو نفره' }),
  'NO_PREP',
  'cat-mod-gaming category routes strictly to NO_PREP'
);

assertEqual(
  StationRouter.resolveStation({ categoryId: 'gaming', title: 'ورودی بازی‌های رومیزی و بردگیم' }),
  'NO_PREP',
  'Gaming/Boardgames category routes strictly to NO_PREP'
);

// 3. Merchandise & Apparel
assertEqual(
  StationRouter.resolveStation({ categoryId: 'merchandise', title: 'ماگ سرامیکی ۱۰۰هیچ' }),
  'NO_PREP',
  'merchandise category routes strictly to NO_PREP'
);

assertEqual(
  StationRouter.resolveStation({ categoryId: 'merch', title: 'تی شرت لوگو مودندو' }),
  'NO_PREP',
  'merch category routes strictly to NO_PREP'
);

// 4. Unknown Category Fallback -> NO_PREP_AND_LOG
assertEqual(
  StationRouter.resolveStation({ categoryId: 'unknown_mystery_cat', title: 'کالای تعریف نشده' }),
  'NO_PREP',
  'Unknown category routes safely to NO_PREP with audit logging'
);

// =========================================================================
// Suite 3: Eligible BAR and KITCHEN Category & Keyword Heuristics
// =========================================================================
console.log('\n[Suite 3: Eligible BAR and KITCHEN Category & Keyword Heuristics]');

assertEqual(
  StationRouter.resolveStation({ categoryId: 'espresso', title: 'اسپرسو سینگل' }),
  'BAR',
  'Espresso category routes to BAR'
);

assertEqual(
  StationRouter.resolveStation({ title: 'آیس لاته وانیل' }),
  'BAR',
  'Beverage title "آیس لاته" routes to BAR'
);

assertEqual(
  StationRouter.resolveStation({ title: 'چای ماسالا دست‌ساز' }),
  'BAR',
  'Tea title "چای ماسالا" routes to BAR'
);

assertEqual(
  StationRouter.resolveStation({ categoryId: 'bakery', title: 'کروسان شکلاتی' }),
  'KITCHEN',
  'Bakery category routes to KITCHEN'
);

assertEqual(
  StationRouter.resolveStation({ title: 'برگر کلاسیک دست‌ساز مودندو' }),
  'KITCHEN',
  'Food title "برگر کلاسیک" routes to KITCHEN'
);

assertEqual(
  StationRouter.resolveStation({ title: 'ساندویچ پنینی بوقلمون' }),
  'KITCHEN',
  'Food title "ساندویچ پنینی" routes to KITCHEN'
);

// =========================================================================
// Suite 4: Mixed Order Queue Partitioning & NO_PREP Ticket Exclusion
// =========================================================================
console.log('\n[Suite 4: Mixed Order Queue Partitioning & NO_PREP Ticket Exclusion]');

const mixedCart: RoutableCartItem[] = [
  { id: 'item-bar-1', title: 'اسپرسو دبل ۱۰۰هیچ', categoryId: 'espresso', quantity: 2 },
  { id: 'item-kitchen-1', title: 'چیزکیک سن سباستین', categoryId: 'bakery', quantity: 1 },
  { id: 'item-retail-1', title: 'بسته ۲۵۰ گرمی کلمبیا هویلا', categoryId: 'cat-retail-beans', quantity: 1 },
  { id: 'item-gaming-1', title: 'سشن ۲ ساعته PS5 پاد شماره ۳', categoryId: 'cat-mod-gaming', quantity: 1 },
  { id: 'item-merch-1', title: 'ماگ سرامیکی قرمز', categoryId: 'merchandise', quantity: 1 },
];

const splitMixed = StationRouter.splitTicket(mixedCart, [], {
  ticketId: 'ORD-901',
  orderNumber: 901,
  tableLabel: 'میز ۴',
  cashierName: 'رضا',
});

assert(splitMixed.hasBarItems, 'Mixed order has items for BAR');
assert(splitMixed.hasKitchenItems, 'Mixed order has items for KITCHEN');
assert(splitMixed.hasNoPrepItems, 'Mixed order contains NO_PREP items');
assert(splitMixed.hasItemsToDispatch, 'Mixed order has eligible preparation items to dispatch');

assertEqual(splitMixed.barTicket.items.length, 1, 'BAR ticket receives ONLY the espresso');
assertEqual(splitMixed.barTicket.items[0].id, 'item-bar-1', 'BAR item ID is item-bar-1');

assertEqual(splitMixed.kitchenTicket.items.length, 1, 'KITCHEN ticket receives ONLY the cheesecake');
assertEqual(splitMixed.kitchenTicket.items[0].id, 'item-kitchen-1', 'KITCHEN item ID is item-kitchen-1');

assertEqual(splitMixed.noPrepItems.length, 3, 'noPrepItems contains exactly 3 items');
assertEqual(splitMixed.totalItemsDispatched, 2, 'Only the 2 eligible items (BAR + KITCHEN) count toward dispatched items');

// CRITICAL SAFETY INVARIANT CHECK:
const barTicketHasRetail = splitMixed.barTicket.items.some((i) => i.id === 'item-retail-1' || i.id === 'item-gaming-1');
const kitchenTicketHasRetail = splitMixed.kitchenTicket.items.some((i) => i.id === 'item-retail-1' || i.id === 'item-gaming-1');
assert(!barTicketHasRetail, 'INVARIANT ENFORCED: Retail and gaming items NEVER enter BAR ticket');
assert(!kitchenTicketHasRetail, 'INVARIANT ENFORCED: Retail and gaming items NEVER enter KITCHEN ticket');

// =========================================================================
// Suite 5: Pure Retail/Gaming Order (Zero Prep Items)
// =========================================================================
console.log('\n[Suite 5: Pure Retail/Gaming Order (Zero Prep Items)]');

const retailOnlyCart: RoutableCartItem[] = [
  { id: 'ret-1', title: 'دانه قهوه برزیل سانتوس', categoryId: 'cat-retail-beans', quantity: 2 },
  { id: 'game-1', title: 'ورودی بردگیم ۴ نفره', categoryId: 'cat-mod-gaming', quantity: 1 },
];

const splitRetailOnly = StationRouter.splitTicket(retailOnlyCart, [], {
  ticketId: 'ORD-902',
  orderNumber: 902,
});

assert(!splitRetailOnly.hasBarItems, 'Pure retail order has NO BAR items');
assert(!splitRetailOnly.hasKitchenItems, 'Pure retail order has NO KITCHEN items');
assert(!splitRetailOnly.hasItemsToDispatch, 'Pure retail order does NOT dispatch preparation tickets');
assertEqual(splitRetailOnly.totalItemsDispatched, 0, 'totalItemsDispatched is 0 for retail only order');
assertEqual(splitRetailOnly.noPrepItems.length, 2, 'All items safely retained in noPrepItems for cashier billing');

// =========================================================================
// Suite 6: Delta Order Dispatches with NO_PREP Items
// =========================================================================
console.log('\n[Suite 6: Delta Order Dispatches with NO_PREP Items]');

// Round 1 items already dispatched
const alreadyDispatched = ['item-bar-1', 'item-kitchen-1'];

// Customer adds 1 new drink and 1 retail bag of beans
const round2Cart: RoutableCartItem[] = [
  ...mixedCart,
  { id: 'item-bar-2', title: 'کورتادو', categoryId: 'espresso', quantity: 1 },
  { id: 'item-retail-2', title: 'بسته قهوه گیشا پاناما', categoryId: 'cat-retail-beans', quantity: 1 },
];

const splitDelta = StationRouter.splitTicket(round2Cart, alreadyDispatched, {
  ticketId: 'ORD-901',
  orderNumber: 901,
});

assert(splitDelta.isDelta, 'Delta dispatch is detected when table adds new preparation items');
assertEqual(splitDelta.deltaHeaderFlag, DELTA_ORDERING_RULES.header_flag_for_delta, 'Header flag for delta attached');
assertEqual(splitDelta.totalItemsDispatched, 1, 'Only the 1 new drink (item-bar-2) is dispatched');
assertEqual(splitDelta.barTicket.items.length, 1, 'BAR ticket contains only the new cortado');
assertEqual(splitDelta.barTicket.items[0].id, 'item-bar-2', 'Cortado dispatched to BAR');
assertEqual(splitDelta.kitchenTicket.items.length, 0, 'KITCHEN ticket receives 0 items in round 2');

// =========================================================================
// Summary
// =========================================================================
console.log('\n========================================');
console.log(`Station Router Policy Summary: ${passedTests} Passed, 0 Failed`);
console.log('========================================\n');
