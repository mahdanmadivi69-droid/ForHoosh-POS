import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeSettlementLineItems,
  hasGamingPackage,
  calculatePs5ChargeToman,
  FloorNode,
} from '../src/components/floorplan/FloorPlanCanvas';

describe('Settlement Financial Integrity and Invariants', () => {
  it('enforces financial invariant: sum(items.subtotalToman) - discount === payable', () => {
    const cartItems = [
      { id: '1', menuItemId: 'coffee-1', itemNameSnapshot: 'اسپرسو', unitPriceSnapshotToman: 50000, quantity: 2, subtotalToman: 100000 },
      { id: '2', menuItemId: 'cake-1', itemNameSnapshot: 'کیک هویج', unitPriceSnapshotToman: 75000, quantity: 1, subtotalToman: 75000 },
    ];
    const discount = 25000;
    const res = computeSettlementLineItems(cartItems, undefined, undefined, discount);

    const itemsSum = res.items.reduce((sum, it) => sum + it.subtotalToman, 0);
    assert.strictEqual(res.grossTotalToman, 175000);
    assert.strictEqual(itemsSum, 175000);
    assert.strictEqual(res.discountToman, 25000);
    assert.strictEqual(res.payableToman, 150000);
    assert.strictEqual(res.payableToman, res.grossTotalToman - res.discountToman);
  });

  it('filters out obsolete 3,000 Toman base fee and synthesizes exact hourly PS5 fee', () => {
    const startedAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const ps5Session = {
      startedAt,
      hourlyRateToman: 180000,
      controllersCount: 2,
      accumulatedMs: 0,
      isPaused: false,
    };
    const cartItems = [
      { id: 'base-charge', menuItemId: 'legacy-gaming', itemNameSnapshot: 'تعرفه بازی پایه', unitPriceSnapshotToman: 3000, quantity: 1, subtotalToman: 3000 },
      { id: 'snack-1', menuItemId: 'snack-1', itemNameSnapshot: 'چیپس و ماست', unitPriceSnapshotToman: 40000, quantity: 1, subtotalToman: 40000 },
    ];

    const node: FloorNode = {
      id: 'PS5-1',
      label: 'PS5-1',
      titleFa: 'کابین ۱',
      zone: 'PS_ROOM',
      kind: 'PS5',
      seats: 2,
      hourlyRateToman: 180000,
    };

    const res = computeSettlementLineItems(cartItems, ps5Session, node, 0, Date.now());

    // Obsolete 3,000 Toman item must be eradicated
    const hasObsolete = res.items.some((it) => it.itemNameSnapshot.includes('تعرفه بازی پایه'));
    assert.strictEqual(hasObsolete, false);

    // Dynamic PS5 fee must be synthesized
    assert.strictEqual(res.ps5Fee >= 180000, true);
    const ps5Item = res.items.find((it) => it.menuItemId === 'modendo-ps5-charge');
    assert.ok(ps5Item, 'PS5 synthesized charge item must exist');
    assert.strictEqual(ps5Item.subtotalToman, res.ps5Fee);

    // Invariant check
    const itemsSum = res.items.reduce((sum, it) => sum + it.subtotalToman, 0);
    assert.strictEqual(res.grossTotalToman, itemsSum);
    assert.strictEqual(res.payableToman, res.grossTotalToman);
  });

  it('cancels dynamic PS5 fee when fixed gaming package exists in cart', () => {
    const startedAt = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
    const ps5Session = {
      startedAt,
      hourlyRateToman: 180000,
      controllersCount: 2,
      accumulatedMs: 0,
      isPaused: false,
    };
    const cartItems = [
      {
        id: 'pkg-1',
        menuItemId: 'pkg-ps4-5-midnight',
        itemNameSnapshot: 'پی اس 4 5 دسته 12 شب',
        unitPriceSnapshotToman: 250000,
        quantity: 1,
        subtotalToman: 250000,
      },
    ];

    const node: FloorNode = {
      id: 'PS5-2',
      label: 'PS5-2',
      titleFa: 'کابین ۲',
      zone: 'PS_ROOM',
      kind: 'PS5',
      seats: 2,
      hourlyRateToman: 180000,
    };

    const res = computeSettlementLineItems(cartItems, ps5Session, node, 0, Date.now());

    assert.strictEqual(res.hasPackage, true);
    assert.strictEqual(res.ps5Fee, 0);
    assert.strictEqual(res.grossTotalToman, 250000);
    assert.strictEqual(res.payableToman, 250000);
    assert.strictEqual(res.items.length, 1);
  });

  it('handles discount exceeding gross total without producing negative payable', () => {
    const cartItems = [
      { id: '1', menuItemId: 'tea-1', itemNameSnapshot: 'چای کرک', unitPriceSnapshotToman: 35000, quantity: 1, subtotalToman: 35000 },
    ];
    const discount = 50000;
    const res = computeSettlementLineItems(cartItems, undefined, undefined, discount);

    assert.strictEqual(res.grossTotalToman, 35000);
    assert.strictEqual(res.discountToman, 50000);
    assert.strictEqual(res.payableToman, 0);
  });
});
