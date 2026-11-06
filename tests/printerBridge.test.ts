/**
 * CAFE OS — Raw TCP / ESC-POS Local Hardware Gateway Test Suite
 * Path: tests/printerBridge.test.ts
 *
 * Verifies:
 * 1. Raw TCP socket communication with thermal hardware over port 9100.
 * 2. Dedicated FIFO queueing per Prep Station (BAR vs KITCHEN).
 * 3. Exact ESC/POS opcode validation (ESC @ [0x1B, 0x40], Paper Cut [0x1D, 0x56, 0x00]).
 * 4. Automatic retry mechanics with backoff on network drops / offline states.
 * 5. Split ticket integration with StationRouter and TicketLayoutEngine.
 * 6. Local HTTP print spooler daemon (/print, /status).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import net from 'net';
import http from 'http';
import {
  LocalPrintSpoolerBridge,
  sendRawTcp,
  StationPrinterConfig,
} from '../src/services/printerBridge';
import {
  StationRouter,
  RoutableCartItem,
  StationDispatchTicket,
  SplitTicketResult,
} from '../src/services/StationRouter';
import { TicketLayoutEngine, ESC_POS_COMMANDS } from '../src/templates/KitchenTicketTemplate';

interface MockThermalPrinter {
  server: net.Server;
  port: number;
  receivedBuffers: Buffer[];
  connectionCount: number;
  shouldFailTimes: number;
  close: () => Promise<void>;
}

function createMockThermalPrinter(desiredPort: number = 0): Promise<MockThermalPrinter> {
  return new Promise((resolve, reject) => {
    const receivedBuffers: Buffer[] = [];
    let connectionCount = 0;
    let shouldFailTimes = 0;

    const server = net.createServer((socket) => {
      connectionCount++;

      socket.on('error', () => {
        // Ignore client/server disconnect errors in tests
      });

      if (shouldFailTimes > 0) {
        shouldFailTimes--;
        socket.destroy();
        return;
      }

      const chunks: Buffer[] = [];
      socket.on('data', (chunk) => {
        chunks.push(chunk);
      });

      socket.on('close', () => {
        if (chunks.length > 0) {
          receivedBuffers.push(Buffer.concat(chunks));
        }
      });
    });

    server.listen(desiredPort, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      const printer: MockThermalPrinter = {
        server,
        port: addr.port,
        receivedBuffers,
        get connectionCount() {
          return connectionCount;
        },
        get shouldFailTimes() {
          return shouldFailTimes;
        },
        set shouldFailTimes(val: number) {
          shouldFailTimes = val;
        },
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      };
      resolve(printer);
    });

    server.on('error', reject);
  });
}

async function waitForBufferCount(printer: MockThermalPrinter, expectedCount: number, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (printer.receivedBuffers.length < expectedCount && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('Raw TCP / ESC-POS Hardware Gateway (LocalPrintSpoolerBridge)', () => {
  let barPrinter: MockThermalPrinter;
  let kitchenPrinter: MockThermalPrinter;
  let spooler: LocalPrintSpoolerBridge;

  beforeAll(async () => {
    barPrinter = await createMockThermalPrinter();
    kitchenPrinter = await createMockThermalPrinter();
  });

  afterAll(async () => {
    await barPrinter.close();
    await kitchenPrinter.close();
  });

  beforeEach(() => {
    barPrinter.receivedBuffers.length = 0;
    kitchenPrinter.receivedBuffers.length = 0;
    barPrinter.shouldFailTimes = 0;
    kitchenPrinter.shouldFailTimes = 0;

    spooler = new LocalPrintSpoolerBridge({
      BAR: {
        host: '127.0.0.1',
        port: barPrinter.port,
        timeoutMs: 1500,
        maxRetries: 3,
        retryDelayMs: 40,
      },
      KITCHEN: {
        host: '127.0.0.1',
        port: kitchenPrinter.port,
        timeoutMs: 1500,
        maxRetries: 3,
        retryDelayMs: 40,
      },
    });
  });

  it('verifies low-level sendRawTcp delivers raw buffer to port 9100 / mock socket', async () => {
    const rawPayload = Buffer.from([0x1b, 0x40, 0x48, 0x45, 0x4c, 0x4c, 0x4f, 0x1d, 0x56, 0x00]);
    const bytesWritten = await sendRawTcp('127.0.0.1', barPrinter.port, rawPayload, 2000);

    await waitForBufferCount(barPrinter, 1);
    expect(bytesWritten).toBe(rawPayload.length);
    expect(barPrinter.receivedBuffers.length).toBe(1);
    expect(barPrinter.receivedBuffers[0]).toEqual(rawPayload);
  });

  it('rejects sendRawTcp with error when target port is unreachable or refused', async () => {
    const unreachablePort = 59998;
    await expect(
      sendRawTcp('127.0.0.1', unreachablePort, Buffer.from('test'), 500)
    ).rejects.toThrow();
  });

  it('dispatches raw ESC/POS ticket to BAR station with correct header and cut opcodes', async () => {
    const testItems: RoutableCartItem[] = [
      {
        id: 'item-1',
        title: 'اسپرسو دوبل ۱۰۰٪ عربیکا',
        quantity: 2,
        station: 'BAR',
        modifiers: ['شیر جو دوسر', 'کم شیرین'],
        notes: 'سرو در فنجان سرامیکی داغ',
      },
    ];

    const ticket: StationDispatchTicket = {
      station: 'BAR',
      stationTitle: 'بار باریستا',
      ticketId: 'BAR-101',
      orderNumber: 42,
      tableLabel: 'میز ۴',
      cashierName: 'سارا رضایی',
      timeStr: '14:30:00',
      items: testItems,
      isDelta: false,
    };

    const result = await spooler.dispatchTicket(ticket);

    expect(result.success).toBe(true);
    expect(result.station).toBe('BAR');
    expect(result.bytesWritten).toBeGreaterThan(0);

    await waitForBufferCount(barPrinter, 1);
    expect(barPrinter.receivedBuffers.length).toBe(1);

    const received = barPrinter.receivedBuffers[0];
    // Check ESC @ init opcode (0x1B, 0x40)
    expect(received[0]).toBe(0x1b);
    expect(received[1]).toBe(0x40);

    // Check paper cut opcode (GS V 0: 0x1D, 0x56, 0x00)
    const cutIndex = received.indexOf(Buffer.from([0x1d, 0x56, 0x00]));
    expect(cutIndex).toBeGreaterThan(0);
  });

  it('verifies station isolation: BAR items route only to Bar and KITCHEN items only to Kitchen', async () => {
    const barTicket: StationDispatchTicket = {
      station: 'BAR',
      stationTitle: 'بار باریستا',
      ticketId: 'BAR-201',
      orderNumber: 50,
      tableLabel: 'میز ۲',
      cashierName: 'علی',
      timeStr: '15:00:00',
      items: [
        {
          id: 'b1',
          title: 'لاته آرت',
          quantity: 1,
          station: 'BAR',
        },
      ],
      isDelta: false,
    };

    const kitchenTicket: StationDispatchTicket = {
      station: 'KITCHEN',
      stationTitle: 'آشپزخانه و بار گرم',
      ticketId: 'KIT-201',
      orderNumber: 50,
      tableLabel: 'میز ۲',
      cashierName: 'علی',
      timeStr: '15:00:00',
      items: [
        {
          id: 'k1',
          title: 'پنینی مرغ و پستو',
          quantity: 2,
          station: 'KITCHEN',
        },
      ],
      isDelta: false,
    };

    const splitResult: SplitTicketResult = {
      isDelta: false,
      barTicket,
      kitchenTicket,
      noPrepItems: [],
      hasBarItems: true,
      hasKitchenItems: true,
      hasNoPrepItems: false,
      hasItemsToDispatch: true,
      newDispatchedIds: ['b1', 'k1'],
      totalItemsDispatched: 2,
    };

    const dispatchSummary = await spooler.splitAndDispatch(splitResult);

    expect(dispatchSummary.bar?.success).toBe(true);
    expect(dispatchSummary.kitchen?.success).toBe(true);

    await waitForBufferCount(barPrinter, 1);
    await waitForBufferCount(kitchenPrinter, 1);

    expect(barPrinter.receivedBuffers.length).toBe(1);
    expect(kitchenPrinter.receivedBuffers.length).toBe(1);

    // BAR ticket contains Bar item title in UTF-8
    const barContent = barPrinter.receivedBuffers[0].toString('utf8');
    expect(barContent).toContain('لاته آرت');
    expect(barContent).not.toContain('پنینی مرغ');

    // KITCHEN ticket contains Kitchen item title
    const kitchenContent = kitchenPrinter.receivedBuffers[0].toString('utf8');
    expect(kitchenContent).toContain('پنینی مرغ');
    expect(kitchenContent).not.toContain('لاته آرت');
  });

  it('verifies FIFO queueing and sequential delivery for burst order submissions', async () => {
    const jobPromises = [];
    const count = 5;

    for (let i = 1; i <= count; i++) {
      const data = Buffer.from(`TICKET_SEQ_${i}\n`);
      jobPromises.push(spooler.dispatchRaw('BAR', data, { ticketId: i }));
    }

    const results = await Promise.all(jobPromises);
    expect(results.every((r) => r.success)).toBe(true);

    await waitForBufferCount(barPrinter, count);
    expect(barPrinter.receivedBuffers.length).toBe(count);

    // Verify exact arrival order
    for (let i = 0; i < count; i++) {
      expect(barPrinter.receivedBuffers[i].toString('utf8')).toContain(`TICKET_SEQ_${i + 1}`);
    }
  });

  it('retries on transient socket failure and recovers successfully', async () => {
    barPrinter.shouldFailTimes = 2;

    const data = Buffer.from('TRANSIENT_RETRY_TICKET\n');
    const result = await spooler.dispatchRaw('BAR', data);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);

    await waitForBufferCount(barPrinter, 1);
    expect(barPrinter.receivedBuffers.length).toBe(1);
    expect(spooler.getStationStatus('BAR')).toBe('IDLE');
  });

  it('marks job as FAILED and sets station status to OFFLINE when retries are exhausted', async () => {
    barPrinter.shouldFailTimes = 10;

    const data = Buffer.from('OFFLINE_TEST_TICKET\n');
    const result = await spooler.dispatchRaw('BAR', data);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.error).toBeDefined();
    expect(spooler.getStationStatus('BAR')).toBe('OFFLINE');
  });

  it('spawns local HTTP spooler daemon and accepts POST /print and GET /status', async () => {
    const httpPort = 9109;
    await spooler.startDaemon(httpPort);
    expect(spooler.isDaemonRunning()).toBe(true);

    try {
      // 1. Check status endpoint
      const statusRes = await new Promise<any>((resolve, reject) => {
        http.get(`http://127.0.0.1:${httpPort}/status`, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });

      expect(statusRes.status).toBe('running');
      expect(statusRes.barStatus).toBe('IDLE');

      // 2. Send POST /print request
      const printRes = await new Promise<any>((resolve, reject) => {
        const req = http.request(
          `http://127.0.0.1:${httpPort}/print`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Prep-Station': 'BAR',
            },
          },
          (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve(JSON.parse(body)));
          }
        );
        req.on('error', reject);
        req.write(Buffer.from('HTTP_BRIDGE_RAW_TICKET\n'));
        req.end();
      });

      expect(printRes.success).toBe(true);
      expect(printRes.station).toBe('BAR');

      await waitForBufferCount(barPrinter, 1);
      expect(barPrinter.receivedBuffers.length).toBe(1);
      expect(barPrinter.receivedBuffers[0].toString('utf8')).toContain('HTTP_BRIDGE_RAW_TICKET');
    } finally {
      await spooler.stopDaemon();
      expect(spooler.isDaemonRunning()).toBe(false);
    }
  });
});
