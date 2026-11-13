/**
 * Modendo POS — Floor Plan Service (v6.3-Final Settled)
 * Manages spatial layouts, live table state machine, game/PS5 timers, and localStorage persistence.
 */

import {
  ModendoFloorPlanSchema,
  TableEntity,
  TableStatus,
  TableGeometry,
} from '../types/floor-plan';
import { INITIAL_MODENDO_FLOOR_PLAN, MODENDO_PRICING_TIERS } from '../data/modendoFloorPlanData';
import { INITIAL_100HICH_FLOOR_PLAN } from '../data/100hichFloorPlanData';
import { SmartOrdersStore } from './storage';

type FloorPlanListener = (schema: ModendoFloorPlanSchema) => void;

class FloorPlanServiceClass {
  private schema: ModendoFloorPlanSchema;
  private listeners: Set<FloorPlanListener> = new Set();

  constructor() {
    this.schema = this.loadFromStorage();
  }

  private getStorageKey(): string {
    const tenantId = SmartOrdersStore.getActiveTenantId();
    return tenantId === 'tenant-100hich-01'
      ? '100hich_floor_plan_v1.0'
      : 'modendo_floor_plan_v6.3';
  }

  private getDefaultPlan(): ModendoFloorPlanSchema {
    const tenantId = SmartOrdersStore.getActiveTenantId();
    return tenantId === 'tenant-100hich-01'
      ? INITIAL_100HICH_FLOOR_PLAN
      : INITIAL_MODENDO_FLOOR_PLAN;
  }

  private loadFromStorage(): ModendoFloorPlanSchema {
    const defaultPlan = this.getDefaultPlan();
    if (typeof window === 'undefined') return defaultPlan;
    try {
      const storageKey = this.getStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.modendo_schema_version === '6.3') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[FloorPlanService] Could not parse stored floor plan, resetting to defaults:', e);
    }
    this.saveToStorage(defaultPlan);
    return defaultPlan;
  }

  private saveToStorage(data: ModendoFloorPlanSchema) {
    if (typeof window === 'undefined') return;
    try {
      const storageKey = this.getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('[FloorPlanService] Failed to save floor plan:', e);
    }
  }

  public reloadForTenant(): void {
    this.schema = this.loadFromStorage();
    this.notify();
  }

  private notify() {
    this.saveToStorage(this.schema);
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.schema });
      } catch (err) {
        console.error('[FloorPlanService] Error in listener:', err);
      }
    });
  }

  public subscribe(listener: FloorPlanListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.schema });
    return () => this.listeners.delete(listener);
  }

  public getSchema(): ModendoFloorPlanSchema {
    return { ...this.schema };
  }

  public getTables(): TableEntity[] {
    return [...this.schema.tables];
  }

  public getTablesByLevel(level: 0 | 1 | 'all'): TableEntity[] {
    if (level === 'all') return this.getTables();
    return this.schema.tables.filter((t) => t.level === level);
  }

  public getTableById(id: string): TableEntity | undefined {
    return this.schema.tables.find((t) => t.id === id);
  }

  /**
   * Snaps a coordinate value to 10px magnetic grid
   */
  public snap(value: number): number {
    return Math.round(value / 10) * 10;
  }

  /**
   * Updates geometry for an existing table
   */
  public updateTableGeometry(
    id: string,
    geometry: Partial<TableGeometry>,
    snapToGrid: boolean = true
  ): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table) return false;

    table.geometry = {
      x: snapToGrid && geometry.x !== undefined ? this.snap(geometry.x) : geometry.x ?? table.geometry.x,
      y: snapToGrid && geometry.y !== undefined ? this.snap(geometry.y) : geometry.y ?? table.geometry.y,
      width: snapToGrid && geometry.width !== undefined ? this.snap(geometry.width) : geometry.width ?? table.geometry.width,
      height: snapToGrid && geometry.height !== undefined ? this.snap(geometry.height) : geometry.height ?? table.geometry.height,
      rotation: geometry.rotation !== undefined ? geometry.rotation % 360 : table.geometry.rotation,
    };

    this.notify();
    return true;
  }

  /**
   * Shortcuts requirement:
   * Ctrl + D: Clone selected entity with 20px offset
   */
  public cloneTable(id: string): TableEntity | null {
    const original = this.schema.tables.find((t) => t.id === id);
    if (!original) return null;

    const newId = `${original.id}_copy_${Date.now().toString().slice(-4)}`;
    const cloned: TableEntity = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      display_name: `${original.display_name} (کپی)`,
      geometry: {
        ...original.geometry,
        x: this.snap(original.geometry.x + 20),
        y: this.snap(original.geometry.y + 20),
      },
      status: 'AVAILABLE',
      currentOrderId: undefined,
      sessionStartTime: undefined,
      currentBillAmount: undefined,
      assignedToken: undefined,
    };

    this.schema.tables.push(cloned);
    this.notify();
    return cloned;
  }

  /**
   * Shortcuts requirement:
   * R: Rotate 90 degrees around center
   */
  public rotateTable(id: string): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table) return false;

    // Swap width & height or increment rotation
    table.geometry.rotation = (table.geometry.rotation + 90) % 360;
    const tempW = table.geometry.width;
    table.geometry.width = table.geometry.height;
    table.geometry.height = tempW;

    this.notify();
    return true;
  }

  /**
   * Shortcuts requirement:
   * Delete: Remove entity from layout
   */
  public deleteTable(id: string): boolean {
    const index = this.schema.tables.findIndex((t) => t.id === id);
    if (index === -1) return false;

    this.schema.tables.splice(index, 1);
    this.notify();
    return true;
  }

  /**
   * Updates runtime operational state (State Machine)
   */
  public setTableState(
    id: string,
    updates: {
      status?: TableStatus;
      currentOrderId?: string;
      currentBillAmount?: number;
      sessionStartTime?: string;
      activeGuestsCount?: number;
      assignedToken?: string;
    }
  ): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table) return false;

    Object.assign(table, updates);
    this.notify();
    return true;
  }

  /**
   * Starts a gaming or boardgame session
   */
  public startSession(id: string, tokenOrGuestCount?: string | number): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table) return false;

    const newStatus: TableStatus =
      table.billing_mode === 'hourly_timer' ? 'GAMING_ACTIVE' : 'OCCUPIED';

    table.status = newStatus;
    table.sessionStartTime = new Date().toISOString();
    table.pausedMs = undefined;
    table.pausedAt = undefined;
    if (typeof tokenOrGuestCount === 'string') {
      table.assignedToken = tokenOrGuestCount;
    } else if (typeof tokenOrGuestCount === 'number') {
      table.activeGuestsCount = tokenOrGuestCount;
    }

    this.notify();
    return true;
  }

  /**
   * Settles / Clears session for a table
   */
  public clearSession(id: string): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table) return false;

    table.status = 'AVAILABLE';
    table.sessionStartTime = undefined;
    table.pausedMs = undefined;
    table.pausedAt = undefined;
    table.currentOrderId = undefined;
    table.currentBillAmount = 0;
    table.assignedToken = undefined;

    this.notify();
    return true;
  }

  /**
   * Resets entire layout to the tenant's initial specification seed
   * (bugfix: previously always forced the Modendo plan even for 100 HICH).
   */
  public resetToDefault(): void {
    this.schema = JSON.parse(JSON.stringify(this.getDefaultPlan()));
    this.notify();
  }

  /**
   * Mission v0.16: strict integer hourly rate lookup from pricing tier registry.
   * Falls back to boardgame rate for untagged timer tables, 0 for non-hourly tables.
   */
  public getHourlyRateForTable(table: TableEntity | undefined | null): number {
    if (!table || table.billing_mode !== 'hourly_timer') {
      if (!table?.capabilities.game_timer) return 0;
      return MODENDO_PRICING_TIERS['tier_boardgame_table'] ?? 45000;
    }
    if (table.pricing_tier_id && MODENDO_PRICING_TIERS[table.pricing_tier_id] !== undefined) {
      return MODENDO_PRICING_TIERS[table.pricing_tier_id];
    }
    return MODENDO_PRICING_TIERS['tier_ps5_standard'] ?? 90000;
  }

  /**
   * Mission v0.16: pause a live session. Wall-clock elapsed billing time is
   * frozen by accumulating pausedMs and stamping pausedAt; resume clears pausedAt.
   */
  public pauseSession(id: string): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table || !table.sessionStartTime || table.pausedAt) return false;

    table.pausedAt = new Date().toISOString();
    if (table.status === 'GAMING_ACTIVE' || table.status === 'OCCUPIED') {
      table.status = 'PAUSED';
    }
    this.notify();
    return true;
  }

  /**
   * Mission v0.16: resume a paused session (frozen timer continues from the
   * exact second it stopped — no billable time is lost or gained).
   */
  public resumeSession(id: string): boolean {
    const table = this.schema.tables.find((t) => t.id === id);
    if (!table || !table.sessionStartTime || !table.pausedAt) return false;

    const pausedUntilMs = new Date(table.pausedAt).getTime();
    const resumeMs = Date.now();
    table.pausedMs = (table.pausedMs || 0) + Math.max(0, resumeMs - pausedUntilMs);
    table.pausedAt = undefined;
    if (table.status === 'PAUSED') {
      table.status = table.billing_mode === 'hourly_timer' ? 'GAMING_ACTIVE' : 'OCCUPIED';
    }
    this.notify();
    return true;
  }

  /**
   * Mission v0.16: transfer an active session (and its accumulated runtime
   * state) to another AVAILABLE table/station without resetting the timer.
   */
  public transferSession(fromTableId: string, toTableId: string): boolean {
    const from = this.schema.tables.find((t) => t.id === fromTableId);
    const to = this.schema.tables.find((t) => t.id === toTableId);
    if (!from || !to || from.id === to.id) return false;
    if (!from.sessionStartTime) return false; // nothing to transfer
    if (to.sessionStartTime || (to.status && to.status !== 'AVAILABLE')) return false;

    to.status = from.status === 'PAUSED'
      ? 'PAUSED'
      : to.billing_mode === 'hourly_timer'
        ? 'GAMING_ACTIVE'
        : 'OCCUPIED';
    to.sessionStartTime = from.sessionStartTime;
    to.pausedMs = from.pausedMs;
    to.pausedAt = from.pausedAt;
    to.currentOrderId = from.currentOrderId;
    to.currentBillAmount = from.currentBillAmount;
    to.activeGuestsCount = from.activeGuestsCount;
    to.assignedToken = from.assignedToken;

    from.status = 'AVAILABLE';
    from.sessionStartTime = undefined;
    from.pausedMs = undefined;
    from.pausedAt = undefined;
    from.currentOrderId = undefined;
    from.currentBillAmount = 0;
    from.activeGuestsCount = undefined;
    from.assignedToken = undefined;

    this.notify();
    return true;
  }
}

export const floorPlanService = new FloorPlanServiceClass();
