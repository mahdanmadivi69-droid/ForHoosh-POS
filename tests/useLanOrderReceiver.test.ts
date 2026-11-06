import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { LanOrderSocketDaemon, wireLanOrderToPrinter, LanOrderPayload } from '../src/services/lanOrderSocketDaemon';
import * as printerBridgeModule from '../src/services/printerBridge';

describe('useLanOrderReceiver & wireLanOrderToPrinter Integration', () => {
  const TEST_PORT = 9188;
  let daemon: LanOrderSocketDaemon;

  beforeAll(async () => {
    daemon = new LanOrderSocketDaemon({
      port: TEST_PORT,
      heartbeatIntervalMs: 5000,
    });
    await daemon.start();
  });

  afterAll(async () => {
    await daemon.stop();
  });

  it('wireLanOrderToPrinter automatically dispatches print job to BAR station on order arrival', async () => {
    const dispatchSpy = vi.spyOn(printerBridgeModule, 'dispatchPrintJob').mockResolvedValue({
      jobId: 'mock-job-1',
      success: true,
      station: 'BAR',
      bytesWritten: 120,
      attempts: 1,
    });

    wireLanOrderToPrinter(daemon, { autoPrintBar: true });

    const mockOrder: LanOrderPayload = {
      orderId: 'ORD-AUTO-PRINT-1',
      tenantId: 'tenant-100hich-01',
      tableNumber: 'T5',
      items: [
        { id: '1', name: 'کاپوچینو', quantity: 2, unitPrice: 130000, notes: 'بدون شکر' },
      ],
      subtotal: 260000,
      timestamp: Date.now(),
    };

    // Simulate internal order event
    (daemon as any).onOrderReceivedCallback(mockOrder);

    // Give microtask tick to settle
    await new Promise((r) => setTimeout(r, 20));

    expect(dispatchSpy).toHaveBeenCalledWith(
      'BAR',
      expect.objectContaining({
        ticketId: 'ORD-AUTO-PRINT-1',
        orderNumber: 'ORD-AUTO-PRINT-1',
        tableLabel: 'T5',
        totalAmountToman: 260000,
      })
    );

    dispatchSpy.mockRestore();
  });

  it('wireLanOrderToPrinter ignores printing when autoPrintBar is false', async () => {
    const dispatchSpy = vi.spyOn(printerBridgeModule, 'dispatchPrintJob').mockResolvedValue({
      jobId: 'mock-job-2',
      success: true,
      station: 'BAR',
      bytesWritten: 0,
      attempts: 0,
    });

    wireLanOrderToPrinter(daemon, { autoPrintBar: false });

    const mockOrder: LanOrderPayload = {
      orderId: 'ORD-NO-PRINT-2',
      tenantId: 'tenant-100hich-01',
      tableNumber: 'T2',
      items: [{ id: '1', name: 'آیس لاته', quantity: 1, unitPrice: 150000 }],
      subtotal: 150000,
      timestamp: Date.now(),
    };

    (daemon as any).onOrderReceivedCallback(mockOrder);
    await new Promise((r) => setTimeout(r, 20));

    expect(dispatchSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });
});
