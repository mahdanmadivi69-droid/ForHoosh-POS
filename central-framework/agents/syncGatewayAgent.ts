/**
 * KARWAND CENTRAL CONTROL ?" OFFICE AGENT 3
 * Sync Gateway Agent (syncGatewayAgent.ts)
 * 
 * Purpose:
 *   Autonomous background micro-agent that safely reconciles incoming offline batch
 *   order syncs from POS terminals.
 * 
 * Mechanism:
 *   1. Receives batched JSON payloads containing clientGeneratedId.
 *   2. Validates tenant existence, subscription status, and sync feature flag gates.
 *   3. Enforces strict idempotency against the central ledger (zero duplicate writes).
 *   4. Validates integer Toman arithmetic invariants on all ingested aggregates.
 *   5. Writes unique orders and returns a deterministic acknowledgment payload.
 */

import { Request, Response } from 'express';
import { centralDb } from '../db/centralDb';
import {
  IncomingSyncPayload,
  BatchSyncResponse,
  ReconciledOrderRecord,
  SyncOrder,
} from '../types/officeAgentTypes';

export class SyncGatewayAgent {
  /**
   * Fast Tenant Subscription & Feature Gate Validator
   */
  public static async checkTenantSubscription(tenantId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const tenant = await centralDb.tenants.findOne({ tenantId });
    if (!tenant) {
      return { allowed: false, reason: `Tenant '${tenantId}' does not exist in central registry.` };
    }

    if (tenant.status === 'suspended' || tenant.status === 'past_due') {
      return {
        allowed: false,
        reason: `Tenant subscription is ${tenant.status}. Cloud sync is locked at the edge.`,
      };
    }

    if (!tenant.featureFlags.allow_pos_sync) {
      return {
        allowed: false,
        reason: 'Tenant feature gate disabled: allow_pos_sync is false.',
      };
    }

    return { allowed: true };
  }

  /**
   * Core Reconcile Method (Programmatic & Headless)
   */
  public static async reconcileBatch(payload: IncomingSyncPayload): Promise<BatchSyncResponse> {
    const { tenantId, orders, batchId } = payload;
    const now = Date.now();

    if (!tenantId) {
      throw new Error('Sync reconciliation failed: Missing tenantId');
    }

    if (!Array.isArray(orders)) {
      throw new Error('Sync reconciliation failed: Payload orders must be an array');
    }

    // Gatecheck: Subscription & Feature Flags
    const gateCheck = await this.checkTenantSubscription(tenantId);
    if (!gateCheck.allowed) {
      const err: any = new Error(gateCheck.reason);
      err.statusCode = 403;
      throw err;
    }

    const processedIds: string[] = [];
    const duplicateIds: string[] = [];

    for (const order of orders) {
      if (!order.clientGeneratedId) {
        console.warn(`[SyncGatewayAgent] Skipping order without clientGeneratedId in batch ${batchId}`);
        continue;
      }

      // Invariant Validation: Integer Toman precision math
      const totalAmount = Math.round(Number(order.totalAmount) || 0);
      if (totalAmount < 0) {
        throw new Error(`Invalid totalAmount for order ${order.clientGeneratedId}: must be non-negative integer`);
      }

      // Idempotency Check: Query central ledger
      const existing = await centralDb.orders.findOne({ clientGeneratedId: order.clientGeneratedId });

      if (existing) {
        // Already reconciled - record duplicate to acknowledge without rewriting
        duplicateIds.push(order.clientGeneratedId);
      } else {
        // Unique new order - persist atomically
        const record: ReconciledOrderRecord = {
          ...order,
          totalAmount,
          tenantId,
          batchId: batchId || `batch-${now}`,
          reconciledAt: now,
          status: 'RECONCILED',
        };

        await centralDb.orders.insert(record);
        processedIds.push(order.clientGeneratedId);
      }
    }

    // Record audit telemetry for batches larger than 0
    if (processedIds.length > 0 || duplicateIds.length > 0) {
      await centralDb.auditLogs.insert({
        tenantId,
        agent: 'syncGatewayAgent',
        action: 'BATCH_SYNC_RECONCILED',
        details: {
          batchId,
          totalSubmitted: orders.length,
          reconciledCount: processedIds.length,
          duplicateCount: duplicateIds.length,
        },
        timestamp: now,
      });
    }

    return {
      status: 'success',
      tenantId,
      batchId,
      reconciledCount: processedIds.length,
      duplicateCount: duplicateIds.length,
      processedIds,
      duplicateIds,
      serverTimestamp: now,
    };
  }

  /**
   * Express HTTP Route Handler for Batch POS Sync
   */
  public static async handleBatchSync(req: Request, res: Response) {
    try {
      const payload: IncomingSyncPayload = req.body;
      const response = await SyncGatewayAgent.reconcileBatch(payload);
      return res.status(200).json(response);
    } catch (err: any) {
      console.error('[SyncGatewayAgent] Error:', err);
      const statusCode = err.statusCode || (err.message?.includes('Missing') ? 400 : 500);
      return res.status(statusCode).json({
        status: 'error',
        error: err?.message || 'Internal sync reconciliation failed.',
      });
    }
  }
}
