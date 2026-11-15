/**
 * Modendo POS — Floor Plan & Spatial Entity Types
 * Compliant with Specification v6.3-Final Settled
 */

export type BillingMode = 'standard_table' | 'token' | 'hourly_timer';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'GAMING_ACTIVE' | 'AWAITING_BILL' | 'PAUSED';

export interface TableGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TableCapacity {
  nominal: number;
  max: number;
}

export interface TableCapabilities {
  game_timer: boolean;
  token_required: boolean;
  mergeable: boolean;
}

export interface TableEntity {
  id: string;
  zone_id: 'lower_lobby' | 'ps_room' | 'vip_booth' | 'lounge' | 'main_hall' | 'bar_counter' | 'terrace';
  display_name: string;
  level: 0 | 1;
  billing_mode: BillingMode;
  capacity: TableCapacity;
  geometry: TableGeometry;
  capabilities: TableCapabilities;
  pricing_tier_id?: string;
  // Live Runtime Status
  status?: TableStatus;
  currentOrderId?: string;
  currentBillAmount?: number;
  sessionStartTime?: string; // ISO string for timer
  pausedMs?: number; // accumulated paused duration (integer ms) — excluded from billing
  pausedAt?: string; // ISO timestamp while session is paused (frozen timer)
  activeGuestsCount?: number;
  assignedToken?: string;
}

export interface FloorLevel {
  level_index: 0 | 1;
  title: string;
}

export interface FloorPlanVenue {
  name: string;
  floor_levels: FloorLevel[];
}

export interface ModendoFloorPlanSchema {
  modendo_schema_version: string;
  generated_at: string;
  venue: FloorPlanVenue;
  tables: TableEntity[];
}

export interface ActiveSessionData {
  tableId: string;
  sessionStartTime: string;
  durationSeconds: number;
  hourlyRateToman: number;
  currentHourlyCostToman: number;
  itemsTotalToman: number;
  grandTotalToman: number;
  notes?: string;
}
