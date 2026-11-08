/**
 * ThemeLoader.ts
 * 
 * CafeOS / SmartOrders Multi-Tenant Dynamic Theme Loader (Phase 2 Stage A)
 * Enforces:
 *  - Strict tenant partitioning between 100 HICH and Modendo Cafe
 *  - Non-destructive token injection via CSS variables
 *  - Dynamic override support (.agency/theme.json or custom theme configs)
 *  - Zero layout tampering / pure visual layer separation
 */

import { TENANT_PROFILES, TenantProfile } from '../config/tenantConfig';

export interface TenantThemePalette {
  primaryBg: string;
  surfaceBg: string;
  accentColor: string;
  accentGlow?: string;
  textPrimary: string;
  textMuted: string;
  borderHairline: string;
  brandPrimary?: string;
  brandSecondary?: string;
}

export interface TenantThemeOverrides {
  tenantId?: string;
  brandNameFa?: string;
  brandNameEn?: string;
  palette?: Partial<TenantThemePalette>;
  customCssVariables?: Record<string, string>;
}

export interface AppliedThemeResult {
  tenantId: string;
  profile: TenantProfile;
  appliedCssVariables: Record<string, string>;
  isOverridden: boolean;
}

export class ThemeLoader {
  private static activeTenantId: string = '100hich';
  private static dynamicOverrides: Map<string, TenantThemeOverrides> = new Map();

  /**
   * Resolves canonical tenant key ('100hich' or 'modendo').
   */
  public static normalizeTenantId(tenantId?: string): '100hich' | 'modendo' {
    if (!tenantId) return '100hich';
    const lower = tenantId.trim().toLowerCase();
    if (lower.includes('modendo')) return 'modendo';
    return '100hich';
  }

  /**
   * Registers in-memory or loaded dynamic overrides for a given tenant.
   */
  public static registerOverrides(tenantId: string, overrides: TenantThemeOverrides): void {
    const key = this.normalizeTenantId(tenantId);
    this.dynamicOverrides.set(key, overrides);
  }

  /**
   * Clears registered dynamic overrides.
   */
  public static clearOverrides(tenantId?: string): void {
    if (tenantId) {
      this.dynamicOverrides.delete(this.normalizeTenantId(tenantId));
    } else {
      this.dynamicOverrides.clear();
    }
  }

  /**
   * Safely parses JSON strings originating from .agency/theme.json or theme.json.
   */
  public static parseThemeJson(jsonContent: string): TenantThemeOverrides | null {
    try {
      if (!jsonContent || typeof jsonContent !== 'string') return null;
      const parsed = JSON.parse(jsonContent);
      if (typeof parsed !== 'object' || parsed === null) return null;
      return parsed as TenantThemeOverrides;
    } catch (e) {
      console.warn('[ThemeLoader] Failed to parse custom theme JSON override:', e);
      return null;
    }
  }

  /**
   * Calculates the complete CSS variable dictionary for a tenant, including any active overrides.
   */
  public static computeCssVariables(
    tenantId: string,
    explicitOverrides?: TenantThemeOverrides
  ): Record<string, string> {
    const normTenant = this.normalizeTenantId(tenantId);
    const baseProfile = TENANT_PROFILES[normTenant] || TENANT_PROFILES['100hich'];
    const registered = this.dynamicOverrides.get(normTenant);
    const overrides = explicitOverrides || registered;

    const palette = {
      ...baseProfile.palette,
      ...(overrides?.palette || {}),
    };

    const is100Hich = normTenant === '100hich';

    const vars: Record<string, string> = {
      '--brand-tenant-id': normTenant === '100hich' ? 'tenant-100hich-01' : 'tenant-modendo-01',
      '--brand-name': overrides?.brandNameEn || baseProfile.brandNameEn,
      '--brand-name-fa': overrides?.brandNameFa || baseProfile.brandNameFa,

      // App Dynamic Shell
      '--app-bg': palette.primaryBg,
      '--app-surface': palette.surfaceBg,
      '--app-accent': palette.accentColor,
      '--app-text': palette.textPrimary,
      '--app-border': palette.borderHairline,

      // Brand Primaries
      '--color-brand-primary': palette.brandPrimary || palette.accentColor,
      '--color-brand-secondary': palette.brandSecondary || palette.surfaceBg,
      '--color-brand-accent': palette.accentColor,

      // Text Semantics
      '--color-text-primary': palette.textPrimary,
      '--color-text-muted': palette.textMuted,
      '--color-text-secondary': palette.textMuted,

      // Surface & Header
      '--color-header-bg': palette.surfaceBg,
      '--color-header-border': palette.accentColor,
      '--color-surface-base': is100Hich ? '#0D0F12' : '#08090C',
      '--color-surface-card': is100Hich ? '#161A1F' : '#11141A',
      '--color-surface-panel': is100Hich ? '#1A1F26' : '#161A22',
      '--color-surface-border': palette.borderHairline,
    };

    // Merge any custom arbitrary CSS variables defined in override
    if (overrides?.customCssVariables) {
      for (const [key, val] of Object.entries(overrides.customCssVariables)) {
        if (typeof val === 'string' && key.startsWith('--')) {
          vars[key] = val;
        }
      }
    }

    return vars;
  }

  /**
   * Applies the computed theme variables to the DOM (document.documentElement).
   * Safe for non-browser (Node / SSR) environments.
   */
  public static applyTheme(
    tenantId: string,
    overrides?: TenantThemeOverrides
  ): AppliedThemeResult {
    const normTenant = this.normalizeTenantId(tenantId);
    this.activeTenantId = normTenant;

    const baseProfile = TENANT_PROFILES[normTenant] || TENANT_PROFILES['100hich'];
    const cssVars = this.computeCssVariables(normTenant, overrides);

    if (typeof document !== 'undefined' && document.documentElement) {
      const root = document.documentElement;

      // Apply CSS Custom Properties
      for (const [key, val] of Object.entries(cssVars)) {
        root.style.setProperty(key, val);
      }

      // Set data-tenant attribute for CSS selector specificity
      root.setAttribute('data-tenant', normTenant === '100hich' ? 'tenant-100hich-01' : 'tenant-modendo-01');

      // Update body class list cleanly
      if (document.body) {
        document.body.classList.remove('theme-100hich', 'theme-modendo');
        document.body.classList.add(`theme-${normTenant}`);
      }
    }

    return {
      tenantId: normTenant,
      profile: baseProfile,
      appliedCssVariables: cssVars,
      isOverridden: !!(overrides || this.dynamicOverrides.has(normTenant)),
    };
  }

  /**
   * Returns current active tenant ID.
   */
  public static getActiveTenantId(): string {
    return this.activeTenantId;
  }
}
