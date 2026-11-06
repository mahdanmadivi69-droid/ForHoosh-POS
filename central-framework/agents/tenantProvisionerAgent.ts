/**
 * KARWAND CENTRAL CONTROL ?" OFFICE AGENT 1
 * Tenant Provisioner Agent (tenantProvisionerAgent.ts)
 * 
 * Purpose:
 *   Autonomous background micro-agent that provisions a new venue upon admin approval.
 * 
 * Mechanism:
 *   1. Generates unique, normalized tenantId and cryptographic HMAC signing secret.
 *   2. Binds the venue to a validated subscription plan and default feature flags.
 *   3. Provisions isolated table space / tenancy record in central database.
 *   4. Generates an exportable venue configuration manifest with hardware profiles and routing rules.
 *   5. Emits auditable telemetry to the central ledger without touching POS client routes.
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { centralDb } from '../db/centralDb';
import {
  ProvisionVenueRequest,
  ProvisioningManifest,
  TenantRecord,
  TenantStatus,
  SubscriptionPlan,
} from '../types/officeAgentTypes';

export class TenantProvisionerAgent {
  /**
   * Generates a collision-resistant, URL-safe tenant identifier.
   */
  private static generateTenantId(name: string, customTenantId?: string): string {
    if (customTenantId) {
      const sanitized = customTenantId.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');
      if (sanitized.length < 3) throw new Error('Custom tenantId must be at least 3 valid characters');
      return sanitized;
    }
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 16);
    const suffix = crypto.randomBytes(2).toString('hex');
    return `tenant-${slug || 'venue'}-${suffix}`;
  }

  /**
   * Core Autonomous Provisioning Routine
   */
  public static async provisionVenue(request: ProvisionVenueRequest): Promise<ProvisioningManifest> {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Provisioning failed: Venue name is mandatory');
    }
    if (!request.ownerEmail || !request.ownerEmail.includes('@')) {
      throw new Error('Provisioning failed: Valid ownerEmail is mandatory');
    }

    const tenantId = this.generateTenantId(request.name, request.customTenantId);

    // Verify tenant does not already exist
    const existing = await centralDb.tenants.findOne({ tenantId });
    if (existing) {
      throw new Error(`Provisioning conflict: Tenant ID '${tenantId}' is already allocated`);
    }

    // Resolve Subscription Plan
    const planId = request.planId || 'trial-14d';
    const plan = await centralDb.plans.findOne({ id: planId });
    if (!plan) {
      throw new Error(`Provisioning failed: Unknown subscription plan '${planId}'`);
    }

    const now = Date.now();
    const cycleMs = plan.billingCycleDays * 24 * 60 * 60 * 1000;
    const graceMs = plan.gracePeriodDays * 24 * 60 * 60 * 1000;
    const planExpiresAt = now + cycleMs;
    const gracePeriodExpiresAt = planExpiresAt + graceMs;

    // Generate cryptographic keys
    const hmacSecret = crypto.randomBytes(32).toString('hex');
    const apiKey = `kw_live_${crypto.randomBytes(20).toString('hex')}`;

    // Assemble Config Manifest
    const configJson = {
      version: '6.3.0',
      tenantId,
      brandNameEn: request.name,
      brandNameFa: request.nameFa || request.name,
      operatingModel: request.operatingModel || 'COUNTER_QUICK_PAY',
      currency: request.currency || 'IRR',
      vatMode: request.vatMode || 'EXCLUSIVE',
      vatRate: request.vatRate !== undefined ? request.vatRate : 9.0,
      initialAdminUser: request.initialAdminUser || {
        username: 'admin',
        fullName: 'Venue Administrator',
        role: 'OWNER',
      },
      hardwareProfile: {
        cashierPrinters: request.hardwareProfile?.cashierPrinters || ['192.168.1.101:9100'],
        kdsPrinters: request.hardwareProfile?.kdsPrinters || ['192.168.1.102:9100'],
        buzzerEnabled: request.hardwareProfile?.buzzerEnabled ?? true,
      },
      meshRouting: {
        rawTcpPort: 9100,
        syncGatewayUrl: '/api/v1/central/sync/batch',
        heartbeatIntervalMs: 60_000,
      },
    };

    // Store in Central Database
    const tenantRecord: TenantRecord = {
      tenantId,
      name: request.name,
      nameFa: request.nameFa,
      ownerEmail: request.ownerEmail,
      operatingModel: request.operatingModel || 'COUNTER_QUICK_PAY',
      currency: request.currency || 'IRR',
      vatMode: request.vatMode || 'EXCLUSIVE',
      vatRate: request.vatRate !== undefined ? request.vatRate : 9.0,
      status: 'active',
      planId: plan.id,
      planExpiresAt,
      gracePeriodExpiresAt,
      featureFlags: { ...plan.defaultFlags },
      hmacSecret,
      configManifest: configJson,
      createdAt: now,
      updatedAt: now,
    };

    await centralDb.tenants.insert(tenantRecord);

    // Record Audit Log
    await centralDb.auditLogs.insert({
      tenantId,
      agent: 'tenantProvisionerAgent',
      action: 'TENANT_PROVISIONED',
      details: {
        planId: plan.id,
        planName: plan.name,
        expiresAt: new Date(planExpiresAt).toISOString(),
        operatingModel: tenantRecord.operatingModel,
        initialFlags: tenantRecord.featureFlags,
      },
      timestamp: now,
    });

    return {
      success: true,
      tenantId,
      name: request.name,
      status: 'active',
      apiKey,
      hmacSecret,
      configJson,
      assignedPlan: plan,
      featureFlags: tenantRecord.featureFlags,
      provisionedAt: now,
    };
  }

  /**
   * Express Route Handler for HTTP Triggered Admin Approvals
   */
  public static async handleHttpProvision(req: Request, res: Response) {
    try {
      const payload: ProvisionVenueRequest = req.body;
      const result = await TenantProvisionerAgent.provisionVenue(payload);
      return res.status(201).json({
        status: 'success',
        message: `Venue '${result.name}' successfully provisioned with tenantId: ${result.tenantId}`,
        data: result,
      });
    } catch (err: any) {
      console.error('[TenantProvisionerAgent] Error:', err);
      return res.status(400).json({
        status: 'error',
        error: err?.message || 'Venue provisioning failed',
      });
    }
  }
}
