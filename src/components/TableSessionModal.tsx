import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Gamepad2,
  Clock,
  Play,
  Pause,
  UtensilsCrossed,
  Trash2,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  Split,
  CheckSquare,
  Square,
  Link2,
  Unlink,
} from 'lucide-react';
import {
  FloorNode,
  MODENDO_FLOOR_NODES,
  TableSession,
  getPs5ElapsedMs,
  formatElapsedTimer,
  calculatePs5ChargeToman,
  getSessionTotalToman,
  getMergedGroupNodeIds,
  getMergedGroupLabel,
} from './FloorPlanCanvas';
import { PosCheckoutView } from './PosCheckoutView';
import { posStore, TENANT_TABLE_CATALOG, usePosStore } from '../store/posStore';
import {
  PosTableItem,
  PosTableSession,
  PosTenantId,
  SplitSettlementReceipt,
} from '../types/pos';
import { OrderItem } from '../types/domain';
import { formatToman, calculateOrderTotals } from '../services/financialMath';
import { playPosBeep } from '../services/soundEffects';

type ModalMode = 'OVERVIEW' | 'TRANSFER' | 'SPLIT_CHECKOUT' | 'SETTLED_RECEIPT';

interface TableSessionModalProps {
  isOpen: boolean;
  node: FloorNode | null;
  session: TableSession | null;
  allSessions?: Record<string, TableSession>;
  nowMs: number;
  onClose: () => void;
  onUpdateSession: (nodeId: string, updater: (prev: TableSession) => TableSession) => void;
  onOpenInPos: (node: FloorNode) => void;
  onReleaseTable: (nodeId: string) => void;
  onMergeTables?: (nodeIds: string[]) => void;
  onUnmergeTables?: (nodeId: string, childToDetach?: string) => void;
  tenantId?: PosTenantId;
  settledByUserId?: string;
  settledByUserName?: string;
}

function resolveTenantId(explicitTenantId: PosTenantId | undefined, nodeId: string): PosTenantId {
  if (explicitTenantId === '100hich' || explicitTenantId === 'modendo') {
    return explicitTenantId;
  }
  const is100HichNode = TENANT_TABLE_CATALOG['100hich'].some((t) => t.tableId === nodeId);
  if (is100HichNode) return '100hich';
  const isModendoNode = TENANT_TABLE_CATALOG.modendo.some((t) => t.tableId === nodeId);
  if (isModendoNode) return 'modendo';
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('smartorders_active_tenant_key_v1');
      if (stored === '100hich' || stored === 'modendo') return stored;
    } catch {
      // Ignore storage read errors
    }
  }
  return 'modendo';
}

function readLocalModendoSessions(): Record<string, TableSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('modendo_table_sessions_v1');
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, TableSession>) : {};
  } catch {
    return {};
  }
}

function toPosItems(items: readonly OrderItem[]): PosTableItem[] {
  return items.map((item) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPriceSnapshotToman: Math.round(item.unitPriceSnapshotToman),
    quantity: Math.round(item.quantity),
    subtotalToman: Math.round(item.subtotalToman),
    notes: item.notes,
    modifiers: item.modifiers?.map((m) => ({
      id: m.id,
      nameFa: m.nameFa,
      priceDeltaToman: Math.round(m.priceDeltaToman),
    })),
  }));
}

function toOrderItems(items: readonly PosTableItem[]): OrderItem[] {
  return items.map((item) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPriceSnapshotToman: item.unitPriceSnapshotToman,
    quantity: item.quantity,
    subtotalToman: item.subtotalToman,
    notes: item.notes,
    modifiers: item.modifiers?.map((m) => ({
      id: m.id,
      nameFa: m.nameFa,
      priceDeltaToman: m.priceDeltaToman,
    })),
  }));
}

export const TableSessionModal: React.FC<TableSessionModalProps> = ({
  isOpen,
  node,
  session,
  allSessions,
  nowMs,
  onClose,
  onUpdateSession,
  onOpenInPos,
  onReleaseTable,
  onMergeTables,
  onUnmergeTables,
  tenantId,
  settledByUserId = 'cashier-active',
  settledByUserName = 'صندوق‌دار شیفت',
}) => {
  const posState = usePosStore();
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [activeMode, setActiveMode] = useState<ModalMode>('OVERVIEW');
  const [selectedItemIds, setSelectedItemIds] = useState<readonly string[]>([]);
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [mergeCandidateId, setMergeCandidateId] = useState<string>('');
  const [transferFeedback, setTransferFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [settledReceipt, setSettledReceipt] = useState<SplitSettlementReceipt | null>(null);

  const resolvedTenantId: PosTenantId = node
    ? resolveTenantId(tenantId, node.id)
    : 'modendo';

  const availableTargets = useMemo(() => {
    if (!node) return [];
    return TENANT_TABLE_CATALOG[resolvedTenantId].filter(
      (t) => t.tableId !== node.id && !allSessions?.[t.tableId]?.mergedIntoNodeId
    );
  }, [resolvedTenantId, node?.id, allSessions]);

  const mergeableCandidates = useMemo(() => {
    if (!node || node.kind !== 'TABLE') return [];
    const currentGroup = allSessions
      ? new Set(getMergedGroupNodeIds(allSessions, node.id))
      : new Set([node.id, ...(session?.mergedNodeIds || [])]);
    return MODENDO_FLOOR_NODES.filter(
      (n) =>
        n.kind === 'TABLE' &&
        !currentGroup.has(n.id) &&
        !allSessions?.[n.id]?.mergedIntoNodeId
    );
  }, [node?.id, node?.kind, allSessions, session?.mergedNodeIds]);

  useEffect(() => {
    setConfirmRelease(false);
    setActiveMode('OVERVIEW');
    setSelectedItemIds([]);
    setTransferFeedback(null);
    setSettledReceipt(null);
    if (node) {
      const firstTarget = TENANT_TABLE_CATALOG[resolveTenantId(tenantId, node.id)].find(
        (t) => t.tableId !== node.id && !allSessions?.[t.tableId]?.mergedIntoNodeId
      );
      setTargetTableId(firstTarget ? firstTarget.tableId : '');
      const firstMerge = MODENDO_FLOOR_NODES.find(
        (n) => n.kind === 'TABLE' && n.id !== node.id && !allSessions?.[n.id]?.mergedIntoNodeId
      );
      setMergeCandidateId(firstMerge ? firstMerge.id : '');
    }
  }, [isOpen, node?.id, tenantId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  const isPs5 = node.kind === 'PS5';
  const guestCount = session?.guestCount ?? node.seats;
  const customerName = session?.customerName ?? '';
  const notes = session?.notes ?? '';
  const items = session?.cartItems ?? [];
  const { grossAmountToman, discountAmountToman, netTotalToman: itemsNetToman } =
    calculateOrderTotals(items, session?.discountToman || 0);
  const ps5FeeToman = session?.ps5Session ? calculatePs5ChargeToman(session.ps5Session, nowMs) : 0;
  const grandTotalToman = getSessionTotalToman(session ?? undefined, nowMs);

  const localFloorSessions = readLocalModendoSessions();
  const storeTenantTables = posState.tenants[resolvedTenantId].tables;

  const mergedChildrenIds = session?.mergedNodeIds || [];
  const mergedDisplayLabel = allSessions
    ? getMergedGroupLabel(allSessions, node.id)
    : mergedChildrenIds.length > 0
    ? [
        node.label,
        ...mergedChildrenIds.map(
          (id) => MODENDO_FLOOR_NODES.find((n) => n.id === id)?.label || id
        ),
      ].join(' + ')
    : node.label;

  const ensureSession = (updater: (prev: TableSession) => TableSession) => {
    onUpdateSession(node.id, updater);
  };

  const syncModalSessionToStore = (): PosTableSession => {
    const posItems = toPosItems(items);
    const snapshot: PosTableSession = {
      tenantId: resolvedTenantId,
      tableId: node.id,
      tableLabel: mergedDisplayLabel,
      status: session?.status ?? 'OCCUPIED',
      guestCount,
      customerName,
      notes,
      openedAt: session?.openedAt ?? new Date().toISOString(),
      items: posItems,
      discountToman: Math.round(discountAmountToman),
      grossAmountToman: Math.round(grossAmountToman),
      netTotalToman: Math.round(itemsNetToman),
      ps5FeeToman: Math.round(ps5FeeToman),
    };
    return posStore.upsertTableSession(snapshot);
  };

  const handleTogglePs5Timer = () => {
    playPosBeep('click');
    ensureSession((prev) => {
      const currentPs5 = prev.ps5Session || {
        startedAt: new Date().toISOString(),
        hourlyRateToman: node.hourlyRateToman || 180000,
        controllersCount: 2,
        isPaused: false,
        accumulatedMs: 0,
      };

      if (currentPs5.isPaused) {
        return {
          ...prev,
          ps5Session: {
            ...currentPs5,
            isPaused: false,
            startedAt: new Date().toISOString(),
          },
        };
      }

      const elapsedSoFar = getPs5ElapsedMs(currentPs5, Date.now());
      return {
        ...prev,
        ps5Session: {
          ...currentPs5,
          isPaused: true,
          pausedAt: new Date().toISOString(),
          accumulatedMs: elapsedSoFar,
        },
      };
    });
  };

  const handleControllerCount = (count: number) => {
    playPosBeep('click');
    ensureSession((prev) => ({
      ...prev,
      ps5Session: {
        ...(prev.ps5Session || {
          startedAt: new Date().toISOString(),
          hourlyRateToman: node.hourlyRateToman || 180000,
          controllersCount: count,
          isPaused: false,
          accumulatedMs: 0,
        }),
        controllersCount: count,
      },
    }));
  };

  const handleToggleItemSelect = (itemId: string) => {
    playPosBeep('click');
    setTransferFeedback(null);
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllItems = () => {
    playPosBeep('click');
    setTransferFeedback(null);
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((i) => i.id));
    }
  };

  const selectedItemsTotalToman = items
    .filter((i) => selectedItemIds.includes(i.id))
    .reduce((sum, i) => sum + Math.round(i.subtotalToman), 0);

  const handleExecuteTransfer = () => {
    if (!targetTableId || selectedItemIds.length === 0) {
      playPosBeep('delete');
      setTransferFeedback({
        type: 'error',
        message: 'میز مقصد و حداقل یک آیتم برای انتقال انتخاب کنید.',
      });
      return;
    }

    // Sync source session & any existing target session in local floor map to posStore first
    syncModalSessionToStore();
    const existingTargetLocal = localFloorSessions[targetTableId];
    if (existingTargetLocal) {
      const targetTotals = calculateOrderTotals(
        existingTargetLocal.cartItems,
        existingTargetLocal.discountToman || 0
      );
      posStore.upsertTableSession({
        tenantId: resolvedTenantId,
        tableId: targetTableId,
        tableLabel: existingTargetLocal.tableLabel,
        status: existingTargetLocal.status,
        guestCount: existingTargetLocal.guestCount,
        customerName: existingTargetLocal.customerName,
        notes: existingTargetLocal.notes,
        openedAt: existingTargetLocal.openedAt,
        items: toPosItems(existingTargetLocal.cartItems),
        discountToman: Math.round(targetTotals.discountAmountToman),
        grossAmountToman: Math.round(targetTotals.grossAmountToman),
        netTotalToman: Math.round(targetTotals.netTotalToman),
        ps5FeeToman: existingTargetLocal.ps5Session
          ? calculatePs5ChargeToman(existingTargetLocal.ps5Session, nowMs)
          : 0,
      });
    }

    const result = posStore.transferTableItems({
      tenantId: resolvedTenantId,
      sourceTableId: node.id,
      targetTableId,
      itemIds: selectedItemIds,
    });

    if (!result.ok || !result.targetSession) {
      playPosBeep('delete');
      setTransferFeedback({
        type: 'error',
        message: result.error || 'انتقال اقلام انجام نشد.',
      });
      return;
    }

    // Mirror atomic result back into FloorPlanView / App session state
    const updatedTargetOrderItems = toOrderItems(result.targetSession.items);
    onUpdateSession(targetTableId, (prev) => ({
      ...prev,
      status: 'OCCUPIED',
      cartItems: updatedTargetOrderItems,
      discountToman: result.targetSession ? result.targetSession.discountToman : prev.discountToman,
    }));

    if (result.sourceSession === null) {
      onReleaseTable(node.id);
    } else if (result.sourceSession) {
      const updatedSourceOrderItems = toOrderItems(result.sourceSession.items);
      const nextSourceDiscount = result.sourceSession.discountToman;
      onUpdateSession(node.id, (prev) => ({
        ...prev,
        cartItems: updatedSourceOrderItems,
        discountToman: nextSourceDiscount,
      }));
    }

    playPosBeep('success');
    const targetDef = availableTargets.find((t) => t.tableId === targetTableId);
    setSelectedItemIds([]);
    setTransferFeedback({
      type: 'success',
      message: `${result.transferredCount} قلم (${formatToman(
        result.transferredAmountToman
      )} تومان) با موفقیت به میز ${targetDef?.label || targetTableId} منتقل شد.`,
    });
  };

  const handleOpenSplitCheckout = () => {
    playPosBeep('click');
    syncModalSessionToStore();
    setActiveMode('SPLIT_CHECKOUT');
  };

  return (
    <div
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl max-h-[90vh] flex flex-col liquid-glass-modal rounded-[28px] overflow-hidden text-right animate-spatial-modal"
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                isPs5
                  ? 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                  : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
              }`}
            >
              {isPs5 ? <Gamepad2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>
                  {mergedChildrenIds.length > 0 ? 'گروه میز ادغام‌شده' : node.titleFa}
                </span>
                <span className="text-white/25">·</span>
                <span className="text-xs font-mono font-bold text-emerald-300 tabular-nums">
                  {mergedDisplayLabel}
                </span>
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                {session
                  ? `باز شده از ${new Date(session.openedAt).toLocaleTimeString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'این میز در حال حاضر آزاد است'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="text-[#94A3B8] hover:text-white p-2 rounded-full hover:bg-white/[0.08] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Overview / Table Transfer / Split-Tender Settlement) */}
        {activeMode !== 'SETTLED_RECEIPT' && (
          <div className="shrink-0 px-6 py-3 bg-black/15 border-b border-white/[0.08]">
            <div className="liquid-glass-rail rounded-full p-1 inline-flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  setActiveMode('OVERVIEW');
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeMode === 'OVERVIEW'
                    ? 'liquid-glass-cta font-black'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                جزئیات میز و تایمر
              </button>

              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => {
                  playPosBeep('click');
                  setTransferFeedback(null);
                  setActiveMode('TRANSFER');
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
                  items.length === 0
                    ? 'text-[#526071] cursor-not-allowed opacity-60'
                    : activeMode === 'TRANSFER'
                    ? 'liquid-glass-cta font-black cursor-pointer'
                    : 'text-[#94A3B8] hover:text-white cursor-pointer'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>انتقال به میز دیگر</span>
                {items.length > 0 && (
                  <span className="text-[11px] font-mono opacity-80 tabular-nums">
                    ({items.length})
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={grandTotalToman <= 0}
                onClick={handleOpenSplitCheckout}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
                  grandTotalToman <= 0
                    ? 'text-[#526071] cursor-not-allowed opacity-60'
                    : activeMode === 'SPLIT_CHECKOUT'
                    ? 'liquid-glass-cta font-black cursor-pointer'
                    : 'text-[#94A3B8] hover:text-white cursor-pointer'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>تسویه ترکیبی</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
          {activeMode === 'OVERVIEW' && (
            <>
              {/* Open Table Status Switcher (Occupied vs Ready for Settlement at Exit) */}
              {session && (
                <div className="rounded-2xl liquid-glass-well p-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#94A3B8]">وضعیت فعلی میز:</span>
                  <div className="liquid-glass-rail rounded-full p-1 inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        ensureSession((prev) => ({ ...prev, status: 'OCCUPIED' }));
                      }}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        session.status !== 'PAYMENT_PENDING'
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-black'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      میز باز (در حال سرویس)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        ensureSession((prev) => ({ ...prev, status: 'PAYMENT_PENDING' }));
                      }}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        session.status === 'PAYMENT_PENDING'
                          ? 'bg-amber-500/25 border border-amber-400/60 text-amber-200 font-black'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      آماده تسویه (هنگام خروج)
                    </button>
                  </div>
                </div>
              )}

              {/* Guest & Customer Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    نام مشتری / میزبان
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) =>
                      ensureSession((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                    placeholder="مثلاً: آقای رضایی..."
                    className="w-full liquid-glass-well focus:border-[#10B981]/60 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-[#526071] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    تعداد نفرات
                  </label>
                  <div className="flex items-center justify-between liquid-glass-well rounded-2xl px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        ensureSession((prev) => ({
                          ...prev,
                          guestCount: Math.max(1, prev.guestCount - 1),
                        }));
                      }}
                      className="w-7 h-7 rounded-full liquid-glass-pill text-white font-black cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-black text-white flex items-center gap-1.5 tabular-nums">
                      <Users className="w-4 h-4 text-[#10B981]" />
                      <span>{guestCount} نفر</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('click');
                        ensureSession((prev) => ({
                          ...prev,
                          guestCount: Math.min(16, prev.guestCount + 1),
                        }));
                      }}
                      className="w-7 h-7 rounded-full liquid-glass-pill text-white font-black cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* PS5 Gaming Booth Controls */}
              {isPs5 && (
                <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] backdrop-blur-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-extrabold text-white">
                        تایمر و تعرفه کنسول PS5
                      </span>
                    </div>
                    <span className="font-mono text-base font-black text-emerald-300 tabular-nums">
                      {session?.ps5Session
                        ? formatElapsedTimer(getPs5ElapsedMs(session.ps5Session, nowMs))
                        : '00:00:00'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#94A3B8]">تعداد دسته:</span>
                      {[2, 3, 4].map((cnt) => {
                        const active = (session?.ps5Session?.controllersCount ?? 2) === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleControllerCount(cnt)}
                            className={`px-3 py-1 rounded-full border font-bold text-xs cursor-pointer transition ${
                              active
                                ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                                : 'liquid-glass-pill text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            {cnt} دسته
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleTogglePs5Timer}
                      className={`px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 cursor-pointer transition ${
                        session?.ps5Session && !session.ps5Session.isPaused
                          ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200'
                          : 'bg-[#10B981]/20 border border-[#10B981]/50 text-emerald-300'
                      }`}
                    >
                      {session?.ps5Session && !session.ps5Session.isPaused ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>توقف موقت تایمر</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>{session?.ps5Session ? 'ادامه تایمر' : 'شروع تایمر بازی'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs">
                    <span className="text-[#94A3B8] tabular-nums">
                      هزینه زمان بازی تا این لحظه ({formatToman(node.hourlyRateToman || 180000)}{' '}
                      ت/ساعت):
                    </span>
                    <span className="font-black text-sky-300 font-mono num-heavy tabular-nums">
                      {formatToman(ps5FeeToman)} تومان
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">یادداشت میز</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => ensureSession((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="توضیحات سفارش یا درخواست مهمان..."
                  className="w-full liquid-glass-well focus:border-[#10B981]/60 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-[#526071] outline-none transition"
                />
              </div>

              {/* Table Merge & Unmerge Controls (Dining Tables) */}
              {!isPs5 && (onMergeTables || onUnmergeTables) && (
                <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.05] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                      <Link2 className="w-4 h-4 text-cyan-300" />
                      <span>ادغام و جداسازی میزها</span>
                    </div>
                    {mergedChildrenIds.length > 0 && onUnmergeTables && (
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          onUnmergeTables(node.id);
                        }}
                        className="px-3 py-1 rounded-full bg-cyan-500/15 hover:bg-rose-500/20 border border-cyan-400/40 hover:border-rose-400/50 text-cyan-200 hover:text-rose-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>جداسازی کامل</span>
                      </button>
                    )}
                  </div>

                  {mergedChildrenIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[11px] font-black">
                        ★ {node.label} (میزبان)
                      </span>
                      {mergedChildrenIds.map((childId) => {
                        const childNode = MODENDO_FLOOR_NODES.find((n) => n.id === childId);
                        return (
                          <div
                            key={childId}
                            className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 text-[11px] font-bold flex items-center gap-1.5"
                          >
                            <span>{childNode?.label || childId}</span>
                            {onUnmergeTables && (
                              <button
                                type="button"
                                onClick={() => {
                                  playPosBeep('click');
                                  onUnmergeTables(node.id, childId);
                                }}
                                title="جداسازی این میز"
                                className="hover:text-rose-300 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {onMergeTables && mergeableCandidates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={mergeCandidateId}
                        onChange={(e) => setMergeCandidateId(e.target.value)}
                        className="flex-1 liquid-glass-well focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        {mergeableCandidates.map((cand) => {
                          const isOcc = Boolean(allSessions?.[cand.id]);
                          return (
                            <option key={cand.id} value={cand.id} className="bg-[#12161d]">
                              {cand.label} — {cand.titleFa} ({isOcc ? 'حساب باز تجمیع می‌شود' : 'آزاد'})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        disabled={!mergeCandidateId}
                        onClick={() => {
                          if (!mergeCandidateId) return;
                          playPosBeep('success');
                          onMergeTables([node.id, mergeCandidateId]);
                        }}
                        className="px-3.5 py-2 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>ادغام با این میز</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Current Tab Summary */}
              <div className="rounded-2xl liquid-glass-well p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8] font-bold">اقلام سفارش باز کافه:</span>
                  <span className="text-white font-bold tabular-nums">
                    {items.length > 0
                      ? `${items.reduce((s, i) => s + i.quantity, 0)} قلم (${formatToman(
                          itemsNetToman
                        )} ت)`
                      : 'هنوز آیتمی ثبت نشده'}
                  </span>
                </div>
                {items.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pt-2 border-t border-white/[0.08] text-[11px]">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-[#CAD5E2]"
                      >
                        <span>
                          {item.quantity} × {item.itemNameSnapshot}
                        </span>
                        <span className="font-mono font-bold tabular-nums">
                          {formatToman(item.subtotalToman)} ت
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.08] text-sm">
                  <span className="font-extrabold text-white">جمع کل حساب باز میز:</span>
                  <span className="font-black text-emerald-300 font-mono num-heavy tabular-nums">
                    {formatToman(grandTotalToman)} تومان
                  </span>
                </div>
              </div>

              {/* Release Confirmation Banner */}
              {confirmRelease && (
                <div className="rounded-2xl bg-rose-950/65 border border-rose-500/45 p-3.5 text-xs text-rose-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>سفارش باز این میز حذف و میز آزاد شود؟</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmRelease(false)}
                      className="px-3 py-1 rounded-full liquid-glass-pill text-[#CBD5E1] cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playPosBeep('delete');
                        onReleaseTable(node.id);
                        onClose();
                      }}
                      className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                    >
                      تایید آزادسازی
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeMode === 'TRANSFER' && (
            <div className="space-y-3.5">
              {/* Item-Level Transfer Selector */}
              <div className="rounded-2xl liquid-glass-well p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white">
                    ۱. انتخاب اقلام جهت انتقال از {node.label}:
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllItems}
                    className="text-[11px] font-bold text-emerald-300 hover:underline cursor-pointer"
                  >
                    {selectedItemIds.length === items.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] py-3 text-center">
                    هیچ آیتمی روی این میز باقی نمانده است.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {items.map((item) => {
                      const checked = selectedItemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleItemSelect(item.id)}
                          className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-right transition cursor-pointer ${
                            checked
                              ? 'liquid-glass-card-active text-white'
                              : 'liquid-glass-card text-[#CAD5E2]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-[#10B981] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-[#94A3B8] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate">
                                {item.quantity} × {item.itemNameSnapshot}
                              </span>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <span className="text-[10px] text-[#94A3B8] block truncate">
                                  {item.modifiers.map((m) => m.nameFa).join('، ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-black text-emerald-300 shrink-0 tabular-nums">
                            {formatToman(item.subtotalToman)} ت
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Target Table Selector */}
              <div className="rounded-2xl liquid-glass-well p-4 space-y-2">
                <label className="block text-xs font-extrabold text-white">
                  ۲. انتخاب میز مقصد (فقط در محدوده {resolvedTenantId === 'modendo' ? 'MODENDO' : '100HICH'}):
                </label>
                <select
                  value={targetTableId}
                  onChange={(e) => {
                    setTargetTableId(e.target.value);
                    setTransferFeedback(null);
                  }}
                  className="w-full liquid-glass-well focus:border-[#10B981] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                >
                  {availableTargets.map((target) => {
                    const isOccupiedInLocal = Boolean(localFloorSessions[target.tableId]);
                    const isOccupiedInStore = Boolean(storeTenantTables[target.tableId]);
                    const occupiedBadge =
                      isOccupiedInLocal || isOccupiedInStore ? 'دارای حساب باز' : 'آزاد';
                    return (
                      <option key={target.tableId} value={target.tableId} className="bg-[#12161d]">
                        {target.label} ({target.zoneLabelFa}) — {occupiedBadge}
                      </option>
                    );
                  })}
                </select>
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-1">
                  <span>جمع اقلام انتخاب‌شده:</span>
                  <span className="font-mono font-black text-white tabular-nums">
                    {selectedItemIds.length} قلم • {formatToman(selectedItemsTotalToman)} تومان
                  </span>
                </div>
              </div>

              {/* Transfer Feedback */}
              {transferFeedback && (
                <div
                  className={`rounded-2xl p-3 text-xs font-bold flex items-center gap-2 border ${
                    transferFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border-[#10B981]/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  }`}
                >
                  {transferFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{transferFeedback.message}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={selectedItemIds.length === 0 || !targetTableId}
                className="w-full py-3 rounded-full liquid-glass-cta disabled:opacity-40 font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>انتقال اتمیک اقلام انتخاب‌شده</span>
              </button>
            </div>
          )}

          {activeMode === 'SPLIT_CHECKOUT' && (
            <PosCheckoutView
              {...({
                tenantId: resolvedTenantId,
                tableId: node.id,
                tableLabel: mergedDisplayLabel,
                itemsNetToman: itemsNetToman,
                ps5FeeToman: ps5FeeToman,
                totalDueToman: grandTotalToman,
                settledByUserId: settledByUserId,
                settledByUserName: settledByUserName,
                onCancel: () => setActiveMode('OVERVIEW'),
                onSettlementSuccess: (receipt: any) => {
                  setSettledReceipt(receipt);
                  setActiveMode('SETTLED_RECEIPT');
                  onReleaseTable(node.id);
                },
              } as any)}
            />
          )}

          {activeMode === 'SETTLED_RECEIPT' && settledReceipt && (
            <div className="rounded-2xl liquid-glass-well border-[#10B981]/40 p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>تسویه ترکیبی با موفقیت ثبت شد و میز آزاد گردید</span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>شناسه رسید:</span>
                <span className="font-mono text-white">{settledReceipt.receiptId}</span>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                {settledReceipt.splits.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="text-[#CAD5E2]">
                      {s.method === 'POS_TERMINAL'
                        ? 'کارت‌خوان (POS)'
                        : s.method === 'CASH'
                        ? 'وجه نقد'
                        : 'کارت به کارت'}
                    </span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {formatToman(s.amountToman)} ت
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-sm font-black">
                <span className="text-white">جمع کل پرداختی:</span>
                <span className="text-emerald-300 font-mono tabular-nums">
                  {formatToman(settledReceipt.totalPaidToman)} تومان
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-full liquid-glass-cta font-black text-xs cursor-pointer"
              >
                بستن و بازگشت به نقشه سالن
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions (shown in Overview mode) */}
        {activeMode === 'OVERVIEW' && (
          <div className="shrink-0 px-6 py-4 bg-black/25 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
            {session ? (
              <button
                type="button"
                onClick={() => {
                  if (items.length === 0 && ps5FeeToman === 0) {
                    playPosBeep('delete');
                    onReleaseTable(node.id);
                    onClose();
                  } else {
                    setConfirmRelease(true);
                  }
                }}
                className="px-3.5 py-2.5 rounded-full liquid-glass-pill hover:border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>آزادسازی میز</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playPosBeep('success');
                  ensureSession((prev) => ({
                    ...prev,
                    status: 'OCCUPIED',
                  }));
                  onClose();
                }}
                className="px-4 py-2.5 rounded-full liquid-glass-pill border border-cyan-400/40 hover:border-cyan-300/70 text-cyan-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Clock className="w-4 h-4 text-cyan-300" />
                <span>ثبت به عنوان میز باز</span>
              </button>
            )}

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              {grandTotalToman > 0 && (
                <button
                  type="button"
                  onClick={handleOpenSplitCheckout}
                  className="px-3.5 py-2.5 rounded-full liquid-glass-pill text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Split className="w-4 h-4" />
                  <span>تسویه ترکیبی</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onClose();
                  onOpenInPos(node);
                }}
                className="px-5 py-2.5 rounded-full liquid-glass-cta font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {items.length > 0 ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>ادامه سفارش در POS</span>
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>ثبت سفارش در صندوق (POS)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
