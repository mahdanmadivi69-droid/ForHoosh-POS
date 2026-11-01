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
import { INITIAL_MODENDO_FLOOR_PLAN } from '../data/modendoFloorPlanData';

const STORAGE_KEY = 'modendo_floor_plan_v6.3';

type FloorPlanListener = (schema: ModendoFloorPlanSchema) => void;

class FloorPlanServiceClass {
  private schema: ModendoFloorPlanSchema;
  private listeners: Set<FloorPlanListener> = new Set();

  constructor() {
    this.schema = this.loadFromStorage();
  }

  private loadFromStorage(): ModendoFloorPlanSchema {
    if (typeof window === 'undefined') return INITIAL_MODENDO_FLOOR_PLAN;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.modendo_schema_version === '6.3') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[FloorPlanService] Could not parse stored floor plan, resetting to defaults:', e);
    }
    this.saveToStorage(INITIAL_MODENDO_FLOOR_PLAN);
    return INITIAL_MODENDO_FLOOR_PLAN;
  }

  private saveToStorage(data: ModendoFloorPlanSchema) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[FloorPlanService] Failed to save floor plan:', e);
    }
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
    table.currentOrderId = undefined;
    table.currentBillAmount = 0;
    table.assignedToken = undefined;

    this.notify();
    return true;
  }

  /**
   * Resets entire layout to initial specification seed
   */
  public resetToDefault(): void {
    this.schema = JSON.parse(JSON.stringify(INITIAL_MODENDO_FLOOR_PLAN));
    this.notify();
  }
}

export const floorPlanService = new FloorPlanServiceClass();
