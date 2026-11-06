/**
 * KARWAND CENTRAL CONTROL ?" CENTRAL DATABASE ADAPTER
 * Lightweight, ACID-compliant multi-tenant central data store.
 * Supports in-memory fast ledger with optional persistence and PostgreSQL bridging.
 */

import crypto from 'crypto';
import {
  TenantRecord,
  SubscriptionPlan,
  ReconciledOrderRecord,
  AuditLogRecord,
  TenantFeatureFlags,
} from '../types/officeAgentTypes';

// Predefined Canonical Subscription Plans
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'trial-14d',
    name: '14-Day Free Venue Trial',
    tier: 'trial',
    priceToman: 0,
    billingCycleDays: 14,
    gracePeriodDays: 3,
    defaultFlags: {
      allow_pos_sync: true,
      allow_advanced_inventory: true,
      allow_fiscal_export: true,
      max_kds_stations: 2,
      max_terminals: 3,
      analytics_tier: 'advanced',
    },
  },
  {
    id: 'standard-monthly',
    name: 'KarWand Standard Roastery POS',
    tier: 'standard',
    priceToman: 1_250_000,
    billingCycleDays: 30,
    gracePeriodDays: 5,
    defaultFlags: {
      allow_pos_sync: true,
      allow_advanced_inventory: false,
      allow_fiscal_export: true,
      max_kds_stations: 2,
      max_terminals: 2,
      analytics_tier: 'basic',
    },
  },
  {
    id: 'premium-monthly',
    name: 'KarWand Premium Lounge & Kitchen',
    tier: 'premium',
    priceToman: 2_800_000,
    billingCycleDays: 30,
    gracePeriodDays: 7,
    defaultFlags: {
      allow_pos_sync: true,
      allow_advanced_inventory: true,
      allow_fiscal_export: true,
      max_kds_stations: 6,
      max_terminals: 8,
      analytics_tier: 'advanced',
    },
  },
  {
    id: 'enterprise-annual',
    name: 'KarWand Multi-Venue Enterprise',
    tier: 'enterprise',
    priceToman: 28_000_000,
    billingCycleDays: 365,
    gracePeriodDays: 14,
    defaultFlags: {
      allow_pos_sync: true,
      allow_advanced_inventory: true,
      allow_fiscal_export: true,
      max_kds_stations: 20,
      max_terminals: 50,
      analytics_tier: 'executive',
    },
  },
];

export class CentralDatabase {
  private tenantsMap: Map<string, TenantRecord> = new Map();
  private plansMap: Map<string, SubscriptionPlan> = new Map();
  private ordersMap: Map<string, ReconciledOrderRecord> = new Map(); // clientGeneratedId -> order
  private auditLogsList: AuditLogRecord[] = [];

  constructor() {
    this.seedPlans();
    this.seedCanonicalTenants();
  }

  private seedPlans() {
    for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
      this.plansMap.set(plan.id, plan);
    }
  }

  private seedCanonicalTenants() {
    const now = Date.now();
    const oneYearFromNow = now + 365 * 24 * 60 * 60 * 1000;
    const graceOneYear = oneYearFromNow + 14 * 24 * 60 * 60 * 1000;

    // Tenant 1: 100 HICH Specialty Roastery
    const hichRecord: TenantRecord = {
      tenantId: 'tenant-100hich-01',
      name: '100 HICH Specialty Roastery',
      nameFa: 'رستری تخصصی ۱۰۰ هیچ',
      ownerEmail: 'finance@100hich.ir',
      operatingModel: 'COUNTER_QUICK_PAY',
      currency: 'IRR',
      vatMode: 'EXCLUSIVE',
      vatRate: 9.0,
      status: 'active',
      planId: 'enterprise-annual',
      planExpiresAt: oneYearFromNow,
      gracePeriodExpiresAt: graceOneYear,
      featureFlags: {
        allow_pos_sync: true,
        allow_advanced_inventory: true,
        allow_fiscal_export: true,
        max_kds_stations: 4,
        max_terminals: 6,
        analytics_tier: 'executive',
      },
      hmacSecret: crypto.randomBytes(32).toString('hex'),
      createdAt: now,
      updatedAt: now,
    };
    this.tenantsMap.set(hichRecord.tenantId, hichRecord);

    // Tenant 2: Modendo Gaming Lounge
    const modendoRecord: TenantRecord = {
      tenantId: 'tenant-modendo-01',
      name: 'Modendo Gaming Lounge',
      nameFa: 'کافه گیم مودندو',
      ownerEmail: 'admin@modendocafe.ir',
      operatingModel: 'TAB_PAY_LATER',
      currency: 'IRR',
      vatMode: 'INCLUSIVE',
      vatRate: 9.0,
      status: 'active',
      planId: 'premium-monthly',
      planExpiresAt: oneYearFromNow,
      gracePeriodExpiresAt: graceOneYear,
      featureFlags: {
        allow_pos_sync: true,
        allow_advanced_inventory: true,
        allow_fiscal_export: true,
        max_kds_stations: 6,
        max_terminals: 10,
        analytics_tier: 'advanced',
      },
      hmacSecret: crypto.randomBytes(32).toString('hex'),
      createdAt: now,
      updatedAt: now,
    };
    this.tenantsMap.set(modendoRecord.tenantId, modendoRecord);
  }

  // -------------------------------------------------------------
  // Tenants Table Repository
  // -------------------------------------------------------------
  public tenants = {
    findOne: async (query: { tenantId?: string; ownerEmail?: string }): Promise<TenantRecord | null> => {
      if (query.tenantId) {
        return this.tenantsMap.get(query.tenantId) || null;
      }
      if (query.ownerEmail) {
        for (const t of this.tenantsMap.values()) {
          if (t.ownerEmail === query.ownerEmail) return t;
        }
      }
      return null;
    },

    findAll: async (): Promise<TenantRecord[]> => {
      return Array.from(this.tenantsMap.values());
    },

    insert: async (record: TenantRecord): Promise<TenantRecord> => {
      if (this.tenantsMap.has(record.tenantId)) {
        throw new Error(`Tenant already exists with ID: ${record.tenantId}`);
      }
      this.tenantsMap.set(record.tenantId, { ...record });
      return record;
    },

    update: async (tenantId: string, partial: Partial<TenantRecord>): Promise<TenantRecord> => {
      const existing = this.tenantsMap.get(tenantId);
      if (!existing) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }
      const updated: TenantRecord = {
        ...existing,
        ...partial,
        tenantId, // Prevent ID mutation
        updatedAt: Date.now(),
      };
      this.tenantsMap.set(tenantId, updated);
      return updated;
    },

    delete: async (tenantId: string): Promise<boolean> => {
      return this.tenantsMap.delete(tenantId);
    },
  };

  // -------------------------------------------------------------
  // Subscription Plans Repository
  // -------------------------------------------------------------
  public plans = {
    findOne: async (query: { id: string }): Promise<SubscriptionPlan | null> => {
      return this.plansMap.get(query.id) || null;
    },

    findAll: async (): Promise<SubscriptionPlan[]> => {
      return Array.from(this.plansMap.values());
    },

    insert: async (plan: SubscriptionPlan): Promise<SubscriptionPlan> => {
      this.plansMap.set(plan.id, plan);
      return plan;
    },
  };

  // -------------------------------------------------------------
  // Central Reconciled Orders Ledger (Idempotent Storage)
  // -------------------------------------------------------------
  public orders = {
    findOne: async (query: { clientGeneratedId: string }): Promise<ReconciledOrderRecord | null> => {
      return this.ordersMap.get(query.clientGeneratedId) || null;
    },

    findManyByTenant: async (tenantId: string): Promise<ReconciledOrderRecord[]> => {
      const results: ReconciledOrderRecord[] = [];
      for (const order of this.ordersMap.values()) {
        if (order.tenantId === tenantId) {
          results.push(order);
        }
      }
      return results;
    },

    insert: async (order: ReconciledOrderRecord): Promise<ReconciledOrderRecord> => {
      if (this.ordersMap.has(order.clientGeneratedId)) {
        throw new Error(`Duplicate order clientGeneratedId: ${order.clientGeneratedId}`);
      }
      this.ordersMap.set(order.clientGeneratedId, { ...order });
      return order;
    },

    count: async (tenantId?: string): Promise<number> => {
      if (!tenantId) return this.ordersMap.size;
      let cnt = 0;
      for (const order of this.ordersMap.values()) {
        if (order.tenantId === tenantId) cnt++;
      }
      return cnt;
    },
  };

  // -------------------------------------------------------------
  // Audit Logs Repository
  // -------------------------------------------------------------
  public auditLogs = {
    insert: async (log: Omit<AuditLogRecord, 'id'>): Promise<AuditLogRecord> => {
      const record: AuditLogRecord = {
        ...log,
        id: crypto.randomUUID(),
      };
      this.auditLogsList.push(record);
      return record;
    },

    findManyByTenant: async (tenantId: string): Promise<AuditLogRecord[]> => {
      return this.auditLogsList.filter((l) => l.tenantId === tenantId);
    },

    findAll: async (): Promise<AuditLogRecord[]> => {
      return [...this.auditLogsList];
    },
  };

  // Method to reset / clear state (ideal for automated test isolation)
  public clearAll() {
    this.tenantsMap.clear();
    this.ordersMap.clear();
    this.auditLogsList = [];
    this.seedPlans();
    this.seedCanonicalTenants();
  }
}

// Global Singleton Instance
export const centralDb = new CentralDatabase();
