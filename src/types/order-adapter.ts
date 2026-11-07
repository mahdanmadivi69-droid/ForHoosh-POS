// src/types/order-adapter.ts

import { Order, OrderStatus, Payment } from './domain';
import { OrderAggregate, OrderItemAggregate, PaymentRecord, OrderState, ModifierOption } from './order-domain';

/**
 * P1-2: Domain boundary adapter.
 * Bridges the UI-facing `Order` model (types/domain.ts) and the server-facing
 * `OrderAggregate` DTO (types/order-domain.ts).
 */
export function toOrderAggregate(
  order: Order,
  payments: Payment[] = [],
  clientGeneratedId?: string
): OrderAggregate {
  const statusToStateMap: Record<OrderStatus, OrderState> = {
    DRAFT: 'DRAFT',
    PREPARING: 'PLACED',
    COMPLETED: 'FULFILLED',
    CANCELLED: 'VOIDED',
  };

  const aggregateItems: OrderItemAggregate[] = (order.items || []).map((it) => {
    const mods: ModifierOption[] = (it.modifiers || []).map((m) => ({
      id: m.id,
      nameFa: m.nameFa,
      priceDeltaToman: m.priceDeltaToman,
    }));
    const modsDeltaUnit = mods.reduce((sum, m) => sum + m.priceDeltaToman, 0);
    const modifiersDeltaToman = modsDeltaUnit * it.quantity;

    return {
      id: it.id,
      menuItemId: it.menuItemId,
      itemNameSnapshot: it.itemNameSnapshot,
      unitPriceSnapshotToman: it.unitPriceSnapshotToman,
      quantity: it.quantity,
      modifiers: mods,
      modifiersDeltaToman,
      subtotalToman: it.subtotalToman,
      notes: it.notes,
    };
  });

  const paymentRecords: PaymentRecord[] = (payments || []).map((p) => ({
    id: p.id,
    tenantId: p.tenantId,
    orderId: p.orderId,
    clientGeneratedId: clientGeneratedId || order.id,
    shiftId: p.shiftId,
    receivedByUserId: p.receivedByUserId,
    amountToman: p.amountToman,
    amount: p.amountToman,
    paymentMethod: p.paymentMethod,
    method: p.paymentMethod,
    referenceCode: p.referenceCode,
    terminalName: p.terminalName,
    status: p.status,
    createdAt: p.createdAt,
  }));

  const paidAmount = paymentRecords
    .filter((p) => p.status === 'SUCCESSFUL')
    .reduce((sum, p) => sum + p.amountToman, 0);

  return {
    clientGeneratedId: clientGeneratedId || order.id,
    id: order.id,
    tenantId: order.tenantId,
    shiftId: order.shiftId,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    state: statusToStateMap[order.status] || 'DRAFT',
    tableLabel: order.tableLabel,
    customerName: order.customerName,
    items: aggregateItems,
    grossAmountToman: order.grossAmountToman,
    grossAmount: order.grossAmountToman,
    discountAmountToman: order.discountAmountToman,
    discountAmount: order.discountAmountToman,
    netTotalToman: order.netTotalToman,
    totalNet: order.netTotalToman,
    paidAmountToman: paidAmount || order.netTotalToman,
    paidAmount: paidAmount || order.netTotalToman,
    payments: paymentRecords,
    voidReason: order.cancellationReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    createdByUserId: order.createdByUserId,
    createdByUserName: order.createdByUserName,
  };
}

export function fromOrderAggregate(agg: OrderAggregate): Order {
  const stateToStatusMap: Record<OrderState, OrderStatus> = {
    DRAFT: 'DRAFT',
    PLACED: 'PREPARING',
    PAID: 'COMPLETED',
    FULFILLED: 'COMPLETED',
    VOIDED: 'CANCELLED',
  };

  return {
    id: agg.id || agg.clientGeneratedId,
    tenantId: agg.tenantId,
    shiftId: agg.shiftId,
    createdByUserId: agg.createdByUserId,
    createdByUserName: agg.createdByUserName,
    orderNumber: agg.orderNumber,
    orderType: agg.orderType,
    tableLabel: agg.tableLabel,
    customerName: agg.customerName,
    status: stateToStatusMap[agg.state] || 'COMPLETED',
    items: (agg.items || []).map((it) => ({
      id: it.id,
      menuItemId: it.menuItemId,
      itemNameSnapshot: it.itemNameSnapshot,
      unitPriceSnapshotToman: it.unitPriceSnapshotToman,
      quantity: it.quantity,
      subtotalToman: it.subtotalToman,
      notes: it.notes,
      modifiers: (it.modifiers || []).map((m) => ({
        id: m.id,
        nameFa: m.nameFa,
        priceDeltaToman: m.priceDeltaToman,
      })),
    })),
    grossAmountToman: agg.grossAmountToman,
    discountAmountToman: agg.discountAmountToman,
    netTotalToman: agg.netTotalToman,
    cancellationReason: agg.voidReason,
    createdAt: agg.createdAt,
    updatedAt: agg.updatedAt,
  };
}
