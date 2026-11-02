/**
 * CAFE OS — Persistent KDS Backend Service & Restart Recovery
 * Module: server/kdsService.ts
 * Owner: A06-TITAN (KDS Backend and Integration Engineer)
 *
 * Implements:
 * 1. Persistent file-backed KDS Station Tickets matching PostgreSQL RLS DDL (001_kds_station_tickets.sql).
 * 2. Complete Server Restart Recovery: uncompleted tickets resume seamlessly after server crashes/reboots.
 * 3. Strict Multi-Tenant Isolation: every ticket query and mutation is bound to validated tenant context.
 * 4. Independent Station Completion: BAR and KITCHEN tickets operate on isolated lifecycles.
 * 5. NO_PREP Exclusion: integrates StationRouter to ensure retail, merchandise, and gaming items never enter kitchen/bar queues.
 * 6. Idempotent Dispatch: prevents duplicate ticket creation when identical orders/items are re-submitted.
 * 7. Safe Ticket Cancellation and Reopening lifecycle.
 */

import fs from 'fs';
import path from 'path';
import {
  StationRouter,
  PrepStation,
  RoutableCartItem,
  DELTA_ORDERING_RULES,
} from '../src/services/StationRouter';

export type KdsStationType = 'BAR' | 'KITCHEN';
export type KdsTicketStatus = 'PENDING' | 'IN_PREP' | 'COMPLETED' | 'CANCELLED';
export type KdsItemStatus = 'PENDING' | 'PREPARING' | 'SERVED';

export interface KdsTicketItem {
  id: string;
  ticketId: string;
  tenantId: string;
  cartItemId: string;
  title: string;
  quantity: number;
  modifiers: any[];
  notes?: string;
  status: KdsItemStatus;
  dispatchedAt: string;
  createdAt: string;
}

export interface KdsStationTicket {
  id: string;
  tenantId: string;
  orderId: string;
  orderNumber: number;
  tableLabel: string;
  station: KdsStationType;
  status: KdsTicketStatus;
  isDelta: boolean;
  deltaSequence: number;
  deltaHeaderFlag?: string;
  orderNotes?: string;
  cashierName: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  items: KdsTicketItem[];
}

export interface KdsOrderPayload {
  orderId: string;
  orderNumber?: number;
  tableLabel?: string;
  cashierName?: string;
  orderNotes?: string;
  items: Partial<RoutableCartItem>[];
  alreadyDispatchedIds?: string[];
}

export interface KdsDispatchResult {
  barTicket?: KdsStationTicket;
  kitchenTicket?: KdsStationTicket;
  noPrepCount: number;
  dispatchedCount: number;
  isIdempotentReplay?: boolean;
  message?: string;
}

export class TenantIsolationViolationError extends Error {
  constructor(message: string) {
    super(`[KdsService:TenantIsolation] ${message}`);
    this.name = 'TenantIsolationViolationError';
  }
}

export class StationSecurityViolationError extends Error {
  constructor(message: string) {
    super(`[KdsService:StationSecurity] ${message}`);
    this.name = 'StationSecurityViolationError';
  }
}

export interface KdsServiceOptions {
  storageDir?: string;
  storageFilename?: string;
  persistToDisk?: boolean;
}

export class KdsService {
  private tickets: Map<string, KdsStationTicket> = new Map();
  private storageFilePath: string | null = null;
  private persistToDisk: boolean = true;
  private initialized: boolean = false;

  constructor(options?: KdsServiceOptions) {
    this.persistToDisk = options?.persistToDisk ?? true;
    if (this.persistToDisk) {
      const storageDir = options?.storageDir || path.resolve(process.cwd(), '.kds_data');
      const filename = options?.storageFilename || 'kds_tickets_store.json';
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      this.storageFilePath = path.join(storageDir, filename);
    }
    this.loadFromStorage();
  }

  /**
   * Loads existing tickets from durable disk storage to achieve restart recovery.
   */
  public loadFromStorage(): void {
    if (!this.persistToDisk || !this.storageFilePath) {
      this.initialized = true;
      return;
    }

    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const ticket of parsed) {
              if (ticket && ticket.id && ticket.tenantId) {
                this.tickets.set(ticket.id, ticket);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[KdsService] Warning: Failed to load KDS storage snapshot:', err);
    }
    this.initialized = true;
  }

  /**
   * Persists ticket snapshots atomically to avoid corruption on unexpected power loss or crashes.
   */
  private flushToStorage(): void {
    if (!this.persistToDisk || !this.storageFilePath) return;

    try {
      const ticketsArray = Array.from(this.tickets.values());
      const tempPath = `${this.storageFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(ticketsArray, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.storageFilePath);
    } catch (err) {
      console.error('[KdsService] Error persisting tickets to disk:', err);
    }
  }

  /**
   * Validates tenant ID syntax and existence.
   */
  private validateTenant(tenantId: unknown): string {
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new TenantIsolationViolationError('Tenant context is missing or invalid.');
    }
    return tenantId.trim();
  }

  /**
   * Creates and dispatches station tickets from an order aggregate,
   * strictly adhering to StationRouter policies:
   * - Excludes NO_PREP items (retail, merchandise, gaming).
   * - Enforces server-side idempotency against duplicate dispatches.
   * - Computes delta sequence for supplemental orders.
   */
  public dispatchOrder(tenantIdInput: string, payload: KdsOrderPayload): KdsDispatchResult {
    const tenantId = this.validateTenant(tenantIdInput);

    // Find all tickets previously created for this order under this tenant
    const existingTickets = Array.from(this.tickets.values()).filter(
      (t) => t.tenantId === tenantId && t.orderId === payload.orderId
    );

    // Build the set of item IDs already dispatched on the server to prevent duplicates
    const serverDispatchedItemIds = new Set<string>(payload.alreadyDispatchedIds || []);
    existingTickets.forEach((t) => {
      t.items.forEach((it) => {
        if (it.cartItemId) serverDispatchedItemIds.add(it.cartItemId);
      });
    });

    const maxDeltaSeq = existingTickets.reduce((max, t) => Math.max(max, t.deltaSequence || 0), 0);
    const isSupplemental = existingTickets.length > 0;
    const deltaSequence = isSupplemental ? maxDeltaSeq + 1 : 0;

    // Sanitize and complete routable cart items
    const routableItems: RoutableCartItem[] = payload.items.map((it, idx) => ({
      id: it.id || `item_${payload.orderId}_${idx}`,
      title: it.title || 'آیتم سفارش',
      quantity: typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1,
      categoryId: it.categoryId || '',
      station: it.station,
      status: it.status || 'PENDING_DISPATCH',
      modifiers: it.modifiers || [],
      notes: typeof it.notes === 'string' ? it.notes : Array.isArray(it.notes) ? it.notes.join(', ') : undefined,
    }));

    // Split order using StationRouter
    const splitResult = StationRouter.splitTicket(
      routableItems,
      Array.from(serverDispatchedItemIds),
      {
        ticketId: payload.orderId,
        orderNumber: payload.orderNumber,
        tableLabel: payload.tableLabel,
        cashierName: payload.cashierName,
        orderNotes: payload.orderNotes,
      }
    );

    // 1. Check for Idempotent Replay: if order already has tickets and no new items need prep
    if (existingTickets.length > 0 && splitResult.totalItemsDispatched === 0) {
      const existingBar = existingTickets.find((t) => t.station === 'BAR');
      const existingKitchen = existingTickets.find((t) => t.station === 'KITCHEN');
      return {
        barTicket: existingBar,
        kitchenTicket: existingKitchen,
        noPrepCount: splitResult.noPrepItems.length,
        dispatchedCount: 0,
        isIdempotentReplay: true,
        message: 'Order already dispatched. Idempotent replay returned.',
      };
    }

    // 2. Pure NO_PREP Order: zero items require barista or kitchen preparation
    if (!splitResult.hasBarItems && !splitResult.hasKitchenItems) {
      return {
        barTicket: undefined,
        kitchenTicket: undefined,
        noPrepCount: splitResult.noPrepItems.length,
        dispatchedCount: 0,
        isIdempotentReplay: false,
        message: 'Order contains only NO_PREP items. No preparation tickets dispatched.',
      };
    }

    const nowIso = new Date().toISOString();
    const isDelta = splitResult.isDelta || isSupplemental;
    const deltaHeaderFlag =
      splitResult.deltaHeaderFlag || (isDelta ? DELTA_ORDERING_RULES.header_flag_for_delta : undefined);

    let createdBarTicket: KdsStationTicket | undefined;
    let createdKitchenTicket: KdsStationTicket | undefined;

    // 3. Process BAR Station Ticket
    if (splitResult.hasBarItems && splitResult.barTicket.items.length > 0) {
      const ticketId = `tkt_bar_${payload.orderId}_${deltaSequence}_${Date.now()}`;
      const items: KdsTicketItem[] = splitResult.barTicket.items.map((it, idx) => ({
        id: `tkt_item_${ticketId}_${idx}`,
        ticketId,
        tenantId,
        cartItemId: it.id,
        title: it.title,
        quantity: typeof it.quantity === 'number' ? it.quantity : 1,
        modifiers: it.modifiers || [],
        notes: typeof it.notes === 'string' ? it.notes : Array.isArray(it.notes) ? it.notes.join(', ') : undefined,
        status: 'PENDING',
        dispatchedAt: nowIso,
        createdAt: nowIso,
      }));

      createdBarTicket = {
        id: ticketId,
        tenantId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber || 101,
        tableLabel: payload.tableLabel || 'میز سالن',
        station: 'BAR',
        status: 'PENDING',
        isDelta,
        deltaSequence,
        deltaHeaderFlag,
        orderNotes: payload.orderNotes,
        cashierName: payload.cashierName || 'صندوقدار',
        createdAt: nowIso,
        updatedAt: nowIso,
        items,
      };

      this.tickets.set(ticketId, createdBarTicket);
    }

    // 4. Process KITCHEN Station Ticket
    if (splitResult.hasKitchenItems && splitResult.kitchenTicket.items.length > 0) {
      const ticketId = `tkt_ktc_${payload.orderId}_${deltaSequence}_${Date.now()}`;
      const items: KdsTicketItem[] = splitResult.kitchenTicket.items.map((it, idx) => ({
        id: `tkt_item_${ticketId}_${idx}`,
        ticketId,
        tenantId,
        cartItemId: it.id,
        title: it.title,
        quantity: typeof it.quantity === 'number' ? it.quantity : 1,
        modifiers: it.modifiers || [],
        notes: typeof it.notes === 'string' ? it.notes : Array.isArray(it.notes) ? it.notes.join(', ') : undefined,
        status: 'PENDING',
        dispatchedAt: nowIso,
        createdAt: nowIso,
      }));

      createdKitchenTicket = {
        id: ticketId,
        tenantId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber || 101,
        tableLabel: payload.tableLabel || 'میز سالن',
        station: 'KITCHEN',
        status: 'PENDING',
        isDelta,
        deltaSequence,
        deltaHeaderFlag,
        orderNotes: payload.orderNotes,
        cashierName: payload.cashierName || 'صندوقدار',
        createdAt: nowIso,
        updatedAt: nowIso,
        items,
      };

      this.tickets.set(ticketId, createdKitchenTicket);
    }

    this.flushToStorage();

    return {
      barTicket: createdBarTicket,
      kitchenTicket: createdKitchenTicket,
      noPrepCount: splitResult.noPrepItems.length,
      dispatchedCount: splitResult.totalItemsDispatched,
      isIdempotentReplay: false,
    };
  }

  /**
   * Retrieves station tickets for a specific tenant.
   * Cross-tenant access is strictly denied.
   */
  public getTickets(
    tenantIdInput: string,
    filters?: {
      station?: KdsStationType;
      status?: KdsTicketStatus | KdsTicketStatus[];
      orderId?: string;
    }
  ): KdsStationTicket[] {
    const tenantId = this.validateTenant(tenantIdInput);

    let list = Array.from(this.tickets.values()).filter((t) => t.tenantId === tenantId);

    if (filters?.station) {
      list = list.filter((t) => t.station === filters.station);
    }

    if (filters?.status) {
      const allowed = Array.isArray(filters.status) ? filters.status : [filters.status];
      list = list.filter((t) => allowed.includes(t.status));
    }

    if (filters?.orderId) {
      list = list.filter((t) => t.orderId === filters.orderId);
    }

    // Sort newest created first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Updates prep status of a ticket.
   * Invariants enforced:
   * - Strict tenant ownership validation.
   * - Caller station guard: a Barista at BAR cannot manipulate KITCHEN tickets.
   * - Independent station completion: completing BAR does not modify KITCHEN tickets.
   */
  public updateTicketStatus(
    tenantIdInput: string,
    ticketId: string,
    newStatus: KdsTicketStatus,
    callerStation?: KdsStationType
  ): KdsStationTicket {
    const tenantId = this.validateTenant(tenantIdInput);

    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket with ID "${ticketId}" was not found.`);
    }

    // Tenant boundary check
    if (ticket.tenantId !== tenantId) {
      throw new TenantIsolationViolationError(
        `Cross-tenant mutation rejected. Caller tenant "${tenantId}" does not own ticket "${ticketId}".`
      );
    }

    // Station security check
    if (callerStation && ticket.station !== callerStation) {
      throw new StationSecurityViolationError(
        `Cross-station mutation rejected. Station "${callerStation}" cannot alter ticket belonging to "${ticket.station}".`
      );
    }

    const nowIso = new Date().toISOString();
    ticket.status = newStatus;
    ticket.updatedAt = nowIso;

    if (newStatus === 'IN_PREP' && !ticket.startedAt) {
      ticket.startedAt = nowIso;
      ticket.items.forEach((it) => {
        if (it.status === 'PENDING') it.status = 'PREPARING';
      });
    } else if (newStatus === 'COMPLETED') {
      ticket.completedAt = nowIso;
      ticket.items.forEach((it) => {
        it.status = 'SERVED';
      });
    }

    this.flushToStorage();
    return ticket;
  }

  /**
   * Cancels a station ticket safely.
   */
  public cancelTicket(
    tenantIdInput: string,
    ticketId: string,
    reason?: string,
    callerStation?: KdsStationType
  ): KdsStationTicket {
    const tenantId = this.validateTenant(tenantIdInput);

    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket with ID "${ticketId}" was not found.`);
    }

    if (ticket.tenantId !== tenantId) {
      throw new TenantIsolationViolationError(
        `Cross-tenant cancellation rejected. Caller tenant "${tenantId}" does not own ticket "${ticketId}".`
      );
    }

    if (callerStation && ticket.station !== callerStation) {
      throw new StationSecurityViolationError(
        `Cross-station cancellation rejected. Station "${callerStation}" cannot cancel ticket belonging to "${ticket.station}".`
      );
    }

    const nowIso = new Date().toISOString();
    ticket.status = 'CANCELLED';
    ticket.updatedAt = nowIso;
    if (reason) {
      ticket.orderNotes = ticket.orderNotes ? `${ticket.orderNotes} | لغو: ${reason}` : `لغو: ${reason}`;
    }

    this.flushToStorage();
    return ticket;
  }

  /**
   * Reopens a completed or cancelled ticket.
   */
  public reopenTicket(
    tenantIdInput: string,
    ticketId: string,
    callerStation?: KdsStationType
  ): KdsStationTicket {
    const tenantId = this.validateTenant(tenantIdInput);

    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket with ID "${ticketId}" was not found.`);
    }

    if (ticket.tenantId !== tenantId) {
      throw new TenantIsolationViolationError(
        `Cross-tenant reopen rejected. Caller tenant "${tenantId}" does not own ticket "${ticketId}".`
      );
    }

    if (callerStation && ticket.station !== callerStation) {
      throw new StationSecurityViolationError(
        `Cross-station reopen rejected. Station "${callerStation}" cannot reopen ticket belonging to "${ticket.station}".`
      );
    }

    const nowIso = new Date().toISOString();
    ticket.status = 'PENDING';
    ticket.updatedAt = nowIso;
    ticket.completedAt = undefined;
    ticket.items.forEach((it) => {
      it.status = 'PENDING';
    });

    this.flushToStorage();
    return ticket;
  }

  /**
   * Retrieves active preparation counts partitioned by station.
   */
  public getActiveCounts(tenantIdInput: string): { bar: number; kitchen: number; total: number } {
    const tenantId = this.validateTenant(tenantIdInput);
    const active = Array.from(this.tickets.values()).filter(
      (t) => t.tenantId === tenantId && (t.status === 'PENDING' || t.status === 'IN_PREP')
    );

    const bar = active.filter((t) => t.station === 'BAR').length;
    const kitchen = active.filter((t) => t.station === 'KITCHEN').length;

    return { bar, kitchen, total: active.length };
  }

  /**
   * For test isolation: clears storage file and in-memory tickets.
   */
  public clearForTest(): void {
    this.tickets.clear();
    if (this.storageFilePath && fs.existsSync(this.storageFilePath)) {
      try {
        fs.unlinkSync(this.storageFilePath);
      } catch (err) {
        // ignore in test
      }
    }
  }
}

// Default singleton for application runtime
let defaultKdsServiceInstance: KdsService | null = null;

export function getKdsService(options?: KdsServiceOptions): KdsService {
  if (!defaultKdsServiceInstance) {
    defaultKdsServiceInstance = new KdsService(options);
  }
  return defaultKdsServiceInstance;
}
