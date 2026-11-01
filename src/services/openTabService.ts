/**
 * Table Session Open Tabs Service & State Machine
 * Compliant with antigravity_inventory_tab_spec.json
 *
 * Implements:
 *  - Persistent In-Memory / LocalStorage State Store for Table Tabs
 *  - State Machine transitions:
 *      idle_empty -> OPEN_TAB -> active_open_tab
 *      active_open_tab -> ADD_ROUND -> active_open_tab
 *      active_open_tab -> MARK_DELIVERED -> active_open_tab (BOM deduction triggered)
 *      active_open_tab -> REQUEST_BILL -> awaiting_checkout
 *      awaiting_checkout -> COMPLETE_SETTLEMENT -> idle_empty
 *  - Dynamic multi-round incremental ordering (Round 1, Round 2, Round 3...)
 *  - Late checkout & Split check capability
 *  - Real-time reactive subscriptions
 */

import {
  TableSessionTab,
  TabRound,
  TabCartItem,
  TableLifecycleState,
} from '../types/inventory-tab';
import { inventoryBomService } from './inventoryBomService';
import { baristaDispatcher } from './baristaDispatcher';
import { StationRouter } from './StationRouter';
import { SmartOrdersStore } from './storage';
import { playPosBeep } from './soundEffects';

const STORAGE_KEYS = {
  TABLE_TABS: 'cafeos_table_tabs_v2',
  RESERVED_TABLES: 'cafeos_reserved_tables_v1',
};

export interface TableConfig {
  id: string; // e.g. 't1', 't2'
  label: string; // e.g. 'میز ۱'
  zone: string; // e.g. 'سالن اصلی'
  capacity: number;
}

export const DEFAULT_TABLES: TableConfig[] = [
  { id: 't1', label: 'میز ۱', zone: 'سالن اصلی', capacity: 4 },
  { id: 't2', label: 'میز ۲', zone: 'سالن اصلی', capacity: 2 },
  { id: 't3', label: 'میز ۳', zone: 'کنار پنجره', capacity: 4 },
  { id: 't4', label: 'میز ۴', zone: 'میز گروهی', capacity: 6 },
  { id: 'bar', label: 'کانتر بار', zone: 'بار اسپشیالتی', capacity: 4 },
  { id: 'takeaway', label: 'بیرون‌بر', zone: 'تحویل اکسپرس', capacity: 1 },
  { id: 'terrace', label: 'تراس / حیاط', zone: 'فضای باز', capacity: 4 },
];

type TabsChangeListener = (tabs: TableSessionTab[]) => void;

class OpenTabService {
  private tabs: TableSessionTab[] = [];
  private reservedTableIds: Set<string> = new Set();
  private listeners: Set<TabsChangeListener> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const stored = localStorage.getItem(STORAGE_KEYS.TABLE_TABS);
        if (stored) {
          this.tabs = JSON.parse(stored);
        } else {
          // Create an initial sample open tab for Table 2 (میز ۲) to demonstrate out-of-the-box
          this.tabs = [
            {
              tab_id: `tab-${Date.now()}-t2`,
              table_id: 't2',
              table_label: 'میز ۲',
              server_name: 'سارا رضایی',
              guest_count: 2,
              status: 'open',
              opened_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
              rounds: [
                {
                  round_number: 1,
                  dispatched_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                  status: 'delivered',
                  inventory_deducted: true,
                  items: [
                    {
                      id: 'item-demo-1',
                      menuItemId: 'm1_flat_white',
                      title: 'فلت وایت',
                      quantity: 2,
                      unitPrice: 85000,
                      subtotal: 170000,
                      delivered: true,
                    },
                  ],
                },
              ],
              subtotal: 170000,
              vat: 0,
              discount: 0,
              total_due: 170000,
              notes: 'میز دو نفره سالن',
            },
          ];
          this.persistTabs();
        }

        const storedReserved = localStorage.getItem(STORAGE_KEYS.RESERVED_TABLES);
        if (storedReserved) {
          this.reservedTableIds = new Set(JSON.parse(storedReserved));
        }
      } else {
        this.tabs = [];
      }
    } catch (e) {
      this.tabs = [];
    }
  }

  private persistTabs() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(STORAGE_KEYS.TABLE_TABS, JSON.stringify(this.tabs));
      }
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to persist table tabs', e);
    }
  }

  private persistReserved() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(
          STORAGE_KEYS.RESERVED_TABLES,
          JSON.stringify(Array.from(this.reservedTableIds))
        );
      }
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to persist reserved tables', e);
    }
  }

  public subscribe(listener: TabsChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.tabs);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.tabs);
      } catch (e) {
        console.error('Error notifying tabs listener', e);
      }
    });
  }

  public getAllActiveTabs(): TableSessionTab[] {
    return this.tabs.filter((t) => t.status !== 'settled');
  }

  public getTabForTable(tableIdOrLabel: string): TableSessionTab | undefined {
    return this.tabs.find(
      (t) =>
        t.status !== 'settled' &&
        (t.table_id === tableIdOrLabel || t.table_label === tableIdOrLabel)
    );
  }

  public getTableLifecycleState(tableId: string): TableLifecycleState {
    if (this.reservedTableIds.has(tableId)) {
      return 'reserved';
    }
    const tab = this.getTabForTable(tableId);
    if (!tab) {
      return 'idle_empty';
    }
    if (tab.status === 'printed') {
      return 'awaiting_checkout';
    }
    return 'active_open_tab';
  }

  public toggleTableReservation(tableId: string): boolean {
    if (this.reservedTableIds.has(tableId)) {
      this.reservedTableIds.delete(tableId);
    } else {
      // Cannot reserve if currently occupied
      const activeTab = this.getTabForTable(tableId);
      if (activeTab) {
        return false;
      }
      this.reservedTableIds.add(tableId);
    }
    this.persistReserved();
    return true;
  }

  /**
   * Action: OPEN_TAB (idle_empty -> active_open_tab)
   */
  public openTab(
    tableId: string,
    tableLabel?: string,
    serverName: string = 'صندوق‌دار',
    guestCount: number = 2,
    initialItems: TabCartItem[] = []
  ): TableSessionTab {
    // Check if table already has an active tab
    const existing = this.getTabForTable(tableId);
    if (existing) {
      return existing;
    }

    const matchedTable = DEFAULT_TABLES.find((t) => t.id === tableId || t.label === tableId);
    const resolvedLabel = tableLabel || matchedTable?.label || tableId;

    const now = new Date().toISOString();
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const rounds: TabRound[] = [];
    let initialSubtotal = 0;

    if (initialItems.length > 0) {
      const taggedItems = initialItems.map((it) => ({
        ...it,
        station: it.station || StationRouter.resolveStation(it),
        status: 'DISPATCHED' as const,
        dispatchedAt: now,
      }));
      initialSubtotal = taggedItems.reduce((acc, it) => acc + it.subtotal, 0);
      rounds.push({
        round_number: 1,
        dispatched_at: now,
        items: taggedItems,
        inventory_deducted: false,
        status: 'sent_to_bar',
      });
      // Deduct immediately on commit
      inventoryBomService.deductForItems(taggedItems);
      rounds[0].inventory_deducted = true;
    }

    const newTab: TableSessionTab = {
      tab_id: tabId,
      table_id: tableId,
      table_label: resolvedLabel,
      server_name: serverName,
      guest_count: guestCount,
      status: 'open',
      opened_at: now,
      rounds,
      subtotal: initialSubtotal,
      vat: 0,
      discount: 0,
      total_due: initialSubtotal,
    };

    // Remove from reserved if it was reserved
    this.reservedTableIds.delete(tableId);

    this.tabs.push(newTab);
    this.persistTabs();
    this.persistReserved();
    playPosBeep('success');

    return newTab;
  }

  /**
   * Action: ADD_ROUND (active_open_tab -> active_open_tab)
   * Appends new round of items to existing table tab
   */
  public addRoundToTab(
    tabId: string,
    items: TabCartItem[],
    dispatchToBar: boolean = true
  ): TableSessionTab | null {
    if (items.length === 0) return null;

    const tabIndex = this.tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = this.tabs[tabIndex];
    if (tab.status === 'settled') {
      throw new Error('نمی‌توان به میز تسویه‌شده آیتم جدید اضافه کرد.');
    }

    const nextRoundNumber = tab.rounds.length + 1;
    const now = new Date().toISOString();

    const taggedItems = items.map((it) => ({
      ...it,
      station: it.station || StationRouter.resolveStation(it),
      status: 'DISPATCHED' as const,
      dispatchedAt: now,
    }));

    // Deduct raw ingredients for this round
    const deductionResult = inventoryBomService.deductForItems(taggedItems);

    const newRound: TabRound = {
      round_number: nextRoundNumber,
      dispatched_at: now,
      items: taggedItems,
      inventory_deducted: deductionResult.success,
      status: 'sent_to_bar',
    };

    const updatedRounds = [...tab.rounds, newRound];

    // Recalculate total items and subtotals across all rounds
    const allItems = updatedRounds.flatMap((r) => r.items);
    const subtotal = allItems.reduce((acc, it) => acc + it.subtotal, 0);
    const total_due = Math.max(0, subtotal - tab.discount + tab.vat);

    const updatedTab: TableSessionTab = {
      ...tab,
      status: 'open', // Re-open tab if it was printed
      rounds: updatedRounds,
      subtotal,
      total_due,
    };

    this.tabs[tabIndex] = updatedTab;
    this.persistTabs();

    // Notify Barista KDS
    if (dispatchToBar) {
      try {
        const roundGross = items.reduce((acc, it) => acc + it.subtotal, 0);
        baristaDispatcher.dispatchPaidOrder({
          id: `${updatedTab.tab_id}-r${nextRoundNumber}`,
          clientGeneratedId: `client-${Date.now()}-r${nextRoundNumber}`,
          tenantId: 'tenant-100hich-01',
          shiftId: 'active-shift',
          orderNumber: Math.floor(Math.random() * 900) + 100,
          orderType: 'DINE_IN',
          state: 'PAID',
          tableLabel: `${updatedTab.table_label} (دور ${nextRoundNumber})`,
          customerName: updatedTab.server_name,
          items: items.map((it) => ({
            id: it.id,
            menuItemId: it.menuItemId,
            itemNameSnapshot: it.title,
            unitPriceSnapshotToman: it.unitPrice,
            quantity: it.quantity,
            modifiers: it.modifiers?.map((m) => ({
              id: m.id || 'mod',
              nameFa: m.nameFa,
              priceDeltaToman: m.priceDelta,
            })) || [],
            modifiersDeltaToman: it.modifiers?.reduce((a, m) => a + m.priceDelta, 0) || 0,
            subtotalToman: it.subtotal,
            notes: it.notes,
          })),
          grossAmountToman: roundGross,
          grossAmount: roundGross,
          discountAmountToman: 0,
          discountAmount: 0,
          netTotalToman: roundGross,
          totalNet: roundGross,
          paidAmountToman: roundGross,
          paidAmount: roundGross,
          payments: [],
          createdAt: now,
          updatedAt: now,
          createdByUserId: 'server',
          createdByUserName: updatedTab.server_name,
        });
      } catch (e) {
        console.error('Barista dispatcher failed for round', e);
      }
    }

    playPosBeep('success');
    return updatedTab;
  }

  /**
   * Action: MARK_DELIVERED (active_open_tab -> active_open_tab)
   * Marks a round or items as delivered and guarantees inventory deduction
   */
  public markRoundDelivered(tabId: string, roundNumber: number): TableSessionTab | null {
    const tabIndex = this.tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = this.tabs[tabIndex];
    const updatedRounds = tab.rounds.map((round) => {
      if (round.round_number === roundNumber) {
        // If not already deducted, trigger deduction
        if (!round.inventory_deducted) {
          inventoryBomService.deductForItems(round.items);
        }
        return {
          ...round,
          status: 'delivered' as const,
          inventory_deducted: true,
          items: round.items.map((it) => ({ ...it, delivered: true })),
        };
      }
      return round;
    });

    const updatedTab: TableSessionTab = {
      ...tab,
      rounds: updatedRounds,
    };

    this.tabs[tabIndex] = updatedTab;
    this.persistTabs();
    playPosBeep('click');
    return updatedTab;
  }

  /**
   * Action: REQUEST_BILL (active_open_tab -> awaiting_checkout)
   * Freezes round additions and marks table as awaiting payment
   */
  public requestBill(tabId: string): TableSessionTab | null {
    const tabIndex = this.tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = this.tabs[tabIndex];
    const updatedTab: TableSessionTab = {
      ...tab,
      status: 'printed',
    };

    this.tabs[tabIndex] = updatedTab;
    this.persistTabs();
    playPosBeep('success');
    return updatedTab;
  }

  /**
   * Apply Discount to open tab
   */
  public applyDiscount(tabId: string, discountToman: number): TableSessionTab | null {
    const tabIndex = this.tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return null;

    const tab = this.tabs[tabIndex];
    const discount = Math.min(Math.max(0, discountToman), tab.subtotal);
    const total_due = Math.max(0, tab.subtotal - discount + tab.vat);

    const updatedTab: TableSessionTab = {
      ...tab,
      discount,
      total_due,
    };

    this.tabs[tabIndex] = updatedTab;
    this.persistTabs();
    return updatedTab;
  }

  /**
   * Action: COMPLETE_SETTLEMENT (awaiting_checkout / active_open_tab -> idle_empty)
   * Closes tab, registers order & payment in core store, frees the table
   */
  public settleTab(
    tabId: string,
    options: {
      paymentMethod: 'CARD' | 'CASH' | 'SPLIT';
      terminalName?: string;
      referenceCode?: string;
      cashTendered?: number;
      splitCount?: number;
    }
  ): { success: boolean; closedTab: TableSessionTab } {
    const tabIndex = this.tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) {
      throw new Error(`حساب میز با شناسه ${tabId} یافت نشد.`);
    }

    const tab = this.tabs[tabIndex];
    const now = new Date().toISOString();

    // Ensure all rounds are marked deducted
    tab.rounds.forEach((round) => {
      if (!round.inventory_deducted) {
        inventoryBomService.deductForItems(round.items);
      }
    });

    const closedTab: TableSessionTab = {
      ...tab,
      status: 'settled',
      settled_at: now,
      settlement_method: options.paymentMethod,
    };

    // Remove tab from active list or mark settled
    this.tabs[tabIndex] = closedTab;
    this.persistTabs();

    // Sync with KarWand / SmartOrders core store
    try {
      const activeShift = SmartOrdersStore.getActiveShift();
      const activeUser = SmartOrdersStore.getActiveUser();
      if (activeShift) {
        const allItems = tab.rounds.flatMap((r) => r.items);
        const createdOrder = SmartOrdersStore.createOrder({
          tenantId: activeShift.tenantId,
          shiftId: activeShift.id,
          createdByUserId: activeUser.id,
          createdByUserName: activeUser.fullName,
          orderType: 'DINE_IN',
          tableLabel: tab.table_label,
          customerName: `مشتری ${tab.table_label}`,
          status: 'COMPLETED',
          items: allItems.map((it) => ({
            id: it.id,
            menuItemId: it.menuItemId,
            itemNameSnapshot: it.title,
            unitPriceSnapshotToman: it.unitPrice,
            quantity: it.quantity,
            subtotalToman: it.subtotal,
            notes: it.notes,
          })),
          grossAmountToman: tab.subtotal,
          discountAmountToman: tab.discount,
          netTotalToman: tab.total_due,
        });

        SmartOrdersStore.recordPayment({
          tenantId: activeShift.tenantId,
          orderId: createdOrder.id,
          shiftId: activeShift.id,
          receivedByUserId: activeUser.id,
          amountToman: tab.total_due,
          paymentMethod: options.paymentMethod === 'CASH' ? 'CASH' : 'CARD_MANUAL',
          referenceCode: options.referenceCode,
          terminalName: options.terminalName || 'پوز ۱ (بانک سامان)',
          status: 'SUCCESSFUL',
        });
      }
    } catch (e) {
      console.warn('SmartOrdersStore order registration warning', e);
    }

    playPosBeep('success');
    return { success: true, closedTab };
  }

  /**
   * Void or cancel an open tab
   */
  public voidTab(tabId: string): boolean {
    const tabIndex = this.tabs.findIndex((t) => t.tab_id === tabId);
    if (tabIndex === -1) return false;

    // Filter out the tab
    this.tabs.splice(tabIndex, 1);
    this.persistTabs();
    playPosBeep('delete');
    return true;
  }
}

export const openTabService = new OpenTabService();
