/**
 * src/stores/usePrinterStore.ts
 * 
 * KarWand POS — Printer Routing Zustand Store
 * Backed by IndexedDB (Dexie Multi-Tenant `appSettings`) and Tenant-Scoped LocalStorage.
 * 
 * Enforces:
 *  - Tenant Isolation: Scoped by tenantId (100 HICH vs Modendo).
 *  - Reload Survival: All mutations write atomically to IndexedDB.
 *  - Multi-Tenant Venue Defaults:
 *    - 100 HICH -> `enabled: false` (silent bypass)
 *    - Modendo  -> `enabled: true`  (dual thermal station routing)
 */

import { create } from 'zustand';
import {
  Station,
  StationConfig,
  PrinterRoutingConfig,
  ProductionTicket,
  getDefaultRoutingConfigForTenant,
} from '../types/printerRouting';
import { getCafeDatabase } from '../db/cafeDb';
import { RoutingService } from '../services/printer/routingService';

export interface PrinterStoreState {
  tenantId: string;
  config: PrinterRoutingConfig;
  isLoading: boolean;
  isSaving: boolean;
  lastDispatchedTickets: ProductionTicket[];
  lastError: string | null;

  // Actions
  initialize: (tenantId?: string) => Promise<void>;
  setTenantId: (tenantId: string) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setCategoryRoute: (categoryId: string, station: Station) => Promise<void>;
  setItemOverride: (itemId: string, station: Station) => Promise<void>;
  removeItemOverride: (itemId: string) => Promise<void>;
  updateStationConfig: (station: 'bar' | 'kitchen', partial: Partial<StationConfig>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  loadFromStorage: (tenantId: string) => Promise<PrinterRoutingConfig>;
  saveToStorage: (config: PrinterRoutingConfig, tenantId: string) => Promise<void>;
  dispatchOrder: (order: any) => Promise<ProductionTicket[]>;
}

const SETTINGS_KEY = 'printer_routing_config';

function resolveCurrentTenantId(): string {
  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      const stored = localStorage.getItem('cafeos_active_tenant_id');
      if (stored) {
        const clean = stored.replace(/"/g, '').trim();
        if (clean) return clean;
      }
    } catch {
      // Fallback
    }
  }
  return 'tenant-100hich-01';
}

function getLocalCacheKey(tenantId: string): string {
  return `cafeos_printer_routing_${tenantId}`;
}

export const usePrinterStore = create<PrinterStoreState>((set, get) => {
  const initialTenantId = resolveCurrentTenantId();
  const initialConfig = getDefaultRoutingConfigForTenant(initialTenantId);

  return {
    tenantId: initialTenantId,
    config: initialConfig,
    isLoading: false,
    isSaving: false,
    lastDispatchedTickets: [],
    lastError: null,

    /**
     * Loads saved configuration from IndexedDB with tenant-scoped localStorage fallback.
     */
    loadFromStorage: async (tenantId: string): Promise<PrinterRoutingConfig> => {
      const defaultConfig = getDefaultRoutingConfigForTenant(tenantId);

      // 1. Try loading from Dexie IndexedDB
      try {
        const db = getCafeDatabase(tenantId);
        const record = await db.appSettings.get(SETTINGS_KEY);
        if (record && record.value && typeof record.value.enabled === 'boolean') {
          // Merge with defaults to guarantee all required fields exist
          return {
            ...defaultConfig,
            ...record.value,
            stations: {
              ...defaultConfig.stations,
              ...(record.value.stations || {}),
            },
            categoryRoutes: {
              ...defaultConfig.categoryRoutes,
              ...(record.value.categoryRoutes || {}),
            },
            itemOverrides: {
              ...defaultConfig.itemOverrides,
              ...(record.value.itemOverrides || {}),
            },
          };
        }
      } catch (err) {
        console.warn(`[usePrinterStore] IndexedDB load error for ${tenantId}:`, err);
      }

      // 2. Fallback to tenant-scoped localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          const cached = localStorage.getItem(getLocalCacheKey(tenantId));
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed.enabled === 'boolean') {
              return {
                ...defaultConfig,
                ...parsed,
              };
            }
          }
        } catch {
          // Degrade to defaults
        }
      }

      return defaultConfig;
    },

    /**
     * Persists configuration to both IndexedDB and tenant-scoped localStorage.
     */
    saveToStorage: async (config: PrinterRoutingConfig, tenantId: string): Promise<void> => {
      // 1. Immediate local cache write
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(getLocalCacheKey(tenantId), JSON.stringify(config));
        } catch {
          // Safe degrade
        }
      }

      // 2. Asynchronous IndexedDB write
      try {
        const db = getCafeDatabase(tenantId);
        await db.appSettings.put({
          key: SETTINGS_KEY,
          value: config,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn(`[usePrinterStore] IndexedDB save error for ${tenantId}:`, err);
      }
    },

    /**
     * Initializes store for current active tenant.
     */
    initialize: async (targetTenantId?: string) => {
      const activeTenant = targetTenantId || resolveCurrentTenantId();
      set({ isLoading: true, tenantId: activeTenant, lastError: null });

      try {
        const loaded = await get().loadFromStorage(activeTenant);
        set({ config: loaded, isLoading: false });
      } catch (err: any) {
        set({
          isLoading: false,
          lastError: err?.message || 'Failed to initialize printer store',
        });
      }
    },

    /**
     * Switches active tenant and loads its isolated printer configuration.
     */
    setTenantId: async (newTenantId: string) => {
      if (!newTenantId || newTenantId === get().tenantId) return;
      set({ isLoading: true, tenantId: newTenantId, lastError: null });

      try {
        const loaded = await get().loadFromStorage(newTenantId);
        set({ config: loaded, isLoading: false });
      } catch (err: any) {
        set({
          isLoading: false,
          lastError: err?.message || 'Failed to switch printer tenant',
        });
      }
    },

    /**
     * Master Toggle: Enable / Disable station printing globally for venue.
     */
    setEnabled: async (enabled: boolean) => {
      const { config, tenantId, saveToStorage } = get();
      const updated: PrinterRoutingConfig = {
        ...config,
        enabled,
      };

      set({ config: updated, isSaving: true });
      await saveToStorage(updated, tenantId);
      set({ isSaving: false });
    },

    /**
     * Sets routing station for a specific category.
     */
    setCategoryRoute: async (categoryId: string, station: Station) => {
      if (!categoryId) return;
      const { config, tenantId, saveToStorage } = get();

      const updatedRoutes = { ...config.categoryRoutes };
      if (station === 'none') {
        delete updatedRoutes[categoryId];
      } else {
        updatedRoutes[categoryId] = station;
      }

      const updated: PrinterRoutingConfig = {
        ...config,
        categoryRoutes: updatedRoutes,
      };

      set({ config: updated, isSaving: true });
      await saveToStorage(updated, tenantId);
      set({ isSaving: false });
    },

    /**
     * Sets an item-level override which takes absolute precedence over category routing.
     */
    setItemOverride: async (itemId: string, station: Station) => {
      if (!itemId) return;
      const { config, tenantId, saveToStorage } = get();

      const updatedOverrides = {
        ...config.itemOverrides,
        [itemId]: station,
      };

      const updated: PrinterRoutingConfig = {
        ...config,
        itemOverrides: updatedOverrides,
      };

      set({ config: updated, isSaving: true });
      await saveToStorage(updated, tenantId);
      set({ isSaving: false });
    },

    /**
     * Removes an item override.
     */
    removeItemOverride: async (itemId: string) => {
      const { config, tenantId, saveToStorage } = get();
      const updatedOverrides = { ...config.itemOverrides };
      delete updatedOverrides[itemId];

      const updated: PrinterRoutingConfig = {
        ...config,
        itemOverrides: updatedOverrides,
      };

      set({ config: updated, isSaving: true });
      await saveToStorage(updated, tenantId);
      set({ isSaving: false });
    },

    /**
     * Updates IP, port, paperWidth or details for bar or kitchen station.
     */
    updateStationConfig: async (station: 'bar' | 'kitchen', partial: Partial<StationConfig>) => {
      const { config, tenantId, saveToStorage } = get();
      const currentStation = config.stations[station];

      const updated: PrinterRoutingConfig = {
        ...config,
        stations: {
          ...config.stations,
          [station]: {
            ...currentStation,
            ...partial,
          },
        },
      };

      set({ config: updated, isSaving: true });
      await saveToStorage(updated, tenantId);
      set({ isSaving: false });
    },

    /**
     * Resets configuration back to tenant canonical defaults.
     */
    resetToDefaults: async () => {
      const { tenantId, saveToStorage } = get();
      const canonical = getDefaultRoutingConfigForTenant(tenantId);

      set({ config: canonical, isSaving: true });
      await saveToStorage(canonical, tenantId);
      set({ isSaving: false });
    },

    /**
     * Dispatches order items through station router.
     */
    dispatchOrder: async (order: any): Promise<ProductionTicket[]> => {
      const { config, tenantId } = get();
      const result = await RoutingService.dispatchProductionTickets(order, config, tenantId);

      if (result.tickets.length > 0) {
        set((state) => ({
          lastDispatchedTickets: [...result.tickets, ...state.lastDispatchedTickets.slice(0, 20)],
        }));
      }

      return result.tickets;
    },
  };
});
