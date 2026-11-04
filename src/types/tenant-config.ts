/**
 * CAFE OS — Multi-Mode Tenant Operational Configuration Contract
 * Path: src/types/tenant-config.ts
 *
 * Defines operational modes, feature toggles, and tenant configuration contracts:
 * 1. COUNTER_QUICK_PAY: Specialty coffee bar counter flow (e.g. 100 HICH).
 *    Immediate fast payment, immediate receipt, optional or no table required.
 * 2. TAB_PAY_LATER: Gaming lounge & boardgame cafe flow (e.g. Modendo).
 *    Open table tabs, hourly PS5/boardgame sessions, accumulated orders, settle on exit.
 * 3. DINE_IN_PAY_BY_ORDER: Full-service bistro dining flow.
 *    Table-bound rounds, each order round paid immediately (Pay-by-Order) while preserving table session.
 */

export type OperationalMode = 'COUNTER_QUICK_PAY' | 'TAB_PAY_LATER' | 'DINE_IN_PAY_BY_ORDER';

export interface TenantOperationalFeatures {
  allowOpenTabs: boolean;
  requireTableSelection: boolean;
  requireImmediatePayment: boolean;
  autoPrintReceipt: boolean;
  allowHourlySessionBilling: boolean;
  roundSeparationEnabled: boolean;
  quickPayPresets: number[]; // e.g. [50000, 100000, 200000]
}

export interface TenantTableServiceConfig {
  requireGuestCount: boolean;
  defaultRoundLabel: string;
  autoReleaseTableOnSettle: boolean;
  allowSplitBill: boolean;
}

export interface TenantFiscalConfig {
  currency: 'TOMAN';
  integerMathOnly: true;
  vatTaxPercentage: number; // 9.0% standard
}

export interface TenantOperationalConfig {
  tenantId: string;
  tenantName: string;
  tenantNameEn: string;
  primaryMode: OperationalMode;
  supportedModes: OperationalMode[];
  features: TenantOperationalFeatures;
  tableService: TenantTableServiceConfig;
  fiscal: TenantFiscalConfig;
}

// =============================================================================
// Default Tenant Operational Configurations
// =============================================================================

/**
 * 100 HICH Coffee Roasters (tenant-100hich-01)
 * Mode: COUNTER_QUICK_PAY
 * High-speed specialty coffee bar: orders paid at counter, optional takeaway/quick bar seating.
 */
export const TENANT_CONFIG_100HICH: TenantOperationalConfig = {
  tenantId: 'tenant-100hich-01',
  tenantName: 'قهوه‌فروشی ۱۰۰هیچ',
  tenantNameEn: '100 HICH Coffee Roasters',
  primaryMode: 'COUNTER_QUICK_PAY',
  supportedModes: ['COUNTER_QUICK_PAY', 'DINE_IN_PAY_BY_ORDER'],
  features: {
    allowOpenTabs: false,
    requireTableSelection: false,
    requireImmediatePayment: true,
    autoPrintReceipt: true,
    allowHourlySessionBilling: false,
    roundSeparationEnabled: false,
    quickPayPresets: [50000, 100000, 200000, 500000],
  },
  tableService: {
    requireGuestCount: false,
    defaultRoundLabel: 'سفارش پیشخوان',
    autoReleaseTableOnSettle: true,
    allowSplitBill: false,
  },
  fiscal: {
    currency: 'TOMAN',
    integerMathOnly: true,
    vatTaxPercentage: 9.0,
  },
};

/**
 * Modendo Cafe & Gaming Lounge (tenant-modendo-01)
 * Mode: TAB_PAY_LATER
 * Boardgame & PS5 gaming pods: open table tab, hourly billing, orders added during session, settle upon departure.
 */
export const TENANT_CONFIG_MODENDO: TenantOperationalConfig = {
  tenantId: 'tenant-modendo-01',
  tenantName: 'کافه بازی و گیمینگ مودندو',
  tenantNameEn: 'Modendo Boardgame & Gaming Cafe',
  primaryMode: 'TAB_PAY_LATER',
  supportedModes: ['TAB_PAY_LATER', 'COUNTER_QUICK_PAY'],
  features: {
    allowOpenTabs: true,
    requireTableSelection: true,
    requireImmediatePayment: false,
    autoPrintReceipt: true,
    allowHourlySessionBilling: true,
    roundSeparationEnabled: true,
    quickPayPresets: [100000, 250000, 500000, 1000000],
  },
  tableService: {
    requireGuestCount: true,
    defaultRoundLabel: 'تب باز میز / گیم پاد',
    autoReleaseTableOnSettle: true,
    allowSplitBill: true,
  },
  fiscal: {
    currency: 'TOMAN',
    integerMathOnly: true,
    vatTaxPercentage: 9.0,
  },
};

/**
 * Generic Bistro Dining (tenant-bistro-01 / default bistro)
 * Mode: DINE_IN_PAY_BY_ORDER
 * Table service where each dining course or order round is paid upon placement (Pay-by-Order).
 */
export const TENANT_CONFIG_GENERIC_BISTRO: TenantOperationalConfig = {
  tenantId: 'tenant-bistro-01',
  tenantName: 'بیسترو و رستوران جنریک',
  tenantNameEn: 'Generic Bistro & Dining',
  primaryMode: 'DINE_IN_PAY_BY_ORDER',
  supportedModes: ['DINE_IN_PAY_BY_ORDER', 'COUNTER_QUICK_PAY'],
  features: {
    allowOpenTabs: false,
    requireTableSelection: true,
    requireImmediatePayment: true,
    autoPrintReceipt: true,
    allowHourlySessionBilling: false,
    roundSeparationEnabled: true,
    quickPayPresets: [100000, 200000, 400000, 800000],
  },
  tableService: {
    requireGuestCount: true,
    defaultRoundLabel: 'راند سفارش سالن',
    autoReleaseTableOnSettle: false, // Session continues across rounds until guest departs
    allowSplitBill: true,
  },
  fiscal: {
    currency: 'TOMAN',
    integerMathOnly: true,
    vatTaxPercentage: 9.0,
  },
};

// =============================================================================
// Registry & Resolvers
// =============================================================================

const tenantConfigRegistry: Record<string, TenantOperationalConfig> = {
  'tenant-100hich-01': TENANT_CONFIG_100HICH,
  '100hich': TENANT_CONFIG_100HICH,
  'tenant_100hich': TENANT_CONFIG_100HICH,
  'tenant-modendo-01': TENANT_CONFIG_MODENDO,
  'modendo': TENANT_CONFIG_MODENDO,
  'tenant_modendo': TENANT_CONFIG_MODENDO,
  'tenant-bistro-01': TENANT_CONFIG_GENERIC_BISTRO,
  'bistro': TENANT_CONFIG_GENERIC_BISTRO,
};

/**
 * Resolves the operational configuration for a given tenant ID.
 * Defaults to 100 HICH for unrecognized tenant IDs to maintain fail-closed stability.
 */
export function getTenantOperationalConfig(tenantId?: string | null): TenantOperationalConfig {
  if (!tenantId) {
    return TENANT_CONFIG_100HICH;
  }
  const cleanId = tenantId.trim().toLowerCase();
  if (tenantConfigRegistry[cleanId]) {
    return tenantConfigRegistry[cleanId];
  }
  if (cleanId.includes('modendo')) {
    return TENANT_CONFIG_MODENDO;
  }
  if (cleanId.includes('bistro')) {
    return TENANT_CONFIG_GENERIC_BISTRO;
  }
  return TENANT_CONFIG_100HICH;
}
