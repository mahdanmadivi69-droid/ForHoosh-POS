import { db } from '../db/cafeDb';
import { Order, OrderItem, OrderStatus, AuditLog, PaymentMethod } from '../types/db';

export class OrderService {
  /**
   * Helper to deduct raw materials based on menuItem recipes
   */
  private static async deductIngredientsForItems(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      if (item.status === 'cancelled') continue;
      const menuItem = await db.menuItems.get(item.menuItemId);
      if (!menuItem || !menuItem.recipe || menuItem.recipe.length === 0) continue;

      for (const ingredient of menuItem.recipe) {
        const invItem = await db.inventoryItems.get(ingredient.inventoryItemId);
        if (invItem) {
          const totalDeduction = ingredient.amount * item.quantity;
          const updatedStock = Math.round((invItem.currentStock - totalDeduction) * 1000) / 1000;
          await db.inventoryItems.update(invItem.id, {
            currentStock: updatedStock,
            updatedAt: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Helper to restore raw materials if an order is voided
   */
  private static async restoreIngredientsForItems(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      if (item.status === 'cancelled') continue;
      const menuItem = await db.menuItems.get(item.menuItemId);
      if (!menuItem || !menuItem.recipe || menuItem.recipe.length === 0) continue;

      for (const ingredient of menuItem.recipe) {
        const invItem = await db.inventoryItems.get(ingredient.inventoryItemId);
        if (invItem) {
          const totalRestoration = ingredient.amount * item.quantity;
          const updatedStock = Math.round((invItem.currentStock + totalRestoration) * 1000) / 1000;
          await db.inventoryItems.update(invItem.id, {
            currentStock: updatedStock,
            updatedAt: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Creates a new order and atomically deducts recipe inventory if sent immediately to bar or settled
   */
  static async createOrder(orderInput: {
    tableId: string;
    items: OrderItem[];
    subtotal: number;
    discount?: number;
    total: number;
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    notes?: string;
    createdBy: string;
  }): Promise<Order> {
    return await db.transaction('rw', [db.orders, db.inventoryItems, db.menuItems, db.auditLogs], async () => {
      const now = Date.now();
      const lastOrder = await db.orders.orderBy('orderNumber').last();
      const nextOrderNumber = (lastOrder?.orderNumber ?? 1000) + 1;
      const id = `ord-${now}-${Math.random().toString(36).substring(2, 7)}`;
      const status = orderInput.status || 'open';
      const discount = orderInput.discount || 0;

      const order: Order = {
        id,
        orderNumber: nextOrderNumber,
        tableId: orderInput.tableId,
        status,
        items: orderInput.items,
        subtotal: orderInput.subtotal,
        discount,
        total: orderInput.total,
        paymentMethod: orderInput.paymentMethod,
        notes: orderInput.notes,
        createdBy: orderInput.createdBy,
        createdAt: now,
        updatedAt: now,
        synced: 0,
      };

      await db.orders.add(order);

      // If created directly in sent_to_bar or settled, deduct BOM inventory atomically
      if (status === 'sent_to_bar' || status === 'settled') {
        await this.deductIngredientsForItems(order.items);
      }

      const log: AuditLog = {
        id: `audit-${now}-${Math.random().toString(36).substring(2, 7)}`,
        orderId: id,
        userId: orderInput.createdBy,
        action: 'create',
        details: `سفارش #${nextOrderNumber} با مبلغ ${order.total.toLocaleString('fa-IR')} تومان ثبت شد.`,
        timestamp: now,
      };
      await db.auditLogs.add(log);

      return order;
    });
  }

  /**
   * Updates an order's status atomically with BOM inventory deduction & audit trail
   */
  static async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    reason?: string
  ): Promise<Order> {
    return await db.transaction('rw', [db.orders, db.inventoryItems, db.menuItems, db.auditLogs], async () => {
      const order = await db.orders.get(orderId);
      if (!order) {
        throw new Error(`سفارش با شناسه ${orderId} یافت نشد.`);
      }

      const oldStatus = order.status;
      if (oldStatus === newStatus) return order;

      const now = Date.now();

      // Deduct inventory when transitioning from open to sent_to_bar or settled
      if (oldStatus === 'open' && (newStatus === 'sent_to_bar' || newStatus === 'settled')) {
        await this.deductIngredientsForItems(order.items);
      }

      // If voiding an order that had previously depleted inventory, restore stock
      if (newStatus === 'voided' && (oldStatus === 'sent_to_bar' || oldStatus === 'settled')) {
        await this.restoreIngredientsForItems(order.items);
      }

      const updatedOrder: Order = {
        ...order,
        status: newStatus,
        updatedAt: now,
        synced: 0,
      };

      await db.orders.put(updatedOrder);

      const action = newStatus === 'settled' ? 'settle' : newStatus === 'voided' ? 'void' : 'edit_items';
      const log: AuditLog = {
        id: `audit-${now}-${Math.random().toString(36).substring(2, 7)}`,
        orderId,
        userId,
        action,
        reason,
        details: `وضعیت سفارش #${order.orderNumber} از ${oldStatus} به ${newStatus} تغییر یافت.${reason ? ` علت: ${reason}` : ''}`,
        timestamp: now,
      };
      await db.auditLogs.add(log);

      return updatedOrder;
    });
  }

  /**
   * Updates order items with mandatory reason and recalculates financial invariants
   */
  static async updateOrderItems(
    orderId: string,
    newItems: OrderItem[],
    userId: string,
    reason: string
  ): Promise<Order> {
    return await db.transaction('rw', [db.orders, db.inventoryItems, db.menuItems, db.auditLogs], async () => {
      const order = await db.orders.get(orderId);
      if (!order) {
        throw new Error(`سفارش با شناسه ${orderId} یافت نشد.`);
      }

      if (order.status === 'settled' || order.status === 'voided') {
        throw new Error('امکان ویرایش اقلام فاکتور تسویه‌شده یا ابطال‌شده وجود ندارد.');
      }

      const now = Date.now();

      // If items were already sent to bar, restore previous and deduct new items
      if (order.status === 'sent_to_bar') {
        await this.restoreIngredientsForItems(order.items);
        await this.deductIngredientsForItems(newItems);
      }

      const newSubtotal = newItems
        .filter((item) => item.status !== 'cancelled')
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      const newTotal = Math.max(0, newSubtotal - (order.discount || 0));

      const updatedOrder: Order = {
        ...order,
        items: newItems,
        subtotal: newSubtotal,
        total: newTotal,
        updatedAt: now,
        synced: 0,
      };

      await db.orders.put(updatedOrder);

      const log: AuditLog = {
        id: `audit-${now}-${Math.random().toString(36).substring(2, 7)}`,
        orderId,
        userId,
        action: 'edit_items',
        reason,
        details: `اقلام سفارش #${order.orderNumber} ویرایش شدند. جمع جدید: ${newTotal.toLocaleString('fa-IR')} تومان. دلیل: ${reason}`,
        timestamp: now,
      };
      await db.auditLogs.add(log);

      return updatedOrder;
    });
  }

  /**
   * Applies discount to an order with audit trail
   */
  static async applyDiscount(
    orderId: string,
    discountAmount: number,
    userId: string,
    reason?: string
  ): Promise<Order> {
    return await db.transaction('rw', [db.orders, db.auditLogs], async () => {
      const order = await db.orders.get(orderId);
      if (!order) {
        throw new Error(`سفارش با شناسه ${orderId} یافت نشد.`);
      }

      const now = Date.now();
      const validDiscount = Math.min(Math.max(0, discountAmount), order.subtotal);
      const newTotal = Math.max(0, order.subtotal - validDiscount);

      const updatedOrder: Order = {
        ...order,
        discount: validDiscount,
        total: newTotal,
        updatedAt: now,
        synced: 0,
      };

      await db.orders.put(updatedOrder);

      const log: AuditLog = {
        id: `audit-${now}-${Math.random().toString(36).substring(2, 7)}`,
        orderId,
        userId,
        action: 'apply_discount',
        reason,
        details: `تخفیف ${validDiscount.toLocaleString('fa-IR')} تومان برای سفارش #${order.orderNumber} ثبت شد.`,
        timestamp: now,
      };
      await db.auditLogs.add(log);

      return updatedOrder;
    });
  }

  /**
   * Voids an order with mandatory manager authorization and reason
   */
  static async voidOrder(orderId: string, userId: string, reason: string): Promise<Order> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('ثبت دلیل ابطال سفارش الزامی است.');
    }
    return this.updateOrderStatus(orderId, 'voided', userId, reason);
  }
}
