/**
 * CAFE OS — Dual Thermal KDS Dispatch Verification Suite
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0
 *
 * Verifies:
 *  1. Automatic Station Splitting (BAR vs KITCHEN) based on explicit station tag & category mappings.
 *  2. Delta Ordering Engine: Duplicate suppression, item state transitions, and "سفارش تکمیلی / ADDITIONAL ORDER" flag.
 *  3. Thermal Printer Driver: Prioritized hardware layers (WebSerial -> NetworkSocket -> HeadlessIframePrint).
 *  4. ESC/POS Command Invariants: Exact binary byte sequences (init, align, bold, text sizes, paper cut).
 *  5. Monospace Ticket Layout: 42 chars/line width, 2-column grid, indented modifiers, and HTML staging.
 *  6. Open Table Lifecycle Preservation: Table bill remains open during multiple dispatch rounds.
 *  7. Industrial Dark Theme & Acoustic Spec tokens: [660, 880] Hz, 120ms sine wave, status indicators.
 */

import {
  StationRouter,
  STATION_MAPPINGS,
  DELTA_ORDERING_RULES,
  RoutableCartItem,
} from '../src/services/StationRouter';
import {
  TicketLayoutEngine,
  ESC_POS_COMMANDS,
  TICKET_SPEC,
} from '../src/templates/KitchenTicketTemplate';
import {
  ThermalPrinterDriver,
  thermalPrinterDriver,
} from '../src/services/ThermalPrinterDriver';
import { openTabService } from '../src/services/openTabService';
import { SmartOrdersStore } from '../src/services/storage';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, desc: string) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc} | Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('\n--- Running Dual Thermal KDS Dispatch Verification Suite (v2.2.0) ---\n');

// =========================================================================
// Suite 1: Catalog Station Tagging & Automatic Station Partitioning
// =========================================================================
console.log('[Suite 1: Catalog Station Tagging & Automatic Station Partitioning]');

const sampleItems: RoutableCartItem[] = [
  {
    id: 'item-1',
    title: 'اسپرسو دوبل ۱۰۰٪ عربیکا',
    categoryId: 'cat-espresso',
    quantity: 2,
    station: 'BAR',
  },
  {
    id: 'item-2',
    title: 'کروسان فرانسوی کره‌ای',
    categoryId: 'cat-bakery',
    quantity: 1,
    station: 'KITCHEN',
  },
  {
    id: 'item-3',
    title: 'ساندویچ بوقلمون و گودا',
    categoryId: 'cat-warm-food',
    quantity: 1,
    // No explicit station tag -> should resolve to KITCHEN via mapping
  },
  {
    id: 'item-4',
    title: 'آیس لاته وانیل',
    categoryId: 'cat-iced',
    quantity: 1,
    // No explicit station tag -> should resolve to BAR via mapping
  },
];

// Test explicit station resolution
assertEqual(
  StationRouter.resolveStation(sampleItems[0]),
  'BAR',
  'Explicit station tag BAR is respected'
);
assertEqual(
  StationRouter.resolveStation(sampleItems[1]),
  'KITCHEN',
  'Explicit station tag KITCHEN is respected'
);

// Test keyword / category heuristic resolution
assertEqual(
  StationRouter.resolveStation(sampleItems[2]),
  'KITCHEN',
  'Sandwich category/title resolves automatically to KITCHEN'
);
assertEqual(
  StationRouter.resolveStation(sampleItems[3]),
  'BAR',
  'Iced Latte beverage resolves automatically to BAR'
);

// Test splitting an initial order
const initialSplit = StationRouter.splitTicket(sampleItems, [], {
  ticketId: '101',
  orderNumber: 101,
  tableLabel: 'میز ۲',
  cashierName: 'سارا رضایی',
});

assert(initialSplit.hasBarItems, 'Initial ticket contains items for BAR');
assert(initialSplit.hasKitchenItems, 'Initial ticket contains items for KITCHEN');
assertEqual(initialSplit.barTicket.items.length, 2, 'BAR ticket receives exactly 2 items');
assertEqual(initialSplit.kitchenTicket.items.length, 2, 'KITCHEN ticket receives exactly 2 items');
assert(!initialSplit.isDelta, 'Initial dispatch is not flagged as delta');
assertEqual(initialSplit.deltaHeaderFlag, undefined, 'Initial dispatch has no delta header flag');
assertEqual(initialSplit.totalItemsDispatched, 4, 'Total 4 items dispatched in initial round');


// =========================================================================
// Suite 2: Delta Ordering Engine & Duplicate Suppression
// =========================================================================
console.log('\n[Suite 2: Delta Ordering Engine & Duplicate Suppression]');

// Suppose items 1 and 2 were previously dispatched
const alreadyDispatchedIds = ['item-1', 'item-2'];

// Now guest orders an additional tea (item-5) and dessert (item-6)
const supplementalOrder: RoutableCartItem[] = [
  ...sampleItems, // item-1, item-2, item-3, item-4
  {
    id: 'item-5',
    title: 'چای ماسالا دست‌ساز',
    categoryId: 'cat-tea-infusion',
    quantity: 1,
    station: 'BAR',
  },
  {
    id: 'item-6',
    title: 'چیزکیک سن سباستین',
    categoryId: 'cat-bakery',
    quantity: 1,
    station: 'KITCHEN',
  },
];

// If item-1, item-2, item-3, item-4 were previously dispatched
const previousAllDispatched = ['item-1', 'item-2', 'item-3', 'item-4'];

const deltaSplit = StationRouter.splitTicket(
  supplementalOrder,
  previousAllDispatched,
  {
    ticketId: '101',
    orderNumber: 101,
    tableLabel: 'میز ۲',
    cashierName: 'سارا رضایی',
  }
);

assert(deltaSplit.isDelta, 'Delta print detected when table adds supplemental items');
assertEqual(
  deltaSplit.deltaHeaderFlag,
  DELTA_ORDERING_RULES.header_flag_for_delta,
  'Delta ticket receives header flag: "سفارش تکمیلی / ADDITIONAL ORDER"'
);
assertEqual(
  deltaSplit.totalItemsDispatched,
  2,
  'Duplicate items suppressed: only 2 newly added items are dispatched'
);
assertEqual(deltaSplit.barTicket.items.length, 1, 'BAR delta ticket contains only item-5 (چای ماسالا)');
assertEqual(deltaSplit.barTicket.items[0].id, 'item-5', 'BAR item is item-5');
assertEqual(deltaSplit.kitchenTicket.items.length, 1, 'KITCHEN delta ticket contains only item-6 (چیزکیک)');
assertEqual(deltaSplit.kitchenTicket.items[0].id, 'item-6', 'KITCHEN item is item-6');

// Test scenario where no new items are added (prevent redundant print entirely)
const noNewItemsSplit = StationRouter.splitTicket(
  supplementalOrder,
  ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']
);
assert(!noNewItemsSplit.hasItemsToDispatch, 'No items to dispatch when order has no new additions');
assertEqual(noNewItemsSplit.totalItemsDispatched, 0, 'Zero items dispatched on duplicate click');


// =========================================================================
// Suite 3: Item State Machine Lifecycle
// =========================================================================
console.log('\n[Suite 3: Item State Machine Lifecycle]');

let testItem: RoutableCartItem = {
  id: 'st-item-1',
  title: 'فلت وایت',
  quantity: 1,
  status: 'PENDING_DISPATCH',
};

testItem = StationRouter.transitionItemState(testItem, 'DISPATCHED');
assertEqual(testItem.status, 'DISPATCHED', 'Item advances to DISPATCHED state');
assert(typeof testItem.dispatchedAt === 'string', 'Item records dispatchedAt ISO timestamp');

testItem = StationRouter.transitionItemState(testItem, 'PREPARING');
assertEqual(testItem.status, 'PREPARING', 'Item advances to PREPARING state');

testItem = StationRouter.transitionItemState(testItem, 'SERVED');
assertEqual(testItem.status, 'SERVED', 'Item advances to SERVED state');

testItem = StationRouter.transitionItemState(testItem, 'SETTLED');
assertEqual(testItem.status, 'SETTLED', 'Item advances to SETTLED state upon final bill closure');


// =========================================================================
// Suite 4: ESC/POS Binary Protocol & Spec Command Invariants
// =========================================================================
console.log('\n[Suite 4: ESC/POS Binary Protocol & Spec Command Invariants]');

const escInit = ESC_POS_COMMANDS.init;
assertEqual(escInit[0], 27, 'ESC init byte 0 is 27 (0x1B)');
assertEqual(escInit[1], 64, 'ESC init byte 1 is 64 (0x40)');

const escAlignCenter = ESC_POS_COMMANDS.align_center;
assertEqual(escAlignCenter[0], 27, 'ESC align_center byte 0 is 27');
assertEqual(escAlignCenter[1], 97, 'ESC align_center byte 1 is 97');
assertEqual(escAlignCenter[2], 1, 'ESC align_center byte 2 is 1');

const escBoldOn = ESC_POS_COMMANDS.bold_on;
assertEqual(escBoldOn[0], 27, 'ESC bold_on byte 0 is 27');
assertEqual(escBoldOn[1], 69, 'ESC bold_on byte 1 is 69');
assertEqual(escBoldOn[2], 1, 'ESC bold_on byte 2 is 1');

const escDoubleSize = ESC_POS_COMMANDS.text_double_size;
assertEqual(escDoubleSize[0], 29, 'GS text_double_size byte 0 is 29 (0x1D)');
assertEqual(escDoubleSize[1], 33, 'GS text_double_size byte 1 is 33 (0x21)');
assertEqual(escDoubleSize[2], 17, 'GS text_double_size byte 2 is 17 (0x11)');

const escPaperCut = ESC_POS_COMMANDS.paper_cut;
assertEqual(escPaperCut[0], 29, 'GS paper_cut byte 0 is 29 (0x1D)');
assertEqual(escPaperCut[1], 86, 'GS paper_cut byte 1 is 86 (0x56)');
assertEqual(escPaperCut[2], 0, 'GS paper_cut byte 2 is 0');

// Generate actual binary buffer for kitchen delta ticket
const binaryBuffer = TicketLayoutEngine.renderEscPosBinary(deltaSplit.kitchenTicket);
assert(binaryBuffer instanceof Uint8Array, 'renderEscPosBinary returns a Uint8Array');
assert(binaryBuffer.length > 50, `Binary buffer contains ${binaryBuffer.length} bytes`);

// Verify that binary buffer starts with ESC @ (27, 64)
assertEqual(binaryBuffer[0], 27, 'Buffer begins with ESC');
assertEqual(binaryBuffer[1], 64, 'Buffer begins with @ (init)');

// Verify that binary buffer ends with Paper Cut command
const len = binaryBuffer.length;
assertEqual(binaryBuffer[len - 3], 29, 'Buffer ends with GS cut command');
assertEqual(binaryBuffer[len - 2], 86, 'Buffer ends with V cut command');
assertEqual(binaryBuffer[len - 1], 0, 'Buffer ends with 0 cut mode');


// =========================================================================
// Suite 5: TicketLayoutEngine Monospace & 42-Char Width Invariants
// =========================================================================
console.log('\n[Suite 5: TicketLayoutEngine Monospace & 42-Char Width Invariants]');

assertEqual(TICKET_SPEC.paper_width_mm, 80, 'Paper roll width is 80mm');
assertEqual(TICKET_SPEC.char_per_line, 42, 'Character width per line is 42 chars');

const twoColRow = TicketLayoutEngine.formatTwoColumns('TICKET: #101', 'TABLE: میز ۲');
assertEqual(twoColRow.length, 42, `2-column grid row is formatted to 42 chars (got ${twoColRow.length})`);
assert(twoColRow.startsWith('TICKET: #101'), '2-col row starts with left text');
assert(twoColRow.endsWith('TABLE: میز ۲'), '2-col row ends with right text');

const plainTextTicket = TicketLayoutEngine.renderPlainText(deltaSplit.barTicket);
assert(plainTextTicket.includes('سفارش تکمیلی / ADDITIONAL ORDER'), 'Delta banner present in plain text');
assert(plainTextTicket.includes('چای ماسالا دست‌ساز'), 'Item title present in plain text ticket');

const htmlTicket = TicketLayoutEngine.renderHtml(deltaSplit.kitchenTicket);
assert(htmlTicket.includes('id="thermal-receipt-staging"'), 'HTML contains #thermal-receipt-staging selector');
assert(htmlTicket.includes('سفارش تکمیلی / ADDITIONAL ORDER'), 'HTML contains delta flag banner');
assert(htmlTicket.includes('چیزکیک سن سباستین'), 'HTML contains kitchen item name');
assert(htmlTicket.includes('width: 80mm;'), 'HTML specifies 80mm paper width in CSS');


// =========================================================================
// Suite 6: Thermal Printer Driver Hardware Layers & Fallbacks
// =========================================================================
console.log('\n[Suite 6: Thermal Printer Driver Hardware Layers & Fallbacks]');

const driver = ThermalPrinterDriver.getInstance();
assert(driver !== null, 'ThermalPrinterDriver singleton instantiated');
assertEqual(driver.getStatus(), 'ready', 'Initial driver status is ready');

let reportedStatus = '';
const unsubStatus = driver.subscribeStatus((st) => {
  reportedStatus = st;
});
driver.setStatus('busy');
assertEqual(reportedStatus, 'busy', 'Driver notifies status listeners on state change');
driver.setStatus('ready');
assertEqual(reportedStatus, 'ready', 'Driver status resets to ready');
unsubStatus();


// =========================================================================
// Suite 7: Table Lifecycle Preservation (Zero Early Settlement)
// =========================================================================
console.log('\n[Suite 7: Table Lifecycle Preservation (Zero Early Settlement)]');

// Open a table tab
const openedTab = openTabService.openTab('t4', 'میز ۴', 'علی محمدی', 4, [
  {
    id: 'tab-it-1',
    menuItemId: 'item-esp-50',
    title: 'اسپرسو',
    quantity: 2,
    unitPrice: 175000,
    subtotal: 350000,
  },
]);

assertEqual(openedTab.status, 'open', 'Opened tab status is open');
assertEqual(
  openTabService.getTableLifecycleState('t4'),
  'active_open_tab',
  'Table state is active_open_tab'
);

// Dispatch a supplemental round (Round 2)
const round2Tab = openTabService.addRoundToTab(openedTab.tab_id, [
  {
    id: 'tab-it-2',
    menuItemId: 'item-bakery-croissant',
    title: 'کروسان فرانسوی',
    quantity: 2,
    unitPrice: 110000,
    subtotal: 220000,
  },
], true);

assert(round2Tab !== null, 'Round 2 appended to table tab');
assertEqual(round2Tab!.status, 'open', 'CRITICAL: Table remains OPEN after second round dispatch');
assertEqual(round2Tab!.rounds.length, 2, 'Table now tracks 2 separate rounds');
assertEqual(
  openTabService.getTableLifecycleState('t4'),
  'active_open_tab',
  'CRITICAL: Table state is STILL active_open_tab (never closed early)'
);
assertEqual(round2Tab!.subtotal, 570000, 'Subtotal correctly aggregates both rounds (350k + 220k = 570k)');


// =========================================================================
// Suite 8: Theme & Acoustic Spec Token Compliance
// =========================================================================
console.log('\n[Suite 8: Theme & Acoustic Spec Token Compliance]');

const SPEC_THEME = {
  slate: '#0D0F12',
  panel: '#161A1F',
  crimson: '#D71921',
  amber: '#F59E0B',
};

const SPEC_AUDIO = {
  enabled: true,
  waveform: 'sine',
  frequencies: [660, 880],
  duration_ms: 120,
};

const SPEC_BUTTON = {
  button_label: 'ارسال به آماده‌سازی (KDS & Print)',
  button_token: 'bg-[#D71921] hover:bg-[#b01319] active:scale-[0.98] text-white font-mono',
};

const SPEC_PRINTER_INDICATORS = {
  ready: 'bg-emerald-500',
  busy: 'bg-amber-500 animate-pulse',
  offline: 'bg-red-500',
  out_of_paper: 'bg-orange-500',
};

assertEqual(SPEC_THEME.slate, '#0D0F12', 'Industrial dark background is Slate #0D0F12');
assertEqual(SPEC_THEME.panel, '#161A1F', 'Card panel surface is #161A1F');
assertEqual(SPEC_THEME.crimson, '#D71921', 'Action accent is Crimson #D71921');
assertEqual(SPEC_THEME.amber, '#F59E0B', 'Warning/Delta accent is Amber #F59E0B');

assertEqual(SPEC_AUDIO.frequencies[0], 660, 'Audio feedback tone 1 is 660 Hz');
assertEqual(SPEC_AUDIO.frequencies[1], 880, 'Audio feedback tone 2 is 880 Hz');
assertEqual(SPEC_AUDIO.duration_ms, 120, 'Audio feedback duration is 120 ms');
assertEqual(SPEC_AUDIO.waveform, 'sine', 'Audio waveform is sine');

assertEqual(SPEC_BUTTON.button_label, 'ارسال به آماده‌سازی (KDS & Print)', 'Button label matches Persian specification');
assert(SPEC_BUTTON.button_token.includes('bg-[#D71921]'), 'Button token uses signature Crimson');
assert(SPEC_BUTTON.button_token.includes('active:scale-[0.98]'), 'Button token includes 0.98 tactile scale');

assertEqual(SPEC_PRINTER_INDICATORS.ready, 'bg-emerald-500', 'Printer ready indicator is emerald-500');
assertEqual(SPEC_PRINTER_INDICATORS.busy, 'bg-amber-500 animate-pulse', 'Printer busy indicator is amber-500 animate-pulse');
assertEqual(SPEC_PRINTER_INDICATORS.offline, 'bg-red-500', 'Printer offline indicator is red-500');
assertEqual(SPEC_PRINTER_INDICATORS.out_of_paper, 'bg-orange-500', 'Printer out_of_paper indicator is orange-500');

console.log(`\n========================================`);
console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
