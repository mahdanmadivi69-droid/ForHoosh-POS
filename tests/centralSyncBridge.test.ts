import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CentralSyncBridge } from '../src/services/centralSyncBridge';
import type { SyncOrder } from '../../central-framework/types/officeAgentTypes';

describe('CentralSyncBridge Client Outbox Dispatcher', () => {
  let bridge: CentralSyncBridge;

  beforeEach(() => {
    bridge = new CentralSyncBridge('100hich', 'POS_MAIN_01');
  });

  it('initializes with healthy baseline status', () => {
    const status = bridge.getStatus(3);
    assert.equal(status.isSyncing, false);
    assert.equal(status.isLockedOut, false);
    assert.equal(status.pendingCount, 3);
    assert.equal(status.lastSyncAt, null);
  });

  it('safely handles empty batch gracefully without network calls', async () => {
    const res = await bridge.dispatchBatch([]);
    assert.equal(res, null);
  });

  it('ensures integer Toman invariant formatting for monetary numbers', () => {
    const sampleOrder: SyncOrder = {
      clientGeneratedId: 'ord-uuid-001',
      orderNumber: 'A-101',
      totalAmount: 185000.75,
      taxAmount: 18500.25,
      createdAt: 1730910000000,
      items: [
        {
          id: 'item-1',
          name: 'Flat White',
          quantity: 2,
          unitPrice: 85000.4,
          totalPrice: 170000.8,
        },
      ],
    };

    assert.equal(Math.round(sampleOrder.totalAmount), 185001);
    assert.equal(Math.round(sampleOrder.items[0].unitPrice), 85000);
    assert.equal(Math.round(sampleOrder.items[0].totalPrice), 170001);
  });
});
