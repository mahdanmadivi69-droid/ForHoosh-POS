import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  ShoppingBag,
  Gamepad2,
  Map as MapIcon,
  Coffee,
  Sofa,
  Trees,
  X,
  Link2,
  Users,
  ChevronLeft,
  Check,
  LayoutGrid,
  ArrowLeftRight,
} from 'lucide-react';
import {
  FloorPlanCanvas,
  FloorNode,
  FloorZone,
  TableSession,
  MODENDO_FLOOR_NODES,
  getSessionTotalToman,
  resolvePrimaryNodeId,
} from './FloorPlanCanvas';
import { TableSessionModal } from './TableSessionModal';
import { TableEntity } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { CatalogService } from '../../services/catalog/catalogService';
import { openTabService } from '../../services/openTabService';
import { formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';

interface FloorPlanViewProps {
  onBackToPos: () => void;
  onSelectTableForOrder: (tableLabel: string) => void;
  tenantName?: string;
  selectedNodeId?: string | null;
  onBackToHub?: () => void;
}

const STORAGE_KEY_SESSIONS = 'modendo_floor_sessions_v1';

export const FloorPlanView: React.FC<FloorPlanViewProps> = ({
  onBackToPos,
  onSelectTableForOrder,
  selectedNodeId,
  onBackToHub,
}) => {
  const [activeZone, setActiveZone] = useState<FloorZone | 'ALL'>('ALL');
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [modalNode, setModalNode] = useState<FloorNode | null>(null);
  const [modalTableEntity, setModalTableEntity] = useState<TableEntity | null>(null);

  // Table Merge Mode state
  const [mergeMode, setMergeMode] = useState<boolean>(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);

  // Table Move Mode state (Atomic session transfer between tables)
  const [moveMode, setMoveMode] = useState<boolean>(false);
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null);

  // Local table sessions state
  const [sessions, setSessions] = useState<Record<string, TableSession>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSIONS);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Save sessions to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.warn('[FloorPlanView] Could not persist sessions to localStorage:', e);
    }
  }, [sessions]);

  // Live 1s tick for PS5 booths & open table elapsed times
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync open tabs from openTabService / CatalogService
  useEffect(() => {
    const syncOpenTabs = () => {
      try {
        const activeTabs = openTabService.getAllActiveTabs();
        const catalogTabs = CatalogService.getOpenTabs();
        const allTabs = [...activeTabs, ...catalogTabs];

        if (allTabs.length === 0) return;

        setSessions((prev) => {
          let hasChanges = false;
          const next = { ...prev };

          for (const node of MODENDO_FLOOR_NODES) {
            const match = allTabs.find((t: any) => {
              const label = t.table_or_customer || t.tableOrCustomer || t.tableId || '';
              return (
                label === node.label ||
                label === node.id ||
                label.includes(node.label) ||
                (node.tableId && label.includes(node.tableId)) ||
                (node.stationId && label.includes(node.stationId))
              );
            });

            if (match && !next[node.id]) {
              hasChanges = true;
              next[node.id] = {
                nodeId: node.id,
                tableLabel: node.label,
                kind: node.kind,
                status: 'OCCUPIED',
                guestCount: (match as any).guest_count || node.seats,
                customerName: (match as any).customer_name || '',
                notes: '',
                openedAt: (match as any).opened_at || new Date().toISOString(),
                cartItems: (match as any).items || [],
                discountToman: (match as any).discount_toman || 0,
                discountPercent: (match as any).discount_percent || 0,
              };
            }
          }

          return hasChanges ? next : prev;
        });
      } catch (err) {
        console.warn('[FloorPlanView] Error syncing open tabs:', err);
      }
    };

    syncOpenTabs();
    const interval = setInterval(syncOpenTabs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Escape key exits merge mode and move mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mergeMode) {
          setMergeMode(false);
          setMergeSelectedIds([]);
        }
        if (moveMode) {
          setMoveMode(false);
          setMoveSourceId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mergeMode, moveMode]);

  const totalNodes = MODENDO_FLOOR_NODES.length;
  const occupiedCount = Object.keys(sessions).length;
  const freeCount = Math.max(0, totalNodes - occupiedCount);
  const ps5ActiveCount = MODENDO_FLOOR_NODES.filter(
    (n) => n.kind === 'PS5' && Boolean(sessions[n.id])
  ).length;

  const openTabsTotalToman = Object.values(sessions).reduce(
    (sum, s) => sum + (s.mergedIntoNodeId ? 0 : getSessionTotalToman(s, nowMs)),
    0
  );

  const nodeMap = useMemo(
    () => new Map(MODENDO_FLOOR_NODES.map((n) => [n.id, n])),
    []
  );

  const selectedSeatsSum = mergeSelectedIds.reduce(
    (sum, id) => sum + (nodeMap.get(id)?.seats ?? 0),
    0
  );

  // Merge table sessions logic
  const mergeTableSessions = useCallback(
    (rawNodeIds: string[]) => {
      const uniqueIds = Array.from(new Set(rawNodeIds)).filter(
        (id) => nodeMap.get(id)?.kind === 'TABLE'
      );
      if (uniqueIds.length < 2) return;

      const primaryId = resolvePrimaryNodeId(sessions, uniqueIds[0]);
      const childIds = uniqueIds.filter((id) => id !== primaryId);
      const primaryNode = nodeMap.get(primaryId);
      if (!primaryNode || childIds.length === 0) return;

      const aggregatedSeats =
        primaryNode.seats +
        childIds.reduce((sum, cid) => sum + (nodeMap.get(cid)?.seats ?? 0), 0);

      setSessions((prev) => {
        const next = { ...prev };
        const prevHost = next[primaryId] || {
          nodeId: primaryId,
          tableLabel: primaryNode.label,
          kind: primaryNode.kind,
          status: 'OCCUPIED',
          guestCount: primaryNode.seats,
          customerName: '',
          notes: '',
          openedAt: new Date().toISOString(),
          cartItems: [],
          discountToman: 0,
          discountPercent: 0,
        };

        next[primaryId] = {
          ...prevHost,
          mergedIntoNodeId: undefined,
          mergedNodeIds: Array.from(new Set([...(prevHost.mergedNodeIds || []), ...childIds])),
          guestCount: Math.max(prevHost.guestCount, aggregatedSeats),
        };

        for (const childId of childIds) {
          const childNode = nodeMap.get(childId);
          next[childId] = {
            ...(next[childId] || {
              nodeId: childId,
              tableLabel: childNode?.label || childId,
              kind: 'TABLE',
              status: 'OCCUPIED',
              customerName: '',
              notes: '',
              openedAt: new Date().toISOString(),
              discountToman: 0,
              discountPercent: 0,
            }),
            mergedNodeIds: undefined,
            mergedIntoNodeId: primaryId,
            cartItems: [],
            guestCount: 0,
          };
        }

        return next;
      });
    },
    [nodeMap, sessions]
  );

  const separateTableSessions = useCallback(
    (primaryNodeId: string, childToDetach?: string) => {
      setSessions((prev) => {
        const next = { ...prev };
        const host = next[primaryNodeId];
        if (!host) return prev;
        const currentChildren = host.mergedNodeIds || [];

        if (childToDetach && currentChildren.includes(childToDetach)) {
          const remaining = currentChildren.filter((id) => id !== childToDetach);
          next[primaryNodeId] = {
            ...host,
            mergedNodeIds: remaining.length > 0 ? remaining : undefined,
          };
          delete next[childToDetach];
        } else {
          for (const cid of currentChildren) {
            delete next[cid];
          }
          next[primaryNodeId] = {
            ...host,
            mergedNodeIds: undefined,
          };
        }

        return next;
      });
    },
    []
  );

  const handleToggleMergeSelect = (node: FloorNode) => {
    if (node.kind !== 'TABLE') return;
    playPosBeep('click');
    setMergeSelectedIds((prev) =>
      prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
    );
  };

  const handleConfirmMerge = () => {
    if (mergeSelectedIds.length < 2) return;
    playPosBeep('success');
    mergeTableSessions(mergeSelectedIds);
    setMergeMode(false);
    setMergeSelectedIds([]);
  };

  const handleDragMergeTables = (sourceNodeId: string, targetNodeId: string) => {
    if (sourceNodeId === targetNodeId) return;
    playPosBeep('success');
    mergeTableSessions([targetNodeId, sourceNodeId]);
  };

  // Atomic Table Move / Transfer Session
  const handleMoveTableSession = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      if (sourceNodeId === targetNodeId) return;

      const sourceNode = MODENDO_FLOOR_NODES.find(
        (n) => n.id === sourceNodeId || n.label === sourceNodeId
      );
      const targetNode = MODENDO_FLOOR_NODES.find(
        (n) => n.id === targetNodeId || n.label === targetNodeId
      );
      if (!targetNode) return;

      setSessions((prev) => {
        const next = { ...prev };
        const sourceSession = next[sourceNodeId];

        if (!sourceSession) {
          next[targetNode.id] = {
            nodeId: targetNode.id,
            tableLabel: targetNode.label,
            kind: targetNode.kind,
            status: 'OCCUPIED',
            guestCount: targetNode.seats,
            customerName: '',
            notes: '',
            openedAt: new Date().toISOString(),
            cartItems: [],
            discountToman: 0,
            discountPercent: 0,
          };
        } else {
          next[targetNode.id] = {
            ...sourceSession,
            nodeId: targetNode.id,
            tableLabel: targetNode.label,
            kind: targetNode.kind,
            ps5Session:
              targetNode.kind === 'PS5'
                ? sourceSession.ps5Session || {
                    startedAt: sourceSession.openedAt || new Date().toISOString(),
                    hourlyRateToman: targetNode.hourlyRateToman || 180000,
                    controllersCount: 2,
                    accumulatedMs: 0,
                    isPaused: false,
                  }
                : targetNode.kind === 'TABLE'
                ? undefined
                : sourceSession.ps5Session,
          };
          delete next[sourceNodeId];
        }

        try {
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
        } catch (e) {
          console.warn('[FloorPlanView] Failed persisting moved session:', e);
        }

        try {
          const tab =
            openTabService.getTabForTable(sourceNodeId, 'tenant-modendo-01') ||
            openTabService.getTabForTable(sourceNode?.label || sourceNodeId, 'tenant-modendo-01');
          if (tab) {
            openTabService.transferTab(
              tab.tab_id,
              targetNode.id,
              targetNode.label,
              'tenant-modendo-01'
            );
          }
        } catch (e) {
          console.warn('[FloorPlanView] Failed transferring openTab:', e);
        }

        playPosBeep('success');
        return next;
      });
    },
    []
  );

  const handleNodeClick = (node: FloorNode) => {
    if (moveMode) {
      const isOccupied = Boolean(sessions[node.id]);
      if (!moveSourceId) {
        if (!isOccupied) {
          alert('میز انتخابی آزاد است. لطفاً یک میز فعال/اشغال را به عنوان مبدأ انتخاب کنید.');
          return;
        }
        playPosBeep('click');
        setMoveSourceId(node.id);
      } else {
        if (node.id === moveSourceId) {
          setMoveSourceId(null);
          return;
        }
        if (isOccupied) {
          alert('میز مقصد در حال حاضر فعال است. لطفاً یک میز آزاد انتخاب کنید.');
          return;
        }
        handleMoveTableSession(moveSourceId, node.id);
        setMoveMode(false);
        setMoveSourceId(null);
      }
      return;
    }

    if (mergeMode) {
      handleToggleMergeSelect(node);
      return;
    }

    onSelectTableForOrder(node.label);
  };

  const handleOpenTableModal = (node: FloorNode) => {
    setModalNode(node);
    // Find or construct TableEntity for TableSessionModal
    const existing = floorPlanService.getTableById(node.id) || floorPlanService.getTableById(node.tableId || '');
    if (existing) {
      setModalTableEntity(existing);
    } else {
      const mockEntity: TableEntity = {
        id: node.id,
        display_name: node.label,
        zone_id: node.zone.toLowerCase(),
        level: node.zone === 'LOUNGE' || node.zone === 'PS_ROOM' ? 0 : 1,
        billing_mode: node.kind === 'PS5' ? 'hourly_timer' : 'standard_table',
        capacity: { nominal: node.seats, max: node.seats + 2 },
        geometry: { x: 0, y: 0, width: 80, height: 80, rotation: 0 },
        capabilities: {
          game_timer: node.kind === 'PS5',
          token_required: node.zone === 'LOUNGE',
          mergeable: node.kind === 'TABLE',
        },
        status: sessions[node.id] ? 'OCCUPIED' : 'AVAILABLE',
        pricing_tier_id: node.kind === 'PS5' ? 'tier_ps5_standard' : undefined,
      };
      setModalTableEntity(mockEntity);
    }
  };

  const zoneTabs: Array<{ id: FloorZone | 'ALL'; label: string; icon: React.ReactNode }> = [
    { id: 'ALL', label: 'همه سالن', icon: <MapIcon className="w-3.5 h-3.5" /> },
    { id: 'MAIN_HALL', label: 'سالن اصلی', icon: <Coffee className="w-3.5 h-3.5" /> },
    { id: 'LOUNGE', label: 'لانژ و PS5', icon: <Sofa className="w-3.5 h-3.5" /> },
    { id: 'TERRACE', label: 'تراس', icon: <Trees className="w-3.5 h-3.5" /> },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div
        dir="rtl"
        className="flex-1 flex flex-col gap-3 p-3 md:p-5 max-w-[1720px] mx-auto w-full select-none"
      >
        {/* =========================================================================
            Single Streamlined Liquid Glass Top Toolbar
            - Zone Filters (ALL, MAIN_HALL, LOUNGE, TERRACE)
            - Inline Summary (Free, Occupied, Consoles)
            - Merge Tables Button (ادغام میزها)
            - Takeaway Button (سفارش بیرون‌بر)
            - Back to POS Button (بازگشت به صندوق)
           ========================================================================= */}
        <div className="rounded-[22px] liquid-glass-shell p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg border border-white/10">
          {/* Zone Filters */}
          <div className="liquid-glass-rail rounded-full p-1 flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
            {zoneTabs.map((tab) => {
              const isActive = activeZone === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setActiveZone(tab.id);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.16] text-white font-black border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <span className={isActive ? 'text-[#10B981]' : ''}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Inline Live Operational Summary */}
          <div className="flex items-center gap-3 text-xs text-[#94A3B8] px-2 tabular-nums">
            <div className="flex items-center gap-1.5">
              <strong className="text-white font-mono font-bold text-sm">{freeCount}</strong>
              <span className="text-[#94A3B8]">آزاد</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-1.5">
              <strong className="text-[#10B981] font-mono font-bold text-sm">{occupiedCount}</strong>
              <span className="text-emerald-400/90 font-medium">فعال</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-1.5">
              <strong className="text-sky-400 font-mono font-bold text-sm">{ps5ActiveCount}</strong>
              <span className="text-sky-400/90 font-medium">کنسول</span>
            </div>
            {openTabsTotalToman > 0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-1.5 font-mono text-emerald-300 font-bold">
                  <span>{formatToman(openTabsTotalToman)} ت</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons: Merge Tables + Takeaway + Back to POS */}
          <div className="flex items-center gap-2 mr-auto">
            {/* Merge Tables Button */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setMoveMode(false);
                setMoveSourceId(null);
                setMergeMode((prev) => {
                  if (prev) setMergeSelectedIds([]);
                  return !prev;
                });
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                mergeMode
                  ? 'bg-cyan-500/20 border border-cyan-300/70 text-cyan-200 shadow-[0_0_20px_-4px_rgba(34,211,238,0.55)]'
                  : 'liquid-glass-pill text-cyan-200 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>{mergeMode ? 'لغو ادغام' : 'ادغام میزها'}</span>
            </button>

            {/* Move Table Button */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setMergeMode(false);
                setMergeSelectedIds([]);
                setMoveMode((prev) => {
                  if (prev) setMoveSourceId(null);
                  return !prev;
                });
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                moveMode
                  ? 'bg-amber-500/20 border border-amber-300/70 text-amber-200 shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]'
                  : 'liquid-glass-pill text-amber-200 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
              <span>{moveMode ? 'لغو جابجایی' : 'جابجایی میز'}</span>
            </button>

            {/* Takeaway Order Button */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                onSelectTableForOrder('بیرون‌بر');
              }}
              className="liquid-glass-cta rounded-full px-4 py-2 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>سفارش بیرون‌بر</span>
            </button>

            {/* Back to Hub Button */}
            {onBackToHub && (
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onBackToHub();
                }}
                className="liquid-glass-pill rounded-full px-3.5 py-2 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 text-[#cbd5e1] hover:text-white"
                title="مرکز عملیات و ماژول‌ها"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#10B981]" />
                <span>ماژول‌ها</span>
              </button>
            )}

            {/* Back to POS Button */}
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                onBackToPos();
              }}
              className="px-4 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>صندوق</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Merge Toolbar (Active during Merge Mode) */}
        <AnimatePresence>
          {mergeMode && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="rounded-[20px] bg-gradient-to-l from-cyan-950/80 via-[#131d27]/90 to-emerald-950/80 backdrop-blur-2xl border border-cyan-400/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_18px_40px_-14px_rgba(34,211,238,0.35)]"
            >
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-black text-cyan-200 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-cyan-300" />
                  <span>میزهای انتخابی برای ادغام:</span>
                </span>

                {mergeSelectedIds.length === 0 ? (
                  <span className="text-[#cbd5e1]">
                    حداقل ۲ میز را لمس کنید یا مستقیماً روی یکدیگر بکشید و رها کنید.
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {mergeSelectedIds.map((id, idx) => {
                      const n = nodeMap.get(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => n && handleToggleMergeSelect(n)}
                          className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-300/60 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/20 hover:border-rose-400/60 transition"
                        >
                          {idx === 0 && <span className="text-amber-300">★</span>}
                          <span>{n?.label || id}</span>
                          <X className="w-3 h-3 opacity-75" />
                        </button>
                      );
                    })}
                    <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1 mr-2 tabular-nums">
                      <Users className="w-3.5 h-3.5" />
                      <span>ظرفیت کل: {selectedSeatsSum} نفر</span>
                    </span>
                  </div>
                )}
              </div>

              {mergeSelectedIds.length >= 2 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmMerge}
                    className="px-4 py-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-[0_0_22px_rgba(34,211,238,0.6)] cursor-pointer transition"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>تایید ادغام ({mergeSelectedIds.length} میز)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMergeSelectedIds([]);
                      setMergeMode(false);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Move Toolbar (Active during Move Mode) */}
        <AnimatePresence>
          {moveMode && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              className="p-3 px-5 rounded-2xl liquid-glass-shell border border-amber-400/40 bg-[#161D26]/95 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 text-amber-200">
                <ArrowLeftRight className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="font-bold">حالت جابجایی میز فعال است:</span>
                <span className="text-[#94A3B8]">
                  {!moveSourceId
                    ? 'ابتدا روی میز مبدأ (فعال/اشغال) کلیک کنید'
                    : `میز مبدأ: ${nodeMap.get(moveSourceId)?.label || moveSourceId} — حال روی میز مقصد آزاد کلیک کنید`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {moveSourceId && (
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setMoveSourceId(null);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs text-[#94A3B8] hover:text-white border border-white/10 cursor-pointer"
                  >
                    تغییر میز مبدأ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setMoveMode(false);
                    setMoveSourceId(null);
                  }}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300 hover:text-white bg-amber-500/20 border border-amber-400/30 cursor-pointer"
                >
                  انصراف و خروج
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3-Wing Floor Plan Canvas Container */}
        <div className="flex-1 w-full overflow-hidden">
          <FloorPlanCanvas
            nodes={MODENDO_FLOOR_NODES}
            sessions={sessions}
            activeZone={activeZone}
            selectedNodeId={selectedNodeId}
            nowMs={nowMs}
            mergeMode={mergeMode}
            mergeSelectedIds={mergeSelectedIds}
            moveMode={moveMode}
            moveSourceId={moveSourceId}
            onToggleMergeSelect={handleToggleMergeSelect}
            onDragMergeTables={handleDragMergeTables}
            onUnmergeGroup={separateTableSessions}
            onSelectNode={handleNodeClick}
            onInspectNode={handleOpenTableModal}
            onOpenSessionModal={handleOpenTableModal}
            onConfirmTableOrder={(node) => {
              onSelectTableForOrder(node.label || node.display_name);
            }}
          />
        </div>

        {/* Table Session Modal (for Timer / PS5 / Settle / Transfer) */}
        {modalTableEntity && (
          <TableSessionModal
            table={modalTableEntity}
            isOpen={Boolean(modalTableEntity)}
            onClose={() => {
              setModalTableEntity(null);
              setModalNode(null);
            }}
            onSelectForPosOrder={(label) => {
              setModalTableEntity(null);
              setModalNode(null);
              onSelectTableForOrder(label);
            }}
            onMoveTableSession={handleMoveTableSession}
            availableNodes={MODENDO_FLOOR_NODES}
            occupiedNodeIds={Object.keys(sessions)}
          />
        )}
      </div>
    </MotionConfig>
  );
};
export default FloorPlanView;
