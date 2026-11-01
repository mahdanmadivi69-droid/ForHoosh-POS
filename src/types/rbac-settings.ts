/**
 * Types & Interfaces for CafeOS RBAC, Settings & Hardware Handoff (v2.4.0)
 * AutoClaw & AntiGravity Elite UI/UX Specification
 */

export type RoleLevel = 1 | 2 | 3 | 4;

export type AppUserRole = 'OWNER' | 'ACCOUNTANT' | 'MANAGER' | 'CASHIER' | 'BARISTA';

export type Permission =
  | 'ALL'
  | 'VIEW_FINANCIALS'
  | 'EXPORT_TAX_LEDGER'
  | 'VIEW_INVENTORY'
  | 'EDIT_BOM_COSTS'
  | 'VIEW_Z_REPORT'
  | 'ORDER_DISPATCH'
  | 'ORDER_SETTLE'
  | 'OVERRIDE_DISCOUNT_20'
  | 'VOID_DISPATCHED_ITEM'
  | 'EDIT_INVENTORY_STOCK'
  | 'PRINTER_DIAGNOSTICS'
  | 'VIEW_STOCK_LEVELS'
  | 'REPRINT_LAST_TICKET';

export type ElevationAction =
  | 'VOID_DISPATCHED_ORDER'
  | 'CUSTOM_DISCOUNT_ABOVE_ZERO'
  | 'OPEN_CASH_DRAWER_MANUAL'
  | 'ACCESS_SETTINGS_PANEL'
  | 'EDIT_RECIPE_BOM'
  | 'DELETE_PRINTER_PROFILE'
  | 'RESET_STORE_CONFIG';

export interface RoleDefinition {
  level: RoleLevel;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  permissions: Permission[];
  color: string;
  badgeBg: string;
}

export interface AuthUserRecord {
  id: string;
  tenantId: string;
  username: string;
  fullName: string;
  phoneNumber?: string;
  role: AppUserRole;
  pinHash: string; // SHA-256 / PBKDF2 hashed PIN
  salt: string;    // Unique cryptographic salt
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ElevationAuditLog {
  id: string;
  action_type: ElevationAction;
  requested_by_user: string;
  authorized_by_manager: string;
  timestamp: string; // ISO string
  metadata?: Record<string, any>;
  status: 'GRANTED' | 'DENIED';
}

// -------------------------------------------------------------
// Module: Printer Hub & Hardware Devices
// -------------------------------------------------------------

export type PrinterStation = 'CASHIER_RECEIPT' | 'BAR_KDS' | 'KITCHEN_KDS';

export type PrinterConnectionType = 'WEB_SERIAL' | 'NETWORK_RAW_9100' | 'BROWSER_SPOOLER';

export type RollWidthMm = 58 | 80;

export interface HardwareDeviceProfile {
  id: string; // UUID
  alias: string; // e.g. "Barista Counter Thermal"
  station: PrinterStation;
  connection_type: PrinterConnectionType;
  target_address: string; // IP:Port or Serial COM/Vendor ID
  paper_width_mm: RollWidthMm;
  character_width: number; // 42 for 80mm, 32 for 58mm
  code_page: string; // "CP1256 (Persian/Arabic Support)"
  auto_cut: boolean;
  cash_drawer_kick_pulse: boolean;
  isDefault?: boolean;
  baud_rate?: number; // 9600, 19200, 38400, 115200
  status?: 'ONLINE' | 'STANDBY' | 'CONNECTING' | 'ERROR';
  lastPingMs?: number;
}

export type DiagnosticAction =
  | 'CONNECT_USB_SERIAL'
  | 'DISCONNECT_DEVICE'
  | 'PING_NETWORK_SOCKET'
  | 'TRIGGER_TEST_TICKET'
  | 'TRIGGER_DRAWER_PULSE';

// -------------------------------------------------------------
// Module: General Environment Settings
// -------------------------------------------------------------

export interface StoreProfileConfig {
  name_fa: string;
  name_en: string;
  address: string;
  phone: string;
  tax_registration_no: string;
}

export interface FiscalRulesConfig {
  vat_tax_percentage: number; // 9.0
  dine_in_service_charge_percentage: number; // 0.0
  takeaway_pack_fee_fixed: number; // 0
  currency_display: 'TOMAN' | 'IRR' | 'USD';
}

export interface ReceiptTemplateConfig {
  header_lines: string[];
  footer_lines: string[];
  print_qr_invoice_link: boolean;
}

export interface SystemPreferencesConfig {
  audio_feedback_enabled: boolean;
  auto_open_table_selector_after_settle: boolean;
  kds_sound_alert_interval_sec: number;
}

export interface AppSettingsPayload {
  store_profile: StoreProfileConfig;
  fiscal_rules: FiscalRulesConfig;
  receipt_template: ReceiptTemplateConfig;
  system_preferences: SystemPreferencesConfig;
  updated_at: string;
}

export interface AppSettingRecord {
  key: string;
  value: any;
  updatedAt: number;
}
