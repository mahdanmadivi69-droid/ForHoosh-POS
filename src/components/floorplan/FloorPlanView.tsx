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
  Store,
  CreditCard,
  Search,
  Play,
  Trash2,
  Plus,
  UtensilsCrossed,
  Receipt,
  DollarSign,
  Armchair,
  User,
  Phone,
  FileText,
  Clock,
} from 'lucide-react';
import {
  FloorPlanCanvas,
  FloorNode,
  FloorZone,
  TableSession,
  MODENDO_FLOOR_NODES,
  getSessionTotalToman,
  calculatePs5ChargeToman,
  computeSettlementLineItems,
  hasGamingPackage,
  resolvePrimaryNodeId,
  is100HichNode,
  formatElapsedTimer,
  getDisplayShortLabel,
  resolveNodeSession,
  normalizeNodeKey,
} from './FloorPlanCanvas';
import { TableSessionModal } from './TableSessionModal';
import { TableEntity } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { CatalogService } from '../../services/catalog/catalogService';
import { openTabService } from '../../services/openTabService';
import { formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { useStaffAuthStore } from '../../stores/useStaffAuthStore';
import { OrderItem } from '../../types/domain';
import { FloorSettleModal } from './FloorSettleModal';
import { OpenTabsModal } from '../modals/OpenTabsModal';
import { printThermalReceipt } from '../../services/receiptPrinter';
import { LiquidSurface } from '../liquid/LiquidSurface';

interface FloorPlanViewProps {
  onBackToPos: () => void;
  onSelectTableForOrder: (tableLabel: string) => void;
  tenantName?: string;
  selectedNodeId?: string | null;
  onBackToHub?: () => void;
  tenant?: any;
  activeShift?: any;
  activeUser?: any;
  onOrderCompleted?: (
    order: any,
    paymentMethod: any,
    referenceCode?: string,
    terminalName?: string
  ) => any;
}

const STORAGE_KEY_SESSIONS = 'cafeos_modendo_floor_sessions_v2';

export const FloorPlanView: React.FC<FloorPlanViewProps> = ({
  onBackToPos,
  onSelectTableForOrder,
  selectedNodeId,
  onBackToHub,
  tenant,
  activeShift,
  activeUser,
  onOrderCompleted,
}) => {
  const [activeZone, setActiveZone] = useState<FloorZone | 'ALL'>('ALL');
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [modalNode, setModalNode] = useState<FloorNode | null>(null);
  const [modalTableEntity, setModalTableEntity] = useState<TableEntity | null>(null);
  const [selectedTableNodeId, setSelectedTableNodeId] = useState<string>(selectedNodeId || 'M-01');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const canSettle = useStaffAuthStore((s) => s.canAccess('settle'));
  const [isTabsModalOpen, setIsTabsModalOpen] = useState<boolean>(false);
  const [draftCustomerName, setDraftCustomerName] = useState<string>('');
  const [draftNotes, setDraftNotes] = useState<string>('');

  // Table Merge Mode state
  const [mergeMode, setMergeMode] = useState<boolean>(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);

  // Table Move Mode state (Atomic session transfer between tables)
  const [moveMode, setMoveMode] = useState<boolean>(false);
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null);

  // Local table sessions state (Strict Modendo tenant isolation)
  const [sessions, setSessions] = useState<Record<string, TableSession>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (stored) {
        const parsed: Record<string, TableSession> = JSON.parse(stored);
        const clean: Record<string, TableSession> = {};
        for (const [key, val] of Object.entries(parsed)) {
          if (!is100HichNode(key) && !is100HichNode(val.tableLabel)) {
            clean[key] = val;
          }
        }
        return clean;
      }
      return {};
    } catch {
      return {};
    }
  });

  // Reload floor plan for active Modendo tenant on mount & purge legacy cached session keys
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('cafeos_modendo_floor_sessions_v1');
        localStorage.removeItem('cafeos_floor_sessions');
      }
      floorPlanService.reloadForTenant();
    } catch (e) {
      console.warn('[FloorPlanView] Failed reloading floor plan:', e);
    }
  }, []);

  // Live event listener for floor sessions synchronization
  useEffect(() => {
    const handleSessionsChanged = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_SESSIONS);
        if (stored) {
          const parsed: Record<string, TableSession> = JSON.parse(stored);
          const clean: Record<string, TableSession> = {};
          for (const [key, val] of Object.entries(parsed)) {
            if (!is100HichNode(key) && !is100HichNode(val.tableLabel)) {
              clean[key] = val;
            }
          }
          setSessions(clean);
        }
      } catch (e) {
        console.warn('[FloorPlanView] Failed reloading floor sessions on event:', e);
      }
    };
    window.addEventListener('cafeos_floor_sessions_changed', handleSessionsChanged);
    window.addEventListener('storage', handleSessionsChanged);
    return () => {
      window.removeEventListener('cafeos_floor_sessions_changed', handleSessionsChanged);
      window.removeEventListener('storage', handleSessionsChanged);
    };
  }, []);

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

  // Sync open tabs from openTabService / CatalogService (Scoped to Modendo)
  useEffect(() => {
    const syncOpenTabs = () => {
      try {
        const activeTabs = openTabService.getAllActiveTabs('tenant-modendo-01');
        const catalogTabs = CatalogService.getOpenTabs('tenant-modendo-01');
        const allTabs = [...activeTabs, ...catalogTabs];

        if (allTabs.length === 0) return;

        setSessions((prev) => {
          let hasChanges = false;
          const next = { ...prev };

          for (const node of MODENDO_FLOOR_NODES) {
            const match = allTabs.find((t: any) => {
              const label = t.table_or_customer || t.tableOrCustomer || t.tableId || '';
              if (is100HichNode(label)) return false;
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
              const flatItems: any[] = ((match as any).rounds || []).flatMap((r: any) =>
                (r.items || []).map((it: any) => ({
                  id: it.id,
                  menuItemId: it.menuItemId,
                  itemNameSnapshot: it.title || it.itemNameSnapshot || 'آیتم',
                  unitPriceSnapshotToman: Number(it.unitPrice ?? it.unitPriceSnapshotToman ?? 0),
                  subtotalToman: Number(it.subtotal ?? it.subtotalToman ?? 0),
                  quantity: Number(it.quantity ?? 1),
                  notes: it.notes,
                }))
              );
              if (flatItems.length === 0 && (match as any).items?.length) {
                for (const it of (match as any).items) {
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
              next[node.id] = {
                nodeId: node.id,
                tableLabel: node.label,
                kind: node.kind,
                status: 'OCCUPIED',
                guestCount: (match as any).guest_count || node.seats,
                customerName: (match as any).customer_name || ((match as any).server_name !== 'صندوق‌دار' ? (match as any).server_name : ''),
                notes: (match as any).notes || '',
                openedAt: (match as any).opened_at || new Date().toISOString(),
                cartItems: flatItems,
                discountToman: (match as any).discount_toman || (match as any).discount || 0,
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
    setSelectedTableNodeId(node.id);

    // Auto-resolve session using unified resolver and ensure write-through sync if discovered from tabs
    const resolved = resolveNodeSession(node, sessions, 'tenant-modendo-01');
    if (resolved && !sessions[node.id]) {
      setSessions((prev) => {
        const next = { ...prev, [node.id]: resolved };
        try {
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
          window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: next }));
        } catch (e) {
          console.warn('[FloorPlanView] Failed persisting resolved session:', e);
        }
        return next;
      });
    }

    if (moveMode) {
      const isOccupied = Boolean(sessions[node.id] || resolved);
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

    // On smaller screens where sidebar is hidden, route directly to POS
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      handleTransitionToPos(node);
    }
  };

  const handleOpenTableModal = (node: FloorNode) => {
    setModalNode(node);

    // Auto-resolve session using unified resolver and ensure write-through sync if discovered from tabs
    const resolved = resolveNodeSession(node, sessions, 'tenant-modendo-01');
    if (resolved && !sessions[node.id]) {
      setSessions((prev) => {
        const next = { ...prev, [node.id]: resolved };
        try {
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
          window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: next }));
        } catch (e) {
          console.warn('[FloorPlanView] Failed persisting resolved session:', e);
        }
        return next;
      });
    }

    // Find or construct TableEntity for TableSessionModal
    const existing = floorPlanService.getTableById(node.id) || floorPlanService.getTableById(node.tableId || '');
    if (existing) {
      setModalTableEntity(existing);
    } else {
      const mockEntity: TableEntity = {
        id: node.id,
        display_name: node.label,
        zone_id: node.zone.toLowerCase() as TableEntity['zone_id'],
        level: node.zone === 'LOUNGE' || node.zone === 'PS_ROOM' ? 0 : 1,
        billing_mode: node.kind === 'PS5' ? 'hourly_timer' : 'standard_table',
        capacity: { nominal: node.seats, max: node.seats + 2 },
        geometry: { x: 0, y: 0, width: 80, height: 80, rotation: 0 },
        capabilities: {
          game_timer: node.kind === 'PS5',
          token_required: node.zone === 'LOUNGE',
          mergeable: node.kind === 'TABLE',
        },
        status: (sessions[node.id] || resolved) ? 'OCCUPIED' : 'AVAILABLE',
        pricing_tier_id: node.kind === 'PS5' ? 'tier_ps5_standard' : undefined,
      };
      setModalTableEntity(mockEntity);
    }
  };

  // Quick accept table (Start session + live timer)
  const handleQuickAcceptTable = (node: FloorNode) => {
    playPosBeep('success');
    const nowIso = new Date().toISOString();
    setSessions((prev) => {
      const next = { ...prev };
      next[node.id] = {
        nodeId: node.id,
        tableLabel: node.label,
        kind: node.kind,
        status: 'OCCUPIED',
        guestCount: node.seats,
        customerName: draftCustomerName || '',
        notes: draftNotes || '',
        openedAt: nowIso,
        cartItems: [],
        discountToman: 0,
        discountPercent: 0,
        ps5Session:
          node.kind === 'PS5'
            ? {
                startedAt: nowIso,
                hourlyRateToman: node.hourlyRateToman || 180000,
                controllersCount: 2,
                accumulatedMs: 0,
                isPaused: false,
              }
            : undefined,
      };
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: next }));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Live update customer details / session notes
  const handleUpdateActiveSession = (patch: Partial<TableSession>) => {
    setSessions((prev) => {
      const next = { ...prev };
      const current = next[selectedNode.id] || {
        nodeId: selectedNode.id,
        tableLabel: selectedNode.label,
        kind: selectedNode.kind,
        status: 'OCCUPIED',
        guestCount: selectedNode.seats,
        openedAt: new Date().toISOString(),
        cartItems: [],
        discountToman: 0,
        discountPercent: 0,
      };
      next[selectedNode.id] = { ...current, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: next }));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Clear / vacate table
  const handleReleaseTable = (nodeId: string) => {
    if (confirm(`آیا از آزادسازی و تخلیه میز ${selectedNode.label} اطمینان دارید؟`)) {
      playPosBeep('delete');

      // Cancel/void open tab in openTabService if present to prevent ghost tab revival
      try {
        const short = getDisplayShortLabel(selectedNode);
        const targetTab =
          openTabService.getTabForTable(selectedNode.label, 'tenant-modendo-01') ||
          openTabService.getTabForTable(nodeId, 'tenant-modendo-01') ||
          (selectedNode.tableId ? openTabService.getTabForTable(selectedNode.tableId, 'tenant-modendo-01') : undefined) ||
          openTabService.getTabForTable(short, 'tenant-modendo-01');
        if (targetTab) {
          openTabService.voidTab(targetTab.tab_id, 'tenant-modendo-01');
        }
      } catch (e) {
        console.warn('[FloorPlanView] voidTab on release failed:', e);
      }

      setSessions((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        delete next[selectedNode.id];
        delete next[selectedNode.label];
        if (selectedNode.tableId) delete next[selectedNode.tableId];
        for (const [k, v] of Object.entries(next)) {
          if (v && (v.nodeId === selectedNode.id || v.tableLabel === selectedNode.label)) {
            delete next[k];
          }
        }
        try {
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
          window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: next }));
        } catch (e) {
          console.warn(e);
        }
        return next;
      });
    }
  };

  // Direct settlement from FloorPlan side panel (Full payment method + Split-bill + Receipt Preview support)
  const handleSettleFromSidePanel = (paymentData: {
    paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
    terminalName: string;
    referenceCode?: string;
    cashTendered?: number;
    splitCount?: number;
    splitAmountPerPerson?: number;
  }) => {
    if (!activeShift) {
      alert('شیفت کاری فعال نیست. لطفاً ابتدا شیفت را باز کنید.');
      return;
    }

    const settlement = computeSettlementLineItems(
      activeTableSession?.cartItems || [],
      activeTableSession?.ps5Session,
      selectedNode,
      activeTableSession?.discountToman || 0,
      Date.now()
    );
    const items = settlement.items;
    const grossAmount = settlement.grossTotalToman;
    const discountAmount = settlement.discountToman;
    const finalAmount = settlement.payableToman;
    const ps5Fee = settlement.ps5Fee;

    const splitNote =
      paymentData.paymentMethod === 'SPLIT'
        ? `تسویه دنگی (${paymentData.splitCount} نفر، هر نفر ${formatToman(paymentData.splitAmountPerPerson || 0)} تومان)`
        : undefined;

    if (onOrderCompleted) {
      const orderPayload: any = {
        tenantId: activeShift.tenantId,
        shiftId: activeShift.id,
        createdByUserId: activeUser?.id || 'cashier',
        createdByUserName: activeUser?.fullName || 'صندوق‌دار',
        orderNumber: 0,
        orderType: 'DINE_IN',
        tableLabel: selectedNode.label,
        customerName: activeTableSession?.customerName || undefined,
        notes: splitNote ? (activeTableSession?.notes ? `${activeTableSession.notes} • ${splitNote}` : splitNote) : activeTableSession?.notes || undefined,
        status: 'COMPLETED',
        items,
        grossAmountToman: grossAmount,
        discountAmountToman: discountAmount,
        netTotalToman: finalAmount,
      };

      const pMethod = paymentData.paymentMethod === 'SPLIT' ? 'SPLIT' : paymentData.paymentMethod;
      const result = onOrderCompleted(orderPayload, pMethod as any, paymentData.referenceCode || '', paymentData.terminalName || 'صندوق سالن');
      if (result) {
        playPosBeep('success');

        // Print thermal receipt automatically on settlement
        try {
          printThermalReceipt({
            invoiceNo: Math.floor(1000 + Math.random() * 9000),
            dateTime: new Date().toISOString(),
            orderType: 'سالن (Dine-In)',
            cashier: activeUser?.fullName || 'صندوق‌دار',
            customerName: activeTableSession?.customerName || `میز ${selectedNode.label}`,
            tableLabel: selectedNode.label,
            items: items.map((it: any) => ({
              name: it.itemNameSnapshot,
              qty: it.quantity || 1,
              price: it.unitPriceSnapshotToman || it.subtotalToman || 0,
              modifiers: it.modifiers?.map((m: any) => m.nameFa || m.name),
              notes: it.notes,
            })),
            subtotalAmount: grossAmount,
            discountAmount: discountAmount,
            totalAmount: finalAmount,
            paymentMethod:
              paymentData.paymentMethod === 'CASH'
                ? 'نقدی'
                : paymentData.paymentMethod === 'CARD'
                ? paymentData.terminalName
                : `به ایرانی / دنگی (${paymentData.splitCount} نفر - سهم هر نفر ${formatToman(paymentData.splitAmountPerPerson || 0)} تومان)`,
            referenceCode: paymentData.referenceCode,
            cashTendered: paymentData.cashTendered,
            changeDue: paymentData.cashTendered ? Math.max(0, paymentData.cashTendered - finalAmount) : undefined,
          });
        } catch (printErr) {
          console.warn('[FloorPlanView] Thermal print failed:', printErr);
        }

        // Settle open tab in openTabService to eradicate ghost tab resurrection
        try {
          const short = getDisplayShortLabel(selectedNode);
          const targetTab =
            openTabService.getTabForTable(selectedNode.label, 'tenant-modendo-01') ||
            openTabService.getTabForTable(selectedNode.id, 'tenant-modendo-01') ||
            (selectedNode.tableId ? openTabService.getTabForTable(selectedNode.tableId, 'tenant-modendo-01') : undefined) ||
            openTabService.getTabForTable(short, 'tenant-modendo-01');
          if (targetTab) {
            openTabService.settleTab(
              targetTab.tab_id,
              {
                paymentMethod: paymentData.paymentMethod === 'CASH' ? 'CASH' : paymentData.paymentMethod === 'SPLIT' ? 'SPLIT' : 'CARD',
                referenceCode: paymentData.referenceCode || '',
                sessionChargeToman: ps5Fee,
              },
              'tenant-modendo-01'
            );
          }
        } catch (e) {
          console.warn('[FloorPlanView] settleTab error:', e);
        }

        setSessions((prev) => {
          const next = { ...prev };
          delete next[selectedNode.id];
          delete next[selectedNode.label];
          if (selectedNode.tableId) delete next[selectedNode.tableId];
          for (const [k, v] of Object.entries(next)) {
            if (v && (v.nodeId === selectedNode.id || v.tableLabel === selectedNode.label)) {
              delete next[k];
            }
          }
          try {
            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('cafeos_floor_sessions_changed', { detail: next }));
          } catch (e) {
            console.warn(e);
          }
          return next;
        });
        setIsSettleModalOpen(false);
      }
    } else {
      handleTransitionToPos(selectedNode);
    }
  };

  // Print Proforma Receipt
  const handlePrintProforma = () => {
    try {
      playPosBeep('click');
      const settlement = computeSettlementLineItems(
        activeTableSession?.cartItems || [],
        activeTableSession?.ps5Session,
        selectedNode,
        activeTableSession?.discountToman || 0,
        Date.now()
      );
      const items = settlement.items;
      const gross = settlement.grossTotalToman;
      const discount = settlement.discountToman;
      const finalAmount = settlement.payableToman;

      printThermalReceipt({
        invoiceNo: 'پیش‌فاکتور',
        dateTime: new Date().toISOString(),
        orderType: 'پیش‌فاکتور سالن',
        cashier: activeUser?.fullName || 'صندوق‌دار',
        customerName: activeTableSession?.customerName || `میز ${selectedNode.label}`,
        tableLabel: selectedNode.label,
        items: items.map((it: any) => ({
          name: it.itemNameSnapshot,
          qty: it.quantity || 1,
          price: it.unitPriceSnapshotToman || it.subtotalToman || 0,
        })),
        subtotalAmount: gross,
        discountAmount: discount,
        totalAmount: finalAmount,
        paymentMethod: 'پیش‌فاکتور (تسویه نشده)',
      });
    } catch (e) {
      console.warn('[FloorPlanView] Proforma print error:', e);
    }
  };

  // Transition to POS view with synthesized PS5 fee line item injected
  const handleTransitionToPos = (nodeOrLabel: FloorNode | string) => {
    playPosBeep('click');
    const node =
      typeof nodeOrLabel === 'string'
        ? MODENDO_FLOOR_NODES.find((n) => n.label === nodeOrLabel || n.id === nodeOrLabel)
        : nodeOrLabel;

    if (node) {
      let session = sessions[node.id];
      if (!session) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
          if (raw) {
            const parsed = JSON.parse(raw);
            session = parsed[node.id];
          }
        } catch {
          // ignore
        }
      }

      const ps5Session =
        session?.ps5Session ||
        (node.kind === 'PS5' && session
          ? {
              startedAt: session.openedAt || new Date().toISOString(),
              hourlyRateToman: node.hourlyRateToman || 180000,
              controllersCount: 2,
              accumulatedMs: 0,
              isPaused: false,
            }
          : undefined);

      if (session && ps5Session) {
        const rawItems = session.cartItems || [];
        const baseItems = rawItems.filter((it) => {
          if (it.menuItemId === 'modendo-ps5-charge' || it.id?.startsWith('ps5-hourly-')) {
            return false;
          }
          const name = (it.itemNameSnapshot || (it as any).name || '').trim();
          if (name.includes('تعرفه بازی') && ((it.unitPriceSnapshotToman || (it as any).price || 0) < 50000)) {
            return false;
          }
          return true;
        });

        // TASK 2: Prevent Double-Charging via Comprehensive Gaming Package Check
        const hasPackage = hasGamingPackage(baseItems);
        const ps5Fee = hasPackage ? 0 : calculatePs5ChargeToman(ps5Session, Date.now());

        const updatedCartItems = [...baseItems];
        if (ps5Fee > 0) {
          const ps5Item: OrderItem = {
            id: `ps5-hourly-${node.id}-${Date.now()}`,
            menuItemId: 'modendo-ps5-charge',
            itemNameSnapshot: `تعرفه بازی PS5 (${node.label})`,
            unitPriceSnapshotToman: ps5Fee,
            quantity: 1,
            subtotalToman: ps5Fee,
            notes: 'شارژ زمانی بازی کنسول',
          };
          updatedCartItems.unshift(ps5Item);
        }

        const updatedSessions: Record<string, TableSession> = {
          ...sessions,
          [node.id]: {
            ...session,
            ps5Session,
            cartItems: updatedCartItems,
          },
        };
        try {
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
          window.dispatchEvent(
            new CustomEvent('cafeos_floor_sessions_changed', { detail: updatedSessions })
          );
        } catch (e) {
          console.warn('[FloorPlanView] Error saving PS5 fee to session:', e);
        }
      }
      onSelectTableForOrder(node.label);
    } else {
      onSelectTableForOrder(typeof nodeOrLabel === 'string' ? nodeOrLabel : 'بیرون‌بر');
    }
  };

  const selectedNode = useMemo(() => {
    return MODENDO_FLOOR_NODES.find((n) => n.id === selectedTableNodeId) || MODENDO_FLOOR_NODES[0];
  }, [selectedTableNodeId]);

  const activeTableSession = resolveNodeSession(selectedNode, sessions, 'tenant-modendo-01');
  const sessionTotal = getSessionTotalToman(activeTableSession, nowMs);

  const zoneTabs: Array<{ id: FloorZone | 'ALL'; label: string; icon: React.ReactNode }> = [
    { id: 'ALL', label: 'همه سالن', icon: <MapIcon className="w-3.5 h-3.5" /> },
    { id: 'MAIN_HALL', label: 'سالن اصلی', icon: <Coffee className="w-3.5 h-3.5" /> },
    { id: 'LOUNGE', label: 'لانژ و PS5', icon: <Sofa className="w-3.5 h-3.5" /> },
    { id: 'TERRACE', label: 'تراس', icon: <Trees className="w-3.5 h-3.5" /> },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div
        dir="ltr"
        className="flex-1 flex flex-col xl:grid xl:grid-cols-[400px_1fr] gap-4 p-3 md:p-4 max-w-[1780px] mx-auto w-full select-none"
      >
        {/* Left Column: Side-by-side Order Cart Panel (Strictly on LEFT side matching reference) */}
        <aside dir="rtl" className="hidden xl:flex flex-col modendo-cart-shell rounded-2xl overflow-hidden max-h-[calc(100vh-5rem)] h-[calc(100vh-5rem)] sticky top-2">
          {/* Cart Header */}
          <div className="p-4 border-b border-white/[0.08] bg-black/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono tabular-nums text-xs font-semibold text-white/70">
                #10BM-1488
              </span>
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  setIsTabsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-xs font-medium text-cyan-200 transition cursor-pointer"
                title="مشاهده لیست تب‌ها و میزهای باز"
              >
                <Armchair className="w-3.5 h-3.5 text-cyan-300" />
                <span>تب‌های باز: {occupiedCount}</span>
              </button>
            </div>

            {/* Dine-in vs Takeaway Toggle */}
            <div className="grid grid-cols-2 gap-2 text-xs font-medium p-1 rounded-xl bg-black/40 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onSelectTableForOrder('بیرون‌بر');
                }}
                className="h-9 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.05]"
              >
                <ShoppingBag className="w-4 h-4 text-white/60" />
                <span>بیرون‌بر</span>
              </button>

              <button
                type="button"
                className="h-9 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer bg-[#005A3E] text-white font-semibold border border-emerald-400/40 shadow-sm"
              >
                <Store className="w-4 h-4 text-emerald-200" />
                <span>سالن · {getDisplayShortLabel(selectedNode)}</span>
              </button>
            </div>
          </div>

          {/* Customer Detail Inputs (Interactive) */}
          <div className="p-3 border-b border-white/[0.06] bg-black/10 space-y-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg bg-black/25 border border-white/[0.08] px-3 h-9 focus-within:border-emerald-500/50 transition">
              <User className="w-4 h-4 text-white/40 shrink-0" />
              <input
                type="text"
                value={activeTableSession?.customerName || draftCustomerName}
                onChange={(e) => {
                  setDraftCustomerName(e.target.value);
                  handleUpdateActiveSession({ customerName: e.target.value });
                }}
                placeholder="نام مشتری یا مهمان"
                className="bg-transparent text-white placeholder:text-white/30 text-xs w-full focus:outline-none"
              />
              <span className="text-[11px] text-emerald-300 font-mono font-medium bg-emerald-950/60 border border-emerald-500/30 rounded px-1.5 py-0.5 shrink-0">
                {getDisplayShortLabel(selectedNode)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-black/25 border border-white/[0.08] px-2.5 h-8 focus-within:border-emerald-500/50 transition">
                <Phone className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <input
                  type="text"
                  value={activeTableSession?.customerPhone || ''}
                  onChange={(e) => handleUpdateActiveSession({ customerPhone: e.target.value })}
                  placeholder="شماره تماس"
                  className="bg-transparent text-white placeholder:text-white/30 text-xs w-full focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-black/25 border border-white/[0.08] px-2.5 h-8 focus-within:border-emerald-500/50 transition">
                <FileText className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <input
                  type="text"
                  value={activeTableSession?.notes || draftNotes}
                  onChange={(e) => {
                    setDraftNotes(e.target.value);
                    handleUpdateActiveSession({ notes: e.target.value });
                  }}
                  placeholder="یادداشت فاکتور"
                  className="bg-transparent text-white placeholder:text-white/30 text-xs w-full focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Cart / Table Items List */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            {activeTableSession?.cartItems && activeTableSession.cartItems.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-1 py-1 border-b border-white/[0.06] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono font-bold text-emerald-300">
                      {getDisplayShortLabel(selectedNode)}
                    </span>
                    <span className="text-white/80 font-medium truncate max-w-[150px]">
                      {selectedNode.titleFa || selectedNode.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/60 font-mono text-xs">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="tabular-nums font-semibold text-emerald-300">
                      {activeTableSession.openedAt
                        ? formatElapsedTimer(Math.max(0, nowMs - new Date(activeTableSession.openedAt).getTime()))
                        : '00:00:00'}
                    </span>
                  </div>
                </div>

                {activeTableSession.cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-medium text-white truncate">{item.itemNameSnapshot}</h4>
                      <div className="mt-0.5 text-xs font-mono font-bold text-emerald-400 tabular-nums">
                        {formatToman(item.subtotalToman)} <span className="text-[10px] font-normal text-white/50">تومان</span>
                      </div>
                    </div>
                    <div className="flex items-center h-7 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                      <span className="font-mono text-xs font-bold text-white tabular-nums">
                        {item.quantity}×
                      </span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-white text-xs">
                    میز {selectedNode.label} ({selectedNode.titleFa})
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      activeTableSession
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {activeTableSession ? 'اشغال' : 'آماده پذیرش'}
                  </span>
                </div>

                <div className="text-xs text-white/50">
                  ظرفیت: {selectedNode.seats} نفر · زون: {selectedNode.zone}
                </div>

                {activeTableSession?.openedAt && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
                    <span className="text-white/60">زمان جاری:</span>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums">
                      {formatElapsedTimer(Math.max(0, nowMs - new Date(activeTableSession.openedAt).getTime()))}
                    </span>
                  </div>
                )}

                {selectedNode.kind === 'PS5' && (
                  <div className="text-xs font-mono font-bold text-sky-300">
                    نرخ ساعتی: {formatToman(selectedNode.hourlyRateToman || 180000)} تومان
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick discount pills */}
          <div className="px-4 py-2 border-t border-white/[0.06] bg-black/10">
            <div className="grid grid-cols-4 gap-1.5 text-xs font-medium">
              <span className="h-7 text-[11px] rounded-lg text-center flex items-center justify-center bg-[#8B1A1A] text-white border border-red-500/40">
                ۰٪
              </span>
              <span className="h-7 text-[11px] rounded-lg text-center flex items-center justify-center bg-white/[0.04] text-white/60 border border-white/[0.06]">
                ۵٪ ویژه
              </span>
              <span className="h-7 text-[11px] rounded-lg text-center flex items-center justify-center bg-white/[0.04] text-white/60 border border-white/[0.06]">
                ۱۰٪ باریستا
              </span>
              <span className="h-7 text-[11px] rounded-lg text-center flex items-center justify-center bg-white/[0.04] text-white/60 border border-white/[0.06]">
                ۱۵٪ همکار
              </span>
            </div>
          </div>

          {/* Price & Action Controls */}
          <div className="p-4 border-t border-white/[0.08] bg-black/20 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium text-white/60">مبلغ نهایی:</span>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                  {formatToman(sessionTotal || 0)}
                </span>
                <span className="text-xs text-white/40 font-medium">تومان</span>
              </div>
            </div>

            {/* Dynamic Actions based on Table Session State */}
            {activeTableSession && activeTableSession.cartItems && activeTableSession.cartItems.length > 0 ? (
              <div className="space-y-2">
                {canSettle && (
                  <LiquidSurface
                    as="button"
                    magnetic={true}
                    onClick={() => setIsSettleModalOpen(true)}
                    className="w-full h-11 px-4 rounded-xl bg-[#005A3E] hover:bg-[#007A54] text-white font-semibold text-sm flex items-center justify-center gap-2 border border-emerald-400/40 shadow-sm transition cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-emerald-200" />
                    <span>تسویه فاکتور و پرداخت</span>
                  </LiquidSurface>
                )}

                <div className={canSettle ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
                  <button
                    type="button"
                    onClick={() => handleTransitionToPos(selectedNode)}
                    className="h-9 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/80 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن آیتم</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReleaseTable(selectedNode.id)}
                    className="h-9 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>آزاد کردن میز</span>
                  </button>
                </div>
              </div>
            ) : activeTableSession ? (
              <div className="space-y-2">
                <LiquidSurface
                  as="button"
                  magnetic={true}
                  onClick={() => handleTransitionToPos(selectedNode)}
                  className="w-full h-11 px-4 rounded-xl bg-[#005A3E] hover:bg-[#007A54] text-white font-semibold text-sm flex items-center justify-center gap-2 border border-emerald-400/40 shadow-sm transition cursor-pointer"
                >
                  <UtensilsCrossed className="w-4 h-4 text-emerald-200" />
                  <span>ثبت سفارش در صندوق</span>
                </LiquidSurface>

                <button
                  type="button"
                  onClick={() => handleReleaseTable(selectedNode.id)}
                  className="w-full h-9 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>آزاد کردن و لغو پذیرش</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <LiquidSurface
                  as="button"
                  magnetic={true}
                  onClick={() => handleQuickAcceptTable(selectedNode)}
                  className="w-full h-11 px-4 rounded-xl bg-[#005A3E] hover:bg-[#007A54] text-white font-semibold text-sm flex items-center justify-center gap-2 border border-emerald-400/40 shadow-sm transition cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                  <span>پذیرش سریع میز و شروع زمان</span>
                </LiquidSurface>

                <button
                  type="button"
                  onClick={() => handleTransitionToPos(selectedNode)}
                  className="w-full h-9 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/[0.06] transition cursor-pointer"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>ثبت فاکتور در صندوق</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right Column: Blueprint & Controls (Strictly on RIGHT side in LTR grid) */}
        <div dir="rtl" className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Top Control Bar with Search and View Switchers */}
          <div className="rounded-[22px] liquid-glass-shell p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg border border-white/10">
            {/* View Switchers */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="px-4 py-1.5 rounded-full text-xs font-bold text-amber-200 bg-[#78350F]/90 border border-amber-600/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] cursor-pointer"
              >
                مدیریت میزها
              </button>
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onBackToPos();
                }}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-[#cbd5e1] hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition cursor-pointer"
              >
                سفارشات
              </button>
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  if (onBackToHub) onBackToHub();
                }}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-[#cbd5e1] hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition cursor-pointer"
              >
                تنظیمات
              </button>
            </div>

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
                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
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

            {/* Action Buttons: Merge Tables + Move Table + Takeaway */}
            <div className="flex items-center gap-1.5 md:gap-2 mr-auto flex-nowrap">
              {/* Merge Tables Button */}
              <LiquidSurface
                as="button"
                magnetic={true}
                onClick={() => {
                  playPosBeep('click');
                  setMoveMode(false);
                  setMoveSourceId(null);
                  setMergeMode((prev) => {
                    if (prev) setMergeSelectedIds([]);
                    return !prev;
                  });
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                  mergeMode
                    ? 'bg-cyan-500/20 border border-cyan-300/70 text-cyan-200 shadow-[0_0_20px_-4px_rgba(34,211,238,0.55)]'
                    : 'liquid-glass-pill text-cyan-200 hover:text-white'
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>{mergeMode ? 'لغو ادغام' : 'ادغام میزها'}</span>
              </LiquidSurface>

              {/* Move Table Button */}
              <LiquidSurface
                as="button"
                magnetic={true}
                onClick={() => {
                  playPosBeep('click');
                  setMergeMode(false);
                  setMergeSelectedIds([]);
                  setMoveMode((prev) => {
                    if (prev) setMoveSourceId(null);
                    return !prev;
                  });
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                  moveMode
                    ? 'bg-amber-500/20 border border-amber-300/70 text-amber-200 shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]'
                    : 'liquid-glass-pill text-amber-200 hover:text-white'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                <span>{moveMode ? 'لغو جابجایی' : 'جابجایی میز'}</span>
              </LiquidSurface>

              {/* Takeaway Order Button */}
              <LiquidSurface
                as="button"
                magnetic={true}
                onClick={() => {
                  playPosBeep('click');
                  onSelectTableForOrder('بیرون‌بر');
                }}
                className="liquid-glass-cta rounded-full px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>سفارش بیرون‌بر</span>
              </LiquidSurface>
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
        <div className="flex-1 w-full overflow-hidden min-h-[750px]">
          <FloorPlanCanvas
            nodes={MODENDO_FLOOR_NODES}
            sessions={sessions}
            activeZone={activeZone}
            selectedNodeId={selectedTableNodeId}
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
              handleTransitionToPos(node);
            }}
          />
        </div>
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
              handleTransitionToPos(label);
            }}
            onMoveTableSession={handleMoveTableSession}
            availableNodes={MODENDO_FLOOR_NODES}
            occupiedNodeIds={Object.keys(sessions)}
          />
        )}
        {/* Comprehensive Settle, Split-Bill & Receipt Preview Modal for Floor Plan */}
        <FloorSettleModal
          isOpen={isSettleModalOpen}
          onClose={() => setIsSettleModalOpen(false)}
          selectedNode={selectedNode}
          activeTableSession={activeTableSession}
          sessionTotal={sessionTotal}
          ps5Fee={
            hasGamingPackage(
              (activeTableSession?.cartItems || []).filter(
                (it) => it.menuItemId !== 'modendo-ps5-charge' && !it.id.startsWith('ps5-hourly-')
              )
            ) || !activeTableSession?.ps5Session
              ? 0
              : calculatePs5ChargeToman(activeTableSession.ps5Session, Date.now())
          }
          onConfirmSettlement={handleSettleFromSidePanel}
          onPrintProforma={handlePrintProforma}
        />

        {/* Live Open Tabs Modal */}
        <OpenTabsModal
          isOpen={isTabsModalOpen}
          onClose={() => setIsTabsModalOpen(false)}
          onSelectTab={(tableLabel, nodeId) => {
            if (nodeId) {
              setSelectedTableNodeId(nodeId);
            } else {
              const matched = MODENDO_FLOOR_NODES.find((n) => n.label === tableLabel || n.id === tableLabel);
              if (matched) setSelectedTableNodeId(matched.id);
            }
          }}
          tenantId="tenant-modendo-01"
        />
      </div>
    </MotionConfig>
  );
};
export default FloorPlanView;
