/**
 * server/cloudTelemetryRoutes.ts
 * 
 * CafeOS / SmartOrders Cloud Telemetry & Remote Command API Routes (Phase 2 Stage B)
 * Authored by: alpha (Cloud Telemetry & License Specialist)
 * Designed for:
 *  - Native Node.js HTTP microservice execution (Liara target, <128MB RAM footprint)
 *  - Express router middleware integration
 * Strict Invariants:
 *  - [INTEGER_TOMAN_PRECISION]: Schema rejection for float prices on command push
 *  - [TENANT_ISOLATION_MANDATORY]: Strict tenant validation and scoping
 */

import http from 'http';
import { Router, Request, Response } from 'express';
import {
  CloudTelemetryService,
  getCloudTelemetryService,
  RemoteCommandType,
} from './cloudTelemetryService';

/**
 * Creates an Express-compatible router for Cloud Telemetry & Sync.
 */
export function createCloudTelemetryRouter(
  telemetryService: CloudTelemetryService = getCloudTelemetryService()
): Router {
  const router = Router();

  // 1. GET /api/v1/sync/pull
  router.get('/sync/pull', (req: Request, res: Response): any => {
    try {
      const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);
      const lastSeqStr = req.query.lastSeq as string;
      const lastSeq = lastSeqStr ? parseInt(lastSeqStr, 10) : 0;

      if (!tenantId || !tenantId.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: tenantId',
        });
      }

      const { commands, latestSeq } = telemetryService.pullCommands(tenantId, isNaN(lastSeq) ? 0 : lastSeq);

      return res.status(200).json({
        success: true,
        tenantId: tenantId.trim(),
        latestSeq,
        commands,
        serverTime: Date.now(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal sync error',
      });
    }
  });

  // 2. POST /api/v1/commands/push
  router.post('/commands/push', (req: Request, res: Response): any => {
    try {
      const { tenantId, type, payload } = req.body || {};

      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid field: tenantId',
        });
      }

      if (!type || (type !== 'UPDATE_PRICE' && type !== 'TOGGLE_STOCK')) {
        return res.status(400).json({
          success: false,
          error: `Invalid command type: ${type}. Must be UPDATE_PRICE or TOGGLE_STOCK`,
        });
      }

      if (!payload || typeof payload !== 'object' || !payload.productId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required object: payload with productId',
        });
      }

      // Financial invariant check on ingestion
      if (type === 'UPDATE_PRICE') {
        const price = payload.newPriceToman;
        if (price === undefined || !Number.isInteger(price) || price < 0) {
          return res.status(400).json({
            success: false,
            error: `Financial Invariant Violation: newPriceToman must be a non-negative integer. Received: ${price}`,
          });
        }
      } else if (type === 'TOGGLE_STOCK') {
        if (typeof payload.inStock !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: `Payload inStock must be a boolean. Received: ${payload.inStock}`,
          });
        }
      }

      const cmd = telemetryService.pushCommand(
        tenantId,
        type as RemoteCommandType,
        payload
      );

      return res.status(201).json({
        success: true,
        command: cmd,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Failed pushing command',
      });
    }
  });

  // 3. POST /api/v1/telemetry
  router.post('/telemetry', (req: Request, res: Response): any => {
    try {
      const { tenantId, terminalId, appVersion, type, metrics, errorDetails } = req.body || {};

      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid field: tenantId',
        });
      }

      const validTypes = ['HEARTBEAT', 'ERROR_ALERT', 'PRINT_FAILURE'];
      const eventType = validTypes.includes(type) ? type : 'HEARTBEAT';

      const event = telemetryService.recordTelemetry({
        tenantId: tenantId.trim(),
        terminalId: terminalId || 'UNKNOWN_TERMINAL',
        appVersion: appVersion || '0.15.0',
        timestamp: Date.now(),
        type: eventType as any,
        metrics,
        errorDetails,
      });

      return res.status(200).json({
        success: true,
        eventId: event.id,
        receivedAt: event.receivedAt,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed recording telemetry',
      });
    }
  });

  // 4. POST /api/v1/license/verify
  router.post('/license/verify', (req: Request, res: Response): any => {
    try {
      const { tenantId, terminalId } = req.body || {};

      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid field: tenantId',
        });
      }

      const lease = telemetryService.generateLicenseLease(tenantId, terminalId);

      return res.status(200).json({
        success: true,
        token: lease.token,
        expiresAt: lease.expiresAt,
        tenantId: lease.tenantId,
        status: 'ACTIVE_LEASE',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed generating license lease',
      });
    }
  });

  // 5. GET /api/v1/health
  router.get('/health', (_req: Request, res: Response) => {
    const health = telemetryService.getHealth();
    res.status(200).json({
      success: true,
      health,
    });
  });

  return router;
}

/**
 * Pure Node.js HTTP request dispatcher for standalone Liara deployment without heavy frameworks.
 */
export async function handleNativeHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  telemetryService: CloudTelemetryService = getCloudTelemetryService()
): Promise<boolean> {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method?.toUpperCase();

  // Helper for JSON responses
  const sendJson = (statusCode: number, data: any) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-Terminal-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(JSON.stringify(data));
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-Terminal-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return true;
  }

  // 1. GET /api/v1/sync/pull
  if (method === 'GET' && pathname === '/api/v1/sync/pull') {
    const tenantId = urlObj.searchParams.get('tenantId') || (req.headers['x-tenant-id'] as string);
    const lastSeq = parseInt(urlObj.searchParams.get('lastSeq') || '0', 10);

    if (!tenantId) {
      sendJson(400, { success: false, error: 'Missing tenantId' });
      return true;
    }

    const { commands, latestSeq } = telemetryService.pullCommands(tenantId, isNaN(lastSeq) ? 0 : lastSeq);
    sendJson(200, {
      success: true,
      tenantId,
      latestSeq,
      commands,
      serverTime: Date.now(),
    });
    return true;
  }

  // Helper to read JSON body
  const readBody = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  };

  // 2. POST /api/v1/commands/push
  if (method === 'POST' && pathname === '/api/v1/commands/push') {
    try {
      const body = await readBody();
      const { tenantId, type, payload } = body;

      if (!tenantId || !type || !payload?.productId) {
        sendJson(400, { success: false, error: 'Invalid command payload' });
        return true;
      }

      if (type === 'UPDATE_PRICE') {
        const price = payload.newPriceToman;
        if (price === undefined || !Number.isInteger(price) || price < 0) {
          sendJson(400, {
            success: false,
            error: `Financial Invariant Violation: newPriceToman must be a non-negative integer. Received: ${price}`,
          });
          return true;
        }
      }

      const cmd = telemetryService.pushCommand(tenantId, type, payload);
      sendJson(201, { success: true, command: cmd });
      return true;
    } catch (err: any) {
      sendJson(400, { success: false, error: err?.message });
      return true;
    }
  }

  // 3. POST /api/v1/telemetry
  if (method === 'POST' && pathname === '/api/v1/telemetry') {
    try {
      const body = await readBody();
      if (!body.tenantId) {
        sendJson(400, { success: false, error: 'Missing tenantId' });
        return true;
      }
      const event = telemetryService.recordTelemetry({
        tenantId: body.tenantId,
        terminalId: body.terminalId || 'POS_01',
        appVersion: body.appVersion || '0.15.0',
        timestamp: Date.now(),
        type: body.type || 'HEARTBEAT',
        metrics: body.metrics,
        errorDetails: body.errorDetails,
      });
      sendJson(200, { success: true, eventId: event.id, receivedAt: event.receivedAt });
      return true;
    } catch (err: any) {
      sendJson(500, { success: false, error: err?.message });
      return true;
    }
  }

  // 4. POST /api/v1/license/verify
  if (method === 'POST' && pathname === '/api/v1/license/verify') {
    try {
      const body = await readBody();
      if (!body.tenantId) {
        sendJson(400, { success: false, error: 'Missing tenantId' });
        return true;
      }
      const lease = telemetryService.generateLicenseLease(body.tenantId, body.terminalId);
      sendJson(200, {
        success: true,
        token: lease.token,
        expiresAt: lease.expiresAt,
        tenantId: lease.tenantId,
        status: 'ACTIVE_LEASE',
      });
      return true;
    } catch (err: any) {
      sendJson(500, { success: false, error: err?.message });
      return true;
    }
  }

  // 5. GET /api/v1/health
  if (method === 'GET' && pathname === '/api/v1/health') {
    sendJson(200, { success: true, health: telemetryService.getHealth() });
    return true;
  }

  return false;
}
