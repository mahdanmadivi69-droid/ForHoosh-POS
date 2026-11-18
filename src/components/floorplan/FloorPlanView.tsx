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
} from 'lucide-react';
import {
  FloorPlanCanvas,
  FloorNode,
  FloorZone,
  TableSession,
  MODENDO_FLOOR_NODES,
  getSessionTotalToman,
  calculatePs5ChargeToman,
  resolvePrimaryNodeId,
  is100HichNode,
  formatElapsedTimer,
} from './FloorPlanCanvas';
import { TableSessionModal } from './TableSessionModal';
import { TableEntity } from '../../types/floor-plan';
import { floorPlanService } from '../../services/floorPlanService';
import { CatalogService } from '../../services/catalog/catalogService';
import { openTabService } from '../../services/openTabService';
import { formatToman } from '../../services/financialMath';
import { playPosBeep } from '../../services/soundEffects';
import { OrderItem } from '../../types/domain';

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
    setSelectedTableNodeId(node.id);
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

    // On smaller screens where sidebar is hidden, route directly to POS
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      handleTransitionToPos(node);
    }
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
        status: sessions[node.id] ? 'OCCUPIED' : 'AVAILABLE',
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
        const targetTab =
          openTabService.getTabForTable(selectedNode.label, 'tenant-modendo-01') ||
          openTabService.getTabForTable(nodeId, 'tenant-modendo-01');
        if (targetTab) {
          openTabService.voidTab(targetTab.tab_id, 'tenant-modendo-01');
        }
      } catch (e) {
        console.warn('[FloorPlanView] voidTab on release failed:', e);
      }

      setSessions((prev) => {
        const next = { ...prev };
        delete next[nodeId];
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

  // Direct settlement from FloorPlan side panel
  const handleSettleFromSidePanel = (paymentMethod: 'CARD' | 'CASH') => {
    if (!activeShift) {
      alert('شیفت کاری فعال نیست. لطفاً ابتدا شیفت را باز کنید.');
      return;
    }
    const rawItems = activeTableSession?.cartItems || [];
    const baseItems = rawItems.filter(
      (it) => it.menuItemId !== 'modendo-ps5-charge' && !it.id.startsWith('ps5-hourly-')
    );

    // TASK 2: Prevent Double-Charging (The Package Logic)
    const hasPs5Package = baseItems.some(
      (item) =>
        item.menuItemId?.toLowerCase().includes('ps5') ||
        item.menuItemId?.toLowerCase().includes('playstation') ||
        item.itemNameSnapshot?.includes('PS5') ||
        item.itemNameSnapshot?.includes('پلی')
    );

    const ps5Session =
      activeTableSession?.ps5Session ||
      (selectedNode.kind === 'PS5' && activeTableSession
        ? {
            startedAt: activeTableSession.openedAt || new Date().toISOString(),
            hourlyRateToman: selectedNode.hourlyRateToman || 180000,
            controllersCount: 2,
            accumulatedMs: 0,
            isPaused: false,
          }
        : undefined);

    const ps5Fee = hasPs5Package || !ps5Session
      ? 0
      : calculatePs5ChargeToman(ps5Session, Date.now());

    const items = [...baseItems];
    if (ps5Fee > 0) {
      items.push({
        id: `ps5-hourly-${selectedNode.id}-${Date.now()}`,
        menuItemId: 'modendo-ps5-charge',
        itemNameSnapshot: `تعرفه بازی PS5 (${selectedNode.label})`,
        unitPriceSnapshotToman: ps5Fee,
        quantity: 1,
        subtotalToman: ps5Fee,
        notes: 'شارژ زمانی بازی کنسول',
      } as any);
    }

    const grossAmount = items.reduce((sum: number, it: any) => sum + (it.subtotalToman || 0), 0);
    const discountAmount = activeTableSession?.discountToman || 0;
    const finalAmount = Math.max(0, grossAmount - discountAmount);

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
        notes: activeTableSession?.notes || undefined,
        status: 'COMPLETED',
        items,
        grossAmountToman: grossAmount,
        discountAmountToman: discountAmount,
        netTotalToman: finalAmount,
      };

      const result = onOrderCompleted(orderPayload, paymentMethod, '', 'صندوق سالن');
      if (result) {
        playPosBeep('success');

        // Settle open tab in openTabService to eradicate ghost tab resurrection
        try {
          const targetTab =
            openTabService.getTabForTable(selectedNode.label, 'tenant-modendo-01') ||
            openTabService.getTabForTable(selectedNode.id, 'tenant-modendo-01');
          if (targetTab) {
            openTabService.settleTab(
              targetTab.tab_id,
              {
                paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'CARD',
                referenceCode: '',
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
        const baseItems = rawItems.filter(
          (it) => it.menuItemId !== 'modendo-ps5-charge' && !it.id.startsWith('ps5-hourly-')
        );

        // TASK 2: Prevent Double-Charging (The Package Logic)
        const hasPs5Package = baseItems.some(
          (item) =>
            item.menuItemId?.toLowerCase().includes('ps5') ||
            item.menuItemId?.toLowerCase().includes('playstation') ||
            item.itemNameSnapshot?.includes('PS5') ||
            item.itemNameSnapshot?.includes('پلی')
        );

        const ps5Fee = hasPs5Package ? 0 : calculatePs5ChargeToman(ps5Session, Date.now());

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

  const activeTableSession = sessions[selectedTableNodeId];
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
        <aside dir="rtl" className="hidden xl:flex flex-col modendo-cart-shell rounded-[28px] overflow-hidden max-h-[calc(100vh-6rem)] h-[calc(100vh-6rem)] sticky top-3">
          {/* Cart Header */}
          <div className="p-4 border-b border-white/[0.08] bg-black/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono tabular-nums text-xs font-bold text-white/80">
                #10BM-1488
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-bold text-cyan-300 shadow-sm">
                <span>🪑 تب‌ها: {occupiedCount}</span>
              </div>
            </div>

            {/* Dine-in vs Takeaway Toggle */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold p-1 rounded-full bg-black/40 border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  playPosBeep('click');
                  onSelectTableForOrder('بیرون‌بر');
                }}
                className="py-2 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[#381116] border border-red-900/50 text-[#FCA5A5] hover:text-white"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Takeout</span>
              </button>

              <button
                type="button"
                className="py-2 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Table 🪑</span>
              </button>
            </div>
          </div>

          {/* Customer Detail Inputs (Interactive) */}
          <div className="px-4 py-2.5 border-b border-white/[0.08] bg-black/15 space-y-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-1.5">
              <span className="text-white/40">👤</span>
              <input
                type="text"
                value={activeTableSession?.customerName || draftCustomerName}
                onChange={(e) => {
                  setDraftCustomerName(e.target.value);
                  handleUpdateActiveSession({ customerName: e.target.value });
                }}
                placeholder="نام مشتری / مهمان..."
                className="bg-transparent text-white placeholder:text-[#94A3B8]/60 text-xs w-full focus:outline-none"
              />
              <span className="text-[11px] text-emerald-300 font-bold bg-[#0A1F18] border border-emerald-500/40 rounded-lg px-2 py-0.5 shrink-0">
                {selectedNode.label}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-1.5">
              <span className="text-white/40">📞</span>
              <input
                type="text"
                value={activeTableSession?.customerPhone || ''}
                onChange={(e) => handleUpdateActiveSession({ customerPhone: e.target.value })}
                placeholder="شماره تماس..."
                className="bg-transparent text-white placeholder:text-[#94A3B8]/60 text-xs w-full focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.07] px-3 py-1.5">
              <span className="text-white/40">📝</span>
              <input
                type="text"
                value={activeTableSession?.notes || draftNotes}
                onChange={(e) => {
                  setDraftNotes(e.target.value);
                  handleUpdateActiveSession({ notes: e.target.value });
                }}
                placeholder="یادداشت فاکتور (توضیحات کل سفارش)..."
                className="bg-transparent text-white placeholder:text-[#94A3B8]/50 text-xs w-full focus:outline-none"
              />
            </div>
          </div>

          {/* Cart / Table Items List */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-2.5">
            {activeTableSession?.cartItems && activeTableSession.cartItems.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-300 px-1 pb-1 border-b border-white/[0.06]">
                  <span>⏱️ زمان باز بودن میز:</span>
                  <span className="tabular-nums">
                    {activeTableSession.openedAt
                      ? formatElapsedTimer(Math.max(0, nowMs - new Date(activeTableSession.openedAt).getTime()))
                      : '00:00:00'}
                  </span>
                </div>

                {activeTableSession.cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-black/35 border border-red-500/15 flex flex-col gap-2 shadow-inner"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{item.itemNameSnapshot}</h4>
                        <div className="mt-1 text-xs font-black text-emerald-300 num-heavy tabular-nums">
                          {formatToman(item.subtotalToman)} تومان
                        </div>
                      </div>
                      <div className="flex items-center rounded-full bg-[#3B1218] border border-red-900/60 p-0.5">
                        <span className="w-6 text-center font-bold text-xs text-white num-heavy tabular-nums">
                          {item.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="p-4 rounded-2xl bg-black/35 border border-red-500/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-white text-xs">
                    میز {selectedNode.label} ({selectedNode.titleFa})
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTableSession
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-400/40'
                        : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                    }`}
                  >
                    {activeTableSession ? 'اشغال' : 'آماده پذیرش'}
                  </span>
                </div>

                <div className="text-[11px] text-[#94A3B8]">
                  ظرفیت: {selectedNode.seats} نفر · زون: {selectedNode.zone}
                </div>

                {activeTableSession?.openedAt && (
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-300 pt-1 border-t border-white/5">
                    <span>⏱️ زمان جاری:</span>
                    <span className="tabular-nums">
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
          <div className="px-4 pt-2.5 pb-2 border-t border-white/[0.08] bg-black/15">
            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              <span className="py-1.5 text-[11px] rounded-full text-center bg-[#991B1B] text-white border border-[#DC2626]">
                ۰٪
              </span>
              <span className="py-1.5 text-[11px] rounded-full text-center bg-[#1B222C] text-[#94A3B8]">
                ۵٪ ویژه
              </span>
              <span className="py-1.5 text-[11px] rounded-full text-center bg-[#1B222C] text-[#94A3B8]">
                ۱۰٪ باریستا
              </span>
              <span className="py-1.5 text-[11px] rounded-full text-center bg-[#1B222C] text-[#94A3B8]">
                ۱۵٪ همکار
              </span>
            </div>
          </div>

          {/* Price & Action Controls */}
          <div className="p-4 border-t border-white/[0.08] bg-black/25 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-white">مبلغ نهایی:</span>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-300 num-heavy tabular-nums">
                  {formatToman(sessionTotal || 0)}
                </span>
                <span className="text-xs text-[#94A3B8] mr-1">تومان</span>
              </div>
            </div>

            {/* Dynamic Actions based on Table Session State */}
            {activeTableSession && activeTableSession.cartItems && activeTableSession.cartItems.length > 0 ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(true)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#991B1B] text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(220,38,38,0.5)] border border-red-500/40 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>تسویه فاکتور و پرداخت</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTransitionToPos(selectedNode)}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن آیتم</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReleaseTable(selectedNode.id)}
                    className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>آزاد کردن میز</span>
                  </button>
                </div>
              </div>
            ) : activeTableSession ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleTransitionToPos(selectedNode)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(16,185,129,0.35)] border border-emerald-400/40 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  <span>ثبت سفارش در صندوق</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReleaseTable(selectedNode.id)}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>آزاد کردن و لغو پذیرش</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickAcceptTable(selectedNode)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(16,185,129,0.4)] border border-emerald-400/40 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                  <span>پذیرش سریع میز و شروع زمان</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTransitionToPos(selectedNode)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/30 transition-all cursor-pointer"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>ثبت فاکتور در صندوق (انتخاب اقلام)</span>
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
        {/* Direct Settle & Receipt Modal for Side Panel */}
        <AnimatePresence>
          {isSettleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                dir="rtl"
                className="w-full max-w-md liquid-glass-modal rounded-[28px] p-6 space-y-4 border border-emerald-500/30 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-black text-white">
                      تسویه و صدور فیش میز {selectedNode.label}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsSettleModalOpen(false)}
                    className="p-1 rounded-full text-white/50 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="liquid-glass-well rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">میز:</span>
                    <span className="text-white font-bold">{selectedNode.titleFa}</span>
                  </div>
                  {activeTableSession?.customerName && (
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">مشتری:</span>
                      <span className="text-white font-bold">{activeTableSession.customerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">تعداد اقلام:</span>
                    <span className="text-white font-bold">{activeTableSession?.cartItems?.length || 0} قلم</span>
                  </div>
                  <div className="h-px bg-white/10 my-2" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-white">مبلغ کل قابل پرداخت:</span>
                    <span className="text-xl font-black text-emerald-300 num-heavy tabular-nums">
                      {formatToman(sessionTotal || 0)} تومان
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSettleFromSidePanel('CARD')}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg border border-emerald-400/40 hover:brightness-110 cursor-pointer"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>پرداخت با کارت‌خوان بانکی (POS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSettleFromSidePanel('CASH')}
                    className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4 text-emerald-300" />
                    <span>پرداخت نقدی (وجه نقد)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(false)}
                    className="w-full py-2.5 text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
export default FloorPlanView;
