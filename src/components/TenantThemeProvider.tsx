/**
 * CAFE OS — DYNAMIC LIQUID-GLASS TENANT THEME TOKENIZER
 * Target ID: AG-13.2
 * 
 * Provides:
 *  1. Dynamic runtime CSS variable injection into :root (document.documentElement)
 *  2. React Context & Hooks for active tenant theme switching
 *  3. Automatic HEX to RGB tuple conversion for Tailwind opacity support
 *  4. Zero-perceptual-latency re-skinning without full page reload
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { TenantManifest, TenantProvisioner, TenantThemeConfig } from '../services/TenantProvisioner';

export interface TenantThemeContextType {
  activeTenant: TenantManifest | null;
  allTenants: TenantManifest[];
  isCustomized: boolean;
  switchTenant: (tenantId: string) => void;
  updateTenantTheme: (tenantId: string, theme: Partial<TenantThemeConfig>) => void;
  resetToDefaultTheme: () => void;
}

const DEFAULT_100HICH_MANIFEST: TenantManifest = {
  tenantId: 'tenant-100hich-01',
  brandNameEn: '100 HICH Coffee Roasters',
  brandNameFa: 'قهوه‌فروشی ۱۰۰هیچ',
  taglineFa: 'لذت طعم اصیل قهوه تخصصی و برشته‌کاری موج سوم',
  currency: 'IRR',
  taxInclusive: true,
  sections: [
    { id: 'sec_bar', nameEn: 'Espresso Bar', nameFa: 'بار اسپرسو', tableCount: 6, tablePrefix: 'B-' },
    { id: 'sec_salon', nameEn: 'Main Salon', nameFa: 'سالن مرکزی', tableCount: 12, tablePrefix: 'T-' },
    { id: 'sec_patio', nameEn: 'Outdoor Terrace', nameFa: 'تراس و فضای باز', tableCount: 8, tablePrefix: 'P-' },
  ],
  printers: [
    {
      id: 'prn_bar_01',
      alias: 'Bar Thermal Receipt Printer',
      station: 'BAR',
      ipAddress: '192.168.1.201',
      port: 9100,
      paperWidth: '80mm',
      enableBuzzer: true,
      enableCutter: true,
      isDefault: true,
    },
    {
      id: 'prn_kit_01',
      alias: 'Kitchen Production Ticket Printer',
      station: 'KITCHEN',
      ipAddress: '192.168.1.202',
      port: 9100,
      paperWidth: '80mm',
      enableBuzzer: true,
      enableCutter: true,
      isDefault: false,
    },
  ],
  theme: {
    primaryColor: '#D71921',
    secondaryColor: '#0F223D',
    accentColor: '#F59E0B',
    surfaceBase: '#090D14',
    surfaceCard: '#161A1F',
    logoUrl: '/logos/100hich-logo.svg',
  },
  hmacSecret: 'hich_sec_9941a87c102e',
  createdAt: '2026-10-31T00:00:00Z',
  version: 'v13.0',
};

const TenantThemeContext = createContext<TenantThemeContextType | undefined>(undefined);

// Helper: Convert HEX (#RRGGBB) to "R, G, B" string for CSS rgba() usage
function hexToRgbString(hex: string): string {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '215, 25, 33'; // Default fallback
}

/**
 * Injects CSS variables onto document.documentElement to immediately re-skin the application.
 */
function applyThemeToDom(theme: TenantThemeConfig, tenantId: string, brandName: string, brandNameFa: string) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const primaryRgb = hexToRgbString(theme.primaryColor);
  const secondaryRgb = hexToRgbString(theme.secondaryColor);

  // Set active tenant data attribute for CSS scoping
  root.setAttribute('data-tenant', tenantId);

  // Brand Identifiers
  root.style.setProperty('--brand-tenant-id', tenantId);
  root.style.setProperty('--brand-name', brandName);
  root.style.setProperty('--brand-name-fa', brandNameFa);

  // Primary Palette Tokens
  root.style.setProperty('--color-brand-primary', theme.primaryColor);
  root.style.setProperty('--color-brand-primary-rgb', primaryRgb);
  root.style.setProperty('--color-brand-primary-light', `rgba(${primaryRgb}, 0.12)`);
  root.style.setProperty('--color-brand-primary-border', `rgba(${primaryRgb}, 0.35)`);

  // Secondary Palette Tokens
  root.style.setProperty('--color-brand-secondary', theme.secondaryColor);
  root.style.setProperty('--color-brand-secondary-rgb', secondaryRgb);

  // Accent & Highlights
  root.style.setProperty('--color-brand-accent', theme.accentColor);

  // Semantic Surfaces (Liquid-Glass)
  if (theme.surfaceBase) {
    root.style.setProperty('--color-surface-base', theme.surfaceBase);
  }
  if (theme.surfaceCard) {
    root.style.setProperty('--color-surface-card', theme.surfaceCard);
  }
}

export interface TenantThemeProviderProps {
  children: React.ReactNode;
  initialTenantId?: string;
}

export const TenantThemeProvider: React.FC<TenantThemeProviderProps> = ({
  children,
  initialTenantId,
}) => {
  const [allTenants, setAllTenants] = useState<TenantManifest[]>(() => {
    const loaded = TenantProvisioner.getAllManifests();
    if (loaded.length === 0) {
      TenantProvisioner.saveManifest(DEFAULT_100HICH_MANIFEST);
      return [DEFAULT_100HICH_MANIFEST];
    }
    return loaded;
  });

  const [activeTenantId, setActiveTenantId] = useState<string>(() => {
    if (initialTenantId) return initialTenantId;
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('cafeos_active_tenant_id');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'string') return parsed;
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_100HICH_MANIFEST.tenantId;
  });

  const activeTenant = useMemo(() => {
    return allTenants.find((t) => t.tenantId === activeTenantId) || allTenants[0] || DEFAULT_100HICH_MANIFEST;
  }, [allTenants, activeTenantId]);

  // Apply theme dynamically to DOM whenever activeTenant changes
  useEffect(() => {
    if (activeTenant && activeTenant.theme) {
      applyThemeToDom(
        activeTenant.theme,
        activeTenant.tenantId,
        activeTenant.brandNameEn,
        activeTenant.brandNameFa
      );
    }
  }, [activeTenant]);

  const switchTenant = useCallback((tenantId: string) => {
    const target = allTenants.find((t) => t.tenantId === tenantId);
    if (target) {
      setActiveTenantId(tenantId);
      TenantProvisioner.setActiveTenant(tenantId);
    } else {
      console.warn(`[TenantThemeProvider] Tenant ID '${tenantId}' not found in registry.`);
    }
  }, [allTenants]);

  const updateTenantTheme = useCallback((tenantId: string, updatedTheme: Partial<TenantThemeConfig>) => {
    setAllTenants((prev) => {
      const next = prev.map((t) => {
        if (t.tenantId === tenantId) {
          const merged: TenantManifest = {
            ...t,
            theme: { ...t.theme, ...updatedTheme },
          };
          TenantProvisioner.saveManifest(merged);
          return merged;
        }
        return t;
      });
      return next;
    });
  }, []);

  const resetToDefaultTheme = useCallback(() => {
    switchTenant(DEFAULT_100HICH_MANIFEST.tenantId);
  }, [switchTenant]);

  const isCustomized = useMemo(() => {
    return activeTenant.tenantId !== DEFAULT_100HICH_MANIFEST.tenantId;
  }, [activeTenant]);

  const contextValue = useMemo(
    () => ({
      activeTenant,
      allTenants,
      isCustomized,
      switchTenant,
      updateTenantTheme,
      resetToDefaultTheme,
    }),
    [activeTenant, allTenants, isCustomized, switchTenant, updateTenantTheme, resetToDefaultTheme]
  );

  return (
    <TenantThemeContext.Provider value={contextValue}>
      {children}
    </TenantThemeContext.Provider>
  );
};

export function useTenantTheme(): TenantThemeContextType {
  const context = useContext(TenantThemeContext);
  if (!context) {
    throw new Error('useTenantTheme must be used within a TenantThemeProvider');
  }
  return context;
}

export default TenantThemeProvider;
