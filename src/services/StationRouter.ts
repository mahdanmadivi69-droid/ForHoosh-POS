/**
 * CAFE OS — Station Router & Delta Ordering Engine
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0 & CODA P1 Architecture
 *
 * Responsibilities:
 *  1. Automatic splitting of order items by preparation department ('BAR' vs 'KITCHEN' vs 'NO_PREP').
 *  2. Strict exclusion of retail, gaming, and merchandise from preparation queues.
 *  3. Station category and tag mappings.
 *  4. Item state machine ('PENDING_DISPATCH' -> 'DISPATCHED' -> 'PREPARING' -> 'SERVED' -> 'SETTLED').
 *  5. Delta Print suppression: only newly added items are sent to thermal printer & KDS
 *     so the kitchen/barista never duplicate tickets or prepare already-served dishes.
 *  6. Flagging supplemental dispatches with header "سفارش تکمیلی / ADDITIONAL ORDER".
 */

export type PrepStation = 'BAR' | 'KITCHEN' | 'NO_PREP';

export type ItemState =
  | 'PENDING_DISPATCH'
  | 'DISPATCHED'
  | 'PREPARING'
  | 'SERVED'
  | 'SETTLED';

export const STATION_MAPPINGS: Record<'BAR' | 'KITCHEN', readonly string[]> = {
  BAR: [
    'espresso',
    'pour_over',
    'cold_brew',
    'tea',
    'mocktails',
    'beverages',
    'coffee',
    'drinks',
    'cold_bar',
    'hot_bar',
  ],
  KITCHEN: [
    'bakery',
    'sandwiches',
    'warm_food',
    'pastry',
    'food',
    'burger',
    'burgers',
    'hot_food',
  ],
} as const;

export const NO_PREP_IDENTIFIERS = [
  'cat-retail-beans',
  'retail-beans',
  'retail_beans',
  'cat-mod-gaming',
  'mod-gaming',
  'gaming',
  'merchandise',
  'merch',
] as const;

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
  noPrepItems: RoutableCartItem[];
  hasBarItems: boolean;
  hasKitchenItems: boolean;
  hasNoPrepItems: boolean;
  hasItemsToDispatch: boolean;
  newDispatchedIds: string[];
  totalItemsDispatched: number;
}

export class StationRouter {
  /**
   * Resolves the target station ('BAR' | 'KITCHEN' | 'NO_PREP') for a given cart item.
   * Priority:
   *  1. Explicit item.station tag ('BAR' | 'KITCHEN' | 'NO_PREP')
   *  2. Explicit NO_PREP Policy:
   *     - cat-retail-beans / retail beans -> NO_PREP
   *     - cat-mod-gaming / gaming / PS5 / boardgames -> NO_PREP
   *     - merchandise / merch / mugs / apparel -> NO_PREP
   *  3. Kitchen category & keyword heuristics -> KITCHEN
   *  4. Bar category & keyword heuristics -> BAR
   *  5. Unknown category fallback -> NO_PREP with audit logging (NO_PREP_AND_LOG)
   */
  public static resolveStation(item: Partial<RoutableCartItem>): PrepStation {
    // 1. Explicit station override
    if (item.station === 'BAR' || item.station === 'KITCHEN' || item.station === 'NO_PREP') {
      return item.station;
    }

    const categoryId = (item.categoryId || '').trim().toLowerCase();
    const title = (item.title || '').trim().toLowerCase();
    const testString = `${categoryId} ${title}`;

    // 2. Policy-defined NO_PREP checks (Retail Beans, Gaming sessions, Merchandise)
    const isRetailBeans =
      categoryId === 'cat-retail-beans' ||
      categoryId === 'retail-beans' ||
      categoryId === 'retail_beans' ||
      /retail.*beans|coffee.*beans|بسته قهوه|دانه قهوه|دان قهوه/i.test(testString);

    const isGaming =
      categoryId === 'cat-mod-gaming' ||
      categoryId === 'mod-gaming' ||
      categoryId === 'gaming' ||
      /gaming|ps5|boardgame|پلی استیشن|پی اس ۵|بردگیم|برد گیم/i.test(testString);

    const isMerchandise =
      categoryId === 'merchandise' ||
      categoryId === 'merch' ||
      categoryId === 'cat-merchandise' ||
      /merchandise|merch|apparel|ماگ|تی شرت|هودی|اکسسوری/i.test(testString);

    if (isRetailBeans || isGaming || isMerchandise) {
      return 'NO_PREP';
    }

    // 3. Kitchen mappings & keywords
    const isKitchen =
      STATION_MAPPINGS.KITCHEN.some((kw) => testString.includes(kw)) ||
      /بیکری|شیرینی|کیک|ساندویچ|غذا|پستو|پنینی|تست|کروسان|کرواسان|چیزکیک|کوکی|پیراشکی|برگر|همبرگر|سیب زمینی|پاستا/i.test(
        testString
      );

    if (isKitchen) {
      return 'KITCHEN';
    }

    // 4. Bar mappings & keywords
    const isBar =
      STATION_MAPPINGS.BAR.some((kw) => testString.includes(kw)) ||
      /اسپرسو|لاته|کاپوچینو|قهوه|دمی|سرد|ماکیاتو|موکا|آیس|چای|دمنوش|ماکتل|شیک|اسموتی|فلت وایت|آمریکانو|آفوگاتو|کورتادو/i.test(
        testString
      );

    if (isBar) {
      return 'BAR';
    }

    // 5. Unknown category fallback -> NO_PREP_AND_LOG
    console.warn(
      `[StationRouter] Unknown category "${item.categoryId || 'none'}" or item "${item.title || 'untitled'}" routed to NO_PREP_AND_LOG`
    );
    return 'NO_PREP';
  }

  /**
   * Returns a friendly localized title for a preparation station.
   */
  public static getStationTitle(station: PrepStation): string {
    switch (station) {
      case 'BAR':
        return 'بار قهوه و نوشیدنی / BARISTA';
      case 'KITCHEN':
        return 'آشپزخانه و بیکری / KITCHEN';
      case 'NO_PREP':
        return 'بدون نیاز به آماده‌سازی / NO PREP';
      default:
        return 'نامشخص / UNKNOWN';
    }
  }

  /**
   * Splits a collection of cart items into BAR and KITCHEN dispatch tickets,
   * strictly excluding NO_PREP items from preparation queues.
   *
   * Applying Delta Print filtering:
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
    const itemsToProcess = cartItems.filter((item) => {
      if (item.status === 'DISPATCHED' || item.status === 'SERVED' || item.status === 'SETTLED') {
        return false;
      }
      return !dispatchedSet.has(item.id);
    });

    const hasPreviousDispatches = dispatchedSet.size > 0;

    const barItems: RoutableCartItem[] = [];
    const kitchenItems: RoutableCartItem[] = [];
    const noPrepItems: RoutableCartItem[] = [];

    for (const item of itemsToProcess) {
      const station = this.resolveStation(item);
      const taggedItem: RoutableCartItem = {
        ...item,
        station,
        status: station === 'NO_PREP' ? 'SERVED' : 'PENDING_DISPATCH',
      };

      if (station === 'BAR') {
        barItems.push(taggedItem);
      } else if (station === 'KITCHEN') {
        kitchenItems.push(taggedItem);
      } else {
        noPrepItems.push(taggedItem);
      }
    }

    const itemsToDispatchCount = barItems.length + kitchenItems.length;
    const isDelta = hasPreviousDispatches && itemsToDispatchCount > 0;
    const deltaHeaderFlag = isDelta ? DELTA_ORDERING_RULES.header_flag_for_delta : undefined;

    const ticketId =
      context?.ticketId || context?.orderNumber || (context?.id ? context.id.slice(-6) : 'T-101');
    const orderNumber = context?.orderNumber || (typeof ticketId === 'number' ? ticketId : 101);
    const tableLabel = context?.tableLabel || 'میز سالن';
    const cashierName = context?.cashierName || 'صندوقدار';
    const timeStr =
      context?.timeStr ||
      new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
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

    const newDispatchedIds = [...barItems, ...kitchenItems].map((it) => it.id);

    return {
      isDelta,
      deltaHeaderFlag,
      barTicket,
      kitchenTicket,
      noPrepItems,
      hasBarItems: barItems.length > 0,
      hasKitchenItems: kitchenItems.length > 0,
      hasNoPrepItems: noPrepItems.length > 0,
      hasItemsToDispatch: itemsToDispatchCount > 0,
      newDispatchedIds,
      totalItemsDispatched: itemsToDispatchCount,
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
