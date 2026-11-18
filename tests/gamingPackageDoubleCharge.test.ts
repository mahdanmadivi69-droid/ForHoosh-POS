import { hasGamingPackage, getSessionTotalToman, TableSession } from '../src/components/floorplan/FloorPlanCanvas';

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

console.log('\n--- Running Modendo Gaming Package & Double-Charging Prevention Test Suite ---\n');

console.log('[Suite 1: Gaming Package Detection]');
// 1. Real Persian menu item from modendoMenu: "پی اس 4 5 دسته 12 شب" (470,000 Toman)
assert(
  hasGamingPackage([{ menuItemId: 'mod-item-087', itemNameSnapshot: 'پی اس 5 4 دسته 12 شب' }]),
  'Matches Persian item: "پی اس 5 4 دسته 12 شب"'
);

assert(
  hasGamingPackage([{ menuItemId: 'mod-item-086', itemNameSnapshot: 'پی اس 5 3 دسته 12 شب' }]),
  'Matches Persian item: "پی اس 5 3 دسته 12 شب"'
);

assert(
  hasGamingPackage([{ menuItemId: 'mod-item-089', itemNameSnapshot: 'پی اس نیم ساعت' }]),
  'Matches Persian item: "پی اس نیم ساعت"'
);

assert(
  hasGamingPackage([{ menuItemId: 'mod-item-009', itemNameSnapshot: 'بردگیم بعد از ۲ ساعت' }]),
  'Matches boardgame item: "بردگیم بعد از ۲ ساعت"'
);

assert(
  hasGamingPackage([{ menuItemId: 'custom-xbox-pkg', itemNameSnapshot: 'پکیج ایکس باکس کابین VIP' }]),
  'Matches Persian Xbox & Cabin keywords'
);

// Negative checks
assert(
  !hasGamingPackage([{ menuItemId: 'mod-item-001', itemNameSnapshot: 'اسپرسو دوبل' }]),
  'Does not match regular beverage (Espresso)'
);

assert(
  !hasGamingPackage([
    { menuItemId: 'modendo-ps5-charge', itemNameSnapshot: 'تعرفه بازی PS5 (PS5 #1)' },
  ]),
  'Does not falsely treat the synthesized hourly charge itself as a package'
);

console.log('\n[Suite 2: Double-Charging Elimination]');
const now = Date.now();
const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

// Session with gaming package: fixed price 470,000 Toman, running timer for 5 minutes
const sessionWithPackage: TableSession = {
  nodeId: 'ps5-1',
  tableLabel: 'PS5 #1',
  status: 'occupied',
  openedAt: fiveMinutesAgo,
  cartItems: [
    {
      id: 'pkg-1',
      menuItemId: 'mod-item-087',
      itemNameSnapshot: 'پی اس 5 4 دسته 12 شب',
      unitPriceSnapshotToman: 470000,
      quantity: 1,
      subtotalToman: 470000,
    },
  ],
  ps5Session: {
    startedAt: fiveMinutesAgo,
    hourlyRateToman: 180000,
    controllersCount: 4,
    accumulatedMs: 0,
    isPaused: false,
  },
};

const totalWithPackage = getSessionTotalToman(sessionWithPackage, now);
assert(
  totalWithPackage === 470000,
  `Session with 470k package ignores 5-min timer fee (expected 470,000 Toman, got ${totalWithPackage.toLocaleString()} Toman)`
);

// Session WITHOUT gaming package (only coffee): should charge coffee + time fee
const sessionWithoutPackage: TableSession = {
  nodeId: 'ps5-1',
  tableLabel: 'PS5 #1',
  status: 'occupied',
  openedAt: fiveMinutesAgo,
  cartItems: [
    {
      id: 'bev-1',
      menuItemId: 'mod-item-001',
      itemNameSnapshot: 'اسپرسو دوبل',
      unitPriceSnapshotToman: 50000,
      quantity: 1,
      subtotalToman: 50000,
    },
  ],
  ps5Session: {
    startedAt: fiveMinutesAgo,
    hourlyRateToman: 180000,
    controllersCount: 2,
    accumulatedMs: 0,
    isPaused: false,
  },
};

const totalWithoutPackage = getSessionTotalToman(sessionWithoutPackage, now);
// 5 min @ 180,000/hr = (5/60)*180,000 = 15,000 Toman time fee
// 50,000 + 15,000 = 65,000 Toman
assert(
  totalWithoutPackage === 65000,
  `Session with regular food calculates time fee (50,000 + 15,000 = expected 65,000 Toman, got ${totalWithoutPackage.toLocaleString()} Toman)`
);

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
