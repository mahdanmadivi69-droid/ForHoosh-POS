/**
 * CAFE OS — Real-Time WebSocket & Event Broadcaster Server
 * Handles multi-tenant socket broadcasts, role-based targeted notifications (Barista, Manager),
 * and live inventory overdraft incident alerting.
 */

export interface BroadcastMessage {
  tenantId: string;
  role?: string;
  event: string;
  payload: any;
  timestamp: string;
}

type MessageListener = (message: BroadcastMessage) => void;

class WebSocketServerManager {
  private events: Map<string, Set<Function>> = new Map();
  private listenersList: Set<MessageListener> = new Set();
  private recentMessages: BroadcastMessage[] = [];
  private instanceId: string = Math.random().toString(36).substring(2, 9);
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.initBroadcastChannel();
  }

  public on(event: string, fn: Function): this {
    let set = this.events.get(event);
    if (!set) {
      set = new Set();
      this.events.set(event, set);
    }
    set.add(fn);
    return this;
  }

  public off(event: string, fn: Function): this {
    const set = this.events.get(event);
    if (set) {
      set.delete(fn);
      if (set.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  private emit(event: string, ...args: any[]): boolean {
    const set = this.events.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of set) {
      try {
        listener(...args);
      } catch (err) {
        console.error(`Error in websocket listener for event "${event}":`, err);
      }
    }
    return true;
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('cafeos_events_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.origin !== this.instanceId && event.data.message) {
            this.dispatchLocally(event.data.message, false);
          }
        };
      } catch (err) {
        console.warn('Failed to init cross-tab BroadcastChannel in WebSocketServerManager:', err);
      }
    }
  }

  private dispatchLocally(message: BroadcastMessage, shouldBroadcastToChannel = true): void {
    this.recentMessages.unshift(message);
    if (this.recentMessages.length > 100) {
      this.recentMessages.pop();
    }

    this.emit(`tenant:${message.tenantId}`, message);
    if (message.role) {
      this.emit(`tenant:${message.tenantId}:role:${message.role}`, message);
    }
    this.emit(`event:${message.event}`, message);
    this.emit('broadcast', message);

    for (const listener of this.listenersList) {
      try {
        listener(message);
      } catch (err) {
        console.error('Error in websocket listener:', err);
      }
    }

    if (shouldBroadcastToChannel && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          origin: this.instanceId,
          message,
        });
      } catch (err) {
        console.warn('Failed to post to BroadcastChannel:', err);
      }
    }
  }

  /**
   * Broadcasts an event to all connected clients within a specific tenant (e.g. Barista bar, Cashier counter)
   */
  public broadcastToTenant(tenantId: string, event: string, data: any): void {
    const message: BroadcastMessage = {
      tenantId,
      event,
      payload: data,
      timestamp: new Date().toISOString(),
    };
    this.dispatchLocally(message, true);
  }

  /**
   * Broadcasts an event to clients with a specific role in a tenant (e.g. MANAGER, CASHIER, BARISTA)
   */
  public broadcastToRole(tenantId: string, role: string, event: string, data: any): void {
    const message: BroadcastMessage = {
      tenantId,
      role,
      event,
      payload: data,
      timestamp: new Date().toISOString(),
    };
    this.dispatchLocally(message, true);
  }

  /**
   * Subscribes to all broadcast messages
   */
  public subscribe(listener: MessageListener): () => void {
    this.listenersList.add(listener);
    return () => {
      this.listenersList.delete(listener);
    };
  }

  /**
   * Subscribes to messages of a specific event
   */
  public subscribeToEvent(event: string, listener: (payload: any, message: BroadcastMessage) => void): () => void {
    const wrappedListener: MessageListener = (msg) => {
      if (msg.event === event) {
        listener(msg.payload, msg);
      }
    };
    return this.subscribe(wrappedListener);
  }

  public getRecentMessages(tenantId?: string): BroadcastMessage[] {
    if (tenantId) {
      return this.recentMessages.filter((m) => m.tenantId === tenantId);
    }
    return [...this.recentMessages];
  }

  public clearRecentMessages(): void {
    this.recentMessages = [];
  }
}

export const websocketServer = new WebSocketServerManager();
