/**
 * CAFE OS — Multi-Mode Tenant Operational Configuration Contract
 * Path: src/types/tenant-config.ts
 *
 * Defines operational modes, feature toggles, zone layouts, and tenant configuration contracts:
 * 1. COUNTER_QUICK_PAY: Specialty coffee bar counter flow (e.g. 100 HICH).
 *    Immediate fast payment, immediate receipt, optional or no table required.
 * 2. TAB_PAY_LATER: Gaming lounge & boardgame cafe flow (e.g. Modendo).
 *    Open table tabs, hourly PS5/boardgame sessions, accumulated orders, settle on exit.
 * 3. DINE_IN_PAY_BY_ORDER: Full-service bistro dining flow.
 *    Table-bound rounds, each order round paid immediately (Pay-by-Order) while preserving table session.
 *
 * Phase 4 Dual-Venue Enhancements:
 * - Dedicated zone and table layouts per venue.
 * - 4 dedicated PS5 stations for Modendo with hourly tracking.
 * - Dine-in Pay-Later enforced by default.
 * - Dual-mode takeaway ordering (Instant Pay vs. Open Tab for regulars).
 */

export type OperationalMode = 'COUNTER_QUICK_PAY' | 'TAB_PAY_LATER' | 'DINE_IN_PAY_BY_ORDER';

export type ZoneType =
  | 'COUNTER'
  | 'HALL'
  | 'GAMING_PS5'
  | 'VIP_BOARDGAME'
  | 'RETAIL'
  | 'TERRACE'
  | 'TAKEAWAY';

export interface VenueTableDef {
  id: string;
  tableNumber: string | number;
  label: string;
  capacity: number;
  isPs5Station?: boolean;
  ps5StationNumber?: number; // 1, 2, 3, 4
  hourlyRateToman?: number;
}

export interface VenueZoneConfig {
  id: string;
  nameFa: string;
  nameEn: string;
  type: ZoneType;
  sortOrder: number;
  tables: VenueTableDef[];
}

export interface TakeawayBillingPolicy {
  allowRegularOpenTab: boolean; // Enables "ثبت حساب باز بیرونبر (مشتری ثابت)"
  defaultBillingMode: 'INSTANT_PAY' | 'OPEN_TAB_REGULAR';
  requireCustomerPhone: boolean;
  requireCustomerName: boolean;
}

export interface DineInBillingPolicy {
  defaultMode: 'TAB_PAY_LATER' | 'DINE_IN_PAY_BY_ORDER' | 'COUNTER_QUICK_PAY';
  enforcePayLaterByDefault: boolean;
}

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
  zones: VenueZoneConfig[];
  takeawayPolicy: TakeawayBillingPolicy;
  dineInPolicy: DineInBillingPolicy;
}

// =============================================================================
// Default Tenant Operational Configurations
// =============================================================================

/**
 * 100 HICH Coffee Roasters (tenant-100hich-01)
 * Mode: COUNTER_QUICK_PAY (with dual takeaway flow and tasting/retail tables)
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
  zones: [
    {
      id: 'zone-100hich-counter',
      nameFa: 'کانتر و بار اکسپرس',
      nameEn: 'Express Bar & Counter',
      type: 'COUNTER',
      sortOrder: 1,
      tables: [
        { id: 'tbl-100hich-c1', tableNumber: 'C1', label: 'پیشخوان ۱ (سفارش سریع)', capacity: 1 },
        { id: 'tbl-100hich-c2', tableNumber: 'C2', label: 'پیشخوان ۲ (بار دم‌آوری)', capacity: 1 },
        { id: 'tbl-100hich-bar1', tableNumber: 'B1', label: 'صندلی بار ۱', capacity: 1 },
        { id: 'tbl-100hich-bar2', tableNumber: 'B2', label: 'صندلی بار ۲', capacity: 1 },
      ],
    },
    {
      id: 'zone-100hich-retail',
      nameFa: 'میزهای تست و خرده‌فروشی دان',
      nameEn: 'Coffee Tasting & Retail Tables',
      type: 'RETAIL',
      sortOrder: 2,
      tables: [
        { id: 'tbl-100hich-r1', tableNumber: 'R1', label: 'میز تست و کاپینگ ۱', capacity: 4 },
        { id: 'tbl-100hich-r2', tableNumber: 'R2', label: 'میز مشاوره دان و دم‌آوری ۲', capacity: 4 },
      ],
    },
  ],
  takeawayPolicy: {
    allowRegularOpenTab: true, // Enables "ثبت حساب باز بیرونبر (مشتری ثابت)"
    defaultBillingMode: 'INSTANT_PAY',
    requireCustomerPhone: true,
    requireCustomerName: true,
  },
  dineInPolicy: {
    defaultMode: 'COUNTER_QUICK_PAY',
    enforcePayLaterByDefault: false,
  },
};

/**
 * Modendo Cafe & Gaming Lounge (tenant-modendo-01)
 * Mode: TAB_PAY_LATER
 * Boardgame & PS5 gaming pods: open table tab, hourly billing, orders added during session, settle upon departure.
 * Includes 4 dedicated PS5 stations and Dine-In Pay-Later enforced by default.
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
  zones: [
    {
      id: 'zone-modendo-hall',
      nameFa: 'سالن اصلی بردگیم',
      nameEn: 'Main Boardgame Hall',
      type: 'HALL',
      sortOrder: 1,
      tables: [
        { id: 'tbl-modendo-1', tableNumber: 'T1', label: 'میز کافه T1', capacity: 4 },
        { id: 'tbl-modendo-2', tableNumber: 'T2', label: 'میز کافه T2', capacity: 4 },
        { id: 'tbl-modendo-3', tableNumber: 'T3', label: 'میز کافه T3', capacity: 4 },
        { id: 'tbl-modendo-4', tableNumber: 'T4', label: 'میز کافه T4', capacity: 6 },
        { id: 'tbl-modendo-5', tableNumber: 'T5', label: 'میز کافه T5', capacity: 4 },
        { id: 'tbl-modendo-6', tableNumber: 'T6', label: 'میز کافه T6', capacity: 6 },
      ],
    },
    {
      id: 'zone-modendo-ps5',
      nameFa: 'ایستگاه‌های کنسول PS5',
      nameEn: 'PS5 Gaming Pods',
      type: 'GAMING_PS5',
      sortOrder: 2,
      tables: [
        {
          id: 'tbl-modendo-ps5-1',
          tableNumber: 'PS5-1',
          label: 'پاد PS5 شماره ۱',
          capacity: 2,
          isPs5Station: true,
          ps5StationNumber: 1,
          hourlyRateToman: 90000,
        },
        {
          id: 'tbl-modendo-ps5-2',
          tableNumber: 'PS5-2',
          label: 'پاد PS5 شماره ۲',
          capacity: 2,
          isPs5Station: true,
          ps5StationNumber: 2,
          hourlyRateToman: 90000,
        },
        {
          id: 'tbl-modendo-ps5-3',
          tableNumber: 'PS5-3',
          label: 'پاد PS5 شماره ۳',
          capacity: 4,
          isPs5Station: true,
          ps5StationNumber: 3,
          hourlyRateToman: 90000,
        },
        {
          id: 'tbl-modendo-ps5-4',
          tableNumber: 'PS5-4',
          label: 'پاد PS5 شماره ۴',
          capacity: 4,
          isPs5Station: true,
          ps5StationNumber: 4,
          hourlyRateToman: 90000,
        },
      ],
    },
    {
      id: 'zone-modendo-vip',
      nameFa: 'اتاق VIP بردگیم',
      nameEn: 'VIP Boardgame Suite',
      type: 'VIP_BOARDGAME',
      sortOrder: 3,
      tables: [
        {
          id: 'tbl-modendo-vip-1',
          tableNumber: 'VIP-1',
          label: 'غرفه VIP گیمینگ ۱',
          capacity: 8,
          hourlyRateToman: 150000,
        },
        {
          id: 'tbl-modendo-vip-2',
          tableNumber: 'VIP-2',
          label: 'غرفه VIP گیمینگ ۲',
          capacity: 8,
          hourlyRateToman: 150000,
        },
      ],
    },
  ],
  takeawayPolicy: {
    allowRegularOpenTab: true, // Enables "ثبت حساب باز بیرونبر (مشتری ثابت)"
    defaultBillingMode: 'INSTANT_PAY',
    requireCustomerPhone: true,
    requireCustomerName: true,
  },
  dineInPolicy: {
    defaultMode: 'TAB_PAY_LATER',
    enforcePayLaterByDefault: true, // Enforce Dine-in Pay-Later by default
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
  zones: [
    {
      id: 'zone-bistro-dining',
      nameFa: 'سالن غذاخوری اصلی',
      nameEn: 'Main Dining Room',
      type: 'HALL',
      sortOrder: 1,
      tables: [
        { id: 'tbl-bistro-1', tableNumber: 1, label: 'میز ۱ (سالن)', capacity: 4 },
        { id: 'tbl-bistro-2', tableNumber: 2, label: 'میز ۲ (سالن)', capacity: 4 },
      ],
    },
  ],
  takeawayPolicy: {
    allowRegularOpenTab: false,
    defaultBillingMode: 'INSTANT_PAY',
    requireCustomerPhone: false,
    requireCustomerName: false,
  },
  dineInPolicy: {
    defaultMode: 'DINE_IN_PAY_BY_ORDER',
    enforcePayLaterByDefault: false,
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

/**
 * Retrieves configured zones for a given tenant.
 */
export function getTenantZones(tenantId?: string | null): VenueZoneConfig[] {
  return getTenantOperationalConfig(tenantId).zones;
}

/**
 * Retrieves all dedicated PS5 stations for a tenant (e.g. Modendo 4 stations).
 */
export function getTenantPs5Stations(tenantId?: string | null): VenueTableDef[] {
  const config = getTenantOperationalConfig(tenantId);
  const ps5Zone = config.zones.find((z) => z.type === 'GAMING_PS5');
  return ps5Zone ? ps5Zone.tables.filter((t) => t.isPs5Station) : [];
}

/**
 * Retrieves the takeaway billing policy for a given tenant.
 */
export function getTenantTakeawayPolicy(tenantId?: string | null): TakeawayBillingPolicy {
  return getTenantOperationalConfig(tenantId).takeawayPolicy;
}
