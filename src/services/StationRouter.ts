/**
 * CAFE OS — Station Router & Delta Ordering Engine
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0
 *
 * Responsibilities:
 *  1. Automatic splitting of order items by preparation department ('BAR' vs 'KITCHEN').
 *  2. Station category and tag mappings.
 *  3. Item state machine ('PENDING_DISPATCH' -> 'DISPATCHED' -> 'PREPARING' -> 'SERVED' -> 'SETTLED').
 *  4. Delta Print suppression: only newly added items are sent to thermal printer & KDS
 *     so the kitchen/barista never duplicate tickets or prepare already-served dishes.
 *  5. Flagging supplemental dispatches with header "سفارش تکمیلی / ADDITIONAL ORDER".
 */

export type PrepStation = 'BAR' | 'KITCHEN';

export type ItemState =
  | 'PENDING_DISPATCH'
  | 'DISPATCHED'
  | 'PREPARING'
  | 'SERVED'
  | 'SETTLED';

export const STATION_MAPPINGS: Record<PrepStation, readonly string[]> = {
  BAR: ['espresso', 'pour_over', 'cold_brew', 'tea', 'mocktails'],
  KITCHEN: ['bakery', 'sandwiches', 'warm_food', 'pastry'],
} as const;

export const DELTA_ORDERING_RULES = {
  track_dispatched_items: true,
  suppress_duplicate_prints: true,
  header_flag_for_delta: 'سفارش تکمیلی / ADDITIONAL ORDER',
} as const;

export interface RoutableCartItem {
  id: string;
  menuItemId?: string;
  title: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  modifiers?: Array<{ id?: string; nameFa: string; priceDelta?: number } | string>;
  notes?: string | string[];
  station?: PrepStation;
  categoryId?: string;
  status?: ItemState;
  dispatchedAt?: string;
}

export interface TicketContext {
  id: string;
  ticketId?: string | number;
  orderNumber?: number;
  tableLabel?: string;
  cashierName?: string;
  orderNotes?: string;
  timeStr?: string;
}

export interface StationDispatchTicket {
  station: PrepStation;
  stationTitle: string;
  ticketId: string | number;
  orderNumber: number;
  tableLabel: string;
  cashierName: string;
  timeStr: string;
  items: RoutableCartItem[];
  orderNotes?: string;
  isDelta: boolean;
  deltaHeaderFlag?: string;
}

export interface SplitTicketResult {
  isDelta: boolean;
  deltaHeaderFlag?: string;
  barTicket: StationDispatchTicket;
  kitchenTicket: StationDispatchTicket;
  hasBarItems: boolean;
  hasKitchenItems: boolean;
  hasItemsToDispatch: boolean;
  newDispatchedIds: string[];
  totalItemsDispatched: number;
}

export class StationRouter {
  /**
   * Resolves the target station ('BAR' | 'KITCHEN') for a given cart item.
   * Priority:
   *  1. Explicit item.station tag ('BAR' | 'KITCHEN')
   *  2. Category ID / Name matching STATION_MAPPINGS
   *  3. Keyword heuristics on item title
   *  4. Default fallback: 'BAR'
   */
  public static resolveStation(item: Partial<RoutableCartItem>): PrepStation {
    if (item.station === 'BAR' || item.station === 'KITCHEN') {
      return item.station;
    }

    const testString = `${item.categoryId || ''} ${item.title || ''}`.toLowerCase();

    // Check Kitchen mappings
    const isKitchen = STATION_MAPPINGS.KITCHEN.some((kw) => testString.includes(kw)) ||
      /بیکری|شیرینی|کیک|ساندویچ|غذا|پستو|پنینی|تست|کروسان|چیزکیک|کوکی|پیراشکی/i.test(testString);

    if (isKitchen) {
      return 'KITCHEN';
    }

    // Check Bar mappings or default
    return 'BAR';
  }

  /**
   * Returns a friendly localized title for a preparation station.
   */
  public static getStationTitle(station: PrepStation): string {
    return station === 'BAR'
      ? 'بار قهوه و نوشیدنی / BARISTA'
      : 'آشپزخانه و بیکری / KITCHEN';
  }

  /**
   * Splits a collection of cart items into BAR and KITCHEN dispatch tickets,
   * applying Delta Print filtering:
   *  - Items already dispatched (in alreadyDispatchedIds) are suppressed.
   *  - If there were previously dispatched items and new items exist, isDelta is set to true.
   *  - Header flag "سفارش تکمیلی / ADDITIONAL ORDER" is attached on delta tickets.
   */
  public static splitTicket(
    cartItems: RoutableCartItem[],
    alreadyDispatchedIds?: string[] | Set<string>,
    context?: Partial<TicketContext>
  ): SplitTicketResult {
    const dispatchedSet = new Set<string>(
      Array.isArray(alreadyDispatchedIds)
        ? alreadyDispatchedIds
        : alreadyDispatchedIds
        ? Array.from(alreadyDispatchedIds)
        : []
    );

    // Delta tracking: Filter out items already dispatched
    const itemsToDispatch = cartItems.filter((item) => {
      if (item.status === 'DISPATCHED' || item.status === 'SERVED' || item.status === 'SETTLED') {
        return false;
      }
      return !dispatchedSet.has(item.id);
    });

    const hasPreviousDispatches = dispatchedSet.size > 0;
    const isDelta = hasPreviousDispatches && itemsToDispatch.length > 0;
    const deltaHeaderFlag = isDelta ? DELTA_ORDERING_RULES.header_flag_for_delta : undefined;

    const barItems: RoutableCartItem[] = [];
    const kitchenItems: RoutableCartItem[] = [];

    for (const item of itemsToDispatch) {
      const station = this.resolveStation(item);
      const taggedItem: RoutableCartItem = {
        ...item,
        station,
        status: 'PENDING_DISPATCH',
      };

      if (station === 'BAR') {
        barItems.push(taggedItem);
      } else {
        kitchenItems.push(taggedItem);
      }
    }

    const ticketId = context?.ticketId || context?.orderNumber || (context?.id ? context.id.slice(-6) : 'T-101');
    const orderNumber = context?.orderNumber || (typeof ticketId === 'number' ? ticketId : 101);
    const tableLabel = context?.tableLabel || 'میز سالن';
    const cashierName = context?.cashierName || 'صندوقدار';
    const timeStr = context?.timeStr || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const orderNotes = context?.orderNotes;

    const barTicket: StationDispatchTicket = {
      station: 'BAR',
      stationTitle: this.getStationTitle('BAR'),
      ticketId,
      orderNumber,
      tableLabel,
      cashierName,
      timeStr,
      items: barItems,
      orderNotes,
      isDelta,
      deltaHeaderFlag,
    };

    const kitchenTicket: StationDispatchTicket = {
      station: 'KITCHEN',
      stationTitle: this.getStationTitle('KITCHEN'),
      ticketId,
      orderNumber,
      tableLabel,
      cashierName,
      timeStr,
      items: kitchenItems,
      orderNotes,
      isDelta,
      deltaHeaderFlag,
    };

    const newDispatchedIds = itemsToDispatch.map((it) => it.id);

    return {
      isDelta,
      deltaHeaderFlag,
      barTicket,
      kitchenTicket,
      hasBarItems: barItems.length > 0,
      hasKitchenItems: kitchenItems.length > 0,
      hasItemsToDispatch: itemsToDispatch.length > 0,
      newDispatchedIds,
      totalItemsDispatched: itemsToDispatch.length,
    };
  }

  /**
   * State machine transitions for cart items.
   */
  public static transitionItemState(
    item: RoutableCartItem,
    nextState: ItemState
  ): RoutableCartItem {
    const validTransitions: Record<ItemState, ItemState[]> = {
      PENDING_DISPATCH: ['DISPATCHED', 'SETTLED'],
      DISPATCHED: ['PREPARING', 'SERVED', 'SETTLED'],
      PREPARING: ['SERVED', 'SETTLED'],
      SERVED: ['SETTLED'],
      SETTLED: [],
    };

    const currentState = item.status || 'PENDING_DISPATCH';
    const allowed = validTransitions[currentState];

    if (!allowed.includes(nextState)) {
      console.warn(`[StationRouter] Invalid state transition from ${currentState} to ${nextState}`);
    }

    return {
      ...item,
      status: nextState,
      dispatchedAt: nextState === 'DISPATCHED' ? new Date().toISOString() : item.dispatchedAt,
    };
  }
}
