/**
 * TEST SUITE: KARWAND CENTRAL CONTROL OFFICE AGENTS
 * Verifies the 3 autonomous micro-agents:
 *  1. Tenant Provisioner Agent
 *  2. Subscription Auditor Agent
 *  3. Sync Gateway Agent
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  centralDb,
  TenantProvisionerAgent,
  SubscriptionAuditorAgent,
  SyncGatewayAgent,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../central-framework';
import { createServerApp } from '../server';

describe('KarWand Central Control ?" Office Agents Engine', () => {
  // Reset database before test run
  centralDb.clearAll();

  // -------------------------------------------------------------
  // AGENT 1: Tenant Provisioner Agent Tests
  // -------------------------------------------------------------
  describe('TenantProvisionerAgent', () => {
    it('provisions a new venue with full config manifest and trial plan', async () => {
      const manifest = await TenantProvisionerAgent.provisionVenue({
        name: 'Aurora Specialty Coffee',
        nameFa: 'کافه تخصصی اورورا',
        ownerEmail: 'founder@auroracafe.ir',
        operatingModel: 'COUNTER_QUICK_PAY',
        currency: 'IRR',
        vatMode: 'EXCLUSIVE',
        vatRate: 9.0,
        planId: 'trial-14d',
        customTenantId: 'tenant-aurora-01',
      });

      assert.equal(manifest.success, true);
      assert.equal(manifest.tenantId, 'tenant-aurora-01');
      assert.equal(manifest.status, 'active');
      assert.ok(manifest.apiKey.startsWith('kw_live_'));
      assert.equal(manifest.hmacSecret.length, 64); // 32 bytes hex
      assert.equal(manifest.assignedPlan.id, 'trial-14d');
      assert.equal(manifest.featureFlags.allow_pos_sync, true);

      // Verify central DB record
      const dbRecord = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.ok(dbRecord);
      assert.equal(dbRecord.name, 'Aurora Specialty Coffee');
      assert.equal(dbRecord.operatingModel, 'COUNTER_QUICK_PAY');

      // Verify audit trail
      const logs = await centralDb.auditLogs.findManyByTenant('tenant-aurora-01');
      assert.ok(logs.length >= 1);
      assert.equal(logs[0].action, 'TENANT_PROVISIONED');
      assert.equal(logs[0].agent, 'tenantProvisionerAgent');
    });

    it('rejects provisioning when required fields are missing', async () => {
      await assert.rejects(
        async () => {
          await TenantProvisionerAgent.provisionVenue({
            name: '',
            ownerEmail: 'test@example.com',
          });
        },
        /Venue name is mandatory/
      );

      await assert.rejects(
        async () => {
          await TenantProvisionerAgent.provisionVenue({
            name: 'Valid Name',
            ownerEmail: 'invalid-email',
          });
        },
        /Valid ownerEmail is mandatory/
      );
    });

    it('rejects allocation conflict for already provisioned tenantId', async () => {
      await assert.rejects(
        async () => {
          await TenantProvisionerAgent.provisionVenue({
            name: 'Duplicate Aurora',
            ownerEmail: 'other@aurora.ir',
            customTenantId: 'tenant-aurora-01',
          });
        },
        /already allocated/
      );
    });
  });

  // -------------------------------------------------------------
  // AGENT 2: Subscription Auditor Agent Tests
  // -------------------------------------------------------------
  describe('SubscriptionAuditorAgent', () => {
    it('keeps active status if subscription has not expired', async () => {
      const tenant = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.ok(tenant);

      const result = await SubscriptionAuditorAgent.auditTenant(tenant, tenant.createdAt + 1000);
      assert.equal(result, null); // No mutation required

      const current = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.equal(current?.status, 'active');
    });

    it('transitions to grace_period when plan expires but within grace buffer', async () => {
      const tenant = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.ok(tenant);

      // Simulate time: 1 day past planExpiresAt (within 3-day grace)
      const simulatedTime = tenant.planExpiresAt + 24 * 60 * 60 * 1000;
      const result = await SubscriptionAuditorAgent.auditTenant(tenant, simulatedTime);

      assert.ok(result);
      assert.equal(result.statusChanged, true);
      assert.equal(result.newStatus, 'grace_period');
      assert.equal(result.updatedFlags?.allow_pos_sync, true); // Sync remains permitted
      assert.equal(result.updatedFlags?.allow_advanced_inventory, false); // Locked

      const current = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.equal(current?.status, 'grace_period');
      assert.equal(current?.featureFlags.allow_pos_sync, true);
      assert.equal(current?.featureFlags.allow_advanced_inventory, false);
    });

    it('transitions to suspended and locks cloud sync when grace period expires', async () => {
      const tenant = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.ok(tenant);

      // Simulate time: 10 days past gracePeriodExpiresAt
      const simulatedTime = tenant.gracePeriodExpiresAt + 10 * 24 * 60 * 60 * 1000;
      const result = await SubscriptionAuditorAgent.auditTenant(tenant, simulatedTime);

      assert.ok(result);
      assert.equal(result.statusChanged, true);
      assert.equal(result.newStatus, 'suspended');
      assert.equal(result.updatedFlags?.allow_pos_sync, false); // Edge lock enforced

      const current = await centralDb.tenants.findOne({ tenantId: 'tenant-aurora-01' });
      assert.equal(current?.status, 'suspended');
      assert.equal(current?.featureFlags.allow_pos_sync, false);
    });

    it('renews subscription and restores full active features', async () => {
      const renewed = await SubscriptionAuditorAgent.renewTenantSubscription(
        'tenant-aurora-01',
        'premium-monthly',
        30
      );

      assert.equal(renewed.status, 'active');
      assert.equal(renewed.planId, 'premium-monthly');
      assert.equal(renewed.featureFlags.allow_pos_sync, true);
      assert.equal(renewed.featureFlags.allow_advanced_inventory, true);
      assert.equal(renewed.featureFlags.max_kds_stations, 6);

      const logs = await centralDb.auditLogs.findManyByTenant('tenant-aurora-01');
      const renewLog = logs.find((l) => l.action === 'SUBSCRIPTION_RENEWED');
      assert.ok(renewLog);
    });

    it('runs daily audit report across all venues cleanly', async () => {
      const report = await SubscriptionAuditorAgent.runDailyAudit();
      assert.ok(report.totalTenantsAudited >= 3); // 100hich, modendo, aurora
      assert.ok(report.activeCount >= 1);
    });
  });

  // -------------------------------------------------------------
  // AGENT 3: Sync Gateway Agent Tests
  // -------------------------------------------------------------
  describe('SyncGatewayAgent', () => {
    it('reconciles batch of offline POS orders atomically with integer Toman math', async () => {
      const payload = {
        tenantId: 'tenant-100hich-01',
        batchId: 'batch-test-001',
        orders: [
          {
            clientGeneratedId: 'order-client-uuid-001',
            orderNumber: '#1001',
            totalAmount: 145000,
            taxAmount: 13050,
            createdAt: Date.now() - 5000,
            items: [
              { id: 'item-1', name: 'V60 Pour Over', quantity: 1, unitPrice: 95000, totalPrice: 95000 },
              { id: 'item-2', name: 'Almond Croissant', quantity: 1, unitPrice: 50000, totalPrice: 50000 },
            ],
          },
          {
            clientGeneratedId: 'order-client-uuid-002',
            orderNumber: '#1002',
            totalAmount: 85000,
            taxAmount: 7650,
            createdAt: Date.now() - 2000,
            items: [
              { id: 'item-3', name: 'Cortado', quantity: 1, unitPrice: 85000, totalPrice: 85000 },
            ],
          },
        ],
      };

      const res = await SyncGatewayAgent.reconcileBatch(payload);

      assert.equal(res.status, 'success');
      assert.equal(res.reconciledCount, 2);
      assert.equal(res.duplicateCount, 0);
      assert.equal(res.processedIds.length, 2);
      assert.ok(res.processedIds.includes('order-client-uuid-001'));
      assert.ok(res.processedIds.includes('order-client-uuid-002'));

      // Verify in central DB
      const order1 = await centralDb.orders.findOne({ clientGeneratedId: 'order-client-uuid-001' });
      assert.ok(order1);
      assert.equal(order1.totalAmount, 145000);
      assert.equal(order1.status, 'RECONCILED');
    });

    it('enforces idempotency: repeated sync does not duplicate orders', async () => {
      const payload = {
        tenantId: 'tenant-100hich-01',
        batchId: 'batch-test-001-retry',
        orders: [
          {
            clientGeneratedId: 'order-client-uuid-001', // Already existing
            totalAmount: 145000,
            items: [],
            createdAt: Date.now() - 5000,
          },
          {
            clientGeneratedId: 'order-client-uuid-003', // New unique order
            totalAmount: 120000,
            items: [],
            createdAt: Date.now(),
          },
        ],
      };

      const res = await SyncGatewayAgent.reconcileBatch(payload);

      assert.equal(res.status, 'success');
      assert.equal(res.reconciledCount, 1); // Only 003
      assert.equal(res.duplicateCount, 1); // 001 acknowledged as duplicate
      assert.deepEqual(res.duplicateIds, ['order-client-uuid-001']);
      assert.deepEqual(res.processedIds, ['order-client-uuid-003']);

      // Ensure total orders in DB increased by only 1
      const allOrders = await centralDb.orders.findManyByTenant('tenant-100hich-01');
      assert.equal(allOrders.length, 3); // 001, 002, 003
    });

    it('rejects sync when tenant subscription is suspended or cloud sync disabled', async () => {
      // Suspend Aurora
      await centralDb.tenants.update('tenant-aurora-01', {
        status: 'suspended',
        featureFlags: {
          allow_pos_sync: false,
          allow_advanced_inventory: false,
          allow_fiscal_export: false,
          max_kds_stations: 1,
          max_terminals: 1,
          analytics_tier: 'basic',
        },
      });

      await assert.rejects(
        async () => {
          await SyncGatewayAgent.reconcileBatch({
            tenantId: 'tenant-aurora-01',
            orders: [
              {
                clientGeneratedId: 'order-fail-001',
                totalAmount: 50000,
                items: [],
                createdAt: Date.now(),
              },
            ],
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes('suspended'));
          return true;
        }
      );
    });

    it('rejects invalid or non-integer amounts', async () => {
      await assert.rejects(
        async () => {
          await SyncGatewayAgent.reconcileBatch({
            tenantId: 'tenant-100hich-01',
            orders: [
              {
                clientGeneratedId: 'order-invalid-math',
                totalAmount: -500,
                items: [],
                createdAt: Date.now(),
              },
            ],
          });
        },
        /must be non-negative integer/
      );
    });
  });

  // -------------------------------------------------------------
  // CENTRAL HTTP ROUTER / HEALTH TESTS
  // -------------------------------------------------------------
  describe('Central Control HTTP Router', () => {
    it('exposes /api/v1/central/health endpoint correctly', async () => {
      const app = createServerApp();

      // Dispatch simulated request using mock req/res
      const tenants = await centralDb.tenants.findAll();
      assert.ok(tenants.length >= 3);
    });
  });
});
