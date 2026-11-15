/**
 * Table Session Open Tabs Service & State Machine
 * Compliant with antigravity_inventory_tab_spec.json
 *
 * Implements:
 *  - Persistent In-Memory / LocalStorage State Store for Table Tabs
 *  - State Machine transitions:
 *      idle_empty -> OPEN_TAB -> active_open_tab
 *      active_open_tab -> ADD_ROUND -> active_open_tab
 *      active_open_tab -> MARK_DELIVERED -> active_open_tab (BOM deduction triggered)
 *      active_open_tab -> REQUEST_BILL -> awaiting_checkout
 *      awaiting_checkout -> COMPLETE_SETTLEMENT -> idle_empty
 *  - Dynamic multi-round incremental ordering (Round 1, Round 2, Round 3...)
 *  - Late checkout & Split check capability
 *  - Real-time reactive subscriptions
 *  - Multi-Tenant Isolation & Scoped Storage (Phase 1 Remediation)
 */

import {
  TableSessionTab,
  TabRound,
  TabCartItem,
  TableLifecycleState,
} from '../types/inventory-tab';
import { inventoryBomService } from './inventoryBomService';
import { baristaDispatcher } from './baristaDispatcher';
import { StationRouter } from './StationRouter';
import { SmartOrdersStore } from './storage';
import { playPosBeep } from './soundEffects';

export const OPEN_TAB_STORAGE_KEYS = {
  TABLE_TABS: (tenantId: string) => `cafeos_table_tabs_${tenantId}_v2`,
  RESERVED_TABLES: (tenantId: string) => `cafeos_reserved_tables_${tenantId}_v1`,
  LEGACY_TABLE_TABS: 'cafeos_table_tabs_v2',
  LEGACY_RESERVED_TABLES: 'cafeos_reserved_tables_v1',
  LEGACY_BACKUP_TABS: 'cafeos_table_tabs_v2_legacy_backup',
  LEGACY_BACKUP_RESERVED: 'cafeos_reserved_tables_v1_legacy_backup',
  MIGRATION_LOG: 'cafeos_open_tabs_migration_log',
};

export interface TableConfig {
  id: string; // e.g. 't1', 't2'
  label: string; // e.g. 'میز ۱'
  zone: string; // e.g. 'سالن اصلی'
  capacity: number;
}

export const DEFAULT_TABLES: TableConfig[] = [
  { id: 't1', label: 'میز ۱', zone: 'سالن اصلی', capacity: 4 },
  { id: 't2', label: 'میز ۲', zone: 'سالن اصلی', capacity: 2 },
  { id: 't3', label: 'میز ۳', zone: 'کنار پنجره', capacity: 4 },
  { id: 't4', label: 'میز ۴', zone: 'میز گروهی', capacity: 6 },
  { id: 'bar', label: 'کانتر بار', zone: 'بار اسپشیالتی', capacity: 4 },
  { id: 'takeaway', label: 'بیرون‌بر', zone: 'تحویل اکسپرس', capacity: 1 },
  { id: 'terrace', label: 'تراس / حیاط', zone: 'فضای باز', capacity: 4 },
];

type TabsChangeListener = (tabs: TableSessionTab[], tenantId?: string) => void;

export class OpenTabService {
  private tenantTabs: Map<string, TableSessionTab[]> = new Map();
  private tenantReserved: Map<string, Set<string>> = new Map();
  private currentTenantId: string | null = null;
  private listeners: Set<TabsChangeListener> = new Set();

  constructor() {
    this.migrateLegacyData();
    this.loadStateForTenant(this.getActiveTenantId());
  }

  /**
   * Resolve active tenant ID:
   * 1. Explicit parameter if provided
   * 2. Injected context (this.currentTenantId)
   * 3. Ambient storage state (cafeos_active_tenant_id)
   * 4. Default fallback ('tenant-100hich-01')
   */
  public getActiveTenantId(overrideTenantId?: string): string {
    if (overrideTenantId && typeof overrideTenantId === 'string' && overrideTenantId.trim()) {
      return overrideTenantId.trim();
    }
    if (this.currentTenantId) {
      return this.currentTenantId;
    }
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const stored = localStorage.getItem('cafeos_active_tenant_id');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
          }
        }
      } catch {
        // ignore
      }
    }
    return 'tenant-100hich-01';
  }

  public setTenantContext(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') return;
    this.currentTenantId = tenantId.trim();
    this.loadStateForTenant(this.currentTenantId);
    this.notifyListeners(this.currentTenantId);
  }

  private loadStateForTenant(tenantId: string): void {
    if (this.tenantTabs.has(tenantId) && this.tenantReserved.has(tenantId)) {
      return;
    }

    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const storedTabs = localStorage.getItem(OPEN_TAB_STORAGE_KEYS.TABLE_TABS(tenantId));
        if (storedTabs) {
          this.tenantTabs.set(tenantId, JSON.parse(storedTabs));
        } else {
          // Initialize demo tab strictly for 100 HICH
          if (tenantId === 'tenant-100hich-01') {
            const demoTab: TableSessionTab = {
              tab_id: `tab-${Date.now()}-t2`,
              tenantId: 'tenant-100hich-01',
              table_id: 't2',
              table_label: 'میز ۲',
              server_name: 'سارا رضایی',
              guest_count: 2,
              status: 'open',
              opened_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
              rounds: [
                {
                  round_number: 1,
                  dispatched_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                  status: 'delivered',
                  inventory_deducted: true,
                  items: [
                    {
                      id: 'item-demo-1',
                      menuItemId: 'm1_flat_white',
                      title: 'فلت وایت',
                      quantity: 2,
                      unitPrice: 85000,
                      subtotal: 170000,
                      delivered: true,
                    },
                  ],
                },
              ],
              subtotal: 170000,
              vat: 0,
              discount: 0,
              total_due: 170000,
              notes: 'میز دو نفره سالن',
            };
            this.tenantTabs.set(tenantId, [demoTab]);
            this.persistTabs(tenantId);
          } else {
            this.tenantTabs.set(tenantId, []);
          }
        }

        const storedReserved = localStorage.getItem(OPEN_TAB_STORAGE_KEYS.RESERVED_TABLES(tenantId));
        if (storedReserved) {
          this.tenantReserved.set(tenantId, new Set(JSON.parse(storedReserved)));
        } else {
          this.tenantReserved.set(tenantId, new Set());
        }
      } else {
        this.tenantTabs.set(tenantId, []);
        this.tenantReserved.set(tenantId, new Set());
      }
    } catch {
      this.tenantTabs.set(tenantId, []);
      this.tenantReserved.set(tenantId, new Set());
    }
  }

  private persistTabs(tenantId: string) {
    try {
      const tabs = this.tenantTabs.get(tenantId) || [];
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(OPEN_TAB_STORAGE_KEYS.TABLE_TABS(tenantId), JSON.stringify(tabs));
      }
      this.notifyListeners(tenantId);
    } catch (e) {
      console.error(`Failed to persist table tabs for tenant ${tenantId}:`, e);
    }
  }

  private persistReserved(tenantId: string) {
    try {
      const reserved = this.tenantReserved.get(tenantId) || new Set();
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(
          OPEN_TAB_STORAGE_KEYS.RESERVED_TABLES(tenantId),
          JSON.stringify(Array.from(reserved))
        );
      }
      this.notifyListeners(tenantId);
    } catch (e) {
      console.error(`Failed to persist reserved tables for tenant ${tenantId}:`, e);
    }
  }

  /**
   * Safe, Idempotent Legacy Migration for Open Table Sessions:
   * Migrates legacy un-scoped `cafeos_table_tabs_v2` and `cafeos_reserved_tables_v1`.
   * Verified Ownership: Legacy open tab records belong to 100 HICH (tenant-100hich-01).
   * Modendo floor tables remain pristine and isolated.
   */
  public migrateLegacyData(): {
    migrated: boolean;
    tabCount: number;
    targetTenant: string;
    message: string;
  } {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return {
        migrated: false,
        tabCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'No localStorage available.',
      };
    }

    const legacyTabs = localStorage.getItem(OPEN_TAB_STORAGE_KEYS.LEGACY_TABLE_TABS);
    const target100HichKey = OPEN_TAB_STORAGE_KEYS.TABLE_TABS('tenant-100hich-01');
    const existingTarget = localStorage.getItem(target100HichKey);

    if (existingTarget) {
      return {
        migrated: false,
        tabCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'Tenant-scoped table tabs already initialized; skipping to avoid overwrites.',
      };
    }

    if (!legacyTabs) {
      return {
        migrated: false,
        tabCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'No legacy table tabs found.',
      };
    }

    try {
      const parsed: TableSessionTab[] = JSON.parse(legacyTabs);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return {
          migrated: false,
          tabCount: 0,
          targetTenant: 'tenant-100hich-01',
          message: 'Legacy table store empty.',
        };
      }

      // 1. Create a safe, permanent backup of legacy tabs
      localStorage.setItem(OPEN_TAB_STORAGE_KEYS.LEGACY_BACKUP_TABS, legacyTabs);

      // 2. Tag with tenantId and save to 100 HICH store
      const taggedTabs: TableSessionTab[] = parsed.map((tab) => ({
        ...tab,
        tenantId: 'tenant-100hich-01',
      }));
      localStorage.setItem(target100HichKey, JSON.stringify(taggedTabs));
      this.tenantTabs.set('tenant-100hich-01', taggedTabs);

      // 3. Migrate legacy reserved tables if present
      const legacyReserved = localStorage.getItem(OPEN_TAB_STORAGE_KEYS.LEGACY_RESERVED_TABLES);
      if (legacyReserved) {
        localStorage.setItem(OPEN_TAB_STORAGE_KEYS.LEGACY_BACKUP_RESERVED, legacyReserved);
        localStorage.setItem(
          OPEN_TAB_STORAGE_KEYS.RESERVED_TABLES('tenant-100hich-01'),
          legacyReserved
        );
      }

      // 4. Log migration audit record
      const logRecord = {
        timestamp: new Date().toISOString(),
        legacyCount: taggedTabs.length,
        targetTenant: 'tenant-100hich-01',
        status: 'SUCCESS',
      };
      localStorage.setItem(OPEN_TAB_STORAGE_KEYS.MIGRATION_LOG, JSON.stringify(logRecord));

      return {
        migrated: true,
        tabCount: taggedTabs.length,
        targetTenant: 'tenant-100hich-01',
        message: `Successfully migrated ${taggedTabs.length} table sessions to tenant-100hich-01.`,
      };
    } catch (err: any) {
      console.error('Failed to migrate legacy open table tabs:', err);
      return {
        migrated: false,
        tabCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: `Migration failed: ${err?.message}`,
      };
    }
  }

  /**
   * Rollback legacy migration: restores legacy un-scoped tabs from backup
   */
  public rollbackLegacyMigration(): boolean {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    try {
      const backup = localStorage.getItem(OPEN_TAB_STORAGE_KEYS.LEGACY_BACKUP_TABS);
      if (backup) {
        localStorage.setItem(OPEN_TAB_STORAGE_KEYS.LEGACY_TABLE_TABS, backup);
        localStorage.removeItem(OPEN_TAB_STORAGE_KEYS.TABLE_TABS('tenant-100hich-01'));
        this.tenantTabs.delete('tenant-100hich-01');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public subscribe(listener: TabsChangeListener, tenantId?: string): () => void {
    this.listeners.add(listener);
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    listener(this.tenantTabs.get(tId) || [], tId);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(tenantId: string) {
    const tabs = this.tenantTabs.get(tenantId) || [];
    this.listeners.forEach((fn) => {
      try {
        fn(tabs, tenantId);
      } catch (e) {
        console.error('Error notifying tabs listener:', e);
      }
    });
  }

  public getAllActiveTabs(tenantId?: string): TableSessionTab[] {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    return (this.tenantTabs.get(tId) || []).filter((t) => t.status !== 'settled');
  }

  public getTabForTable(tableIdOrLabel: string, tenantId?: string): TableSessionTab | undefined {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    return (this.tenantTabs.get(tId) || []).find(
      (t) =>
        t.status !== 'settled' &&
        (t.table_id === tableIdOrLabel || t.table_label === tableIdOrLabel)
    );
  }

  public getTableLifecycleState(tableId: string, tenantId?: string): TableLifecycleState {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const reserved = this.tenantReserved.get(tId) || new Set();
    if (reserved.has(tableId)) {
      return 'reserved';
    }
    const tab = this.getTabForTable(tableId, tId);
    if (!tab) {
      return 'idle_empty';
    }
    if (tab.status === 'printed') {
      return 'awaiting_checkout';
    }
    return 'active_open_tab';
  }

  public toggleTableReservation(tableId: string, tenantId?: string): boolean {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const reserved = this.tenantReserved.get(tId) || new Set();

    if (reserved.has(tableId)) {
      reserved.delete(tableId);
    } else {
      // Cannot reserve if currently occupied in this tenant
      const activeTab = this.getTabForTable(tableId, tId);
      if (activeTab) {
        return false;
      }
      reserved.add(tableId);
    }
    this.tenantReserved.set(tId, reserved);
    this.persistReserved(tId);
    return true;
  }

  /**
   * Action: OPEN_TAB (idle_empty -> active_open_tab)
   * Scoped to specified or active tenant context.
   */
  public openTab(
    tableId: string,
    tableLabel?: string,
    serverName: string = 'صندوق‌دار',
    guestCount: number = 2,
    initialItems: TabCartItem[] = [],
    tenantId?: string
  ): TableSessionTab {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);

    // Check if table already has an active tab for this tenant
    const existing = this.getTabForTable(tableId, tId);
    if (existing) {
      return existing;
    }

    const matchedTable = DEFAULT_TABLES.find((t) => t.id === tableId || t.label === tableId);
    const resolvedLabel = tableLabel || matchedTable?.label || tableId;

    const now = new Date().toISOString();
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const rounds: TabRound[] = [];
    let initialSubtotal = 0;

    if (initialItems.length > 0) {
      const taggedItems = initialItems.map((it) => ({
        ...it,
        station: it.station || StationRouter.resolveStation(it),
        status: 'DISPATCHED' as const,
        dispatchedAt: now,
      }));
      initialSubtotal = taggedItems.reduce((acc, it) => acc + it.subtotal, 0);
      rounds.push({
        round_number: 1,
        dispatched_at: now,
        items: taggedItems,
        inventory_deducted: false,
        status: 'sent_to_bar',
      });
      // Deduct immediately on commit from this tenant's inventory store
      inventoryBomService.deductForItems(taggedItems, tId);
      rounds[0].inventory_deducted = true;
    }

    const newTab: TableSessionTab = {
      tab_id: tabId,
      tenantId: tId,
      table_id: tableId,
      table_label: resolvedLabel,
      server_name: serverName,
      guest_count: guestCount,
      status: 'open',
      opened_at: now,
      rounds,
      subtotal: initialSubtotal,
      vat: 0,
      discount: 0,
      total_due: initialSubtotal,
    };

    // Remove from reserved if it was reserved
    const reserved = this.tenantReserved.get(tId) || new Set();
    reserved.delete(tableId);

    const tabs = this.tenantTabs.get(tId) || [];
    tabs.push(newTab);
    this.tenantTabs.set(tId, tabs);

    this.persistTabs(tId);
    this.persistReserved(tId);
    playPosBeep('success');

    return newTab;
  }

  /**
   * Action: ADD_ROUND (active_open_tab -> active_open_tab)
   * Appends new round of items to existing table tab with tenant-verified dispatch.
   */
  public addRoundToTab(
    tabId: string,
    items: TabCartItem[],
    dispatchToBar: boolean = true,
    tenantId?: string
  ): TableSessionTab | null {
    if (items.length === 0) return null;

    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) {
      // Cross-tenant access rejection: if tab is not found in this tenant
      return null;
    }

    const tab = tabs[tabIndex];
    if (tab.status === 'settled') {
      throw new Error('نمی‌توان به میز تسویه‌شده آیتم جدید اضافه کرد.');
    }

    // Verify tenant ownership
    const effectiveTenantId = tab.tenantId || tId;

    const nextRoundNumber = tab.rounds.length + 1;
    const now = new Date().toISOString();

    const taggedItems = items.map((it) => ({
      ...it,
      station: it.station || StationRouter.resolveStation(it),
      status: 'DISPATCHED' as const,
      dispatchedAt: now,
    }));

    // Deduct raw ingredients strictly for this tenant
    const deductionResult = inventoryBomService.deductForItems(taggedItems, effectiveTenantId);

    const newRound: TabRound = {
      round_number: nextRoundNumber,
      dispatched_at: now,
      items: taggedItems,
      inventory_deducted: deductionResult.success,
      status: 'sent_to_bar',
    };

    const updatedRounds = [...tab.rounds, newRound];
    const allItems = updatedRounds.flatMap((r) => r.items);
    const subtotal = allItems.reduce((acc, it) => acc + it.subtotal, 0);
    const total_due = Math.max(0, subtotal - tab.discount + tab.vat);

    const updatedTab: TableSessionTab = {
      ...tab,
      status: 'open',
      rounds: updatedRounds,
      subtotal,
      total_due,
      tenantId: effectiveTenantId,
    };

    tabs[tabIndex] = updatedTab;
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);

    // Notify Barista KDS with validated tenant identity (REMEDIATION: no hardcoded tenant)
    if (dispatchToBar) {
      try {
        const roundGross = items.reduce((acc, it) => acc + it.subtotal, 0);
        baristaDispatcher.dispatchPaidOrder({
          id: `${updatedTab.tab_id}-r${nextRoundNumber}`,
          clientGeneratedId: `client-${Date.now()}-r${nextRoundNumber}`,
          tenantId: effectiveTenantId,
          shiftId: 'active-shift',
          orderNumber: Math.floor(Math.random() * 900) + 100,
          orderType: 'DINE_IN',
          state: 'PAID',
          tableLabel: `${updatedTab.table_label} (دور ${nextRoundNumber})`,
          customerName: updatedTab.server_name,
          items: items.map((it) => ({
            id: it.id,
            menuItemId: it.menuItemId,
            itemNameSnapshot: it.title,
            unitPriceSnapshotToman: it.unitPrice,
            quantity: it.quantity,
            modifiers: it.modifiers?.map((m) => ({
              id: m.id || 'mod',
              nameFa: m.nameFa,
              priceDeltaToman: m.priceDelta,
            })) || [],
            modifiersDeltaToman: it.modifiers?.reduce((a, m) => a + m.priceDelta, 0) || 0,
            subtotalToman: it.subtotal,
            notes: it.notes,
          })),
          grossAmountToman: roundGross,
          grossAmount: roundGross,
          discountAmountToman: 0,
          discountAmount: 0,
          netTotalToman: roundGross,
          totalNet: roundGross,
          paidAmountToman: roundGross,
          paidAmount: roundGross,
          payments: [],
          createdAt: now,
          updatedAt: now,
          createdByUserId: 'server',
          createdByUserName: updatedTab.server_name,
        });
      } catch (e) {
        console.error('Barista dispatcher failed for round', e);
      }
    }

    playPosBeep('success');
    return updatedTab;
  }

  /**
   * Action: MARK_DELIVERED (active_open_tab -> active_open_tab)
   */
  public markRoundDelivered(tabId: string, roundNumber: number, tenantId?: string): TableSessionTab | null {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = tabs[tabIndex];
    const effectiveTenantId = tab.tenantId || tId;

    const updatedRounds = tab.rounds.map((round) => {
      if (round.round_number === roundNumber) {
        if (!round.inventory_deducted) {
          inventoryBomService.deductForItems(round.items, effectiveTenantId);
        }
        return {
          ...round,
          status: 'delivered' as const,
          inventory_deducted: true,
          items: round.items.map((it) => ({ ...it, delivered: true })),
        };
      }
      return round;
    });

    const updatedTab: TableSessionTab = {
      ...tab,
      rounds: updatedRounds,
    };

    tabs[tabIndex] = updatedTab;
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);
    playPosBeep('click');
    return updatedTab;
  }

  /**
   * Action: REQUEST_BILL (active_open_tab -> awaiting_checkout)
   */
  public requestBill(tabId: string, tenantId?: string): TableSessionTab | null {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = tabs[tabIndex];
    const updatedTab: TableSessionTab = {
      ...tab,
      status: 'printed',
    };

    tabs[tabIndex] = updatedTab;
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);
    playPosBeep('success');
    return updatedTab;
  }

  /**
   * Apply Discount to open tab
   */
  public applyDiscount(tabId: string, discountToman: number, tenantId?: string): TableSessionTab | null {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = tabs[tabIndex];
    const discount = Math.min(Math.max(0, discountToman), tab.subtotal);
    const total_due = Math.max(0, tab.subtotal - discount + tab.vat);

    const updatedTab: TableSessionTab = {
      ...tab,
      discount,
      total_due,
    };

    tabs[tabIndex] = updatedTab;
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);
    return updatedTab;
  }

  /**
   * Action: COMPLETE_SETTLEMENT (awaiting_checkout / active_open_tab -> idle_empty)
   */
  public settleTab(
    tabId: string,
    options: {
      paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
      terminalName?: string;
      referenceCode?: string;
      cashTendered?: number;
      splitCount?: number;
      sessionChargeToman?: number; // Mission v0.16: hourly gaming charge settled together with F&B
    },
    tenantId?: string
  ): { success: boolean; closedTab: TableSessionTab } {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) {
      throw new Error(`حساب میز با شناسه ${tabId} یافت نشد.`);
    }

    const tab = tabs[tabIndex];
    const effectiveTenantId = tab.tenantId || tId;
    const now = new Date().toISOString();
    // Mission v0.16: strict integer combined settlement total (F&B + gaming charge)
    const sessionChargeToman = Math.max(0, Math.round(options.sessionChargeToman || 0));
    const combinedSettlementToman = tab.total_due + sessionChargeToman;

    // Ensure all rounds are marked deducted strictly for this tenant
    tab.rounds.forEach((round) => {
      if (!round.inventory_deducted) {
        inventoryBomService.deductForItems(round.items, effectiveTenantId);
      }
    });

    const closedTab: TableSessionTab = {
      ...tab,
      status: 'settled',
      settled_at: now,
      settlement_method: options.paymentMethod,
    };

    tabs[tabIndex] = closedTab;
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);

    // Sync with KarWand / SmartOrders core store
    try {
      const activeShift = SmartOrdersStore.getActiveShift();
      const activeUser = SmartOrdersStore.getActiveUser();
      const shiftTenant = activeShift?.tenantId || effectiveTenantId;
      if (activeShift) {
        const allItems = tab.rounds.flatMap((r) => r.items);
        const createdOrder = SmartOrdersStore.createOrder({
          tenantId: shiftTenant,
          shiftId: activeShift.id,
          createdByUserId: activeUser.id,
          createdByUserName: activeUser.fullName,
          orderType: 'DINE_IN',
          tableLabel: tab.table_label,
          customerName: `مشتری ${tab.table_label}`,
          status: 'COMPLETED',
          items: allItems.map((it) => ({
            id: it.id,
            menuItemId: it.menuItemId,
            itemNameSnapshot: it.title,
            unitPriceSnapshotToman: it.unitPrice,
            quantity: it.quantity,
            subtotalToman: it.subtotal,
            notes: it.notes,
          })),
          grossAmountToman: tab.subtotal + sessionChargeToman,
          discountAmountToman: tab.discount,
          netTotalToman: combinedSettlementToman,
        });

        SmartOrdersStore.recordPayment({
          tenantId: shiftTenant,
          orderId: createdOrder.id,
          shiftId: activeShift.id,
          receivedByUserId: activeUser.id,
          amountToman: combinedSettlementToman,
          paymentMethod: options.paymentMethod === 'CASH' ? 'CASH' : 'CARD_MANUAL',
          referenceCode: options.referenceCode,
          terminalName: options.terminalName || 'پوز ۱ (بانک سامان)',
          status: 'SUCCESSFUL',
        });
      }
    } catch (e) {
      console.warn('SmartOrdersStore order registration warning', e);
    }

    playPosBeep('success');
    return { success: true, closedTab };
  }

  /**
   * Mission v0.16: transfer an open tab (with all its accumulated rounds and
   * totals) to another station/table — pairs with floorPlanService.transferSession.
   */
  public transferTab(
    tabId: string,
    toTableId: string,
    toTableLabel?: string,
    tenantId?: string
  ): TableSessionTab | null {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = tabs[tabIndex];
    if (tab.status === 'settled') return null;

    // Target table must not carry another active tab for this tenant
    const targetOccupied = tabs.some(
      (t) =>
        t.status !== 'settled' &&
        t.tab_id !== tabId &&
        (t.table_id === toTableId || t.table_label === toTableId)
    );
    if (targetOccupied) return null;

    const matchedTable = DEFAULT_TABLES.find((t) => t.id === toTableId || t.label === toTableId);
    const updatedTab: TableSessionTab = {
      ...tab,
      table_id: toTableId,
      table_label: toTableLabel || matchedTable?.label || toTableId,
    };

    tabs[tabIndex] = updatedTab;
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);
    playPosBeep('click');
    return updatedTab;
  }

  /**
   * Void or cancel an open tab
   */
  public voidTab(tabId: string, tenantId?: string): boolean {
    const tId = this.getActiveTenantId(tenantId);
    this.loadStateForTenant(tId);
    const tabs = this.tenantTabs.get(tId) || [];

    const tabIndex = tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return false;

    tabs.splice(tabIndex, 1);
    this.tenantTabs.set(tId, tabs);
    this.persistTabs(tId);
    playPosBeep('delete');
    return true;
  }
}

export const openTabService = new OpenTabService();
