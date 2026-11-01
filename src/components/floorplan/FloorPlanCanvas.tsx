/**
 * Modendo POS — Interactive Floor Plan Canvas Component
 * Compliant with Specification v6.3-Final Settled
 * Supports: Split-Level SVG Rendering, 10px Magnetic Grid, Hotkeys (Ctrl+D, R, Delete, Esc),
 * Real-time State Machine (Green, Crimson, PS5 Neon Blue, Yellow), and Live Timers.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2,
  Users,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  Move,
  RotateCw,
  Copy,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Flame,
  Coffee,
  Sun,
  ShieldAlert,
} from 'lucide-react';
import { TableEntity, TableStatus, TableGeometry } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { playPosBeep } from '../../services/soundEffects';
import { ZERO_G_PHYSICS, MotionConfig } from '../../modules/smart-orders/utils/zeroGMotionTokens';

interface FloorPlanCanvasProps {
  levelFilter: 0 | 1 | 'all';
  isEditMode: boolean;
  selectedTableId: string | null;
  onSelectTable: (table: TableEntity | null) => void;
  onOpenSessionModal?: (table: TableEntity) => void;
}

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  levelFilter,
  isEditMode,
  selectedTableId,
  onSelectTable,
  onOpenSessionModal,
}) => {
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [nowTime, setNowTime] = useState<number>(Date.now());

  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time service updates
  useEffect(() => {
    const unsub = floorPlanService.subscribe((schema) => {
      setTables(schema.tables);
    });
    return () => unsub();
  }, []);

  // Live timer tick every second for active gaming / boardgame sessions
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts Engine (Section 4.2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'Escape') {
        onSelectTable(null);
        return;
      }

      if (!selectedTableId) return;

      // Ctrl + D: Clone selected entity with 20px offset
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const cloned = floorPlanService.cloneTable(selectedTableId);
        if (cloned) {
          onSelectTable(cloned);
        }
      }

      // R: Rotate 90 degrees around center
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        floorPlanService.rotateTable(selectedTableId);
      }

      // Delete: Remove entity from layout
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

  // Format active session elapsed time (HH:MM:SS)
  const formatElapsedTime = (startTimeStr?: string) => {
    if (!startTimeStr) return '00:00:00';
    const start = new Date(startTimeStr).getTime();
    const diff = Math.max(0, Math.floor((nowTime - start) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
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

  // Status Color Logic (Section 4.1 & 5)
  const getTableColorConfig = (table: TableEntity) => {
    const status = table.status || 'AVAILABLE';

    if (status === 'GAMING_ACTIVE' || table.billing_mode === 'hourly_timer' && status !== 'AVAILABLE') {
      return {
        bg: 'rgba(59, 130, 246, 0.25)',
        border: '#3B82F6', // Neon Blue
        glow: '0 0 15px rgba(59, 130, 246, 0.6)',
        badgeBg: '#1D4ED8',
        label: 'گیمینگ فعال',
      };
    }

    switch (status) {
      case 'OCCUPIED':
        return {
          bg: 'rgba(225, 29, 72, 0.25)',
          border: '#E11D48', // Crimson Accent
          glow: '0 0 12px rgba(225, 29, 72, 0.5)',
          badgeBg: '#BE123C',
          label: 'مشغول',
        };
      case 'AWAITING_BILL':
        return {
          bg: 'rgba(245, 158, 11, 0.25)',
          border: '#F59E0B', // Amber / Yellow
          glow: '0 0 12px rgba(245, 158, 11, 0.5)',
          badgeBg: '#B45309',
          label: 'در انتظار تسویه',
        };
      case 'AVAILABLE':
      default:
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: '#10B981', // Emerald Highlight
          glow: 'none',
          badgeBg: '#059669',
          label: 'آماده پذیرش',
        };
    }
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
        {/* Spatial Zones Indicators */}
        <div className="flex items-center gap-2 pointer-events-auto bg-[#12161D]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#27313F]">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#10B981]" />
            {levelFilter === 'all'
              ? 'کل فضا (تراز ۰ و ۱)'
              : levelFilter === 0
              ? 'تراز ۰: لانژ و گیمینگ'
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

            {/* Terrace Hedge Border Texture */}
            <pattern
              id="terraceHedge"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <rect width="12" height="12" fill="#064E3B" opacity="0.3" />
              <circle cx="6" cy="6" r="3" fill="#10B981" opacity="0.25" />
            </pattern>
          </defs>

          {/* Canvas Background Grid */}
          <rect width="1000" height="680" fill="#0B0D11" />
          <rect width="1000" height="680" fill="url(#magneticGrid10)" />

          {/* ======================================================== */}
          {/* ARCHITECTURAL ZONING CONTAINERS (Section 2 & 5)           */}
          {/* ======================================================== */}

          {/* --- LEVEL 0 BOUNDARY (Left Half) --- */}
          {(levelFilter === 'all' || levelFilter === 0) && (
            <g id="zone_level_0" opacity={levelFilter === 'all' ? 0.9 : 1}>
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

              {/* Entrance Archway (Bottom Center) */}
              <g id="entrance_door">
                <rect x="130" y="625" width="160" height="20" rx="4" fill="#1E293B" stroke="#059669" strokeWidth="2" />
                <text x="210" y="639" fill="#10B981" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                  ▼ ورودی اصلی کافه ▼
                </text>
              </g>

              {/* PS Room Zone Frame */}
              <rect
                x="45"
                y="505"
                width="280"
                height="105"
                rx="10"
                fill="#0F172A"
                stroke="#3B82F6"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text x="60" y="525" fill="#60A5FA" fontSize="11" fontWeight="bold" fontFamily="Vazirmatn">
                اتاق گیمینگ اختصاصی (PS5 Gaming Pods)
              </text>

              {/* Lounge U-Sofa Visual Contour ($color-emerald-velvet: #059669) */}
              <path
                d="M 65 200 L 305 200 L 305 385 L 245 385 L 245 260 L 125 260 L 125 385 L 65 385 Z"
                fill="url(#velvetStripe)"
                stroke="#059669"
                strokeWidth="2.5"
              />
              <text x="185" y="240" fill="#34D399" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                مبلمان مخمل سبز لانژ (سفارش ژتونی)
              </text>
            </g>
          )}

          {/* --- SPIRAL STAIRCASE 1/4 CIRCLE (Connecting L0 to L1) --- */}
          {levelFilter === 'all' && (
            <g id="spiral_stairs" transform="translate(420, 310)">
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

          {/* --- LEVEL 1 BOUNDARY (Right Half) --- */}
          {(levelFilter === 'all' || levelFilter === 1) && (
            <g id="zone_level_1" opacity={levelFilter === 'all' ? 0.9 : 1}>
              {/* Level 1 Main Boardgame Hall */}
              <rect
                x="470"
                y="50"
                width="300"
                height="590"
                rx="16"
                fill="#12161D"
                stroke="#27313F"
                strokeWidth="2"
              />
              <text x="490" y="85" fill="#F59E0B" fontSize="14" fontWeight="800" fontFamily="Vazirmatn, sans-serif">
                تراز ۱: سالن بردگیم و بار کانتر
              </text>

              {/* Bar & Cashier Backdrop ($color-crimson-accent: #E11D48) */}
              <rect
                x="490"
                y="320"
                width="160"
                height="80"
                rx="8"
                fill="#1C1917"
                stroke="#E11D48"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text x="570" y="365" fill="#FB7185" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="Vazirmatn">
                آشپزخانه گرم و بارستا
              </text>

              {/* Terrace Space ($color-terrace-border: #059669) */}
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
            const colors = getTableColorConfig(table);
            const isPS5 = table.billing_mode === 'hourly_timer';
            const isLoungeZone = table.id === 'LZ-ZONE';

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
                onMouseDown={(e) => handleMouseDownTable(e, table)}
                className="cursor-pointer transition-all duration-200"
              >
                {/* Table Surface Geometry */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={isLoungeZone ? 12 : 8}
                  fill={isLoungeZone ? 'rgba(5, 150, 105, 0.12)' : colors.bg}
                  stroke={isSelected ? '#FFFFFF' : colors.border}
                  strokeWidth={isSelected ? 3 : isLoungeZone ? 1.5 : 2}
                  filter={isSelected ? 'drop-shadow(0 0 10px #FFFFFF)' : undefined}
                  style={{
                    boxShadow: colors.glow,
                  }}
                />

                {/* Table Label & Details */}
                {!isLoungeZone ? (
                  <>
                    <text
                      x={cx}
                      y={cy - (height > 50 ? 8 : 0)}
                      fill="#FFFFFF"
                      fontSize={Math.min(12, Math.max(9, width / 6))}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontFamily="Vazirmatn, sans-serif"
                    >
                      {table.display_name}
                    </text>

                    {/* PS5 Active Timer Badge */}
                    {isPS5 && table.status === 'GAMING_ACTIVE' && (
                      <g transform={`translate(${cx - 32}, ${cy + 6})`}>
                        <rect width="64" height="16" rx="4" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1" />
                        <text
                          x="32"
                          y="11"
                          fill="#93C5FD"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {formatElapsedTime(table.sessionStartTime)}
                        </text>
                      </g>
                    )}

                    {/* Standard Dine-In / Boardgame Status Badge */}
                    {!isPS5 && height > 55 && (
                      <g transform={`translate(${cx - 26}, ${cy + 10})`}>
                        <rect
                          width="52"
                          height="14"
                          rx="3"
                          fill={colors.badgeBg}
                          opacity="0.9"
                        />
                        <text
                          x="26"
                          y="10"
                          fill="#FFFFFF"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="Vazirmatn"
                        >
                          {colors.label}
                        </text>
                      </g>
                    )}
                  </>
                ) : (
                  // Large Lounge Zone Indicator
                  <g>
                    <text
                      x={cx}
                      y={cy - 10}
                      fill="#10B981"
                      fontSize="14"
                      fontWeight="800"
                      textAnchor="middle"
                      fontFamily="Vazirmatn"
                    >
                      {table.display_name}
                    </text>
                    <text
                      x={cx}
                      y={cy + 12}
                      fill="#6EE7B7"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="Vazirmatn"
                    >
                      سفارش بر پایه ژتون موقت (Token-based)
                    </text>
                  </g>
                )}

                {/* Capacity Icon Badge */}
                {!isLoungeZone && (
                  <circle
                    cx={x + width - 6}
                    cy={y + 6}
                    r="4"
                    fill={colors.border}
                  />
                )}
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
            className="absolute bottom-4 left-4 right-4 z-20 bg-[#12161D]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl"
          >
            {/* Info pill */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md border border-white/[0.1]"
                style={{ backgroundColor: getTableColorConfig(selectedTable).badgeBg }}
              >
                {selectedTable.billing_mode === 'hourly_timer' ? (
                  <Gamepad2 className="w-5 h-5 text-white" />
                ) : selectedTable.billing_mode === 'token' ? (
                  <Sparkles className="w-5 h-5 text-white" />
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
                    style={{ backgroundColor: getTableColorConfig(selectedTable).badgeBg }}
                  >
                    {getTableColorConfig(selectedTable).label}
                  </span>
                </div>
                <div className="text-xs text-[#9EACB8] mt-0.5 flex items-center gap-3">
                  <span>ظرفیت: {selectedTable.capacity.nominal} نفر</span>
                  {selectedTable.billing_mode === 'hourly_timer' && (
                    <span className="text-blue-400 font-mono tracking-mono flex items-center gap-1 font-bold">
                      <Clock className="w-3 h-3" />
                      {formatElapsedTime(selectedTable.sessionStartTime)}
                    </span>
                  )}
                  {selectedTable.assignedToken && (
                    <span className="text-emerald-400 font-bold">
                      ژتون: #{selectedTable.assignedToken}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {onOpenSessionModal && (
                <motion.button
                  whileTap={MotionConfig.tactileTap}
                  onClick={(e) => {
                    e.stopPropagation();
                    playPosBeep('click');
                    onOpenSessionModal(selectedTable);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  مدیریت سشن و صورتحساب
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
                    title="چرخش ۹۰ درجه (کلید میانبر: R)"
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
                    title="کلون المان (کلید میانبر: Ctrl+D)"
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
                    title="حذف المان (کلید میانبر: Delete)"
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
