/**
 * KARWAND CENTRAL CONTROL ?" OFFICE AGENTS FRAMEWORK
 * Master export and HTTP router for KarWand Central Office Micro-Agents:
 *  - Tenant Provisioner Agent
 *  - Subscription Auditor Agent
 *  - Sync Gateway Agent
 */

import express, { Router, Request, Response } from 'express';
import { centralDb } from './db/centralDb';
import { TenantProvisionerAgent } from './agents/tenantProvisionerAgent';
import { SubscriptionAuditorAgent } from './agents/subscriptionAuditorAgent';
import { SyncGatewayAgent } from './agents/syncGatewayAgent';

export * from './types/officeAgentTypes';
export * from './db/centralDb';
export * from './agents/tenantProvisionerAgent';
export * from './agents/subscriptionAuditorAgent';
export * from './agents/syncGatewayAgent';

/**
 * Creates an isolated Express Router mounting all Office Agent endpoints.
 * Keeps central and venue POS routes cleanly separated.
 */
export function createCentralOfficeRouter(): Router {
  const router = express.Router();

  // 1. Tenant Provisioner Agent Route (Venue Intake & Config Generation)
  router.post('/agents/provision', TenantProvisionerAgent.handleHttpProvision);

  // 2. Subscription Auditor Agent Route (Daily Cron / Edge Trigger)
  router.post('/agents/audit/cron', SubscriptionAuditorAgent.handleCronAudit);

  // 3. Sync Gateway Agent Route (Batched Idempotent POS Reconciliation)
  router.post('/agents/sync/batch', SyncGatewayAgent.handleBatchSync);

  // Central Health & Observability Route
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const tenants = await centralDb.tenants.findAll();
      const orderCount = await centralDb.orders.count();
      const auditCount = (await centralDb.auditLogs.findAll()).length;

      const activeTenants = tenants.filter((t) => t.status === 'active').length;
      const graceTenants = tenants.filter((t) => t.status === 'grace_period').length;
      const suspendedTenants = tenants.filter((t) => t.status === 'suspended').length;

      return res.status(200).json({
        status: 'healthy',
        service: 'KarWand-Central-Control-Office',
        version: '1.0.0',
        timestamp: Date.now(),
        metrics: {
          totalTenants: tenants.length,
          activeTenants,
          graceTenants,
          suspendedTenants,
          reconciledOrdersTotal: orderCount,
          auditEventsLogged: auditCount,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ status: 'unhealthy', error: err?.message });
    }
  });

  return router;
}
