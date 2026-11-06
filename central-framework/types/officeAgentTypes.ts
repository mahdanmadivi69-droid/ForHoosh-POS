/**
 * KARWAND CENTRAL CONTROL ?" OFFICE AGENTS TYPINGS
 * High-performance, lightweight contract definitions for Central Control Office Agents:
 * 1. Tenant Provisioner Agent
 * 2. Subscription Auditor Agent
 * 3. Sync Gateway Agent
 */

export type TenantOperatingModel = 'COUNTER_QUICK_PAY' | 'TAB_PAY_LATER';
export type VatMode = 'EXCLUSIVE' | 'INCLUSIVE';
export type TenantStatus = 'active' | 'grace_period' | 'past_due' | 'suspended' | 'pending_approval';
export type AnalyticsTier = 'basic' | 'advanced' | 'executive';
export type SubscriptionTier = 'trial' | 'standard' | 'premium' | 'enterprise';

export interface TenantFeatureFlags {
  allow_pos_sync: boolean;
  allow_advanced_inventory: boolean;
  allow_fiscal_export: boolean;
  max_kds_stations: number;
  max_terminals: number;
  analytics_tier: AnalyticsTier;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  priceToman: number; // Mandatory integer Toman
  billingCycleDays: number;
  gracePeriodDays: number;
  defaultFlags: TenantFeatureFlags;
}

export interface TenantRecord {
  tenantId: string; // e.g. tenant-100hich-01, tenant-aurora-02
  name: string;
  nameFa?: string;
  ownerEmail: string;
  operatingModel: TenantOperatingModel;
  currency: 'IRR' | 'EUR';
  vatMode: VatMode;
  vatRate: number;
  status: TenantStatus;
  planId: string;
  planExpiresAt: number; // Unix epoch ms
  gracePeriodExpiresAt: number; // Unix epoch ms
  featureFlags: TenantFeatureFlags;
  hmacSecret: string;
  configManifest?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface ProvisionVenueRequest {
  name: string;
  nameFa?: string;
  ownerEmail: string;
  operatingModel?: TenantOperatingModel;
  currency?: 'IRR' | 'EUR';
  vatMode?: VatMode;
  vatRate?: number;
  planId?: string;
  customTenantId?: string;
  initialAdminUser?: {
    username: string;
    fullName: string;
    role: string;
  };
  hardwareProfile?: {
    cashierPrinters?: string[];
    kdsPrinters?: string[];
    buzzerEnabled?: boolean;
  };
}

export interface ProvisioningManifest {
  success: boolean;
  tenantId: string;
  name: string;
  status: TenantStatus;
  apiKey: string;
  hmacSecret: string;
  configJson: Record<string, any>;
  assignedPlan: SubscriptionPlan;
  featureFlags: TenantFeatureFlags;
  provisionedAt: number;
}

export interface SyncOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number; // integer Toman
  totalPrice: number; // integer Toman
  notes?: string;
}

export interface SyncOrder {
  clientGeneratedId: string; // Globally unique client UUID
  orderNumber?: string;
  totalAmount: number; // integer Toman
  taxAmount?: number; // integer Toman
  items: SyncOrderItem[];
  createdAt: number; // client timestamp ms
  paymentMethod?: string;
  state?: 'PAID' | 'COMPLETED' | 'CANCELLED';
  tableNumber?: string | number;
}

export interface IncomingSyncPayload {
  tenantId: string;
  batchId?: string;
  terminalId?: string;
  orders: SyncOrder[];
}

export interface BatchSyncResponse {
  status: 'success' | 'partial' | 'rejected';
  tenantId: string;
  batchId?: string;
  reconciledCount: number;
  duplicateCount: number;
  processedIds: string[];
  duplicateIds: string[];
  serverTimestamp: number;
  error?: string;
}

export interface ReconciledOrderRecord extends SyncOrder {
  tenantId: string;
  reconciledAt: number;
  batchId?: string;
  status: 'RECONCILED' | 'FLAGGED';
}

export interface SubscriptionAuditReport {
  timestamp: number;
  totalTenantsAudited: number;
  activeCount: number;
  gracePeriodCount: number;
  suspendedCount: number;
  flagMutations: Array<{
    tenantId: string;
    previousStatus: TenantStatus;
    newStatus: TenantStatus;
    flagsUpdated: Partial<TenantFeatureFlags>;
    reason: string;
  }>;
}

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  agent: 'tenantProvisionerAgent' | 'subscriptionAuditorAgent' | 'syncGatewayAgent' | 'admin';
  action: string;
  details: Record<string, any>;
  timestamp: number;
}
