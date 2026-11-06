/**
 * CAFE OS — Raw TCP / ESC-POS Local Hardware Gateway & Print Spooler Daemon
 * Path: src/services/printerBridge.ts
 *
 * Implements:
 * 1. Raw TCP socket communication with physical thermal printers over Port 9100.
 * 2. Dedicated FIFO queues per Prep Station (BAR vs KITCHEN) preventing race conditions and interleaved ticket prints.
 * 3. Automatic retry mechanism with linear backoff for transient printer network drops or offline states.
 * 4. Station health monitoring ('IDLE' | 'BUSY' | 'OFFLINE' | 'ERROR').
 * 5. Clean integration with TicketLayoutEngine ESC/POS command buffers and StationRouter split tickets.
 * 6. Standalone or Express-mountable HTTP bridge daemon for browser-to-hardware dispatching.
 */

import net from 'net';
import http from 'http';
import {
  PrepStation,
  StationDispatchTicket,
  SplitTicketResult,
} from './StationRouter';
import { TicketLayoutEngine } from '../templates/KitchenTicketTemplate';
import { PersianEscPosRenderer, PersianReceiptLine } from '../hardware/persianEscPos';
import { RasterLogoRenderer } from '../hardware/rasterLogoRenderer';
import { ImageLoader } from '../hardware/imageLoader';

export type SpoolerJobStatus = 'QUEUED' | 'SENDING' | 'SUCCESS' | 'FAILED';
export type StationStatus = 'IDLE' | 'BUSY' | 'OFFLINE' | 'ERROR';

export interface StationPrinterConfig {
  host: string;
  port: number;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface PrintJob {
  id: string;
  station: PrepStation;
  data: Buffer;
  status: SpoolerJobStatus;
  attempts: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
  ticketId?: string | number;
  tableLabel?: string;
}

export interface PrintJobResult {
  jobId: string;
  success: boolean;
  station: PrepStation;
  bytesWritten: number;
  attempts: number;
  error?: string;
}

export const DEFAULT_PRINTER_CONFIGS: Record<'BAR' | 'KITCHEN', StationPrinterConfig> = {
  BAR: {
    host: '127.0.0.1',
    port: 9100,
    timeoutMs: 3000,
    maxRetries: 3,
    retryDelayMs: 250,
  },
  KITCHEN: {
    host: '127.0.0.1',
    port: 9100,
    timeoutMs: 3000,
    maxRetries: 3,
    retryDelayMs: 250,
  },
};

type BridgeEvent = 'jobEnqueued' | 'jobCompleted' | 'jobFailed' | 'stationStatusChanged';
type EventListener = (...args: any[]) => void;

/**
 * Low-level Raw TCP socket dispatcher over port 9100.
 */
export async function sendRawTcp(
  host: string,
  port: number,
  data: Buffer | Uint8Array,
  timeoutMs: number = 3000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isSettled = false;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    const cleanup = () => {
      socket.removeAllListeners();
      if (!socket.destroyed) {
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error(`TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`));
      }
    });

    socket.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(err);
      }
    });

    socket.connect(port, host, () => {
      socket.write(buffer, (writeErr) => {
        if (writeErr) {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            reject(writeErr);
          }
          return;
        }
        socket.end();
      });
    });

    socket.on('close', (hadError) => {
      if (!isSettled) {
        isSettled = true;
        const bytesWritten = buffer.length;
        cleanup();
        if (hadError) {
          reject(new Error(`TCP connection to ${host}:${port} closed with transmission error`));
        } else {
          resolve(bytesWritten);
        }
      }
    });
  });
}

/**
 * Local Hardware Print Spooler Daemon & Station Gateway
 */
export class LocalPrintSpoolerBridge {
  private configs: Record<'BAR' | 'KITCHEN', StationPrinterConfig>;
  private queues: Map<'BAR' | 'KITCHEN', PrintJob[]> = new Map();
  private processing: Map<'BAR' | 'KITCHEN', boolean> = new Map();
  private stationStatuses: Map<'BAR' | 'KITCHEN', StationStatus> = new Map();
  private listeners: Map<BridgeEvent, Set<EventListener>> = new Map();
  private httpServer: http.Server | null = null;
  private jobCounter = 0;

  constructor(customConfigs?: Partial<Record<'BAR' | 'KITCHEN', Partial<StationPrinterConfig>>>) {
    this.configs = {
      BAR: { ...DEFAULT_PRINTER_CONFIGS.BAR, ...(customConfigs?.BAR || {}) },
      KITCHEN: { ...DEFAULT_PRINTER_CONFIGS.KITCHEN, ...(customConfigs?.KITCHEN || {}) },
    };

    this.queues.set('BAR', []);
    this.queues.set('KITCHEN', []);
    this.processing.set('BAR', false);
    this.processing.set('KITCHEN', false);
    this.stationStatuses.set('BAR', 'IDLE');
    this.stationStatuses.set('KITCHEN', 'IDLE');
  }

  public setStationConfig(station: 'BAR' | 'KITCHEN', config: Partial<StationPrinterConfig>): void {
    this.configs[station] = { ...this.configs[station], ...config };
  }

  public getStationConfig(station: 'BAR' | 'KITCHEN'): Readonly<StationPrinterConfig> {
    return { ...this.configs[station] };
  }

  public getStationStatus(station: 'BAR' | 'KITCHEN'): StationStatus {
    return this.stationStatuses.get(station) || 'IDLE';
  }

  private setStationStatus(station: 'BAR' | 'KITCHEN', status: StationStatus): void {
    const current = this.stationStatuses.get(station);
    if (current !== status) {
      this.stationStatuses.set(station, status);
      this.emit('stationStatusChanged', station, status);
    }
  }

  public getQueue(station: 'BAR' | 'KITCHEN'): ReadonlyArray<PrintJob> {
    return [...(this.queues.get(station) || [])];
  }

  public clearQueue(station: 'BAR' | 'KITCHEN'): void {
    const queue = this.queues.get(station);
    if (queue) {
      queue.length = 0;
    }
    if (!this.processing.get(station)) {
      this.setStationStatus(station, 'IDLE');
    }
  }

  public on(event: BridgeEvent, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: BridgeEvent, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`[PrintBridge] Error in ${event} listener:`, err);
        }
      }
    }
  }

  /**
   * Enqueues a raw byte buffer or Uint8Array to a station spooler queue.
   */
  public async dispatchRaw(
    station: 'BAR' | 'KITCHEN',
    data: Buffer | Uint8Array,
    metadata?: { ticketId?: string | number; tableLabel?: string }
  ): Promise<PrintJobResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const jobId = `job-${Date.now()}-${++this.jobCounter}`;

    const job: PrintJob = {
      id: jobId,
      station,
      data: buffer,
      status: 'QUEUED',
      attempts: 0,
      createdAt: Date.now(),
      ticketId: metadata?.ticketId,
      tableLabel: metadata?.tableLabel,
    };

    const queue = this.queues.get(station)!;
    queue.push(job);
    this.emit('jobEnqueued', job);

    return new Promise<PrintJobResult>((resolve) => {
      const checkCompletion = (completedJob: PrintJob, result: PrintJobResult) => {
        if (completedJob.id === jobId) {
          resolve(result);
        }
      };

      const unsubSuccess = this.on('jobCompleted', checkCompletion);
      const unsubFailed = this.on('jobFailed', (failedJob: PrintJob, result: PrintJobResult) => {
        if (failedJob.id === jobId) {
          unsubSuccess();
          unsubFailed();
          resolve(result);
        }
      });

      this.processQueue(station).catch((err) => {
        console.error(`[PrintBridge] Queue processing error on station ${station}:`, err);
      });
    });
  }

  /**
   * Dispatches a StationDispatchTicket by converting it to ESC/POS binary buffer.
   */
  public async dispatchTicket(ticket: StationDispatchTicket): Promise<PrintJobResult> {
    if (ticket.station !== 'BAR' && ticket.station !== 'KITCHEN') {
      return {
        jobId: `skipped-${Date.now()}`,
        success: false,
        station: ticket.station,
        bytesWritten: 0,
        attempts: 0,
        error: `Station ${ticket.station} is not a printable hardware target (NO_PREP)`,
      };
    }

    const escPosBuffer = typeof (TicketLayoutEngine as any).generateEscPosBuffer === 'function'
      ? (TicketLayoutEngine as any).generateEscPosBuffer(ticket)
      : TicketLayoutEngine.renderEscPosBinary(ticket);
    return this.dispatchRaw(ticket.station, escPosBuffer, {
      ticketId: ticket.ticketId,
      tableLabel: ticket.tableLabel,
    });
  }

  /**
   * Dispatches split tickets across Bar and Kitchen stations in parallel.
   */
  public async splitAndDispatch(splitResult: SplitTicketResult): Promise<{
    bar?: PrintJobResult;
    kitchen?: PrintJobResult;
  }> {
    const promises: Promise<any>[] = [];
    let barPromise: Promise<PrintJobResult> | undefined;
    let kitchenPromise: Promise<PrintJobResult> | undefined;

    if (splitResult.hasBarItems && splitResult.barTicket) {
      barPromise = this.dispatchTicket(splitResult.barTicket);
      promises.push(barPromise);
    }

    if (splitResult.hasKitchenItems && splitResult.kitchenTicket) {
      kitchenPromise = this.dispatchTicket(splitResult.kitchenTicket);
      promises.push(kitchenPromise);
    }

    await Promise.all(promises);

    return {
      bar: barPromise ? await barPromise : undefined,
      kitchen: kitchenPromise ? await kitchenPromise : undefined,
    };
  }

  /**
   * Sequential worker for a single station queue.
   */
  private async processQueue(station: 'BAR' | 'KITCHEN'): Promise<void> {
    if (this.processing.get(station)) {
      return;
    }

    this.processing.set(station, true);
    const queue = this.queues.get(station)!;
    const config = this.configs[station];

    while (queue.length > 0) {
      const job = queue[0];
      job.status = 'SENDING';
      this.setStationStatus(station, 'BUSY');

      let success = false;
      let lastError: any = null;
      let bytesSent = 0;

      while (job.attempts < config.maxRetries && !success) {
        job.attempts++;
        try {
          bytesSent = await sendRawTcp(config.host, config.port, job.data, config.timeoutMs);
          success = true;
        } catch (err: any) {
          lastError = err;
          if (job.attempts < config.maxRetries) {
            await new Promise((r) => setTimeout(r, config.retryDelayMs * job.attempts));
          }
        }
      }

      queue.shift(); // Remove job from queue
      job.completedAt = Date.now();

      if (success) {
        job.status = 'SUCCESS';
        this.setStationStatus(station, queue.length > 0 ? 'BUSY' : 'IDLE');
        const result: PrintJobResult = {
          jobId: job.id,
          success: true,
          station,
          bytesWritten: bytesSent,
          attempts: job.attempts,
        };
        this.emit('jobCompleted', job, result);
      } else {
        job.status = 'FAILED';
        job.error = lastError?.message || 'Print dispatch failed';
        this.setStationStatus(station, 'OFFLINE');
        const result: PrintJobResult = {
          jobId: job.id,
          success: false,
          station,
          bytesWritten: 0,
          attempts: job.attempts,
          error: job.error,
        };
        this.emit('jobFailed', job, result);
      }
    }

    this.processing.set(station, false);
    if (this.getStationStatus(station) === 'BUSY') {
      this.setStationStatus(station, 'IDLE');
    }
  }

  /**
   * Starts a local HTTP daemon to receive web print requests and route to Port 9100.
   */
  public async startDaemon(httpPort: number = 9101): Promise<http.Server> {
    if (this.httpServer) {
      return this.httpServer;
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method === 'GET' && req.url === '/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'running',
              barStatus: this.getStationStatus('BAR'),
              kitchenStatus: this.getStationStatus('KITCHEN'),
              barQueueLength: this.getQueue('BAR').length,
              kitchenQueueLength: this.getQueue('KITCHEN').length,
            })
          );
          return;
        }

        if (req.method === 'POST' && req.url === '/print') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          req.on('end', async () => {
            const rawBody = Buffer.concat(chunks);
            const stationHeader = (req.headers['x-prep-station'] as string) || 'BAR';
            const station: 'BAR' | 'KITCHEN' = stationHeader.toUpperCase() === 'KITCHEN' ? 'KITCHEN' : 'BAR';

            try {
              const result = await this.dispatchRaw(station, rawBody);
              res.writeHead(result.success ? 200 : 502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      server.listen(httpPort, '127.0.0.1', () => {
        this.httpServer = server;
        resolve(server);
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async stopDaemon(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = null;
    }
  }

  public isDaemonRunning(): boolean {
    return this.httpServer !== null;
  }

  /**
   * Dispatches a print job utilizing Font B Persian formatting before raw TCP transmission on port 9100.
   */
  public async dispatchPrintJob(
    station: 'BAR' | 'KITCHEN' | PrepStation,
    payload: string | StationDispatchTicket | any,
    options?: Partial<StationPrinterConfig>
  ): Promise<PrintJobResult> {
    return dispatchPrintJob(station, payload, options, this);
  }
}

export const localPrintSpooler = new LocalPrintSpoolerBridge();

/**
 * Dispatches a print job with automated Font B (56 columns) Persian formatting
 * before raw TCP transmission on port 9100.
 */
export async function dispatchPrintJob(
  station: 'BAR' | 'KITCHEN' | PrepStation,
  payload: string | StationDispatchTicket | {
    text?: string;
    ticketId?: string | number;
    orderNumber?: string | number;
    tableLabel?: string;
    items?: Array<{ name: string; quantity: number; notes?: string; priceToman?: number }>;
    totalAmountToman?: number;
    rawBuffer?: Buffer;
  },
  options?: Partial<StationPrinterConfig>,
  spoolerInstance: LocalPrintSpoolerBridge = localPrintSpooler
): Promise<PrintJobResult> {
  let buffer: Buffer;

  if (Buffer.isBuffer(payload)) {
    buffer = payload;
  } else if (typeof payload === 'string') {
    const renderer = new PersianEscPosRenderer(56);
    renderer
      .init()
      .selectFontB()
      .line(payload)
      .cut();
    buffer = renderer.toBuffer();
  } else if (typeof payload === 'object' && 'rawBuffer' in payload && payload.rawBuffer) {
    buffer = payload.rawBuffer;
  } else if (typeof payload === 'object' && 'items' in payload && Array.isArray((payload as any).items)) {
    buffer = PersianEscPosRenderer.renderTicket({
      station: station as string,
      ticketId: (payload as any).ticketId,
      orderNumber: (payload as any).orderNumber || (payload as any).ticketId,
      tableLabel: (payload as any).tableLabel,
      items: (payload as any).items,
      totalAmountToman: (payload as any).totalAmountToman,
    });
  } else if (typeof payload === 'object' && 'text' in payload && (payload as any).text) {
    const renderer = new PersianEscPosRenderer(56);
    renderer
      .init()
      .selectFontB()
      .line((payload as any).text)
      .cut();
    buffer = renderer.toBuffer();
  } else {
    const ticket = payload as StationDispatchTicket;
    buffer = PersianEscPosRenderer.renderTicket({
      station: ticket.station,
      ticketId: ticket.ticketId,
      orderNumber: ticket.ticketId,
      tableLabel: ticket.tableLabel,
      items: ticket.items.map((i) => ({
        name: i.title || (i as any).name || 'آیتم سفارش',
        quantity: i.quantity || 1,
        notes: Array.isArray(i.notes) ? i.notes.join(', ') : i.notes || undefined,
        priceToman: i.subtotal || i.unitPrice || 0,
      })),
    });
  }

  if (station !== 'BAR' && station !== 'KITCHEN') {
    return {
      jobId: 'skipped-' + Date.now(),
      success: false,
      station,
      bytesWritten: 0,
      attempts: 0,
      error: 'Station ' + station + ' is not a printable hardware target (NO_PREP)',
    };
  }

  if (options) {
    spoolerInstance.setStationConfig(station, options);
  }

  return spoolerInstance.dispatchRaw(station, buffer, {
    ticketId: typeof payload === 'object' && 'ticketId' in payload ? (payload as any).ticketId : undefined,
    tableLabel: typeof payload === 'object' && 'tableLabel' in payload ? (payload as any).tableLabel : undefined,
  });
}

/**
 * Generates a complete Persian ESC/POS ticket buffer with optional rasterized logo.
 */
export async function generateReceiptWithLogo(
  logoBase64: string | null,
  orderId: string,
  tableName: string,
  lines: PersianReceiptLine[]
): Promise<Buffer> {
  let logoBuffer: Buffer | null = null;

  if (logoBase64) {
    try {
      const pixelBuffer = await ImageLoader.fromBrowserSource(logoBase64, 576);
      logoBuffer = RasterLogoRenderer.toEscPosRaster(pixelBuffer, {
        dither: true,
        centerAlign: true,
        maxPrinterDots: 576,
      });
    } catch (err) {
      console.warn('Could not rasterize logo, falling back to text header:', err);
    }
  }

  return PersianEscPosRenderer.buildReceiptWithLogo(logoBuffer, orderId, tableName, lines);
}
