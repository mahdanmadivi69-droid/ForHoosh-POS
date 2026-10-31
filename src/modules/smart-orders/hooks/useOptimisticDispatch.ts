import { useState, useCallback } from 'react';
import { SmartTicket, OrderStatus } from '../types';

export interface OptimisticDispatchOptions {
  onSuccess?: (ticketId: string, newStatus: OrderStatus) => void;
  onError?: (ticketId: string, error: Error) => void;
}

export function useOptimisticDispatch(
  initialTickets: SmartTicket[],
  syncFn: (ticketId: string, nextStatus: OrderStatus) => Promise<void>,
  options: OptimisticDispatchOptions = {}
) {
  const [tickets, setTickets] = useState<SmartTicket[]>(initialTickets);
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());

  const advanceTicketStatus = useCallback(
    async (ticketId: string, nextStatus: OrderStatus) => {
      let previousTicket: SmartTicket | undefined;

      // 1. Instant optimistic update (<1ms)
      setTickets((prev) => {
        return prev.map((t) => {
          if (t.id === ticketId) {
            previousTicket = { ...t };
            return { ...t, status: nextStatus };
          }
          return t;
        });
      });

      if (!previousTicket) return;

      setInFlightIds((prev) => new Set(prev).add(ticketId));

      try {
        // 2. Perform async backend dispatch
        await syncFn(ticketId, nextStatus);
        options.onSuccess?.(ticketId, nextStatus);
      } catch (err: any) {
        // 3. Rollback immediately on failure
        const rollbackTicket = previousTicket;
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? rollbackTicket : t))
        );
        options.onError?.(
          ticketId,
          err instanceof Error ? err : new Error(String(err))
        );
      } finally {
        setInFlightIds((prev) => {
          const next = new Set(prev);
          next.delete(ticketId);
          return next;
        });
      }
    },
    [syncFn, options]
  );

  return {
    tickets,
    setTickets,
    inFlightIds,
    advanceTicketStatus,
  };
}
