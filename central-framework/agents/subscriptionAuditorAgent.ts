/**
 * KARWAND CENTRAL CONTROL ?" OFFICE AGENT 2
 * Subscription Auditor Agent (subscriptionAuditorAgent.ts)
 * 
 * Purpose:
 *   Autonomous background micro-agent that monitors plan expiry and dynamically
 *   toggles feature flags without touching or bloating local POS client routes.
 * 
 * Mechanism:
 *   1. Runs periodically via cron or on-demand trigger.
 *   2. Evaluates expiration timestamps and grace period boundaries.
 *   3. Enforces automated state transitions: ACTIVE -> GRACE_PERIOD -> SUSPENDED.
 *   4. Dynamically locks high-tier feature flags (e.g. POS sync, advanced inventory).
 *   5. Emits auditable logs and alerts into the central ledger.
 */

import { Request, Response } from 'express';
import { centralDb } from '../db/centralDb';
import {
  TenantRecord,
  TenantStatus,
  TenantFeatureFlags,
  SubscriptionAuditReport,
} from '../types/officeAgentTypes';

export class SubscriptionAuditorAgent {
  /**
   * Evaluates and updates status and feature flags for a single tenant.
   */
  public static async auditTenant(
    tenant: TenantRecord,
    simulatedNow?: number
  ): Promise<{ statusChanged: boolean; previousStatus: TenantStatus; newStatus: TenantStatus; updatedFlags?: Partial<TenantFeatureFlags>; reason?: string } | null> {
    const now = simulatedNow ?? Date.now();
    const previousStatus = tenant.status;
    let targetStatus: TenantStatus = previousStatus;
    let flagsToUpdate: Partial<TenantFeatureFlags> = {};
    let reason = '';

    // If tenant is pending approval, skip expiration logic
    if (previousStatus === 'pending_approval') {
      return null;
    }

    if (now <= tenant.planExpiresAt) {
      // Within valid subscription period
      targetStatus = 'active';
      if (previousStatus !== 'active') {
        reason = 'Subscription restored to active status';
        const plan = await centralDb.plans.findOne({ id: tenant.planId });
        if (plan) {
          flagsToUpdate = { ...plan.defaultFlags };
        }
      }
    } else if (now > tenant.planExpiresAt && now <= tenant.gracePeriodExpiresAt) {
      // In Grace Period: Allow POS sync, but throttle non-essential advanced features
      targetStatus = 'grace_period';
      if (previousStatus !== 'grace_period') {
        reason = 'Plan expired; entered grace period buffer';
        flagsToUpdate = {
          allow_pos_sync: true, // Keep venue operational during grace
          allow_advanced_inventory: false,
          analytics_tier: 'basic',
        };
      }
    } else {
      // Beyond Grace Period: Hard suspension of cloud sync & advanced features
      targetStatus = 'suspended';
      if (previousStatus !== 'suspended') {
        reason = 'Grace period exhausted; cloud sync and premium features locked';
        flagsToUpdate = {
          allow_pos_sync: false, // Locks central sync at the edge
          allow_advanced_inventory: false,
          allow_fiscal_export: false,
        };
      }
    }

    if (targetStatus !== previousStatus || Object.keys(flagsToUpdate).length > 0) {
      const mergedFlags: TenantFeatureFlags = {
        ...tenant.featureFlags,
        ...flagsToUpdate,
      };

      await centralDb.tenants.update(tenant.tenantId, {
        status: targetStatus,
        featureFlags: mergedFlags,
      });

      await centralDb.auditLogs.insert({
        tenantId: tenant.tenantId,
        agent: 'subscriptionAuditorAgent',
        action: 'SUBSCRIPTION_STATUS_MUTATION',
        details: {
          previousStatus,
          newStatus: targetStatus,
          reason,
          flagsUpdated: flagsToUpdate,
          auditedAt: new Date(now).toISOString(),
        },
        timestamp: now,
      });

      return {
        statusChanged: targetStatus !== previousStatus,
        previousStatus,
        newStatus: targetStatus,
        updatedFlags: flagsToUpdate,
        reason,
      };
    }

    return null;
  }

  /**
   * Executes the comprehensive audit across all registered tenants.
   */
  public static async runDailyAudit(simulatedNow?: number): Promise<SubscriptionAuditReport> {
    const now = simulatedNow ?? Date.now();
    const tenants = await centralDb.tenants.findAll();
    const flagMutations: SubscriptionAuditReport['flagMutations'] = [];

    let activeCount = 0;
    let gracePeriodCount = 0;
    let suspendedCount = 0;

    for (const tenant of tenants) {
      const auditResult = await this.auditTenant(tenant, now);
      if (auditResult && (auditResult.statusChanged || auditResult.updatedFlags)) {
        flagMutations.push({
          tenantId: tenant.tenantId,
          previousStatus: auditResult.previousStatus,
          newStatus: auditResult.newStatus,
          flagsUpdated: auditResult.updatedFlags || {},
          reason: auditResult.reason || 'Periodic cron audit',
        });
      }

      // Re-fetch current status
      const current = await centralDb.tenants.findOne({ tenantId: tenant.tenantId });
      const effectiveStatus = current?.status || tenant.status;
      if (effectiveStatus === 'active') activeCount++;
      else if (effectiveStatus === 'grace_period') gracePeriodCount++;
      else if (effectiveStatus === 'suspended' || effectiveStatus === 'past_due') suspendedCount++;
    }

    return {
      timestamp: now,
      totalTenantsAudited: tenants.length,
      activeCount,
      gracePeriodCount,
      suspendedCount,
      flagMutations,
    };
  }

  /**
   * Renews a tenant subscription and restores active feature flags.
   */
  public static async renewTenantSubscription(
    tenantId: string,
    planId?: string,
    additionalDays?: number
  ): Promise<TenantRecord> {
    const tenant = await centralDb.tenants.findOne({ tenantId });
    if (!tenant) throw new Error(`Renewal failed: Tenant '${tenantId}' not found`);

    const targetPlanId = planId || tenant.planId;
    const plan = await centralDb.plans.findOne({ id: targetPlanId });
    if (!plan) throw new Error(`Renewal failed: Unknown plan '${targetPlanId}'`);

    const days = additionalDays || plan.billingCycleDays;
    const now = Date.now();
    // If already expired, start from now; if still active, append to existing expiresAt
    const baseTime = tenant.planExpiresAt > now ? tenant.planExpiresAt : now;
    const planExpiresAt = baseTime + days * 24 * 60 * 60 * 1000;
    const gracePeriodExpiresAt = planExpiresAt + plan.gracePeriodDays * 24 * 60 * 60 * 1000;

    const updated = await centralDb.tenants.update(tenantId, {
      status: 'active',
      planId: plan.id,
      planExpiresAt,
      gracePeriodExpiresAt,
      featureFlags: { ...plan.defaultFlags },
    });

    await centralDb.auditLogs.insert({
      tenantId,
      agent: 'subscriptionAuditorAgent',
      action: 'SUBSCRIPTION_RENEWED',
      details: {
        planId: plan.id,
        planName: plan.name,
        extendedDays: days,
        newExpiresAt: new Date(planExpiresAt).toISOString(),
        restoredFlags: plan.defaultFlags,
      },
      timestamp: now,
    });

    return updated;
  }

  /**
   * Express Route Handler for Cron / Edge Webhook Triggers
   */
  public static async handleCronAudit(req: Request, res: Response) {
    try {
      const cronSecret = req.headers['x-cron-auth'];
      const expectedSecret = process.env.CRON_AUTH_SECRET || 'karwand-central-cron-key';
      
      // If authorization header is provided, enforce it
      if (cronSecret && cronSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized cron trigger' });
      }

      const report = await SubscriptionAuditorAgent.runDailyAudit();
      return res.status(200).json({
        status: 'success',
        report,
      });
    } catch (err: any) {
      console.error('[SubscriptionAuditorAgent] Error:', err);
      return res.status(500).json({
        status: 'error',
        error: err?.message || 'Daily subscription audit failed',
      });
    }
  }
}
