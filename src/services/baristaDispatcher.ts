/**
 * CAFE OS — Barista Bar Webhook & Real-Time Event Dispatcher
 * Triggered on successful payment ('PAID' state) to notify the coffee bar / barista screen.
 */

import { OrderAggregate } from '../types/order-domain';

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

type BaristaTicketListener = (tickets: BaristaOrderTicket[]) => void;

class BaristaDispatcher {
  private tickets: BaristaOrderTicket[] = [];
  private listeners: Set<BaristaTicketListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.initBroadcast();
    this.loadInitialTickets();
  }

  private initBroadcast(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('cafeos_barista_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'NEW_ORDER') {
            const ticket = event.data.ticket as BaristaOrderTicket;
            if (!this.tickets.some((t) => t.orderId === ticket.orderId)) {
              this.tickets = [ticket, ...this.tickets];
              this.notify();
              this.playBaristaChime();
            }
          } else if (event.data?.type === 'STATUS_CHANGE') {
            const { orderId, prepStatus } = event.data;
            this.updateLocalStatus(orderId, prepStatus, false);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization failed:', err);
      }
    }
  }

  private loadInitialTickets(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('cafeos_barista_tickets');
        if (saved) {
          this.tickets = JSON.parse(saved);
        }
      } catch {
        // ignore
      }
    }
  }

  private saveTickets(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('cafeos_barista_tickets', JSON.stringify(this.tickets.slice(0, 50)));
      } catch {
        // ignore
      }
    }
  }

  /**
   * Generates a 2-tone melodic chime using Web Audio API (no external MP3 asset needed)
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
   * Dispatches an order to the barista bar and sends external webhook payload
   */
  public async dispatchPaidOrder(order: OrderAggregate): Promise<BaristaOrderTicket> {
    const baristaItems: BaristaOrderItem[] = order.items.map((item) => ({
      itemName: item.itemNameSnapshot,
      quantity: item.quantity,
      modifiers: item.modifiers ? item.modifiers.map((m) => m.nameFa) : [],
      notes: item.notes,
    }));

    const ticket: BaristaOrderTicket = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientGeneratedId: order.clientGeneratedId,
      tenantId: order.tenantId,
      orderType: order.orderType,
      tableLabel: order.tableLabel,
      customerName: order.customerName,
      items: baristaItems,
      paidAt: new Date().toISOString(),
      prepStatus: 'PENDING',
    };

    // Prepend to ticket list (preventing duplicates)
    if (!this.tickets.some((t) => t.orderId === ticket.orderId)) {
      this.tickets = [ticket, ...this.tickets];
      this.saveTickets();
      this.notify();
    }

    // Play pleasant chime
    this.playBaristaChime();

    // Broadcast to other tabs (Barista screen or POS)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'NEW_ORDER',
          ticket,
        });
      } catch (e) {
        console.warn('Broadcast failed:', e);
      }
    }

    // Send Webhook to Barista endpoint
    this.sendWebhookPayload(order.tenantId, ticket).catch((err) => {
      console.warn('Barista webhook dispatch non-fatal error:', err);
    });

    return ticket;
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
    } catch (err) {
      // Offline or local dev environment - gracefully handled
      console.info('Webhook dispatched locally (offline or development mode).');
    }
  }

  public updatePrepStatus(orderId: string, prepStatus: 'PENDING' | 'IN_PREP' | 'READY'): void {
    this.updateLocalStatus(orderId, prepStatus, true);
  }

  private updateLocalStatus(orderId: string, prepStatus: 'PENDING' | 'IN_PREP' | 'READY', broadcast: boolean): void {
    this.tickets = this.tickets.map((t) => {
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

    this.saveTickets();
    this.notify();

    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'STATUS_CHANGE',
          orderId,
          prepStatus,
        });
      } catch {
        // ignore
      }
    }
  }

  public getTickets(): BaristaOrderTicket[] {
    return [...this.tickets];
  }

  public getActiveCount(): number {
    return this.tickets.filter((t) => t.prepStatus !== 'READY').length;
  }

  public subscribe(listener: BaristaTicketListener): () => void {
    this.listeners.add(listener);
    listener([...this.tickets]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener([...this.tickets]);
      } catch (err) {
        console.error('Error notifying barista listener:', err);
      }
    }
  }
}

export const baristaDispatcher = new BaristaDispatcher();
