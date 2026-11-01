/**
 * 100 Hich Specialty Coffee Lab — Floor Plan Seed Data (v1.0.0)
 * Architecture: Specialty Coffee Bar, Tasting Counter & Seating Layout
 * Tenant: tenant-100hich-01
 */

import { ModendoFloorPlanSchema } from '../types/floor-plan';

export const INITIAL_100HICH_FLOOR_PLAN: ModendoFloorPlanSchema = {
  modendo_schema_version: '6.3',
  generated_at: '2026-11-01T12:00:00Z',
  venue: {
    name: '100 Hich Specialty Coffee Lab (Ekbatan)',
    floor_levels: [
      { level_index: 0, title: 'سالن بار و سفارش حضوری (Main Bar & Hall)' },
      { level_index: 1, title: 'تراس و فضای باز (Outdoor Seating)' },
    ],
  },
  tables: [
    // --- تراز ۰: کانتر بار، میزهای سالن و باجه بیرون‌بر ---
    {
      id: 'bar_counter_100',
      zone_id: 'bar_counter',
      display_name: 'کانتر بار باریستا (Brew Bar)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 5 },
      geometry: { x: 50, y: 120, width: 220, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: false },
      status: 'AVAILABLE',
    },
    {
      id: 'takeaway_pickup',
      zone_id: 'lower_lobby',
      display_name: 'باجه تحویل بیرون‌بر (Takeaway)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 1, max: 1 },
      geometry: { x: 290, y: 120, width: 90, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: false },
      status: 'AVAILABLE',
    },
    {
      id: 'tbl_100_01',
      zone_id: 'main_hall',
      display_name: 'میز ۱ (اسپرسو بار)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 2, max: 3 },
      geometry: { x: 60, y: 240, width: 60, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'tbl_100_02',
      zone_id: 'main_hall',
      display_name: 'میز ۲ (میانی سالن)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 5 },
      geometry: { x: 150, y: 240, width: 80, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'tbl_100_03',
      zone_id: 'main_hall',
      display_name: 'میز ۳ (پنجره)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 5 },
      geometry: { x: 260, y: 240, width: 80, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'tbl_100_04',
      zone_id: 'main_hall',
      display_name: 'میز ۴ (میز مطالعه / لپ‌تاپ)',
      level: 0,
      billing_mode: 'standard_table',
      capacity: { nominal: 6, max: 8 },
      geometry: { x: 100, y: 350, width: 180, height: 60, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },

    // --- تراز ۱: تراس روباز ---
    {
      id: 'terrace_100_01',
      zone_id: 'terrace',
      display_name: 'تراس ۱ (فضای باز)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 4 },
      geometry: { x: 80, y: 150, width: 70, height: 70, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
    {
      id: 'terrace_100_02',
      zone_id: 'terrace',
      display_name: 'تراس ۲ (فضای باز)',
      level: 1,
      billing_mode: 'standard_table',
      capacity: { nominal: 4, max: 4 },
      geometry: { x: 190, y: 150, width: 70, height: 70, rotation: 0 },
      capabilities: { game_timer: false, token_required: false, mergeable: true },
      status: 'AVAILABLE',
    },
  ],
};
