import {
  MODENDO_FLOOR_NODES,
  getDisplayShortLabel,
  normalizeNodeKey,
  resolveNodeSession,
  getSessionTotalToman,
  TableSession,
} from '../src/components/floorplan/FloorPlanCanvas';
import { openTabService } from '../src/services/openTabService';
import { TabCartItem } from '../src/types/inventory-tab';

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

console.log('\n--- Running Bar Stool & Floor Plan Unified Resolver Test Suite ---\n');

const tenantId = 'tenant-modendo-01';
const bar1Node = MODENDO_FLOOR_NODES.find((n) => n.id === 'BAR-1')!;

// -----------------------------------------------------------------------------
// Test 1: Node Key Normalization & Short Label Generation
// -----------------------------------------------------------------------------
console.log('[Test 1: Key Normalization & Short Labels]');
assert(Boolean(bar1Node), 'BAR-1 node exists in MODENDO_FLOOR_NODES');
assert(bar1Node.label === 'بار ۱', 'BAR-1 has Persian numeral label "بار ۱"');
assert(getDisplayShortLabel(bar1Node) === 'B1', 'BAR-1 short label displays as "B1"');
assert(normalizeNodeKey('بار ۱') === 'بار 1', 'normalizeNodeKey converts Persian numeral ۱ to 1');
assert(normalizeNodeKey('BAR-1') === 'bar-1', 'normalizeNodeKey lowercases node id');

for (let i = 1; i <= 6; i++) {
  const node = MODENDO_FLOOR_NODES.find((n) => n.id === `BAR-${i}`);
  assert(Boolean(node && getDisplayShortLabel(node) === `B${i}`), `BAR-${i} maps to short label B${i}`);
}

// -----------------------------------------------------------------------------
// Test 2: Unified Resolver with Direct Key and Alternate Label Mappings
// -----------------------------------------------------------------------------
console.log('\n[Test 2: Session Resolution Across Direct & Alternate Keys]');
const mockSession: TableSession = {
  nodeId: 'BAR-1',
  tableLabel: 'بار ۱',
  status: 'OCCUPIED',
  openedAt: new Date().toISOString(),
  cartItems: [
    {
      id: 'item-1',
      menuItemId: 'mod-latte',
      itemNameSnapshot: 'لاته کارامل',
      unitPriceSnapshotToman: 250000,
      quantity: 1,
      subtotalToman: 250000,
    },
  ],
};

// 2a. Direct hit on node.id ('BAR-1')
assert(
  resolveNodeSession(bar1Node, { 'BAR-1': mockSession }, tenantId) === mockSession,
  'Resolves directly via node.id "BAR-1"'
);

// 2b. Alternate hit on node.label ('بار ۱')
assert(
  resolveNodeSession(bar1Node, { 'بار ۱': mockSession }, tenantId) === mockSession,
  'Resolves via Persian label "بار ۱"'
);

// 2c. Alternate hit on normalized ASCII digit key ('بار 1')
assert(
  resolveNodeSession(bar1Node, { 'بار 1': mockSession }, tenantId) === mockSession,
  'Resolves via normalized ASCII label "بار 1"'
);

// 2d. Alternate hit on short label ('B1')
assert(
  resolveNodeSession(bar1Node, { 'B1': mockSession }, tenantId) === mockSession,
  'Resolves via short capsule label "B1"'
);

// -----------------------------------------------------------------------------
// Test 3: Resolution from openTabService (Bar Tab Opened in POS)
// -----------------------------------------------------------------------------
console.log('\n[Test 3: Bar Tab Created in POS via openTabService]');
const posTabItems: TabCartItem[] = [
  {
    id: 'tab-item-1',
    menuItemId: 'mod-item-caramel-latte',
    title: 'لاته کارامل (دبل)',
    unitPrice: 250000,
    quantity: 1,
    subtotal: 250000,
    modifiers: [],
  },
  {
    id: 'tab-item-2',
    menuItemId: 'mod-item-croissant',
    title: 'کروسان فرانسوی کره‌ای',
    unitPrice: 110000,
    quantity: 1,
    subtotal: 110000,
    modifiers: [],
  },
];

// Open tab for BAR-1 in openTabService (simulating POS action)
const openedTab = openTabService.openTab(
  bar1Node.id,
  bar1Node.label,
  'صندوق‌دار شیفت',
  1,
  posTabItems,
  tenantId
);

assert(Boolean(openedTab), 'openTab successfully opened tab in openTabService');
assert(openedTab.table_id === 'BAR-1', 'Tab stored with table_id BAR-1');

// When floorSessions (localStorage) is empty, resolveNodeSession must synthesize full TableSession
const resolvedFromTab = resolveNodeSession(bar1Node, {}, tenantId);
assert(Boolean(resolvedFromTab), 'resolveNodeSession resolves tab from openTabService');
assert(resolvedFromTab?.status === 'OCCUPIED', 'Synthesized session has status OCCUPIED');
assert(resolvedFromTab?.cartItems?.length === 2, 'Synthesized session contains exactly 2 cart items');
assert(
  resolvedFromTab?.cartItems?.[0].itemNameSnapshot === 'لاته کارامل (دبل)',
  'Item 1 has correct itemNameSnapshot'
);
assert(
  resolvedFromTab?.cartItems?.[0].subtotalToman === 250000,
  'Item 1 has correct subtotalToman (250,000)'
);
assert(
  resolvedFromTab?.cartItems?.[1].itemNameSnapshot === 'کروسان فرانسوی کره‌ای',
  'Item 2 has correct itemNameSnapshot'
);
assert(
  resolvedFromTab?.cartItems?.[1].subtotalToman === 110000,
  'Item 2 has correct subtotalToman (110,000)'
);

// -----------------------------------------------------------------------------
// Test 4: Financial Invariant on Resolved Session
// -----------------------------------------------------------------------------
console.log('\n[Test 4: Financial Invariant on Resolved Bar Tab]');
const totalToman = getSessionTotalToman(resolvedFromTab);
assert(totalToman === 360000, `Total matches sum of line items: 360,000 Toman (got ${totalToman})`);

// -----------------------------------------------------------------------------
// Test 5: Settle & Void Write-Through Synchronization
// -----------------------------------------------------------------------------
console.log('\n[Test 5: Write-Through Synchronization on Settle / Void]');

// Settle the tab
openTabService.settleTab(
  openedTab.tab_id,
  { paymentMethod: 'CARD', referenceCode: 'POS-TEST-123' },
  tenantId
);

const settledTab = openTabService.getTabForTable(bar1Node.id, tenantId);
assert(!settledTab, 'openTabService returns no active tab after settlement');

const afterSettleSession = resolveNodeSession(bar1Node, {}, tenantId);
assert(!afterSettleSession, 'resolveNodeSession returns undefined after settlement (node is free)');

// Summary
console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
