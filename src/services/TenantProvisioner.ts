/**
 * CAFE OS — DYNAMIC SAAS TENANT PROVISIONER (Phase 13)
 * Target ID: AG-13.3
 * 
 * Automates:
 *  1. Cold-start IndexedDB schema seeding for newly registered tenants
 *  2. Default catalog, roles, sections, and hardware printer configurations
 *  3. Cryptographic HMAC-SHA256 signed table QR token generation
 *  4. SQLite local mesh schema compilation manifest synchronization
 */

import { getCafeDatabase, CafeDatabase } from '../db/cafeDb';
import { HardwareDeviceProfile, AuthUserRecord } from '../types/rbac-settings';

export interface OperationalSection {
  id: string;
  nameEn: string;
  nameFa: string;
  tableCount: number;
  tablePrefix: string;
}

export interface PrinterEndpointConfig {
  id: string;
  alias: string;
  station: 'BAR' | 'KITCHEN' | 'CASHIER';
  ipAddress: string;
  port: number; // Standard ESC/POS 9100
  paperWidth: '80mm' | '58mm';
  enableBuzzer: boolean;
  enableCutter: boolean;
  isDefault: boolean;
}

export interface TenantThemeConfig {
  primaryColor: string; // e.g. #D71921
  secondaryColor: string; // e.g. #0F223D
  accentColor: string; // e.g. #F59E0B
  surfaceBase?: string; // e.g. #090D14
  surfaceCard?: string; // e.g. #161A1F
  fontFamilyFa?: string;
  logoUrl?: string;
}

export interface TenantManifest {
  tenantId: string; // e.g. tenant-aurora-01
  brandNameEn: string;
  brandNameFa: string;
  taglineFa?: string;
  currency: 'IRR' | 'EUR';
  taxInclusive: boolean;
  sections: OperationalSection[];
  printers: PrinterEndpointConfig[];
  theme: TenantThemeConfig;
  hmacSecret: string;
  createdAt: string;
  version: string;
}

export interface ProvisioningResult {
  success: boolean;
  tenantId: string;
  dbName: string;
  tablesSeededCount: number;
  menuItemsSeededCount: number;
  qrTokensGenerated: Record<string, string>; // tableId -> signed QR URL
  timestamp: string;
  error?: string;
}

// -----------------------------------------------------------------------------
// Cryptographic Utility: Lightweight Web Crypto HMAC-SHA256
// -----------------------------------------------------------------------------

async function generateHmacSignature(message: string, secret: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyData = enc.encode(secret);
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch {
      // Fallback below
    }
  }
  // Deterministic fallback for environments without crypto.subtle
  let hash = 0;
  const combined = `${message}:${secret}`;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// -----------------------------------------------------------------------------
// Tenant Provisioner Implementation
// -----------------------------------------------------------------------------

export class TenantProvisioner {
  private static STORAGE_KEY_MANIFESTS = 'cafeos_saas_tenant_manifests';
  private static STORAGE_KEY_ACTIVE_TENANT = 'cafeos_active_tenant_id';

  /**
   * Retrieves all registered SaaS tenant manifests from local storage.
   */
  public static getAllManifests(): TenantManifest[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_MANIFESTS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[TenantProvisioner] Failed to parse tenant manifests:', e);
    }
    return [];
  }

  /**
   * Retrieves a specific tenant manifest by ID.
   */
  public static getManifest(tenantId: string): TenantManifest | null {
    const all = this.getAllManifests();
    return all.find((m) => m.tenantId === tenantId) || null;
  }

  /**
   * Saves or updates a tenant manifest in local storage.
   */
  public static saveManifest(manifest: TenantManifest): void {
    const all = this.getAllManifests().filter((m) => m.tenantId !== manifest.tenantId);
    all.push(manifest);
    localStorage.setItem(this.STORAGE_KEY_MANIFESTS, JSON.stringify(all));
  }

  /**
   * Activates a specific tenant in localStorage.
   */
  public static setActiveTenant(tenantId: string): void {
    localStorage.setItem(this.STORAGE_KEY_ACTIVE_TENANT, JSON.stringify(tenantId));
  }

  /**
   * Full Cold-Start Provisioning Orchestrator.
   * Initializes Dexie database, seeds categories/items, printers, users, and tables,
   * then computes signed QR access tokens for all floor stations.
   */
  public static async provisionTenant(manifest: TenantManifest): Promise<ProvisioningResult> {
    const timestamp = new Date().toISOString();
    const tenantDb: CafeDatabase = getCafeDatabase(manifest.tenantId);

    try {
      // 1. Seed Operational Sections & Tables
      let totalTables = 0;
      const qrTokens: Record<string, string> = {};

      for (const section of manifest.sections) {
        for (let i = 1; i <= section.tableCount; i++) {
          totalTables++;
          const tableId = `${section.tablePrefix}${i}`;
          const rawPayload = `${manifest.tenantId}:${tableId}:${section.id}`;
          const signature = await generateHmacSignature(rawPayload, manifest.hmacSecret);
          const qrUrl = `https://pos.cafeos.app/menu?tenant=${encodeURIComponent(manifest.tenantId)}&table=${encodeURIComponent(tableId)}&sec=${encodeURIComponent(section.id)}&sig=${signature}`;
          qrTokens[tableId] = qrUrl;
        }
      }

      // 2. Cold-Start Catalog Seeding (Default Specialty Coffee & Bakery)
      const countExisting = await tenantDb.menuItems.count();
      let seededItemsCount = 0;

      if (countExisting === 0) {
        const seedItems = [
          {
            id: `item_${manifest.tenantId}_esp_01`,
            categoryId: 'cat_espresso',
            title: 'اسپرسو دوبل تخصصی (Single Origin)',
            description: 'عصاره‌گیری ۱:۲ با دانه تازه برشته',
            price: manifest.currency === 'IRR' ? 1200000 : 158, // 120,000 Toman / ~1.58 EUR
            isAvailable: true,
            preparationTimeMinutes: 4,
          },
          {
            id: `item_${manifest.tenantId}_flat_01`,
            categoryId: 'cat_espresso',
            title: 'فلت وایت (Flat White)',
            description: 'دابل ریسترتو با شیر ابریشمی میکروفوم',
            price: manifest.currency === 'IRR' ? 1750000 : 230,
            isAvailable: true,
            preparationTimeMinutes: 5,
          },
          {
            id: `item_${manifest.tenantId}_v60_01`,
            categoryId: 'cat_brew',
            title: 'قهوه دمی V60 تخصصی',
            description: 'دم‌آوری دستی بر پایه پارامترهای طلایی SCA',
            price: manifest.currency === 'IRR' ? 2400000 : 315,
            isAvailable: true,
            preparationTimeMinutes: 7,
          },
          {
            id: `item_${manifest.tenantId}_crois_01`,
            categoryId: 'cat_bakery',
            title: 'کرواسان کره‌ای تازه فرانسوی',
            description: 'پخت روزانه با کره طبیعی ۸۲٪',
            price: manifest.currency === 'IRR' ? 1900000 : 250,
            isAvailable: true,
            preparationTimeMinutes: 2,
          },
        ];

        for (const item of seedItems) {
          await tenantDb.menuItems.put(item as any);
        }
        seededItemsCount = seedItems.length;
      }

      // 3. Seed Hardware ESC/POS Printer Profiles
      const existingPrinters = await tenantDb.printerProfiles.count();
      if (existingPrinters === 0 && manifest.printers && manifest.printers.length > 0) {
        for (const p of manifest.printers) {
          const stationMap: Record<string, 'BAR_KDS' | 'KITCHEN_KDS' | 'CASHIER_RECEIPT'> = {
            BAR: 'BAR_KDS',
            KITCHEN: 'KITCHEN_KDS',
            CASHIER: 'CASHIER_RECEIPT',
          };
          const profile: HardwareDeviceProfile = {
            id: p.id,
            alias: p.alias,
            station: stationMap[p.station] || 'BAR_KDS',
            connection_type: 'NETWORK_RAW_9100',
            target_address: `${p.ipAddress}:${p.port}`,
            paper_width_mm: p.paperWidth === '80mm' ? 80 : 58,
            character_width: p.paperWidth === '80mm' ? 42 : 32,
            code_page: 'CP1256 (Persian/Arabic Support)',
            auto_cut: p.enableCutter,
            cash_drawer_kick_pulse: p.station === 'CASHIER',
            isDefault: p.isDefault,
            status: 'ONLINE',
          };
          await tenantDb.printerProfiles.put(profile);
        }
      }

      // 4. Seed Root Owner & Cashier Roles
      const existingUsers = await tenantDb.authUsers.count();
      if (existingUsers === 0) {
        const rootAdmin: AuthUserRecord = {
          id: `usr_${manifest.tenantId}_owner`,
          tenantId: manifest.tenantId,
          username: `owner_${manifest.tenantId.replace('tenant-', '')}`,
          fullName: `مدیر ارشد ${manifest.brandNameFa}`,
          role: 'OWNER',
          pinHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // 'admin' default hash
          salt: 'salt_root_admin',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await tenantDb.authUsers.put(rootAdmin);
      }

      // 5. Commit Manifest to Registry
      this.saveManifest(manifest);

      return {
        success: true,
        tenantId: manifest.tenantId,
        dbName: `CafeOS_LocalDB_${manifest.tenantId}`,
        tablesSeededCount: totalTables,
        menuItemsSeededCount: seededItemsCount,
        qrTokensGenerated: qrTokens,
        timestamp,
      };
    } catch (error: any) {
      console.error('[TenantProvisioner] Provisioning failed:', error);
      return {
        success: false,
        tenantId: manifest.tenantId,
        dbName: `CafeOS_LocalDB_${manifest.tenantId}`,
        tablesSeededCount: 0,
        menuItemsSeededCount: 0,
        qrTokensGenerated: {},
        timestamp,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Compiles the dynamic tenant configuration into a localized SQLite mesh schema sync payload.
   */
  public static compileTenantMeshSchema(manifest: TenantManifest): Record<string, any> {
    return {
      schema_version: 'v13.0',
      tenant_id: manifest.tenantId,
      brand_name: manifest.brandNameEn,
      brand_name_fa: manifest.brandNameFa,
      currency: manifest.currency,
      tax_policy: manifest.taxInclusive ? 'TAX_INCLUSIVE_9_109' : 'TAX_EXCLUSIVE_9_PERCENT',
      sections_topology: manifest.sections.map((s) => ({
        section_id: s.id,
        name: s.nameEn,
        name_fa: s.nameFa,
        capacity: s.tableCount,
        prefix: s.tablePrefix,
      })),
      hardware_mesh_routes: manifest.printers.map((p) => ({
        station: p.station,
        endpoint: `${p.ipAddress}:${p.port}`,
        specs: `${p.paperWidth};buzzer=${p.enableBuzzer};cutter=${p.enableCutter}`,
      })),
      theme_tokens: {
        primary: manifest.theme.primaryColor,
        secondary: manifest.theme.secondaryColor,
        accent: manifest.theme.accentColor,
        surface_base: manifest.theme.surfaceBase || '#090D14',
        surface_card: manifest.theme.surfaceCard || '#161A1F',
      },
      compiled_at: new Date().toISOString(),
    };
  }
}
