/**
 * CAFE OS — Phase 4: Order & Payment Domain Aggregate
 * Pilot Target: 100 Hich Specialty Coffee Lab (قهوه‌فروشی ۱۰۰هیچ)
 * 
 * Architectural Invariants:
 * 1. Multi-Tenant RLS isolation: All entities bound to tenantId.
 * 2. Integer-Only Financial Calculations: Stored strictly as integer Toman (Number.isInteger() === true).
 * 3. Offline-First & Idempotency: Orders identified by clientGeneratedId (UUIDv4).
 * 4. State Machine: DRAFT -> PLACED -> PAID -> FULFILLED (or VOIDED).
 */

export type OrderState = 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'VOIDED';

export type PaymentMethod = 'POS_TERMINAL' | 'CARD_MANUAL' | 'CASH' | 'OTHER';
export type PaymentStatus = 'SUCCESSFUL' | 'REFUNDED' | 'VOIDED';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface ModifierOption {
  id: string;
  nameFa: string;
  nameEn?: string;
  priceDeltaToman: number; // Integer Toman (e.g. +25000 for Oat Milk)
  category?: 'MILK' | 'SHOT' | 'SYRUP' | 'SWEETNESS' | 'TEMPERATURE' | 'EXTRAS';
}

export interface OrderItemAggregate {
  id: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPriceSnapshotToman: number; // Integer Toman
  quantity: number;
  modifiers: ModifierOption[];
  modifiersDeltaToman: number; // Sum of modifier price deltas * quantity
  subtotalToman: number; // (unitPriceSnapshotToman + sum(modifiers)) * quantity
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  orderId: string;
  clientGeneratedId: string; // Associated order client UUID
  shiftId: string;
  receivedByUserId: string;
  receivedByUserName?: string;
  amountToman: number; // Integer Toman
  amount?: number; // Alias
  paymentMethod: PaymentMethod;
  method?: PaymentMethod; // Alias
  referenceCode?: string; // Card terminal trace / RRN
  referenceNumber?: string; // Alias
  terminalName?: string;
  status: PaymentStatus;
  createdAt: string; // ISO string
}

export interface OrderAggregate {
  clientGeneratedId: string; // UUIDv4 generated on POS client for idempotency
  id: string; // Server/Store ID
  tenantId: string;
  shiftId: string;
  orderNumber: number;
  orderType: OrderType;
  state: OrderState;
  tableLabel?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItemAggregate[];
  
  // Financial amounts (all strict integer Toman)
  grossAmountToman: number;
  grossAmount: number; // Alias
  discountAmountToman: number;
  discountAmount: number; // Alias
  netTotalToman: number;
  totalNet: number; // Alias
  paidAmountToman: number;
  paidAmount: number; // Alias

  payments: PaymentRecord[];
  voidReason?: string; // Mandatory when state is VOIDED
  voidedByUserId?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
  fulfilledAt?: string;
  createdByUserId: string;
  createdByUserName: string;
}

/**
 * Standard integer Toman validator and converter
 * Enforces zero-float invariant (Number.isInteger() === true).
 */
export function toToman(amount: number): number {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

/**
 * Standard modifiers for specialty coffee lab (100 Hich)
 */
export const STANDARD_COFFEE_MODIFIERS: ModifierOption[] = [
  { id: 'mod-double-shot', nameFa: 'دبل‌شات اسپرسو اضافه', priceDeltaToman: 20000, category: 'SHOT' },
  { id: 'mod-oat-milk', nameFa: 'شیر جو دوسر (Oat Milk)', priceDeltaToman: 25000, category: 'MILK' },
  { id: 'mod-almond-milk', nameFa: 'شیر بادام (Almond Milk)', priceDeltaToman: 25000, category: 'MILK' },
  { id: 'mod-vanilla-syrup', nameFa: 'سیروپ وانیل ماداگاسکار', priceDeltaToman: 18000, category: 'SYRUP' },
  { id: 'mod-caramel-syrup', nameFa: 'سیروپ کارامل دست‌ساز', priceDeltaToman: 18000, category: 'SYRUP' },
  { id: 'mod-hazelnut-syrup', nameFa: 'سیروپ فندق بوداده', priceDeltaToman: 18000, category: 'SYRUP' },
  { id: 'mod-low-sweet', nameFa: 'کم‌شیرین (Half Sweet)', priceDeltaToman: 0, category: 'SWEETNESS' },
  { id: 'mod-no-sugar', nameFa: 'بدون شکر / رژیمی', priceDeltaToman: 0, category: 'SWEETNESS' },
  { id: 'mod-extra-hot', nameFa: 'خیلی داغ (Extra Hot)', priceDeltaToman: 0, category: 'TEMPERATURE' },
];

/**
 * Domain Service for managing Order Aggregate lifecycles and state transitions.
 * State Machine: DRAFT -> PLACED -> PAID -> FULFILLED (or VOIDED).
 */
export class OrderDomainService {
  /**
   * Creates an initial DRAFT order
   */
  public static createDraft(params: {
    id?: string;
    tenantId: string;
    clientGeneratedId?: string;
    shiftId?: string;
    orderNumber?: number;
    orderType?: OrderType;
    tableLabel?: string;
    customerName?: string;
    customerPhone?: string;
    createdByUserId?: string;
    createdByUserName?: string;
    items?: OrderItemAggregate[];
    discountAmount?: number;
  }): OrderAggregate {
    const clientGeneratedId = params.clientGeneratedId || crypto.randomUUID();
    const id = params.id || clientGeneratedId;
    const now = new Date().toISOString();
    const items = params.items || [];
    const discount = toToman(params.discountAmount || 0);

    const gross = items.reduce((sum, item) => sum + item.subtotalToman, 0);
    const net = Math.max(0, gross - discount);

    return {
      clientGeneratedId,
      id,
      tenantId: params.tenantId,
      shiftId: params.shiftId || 'shift-active',
      orderNumber: params.orderNumber || 0,
      orderType: params.orderType || 'DINE_IN',
      state: 'DRAFT',
      tableLabel: params.tableLabel,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      items,
      grossAmountToman: gross,
      grossAmount: gross,
      discountAmountToman: discount,
      discountAmount: discount,
      netTotalToman: net,
      totalNet: net,
      payments: [],
      paidAmountToman: 0,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
      createdByUserId: params.createdByUserId || 'cashier-01',
      createdByUserName: params.createdByUserName || 'صندوق‌دار',
    };
  }

  /**
   * Adds an item to the DRAFT order
   */
  public static addItem(
    order: OrderAggregate,
    item: {
      id?: string;
      menuItemId: string;
      itemNameSnapshot: string;
      unitPriceSnapshotToman: number;
      quantity: number;
      modifiers?: ModifierOption[];
      notes?: string;
    }
  ): OrderAggregate {
    if (order.state !== 'DRAFT') {
      throw new Error(`Cannot add items in state '${order.state}'. Only DRAFT orders are mutable.`);
    }

    const mods = item.modifiers || [];
    const modsDeltaPerUnit = mods.reduce((sum, m) => sum + toToman(m.priceDeltaToman), 0);
    const unitPrice = toToman(item.unitPriceSnapshotToman);
    const qty = Math.max(1, Math.round(item.quantity));
    const subtotal = (unitPrice + modsDeltaPerUnit) * qty;

    const newItem: OrderItemAggregate = {
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      menuItemId: item.menuItemId,
      itemNameSnapshot: item.itemNameSnapshot,
      unitPriceSnapshotToman: unitPrice,
      quantity: qty,
      modifiers: mods,
      modifiersDeltaToman: modsDeltaPerUnit * qty,
      subtotalToman: subtotal,
      notes: item.notes,
    };

    const updatedItems = [...order.items, newItem];
    const gross = updatedItems.reduce((sum, i) => sum + i.subtotalToman, 0);
    const net = Math.max(0, gross - order.discountAmountToman);

    return {
      ...order,
      items: updatedItems,
      grossAmountToman: gross,
      grossAmount: gross,
      netTotalToman: net,
      totalNet: net,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Transitions order from DRAFT to PLACED (locking the cart items)
   */
  public static placeOrder(order: OrderAggregate): OrderAggregate {
    if (order.state !== 'DRAFT') {
      throw new Error(`Cannot place order in state: ${order.state}. Order must be DRAFT.`);
    }
    if (order.items.length === 0) {
      throw new Error('Cannot place an empty order. Add at least one item.');
    }

    return {
      ...order,
      state: 'PLACED',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Applies a payment record. If total paid reaches totalNet, state transitions to PAID.
   */
  public static applyPayment(
    order: OrderAggregate,
    payment: {
      id?: string;
      method: PaymentMethod;
      amount: number;
      referenceNumber?: string;
      referenceCode?: string;
      terminalName?: string;
      receivedByUserId?: string;
      receivedByUserName?: string;
    }
  ): OrderAggregate {
    if (order.state === 'VOIDED' || order.state === 'FULFILLED') {
      throw new Error(`Cannot apply payment to order in state '${order.state}'.`);
    }

    const paymentAmount = toToman(payment.amount);
    if (paymentAmount <= 0) {
      throw new Error(`Payment amount must be a positive integer Toman: ${paymentAmount}`);
    }

    const paymentRecord: PaymentRecord = {
      id: payment.id || crypto.randomUUID(),
      tenantId: order.tenantId,
      orderId: order.id,
      clientGeneratedId: order.clientGeneratedId,
      shiftId: order.shiftId,
      receivedByUserId: payment.receivedByUserId || order.createdByUserId,
      receivedByUserName: payment.receivedByUserName || order.createdByUserName,
      amountToman: paymentAmount,
      amount: paymentAmount,
      paymentMethod: payment.method,
      method: payment.method,
      referenceCode: payment.referenceNumber || payment.referenceCode,
      referenceNumber: payment.referenceNumber || payment.referenceCode,
      terminalName: payment.terminalName || 'کارت‌خوان پوز ۱',
      status: 'SUCCESSFUL',
      createdAt: new Date().toISOString(),
    };

    const updatedPayments = [...order.payments, paymentRecord];
    const totalPaid = updatedPayments
      .filter((p) => p.status === 'SUCCESSFUL')
      .reduce((sum, p) => sum + p.amountToman, 0);

    const isFullyPaid = totalPaid >= order.netTotalToman;

    return {
      ...order,
      payments: updatedPayments,
      paidAmountToman: totalPaid,
      paidAmount: totalPaid,
      state: isFullyPaid ? 'PAID' : 'PLACED',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Marks drink preparation complete and delivered to customer
   */
  public static fulfillOrder(order: OrderAggregate): OrderAggregate {
    if (order.state !== 'PAID') {
      throw new Error(`Order must be in PAID state before fulfillment. Current state: ${order.state}`);
    }

    const now = new Date().toISOString();
    return {
      ...order,
      state: 'FULFILLED',
      fulfilledAt: now,
      updatedAt: now,
    };
  }

  /**
   * Voids an order with a mandatory reason for audit logs
   */
  public static voidOrder(
    order: OrderAggregate,
    voidReason: string,
    voidedByUserId?: string
  ): OrderAggregate {
    if (!voidReason || voidReason.trim().length === 0) {
      throw new Error('Mandatory voidReason is required when cancelling/voiding an order.');
    }

    const now = new Date().toISOString();
    const voidedPayments = order.payments.map((p) => ({
      ...p,
      status: 'VOIDED' as PaymentStatus,
    }));

    return {
      ...order,
      state: 'VOIDED',
      voidReason: voidReason.trim(),
      voidedByUserId: voidedByUserId || order.createdByUserId,
      voidedAt: now,
      payments: voidedPayments,
      paidAmountToman: 0,
      paidAmount: 0,
      updatedAt: now,
    };
  }
}

/**
 * Validates domain invariants: integer math, multi-tenant ID, and state transition validity.
 */
export function validateOrderAggregate(order: OrderAggregate): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!order.clientGeneratedId || typeof order.clientGeneratedId !== 'string') {
    errors.push('clientGeneratedId is required and must be a UUIDv4 string.');
  }

  if (!order.tenantId || typeof order.tenantId !== 'string') {
    errors.push('tenantId is required for Multi-Tenant RLS isolation.');
  }

  // Integer verification
  if (!Number.isInteger(order.grossAmountToman) || order.grossAmountToman < 0) {
    errors.push(`grossAmountToman must be a non-negative integer: ${order.grossAmountToman}`);
  }

  if (!Number.isInteger(order.discountAmountToman) || order.discountAmountToman < 0) {
    errors.push(`discountAmountToman must be a non-negative integer: ${order.discountAmountToman}`);
  }

  if (!Number.isInteger(order.netTotalToman) || order.netTotalToman < 0) {
    errors.push(`netTotalToman must be a non-negative integer: ${order.netTotalToman}`);
  }

  // Items verification
  let computedGross = 0;
  for (const item of order.items) {
    if (!Number.isInteger(item.unitPriceSnapshotToman) || item.unitPriceSnapshotToman < 0) {
      errors.push(`Item ${item.itemNameSnapshot} unit price must be integer Toman.`);
    }
    const modifierSum = item.modifiers.reduce((sum, m) => sum + m.priceDeltaToman, 0);
    const expectedSubtotal = (item.unitPriceSnapshotToman + modifierSum) * item.quantity;
    if (item.subtotalToman !== expectedSubtotal) {
      errors.push(`Item ${item.itemNameSnapshot} subtotal mismatch: expected ${expectedSubtotal}, got ${item.subtotalToman}`);
    }
    computedGross += item.subtotalToman;
  }

  if (order.grossAmountToman !== computedGross) {
    errors.push(`Gross amount mismatch: expected sum of items ${computedGross}, got ${order.grossAmountToman}`);
  }

  // State machine invariants
  if (order.state === 'VOIDED' && (!order.voidReason || order.voidReason.trim().length === 0)) {
    errors.push('VOIDED state strictly requires a voidReason for audit trails.');
  }

  // Payments verification
  for (const p of order.payments) {
    if (!Number.isInteger(p.amountToman) || p.amountToman <= 0) {
      errors.push(`Payment amount must be a positive integer Toman: ${p.amountToman}`);
    }
    if (p.tenantId !== order.tenantId) {
      errors.push(`Payment tenantId (${p.tenantId}) does not match order tenantId (${order.tenantId}).`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
