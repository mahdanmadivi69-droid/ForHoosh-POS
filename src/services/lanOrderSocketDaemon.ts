// src/services/lanOrderSocketDaemon.ts
import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';

export type ClientRole = 'KDS' | 'POS' | 'TABLE_CLIENT';

export interface LanOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number; // Integer Toman precision
  notes?: string;
}

export interface LanOrderPayload {
  orderId: string;
  tenantId: string;
  tableNumber: string;
  items: LanOrderItem[];
  subtotal: number;
  timestamp: number;
  notes?: string;
}

export interface WsMessageEnvelope {
  type: 'REGISTER' | 'ORDER_INJECT' | 'ORDER_ACK' | 'PING' | 'PONG' | 'ERROR';
  role?: ClientRole;
  tenantId?: string;
  tableNumber?: string;
  payload?: any;
  correlationId?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  role: ClientRole;
  tenantId: string;
  tableNumber?: string;
  isAlive: boolean;
}

export interface LanSocketConfig {
  port?: number;
  heartbeatIntervalMs?: number;
  maxPayloadBytes?: number;
}

export class LanOrderSocketDaemon {
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private clients = new Map<WebSocket, ConnectedClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private onOrderReceivedCallback?: (order: LanOrderPayload) => void;

  constructor(private config: LanSocketConfig = {}) {
    this.config.port = config.port ?? 9101;
    this.config.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 15000;
    this.config.maxPayloadBytes = config.maxPayloadBytes ?? 64 * 1024; // 64 KB limit
  }

  /**
   * Starts HTTP and WebSocket server on configured LAN port
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = createServer((req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'OK',
              activeClients: this.clients.size,
              uptime: process.uptime(),
            })
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });

      this.wss = new WebSocketServer({
        server: this.httpServer,
        maxPayload: this.config.maxPayloadBytes,
      });

      this.wss.on('connection', (ws: WebSocket) => this.handleConnection(ws));

      this.startHeartbeat();

      this.httpServer.listen(this.config.port, '0.0.0.0', () => {
        resolve();
      });
    });
  }

  /**
   * Registers a callback hook for local business logic (KDS storage / printing)
   */
  public onOrderReceived(callback: (order: LanOrderPayload) => void): void {
    this.onOrderReceivedCallback = callback;
  }

  private handleConnection(ws: WebSocket): void {
    const clientState: ConnectedClient = {
      ws,
      role: 'TABLE_CLIENT',
      tenantId: 'unassigned',
      isAlive: true,
    };
    this.clients.set(ws, clientState);

    ws.on('pong', () => {
      clientState.isAlive = true;
    });

    ws.on('message', (data: RawData) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, rawData: RawData): void {
    try {
      const msg: WsMessageEnvelope = JSON.parse(rawData.toString('utf-8'));
      const client = this.clients.get(ws);
      if (!client) return;

      switch (msg.type) {
        case 'REGISTER':
          this.handleRegister(client, msg);
          break;

        case 'ORDER_INJECT':
          this.handleOrderInjection(client, msg);
          break;

        case 'PING':
          this.sendEnvelope(ws, { type: 'PONG', correlationId: msg.correlationId });
          break;

        default:
          this.sendEnvelope(ws, {
            type: 'ERROR',
            payload: { message: `Unsupported message type: ${msg.type}` },
            correlationId: msg.correlationId,
          });
      }
    } catch {
      this.sendEnvelope(ws, {
        type: 'ERROR',
        payload: { message: 'Invalid JSON message envelope' },
      });
    }
  }

  private handleRegister(client: ConnectedClient, msg: WsMessageEnvelope): void {
    if (!msg.tenantId || !msg.role) {
      this.sendEnvelope(client.ws, {
        type: 'ERROR',
        payload: { message: 'Registration requires tenantId and role' },
        correlationId: msg.correlationId,
      });
      return;
    }

    client.tenantId = msg.tenantId;
    client.role = msg.role;
    client.tableNumber = msg.tableNumber;

    this.sendEnvelope(client.ws, {
      type: 'ORDER_ACK',
      payload: { status: 'REGISTERED', role: client.role, tenantId: client.tenantId },
      correlationId: msg.correlationId,
    });
  }

  private handleOrderInjection(client: ConnectedClient, msg: WsMessageEnvelope): void {
    const order = msg.payload as LanOrderPayload;

    // 1. Structural and Financial Validation
    if (
      !order ||
      !order.orderId ||
      !order.tenantId ||
      !order.tableNumber ||
      !Array.isArray(order.items) ||
      order.items.length === 0
    ) {
      this.sendEnvelope(client.ws, {
        type: 'ERROR',
        payload: { message: 'Incomplete order payload structure' },
        correlationId: msg.correlationId,
      });
      return;
    }

    // 2. Strict Tenant Scoping: Client cannot post orders for another tenant
    if (client.tenantId !== 'unassigned' && client.tenantId !== order.tenantId) {
      this.sendEnvelope(client.ws, {
        type: 'ERROR',
        payload: { message: 'Tenant mismatch: unauthorized order injection' },
        correlationId: msg.correlationId,
      });
      return;
    }

    // 3. Integer Precision Check: Prevent decimal precision errors
    const calculatedSubtotal = order.items.reduce((sum, item) => {
      const unit = Math.round(item.unitPrice);
      const qty = Math.max(1, Math.round(item.quantity));
      return sum + unit * qty;
    }, 0);

    if (calculatedSubtotal !== order.subtotal) {
      this.sendEnvelope(client.ws, {
        type: 'ERROR',
        payload: {
          message: 'Financial invariant violation: subtotal mismatch',
          expected: calculatedSubtotal,
          received: order.subtotal,
        },
        correlationId: msg.correlationId,
      });
      return;
    }

    // 4. Dispatch to Tenant KDS & POS Listeners
    let dispatchCount = 0;
    for (const target of this.clients.values()) {
      if (
        target.tenantId === order.tenantId &&
        (target.role === 'KDS' || target.role === 'POS') &&
        target.ws.readyState === WebSocket.OPEN
      ) {
        this.sendEnvelope(target.ws, {
          type: 'ORDER_INJECT',
          tenantId: order.tenantId,
          payload: order,
          correlationId: msg.correlationId,
        });
        dispatchCount++;
      }
    }

    // 5. Fire internal callback for daemon listeners (printer spooler, SQLite, Dexie sync)
    if (this.onOrderReceivedCallback) {
      this.onOrderReceivedCallback(order);
    }

    // 6. Return ACK to the ordering table client
    this.sendEnvelope(client.ws, {
      type: 'ORDER_ACK',
      payload: {
        status: 'DISPATCHED_TO_STATIONS',
        orderId: order.orderId,
        activeStationsNotified: dispatchCount,
      },
      correlationId: msg.correlationId,
    });
  }

  private sendEnvelope(ws: WebSocket, envelope: WsMessageEnvelope): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [ws, client] of this.clients.entries()) {
        if (!client.isAlive) {
          this.clients.delete(ws);
          ws.terminate();
          continue;
        }
        client.isAlive = false;
        ws.ping();
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Graceful server termination
   */
  public async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const [ws] of this.clients.entries()) {
      ws.terminate();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => resolve());
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }
}
