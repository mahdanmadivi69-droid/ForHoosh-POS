/**
 * CAFE OS — Barista Bar Webhook & Real-Time Event Dispatcher
 * Triggered on successful payment ('PAID' state) to notify the coffee bar / barista screen.
 * Multi-Tenant Isolation & Scoped BroadcastChannel (Phase 1 Remediation)
 */

import { OrderAggregate } from '../types/order-domain';
import { SmartOrdersStore } from './storage';

export interface BaristaOrderItem {
  itemName: string;
  quantity: number;
  modifiers: string[];
  notes?: string;
}

export interface BaristaOrderTicket {
  orderId: string;
  orderNumber: number;
  clientGeneratedId: string;
  tenantId: string;
  orderType: string;
  tableLabel?: string;
  customerName?: string;
  items: BaristaOrderItem[];
  paidAt: string;
  prepStatus: 'PENDING' | 'IN_PREP' | 'READY';
  startedAt?: string;
  completedAt?: string;
}

export interface BaristaWebhookPayload {
  event: 'ORDER_PAID' | 'ORDER_FULFILLED' | 'ORDER_CANCELLED';
  timestamp: string;
  tenantId: string;
  ticket: BaristaOrderTicket;
}

export const VALID_TENANT_IDS = ['tenant-100hich-01', 'tenant-modendo-01'] as const;
export type ValidTenantId = typeof VALID_TENANT_IDS[number];

export function isValidTenantId(id: unknown): id is ValidTenantId {
  return typeof id === 'string' && (VALID_TENANT_IDS as readonly string[]).includes(id.trim());
}

export const BARISTA_STORAGE_KEYS = {
  TICKETS: (tenantId: string) => `cafeos_barista_tickets_${tenantId}`,
  CHANNEL_NAME: (tenantId: string) => `cafeos_barista_channel_${tenantId}`,
  LEGACY_TICKETS: 'cafeos_barista_tickets',
  LEGACY_BACKUP: 'cafeos_barista_tickets_legacy_backup',
  MIGRATION_LOG: 'cafeos_barista_migration_log',
};

type BaristaTicketListener = (tickets: BaristaOrderTicket[], tenantId?: string) => void;

export class BaristaDispatcher {
  private tenantTickets: Map<string, BaristaOrderTicket[]> = new Map();
  private listeners: Set<{ listener: BaristaTicketListener; tenantId?: string }> = new Set();
  private channels: Map<string, BroadcastChannel> = new Map();
  private currentTenantId: string | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.migrateLegacyData();
    // Invariant: Do not eagerly bind or initialize channels for any default tenant.
    // Broadcast channels and ticket caches are initialized on-demand upon explicit valid tenant context.
  }

  /**
   * Resolves tenant ID using verified canonical sources without unsafe silent fallback:
   * 1. Explicit override parameter (if valid)
   * 2. Injected dispatcher context (this.currentTenantId, if valid)
   * 3. Canonical store active tenant (SmartOrdersStore.getActiveTenantId(), if valid)
   * Returns null if tenant context is missing or invalid. Never silently defaults to either cafe.
   */
  public resolveTenantId(overrideTenantId?: string): ValidTenantId | null {
    // 1. Explicit override passed
    if (overrideTenantId !== undefined) {
      if (typeof overrideTenantId === 'string' && isValidTenantId(overrideTenantId.trim())) {
        return overrideTenantId.trim() as ValidTenantId;
      }
      // Explicit override was provided but is invalid: fail safely, never fall back!
      return null;
    }

    // 2. Injected dispatcher context
    if (this.currentTenantId && isValidTenantId(this.currentTenantId)) {
      return this.currentTenantId as ValidTenantId;
    }

    // 3. Canonical storage key directly (smartorders_active_tenant_id_v2)
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const raw = localStorage.getItem('smartorders_active_tenant_id_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'string' && isValidTenantId(parsed.trim())) {
            return parsed.trim() as ValidTenantId;
          }
        }
      } catch {
        // ignore
      }
    }

    // Missing tenant context
    return null;
  }

  /**
   * Returns the active tenant ID or throws an explicit error.
   * Eliminates unsafe implicit fallback to 100 HICH.
   */
  public getActiveTenantId(overrideTenantId?: string): string {
    const resolved = this.resolveTenantId(overrideTenantId);
    if (!resolved) {
      throw new Error(
        `[BaristaDispatcher] Missing or invalid tenant context (received: "${overrideTenantId}"). ` +
        `Implicit tenant fallback is disabled to prevent cross-tenant order leakage.`
      );
    }
    return resolved;
  }

  public setTenantContext(tenantId: string): void {
    if (!isValidTenantId(tenantId)) {
      throw new Error(`[BaristaDispatcher] Cannot set invalid tenant context: "${tenantId}"`);
    }
    this.currentTenantId = tenantId.trim() as ValidTenantId;
    this.initBroadcastForTenant(this.currentTenantId);
    this.loadTicketsForTenant(this.currentTenantId);
    this.notify(this.currentTenantId);
  }

  public clearTenantContext(): void {
    this.currentTenantId = null;
  }

  public getBroadcastChannel(tenantId?: string): BroadcastChannel | null {
    const tId = this.resolveTenantId(tenantId);
    if (!tId) return null;
    return this.initBroadcastForTenant(tId);
  }

  private initBroadcastForTenant(tenantId: string): BroadcastChannel | null {
    if (!isValidTenantId(tenantId)) return null;
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;

    if (!this.channels.has(tenantId)) {
      try {
        const channelName = BARISTA_STORAGE_KEYS.CHANNEL_NAME(tenantId);
        const ch = new BroadcastChannel(channelName);
        ch.onmessage = (event) => this.handleChannelMessage(event, tenantId);
        this.channels.set(tenantId, ch);
      } catch (err) {
        console.warn(`[BaristaDispatcher] BroadcastChannel initialization failed for ${tenantId}:`, err);
        return null;
      }
    }
    return this.channels.get(tenantId) || null;
  }

  private handleChannelMessage(event: MessageEvent, channelTenantId: string): void {
    if (!isValidTenantId(channelTenantId)) return;
    if (!event.data) return;

    if (event.data.type === 'NEW_ORDER') {
      const ticket = event.data.ticket as BaristaOrderTicket;
      // Strict Cross-Tenant Security Gate: Drop any ticket that does not match this channel's tenant
      if (!ticket || !isValidTenantId(ticket.tenantId) || ticket.tenantId !== channelTenantId) {
        console.warn(
          `[BaristaDispatcher] SECURITY: Rejected cross-tenant ticket on channel ${channelTenantId}:`,
          ticket?.tenantId
        );
        return;
      }

      this.loadTicketsForTenant(channelTenantId);
      const tickets = this.tenantTickets.get(channelTenantId) || [];
      if (!tickets.some((t) => t.orderId === ticket.orderId)) {
        const updated = [ticket, ...tickets];
        this.tenantTickets.set(channelTenantId, updated);
        this.saveTickets(channelTenantId);
        this.notify(channelTenantId);
        this.playBaristaChime();
      }
    } else if (event.data.type === 'STATUS_CHANGE') {
      const { orderId, prepStatus, tenantId } = event.data;
      if (!tenantId || !isValidTenantId(tenantId) || tenantId !== channelTenantId) {
        console.warn(
          `[BaristaDispatcher] SECURITY: Rejected cross-tenant status change on channel ${channelTenantId}:`,
          tenantId
        );
        return;
      }
      this.updateLocalStatus(orderId, prepStatus, false, channelTenantId);
    }
  }

  private loadTicketsForTenant(tenantId: string): void {
    if (!isValidTenantId(tenantId)) return;
    if (this.tenantTickets.has(tenantId)) return;

    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const saved = localStorage.getItem(BARISTA_STORAGE_KEYS.TICKETS(tenantId));
        if (saved) {
          this.tenantTickets.set(tenantId, JSON.parse(saved));
        } else {
          this.tenantTickets.set(tenantId, []);
        }
      } catch {
        this.tenantTickets.set(tenantId, []);
      }
    } else {
      this.tenantTickets.set(tenantId, []);
    }
  }

  private saveTickets(tenantId: string): void {
    if (!isValidTenantId(tenantId)) return;
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const list = this.tenantTickets.get(tenantId) || [];
        localStorage.setItem(
          BARISTA_STORAGE_KEYS.TICKETS(tenantId),
          JSON.stringify(list.slice(0, 50))
        );
      } catch {
        // ignore
      }
    }
  }

  /**
   * Safe, Idempotent Legacy Migration for Barista KDS Tickets:
   * Migrates un-scoped `cafeos_barista_tickets`.
   * Verified Ownership: Preserves existing tickets into their respective tenantId (or 100 HICH).
   */
  public migrateLegacyData(): {
    migrated: boolean;
    ticketCount: number;
    targetTenant: string;
    message: string;
  } {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return {
        migrated: false,
        ticketCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'No localStorage available.',
      };
    }

    const legacy = localStorage.getItem(BARISTA_STORAGE_KEYS.LEGACY_TICKETS);
    const target100HichKey = BARISTA_STORAGE_KEYS.TICKETS('tenant-100hich-01');
    const existing100Hich = localStorage.getItem(target100HichKey);

    if (existing100Hich) {
      return {
        migrated: false,
        ticketCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'Tenant-scoped barista tickets already exist; migration skipped.',
      };
    }

    if (!legacy) {
      return {
        migrated: false,
        ticketCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: 'No legacy barista tickets found.',
      };
    }

    try {
      const parsed: BaristaOrderTicket[] = JSON.parse(legacy);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return {
          migrated: false,
          ticketCount: 0,
          targetTenant: 'tenant-100hich-01',
          message: 'Legacy tickets store empty.',
        };
      }

      // 1. Create a safe, permanent backup of legacy tickets
      localStorage.setItem(BARISTA_STORAGE_KEYS.LEGACY_BACKUP, legacy);

      // 2. Partition by tenantId or assign to 100 HICH
      const hichTickets: BaristaOrderTicket[] = [];
      const modendoTickets: BaristaOrderTicket[] = [];

      parsed.forEach((t) => {
        if (t.tenantId === 'tenant-modendo-01') {
          modendoTickets.push(t);
        } else {
          hichTickets.push({ ...t, tenantId: 'tenant-100hich-01' });
        }
      });

      if (hichTickets.length > 0) {
        localStorage.setItem(target100HichKey, JSON.stringify(hichTickets));
        this.tenantTickets.set('tenant-100hich-01', hichTickets);
      }
      if (modendoTickets.length > 0) {
        localStorage.setItem(BARISTA_STORAGE_KEYS.TICKETS('tenant-modendo-01'), JSON.stringify(modendoTickets));
        this.tenantTickets.set('tenant-modendo-01', modendoTickets);
      }

      // 3. Log migration audit record
      const logRecord = {
        timestamp: new Date().toISOString(),
        legacyCount: parsed.length,
        hichCount: hichTickets.length,
        modendoCount: modendoTickets.length,
        status: 'SUCCESS',
      };
      localStorage.setItem(BARISTA_STORAGE_KEYS.MIGRATION_LOG, JSON.stringify(logRecord));

      return {
        migrated: true,
        ticketCount: parsed.length,
        targetTenant: 'tenant-100hich-01',
        message: `Successfully migrated ${parsed.length} barista tickets to scoped stores.`,
      };
    } catch (err: any) {
      console.error('Failed to migrate legacy barista tickets:', err);
      return {
        migrated: false,
        ticketCount: 0,
        targetTenant: 'tenant-100hich-01',
        message: `Migration failed: ${err?.message}`,
      };
    }
  }

  /**
   * Rollback legacy migration: restores legacy un-scoped tickets from backup
   */
  public rollbackLegacyMigration(): boolean {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    try {
      const backup = localStorage.getItem(BARISTA_STORAGE_KEYS.LEGACY_BACKUP);
      if (backup) {
        localStorage.setItem(BARISTA_STORAGE_KEYS.LEGACY_TICKETS, backup);
        localStorage.removeItem(BARISTA_STORAGE_KEYS.TICKETS('tenant-100hich-01'));
        this.tenantTickets.delete('tenant-100hich-01');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generates a 2-tone melodic chime using Web Audio API
   */
  public playBaristaChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: 880 Hz (A5)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.15);
      gain2.gain.setValueAtTime(0.2, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio chime playback ignored:', e);
    }
  }

  /**
   * Dispatches an order to the barista bar with validated tenant context.
   */
  public async dispatchOrder(order: any, tenantId?: string): Promise<BaristaOrderTicket> {
    const candidate = order?.tenantId || tenantId || (this.currentTenantId && isValidTenantId(this.currentTenantId) ? this.currentTenantId : undefined);
    if (!candidate || !isValidTenantId(candidate)) {
      throw new Error(
        `[BaristaDispatcher] Missing or invalid tenant context on order dispatch (candidate: "${candidate}"). ` +
        `Order cannot be dispatched without verified tenant identity.`
      );
    }

    const tId = candidate.trim() as ValidTenantId;
    this.loadTicketsForTenant(tId);

    const baristaItems: BaristaOrderItem[] = (order.items || []).map((item: any) => ({
      itemName: item.itemNameSnapshot || item.title || 'آیتم',
      quantity: item.quantity || 1,
      modifiers: item.modifiers ? item.modifiers.map((m: any) => (typeof m === 'string' ? m : m.nameFa || m.id || '')) : [],
      notes: item.notes,
    }));

    const ticket: BaristaOrderTicket = {
      orderId: order.id,
      orderNumber: order.orderNumber || (Date.now() % 10000),
      clientGeneratedId: order.clientGeneratedId || order.id,
      tenantId: tId,
      orderType: order.orderType || 'DINE_IN',
      tableLabel: order.tableLabel,
      customerName: order.customerName,
      items: baristaItems,
      paidAt: new Date().toISOString(),
      prepStatus: 'PENDING',
    };

    const tickets = this.tenantTickets.get(tId) || [];
    if (!tickets.some((t) => t.orderId === ticket.orderId)) {
      const updated = [ticket, ...tickets];
      this.tenantTickets.set(tId, updated);
      this.saveTickets(tId);
      this.notify(tId);
    }

    this.playBaristaChime();

    // Broadcast strictly to this tenant's BroadcastChannel
    const ch = this.initBroadcastForTenant(tId);
    if (ch) {
      try {
        ch.postMessage({
          type: 'NEW_ORDER',
          ticket,
        });
      } catch (e) {
        console.warn(`[BaristaDispatcher] Broadcast failed for ${tId}:`, e);
      }
    }

    // Send Webhook with tenant scoping
    this.sendWebhookPayload(tId, ticket).catch((err) => {
      console.warn('Barista webhook dispatch non-fatal error:', err);
    });

    return ticket;
  }

  public async dispatchPaidOrder(order: OrderAggregate, tenantId?: string): Promise<BaristaOrderTicket> {
    return this.dispatchOrder(order, tenantId);
  }

  private async sendWebhookPayload(tenantId: string, ticket: BaristaOrderTicket): Promise<void> {
    const payload: BaristaWebhookPayload = {
      event: 'ORDER_PAID',
      timestamp: new Date().toISOString(),
      tenantId,
      ticket,
    };

    const webhookUrl =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('cafeos_barista_webhook_url') || '/api/v1/barista/incoming'
        : '/api/v1/barista/incoming';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`Barista webhook endpoint returned HTTP ${response.status}`);
      }
    } catch {
      console.info('Webhook dispatched locally (offline or development mode).');
    }
  }

  public updatePrepStatus(
    orderId: string,
    prepStatus: 'PENDING' | 'IN_PREP' | 'READY',
    tenantId?: string
  ): void {
    const tId = this.resolveTenantId(tenantId);
    if (!tId) {
      throw new Error(
        `[BaristaDispatcher] Missing or invalid tenant context on updatePrepStatus (tenantId: "${tenantId}"). ` +
        `Status update rejected.`
      );
    }
    this.updateLocalStatus(orderId, prepStatus, true, tId);
  }

  private updateLocalStatus(
    orderId: string,
    prepStatus: 'PENDING' | 'IN_PREP' | 'READY',
    broadcast: boolean,
    tenantId: string
  ): void {
    this.loadTicketsForTenant(tenantId);
    const tickets = this.tenantTickets.get(tenantId) || [];

    const updated = tickets.map((t) => {
      if (t.orderId === orderId) {
        return {
          ...t,
          prepStatus,
          startedAt: prepStatus === 'IN_PREP' && !t.startedAt ? new Date().toISOString() : t.startedAt,
          completedAt: prepStatus === 'READY' ? new Date().toISOString() : t.completedAt,
        };
      }
      return t;
    });

    this.tenantTickets.set(tenantId, updated);
    this.saveTickets(tenantId);
    this.notify(tenantId);

    if (broadcast) {
      const ch = this.initBroadcastForTenant(tenantId);
      if (ch) {
        try {
          ch.postMessage({
            type: 'STATUS_CHANGE',
            orderId,
            prepStatus,
            tenantId,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  public getTickets(tenantId?: string): BaristaOrderTicket[] {
    const tId = this.resolveTenantId(tenantId);
    if (!tId) {
      console.warn('[BaristaDispatcher] getTickets called without valid tenant context.');
      return [];
    }
    this.loadTicketsForTenant(tId);
    return [...(this.tenantTickets.get(tId) || [])];
  }

  public getActiveCount(tenantId?: string): number {
    const tId = this.resolveTenantId(tenantId);
    if (!tId) return 0;
    this.loadTicketsForTenant(tId);
    const tickets = this.tenantTickets.get(tId) || [];
    return tickets.filter((t) => t.prepStatus !== 'READY').length;
  }

  /**
   * Subscribes a listener to tickets for a specific tenant.
   * If tenantId is omitted, resolves from active context or fails safely.
   */
  public subscribe(listener: BaristaTicketListener, tenantId?: string): () => void {
    const tId = this.resolveTenantId(tenantId);
    if (!tId) {
      console.warn('[BaristaDispatcher] subscribe called without valid tenant context. No tickets delivered.');
      try {
        listener([], '');
      } catch (err) {
        console.error('Error invoking barista listener on invalid tenant:', err);
      }
      return () => {};
    }

    const entry = { listener, tenantId: tId };
    this.listeners.add(entry);
    this.loadTicketsForTenant(tId);
    listener([...(this.tenantTickets.get(tId) || [])], tId);
    return () => {
      this.listeners.delete(entry);
    };
  }

  private notify(tenantId: string): void {
    if (!isValidTenantId(tenantId)) return;
    const tickets = [...(this.tenantTickets.get(tenantId) || [])];
    for (const entry of this.listeners) {
      if (entry.tenantId === tenantId) {
        try {
          entry.listener(tickets, tenantId);
        } catch (err) {
          console.error(`Error notifying barista listener for tenant ${tenantId}:`, err);
        }
      }
    }
  }

  public closeChannel(tenantId?: string): void {
    const tId = this.resolveTenantId(tenantId);
    if (!tId) return;
    const ch = this.channels.get(tId);
    if (ch) {
      ch.close();
      this.channels.delete(tId);
    }
  }

  public closeAllChannels(): void {
    for (const [tId, ch] of this.channels.entries()) {
      ch.close();
    }
    this.channels.clear();
  }
}

export const baristaDispatcher = new BaristaDispatcher();
