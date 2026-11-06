// tests/lanOrderSocketDaemon.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { LanOrderSocketDaemon, WsMessageEnvelope, LanOrderPayload } from '../src/services/lanOrderSocketDaemon';

describe('LanOrderSocketDaemon (Local Offline Order Injection)', () => {
  const TEST_PORT = 9199;
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

  function createClient(): Promise<WebSocket> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
      ws.on('open', () => resolve(ws));
    });
  }

  function sendAndWait(ws: WebSocket, payload: WsMessageEnvelope): Promise<WsMessageEnvelope> {
    return new Promise((resolve) => {
      const handler = (data: Buffer) => {
        ws.off('message', handler);
        resolve(JSON.parse(data.toString('utf-8')));
      };
      ws.on('message', handler);
      ws.send(JSON.stringify(payload));
    });
  }

  it('should register KDS station and respond with ORDER_ACK', async () => {
    const kdsWs = await createClient();

    const response = await sendAndWait(kdsWs, {
      type: 'REGISTER',
      role: 'KDS',
      tenantId: 'tenant-100hich-01',
      correlationId: 'reg-01',
    });

    expect(response.type).toBe('ORDER_ACK');
    expect(response.payload.status).toBe('REGISTERED');
    expect(response.payload.tenantId).toBe('tenant-100hich-01');

    kdsWs.close();
  });

  it('should dispatch valid table order to KDS and notify sender with ACK', async () => {
    const kdsWs = await createClient();
    const tableWs = await createClient();

    // 1. Register KDS
    await sendAndWait(kdsWs, {
      type: 'REGISTER',
      role: 'KDS',
      tenantId: 'tenant-100hich-01',
    });

    // 2. Set listener on KDS
    const kdsReceivedPromise = new Promise<WsMessageEnvelope>((resolve) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString('utf-8'));
        if (msg.type === 'ORDER_INJECT') {
          kdsWs.off('message', handler);
          resolve(msg);
        }
      };
      kdsWs.on('message', handler);
    });

    // 3. Inject order from table client
    const orderPayload: LanOrderPayload = {
      orderId: 'ORD-LAN-101',
      tenantId: 'tenant-100hich-01',
      tableNumber: 'T4',
      items: [
        { id: '1', name: 'Cortado', quantity: 2, unitPrice: 120000 },
        { id: '2', name: 'V60', quantity: 1, unitPrice: 180000 },
      ],
      subtotal: 420000,
      timestamp: Date.now(),
    };

    const ackResponse = await sendAndWait(tableWs, {
      type: 'ORDER_INJECT',
      tenantId: 'tenant-100hich-01',
      payload: orderPayload,
      correlationId: 'inject-01',
    });

    expect(ackResponse.type).toBe('ORDER_ACK');
    expect(ackResponse.payload.status).toBe('DISPATCHED_TO_STATIONS');
    expect(ackResponse.payload.activeStationsNotified).toBe(1);

    const kdsEnvelope = await kdsReceivedPromise;
    expect(kdsEnvelope.type).toBe('ORDER_INJECT');
    expect(kdsEnvelope.payload.orderId).toBe('ORD-LAN-101');
    expect(kdsEnvelope.payload.subtotal).toBe(420000);

    kdsWs.close();
    tableWs.close();
  });

  it('should strictly isolate orders across tenants (Modendo vs 100 Hich)', async () => {
    const modendoKds = await createClient();
    const hichTable = await createClient();

    // Register Modendo KDS
    await sendAndWait(modendoKds, {
      type: 'REGISTER',
      role: 'KDS',
      tenantId: 'tenant-modendo-01',
    });

    let modendoLeaked = false;
    modendoKds.on('message', () => {
      modendoLeaked = true;
    });

    // Send order intended strictly for 100 Hich
    const hichOrder: LanOrderPayload = {
      orderId: 'ORD-HICH-001',
      tenantId: 'tenant-100hich-01',
      tableNumber: 'T1',
      items: [{ id: '1', name: 'Espresso', quantity: 1, unitPrice: 100000 }],
      subtotal: 100000,
      timestamp: Date.now(),
    };

    const ack = await sendAndWait(hichTable, {
      type: 'ORDER_INJECT',
      tenantId: 'tenant-100hich-01',
      payload: hichOrder,
    });

    // 0 stations should be notified because 100hich KDS is not connected
    expect(ack.payload.activeStationsNotified).toBe(0);

    // Wait a brief tick to ensure no message leaked to Modendo KDS
    await new Promise((r) => setTimeout(r, 50));
    expect(modendoLeaked).toBe(false);

    modendoKds.close();
    hichTable.close();
  });

  it('should reject orders with corrupted subtotal calculations', async () => {
    const tableWs = await createClient();

    const corruptedOrder: LanOrderPayload = {
      orderId: 'ORD-CORRUPT-1',
      tenantId: 'tenant-100hich-01',
      tableNumber: 'T2',
      items: [{ id: '1', name: 'Latte', quantity: 1, unitPrice: 140000 }],
      subtotal: 999999, // Mismatched intentionally
      timestamp: Date.now(),
    };

    const response = await sendAndWait(tableWs, {
      type: 'ORDER_INJECT',
      tenantId: 'tenant-100hich-01',
      payload: corruptedOrder,
    });

    expect(response.type).toBe('ERROR');
    expect(response.payload.message).toContain('Financial invariant violation');

    tableWs.close();
  });
});
