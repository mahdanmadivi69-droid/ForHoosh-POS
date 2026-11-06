import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxSyncDaemon } from '../src/services/outboxSyncDaemon';

describe('OutboxSyncDaemon Lifecycle & Status Handling', () => {
  it('correctly tracks initial pending count and notifies status listener', async () => {
    const mockDb: any = {
      orders: {
        where: () => ({
          equals: () => ({
            count: async () => 5,
            limit: () => ({
              toArray: async () => [],
            }),
          }),
        }),
      },
    };

    let reportedStatus: any = null;
    const daemon = new OutboxSyncDaemon({
      db: mockDb,
      tenantId: '100hich',
      terminalId: 'POS_MAIN_01',
      onStatusChange: (status) => {
        reportedStatus = status;
      },
    });

    const pending = await daemon.getPendingCount();
    daemon.notifyStatus(pending);

    assert.equal(pending, 5);
    assert.notEqual(reportedStatus, null);
    assert.equal(reportedStatus.pendingCount, 5);
    assert.equal(reportedStatus.isSyncing, false);
  });
});
