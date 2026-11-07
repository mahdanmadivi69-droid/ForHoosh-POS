// src/services/invoiceSequence.ts

import { Order } from '../types/domain';

function getSequenceKey(tenantId: string): string {
  return `cafeos_invoice_seq_${tenantId}`;
}

const inMemoryFallback = new Map<string, number>();

/**
 * P1-4: Monotonic invoice number generator per tenant.
 * Guarantees unique, monotonically increasing order numbers even if orders
 * are deleted, backups with gaps are restored, or the database is cleared.
 */
export class InvoiceSequenceService {
  /**
   * Reconciles the persisted sequence counter with existing orders on boot or after restore.
   * Ensures the sequence counter is at least Math.max(...existing orderNumbers).
   */
  static reconcile(tenantId: string, existingOrders: Order[]): number {
    const key = getSequenceKey(tenantId);
    let currentSeq = inMemoryFallback.get(key) || 0;

    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          currentSeq = Math.max(currentSeq, parseInt(raw, 10) || 0);
        }
      } catch {
        // ignore
      }
    }

    const maxOrderNumber = existingOrders.reduce((max, ord) => {
      const num = typeof ord.orderNumber === 'number' ? ord.orderNumber : parseInt(String(ord.orderNumber), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);

    const reconciled = Math.max(currentSeq, maxOrderNumber);
    inMemoryFallback.set(key, reconciled);

    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        localStorage.setItem(key, String(reconciled));
      } catch {
        // ignore
      }
    }

    return reconciled;
  }

  /**
   * Monotonically increments and persists the invoice number counter before order creation.
   * Ensures gaps or deleted orders never result in reused invoice numbers.
   */
  static nextOrderNumber(tenantId: string, existingOrders: Order[]): number {
    const key = getSequenceKey(tenantId);
    let currentSeq = inMemoryFallback.get(key) || 0;

    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          currentSeq = Math.max(currentSeq, parseInt(raw, 10) || 0);
        }
      } catch {
        // ignore
      }
    }

    const maxOrderNumber = existingOrders.reduce((max, ord) => {
      const num = typeof ord.orderNumber === 'number' ? ord.orderNumber : parseInt(String(ord.orderNumber), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);

    const baseSeq = Math.max(currentSeq, maxOrderNumber);
    const nextSeq = baseSeq + 1;

    inMemoryFallback.set(key, nextSeq);

    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        localStorage.setItem(key, String(nextSeq));
      } catch (err) {
        console.error('[InvoiceSequence] Failed to persist invoice sequence:', err);
      }
    }

    return nextSeq;
  }

  /**
   * Returns current sequence without incrementing.
   */
  static getCurrentSequence(tenantId: string): number {
    const key = getSequenceKey(tenantId);
    let currentSeq = inMemoryFallback.get(key) || 0;
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          currentSeq = Math.max(currentSeq, parseInt(raw, 10) || 0);
        }
      } catch {
        // ignore
      }
    }
    return currentSeq;
  }

  /**
   * Reset helper for testing
   */
  static _resetForTest(tenantId?: string): void {
    if (tenantId) {
      inMemoryFallback.delete(getSequenceKey(tenantId));
      if (typeof localStorage !== 'undefined' && localStorage) {
        try {
          localStorage.removeItem(getSequenceKey(tenantId));
        } catch {
          // ignore
        }
      }
    } else {
      inMemoryFallback.clear();
      if (typeof localStorage !== 'undefined' && localStorage) {
        try {
          const toRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('cafeos_invoice_seq_')) toRemove.push(k);
          }
          toRemove.forEach((k) => localStorage.removeItem(k));
        } catch {
          // ignore
        }
      }
    }
  }
}
