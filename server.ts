/**
 * CAFE OS — Full-Stack Express Server & Vite Dev Middleware
 * Hosts API endpoints for Multi-Tenant RLS Orders Sync, Barista Webhooks, and POS Static Assets.
 */

// Ensure HMR is disabled in container / iframe proxy environment
process.env.DISABLE_HMR = 'true';

import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { insertOrderAggregateAtomic } from './src/services/dbOrderService';
import { OrderAggregate } from './src/types/order-domain';
import {
  processOfflineOrderSync,
  defaultDatabaseClient,
  SyncOrderPayload,
} from './src/services/sync-order-handler';
import { handleOrderSync } from './src/services/sync-controller';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // In-memory Barista Queue for backend webhook storage
  const baristaWebhookTickets: any[] = [];

  // -------------------------------------------------------------
  // API Route: Idempotent Orders Sync (Phase 4 Task 1)
  // -------------------------------------------------------------
  app.post('/api/v1/orders/sync', async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.order?.tenantId;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.clientGeneratedId;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required header: X-Tenant-Id' });
        return;
      }

      if (!idempotencyKey) {
        res.status(400).json({ error: 'Missing required header: Idempotency-Key or clientGeneratedId' });
        return;
      }

      const order = req.body?.order as OrderAggregate;
      if (!order) {
        res.status(400).json({ error: 'Missing order aggregate payload in request body' });
        return;
      }

      // Ensure clientGeneratedId aligns with Idempotency header
      order.clientGeneratedId = idempotencyKey;
      order.tenantId = tenantId;

      // Atomic persistence with PostgreSQL RLS & integer Toman invariants
      const result = await insertOrderAggregateAtomic(tenantId, order);

      // If state is PAID, record for Barista display
      if (order.state === 'PAID') {
        const existingIdx = baristaWebhookTickets.findIndex((t) => t.orderId === result.orderId);
        const ticketData = {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          clientGeneratedId: order.clientGeneratedId,
          tenantId,
          orderType: order.orderType,
          tableLabel: order.tableLabel,
          customerName: order.customerName,
          items: order.items.map((i) => ({
            itemName: i.itemNameSnapshot,
            quantity: i.quantity,
            modifiers: i.modifiers.map((m) => m.nameFa),
            notes: i.notes,
          })),
          paidAt: new Date().toISOString(),
          prepStatus: 'PENDING',
        };

        if (existingIdx >= 0) {
          baristaWebhookTickets[existingIdx] = ticketData;
        } else {
          baristaWebhookTickets.unshift(ticketData);
        }
      }

      // Inventory Allocation & Overdraft Conflict Tracking
      const syncPayload: SyncOrderPayload = {
        tenantId,
        clientGeneratedId: idempotencyKey,
        source: (req.body?.source as 'POS' | 'SMART_ORDERS') || 'POS',
        order: {
          items: (order.items || []).map((i: any) => ({
            productId: i.productId || i.menuItemId,
            quantity: i.quantity,
            name: i.name || i.itemNameSnapshot || 'کالا',
          })),
          totalNet: order.netTotalToman || (order as any).totalNet || 0,
          payments: (order.payments || []).map((p: any) => ({
            method: p.paymentMethod || (p as any).method || 'POS_TERMINAL',
            amount: p.amountToman || (p as any).amount || 0,
            referenceNumber: p.referenceCode || (p as any).referenceNumber,
          })),
          createdAt: order.createdAt || new Date().toISOString(),
        },
      };

      const syncResult = await processOfflineOrderSync(defaultDatabaseClient, syncPayload);

      res.status(200).json({
        success: true,
        isIdempotentReplay: result.isIdempotentReplay || syncResult.status === 'ALREADY_SYNCED',
        status: syncResult.status,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        hasInventoryConflicts: syncResult.hasInventoryConflicts || false,
        conflicts: syncResult.conflicts || [],
        message: result.message || 'Order aggregate synchronized atomically.',
      });
    } catch (err: any) {
      console.error('Error in /api/v1/orders/sync:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal database persistence error',
      });
    }
  });

  // Dedicated Sync Controller Endpoint
  app.post('/api/v1/sync/orders', handleOrderSync);

  // -------------------------------------------------------------
  // API Route: Barista Webhook Incoming Receiver (Phase 4 Task 3)
  // -------------------------------------------------------------
  app.post('/api/v1/barista/incoming', (req: Request, res: Response) => {
    const payload = req.body;
    if (payload?.ticket) {
      const idx = baristaWebhookTickets.findIndex((t) => t.orderId === payload.ticket.orderId);
      if (idx >= 0) {
        baristaWebhookTickets[idx] = payload.ticket;
      } else {
        baristaWebhookTickets.unshift(payload.ticket);
      }
    }
    res.status(200).json({ received: true, event: payload?.event || 'ORDER_PAID' });
  });

  app.get('/api/v1/barista/tickets', (req: Request, res: Response) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    const tickets = tenantId
      ? baristaWebhookTickets.filter((t) => t.tenantId === tenantId)
      : baristaWebhookTickets;
    res.status(200).json({ tickets });
  });

  app.post('/api/v1/barista/tickets/:orderId/status', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { prepStatus } = req.body;
    const ticket = baristaWebhookTickets.find((t) => t.orderId === orderId);
    if (ticket) {
      ticket.prepStatus = prepStatus;
      if (prepStatus === 'IN_PREP' && !ticket.startedAt) ticket.startedAt = new Date().toISOString();
      if (prepStatus === 'READY') ticket.completedAt = new Date().toISOString();
      res.status(200).json({ success: true, ticket });
    } else {
      res.status(404).json({ error: 'Ticket not found' });
    }
  });

  const server = http.createServer(app);

  // -------------------------------------------------------------
  // Vite Middleware / Static Server
  // -------------------------------------------------------------
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`☕ CAFE OS Server running on port ${PORT} [Mode: ${isProduction ? 'Production' : 'Dev'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
