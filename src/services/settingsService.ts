/**
 * CAFE OS — Settings Service (Local-First IndexedDB Persistence)
 * Manages Store Profile, Fiscal Rules, Receipt Templates, System Preferences & Printer Profiles
 */

import { db } from '../db/cafeDb';
import {
  AppSettingsPayload,
  StoreProfileConfig,
  FiscalRulesConfig,
  ReceiptTemplateConfig,
  SystemPreferencesConfig,
  HardwareDeviceProfile,
} from '../types/rbac-settings';
import { audioFeedback } from './audioFeedback';
import { SmartOrdersStore } from './storage';

export const MODENDO_STORE_PROFILE: StoreProfileConfig = {
  name_fa: 'کافه بردگیم و گیمینگ مودندو',
  name_en: 'Modendo Boardgame & Gaming Cafe',
  address: 'تهران، خیابان شریعتی، مجتمع تجاری مودندو، طبقه منفی ۱ و همکف',
  phone: '021-88997766',
  tax_registration_no: '14009876543',
};

export const MODENDO_RECEIPT_TEMPLATE: ReceiptTemplateConfig = {
  header_lines: [
    '*** MODENDO BOARDGAME & GAMING CAFE ***',
    'مرکز بازی‌های رومیزی و اتاق کنسول PS5',
  ],
  footer_lines: [
    'Wi-Fi: Modendo-Guest / Pass: modendo2026',
    'از بازی و همراهی شما در کافه مودندو سپاسگزاریم',
    'www.instagram.com/modendo.cafe',
  ],
  print_qr_invoice_link: true,
};

export const MODENDO_PRINTER_PROFILES: HardwareDeviceProfile[] = [
  {
    id: 'printer-barista-01',
    alias: 'چاپگر سفارشات بار (Bar Station LAN)',
    station: 'BAR_KDS',
    connection_type: 'NETWORK_RAW_9100',
    target_address: '192.168.1.101:9100',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: false,
    baud_rate: 9600,
    status: 'ONLINE',
    isDefault: true,
  },
  {
    id: 'printer-kitchen-02',
    alias: 'چاپگر سفارشات آشپزخانه (Kitchen Station LAN)',
    station: 'KITCHEN_KDS',
    connection_type: 'NETWORK_RAW_9100',
    target_address: '192.168.1.102:9100',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: false,
    status: 'ONLINE',
    isDefault: false,
  },
  {
    id: 'printer-cashier-03',
    alias: 'چاپگر فیش صندوق و کشوی پول (Cashier Master)',
    station: 'CASHIER_RECEIPT',
    connection_type: 'NETWORK_RAW_9100',
    target_address: '192.168.1.100:9100',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: true,
    status: 'ONLINE',
    isDefault: false,
  },
];

export const DEFAULT_STORE_PROFILE: StoreProfileConfig = {
  name_fa: 'قهوه‌فروشی ۱۰۰هیچ',
  name_en: '100 HICH Coffee Roasters',
  address: 'اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت‌باکس',
  phone: '021-44668090',
  tax_registration_no: '14008923451',
};

export const DEFAULT_FISCAL_RULES: FiscalRulesConfig = {
  vat_tax_percentage: 9.0,
  dine_in_service_charge_percentage: 0.0,
  takeaway_pack_fee_fixed: 0,
  currency_display: 'TOMAN',
};

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateConfig = {
  header_lines: [
    '*** 100 HICH SPECIALTY COFFEE ***',
    'Fresh Crop - Micro Batch Roastery',
  ],
  footer_lines: [
    'Wi-Fi: Hich-Guest / Pass: espresso2026',
    'لطفاً نظرات خود را با ما در میان بگذارید',
    'www.instagram.com/100hich',
  ],
  print_qr_invoice_link: false,
};

export const DEFAULT_SYSTEM_PREFERENCES: SystemPreferencesConfig = {
  audio_feedback_enabled: true,
  auto_open_table_selector_after_settle: true,
  kds_sound_alert_interval_sec: 30,
};

export const DEFAULT_PRINTER_PROFILES: HardwareDeviceProfile[] = [
  {
    id: 'printer-barista-01',
    alias: 'چاپگر حرارتی بارتندر (Barista Counter Thermal)',
    station: 'BAR_KDS',
    connection_type: 'WEB_SERIAL',
    target_address: 'COM3 (Baud 9600)',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: false,
    baud_rate: 9600,
    status: 'ONLINE',
    isDefault: true,
  },
  {
    id: 'printer-cashier-02',
    alias: 'چاپگر فیش صندوق و کشو (Cashier Receipt)',
    station: 'CASHIER_RECEIPT',
    connection_type: 'NETWORK_RAW_9100',
    target_address: '192.168.1.200:9100',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: true,
    status: 'ONLINE',
    isDefault: false,
  },
  {
    id: 'printer-kitchen-03',
    alias: 'چاپگر باریک آشپزخانه (Kitchen 58mm)',
    station: 'KITCHEN_KDS',
    connection_type: 'BROWSER_SPOOLER',
    target_address: 'SPOOLER:Kitchen-Thermal-58',
    paper_width_mm: 58,
    character_width: 32,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: false,
    status: 'STANDBY',
    isDefault: false,
  },
];

export class SettingsService {
  private static isInitialized = false;

  /**
   * Initializes default settings and printer profiles in IndexedDB if empty
   */
  public static async initDefaults(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. Check App Settings
      const storeSetting = await db.appSettings.get('store_profile');
      if (!storeSetting) {
        await db.appSettings.put({
          key: 'store_profile',
          value: DEFAULT_STORE_PROFILE,
          updatedAt: Date.now(),
        });
      }

      const fiscalSetting = await db.appSettings.get('fiscal_rules');
      if (!fiscalSetting) {
        await db.appSettings.put({
          key: 'fiscal_rules',
          value: DEFAULT_FISCAL_RULES,
          updatedAt: Date.now(),
        });
      }

      const receiptSetting = await db.appSettings.get('receipt_template');
      if (!receiptSetting) {
        await db.appSettings.put({
          key: 'receipt_template',
          value: DEFAULT_RECEIPT_TEMPLATE,
          updatedAt: Date.now(),
        });
      }

      const sysPrefSetting = await db.appSettings.get('system_preferences');
      if (!sysPrefSetting) {
        await db.appSettings.put({
          key: 'system_preferences',
          value: DEFAULT_SYSTEM_PREFERENCES,
          updatedAt: Date.now(),
        });
      } else {
        audioFeedback.setEnabled(sysPrefSetting.value.audio_feedback_enabled ?? true);
      }

      // 2. Check Printer Profiles
      const printerCount = await db.printerProfiles.count();
      if (printerCount === 0) {
        for (const profile of DEFAULT_PRINTER_PROFILES) {
          await db.printerProfiles.put(profile);
        }
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[SettingsService] Failed to initialize default settings in IndexedDB:', err);
    }
  }

  /**
   * Load entire settings payload
   */
  public static async loadSettings(tenantId?: string): Promise<AppSettingsPayload> {
    await this.initDefaults();
    const activeTenantId = tenantId || SmartOrdersStore.getActiveTenantId();

    const [storeRecord, fiscalRecord, receiptRecord, sysPrefRecord] = await Promise.all([
      db.appSettings.get(activeTenantId === 'tenant-modendo-01' ? 'store_profile_modendo' : 'store_profile'),
      db.appSettings.get('fiscal_rules'),
      db.appSettings.get(activeTenantId === 'tenant-modendo-01' ? 'receipt_template_modendo' : 'receipt_template'),
      db.appSettings.get('system_preferences'),
    ]);

    const sysPrefs = (sysPrefRecord?.value as SystemPreferencesConfig) || DEFAULT_SYSTEM_PREFERENCES;
    audioFeedback.setEnabled(sysPrefs.audio_feedback_enabled ?? true);

    const defaultStore = activeTenantId === 'tenant-modendo-01' ? MODENDO_STORE_PROFILE : DEFAULT_STORE_PROFILE;
    const defaultReceipt = activeTenantId === 'tenant-modendo-01' ? MODENDO_RECEIPT_TEMPLATE : DEFAULT_RECEIPT_TEMPLATE;

    return {
      store_profile: (storeRecord?.value as StoreProfileConfig) || defaultStore,
      fiscal_rules: (fiscalRecord?.value as FiscalRulesConfig) || DEFAULT_FISCAL_RULES,
      receipt_template: (receiptRecord?.value as ReceiptTemplateConfig) || defaultReceipt,
      system_preferences: sysPrefs,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Saves individual or all settings sections
   */
  public static async saveSettings(payload: Partial<AppSettingsPayload>, tenantId?: string): Promise<void> {
    const now = Date.now();
    const activeTenantId = tenantId || SmartOrdersStore.getActiveTenantId();
    const storeKey = activeTenantId === 'tenant-modendo-01' ? 'store_profile_modendo' : 'store_profile';
    const receiptKey = activeTenantId === 'tenant-modendo-01' ? 'receipt_template_modendo' : 'receipt_template';

    if (payload.store_profile) {
      await db.appSettings.put({
        key: storeKey,
        value: payload.store_profile,
        updatedAt: now,
      });
    }

    if (payload.fiscal_rules) {
      await db.appSettings.put({
        key: 'fiscal_rules',
        value: payload.fiscal_rules,
        updatedAt: now,
      });
    }

    if (payload.receipt_template) {
      await db.appSettings.put({
        key: receiptKey,
        value: payload.receipt_template,
        updatedAt: now,
      });
    }

    if (payload.system_preferences) {
      await db.appSettings.put({
        key: 'system_preferences',
        value: payload.system_preferences,
        updatedAt: now,
      });
      audioFeedback.setEnabled(payload.system_preferences.audio_feedback_enabled);
    }
  }

  /**
   * Retrieve all printer profiles from IndexedDB
   */
  public static async getPrinterProfiles(): Promise<HardwareDeviceProfile[]> {
    await this.initDefaults();
    return db.printerProfiles.toArray();
  }

  /**
   * Save or update a printer profile
   */
  public static async savePrinterProfile(profile: HardwareDeviceProfile): Promise<void> {
    // Automatically set character width if roll width changed
    const charWidth = profile.paper_width_mm === 80 ? 42 : 32;
    const updated = {
      ...profile,
      character_width: charWidth,
    };
    await db.printerProfiles.put(updated);
  }

  /**
   * Delete a printer profile
   */
  public static async deletePrinterProfile(id: string): Promise<void> {
    await db.printerProfiles.delete(id);
  }
}
