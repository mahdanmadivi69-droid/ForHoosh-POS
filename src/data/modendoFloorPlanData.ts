/**
 * Modendo POS — Default Floor Plan Seed Data (v6.4-Architectural Exact)
 * Architecture: Split-Level (Level 0: Lounge & PS5, Level 1: Main Hall & Terrace)
 *
 * Exact Layout Plan:
 * - Terrace (تراس فضای باز): Exactly 5 clickable tables (2 x 6-seaters: تراس ۱, تراس ۲; 3 x 2-seaters: تراس ۳, تراس ۴, تراس ۵)
 * - Main Hall (سالن اصلی - تراز بالا): Top row 4 x 6-seaters (M-01, M-02, M-03, M-04), 1 x Central 6-seater (M-05) next to counter & kitchen fixtures
 * - Lounge & PS5 (تراز ۰): U-Shape sofa area with 4 lounge tables (L-01, L-02, L-03, L-04) + 4 PS5 Gaming Booths (PS5-1, PS5-2, PS5-3, PS5-4) side-by-side
 */

import { ModendoFloorPlanSchema } from '../types/floor-plan';

/**
 * Single source of truth for Modendo hourly gaming rates (strict integer Toman).
 * Tier keys match TableEntity.pricing_tier_id across floor plan, Dexie seeds and menu.
 */
export const MODENDO_PRICING_TIERS: Record<string, number> = {
  tier_ps5_standard: 90000, // PS5-1..4 pods (per hour)
  tier_vip_suite: 150000, // VIP gaming/streaming booths (per hour)
  tier_boardgame_table: 45000, // Boardgame tables with game_timer (per hour)
};

export const INITIAL_MODENDO_FLOOR_PLAN: ModendoFloorPlanSchema = {
  modendo_schema_version: '6.4',
  generated_at: '2026-11-14T12:00:00Z',
  venue: {
    name: 'Modendo Boardgame & Gaming Cafe',
    floor_levels: [
      { level_index: 0, title: 'تراز ۰: سالن لانژ و اتاق PS5' },
      { level_index: 1, title: 'تراز ۱: سالن اصلی، بار و تراس' },
    ],
  },
  tables: [
    // =========================================================================
    // تراز ۰: ستون چپ — لانژ و اتاق PS5 (Level 0: Lounge & PS5 Gaming Pods)
    // =========================================================================

    // --- سالن لانژ: ۴ میز درون مبل U-Shape (L-01 .. L-04) ---
    {
      id: 'L-01',
      zone_id: 'lounge',
      display_name: 'L-01 (لانژ)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 6 },
      geometry: { x: 105, y: 185, width: 85, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'L-02',
      zone_id: 'lounge',
      display_name: 'L-02 (لانژ)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 6 },
      geometry: { x: 250, y: 185, width: 85, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'L-03',
      zone_id: 'lounge',
      display_name: 'L-03 (لانژ)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 6 },
      geometry: { x: 105, y: 285, width: 85, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'L-04',
      zone_id: 'lounge',
      display_name: 'L-04 (لانژ)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 6 },
      geometry: { x: 250, y: 285, width: 85, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },

    // --- اتاق PS5: ۴ ایستگاه کنسول کنار هم (PS5-1 .. PS5-4) ---
    {
      id: 'ps5_1',
      zone_id: 'ps_room',
      display_name: 'PS5-1',
      level: 0,
      billing_mode: 'hourly_timer',
      capacity: { nominal: 2, max: 4 },
      geometry: { x: 55, y: 505, width: 72, height: 80, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: false },
      pricing_tier_id: 'tier_ps5_standard',
      status: 'AVAILABLE',
    },
    {
      id: 'ps5_2',
      zone_id: 'ps_room',
      display_name: 'PS5-2',
      level: 0,
      billing_mode: 'hourly_timer',
      capacity: { nominal: 2, max: 4 },
      geometry: { x: 137, y: 505, width: 72, height: 80, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: false },
      pricing_tier_id: 'tier_ps5_standard',
      status: 'AVAILABLE',
    },
    {
      id: 'ps5_3',
      zone_id: 'ps_room',
      display_name: 'PS5-3',
      level: 0,
      billing_mode: 'hourly_timer',
      capacity: { nominal: 2, max: 4 },
      geometry: { x: 219, y: 505, width: 72, height: 80, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: false },
      pricing_tier_id: 'tier_ps5_standard',
      status: 'AVAILABLE',
    },
    {
      id: 'ps5_4',
      zone_id: 'ps_room',
      display_name: 'PS5-4',
      level: 0,
      billing_mode: 'hourly_timer',
      capacity: { nominal: 2, max: 4 },
      geometry: { x: 301, y: 505, width: 72, height: 80, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: false },
      pricing_tier_id: 'tier_ps5_standard',
      status: 'AVAILABLE',
    },

    // =========================================================================
    // تراز ۱: ستون وسط — سالن اصلی بردگیم (Level 1: Main Hall)
    // =========================================================================

    // --- ردیف بالا: ۴ میز ۶ نفره مرتب در کنار هم (M-01 .. M-04) ---
    {
      id: 'M-01',
      zone_id: 'main_hall',
      display_name: 'M-01 (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 475, y: 105, width: 60, height: 95, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'M-02',
      zone_id: 'main_hall',
      display_name: 'M-02 (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 545, y: 105, width: 60, height: 95, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'M-03',
      zone_id: 'main_hall',
      display_name: 'M-03 (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 615, y: 105, width: 60, height: 95, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'M-04',
      zone_id: 'main_hall',
      display_name: 'M-04 (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 685, y: 105, width: 60, height: 95, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },

    // --- بخش میانی سالن: ۱ میز ۶ نفره مرکزی (M-05) در کنار کانتر بار و آشپزخانه ---
    {
      id: 'M-05',
      zone_id: 'main_hall',
      display_name: 'M-05 (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 655, y: 240, width: 90, height: 180, rotation: 0 },
      capabilities: { game_timer: true, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },

    // =========================================================================
    // تراز ۱: ستون راست — تراس فضای باز (Level 1: Outdoor Terrace)
    // دقیقا ۵ میز بدون هیچگونه تداخل با فواصل عمودی استاندارد
    // =========================================================================

    // --- ۲ میز ۶ نفره ---
    {
      id: 'T-01',
      zone_id: 'terrace',
      display_name: 'تراس ۱ (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 805, y: 110, width: 145, height: 75, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'T-02',
      zone_id: 'terrace',
      display_name: 'تراس ۲ (۶ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 805, y: 205, width: 145, height: 75, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },

    // --- ۳ میز ۲ نفره (اکیداً ۲ نفره) ---
    {
      id: 'T-03',
      zone_id: 'terrace',
      display_name: 'تراس ۳ (۲ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 2, max: 2 },
      geometry: { x: 820, y: 305, width: 115, height: 65, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'T-04',
      zone_id: 'terrace',
      display_name: 'تراس ۴ (۲ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 2, max: 2 },
      geometry: { x: 820, y: 395, width: 115, height: 65, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'T-05',
      zone_id: 'terrace',
      display_name: 'تراس ۵ (۲ نفره)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 2, max: 2 },
      geometry: { x: 820, y: 485, width: 115, height: 65, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
  ],
};
