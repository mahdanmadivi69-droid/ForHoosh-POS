// tests/invoiceSequence.test.ts
import { InvoiceSequenceService } from '../src/services/invoiceSequence';
import { Order } from '../src/types/domain';

// Simple assertion helper
let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log('\n--- Running P1-4 Invoice Sequence Verification Suite ---\n');

const tenantId = 'tenant-test-100hich';
let orders: Order[] = [];

// 1. Initial sequence generation
const seq1 = InvoiceSequenceService.nextOrderNumber(tenantId, orders);
orders.push({ orderNumber: seq1 } as Order);
const seq2 = InvoiceSequenceService.nextOrderNumber(tenantId, orders);
orders.push({ orderNumber: seq2 } as Order);
const seq3 = InvoiceSequenceService.nextOrderNumber(tenantId, orders);
orders.push({ orderNumber: seq3 } as Order);

assert(seq1 === 1, 'First order has orderNumber 1');
assert(seq2 === 2, 'Second order has orderNumber 2');
assert(seq3 === 3, 'Third order has orderNumber 3');

// 2. Delete the latest order (seq3)
orders.pop();
assert(orders.length === 2, 'Latest order removed from array');
const seqAfterDelete = InvoiceSequenceService.nextOrderNumber(tenantId, orders);
assert(
  seqAfterDelete === 4,
  `Deleted latest order does not cause reuse: next orderNumber is 4 (got ${seqAfterDelete})`
);
orders.push({ orderNumber: seqAfterDelete } as Order);

// 3. Restore backup with a gap (e.g. max order number is 50)
const backupOrders: Order[] = [
  { orderNumber: 10 } as Order,
  { orderNumber: 50 } as Order,
];
InvoiceSequenceService.reconcile(tenantId, backupOrders);
const seqAfterRestore = InvoiceSequenceService.nextOrderNumber(tenantId, backupOrders);
assert(
  seqAfterRestore === 51,
  `Restore backup with gap reconciles monotonically: expected 51, got ${seqAfterRestore}`
);

// 4. 20 consecutive sales produce 20 distinct numbers
const consecutive: number[] = [];
for (let i = 0; i < 20; i++) {
  const next = InvoiceSequenceService.nextOrderNumber(tenantId, backupOrders);
  consecutive.push(next);
}
const unique = new Set(consecutive);
assert(
  unique.size === 20,
  `20 consecutive sales produce 20 distinct numbers: size is ${unique.size}`
);
assert(
  consecutive[19] === consecutive[0] + 19,
  '20 consecutive sales produce strictly increasing sequential numbers'
);

console.log(`\nP1-4 Tests Complete: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) process.exit(1);
