/**
 * Modendo POS — Interactive Floor Plan Canvas Component (v6.4-Architectural Exact)
 * Compliant with Specification v6.4
 *
 * Exact Architectural Zones:
 * - Terrace (تراس فضای باز): Exactly 5 clickable tables (2 x 6-seaters, 3 x 2-seaters)
 * - Main Hall (سالن اصلی - تراز بالا): 4 x 6-seaters side-by-side + 1 Central 6-seater next to Counter & Kitchen fixtures
 * - Lounge & PS5 (تراز ۰): U-Shape sofa area with 4 lounge tables (L-01..L-04) + 4 PS5 Gaming Booths side-by-side
 * - Status Badges: آماده پذیرش (Emerald), سفارش باز / مشغول (Amber/Gold with running total & item count), or انتخاب‌شده
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2,
  Users,
  Clock,
  Sparkles,
  Layers,
  RotateCw,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Coffee,
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';
import { TableEntity, TableGeometry } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { CatalogService } from '../../services/catalog/catalogService';
import { calculateSessionElapsedSeconds, formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { ZERO_G_PHYSICS, MotionConfig } from '../../modules/smart-orders/utils/zeroGMotionTokens';

interface FloorPlanCanvasProps {
  levelFilter: 0 | 1 | 'all';
  isEditMode: boolean;
  selectedTableId: string | null;
  onSelectTable: (table: TableEntity | null) => void;
  onOpenSessionModal?: (table: TableEntity) => void;
  onConfirmTableOrder?: (table: TableEntity) => void;
}

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  levelFilter,
  isEditMode,
  selectedTableId,
  onSelectTable,
  onOpenSessionModal,
  onConfirmTableOrder,
}) => {
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [activeTabs, setActiveTabs] = useState<any[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time service updates
  useEffect(() => {
    const unsub = floorPlanService.subscribe((schema) => {
      setTables(schema.tables);
    });
    return () => unsub();
  }, []);

  // Poll open tabs to keep running totals and item counts honest
  useEffect(() => {
    const updateTabs = () => {
      try {
        const tabs = CatalogService.getOpenTabs();
        setActiveTabs(tabs);
      } catch {
        setActiveTabs([]);
      }
    };
    updateTabs();
    const interval = setInterval(updateTabs, 1500);
    return () => clearInterval(interval);
  }, []);

  // Live timer tick every second for active gaming / boardgame sessions
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'Escape') {
        onSelectTable(null);
        return;
      }

      if (!selectedTableId) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const cloned = floorPlanService.cloneTable(selectedTableId);
        if (cloned) onSelectTable(cloned);
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        floorPlanService.rotateTable(selectedTableId);
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        floorPlanService.deleteTable(selectedTableId);
        onSelectTable(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTableId, onSelectTable]);

  // Filter tables by current level
  const displayedTables = tables.filter((t) => {
    if (levelFilter === 'all') return true;
    return t.level === levelFilter;
  });

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  // Helper: Open Tab / Order State Inspector per table
  const getTableTabInfo = (table: TableEntity) => {
    const matchingTab = activeTabs.find((t) => {
      const label = t.table_or_customer || t.tableOrCustomer || '';
      return (
        label === table.display_name ||
        label === table.id ||
        label.includes(table.display_name) ||
        (table.display_name.startsWith('M-') && label.includes(table.display_name.split(' ')[0])) ||
        (table.display_name.startsWith('PS5-') && label.includes(table.display_name)) ||
        (table.display_name.startsWith('L-') && label.includes(table.display_name.split(' ')[0]))
      );
    });

    let itemCount = 0;
    let totalToman = table.currentBillAmount || 0;

    if (matchingTab) {
      totalToman = matchingTab.total_toman || matchingTab.total_due || totalToman;
      if (matchingTab.raw_cart_json) {
        try {
          const parsed = JSON.parse(matchingTab.raw_cart_json);
          if (Array.isArray(parsed)) {
            itemCount = parsed.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
          }
        } catch {}
      }
    }

    const hasOpenOrder =
      Boolean(matchingTab) ||
      table.status === 'OCCUPIED' ||
      table.status === 'GAMING_ACTIVE' ||
      table.status === 'AWAITING_BILL' ||
      (table.currentBillAmount !== undefined && table.currentBillAmount > 0);

    return {
      hasOpenOrder,
      matchingTab,
      itemCount,
      totalToman,
    };
  };

  // Format active session elapsed time (HH:MM:SS)
  const formatElapsedTime = (table?: TableEntity) => {
    if (!table?.sessionStartTime) return '00:00:00';
    const elapsed = calculateSessionElapsedSeconds(
      table.sessionStartTime,
      table.pausedAt ? new Date(table.pausedAt).getTime() : nowTime,
      table.pausedMs || 0
    );
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Drag handlers in Edit Mode
  const handleMouseDownTable = (e: React.MouseEvent, table: TableEntity) => {
    e.stopPropagation();
    onSelectTable(table);

    if (isEditMode) {
      setIsDragging(true);
      setDraggedTableId(table.id);
      setDragOffset({
        x: e.clientX - table.geometry.x * zoom,
        y: e.clientY - table.geometry.y * zoom,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedTableId || !isEditMode) return;
    const newX = (e.clientX - dragOffset.x) / zoom;
    const newY = (e.clientY - dragOffset.y) / zoom;
    floorPlanService.updateTableGeometry(draggedTableId, { x: newX, y: newY }, true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedTableId(null);
  };

  // Status Badge and Color Logic (Section 4 Compliance)
  const getTableColorConfig = (table: TableEntity, isSelected: boolean) => {
    const { hasOpenOrder } = getTableTabInfo(table);
    const status = table.status || 'AVAILABLE';

    if (isSelected) {
      return {
        bg: hasOpenOrder ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.25)',
        border: '#FFFFFF',
        glow: '0 0 16px rgba(255, 255, 255, 0.85)',
        badgeBg: '#0284C7',
        badgeBorder: '#38BDF8',
        label: 'انتخاب‌شده',
      };
    }

    if (status === 'PAUSED') {
      return {
        bg: 'rgba(245, 158, 11, 0.25)',
        border: '#F59E0B',
        glow: '0 0 12px rgba(245, 158, 11, 0.5)',
        badgeBg: '#B45309',
        badgeBorder: '#F59E0B',
        label: 'توقف موقت',
      };
    }

    if (hasOpenOrder || status === 'OCCUPIED' || status === 'GAMING_ACTIVE' || status === 'AWAITING_BILL') {
      return {
        bg: 'rgba(245, 158, 11, 0.22)',
        border: '#F59E0B', // Amber / Gold
        glow: '0 0 14px rgba(245, 158, 11, 0.5)',
        badgeBg: '#B45309',
        badgeBorder: '#F59E0B',
        label: 'سفارش باز / مشغول',
      };
    }

    // Default AVAILABLE (Emerald / Mint)
    return {
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#10B981', // Emerald Highlight
      glow: 'none',
      badgeBg: '#065F46',
      badgeBorder: '#10B981',
      label: 'آماده پذیرش',
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[660px] bg-[#0B0D11] border border-[#27313F] rounded-2xl overflow-hidden select-none flex flex-col justify-between shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => onSelectTable(null)}
    >
      {/* Canvas Top Bar Overlay */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-[#12161D]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#27313F]">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#10B981]" />
            {levelFilter === 'all'
              ? 'کل فضا (تراز ۰ و ۱)'
              : levelFilter === 0
              ? 'تراز ۰: سالن لانژ و اتاق PS5'
              : 'تراز ۱: سالن اصلی، بار و تراس'}
          </span>
          <div className="h-3 w-px bg-[#27313F] mx-1"></div>
          <span className="text-[11px] text-[#9EACB8] font-medium">
            {displayedTables.length} بخش فعال
          </span>
        </div>

        {/* Zoom & Canvas Actions */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-[#12161D]/90 backdrop-blur-md p-1 rounded-xl border border-[#27313F]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((prev) => Math.min(prev + 0.1, 1.8));
            }}
            className="p-1.5 text-[#CBD5E1] hover:text-white hover:bg-[#27313F] rounded-lg transition-colors cursor-pointer"
            title="بزرگنمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((prev) => Math.max(prev - 0.1, 0.6));
            }}
            className="p-1.5 text-[#CBD5E1] hover:text-white hover:bg-[#27313F] rounded-lg transition-colors cursor-pointer"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 text-[#CBD5E1] hover:text-white hover:bg-[#27313F] rounded-lg transition-colors cursor-pointer"
            title="بازنشانی زاویه دید"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive SVG Space */}
      <div className="relative w-full h-full cursor-grab active:cursor-grabbing overflow-hidden">
        <svg
          className="w-full h-full"
          viewBox="0 0 1000 680"
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Magnetic Grid Pattern 10px */}
            <pattern
              id="magneticGrid10"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="5" cy="5" r="0.75" fill="#27313F" opacity="0.6" />
            </pattern>

            {/* Level 0 Velvet Lounge Texture */}
            <pattern
              id="velvetStripe"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="20" stroke="#059669" strokeWidth="2" opacity="0.15" />
            </pattern>
          </defs>

          {/* Canvas Background Grid */}
          <rect width="1000" height="680" fill="#0B0D11" />
          <rect width="1000" height="680" fill="url(#magneticGrid10)" />

          {/* ======================================================== */}
          {/* ARCHITECTURAL ZONING CONTAINERS                           */}
          {/* ======================================================== */}

          {/* --- LEVEL 0 BOUNDARY (Left Column) --- */}
          {(levelFilter === 'all' || levelFilter === 0) && (
            <g id="zone_level_0" opacity={levelFilter === 'all' ? 0.95 : 1}>
              {/* Level 0 Main Panel */}
              <rect
                x="30"
                y="50"
                width="380"
                height="590"
                rx="16"
                fill="#12161D"
                stroke="#27313F"
                strokeWidth="2"
              />
              <text x="50" y="85" fill="#10B981" fontSize="14" fontWeight="800" fontFamily="Vazirmatn, sans-serif">
                تراز ۰: سالن لانژ و اتاق PS5
              </text>

              {/* Lounge U-Sofa Visual Contour ($color-emerald-velvet: #059669) */}
              <path
                d="M 60 165 L 370 165 L 370 375 L 325 375 L 325 210 L 105 210 L 105 375 L 60 375 Z"
                fill="url(#velvetStripe)"
                stroke="#059669"
                strokeWidth="2.5"
              />
              <text x="215" y="145" fill="#34D399" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                سالن لانژ - مبل U-Shape
              </text>

              {/* PS Room Zone Frame (Bottom-Left) */}
              <rect
                x="45"
                y="465"
                width="350"
                height="145"
                rx="12"
                fill="#0F172A"
                stroke="#3B82F6"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text x="65" y="492" fill="#60A5FA" fontSize="12" fontWeight="bold" fontFamily="Vazirmatn">
                اتاق PS5 (ایستگاه‌های گیمینگ)
              </text>

              {/* Entrance Archway */}
              <g id="entrance_door">
                <rect x="140" y="625" width="160" height="18" rx="4" fill="#1E293B" stroke="#059669" strokeWidth="1.5" />
                <text x="220" y="638" fill="#10B981" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                  ▼ ورودی اصلی کافه ▼
                </text>
              </g>
            </g>
          )}

          {/* --- SPIRAL STAIRCASE 1/4 CIRCLE (Connecting L0 to L1) --- */}
          {levelFilter === 'all' && (
            <g id="spiral_stairs" transform="translate(418, 310)">
              <path
                d="M 0 0 A 60 60 0 0 1 60 60 L 60 30 A 30 30 0 0 0 0 0 Z"
                fill="#1E293B"
                stroke="#64748B"
                strokeWidth="2"
              />
              <line x1="15" y1="5" x2="30" y2="15" stroke="#94A3B8" strokeWidth="1.5" />
              <line x1="30" y1="18" x2="45" y2="35" stroke="#94A3B8" strokeWidth="1.5" />
              <line x1="45" y1="38" x2="55" y2="55" stroke="#94A3B8" strokeWidth="1.5" />
              <text x="25" y="-10" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                پلکان دوار تراز بالا ▲
              </text>
            </g>
          )}

          {/* --- LEVEL 1 BOUNDARY (Center Column: Main Hall & Right Column: Terrace) --- */}
          {(levelFilter === 'all' || levelFilter === 1) && (
            <g id="zone_level_1" opacity={levelFilter === 'all' ? 0.95 : 1}>
              {/* Level 1 Main Boardgame Hall (Center Column) */}
              <rect
                x="460"
                y="50"
                width="300"
                height="590"
                rx="16"
                fill="#12161D"
                stroke="#27313F"
                strokeWidth="2"
              />
              <text x="480" y="85" fill="#F59E0B" fontSize="14" fontWeight="800" fontFamily="Vazirmatn, sans-serif">
                سالن اصلی - تراز بالا
              </text>

              {/* Non-Clickable Fixture: کانتر بار و صندوق */}
              <rect
                x="475"
                y="240"
                width="155"
                height="55"
                rx="8"
                fill="#1E293B"
                stroke="#64748B"
                strokeWidth="1.5"
              />
              <text x="552" y="273" fill="#CBD5E1" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                کانتر بار و صندوق
              </text>

              {/* Non-Clickable Fixture: آشپزخانه گرم و باریستا */}
              <rect
                x="475"
                y="310"
                width="155"
                height="110"
                rx="8"
                fill="#1C1917"
                stroke="#E11D48"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text x="552" y="365" fill="#FB7185" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                آشپزخانه گرم و باریستا
              </text>

              {/* Terrace Space (Right Column) */}
              <rect
                x="785"
                y="50"
                width="185"
                height="590"
                rx="16"
                fill="#06251C"
                stroke="#059669"
                strokeWidth="2.5"
              />
              <text x="877" y="85" fill="#34D399" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily="Vazirmatn">
                تراس فضای باز (سیگار آزاد)
              </text>
            </g>
          )}

          {/* ======================================================== */}
          {/* TABLES & INTERACTIVE POS ENTITIES                        */}
          {/* ======================================================== */}
          {displayedTables.map((table) => {
            const { x, y, width, height, rotation } = table.geometry;
            const isSelected = selectedTableId === table.id;
            const colors = getTableColorConfig(table, isSelected);
            const isPS5 = table.billing_mode === 'hourly_timer';
            const { hasOpenOrder, itemCount, totalToman } = getTableTabInfo(table);

            // Center for SVG rotation
            const cx = x + width / 2;
            const cy = y + height / 2;

            return (
              <g
                key={table.id}
                transform={`rotate(${rotation || 0} ${cx} ${cy})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTable(table);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectTable(table);
                  if (onConfirmTableOrder) {
                    onConfirmTableOrder(table);
                  }
                }}
                onMouseDown={(e) => handleMouseDownTable(e, table)}
                className="cursor-pointer transition-all duration-200"
              >
                {/* Table Surface Geometry */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={8}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={isSelected ? 3 : 2}
                  filter={isSelected ? 'drop-shadow(0 0 10px #FFFFFF)' : undefined}
                />

                {/* Table Name Label */}
                <text
                  x={cx}
                  y={cy - (height > 55 ? 12 : 2)}
                  fill="#FFFFFF"
                  fontSize={Math.min(12, Math.max(9, width / 6.2))}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="Vazirmatn, sans-serif"
                >
                  {table.display_name}
                </text>

                {/* PS5 Active Timer Badge */}
                {isPS5 && (table.status === 'GAMING_ACTIVE' || table.status === 'PAUSED') && (
                  <g transform={`translate(${cx - 30}, ${cy + 2})`}>
                    <rect width="60" height="14" rx="4" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1" />
                    <text
                      x="30"
                      y="10"
                      fill="#93C5FD"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {formatElapsedTime(table)}
                    </text>
                  </g>
                )}

                {/* Status Badges: آماده پذیرش (Emerald) / سفارش باز (Amber/Gold) / انتخاب‌شده */}
                {height > 50 && (
                  <g transform={`translate(${cx - 36}, ${cy + (isPS5 ? 18 : 6)})`}>
                    <rect
                      width="72"
                      height="15"
                      rx="4"
                      fill={colors.badgeBg}
                      stroke={colors.badgeBorder}
                      strokeWidth="1"
                    />
                    <text
                      x="36"
                      y="11"
                      fill="#FFFFFF"
                      fontSize="7.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="Vazirmatn"
                    >
                      {colors.label}
                    </text>
                  </g>
                )}

                {/* Running Total & Item Count for Open Tab */}
                {hasOpenOrder && height > 65 && totalToman > 0 && (
                  <text
                    x={cx}
                    y={cy + 32}
                    fill="#FDE68A"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="Vazirmatn"
                  >
                    {itemCount > 0 ? `${itemCount} قلم • ` : ''}{formatToman(totalToman)} ت
                  </text>
                )}

                {/* Capacity Icon Badge */}
                <circle
                  cx={x + width - 6}
                  cy={y + 6}
                  r="4"
                  fill={colors.border}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Entity Action HUD Overlay */}
      <AnimatePresence>
        {selectedTable && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={ZERO_G_PHYSICS.buoyant}
            className="absolute bottom-4 left-4 right-4 z-20 bg-[#12161D]/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl"
          >
            {/* Info pill */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md border border-white/[0.1]"
                style={{ backgroundColor: getTableColorConfig(selectedTable, true).badgeBg }}
              >
                {selectedTable.billing_mode === 'hourly_timer' ? (
                  <Gamepad2 className="w-5 h-5 text-white" />
                ) : (
                  <Coffee className="w-5 h-5 text-white" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white tracking-heading">
                    {selectedTable.display_name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#1E293B] text-[#CBD5E1] border border-white/[0.06]">
                    {selectedTable.level === 0 ? 'تراز ۰ (پایین)' : 'تراز ۱ (بالا)'}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-black text-white shadow-sm"
                    style={{ backgroundColor: getTableColorConfig(selectedTable, false).badgeBg }}
                  >
                    {getTableColorConfig(selectedTable, false).label}
                  </span>
                </div>
                <div className="text-xs text-[#9EACB8] mt-0.5 flex items-center gap-3">
                  <span>ظرفیت: {selectedTable.capacity.nominal} نفر</span>
                  {selectedTable.billing_mode === 'hourly_timer' && (
                    <span className="text-blue-400 font-mono tracking-mono flex items-center gap-1 font-bold">
                      <Clock className="w-3 h-3" />
                      {formatElapsedTime(selectedTable)}
                    </span>
                  )}
                  {getTableTabInfo(selectedTable).hasOpenOrder && (
                    <span className="text-amber-400 font-bold">
                      مبلغ سفارش: {formatToman(getTableTabInfo(selectedTable).totalToman)} تومان ({getTableTabInfo(selectedTable).itemCount} قلم)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Primary Waiter Flow Action: Select table & Route to POS */}
              {onConfirmTableOrder && (
                <motion.button
                  whileTap={MotionConfig.tactileTap}
                  onClick={(e) => {
                    e.stopPropagation();
                    playPosBeep('click');
                    onConfirmTableOrder(selectedTable);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    {getTableTabInfo(selectedTable).hasOpenOrder
                      ? 'مشاهده و تکمیل تب باز'
                      : 'تأیید و انتخاب میز'}
                  </span>
                </motion.button>
              )}

              {/* Session & Bill Modal Trigger */}
              {onOpenSessionModal && (
                <motion.button
                  whileTap={MotionConfig.tactileTap}
                  onClick={(e) => {
                    e.stopPropagation();
                    playPosBeep('click');
                    onOpenSessionModal(selectedTable);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-[#334155] text-white flex items-center gap-1.5 border border-white/[0.08] transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>مدیریت سشن و صورتحساب</span>
                </motion.button>
              )}

              {isEditMode && (
                <>
                  <motion.button
                    whileTap={MotionConfig.tactileTap}
                    onClick={(e) => {
                      e.stopPropagation();
                      playPosBeep('click');
                      floorPlanService.rotateTable(selectedTable.id);
                    }}
                    className="p-2 bg-[#1E293B] hover:bg-[#334155] text-[#E2E8F0] rounded-xl text-xs flex items-center gap-1 border border-white/[0.06] cursor-pointer"
                    title="چرخش ۹۰ درجه (R)"
                  >
                    <RotateCw className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileTap={MotionConfig.tactileTap}
                    onClick={(e) => {
                      e.stopPropagation();
                      playPosBeep('click');
                      const cl = floorPlanService.cloneTable(selectedTable.id);
                      if (cl) onSelectTable(cl);
                    }}
                    className="p-2 bg-[#1E293B] hover:bg-[#334155] text-[#E2E8F0] rounded-xl text-xs flex items-center gap-1 border border-white/[0.06] cursor-pointer"
                    title="کلون (Ctrl+D)"
                  >
                    <Copy className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileTap={MotionConfig.tactileTap}
                    onClick={(e) => {
                      e.stopPropagation();
                      playPosBeep('delete');
                      floorPlanService.deleteTable(selectedTable.id);
                      onSelectTable(null);
                    }}
                    className="p-2 bg-red-900/40 hover:bg-red-800 text-red-200 rounded-xl text-xs flex items-center gap-1 border border-red-700/40 cursor-pointer"
                    title="حذف (Delete)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
