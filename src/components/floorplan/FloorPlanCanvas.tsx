import React, { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  Gamepad2,
  Users,
  Clock,
  Coffee,
  Sofa,
  Trees,
  Utensils,
  CreditCard,
  Plus,
  Settings2,
  Link2,
  Check,
  Sparkles,
  Unlink,
  X,
} from 'lucide-react';
import { OrderItem } from '../../types/domain';
import { formatToman, calculateOrderTotals } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { openTabService } from '../../services/openTabService';
import { CatalogService } from '../../services/catalog/catalogService';
import { LiquidSurface } from '../liquid/LiquidSurface';

export type FloorZone = 'MAIN_HALL' | 'LOUNGE' | 'TERRACE' | 'PS_ROOM';
export type FloorNodeKind = 'TABLE' | 'PS5';
export type FloorNodeStatus = 'FREE' | 'OCCUPIED' | 'PAYMENT_PENDING';

export interface FloorNode {
  id: string;
  tableId?: string;
  stationId?: string;
  label: string;
  titleFa: string;
  zone: FloorZone;
  kind: FloorNodeKind;
  seats: number;
  hourlyRateToman?: number;
}

export interface Ps5SessionState {
  startedAt: string;
  hourlyRateToman: number;
  controllersCount: number;
  isPaused?: boolean;
  pausedAt?: string;
  accumulatedMs: number;
}

export interface TableSession {
  nodeId: string;
  tableLabel: string;
  kind: FloorNodeKind;
  status: FloorNodeStatus;
  guestCount: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  openedAt: string;
  cartItems: OrderItem[];
  discountToman: number;
  discountPercent?: number;
  ps5Session?: Ps5SessionState;
  /** Stored on primary host table: child node IDs absorbed into this table */
  mergedNodeIds?: string[];
  /** Stored on absorbed child table: points to primary host node ID */
  mergedIntoNodeId?: string;
}

/**
 * Photo-accurate Modendo floor nodes (23 nodes total).
 * - 8 Lounge tables (L-01 to L-08)
 * - 4 PS5 booths (PS5-1 to PS5-4)
 * - 6 Main Hall tables (M-01 to M-04, M-07, BAR-01)
 * - 5 Terrace tables (M-05, M-06, T-01 to T-03)
 */
/**
 * Modendo Display-Only Short Labels Mapping
 * Internal IDs and data structures remain completely untouched.
 * Aesthetic Short Names: M1–M6, T1–T3, B1–B6, PS1–PS4, بوفه
 */
export const MODENDO_DISPLAY_SHORT_NAMES: Record<string, string> = {
  'M-01': 'M1',
  'M-02': 'M2',
  'M-03': 'M3',
  'M-04': 'M4',
  'M-05': 'M5',
  'M-06': 'M6',
  'M-07': 'M7',
  'T-01': 'T1',
  'T-02': 'T2',
  'T-03': 'T3',
  'BAR-1': 'B1',
  'BAR-2': 'B2',
  'BAR-3': 'B3',
  'BAR-4': 'B4',
  'BAR-5': 'B5',
  'BAR-6': 'B6',
  'BAR-01': 'بار',
  'L-01': 'L-01',
  'L-02': 'L-02',
  'L-03': 'L-03',
  'L-04': 'L-04',
  'L-05': 'L-05',
  'L-06': 'L-06',
  'L-07': 'L-07',
  'L-08': 'L-08',
  'PS5-1': 'PS1',
  'PS5-2': 'PS2',
  'PS5-3': 'PS3',
  'PS5-4': 'PS4',
  'BUFFET': 'بوفه',
};

export const getDisplayShortLabel = (node: FloorNode): string => {
  if (MODENDO_DISPLAY_SHORT_NAMES[node.id]) return MODENDO_DISPLAY_SHORT_NAMES[node.id];
  if (MODENDO_DISPLAY_SHORT_NAMES[node.label]) return MODENDO_DISPLAY_SHORT_NAMES[node.label];
  if (/بوفه/i.test(node.label) || /بوفه/i.test(node.titleFa || '')) return 'بوفه';
  if (/^L-?0?(\d)/i.test(node.label) || /^L-?0?(\d)/i.test(node.id)) return `L-0${node.label.match(/\d+/)?.[0] || node.id.match(/\d+/)?.[0] || ''}`;
  if (/^M-?0?(\d)/i.test(node.label)) return `M${node.label.match(/\d+/)?.[0] || ''}`;
  if (/^T-?0?(\d)/i.test(node.label)) return `T${node.label.match(/\d+/)?.[0] || ''}`;
  if (/^BAR-?0?(\d)/i.test(node.label) || /^بار\s*(\d)/i.test(node.label)) return `B${node.label.match(/\d+/)?.[0] || ''}`;
  if (/^PS5?-?0?(\d)/i.test(node.label) || /PS5\s*#?(\d)/i.test(node.label)) return `PS${node.label.match(/\d+/)?.[0] || ''}`;
  return node.label;
};

export const MODENDO_FLOOR_NODES: FloorNode[] = [
  // =========================================================================
  // 1. Main Hall (سالن اصلی - تراز بالا)
  // =========================================================================
  {
    id: 'BUFFET',
    tableId: 'BUFFET',
    label: 'بوفه',
    titleFa: 'بوفه سالن اصلی',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'M-01',
    tableId: 'M-01',
    label: 'M-01',
    titleFa: 'میز M-01 سالن اصلی',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'M-02',
    tableId: 'M-02',
    label: 'M-02',
    titleFa: 'میز M-02 سالن اصلی',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'M-03',
    tableId: 'M-03',
    label: 'M-03',
    titleFa: 'میز M-03 سالن اصلی',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'M-04',
    tableId: 'M-04',
    label: 'M-04',
    titleFa: 'میز M-04 سالن اصلی',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'M-07',
    tableId: 'M-07',
    label: 'میز ۶ نفره',
    titleFa: 'میز ۶ نفره سالن اصلی',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 6,
  },
  {
    id: 'BAR-1',
    tableId: 'BAR-1',
    label: 'بار ۱',
    titleFa: 'کانتر بار - صندلی ۱',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'BAR-2',
    tableId: 'BAR-2',
    label: 'بار ۲',
    titleFa: 'کانتر بار - صندلی ۲',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'BAR-3',
    tableId: 'BAR-3',
    label: 'بار ۳',
    titleFa: 'کانتر بار - صندلی ۳',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'BAR-4',
    tableId: 'BAR-4',
    label: 'بار ۴',
    titleFa: 'کانتر بار - صندلی ۴',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'BAR-5',
    tableId: 'BAR-5',
    label: 'بار ۵',
    titleFa: 'کانتر بار - صندلی ۵',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'BAR-6',
    tableId: 'BAR-6',
    label: 'بار ۶',
    titleFa: 'کانتر بار - صندلی ۶',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 1,
  },
  {
    id: 'BAR-01',
    tableId: 'BAR-01',
    label: 'کانتر بار',
    titleFa: 'صندلی‌های کانتر بار',
    zone: 'MAIN_HALL',
    kind: 'TABLE',
    seats: 6,
  },

  // =========================================================================
  // 2. Terrace (تراس فضای باز)
  // =========================================================================
  {
    id: 'M-05',
    tableId: 'M-05',
    label: 'M-05',
    titleFa: 'میز M-05 تراس (۶ نفر)',
    zone: 'TERRACE',
    kind: 'TABLE',
    seats: 6,
  },
  {
    id: 'M-06',
    tableId: 'M-06',
    label: 'M-06',
    titleFa: 'میز M-06 تراس (۶ نفر)',
    zone: 'TERRACE',
    kind: 'TABLE',
    seats: 6,
  },
  {
    id: 'T-01',
    tableId: 'T-01',
    label: 'T-01 (۲ نفر)',
    titleFa: 'میز دونفره تراس ۱',
    zone: 'TERRACE',
    kind: 'TABLE',
    seats: 2,
  },
  {
    id: 'T-02',
    tableId: 'T-02',
    label: 'T-02 (۲ نفر)',
    titleFa: 'میز دونفره تراس ۲',
    zone: 'TERRACE',
    kind: 'TABLE',
    seats: 2,
  },
  {
    id: 'T-03',
    tableId: 'T-03',
    label: 'T-03 (۳ نفر)',
    titleFa: 'میز سه‌نفره تراس',
    zone: 'TERRACE',
    kind: 'TABLE',
    seats: 3,
  },

  // =========================================================================
  // 3. Lounge (سفارش ژتونی - ۸ میز)
  // =========================================================================
  {
    id: 'L-01',
    tableId: 'L-01',
    label: 'کانتر چپ لانژ',
    titleFa: 'کانتر لانژ ۱ (مبل ال)',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'L-02',
    tableId: 'L-02',
    label: 'L-02',
    titleFa: 'میز لانژ چپ بالا',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'L-03',
    tableId: 'L-03',
    label: 'L-03',
    titleFa: 'میز لانژ راست بالا',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'L-04',
    tableId: 'L-04',
    label: 'L-04',
    titleFa: 'میز لانژ چپ پایین',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'L-05',
    tableId: 'L-05',
    label: 'مبل و میز',
    titleFa: 'مبل و میز لانژ (۲ الی ۳ نفر)',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 3,
  },
  {
    id: 'L-06',
    tableId: 'L-06',
    label: 'L-06',
    titleFa: 'میز لانژ راست پایین',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'L-07',
    tableId: 'L-07',
    label: 'کانتر راست لانژ',
    titleFa: 'کانتر لانژ ۲ (مبل ال)',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 4,
  },
  {
    id: 'L-08',
    tableId: 'L-08',
    label: 'L-08',
    titleFa: 'میز لانژ ورودی (۲ نفر)',
    zone: 'LOUNGE',
    kind: 'TABLE',
    seats: 2,
  },

  // =========================================================================
  // 4. PS5 Gaming Room (اتاق ۴ کابین اختصاصی PS5)
  // =========================================================================
  {
    id: 'PS5-1',
    stationId: 'PS5-1',
    label: 'PS5 #1',
    titleFa: 'کابین ۱ - PS5',
    zone: 'PS_ROOM',
    kind: 'PS5',
    seats: 2,
    hourlyRateToman: 180000,
  },
  {
    id: 'PS5-2',
    stationId: 'PS5-2',
    label: 'PS5 #2',
    titleFa: 'کابین ۲ - PS5',
    zone: 'PS_ROOM',
    kind: 'PS5',
    seats: 2,
    hourlyRateToman: 180000,
  },
  {
    id: 'PS5-3',
    stationId: 'PS5-3',
    label: 'PS5 #3',
    titleFa: 'کابین ۳ - PS5',
    zone: 'PS_ROOM',
    kind: 'PS5',
    seats: 2,
    hourlyRateToman: 180000,
  },
  {
    id: 'PS5-4',
    stationId: 'PS5-4',
    label: 'PS5 #4',
    titleFa: 'کابین ۴ - PS5',
    zone: 'PS_ROOM',
    kind: 'PS5',
    seats: 2,
    hourlyRateToman: 180000,
  },
];

export function getPs5ElapsedMs(ps5?: Ps5SessionState, nowMs = Date.now()): number {
  if (!ps5) return 0;
  if (ps5.isPaused) return ps5.accumulatedMs;
  const startedMs = new Date(ps5.startedAt).getTime();
  if (Number.isNaN(startedMs)) return ps5.accumulatedMs;
  return ps5.accumulatedMs + Math.max(0, nowMs - startedMs);
}

export function formatElapsedTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function calculatePs5ChargeToman(ps5?: Ps5SessionState, nowMs = Date.now()): number {
  if (!ps5) return 0;
  const elapsedMs = getPs5ElapsedMs(ps5, nowMs);
  const minutes = Math.max(1, Math.ceil(elapsedMs / 60000));
  const extraControllers = Math.max(0, (ps5.controllersCount || 2) - 2);
  const effectiveHourly = ps5.hourlyRateToman + extraControllers * 40000;
  const raw = Math.round((minutes * effectiveHourly) / 60);
  return Math.round(raw / 1000) * 1000;
}

export function hasGamingPackage(
  items?: readonly { menuItemId?: string; itemNameSnapshot?: string; id?: string }[]
): boolean {
  if (!items || items.length === 0) return false;
  return items.some((item) => {
    // Exclude the synthesized time-based fee itself so it doesn't falsely flag as a package
    if (item.menuItemId === 'modendo-ps5-charge' || item.id?.startsWith('ps5-hourly-')) {
      return false;
    }
    const mid = (item.menuItemId || '').toLowerCase();
    const rawName = item.itemNameSnapshot || '';
    const nameLower = rawName.toLowerCase();

    // Check category or ID markers
    if (
      mid.includes('ps4') ||
      mid.includes('ps5') ||
      mid.includes('xbox') ||
      mid.includes('console') ||
      mid.includes('gaming') ||
      mid.includes('mod-cat-lounge') ||
      mid.includes('mod-cat-gaming') ||
      mid.startsWith('mod-item-08') ||
      mid.startsWith('mod-item-009') ||
      mid.startsWith('mod-item-010') ||
      mid.startsWith('mod-item-011') ||
      mid.startsWith('mod-item-013')
    ) {
      return true;
    }

    // Check broad keyword patterns across Persian and English
    return (
      nameLower.includes('ps4') ||
      nameLower.includes('ps5') ||
      nameLower.includes('xbox') ||
      nameLower.includes('console') ||
      nameLower.includes('gaming') ||
      rawName.includes('کابین') ||
      rawName.includes('پی اس') ||
      rawName.includes('پلی') ||
      rawName.includes('ایکس') ||
      rawName.includes('دسته') ||
      rawName.includes('گیم') ||
      rawName.includes('بازی')
    );
  });
}

export interface SettlementComputation {
  items: any[];
  grossTotalToman: number;
  discountToman: number;
  payableToman: number;
  ps5Fee: number;
  hasPackage: boolean;
}

/**
 * Single source of truth for settlement calculation and receipt preview lines.
 * Guarantees financial invariant: sum(items.map(it => it.subtotalToman)) - discount === payable
 * Eradicates placeholder / base 3,000 Toman charges before synthesizing dynamic hourly PS5 fees.
 */
export function computeSettlementLineItems(
  cartItems: any[] = [],
  ps5Session?: Ps5SessionState,
  node?: FloorNode,
  discountToman: number = 0,
  nowMs: number = Date.now()
): SettlementComputation {
  const nonPs5Items = (cartItems || []).filter((it) => {
    if (it.menuItemId === 'modendo-ps5-charge' || it.id?.startsWith('ps5-hourly-')) {
      return false;
    }
    const name = (it.itemNameSnapshot || it.name || '').trim();
    // Filter out obsolete/conflicting base 3,000 Toman placeholder "تعرفه بازی"
    if (name.includes('تعرفه بازی') && ((it.unitPriceSnapshotToman || it.price || 0) < 50000)) {
      return false;
    }
    return true;
  });

  const hasPackage = hasGamingPackage(nonPs5Items);
  const effectivePs5Session =
    ps5Session ||
    (node?.kind === 'PS5'
      ? {
          startedAt: new Date(nowMs).toISOString(),
          hourlyRateToman: node.hourlyRateToman || 180000,
          controllersCount: 2,
          accumulatedMs: 0,
          isPaused: false,
        }
      : undefined);

  const ps5Fee = hasPackage || !effectivePs5Session
    ? 0
    : calculatePs5ChargeToman(effectivePs5Session, nowMs);

  const items = [...nonPs5Items];
  if (ps5Fee > 0) {
    items.push({
      id: `ps5-hourly-${node?.id || 'ps5'}-${nowMs}`,
      menuItemId: 'modendo-ps5-charge',
      itemNameSnapshot: `تعرفه کنسول PS5 (${node?.label || 'کنسول'})`,
      unitPriceSnapshotToman: ps5Fee,
      quantity: 1,
      subtotalToman: ps5Fee,
      notes: 'شارژ زمانی بازی کنسول',
    });
  }

  const grossTotalToman = items.reduce((sum, it) => sum + (it.subtotalToman || it.price || 0), 0);
  const discount = Math.max(0, discountToman || 0);
  const payableToman = Math.max(0, grossTotalToman - discount);

  return {
    items,
    grossTotalToman,
    discountToman: discount,
    payableToman,
    ps5Fee,
    hasPackage,
  };
}

/**
 * Normalizes label/id strings for fuzzy matching across Persian & English numerals
 * e.g. 'بار ۱' -> 'بار 1', 'BAR-1' -> 'bar-1'
 */
export function normalizeNodeKey(key: string): string {
  if (!key) return '';
  return key
    .trim()
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
}

/**
 * Unified Session Resolver:
 * Reconciles across floorSessions store (localStorage) and openTabService / CatalogService
 * for ALL floor nodes (tables, bar stools, buffet, terrace, lounge).
 */
export function resolveNodeSession(
  node: FloorNode,
  sessions: Record<string, TableSession>,
  tenantId: string = 'tenant-modendo-01'
): TableSession | undefined {
  if (!node) return undefined;

  // 1. Direct hit on node.id (e.g. 'BAR-1', 'M-01')
  if (sessions && sessions[node.id]) {
    return sessions[node.id];
  }

  // 2. Direct hit on node.label (e.g. 'بار ۱', 'میز ۱')
  if (sessions && node.label && sessions[node.label]) {
    return sessions[node.label];
  }

  // 3. Direct hit on node.tableId (e.g. 'BAR-1')
  if (sessions && node.tableId && sessions[node.tableId]) {
    return sessions[node.tableId];
  }

  // 4. Fuzzy match in sessions across normalized keys (e.g. 'بار 1' vs 'بار ۱', 'B1')
  const normId = normalizeNodeKey(node.id);
  const normLabel = normalizeNodeKey(node.label);
  const shortLabel = getDisplayShortLabel(node);
  const normShort = normalizeNodeKey(shortLabel);

  if (sessions) {
    for (const [key, sess] of Object.entries(sessions)) {
      if (!sess) continue;
      const nk = normalizeNodeKey(key);
      const nTableLabel = normalizeNodeKey(sess.tableLabel || '');
      const nNodeId = normalizeNodeKey(sess.nodeId || '');
      if (
        nk === normId ||
        nk === normLabel ||
        nk === normShort ||
        nTableLabel === normLabel ||
        nTableLabel === normId ||
        nTableLabel === normShort ||
        nNodeId === normId ||
        nNodeId === normLabel ||
        nNodeId === normShort
      ) {
        return sess;
      }
    }
  }

  // 5. Query openTabService for this node
  try {
    const effectiveTenantId = tenantId === 'modendo' ? 'tenant-modendo-01' : tenantId;
    const allActive = openTabService.getAllActiveTabs(effectiveTenantId);
    const tab =
      openTabService.getTabForTable(node.id, effectiveTenantId) ||
      openTabService.getTabForTable(node.label, effectiveTenantId) ||
      (node.tableId ? openTabService.getTabForTable(node.tableId, effectiveTenantId) : undefined) ||
      openTabService.getTabForTable(shortLabel, effectiveTenantId) ||
      allActive.find((t) => {
        const tId = normalizeNodeKey(t.table_id || '');
        const tLabel = normalizeNodeKey(t.table_label || '');
        return (
          tId === normId ||
          tId === normLabel ||
          tId === normShort ||
          tLabel === normLabel ||
          tLabel === normId ||
          tLabel === normShort
        );
      });

    if (tab && tab.status !== 'settled') {
      const flatItems: OrderItem[] = (tab.rounds || []).flatMap((r) =>
        (r.items || []).map((it) => ({
          id: it.id,
          menuItemId: it.menuItemId,
          itemNameSnapshot: it.title,
          unitPriceSnapshotToman: it.unitPrice,
          subtotalToman: it.subtotal,
          quantity: it.quantity,
          notes: it.notes,
          station: it.station || 'BAR',
        }))
      );

      if (flatItems.length === 0 && (tab as any).items?.length) {
        for (const it of (tab as any).items) {
          flatItems.push({
            id: it.id || `item-${Date.now()}-${Math.random()}`,
            menuItemId: it.menuItemId || it.id || 'item',
            itemNameSnapshot: it.itemNameSnapshot || it.title || it.name || 'آیتم',
            unitPriceSnapshotToman: Number(it.unitPriceSnapshotToman ?? it.unitPrice ?? 0),
            subtotalToman: Number(it.subtotalToman ?? it.subtotal ?? 0),
            quantity: Number(it.quantity ?? 1),
            notes: it.notes,
          });
        }
      }

      return {
        nodeId: node.id,
        tableLabel: node.label,
        kind: node.kind,
        status: 'OCCUPIED',
        guestCount: tab.guest_count || node.seats,
        customerName: tab.server_name !== 'صندوق‌دار' ? tab.server_name : undefined,
        openedAt: tab.opened_at,
        cartItems: flatItems,
        discountToman: tab.discount || 0,
      };
    }
  } catch (err) {
    console.warn('[resolveNodeSession] openTabService query failed:', err);
  }

  // 6. Query CatalogService open tabs
  try {
    const effectiveTenantId = tenantId === 'modendo' ? 'tenant-modendo-01' : tenantId;
    const catTabs = CatalogService.getOpenTabs(effectiveTenantId);
    const catMatch = catTabs.find((t: any) => {
      const label = normalizeNodeKey(t.table_or_customer || t.tableOrCustomer || t.tableId || '');
      return label === normId || label === normLabel || label === normShort;
    });
    if (catMatch) {
      const items: OrderItem[] = ((catMatch as any).items || []).map((it: any) => ({
        id: it.id || `item-${Date.now()}-${Math.random()}`,
        menuItemId: it.menuItemId || it.id || 'item',
        itemNameSnapshot: it.itemNameSnapshot || it.title || it.name || 'آیتم',
        unitPriceSnapshotToman: Number(it.unitPriceSnapshotToman ?? it.unitPrice ?? 0),
        subtotalToman: Number(it.subtotalToman ?? it.subtotal ?? 0),
        quantity: Number(it.quantity ?? 1),
        notes: it.notes,
      }));
      return {
        nodeId: node.id,
        tableLabel: node.label,
        kind: node.kind,
        status: 'OCCUPIED',
        guestCount: (catMatch as any).guest_count || node.seats,
        customerName: (catMatch as any).customer_name || '',
        openedAt: (catMatch as any).opened_at || new Date().toISOString(),
        cartItems: items,
        discountToman: (catMatch as any).discount_toman || 0,
      };
    }
  } catch (err) {
    console.warn('[resolveNodeSession] CatalogService query failed:', err);
  }

  return undefined;
}

export function getSessionTotalToman(session?: TableSession, nowMs = Date.now()): number {
  if (!session) return 0;
  return computeSettlementLineItems(
    session.cartItems || [],
    session.ps5Session,
    undefined,
    session.discountToman || 0,
    nowMs
  ).payableToman;
}

export function resolvePrimaryNodeId(
  sessions: Record<string, TableSession>,
  nodeId: string
): string {
  let current = nodeId;
  const visited = new Set<string>([current]);
  while (sessions[current]?.mergedIntoNodeId) {
    const nextId = sessions[current].mergedIntoNodeId!;
    if (!nextId || visited.has(nextId) || !sessions[nextId]) break;
    visited.add(nextId);
    current = nextId;
  }
  return current;
}

export function getMergedGroupNodeIds(
  sessions: Record<string, TableSession>,
  nodeId: string
): string[] {
  const primaryId = resolvePrimaryNodeId(sessions, nodeId);
  const hostSession = sessions[primaryId];
  if (!hostSession?.mergedNodeIds || hostSession.mergedNodeIds.length === 0) {
    return [primaryId];
  }
  const seen = new Set<string>([primaryId]);
  const group: string[] = [primaryId];
  for (const childId of hostSession.mergedNodeIds) {
    if (!seen.has(childId) && sessions[childId]?.mergedIntoNodeId === primaryId) {
      seen.add(childId);
      group.push(childId);
    }
  }
  return group;
}

export function getMergedGroupLabel(
  sessions: Record<string, TableSession>,
  nodeId: string,
  nodes: FloorNode[] = MODENDO_FLOOR_NODES
): string {
  const groupIds = getMergedGroupNodeIds(sessions, nodeId);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return groupIds.map((id) => nodeMap.get(id)?.label || id).join(' + ');
}

export function getMergedGroupSeats(
  sessions: Record<string, TableSession>,
  nodeId: string,
  nodes: FloorNode[] = MODENDO_FLOOR_NODES
): number {
  const groupIds = getMergedGroupNodeIds(sessions, nodeId);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return groupIds.reduce((sum, id) => sum + (nodeMap.get(id)?.seats ?? 0), 0);
}

export interface FloorPlanCanvasProps {
  nodes?: FloorNode[];
  sessions?: Record<string, TableSession>;
  activeZone?: FloorZone | 'ALL';
  levelFilter?: 0 | 1 | 'all';
  isEditMode?: boolean;
  selectedNodeId?: string | null;
  selectedTableId?: string | null;
  nowMs?: number;
  mergeMode?: boolean;
  mergeSelectedIds?: string[];
  moveMode?: boolean;
  moveSourceId?: string | null;
  onToggleMergeSelect?: (node: FloorNode) => void;
  onDragMergeTables?: (sourceNodeId: string, targetNodeId: string) => void;
  onUnmergeGroup?: (primaryNodeId: string, childToDetach?: string) => void;
  onSelectNode?: (node: FloorNode) => void;
  onInspectNode?: (node: FloorNode) => void;
  onSelectTable?: (table: any) => void;
  onOpenSessionModal?: (table: any) => void;
  onConfirmTableOrder?: (table: any) => void;
}

interface MergeLinkLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ActiveDragState {
  sourceId: string;
  sourceLabel: string;
  sourcePrimaryId: string;
  isSourceMerged: boolean;
  isSourceChild: boolean;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  sourceCenterX: number;
  sourceCenterY: number;
  pointerBpX: number;
  pointerBpY: number;
  hoverTargetId: string | null;
  hoverTargetCenterX: number | null;
  hoverTargetCenterY: number | null;
  hoverSeparateZone: boolean;
  isOutsideSameGroup: boolean;
}

const CHAIR_DOT_CLS =
  'rounded-full bg-white/[0.08] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';

const MERGE_ACCENTS = [
  { ring: 'ring-cyan-400/75', border: 'border-cyan-400/65', text: 'text-cyan-300', stroke: '#22d3ee' },
  { ring: 'ring-emerald-400/75', border: 'border-emerald-400/65', text: 'text-emerald-300', stroke: '#34d399' },
  { ring: 'ring-violet-400/75', border: 'border-violet-400/65', text: 'text-violet-300', stroke: '#a78bfa' },
];

export const is100HichNode = (idOrLabel: string): boolean => {
  const s = String(idOrLabel || '').toLowerCase();
  return (
    s.includes('100') ||
    s.includes('۱۰۰') ||
    s.includes('اسپرسو بار') ||
    s.includes('میانی سالن') ||
    s.includes('پنجره') ||
    s.includes('میز مطالعه') ||
    s.includes('فضای باز') ||
    s.includes('تراس ۱ و ۲') ||
    s.includes('تراس فضای باز') ||
    s.includes('باجه تحویل') ||
    s.includes('باجه تحویل بیرون‌بر') ||
    s.includes('takeaway_pickup') ||
    s.includes('bar_counter_100') ||
    s === 'میز ۱' ||
    s === 'میز ۲' ||
    s === 'میز ۳' ||
    s === 'میز ۴' ||
    s === '100h-t1' ||
    s === '100h-t2' ||
    s === '100h-t3' ||
    s === '100h-t4' ||
    s === '100h-t5' ||
    s === '100h-t6' ||
    s === '100h-t7' ||
    s === '100h-bar'
  );
};

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  nodes = MODENDO_FLOOR_NODES,
  sessions = {},
  activeZone = 'ALL',
  levelFilter,
  selectedNodeId,
  selectedTableId,
  nowMs = Date.now(),
  mergeMode = false,
  mergeSelectedIds = [],
  moveMode = false,
  moveSourceId = null,
  onToggleMergeSelect,
  onDragMergeTables,
  onUnmergeGroup,
  onSelectNode,
  onInspectNode,
  onSelectTable,
  onOpenSessionModal,
  onConfirmTableOrder,
}) => {
  // Pure Modendo enforcement: filter out any leaking 100hich nodes
  const sanitizedNodes = (nodes || MODENDO_FLOOR_NODES).filter(
    (n) => !is100HichNode(n.id) && !is100HichNode(n.titleFa) && !is100HichNode(n.label)
  );
  const nodeMap = new Map(sanitizedNodes.map((n) => [n.id, n]));
  const blueprintRef = useRef<HTMLDivElement | null>(null);
  const [mergeLines, setMergeLines] = useState<MergeLinkLine[]>([]);
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const pendingDragRef = useRef<{
    sourceId: string;
    sourceLabel: string;
    sourcePrimaryId: string;
    isSourceMerged: boolean;
    isSourceChild: boolean;
    startX: number;
    startY: number;
    sourceCenterX: number;
    sourceCenterY: number;
    activated: boolean;
  } | null>(null);
  const dragStateRef = useRef<ActiveDragState | null>(null);
  const suppressNextClickRef = useRef(false);

  // Map levelFilter to zone if provided
  const effectiveZone: FloorZone | 'ALL' = (() => {
    if (activeZone && activeZone !== 'ALL') return activeZone;
    if (levelFilter === 0) return 'LOUNGE';
    if (levelFilter === 1) return 'MAIN_HALL';
    return 'ALL';
  })();

  const isZoneDimmed = (zone: FloorZone) => {
    if (effectiveZone === 'ALL') return false;
    if (effectiveZone === 'LOUNGE' && (zone === 'LOUNGE' || zone === 'PS_ROOM')) return false;
    if (effectiveZone === 'MAIN_HALL' && (zone === 'MAIN_HALL' || zone === 'TERRACE')) return false;
    return effectiveZone !== zone;
  };

  const activeSelectedId = selectedNodeId || selectedTableId;

  // Compute group index map for deterministic color accents across multiple merged groups
  const mergedHosts = Object.values(sessions)
    .filter((s) => !s.mergedIntoNodeId && (s.mergedNodeIds?.length || 0) > 0)
    .map((s) => s.nodeId);
  const hostAccentMap = new Map<string, (typeof MERGE_ACCENTS)[number]>();
  mergedHosts.forEach((hostId, idx) => {
    hostAccentMap.set(hostId, MERGE_ACCENTS[idx % MERGE_ACCENTS.length]);
  });

  // Measure node centers inside blueprint for connector bridges
  const recomputeConnectorLines = useCallback(() => {
    const container = blueprintRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const lines: MergeLinkLine[] = [];

    for (const hostId of mergedHosts) {
      const hostEl = container.querySelector<HTMLElement>(`[data-floor-node="${hostId}"]`);
      if (!hostEl) continue;
      const hRect = hostEl.getBoundingClientRect();
      const x1 = hRect.left - cRect.left + hRect.width / 2;
      const y1 = hRect.top - cRect.top + hRect.height / 2;

      const children = sessions[hostId]?.mergedNodeIds || [];
      for (const childId of children) {
        if (sessions[childId]?.mergedIntoNodeId !== hostId) continue;
        const childEl = container.querySelector<HTMLElement>(`[data-floor-node="${childId}"]`);
        if (!childEl) continue;
        const chRect = childEl.getBoundingClientRect();
        const x2 = chRect.left - cRect.left + chRect.width / 2;
        const y2 = chRect.top - cRect.top + chRect.height / 2;
        lines.push({ key: `${hostId}__${childId}`, x1, y1, x2, y2 });
      }
    }

    // Preview links in Merge Mode
    if (mergeMode && mergeSelectedIds.length >= 2) {
      const anchorEl = container.querySelector<HTMLElement>(
        `[data-floor-node="${mergeSelectedIds[0]}"]`
      );
      if (anchorEl) {
        const aRect = anchorEl.getBoundingClientRect();
        const ax = aRect.left - cRect.left + aRect.width / 2;
        const ay = aRect.top - cRect.top + aRect.height / 2;
        for (let i = 1; i < mergeSelectedIds.length; i++) {
          const targetEl = container.querySelector<HTMLElement>(
            `[data-floor-node="${mergeSelectedIds[i]}"]`
          );
          if (!targetEl) continue;
          const tRect = targetEl.getBoundingClientRect();
          lines.push({
            key: `preview__${mergeSelectedIds[0]}__${mergeSelectedIds[i]}`,
            x1: ax,
            y1: ay,
            x2: tRect.left - cRect.left + tRect.width / 2,
            y2: tRect.top - cRect.top + tRect.height / 2,
          });
        }
      }
    }

    setMergeLines(lines);
  }, [mergedHosts.join(','), mergeMode, mergeSelectedIds.join(',')]);

  useLayoutEffect(() => {
    recomputeConnectorLines();
    const el = blueprintRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recomputeConnectorLines());
    ro.observe(el);
    window.addEventListener('resize', recomputeConnectorLines);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeConnectorLines);
    };
  }, [recomputeConnectorLines]);

  // Pointer-based Drag-to-Merge listeners
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const pending = pendingDragRef.current;
      if (!pending) return;

      const dist = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (!pending.activated) {
        if (dist < 16) return;
        pending.activated = true;
        suppressNextClickRef.current = true;
      }

      const container = blueprintRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const pointerBpX = e.clientX - cRect.left;
      const pointerBpY = e.clientY - cRect.top;

      let hoverTargetId: string | null = null;
      let hoverTargetCenterX: number | null = null;
      let hoverTargetCenterY: number | null = null;
      let hoverSeparateZone = false;
      let overSameGroupNode = false;

      if (typeof document !== 'undefined' && document.elementsFromPoint) {
        const els = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of els) {
          if (el instanceof HTMLElement) {
            if (el.dataset.separateDropzone === 'true') {
              hoverSeparateZone = true;
            }
            const candidateId = el.dataset.floorNode;
            if (candidateId) {
              const candNode = nodeMap.get(candidateId);
              if (candNode && candNode.kind === 'TABLE') {
                const candPrimary = resolvePrimaryNodeId(sessions, candidateId);
                if (candPrimary === pending.sourcePrimaryId) {
                  overSameGroupNode = true;
                } else if (!hoverTargetId) {
                  hoverTargetId = candidateId;
                  const tRect = el.getBoundingClientRect();
                  hoverTargetCenterX = tRect.left - cRect.left + tRect.width / 2;
                  hoverTargetCenterY = tRect.top - cRect.top + tRect.height / 2;
                }
              }
            }
          }
        }
      }

      const nextDrag: ActiveDragState = {
        sourceId: pending.sourceId,
        sourceLabel: pending.sourceLabel,
        sourcePrimaryId: pending.sourcePrimaryId,
        isSourceMerged: pending.isSourceMerged,
        isSourceChild: pending.isSourceChild,
        startX: pending.startX,
        startY: pending.startY,
        clientX: e.clientX,
        clientY: e.clientY,
        sourceCenterX: pending.sourceCenterX,
        sourceCenterY: pending.sourceCenterY,
        pointerBpX,
        pointerBpY,
        hoverTargetId,
        hoverTargetCenterX,
        hoverTargetCenterY,
        hoverSeparateZone,
        isOutsideSameGroup: !overSameGroupNode && dist >= 44,
      };
      dragStateRef.current = nextDrag;
      setDragState(nextDrag);
    };

    const handlePointerUp = () => {
      const pending = pendingDragRef.current;
      const active = dragStateRef.current;
      pendingDragRef.current = null;
      dragStateRef.current = null;
      setDragState(null);

      if (pending?.activated && active) {
        if (active.hoverTargetId && onDragMergeTables) {
          onDragMergeTables(active.sourceId, active.hoverTargetId);
        } else if (
          active.isSourceMerged &&
          onUnmergeGroup &&
          (active.hoverSeparateZone || (active.isSourceChild && active.isOutsideSameGroup))
        ) {
          onUnmergeGroup(
            active.sourcePrimaryId,
            active.isSourceChild ? active.sourceId : undefined
          );
        }
      }

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          suppressNextClickRef.current = false;
        });
      } else {
        suppressNextClickRef.current = false;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [nodes, sessions, onDragMergeTables, onUnmergeGroup]);

  const handleTablePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: FloorNode,
    primaryId: string,
    isMerged: boolean,
    isChildMerged: boolean
  ) => {
    if (mergeMode || node.kind !== 'TABLE') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button')) return;

    const container = blueprintRef.current;
    const cardEl = e.currentTarget;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();

    pendingDragRef.current = {
      sourceId: node.id,
      sourceLabel: node.label,
      sourcePrimaryId: primaryId,
      isSourceMerged: isMerged,
      isSourceChild: isChildMerged,
      startX: e.clientX,
      startY: e.clientY,
      sourceCenterX: cardRect.left - cRect.left + cardRect.width / 2,
      sourceCenterY: cardRect.top - cRect.top + cardRect.height / 2,
      activated: false,
    };
  };

  const handleCardClick = (node: FloorNode) => {
    if (suppressNextClickRef.current) return;
    if (mergeMode) {
      if (node.kind === 'TABLE') {
        onToggleMergeSelect?.(node);
      }
      return;
    }

    playPosBeep('click');
    onSelectNode?.(node);
    onSelectTable?.({
      ...node,
      display_name: node.label,
    });
  };

  /**
   * Renders an architectural table node with clean Liquid Glass styling:
   * - FREE: dark glass (bg-[#1B222C]/70 border-white/10) - NO green borders!
   * - OCCUPIED: emerald glow (bg-[#10B981]/15 border-[#10B981] shadow-[0_0_16px_rgba(16,185,129,0.35)])
   */
  const renderArchitecturalTable = (
    nodeId: string,
    variant: 'vertical-4' | 'vertical-6' | 'square-2' | 'square-3' | 'bar-counter' | 'lounge-counter' | 'sofa-table' | 'round-3',
    className = ''
  ) => {
    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const primaryId = resolvePrimaryNodeId(sessions, node.id);
    const rawSession = sessions[node.id] || resolveNodeSession(node, sessions, 'tenant-modendo-01');
    const effectiveSession = sessions[primaryId] || rawSession;
    const isChildMerged = Boolean(rawSession?.mergedIntoNodeId);
    const groupIds = getMergedGroupNodeIds(sessions, node.id);
    const isMerged = groupIds.length > 1;
    const isHost = isMerged && primaryId === node.id;

    const isOccupied = Boolean(effectiveSession);
    const isPaymentPending = effectiveSession?.status === 'PAYMENT_PENDING';
    const isSelected = activeSelectedId === primaryId || activeSelectedId === node.id;
    const isMergeChecked = mergeSelectedIds.includes(node.id);
    const mergeOrderIndex = mergeSelectedIds.indexOf(node.id);
    const accent = isMerged ? hostAccentMap.get(primaryId) : undefined;

    const itemsCount = effectiveSession
      ? (effectiveSession.cartItems || []).reduce((acc, i) => acc + (i.quantity || 1), 0)
      : 0;
    const totalToman = getSessionTotalToman(effectiveSession, nowMs);
    const elapsedText = effectiveSession?.openedAt
      ? formatElapsedTimer(Math.max(0, nowMs - new Date(effectiveSession.openedAt).getTime()))
      : null;

    const isDragSource = dragState?.sourceId === node.id;
    const isDragMergeTarget = dragState?.hoverTargetId === node.id;

    const isMoveSource = moveMode && moveSourceId === node.id;
    const isMoveTargetCandidate = moveMode && Boolean(moveSourceId) && !isOccupied;
    const isMoveSourceCandidate = moveMode && !moveSourceId && isOccupied;

    // Visual-only glass cards matching premium aesthetic target:
    // OCCUPIED: translucent rose glow (bg-gradient from rose-900 to rose-950, 1px rose-500 border, soft rose shadow)
    // VACANT: translucent emerald glow (bg-gradient from emerald-900 to emerald-950, 1px emerald-400 border, soft emerald shadow)
    // SELECTED: white ring (ring-2 ring-white border-2 border-white)
    // MOVE-MODE: amber halo
    const surfaceStyle = isMoveSource
      ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 shadow-[0_2px_12px_rgba(245,158,11,0.3)] scale-[1.01] text-amber-100'
      : isMoveTargetCandidate
      ? 'bg-[#1B222C]/90 border-emerald-400/60 hover:border-emerald-300 ring-1 ring-emerald-400/40 hover:scale-[1.01] text-white shadow-sm'
      : isMoveSourceCandidate
      ? 'bg-[#10B981]/20 border-amber-400/60 hover:border-amber-300 ring-1 ring-amber-400/40 hover:scale-[1.01] text-white shadow-sm'
      : isDragMergeTarget
      ? 'bg-cyan-500/20 border-cyan-300 ring-1 ring-cyan-300 shadow-[0_2px_14px_rgba(34,211,238,0.35)] scale-[1.02]'
      : isDragSource
      ? 'bg-cyan-500/15 border-cyan-400/60 ring-1 ring-cyan-400/40 opacity-80'
      : isMergeChecked
      ? 'bg-cyan-500/20 border-cyan-300/70 ring-1 ring-cyan-400/50 shadow-sm'
      : isSelected && isOccupied
      ? 'bg-[#5C0D20] border border-white/80 ring-1 ring-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)] text-white scale-[1.01]'
      : isSelected
      ? 'bg-[#063828] border border-white/80 ring-1 ring-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)] text-white scale-[1.01]'
      : isPaymentPending
      ? 'bg-gradient-to-b from-amber-500/20 to-amber-900/30 border border-amber-400/60 shadow-sm text-amber-100'
      : variant === 'bar-counter'
      ? 'bg-[#241306]/90 border border-amber-600/40 shadow-sm text-amber-200'
      : isOccupied
      ? `bg-[#4C091A]/90 border border-rose-500/40 shadow-[0_2px_10px_rgba(244,63,94,0.15)] text-white ${
          accent ? `${accent.border} ring-1 ${accent.ring}` : ''
        }`
      : 'bg-[#07241A]/90 border border-emerald-500/30 hover:border-emerald-400/50 shadow-[0_2px_8px_rgba(0,0,0,0.35)] text-emerald-100';

    if (variant === 'round-3') {
      return (
        <div className={`relative flex items-center justify-center p-2 ${className}`}>
          {/* Orbiting chairs matching Image 5 Terrace round table */}
          <span className={`absolute top-0 w-3.5 h-3.5 rounded-full ${CHAIR_DOT_CLS} shadow-sm`} />
          <span className={`absolute bottom-0 w-3.5 h-3.5 rounded-full ${CHAIR_DOT_CLS} shadow-sm`} />
          <span className={`absolute left-0 w-3.5 h-3.5 rounded-full ${CHAIR_DOT_CLS} shadow-sm`} />
          <span className={`absolute right-0 w-3.5 h-3.5 rounded-full ${CHAIR_DOT_CLS} shadow-sm`} />

          <LiquidSurface
            variant="node"
            enableTilt={!dragState}
            data-floor-node={node.id}
            data-table-id={node.tableId}
            dir="rtl"
            role="button"
            tabIndex={0}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={() => handleCardClick(node)}
            onDoubleClick={() => (onOpenSessionModal || onInspectNode || onConfirmTableOrder)?.(node)}
            className={`w-[84px] h-[84px] rounded-full flex flex-col items-center justify-center p-2 select-none ${surfaceStyle} transition-colors duration-200 cursor-pointer shadow-lg`}
          >
            <span className="font-black text-sm text-white tracking-tight">{getDisplayShortLabel(node)}</span>
            <span className={`text-[10px] font-bold mt-0.5 ${isOccupied ? 'text-rose-200' : 'text-emerald-300'}`}>
              {isOccupied ? (elapsedText ? `اشغال · ${elapsedText}` : 'اشغال') : 'خالی'}
            </span>
            {isOccupied && itemsCount > 0 && (
              <span className="text-[9px] text-white/70 font-mono mt-0.5 tabular-nums">
                {itemsCount} قلم
              </span>
            )}
          </LiquidSurface>
        </div>
      );
    }

    const isWide = variant === 'lounge-counter' || variant === 'bar-counter';
    const showSideChairs = variant === 'vertical-4' || variant === 'vertical-6';
    const sideChairCount = variant === 'vertical-6' ? 3 : 2;

    return (
      <div className={`flex flex-col items-stretch justify-center ${className}`}>
        {variant === 'square-2' && (
          <div className="flex justify-center mb-1">
            <span className={`w-4 h-1.5 ${CHAIR_DOT_CLS}`} />
          </div>
        )}

        <div className="flex items-center gap-1 flex-1 min-h-0">
          {showSideChairs && (
            <div className="flex flex-col justify-around h-full py-2 shrink-0">
              {Array.from({ length: sideChairCount }).map((_, idx) => (
                <span key={idx} className={`w-1.5 h-3 ${CHAIR_DOT_CLS}`} />
              ))}
            </div>
          )}

          <LiquidSurface
            variant="node"
            enableTilt={!dragState}
            data-floor-node={node.id}
            data-table-id={node.tableId}
            data-station-id={node.stationId}
            dir="rtl"
            role="button"
            tabIndex={0}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onPointerDown={(e) =>
              handleTablePointerDown(e, node, primaryId, isMerged, isChildMerged)
            }
            onClick={() => handleCardClick(node)}
            onDoubleClick={() => {
              if (onOpenSessionModal) {
                onOpenSessionModal(node);
              } else if (onInspectNode) {
                onInspectNode(node);
              } else if (onConfirmTableOrder) {
                onConfirmTableOrder(node);
              }
            }}
            onKeyDown={(e: React.KeyboardEvent<any>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick(node);
              }
            }}
            className={`group relative flex-1 h-full rounded-[15px] select-none flex flex-col justify-between overflow-hidden ${
              dragState ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'
            } ${
              isWide ? 'px-3.5 py-2' : 'p-2.5'
            } ${surfaceStyle} transition-colors duration-200`}
          >
            {/* Specular hairline sheen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />

            {/* Header row: Label + Status / Gear */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {mergeMode ? (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border ${
                      isMergeChecked
                        ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                        : 'bg-white/10 text-white/60 border-white/25'
                    }`}
                  >
                    {isMergeChecked ? (
                      mergeOrderIndex === 0 ? '★' : <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : (
                      '+'
                    )}
                  </span>
                ) : isMerged ? (
                  <Link2 className={`w-3.5 h-3.5 shrink-0 ${accent?.text || 'text-cyan-300'}`} />
                ) : null}

                <span className="font-black text-xs text-white truncate tracking-tight">
                  {getDisplayShortLabel(node)}
                </span>
              </div>

              {!mergeMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onInspectNode) {
                      onInspectNode(node);
                    } else if (onOpenSessionModal) {
                      onOpenSessionModal(node);
                    } else {
                      handleCardClick(node);
                    }
                  }}
                  title="تنظیمات میز و فاکتور"
                  className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-[#94A3B8] hover:text-white transition cursor-pointer"
                >
                  <Settings2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Center Area: Status / Order items / Elapsed (No seat-count text) */}
            <div className="my-auto py-1">
              {isOccupied ? (
                <div className="flex flex-col gap-0.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    <span>اشغال</span>
                  </div>
                  {elapsedText && (
                    <span className="font-mono text-[10px] text-rose-200/90 tabular-nums">
                      {elapsedText}
                    </span>
                  )}
                  {itemsCount > 0 && (
                    <span className="text-[10px] text-white/90 font-medium">
                      {itemsCount} آیتم سفارش
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center text-[11px] text-emerald-200 px-0.5">
                  <span className="text-[10px] font-bold text-emerald-300/90">آماده پذیرش</span>
                </div>
              )}
            </div>

            {/* Footer: Running Bill or Rate */}
            <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between text-[10px]">
              {isOccupied && totalToman > 0 ? (
                <span className="font-black text-[#10B981] font-mono tabular-nums w-full text-left">
                  {formatToman(totalToman)} ت
                </span>
              ) : (
                <span className="text-[#64748b] text-[9.5px] w-full text-left">
                  {node.zone === 'LOUNGE' ? 'سفارش ژتونی' : 'آماده پذیرش'}
                </span>
              )}
            </div>
          </LiquidSurface>

          {showSideChairs && (
            <div className="flex flex-col justify-around h-full py-2 shrink-0">
              {Array.from({ length: sideChairCount }).map((_, idx) => (
                <span key={idx} className={`w-1.5 h-3 ${CHAIR_DOT_CLS}`} />
              ))}
            </div>
          )}
        </div>

        {variant === 'square-2' && (
          <div className="flex justify-center mt-1">
            <span className={`w-4 h-1.5 ${CHAIR_DOT_CLS}`} />
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders a PS5 Gaming Pod booth:
   * - FREE: dark glass (bg-[#1B222C]/70 border-white/10) with sky icon & ready badge
   * - OCCUPIED: emerald glow (bg-[#10B981]/15 border-[#10B981] shadow-[0_0_16px_rgba(16,185,129,0.35)]) with live ticking HH:MM:SS
   */
  const renderPs5Booth = (nodeId: string, boothNumber: number) => {
    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const session = sessions[node.id] || resolveNodeSession(node, sessions, 'tenant-modendo-01');
    const isOccupied = Boolean(session && (session.status === 'OCCUPIED' || session.ps5Session));
    const isPaymentPending = session?.status === 'PAYMENT_PENDING';
    const isSelected = activeSelectedId === node.id;
    const ps5 = session?.ps5Session;

    const elapsedMs = ps5 ? getPs5ElapsedMs(ps5, nowMs) : 0;
    const elapsedText = isOccupied ? formatElapsedTimer(elapsedMs) : null;
    const totalToman = isOccupied ? getSessionTotalToman(session, nowMs) : 0;

    const isMoveSource = moveMode && moveSourceId === node.id;
    const isMoveTargetCandidate = moveMode && Boolean(moveSourceId) && !isOccupied;
    const isMoveSourceCandidate = moveMode && !moveSourceId && isOccupied;

    // Translucent glass pod with status glow:
    // Occupied = rose glow (or live emerald active session); Free = emerald/obsidian glass; Selected = white ring
    const boothStyle = isMoveSource
      ? 'cursor-pointer bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 shadow-[0_2px_12px_rgba(245,158,11,0.3)] scale-[1.01]'
      : isMoveTargetCandidate
      ? 'cursor-pointer bg-[#1B222C]/90 border-emerald-400/60 hover:border-emerald-300 ring-1 ring-emerald-400/40 hover:scale-[1.01] text-white shadow-sm'
      : isMoveSourceCandidate
      ? 'cursor-pointer bg-[#10B981]/20 border-amber-400/60 hover:border-amber-300 ring-1 ring-amber-400/40 hover:scale-[1.01] text-white shadow-sm'
      : mergeMode
      ? 'opacity-45 cursor-not-allowed border-white/10 bg-[#1B222C]/70 text-[#94A3B8]'
      : isSelected && isOccupied
      ? 'cursor-pointer bg-[#5C0D20] border border-white/80 ring-1 ring-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)] text-white scale-[1.01]'
      : isSelected
      ? 'cursor-pointer bg-[#063828] border border-white/80 ring-1 ring-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)] text-white scale-[1.01]'
      : isPaymentPending
      ? 'cursor-pointer bg-amber-500/15 border-amber-400/60 shadow-sm text-amber-200'
      : isOccupied
      ? 'cursor-pointer bg-[#4C091A]/90 border border-rose-500/40 shadow-[0_2px_10px_rgba(244,63,94,0.15)] text-white'
      : 'cursor-pointer bg-[#07241A]/90 border border-emerald-500/30 hover:border-emerald-400/50 shadow-[0_2px_8px_rgba(0,0,0,0.35)] text-[#E2E8F0]';

    return (
      <LiquidSurface
        key={node.id}
        variant="node"
        enableTilt={!mergeMode}
        data-floor-node={node.id}
        data-station-id={node.stationId}
        dir="rtl"
        role="button"
        tabIndex={0}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={() => !mergeMode && handleCardClick(node)}
        onDoubleClick={() => {
          if (!mergeMode) {
            (onOpenSessionModal || onInspectNode)?.(node);
          }
        }}
        onKeyDown={(e: React.KeyboardEvent<any>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!mergeMode) handleCardClick(node);
          }
        }}
        className={`relative rounded-[14px] p-2.5 flex flex-col justify-between min-h-[126px] select-none transition-colors duration-200 overflow-hidden ${boothStyle}`}
      >
        {/* Ambient Top Glow Line */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-2 top-0 h-[2px] rounded-full ${
            isOccupied
              ? 'bg-gradient-to-r from-rose-400/80 via-rose-300 to-rose-400/80'
              : 'bg-gradient-to-r from-emerald-400/60 via-emerald-300 to-emerald-400/60'
          }`}
        />

        {/* Top row: Station Short Label + Settings Gear */}
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono font-black text-xs text-white tracking-tight">
            {getDisplayShortLabel(node)}
          </span>
          {!mergeMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onInspectNode) {
                  onInspectNode(node);
                } else if (onOpenSessionModal) {
                  onOpenSessionModal(node);
                } else {
                  handleCardClick(node);
                }
              }}
              title="کنترل تایمر و دسته‌های PS5"
              className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-[#94A3B8] hover:text-white transition cursor-pointer"
            >
              <Settings2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Center Screen + Gamepad Icon */}
        <div className="my-auto flex flex-col items-center justify-center text-center py-1">
          <div
            className={`w-full py-1.5 rounded-lg border flex items-center justify-center gap-1 ${
              isOccupied
                ? 'bg-[#10B981]/20 border-[#10B981]/40 text-emerald-200'
                : 'bg-white/[0.04] border-white/10 text-slate-300'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px] font-bold">
              {isOccupied ? `کابین ${boothNumber}` : 'PS5'}
            </span>
          </div>

          {isOccupied && elapsedText ? (
            <span className="mt-1.5 font-mono text-[11px] font-black text-[#10B981] tabular-nums flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {elapsedText}
            </span>
          ) : (
            <span className="mt-1.5 text-[10px] text-slate-400">آماده بازی</span>
          )}
        </div>

        {/* Footer price/rate */}
        <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between text-[10px]">
          {isOccupied ? (
            <span className="font-black text-[#10B981] font-mono tabular-nums w-full text-center">
              {formatToman(totalToman)} ت
            </span>
          ) : (
            <span className="text-[#94A3B8] font-mono tabular-nums w-full text-center">
              {formatToman(node.hourlyRateToman || 180000)}/س
            </span>
          )}
        </div>
      </LiquidSurface>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full space-y-2.5">
        {/* Horizontal scroll container preserves 1:1 architectural blueprint proportions */}
        <div className="overflow-x-auto select-none pb-2">
          <div
            ref={blueprintRef}
            dir="ltr"
            className="relative min-w-[980px] rounded-[30px] liquid-glass-shell p-4 md:p-5 overflow-hidden border border-emerald-500/30 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.88)]"
          >
            {/* Architectural Floor Plan Blueprint Underlay (Image 4 & 5 Quality) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-[30px]">
              <img
                src="/tenants/modendo/architectural-plan.jpg"
                alt="Modendo Floor Plan Blueprint"
                className="w-full h-full object-cover opacity-40 mix-blend-luminosity filter contrast-125 brightness-75 scale-[1.01]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#061813]/70 via-[#0A2E24]/50 to-[#061813]/80" />
            </div>
            {/* North Window Mullions Accent */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-6 right-6 h-1.5 flex gap-3 z-20"
            >
              <div className="flex-1 bg-white/10 rounded-b-full" />
              <div className="w-24 bg-black/70" />
              <div className="flex-1 bg-white/10 rounded-b-full" />
              <div className="w-2 bg-black/70" />
              <div className="flex-[1.1] bg-white/10 rounded-b-full" />
              <div className="w-2 bg-black/70" />
              <div className="w-[16%] bg-white/10 rounded-b-full" />
            </div>

            {/* Dynamic SVG Link Bridges connecting merged tables + live Drag Tether */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full z-20"
            >
              <defs>
                <filter id="mergeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <AnimatePresence>
                {mergeLines.map((line) => {
                  const mx = (line.x1 + line.x2) / 2;
                  const my = (line.y1 + line.y2) / 2 - 22;
                  const pathD = `M ${line.x1} ${line.y1} Q ${mx} ${my} ${line.x2} ${line.y2}`;
                  return (
                    <motion.g
                      key={line.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth={3}
                        strokeDasharray="7 6"
                        strokeLinecap="round"
                        filter="url(#mergeGlow)"
                        opacity={0.8}
                      />
                      <circle cx={line.x1} cy={line.y1} r={4.5} fill="#22d3ee" />
                      <circle cx={line.x2} cy={line.y2} r={4.5} fill="#10B981" />
                    </motion.g>
                  );
                })}
              </AnimatePresence>

              {/* Live Drag Tether Line */}
              {dragState && (
                <g>
                  {(() => {
                    const endX = dragState.hoverTargetCenterX ?? dragState.pointerBpX;
                    const endY = dragState.hoverTargetCenterY ?? dragState.pointerBpY;
                    const mx = (dragState.sourceCenterX + endX) / 2;
                    const my = (dragState.sourceCenterY + endY) / 2 - 26;
                    const isSep =
                      dragState.isSourceMerged &&
                      !dragState.hoverTargetId &&
                      (dragState.hoverSeparateZone ||
                        (dragState.isSourceChild && dragState.isOutsideSameGroup));
                    const strokeColor = isSep ? '#fb7185' : '#22d3ee';
                    return (
                      <>
                        <path
                          d={`M ${dragState.sourceCenterX} ${dragState.sourceCenterY} Q ${mx} ${my} ${endX} ${endY}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={3.5}
                          strokeDasharray="6 5"
                          strokeLinecap="round"
                          filter="url(#mergeGlow)"
                        />
                        <circle cx={dragState.sourceCenterX} cy={dragState.sourceCenterY} r={5} fill={strokeColor} />
                        <circle cx={endX} cy={endY} r={6} fill={dragState.hoverTargetId ? '#10B981' : strokeColor} />
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>

            {/* Floating Drag-to-Separate Drop Zone */}
            <AnimatePresence>
              {dragState?.isSourceMerged && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  data-separate-dropzone="true"
                  dir="rtl"
                  className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full border backdrop-blur-2xl flex items-center gap-2 text-xs font-black transition-all ${
                    dragState.hoverSeparateZone ||
                    (dragState.isSourceChild && dragState.isOutsideSameGroup && !dragState.hoverTargetId)
                      ? 'bg-rose-500/30 border-rose-300 text-rose-100 shadow-[0_0_28px_-4px_rgba(244,63,94,0.7)] scale-105'
                      : 'bg-[#12161d]/90 border-rose-400/45 text-rose-200 shadow-2xl'
                  }`}
                >
                  <Unlink className="w-4 h-4 text-rose-300" />
                  <span>
                    {dragState.isSourceChild
                      ? `رها کنید برای جداسازی ${dragState.sourceLabel}`
                      : `رها کنید برای جداسازی کامل گروه`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/*
              3-Wing CSS Grid Architecture:
              - Left (37fr): Lounge (top) + PS Room (bottom)
              - Center (44fr): Main Hall, Buffet, Stairs, Bar, Cashier, Entrance, Kitchen
              - Right (19fr): Terrace vertical stack with greenery planter
            */}
            <div className="relative z-10 grid grid-cols-[37fr_44fr_19fr] gap-3 min-h-[730px]">
              {/* ================================================================= */}
              {/* WING 1 (37fr): LOUNGE (TOP) + PS ROOM (BOTTOM)                    */}
              {/* ================================================================= */}
              <div className="flex flex-col gap-3">
                {/* Lounge (سفارش ژتونی - ۸ میز L-01..L-08) */}
                <section
                  className={`relative flex-[72] rounded-[22px] border border-white/[0.11] p-3.5 flex flex-col justify-between overflow-hidden transition-opacity duration-300 ${
                    isZoneDimmed('LOUNGE') ? 'opacity-25' : 'opacity-100'
                  }`}
                  style={{
                    background:
                      'linear-gradient(165deg, rgba(255, 255, 255, 0.03) 0%, rgba(20, 24, 33, 0.75) 55%, rgba(11, 14, 18, 0.9) 100%)',
                  }}
                >
                  {/* U-Shape Wall Banquette silhouette with vivid neon-emerald glow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-2 left-2 right-2 bottom-3 rounded-[32px] modendo-sofa-u-glow bg-gradient-to-b from-[#0A382A]/70 via-[#06241B]/50 to-transparent"
                  />

                  {/* Top Banquette Counters: L-01 + L-07 */}
                  <div className="relative z-10 pt-6 px-4 grid grid-cols-2 gap-2.5">
                    {renderArchitecturalTable('L-01', 'lounge-counter', 'h-[58px]')}
                    {renderArchitecturalTable('L-07', 'lounge-counter', 'h-[58px]')}
                  </div>

                  {/* Center Lounge Floor: Left (L-02, L-04) | Title | Right (L-03, L-06) */}
                  <div className="relative z-10 flex-1 grid grid-cols-[1fr_auto_1fr] gap-2.5 px-4 py-2 items-center">
                    {/* Left Stacked Tables: L-02, L-04 */}
                    <div className="flex flex-col gap-2.5 h-full justify-center">
                      <div className="h-[88px]">
                        {renderArchitecturalTable('L-02', 'vertical-4', 'h-full')}
                      </div>
                      <div className="h-[88px]">
                        {renderArchitecturalTable('L-04', 'vertical-4', 'h-full')}
                      </div>
                    </div>

                    {/* Center Zone Title */}
                    <div dir="rtl" className="text-center px-1 select-none">
                      <div className="font-extrabold text-sm text-white tracking-wide">
                        Lounge
                      </div>
                      <div className="text-xs font-bold text-[#94A3B8] mt-0.5">
                        (سفارش ژتونی)
                      </div>
                    </div>

                    {/* Right Stacked Tables: L-03, L-06 */}
                    <div className="flex flex-col gap-2.5 h-full justify-center">
                      <div className="h-[88px]">
                        {renderArchitecturalTable('L-03', 'vertical-4', 'h-full')}
                      </div>
                      <div className="h-[88px]">
                        {renderArchitecturalTable('L-06', 'vertical-4', 'h-full')}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Lounge: Plush Sofa (مبل) + L-05 + L-08 */}
                  <div className="relative z-10 pt-2 border-t border-white/[0.08] grid grid-cols-[auto_1fr_1fr] items-end gap-2">
                    {/* Plush Sofa (مبل) */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex flex-col items-center justify-center text-center shadow-inner">
                        <Sofa className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span className="text-[10px] font-bold text-[#cbd5e1]">مبل</span>
                      </div>
                    </div>

                    {/* L-05 (مبل و میز / ۲ الی ۳ نفر) */}
                    <div className="h-[78px] min-w-0">
                      {renderArchitecturalTable('L-05', 'sofa-table', 'h-full')}
                    </div>

                    {/* L-08 (میز لانژ ورودی / ۲ نفر) */}
                    <div className="h-[78px] min-w-0">
                      {renderArchitecturalTable('L-08', 'sofa-table', 'h-full')}
                    </div>
                  </div>
                </section>

                {/* PS ROOM (4 ایستگاه PS5-1..PS5-4 در یک ردیف) */}
                <section
                  className={`flex-[28] rounded-[22px] border border-sky-400/20 p-3 flex flex-col justify-between transition-opacity duration-300 ${
                    isZoneDimmed('PS_ROOM') ? 'opacity-25' : 'opacity-100'
                  }`}
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(17, 24, 39, 0.85) 0%, rgba(11, 15, 25, 0.95) 100%)',
                  }}
                >
                  <div className="grid grid-cols-4 gap-2 flex-1">
                    {renderPs5Booth('PS5-1', 1)}
                    {renderPs5Booth('PS5-2', 2)}
                    {renderPs5Booth('PS5-3', 3)}
                    {renderPs5Booth('PS5-4', 4)}
                  </div>
                  <div className="pt-2 text-center flex items-center justify-center gap-2 text-[11px]">
                    <Gamepad2 className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-extrabold text-white tracking-wide">
                      PS Room
                    </span>
                    <span className="text-[#94A3B8]">· اتاق ۴ کابین اختصاصی</span>
                  </div>
                </section>
              </div>

              {/* ================================================================= */}
              {/* WING 2 (44fr): BUFFET + MAIN HALL + BAR + ENTRANCE + KITCHEN       */}
              {/* ================================================================= */}
              <div className="flex flex-col gap-3">
                {/* Upper Main Hall Section */}
                <section
                  className={`relative flex-[73] rounded-[22px] border border-white/[0.11] p-3.5 flex flex-col justify-between gap-2.5 overflow-hidden transition-opacity duration-300 ${
                    isZoneDimmed('MAIN_HALL') ? 'opacity-25' : 'opacity-100'
                  }`}
                  style={{
                    background:
                      'linear-gradient(170deg, rgba(255, 255, 255, 0.03) 0%, rgba(20, 24, 33, 0.75) 55%, rgba(11, 14, 18, 0.92) 100%)',
                  }}
                >
                  {/* Top Row: Buffet/Stairs + M-01..M-04 + M-07 */}
                  <div className="flex-1 grid grid-cols-[28fr_72fr] gap-3 min-h-0">
                    {/* Left Strip: Buffet + Main Hall Title + Spiral Stairs */}
                    <div className="flex flex-col justify-between border-r border-white/[0.08] pr-2.5">
                      {/* Buffet (بوفه) Interactive Card */}
                      {(() => {
                        const buffetNode = nodeMap.get('BUFFET');
                        if (!buffetNode) {
                          return (
                            <div
                              dir="rtl"
                              className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-2 flex flex-col items-center text-center gap-1"
                            >
                              <div className="flex items-center gap-1.5">
                                <Coffee className="w-3.5 h-3.5 text-[#10B981]" />
                                <span className="text-xs font-black text-white">بوفه</span>
                              </div>
                              <span className="text-[10px] text-[#94A3B8]">سرویس</span>
                            </div>
                          );
                        }
                        const bSession = sessions[buffetNode.id] || resolveNodeSession(buffetNode, sessions, 'tenant-modendo-01');
                        const bOccupied = Boolean(bSession);
                        const bSelected = activeSelectedId === buffetNode.id;
                        const bElapsed = bSession?.openedAt
                          ? formatElapsedTimer(Math.max(0, nowMs - new Date(bSession.openedAt).getTime()))
                          : null;
                        const bItemsCount = bSession?.cartItems?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;

                        return (
                          <LiquidSurface
                            as="button"
                            variant="node"
                            data-floor-node={buffetNode.id}
                            dir="rtl"
                            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                            onClick={() => handleCardClick(buffetNode)}
                            onDoubleClick={() => (onOpenSessionModal || onInspectNode)?.(buffetNode)}
                            className={`rounded-2xl p-2.5 flex flex-col items-center text-center gap-1 cursor-pointer transition-all border select-none ${
                              bSelected
                                ? 'bg-gradient-to-b from-[#064E3B]/90 to-[#022C22]/95 border-2 border-white ring-2 ring-white text-white shadow-[0_0_16px_rgba(255,255,255,0.6)]'
                                : bOccupied
                                ? 'bg-gradient-to-b from-[#881337]/80 to-[#4C0519]/90 border border-rose-500/80 text-white shadow-[0_0_14px_rgba(244,63,94,0.5)]'
                                : 'bg-gradient-to-b from-[#064E3B]/65 to-[#022C22]/80 border border-emerald-400/40 text-emerald-100 hover:border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                            }`}
                            title={`بوفه سالن اصلی ${bOccupied ? '(سفارش فعال)' : '(آزاد)'}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Coffee className={`w-3.5 h-3.5 ${bOccupied ? 'text-rose-300' : 'text-[#10B981]'}`} />
                              <span className="text-xs font-black text-white">بوفه</span>
                            </div>
                            <span className={`text-[10px] font-bold ${bOccupied ? 'text-rose-200' : 'text-emerald-300'}`}>
                              {bOccupied ? (bElapsed ? `فعال · ${bElapsed}` : 'سفارش فعال') : 'سرویس / آزاد'}
                            </span>
                            {bOccupied && bItemsCount > 0 && (
                              <span className="text-[9px] font-mono text-white/80 tabular-nums">
                                {bItemsCount} قلم
                              </span>
                            )}
                          </LiquidSurface>
                        );
                      })()}

                      {/* Main Hall Level Label */}
                      <div dir="rtl" className="text-center my-auto py-2">
                        <div className="text-xs font-black text-white">سالن اصلی</div>
                        <div className="text-[11px] font-bold text-[#10B981] mt-0.5">
                          (تراز بالا)
                        </div>
                      </div>

                      {/* Stairs (پله) */}
                      <div
                        dir="rtl"
                        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-2 flex items-center justify-between gap-2 overflow-hidden relative"
                      >
                        <div className="flex items-end gap-0.5 h-6 opacity-60">
                          {[20, 35, 50, 68, 85, 100].map((h, i) => (
                            <div
                              key={i}
                              className="w-1 rounded-t-sm bg-white/40"
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-black text-white block">پله ↺</span>
                          <span className="text-[9px] text-[#94A3B8]">از ورودی</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Area: M-01..M-04 + M-07 */}
                    <div className="flex flex-col justify-between gap-2.5 min-h-0">
                      {/* 1x4 Horizontal Row of M-01 to M-04 */}
                      <div className="grid grid-cols-4 gap-2 h-[126px]">
                        {renderArchitecturalTable('M-01', 'vertical-4', 'h-full')}
                        {renderArchitecturalTable('M-02', 'vertical-4', 'h-full')}
                        {renderArchitecturalTable('M-03', 'vertical-4', 'h-full')}
                        {renderArchitecturalTable('M-04', 'vertical-4', 'h-full')}
                      </div>

                      {/* Central 6-Seater Table: M-07 */}
                      <div className="flex-1 grid grid-cols-12 gap-2.5 items-center">
                        <div dir="rtl" className="col-span-5 flex flex-col justify-end h-full pb-1">
                          <div className="text-[10px] text-[#94A3B8] leading-relaxed">
                            <span className="text-white font-semibold block">
                              میز بزرگ میانی
                            </span>
                            <span className="text-[9px] text-[#64748b]">
                              هم‌سطح سالن اصلی
                            </span>
                          </div>
                        </div>

                        <div className="col-span-7 h-[132px]">
                          {renderArchitecturalTable('M-07', 'vertical-6', 'h-full')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Bar Spine: 6-Seat Counter (BAR-1 .. BAR-6) + Cashier (صندوق) */}
                  <div className="grid grid-cols-12 gap-2.5 items-stretch pt-2 border-t border-white/[0.08]">
                    <div className="col-span-8 rounded-2xl bg-gradient-to-r from-[#1C0D05]/95 via-[#2E1508]/95 to-[#1C0D05]/95 border border-amber-600/40 p-1.5 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                      {/* Counter Title Header */}
                      <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-bold text-amber-200/90 border-b border-amber-500/20">
                        <span className="flex items-center gap-1">
                          <Coffee className="w-3 h-3 text-amber-400" />
                          <span>کانتر بار (۶ صندلی / فیش مستقل)</span>
                        </span>
                        <span className="text-[9.5px] text-amber-300 font-mono tabular-nums">
                          {['BAR-1', 'BAR-2', 'BAR-3', 'BAR-4', 'BAR-5', 'BAR-6'].filter((id) => {
                            const bNode = nodeMap.get(id);
                            return bNode && (Boolean(sessions[id]) || Boolean(resolveNodeSession(bNode, sessions, 'tenant-modendo-01')));
                          }).length} / ۶ فعال
                        </span>
                      </div>

                      {/* 6 Interactive Stool Capsules */}
                      <div className="grid grid-cols-6 gap-1.5 pt-1 flex-1">
                        {['BAR-1', 'BAR-2', 'BAR-3', 'BAR-4', 'BAR-5', 'BAR-6'].map((barId, idx) => {
                          const barNode = nodeMap.get(barId);
                          if (!barNode) return null;
                          const primaryId = resolvePrimaryNodeId(sessions, barNode.id);
                          const rawSession = sessions[barNode.id] || resolveNodeSession(barNode, sessions, 'tenant-modendo-01');
                          const effectiveSession = sessions[primaryId] || rawSession;
                          const isOccupied = Boolean(effectiveSession);
                          const isSelected = activeSelectedId === primaryId || activeSelectedId === barNode.id;
                          const isMergeChecked = mergeSelectedIds.includes(barNode.id);
                          const isMerged = Boolean(rawSession?.mergedIntoNodeId) || Boolean(rawSession?.mergedNodeIds?.length);
                          const isMoveSource = moveMode && moveSourceId === barNode.id;
                          const isMoveTargetCandidate = moveMode && Boolean(moveSourceId) && !isOccupied;
                          const isMoveSourceCandidate = moveMode && !moveSourceId && isOccupied;

                          return (
                            <LiquidSurface
                              as="button"
                              key={barId}
                              variant="node"
                              data-floor-node={barNode.id}
                              data-table-id={barNode.tableId}
                              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                              onClick={() => handleCardClick(barNode)}
                              onDoubleClick={() => (onOpenSessionModal || onInspectNode)?.(barNode)}
                              className={`h-full min-h-[38px] py-1 px-1 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border ${
                                isMoveSource
                                  ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-amber-100 shadow-sm'
                                  : isMoveTargetCandidate
                                  ? 'bg-[#1B222C]/90 border-emerald-400/60 hover:border-emerald-300 ring-1 ring-emerald-400/40 text-white shadow-sm'
                                  : isMoveSourceCandidate
                                  ? 'bg-[#10B981]/20 border-amber-400/60 hover:border-amber-300 ring-1 ring-amber-400/40 text-white shadow-sm'
                                  : isMergeChecked
                                  ? 'bg-cyan-500/20 border-cyan-300 ring-1 ring-cyan-400 text-cyan-100 shadow-sm'
                                  : isSelected && isOccupied
                                  ? 'bg-[#5C0D20] border border-white/80 ring-1 ring-white/60 text-white shadow-sm'
                                  : isSelected
                                  ? 'bg-[#063828] border border-white/80 ring-1 ring-white/60 text-white shadow-sm'
                                  : isOccupied
                                  ? 'bg-[#4C091A]/90 border border-rose-500/40 text-white shadow-sm'
                                  : 'bg-[#07241A]/90 hover:bg-[#0A2E22] border border-emerald-500/30 text-emerald-100 shadow-sm'
                              }`}
                              title={`${barNode.titleFa} ${isOccupied ? '(اشغال)' : '(آزاد)'}`}
                            >
                              <span className="text-[10px] font-black leading-tight">
                                {isMerged ? `🔗 B${idx + 1}` : `B${idx + 1}`}
                              </span>
                              <span className={`text-[8.5px] font-bold ${isOccupied ? 'text-rose-200' : 'text-emerald-300/80'}`}>
                                {isOccupied
                                  ? (effectiveSession?.openedAt
                                      ? formatElapsedTimer(Math.max(0, nowMs - new Date(effectiveSession.openedAt).getTime()))
                                      : 'اشغال')
                                  : 'آزاد'}
                              </span>
                            </LiquidSurface>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      dir="rtl"
                      className="col-span-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 flex flex-col items-center justify-center text-center shadow-inner"
                    >
                      <CreditCard className="w-4 h-4 text-[#10B981] mb-1" />
                      <span className="text-xs font-black text-white">صندوق</span>
                      <span className="text-[9.5px] text-[#94A3B8]">POS & صدور فیش</span>
                    </div>
                  </div>
                </section>

                {/* Lower Section: Entrance (ورودی) + Kitchen (آشپزخانه) */}
                <div className="flex-[27] grid grid-cols-[33fr_67fr] gap-2.5">
                  {/* Entrance (ورودی) */}
                  <div
                    dir="rtl"
                    className="rounded-[22px] border border-white/[0.11] p-3 flex flex-col items-center justify-between text-center relative overflow-hidden bg-white/[0.03]"
                  >
                    <span className="text-[10px] text-[#94A3B8]">درب ورود به سالن</span>
                    <div className="flex flex-col items-center">
                      <span className="text-xl text-[#10B981] font-black leading-none">↑</span>
                      <span className="text-xs font-black text-white mt-1">ورودی</span>
                    </div>
                    <div className="w-16 h-1.5 rounded-t-full bg-emerald-400/30 border-t border-emerald-300/50" />
                  </div>

                  {/* Kitchen (آشپزخانه) */}
                  <div
                    dir="rtl"
                    className="rounded-[22px] border border-white/[0.11] p-3 flex flex-col justify-between relative overflow-hidden bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Utensils className="w-3.5 h-3.5 text-[#10B981]" />
                        آشپزخانه
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">خط آماده و بار گرم</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] text-[#cbd5e1] text-center mt-2">
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] py-1.5">
                        پاس سفارش
                      </div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] py-1.5">
                        گریل و پخت
                      </div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] py-1.5">
                        سینک و آماده‌سازی
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* WING 3 (19fr): TERRACE (تراس فضای باز)                              */}
              {/* ================================================================= */}
              <section
                className={`relative rounded-[22px] border border-white/[0.11] p-3 pr-4 flex flex-col justify-between gap-2 overflow-hidden transition-opacity duration-300 ${
                  isZoneDimmed('TERRACE') ? 'opacity-25' : 'opacity-100'
                }`}
                style={{
                  background:
                    'linear-gradient(175deg, rgba(255, 255, 255, 0.03) 0%, rgba(20, 24, 33, 0.75) 60%, rgba(11, 14, 18, 0.92) 100%)',
                }}
              >
                {/* Greenery Planter Vertical Strip */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-2 bottom-2 right-1.5 w-1.5 rounded-full bg-gradient-to-b from-emerald-600/70 via-emerald-700/60 to-emerald-900/70 border border-emerald-400/25"
                />

                <div dir="rtl" className="flex items-center justify-between gap-1 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <Trees className="w-3.5 h-3.5 text-[#10B981]" />
                    <h3 className="font-black text-xs text-white">تراس</h3>
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">فضای باز</span>
                </div>

                {/* Vertical Stack of Terrace Tables: M-05 (Round), M-06, T-01, T-02, T-03 */}
                <div className="flex-1 flex flex-col justify-between gap-2 min-h-0">
                  <div className="h-[96px] flex items-center justify-center">
                    {renderArchitecturalTable('M-05', 'round-3', 'w-full h-full')}
                  </div>
                  <div className="h-[106px]">
                    {renderArchitecturalTable('M-06', 'vertical-6', 'h-full')}
                  </div>
                  <div className="h-[88px]">
                    {renderArchitecturalTable('T-01', 'square-2', 'h-full')}
                  </div>
                  <div className="h-[88px]">
                    {renderArchitecturalTable('T-02', 'square-2', 'h-full')}
                  </div>
                  <div className="h-[92px] pt-1 border-t border-white/[0.08]">
                    {renderArchitecturalTable('T-03', 'square-3', 'h-full')}
                  </div>
                </div>

                {/* Utility Corner Box */}
                <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1 border-t border-white/[0.08]">
                  <span>انباری / ۳</span>
                  <span className="w-5 h-5 rounded bg-white/[0.05] border border-white/10 font-mono font-bold text-white flex items-center justify-center">
                    3
                  </span>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Inline Legend / Key */}
        <div
          dir="rtl"
          className="flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-[#94A3B8]"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#1B222C] border border-white/20" />
              <span>آزاد</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <span className="text-[#10B981] font-bold">فعال / مشغول</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-cyan-300">ادغام‌شده</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-300">در انتظار تسویه</span>
            </span>
          </div>
          <span>لمس میز: ثبت سفارش · کشیدن میز روی میز دیگر: ادغام · کشیدن به بیرون: جداسازی</span>
        </div>

        {/* Floating Liquid Glass Drag Ghost Pill */}
        {dragState && (
          <div
            dir="rtl"
            style={{
              left: dragState.clientX + 14,
              top: dragState.clientY + 14,
            }}
            className={`fixed z-50 pointer-events-none px-3.5 py-2 rounded-full border backdrop-blur-2xl text-xs font-black flex items-center gap-2 shadow-2xl ${
              dragState.hoverTargetId
                ? 'bg-emerald-950/90 border-[#10B981] text-emerald-200'
                : dragState.isSourceMerged &&
                  (dragState.hoverSeparateZone ||
                    (dragState.isSourceChild && dragState.isOutsideSameGroup))
                ? 'bg-rose-950/90 border-rose-400 text-rose-100'
                : 'bg-[#12161d]/90 border-cyan-400/60 text-cyan-100'
            }`}
          >
            {dragState.hoverTargetId ? (
              <>
                <Link2 className="w-3.5 h-3.5 text-[#10B981]" />
                <span>
                  ادغام {dragState.sourceLabel} ← {nodeMap.get(dragState.hoverTargetId)?.label}
                </span>
              </>
            ) : dragState.isSourceMerged &&
              (dragState.hoverSeparateZone ||
                (dragState.isSourceChild && dragState.isOutsideSameGroup)) ? (
              <>
                <Unlink className="w-3.5 h-3.5 text-rose-300" />
                <span>رها کنید برای جداسازی {dragState.sourceLabel}</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>
                  {dragState.sourceLabel} · روی میز مقصد رها کنید
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </MotionConfig>
  );
};
