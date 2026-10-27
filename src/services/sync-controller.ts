// sync-controller.ts
import { Request, Response } from 'express';
import {
  processOfflineOrderSync,
  defaultDatabaseClient,
  DatabaseClient,
} from './sync-order-handler';
import { websocketServer } from './websocket-server'; // مدیریت اتصالات سوکت

export const db: DatabaseClient = defaultDatabaseClient;

export async function handleOrderSync(req: Request, res: Response) {
  const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId || 'tenant_100hich';
  const payload = req.body;

  try {
    const rawOrder = payload.order || {};
    const normalizedItems = (rawOrder.items || []).map((i: any) => ({
      productId: i.productId || i.menuItemId || 'prod-unknown',
      quantity: i.quantity || 1,
      name: i.name || i.itemNameSnapshot || 'کالا',
    }));

    const normalizedPayments = (rawOrder.payments || []).map((p: any) => ({
      method: p.method || p.paymentMethod || 'POS_TERMINAL',
      amount: p.amount || p.amountToman || 0,
      referenceNumber: p.referenceNumber || p.referenceCode,
    }));

    const normalizedPayload = {
      tenantId,
      clientGeneratedId:
        (req.headers['idempotency-key'] as string) ||
        payload.clientGeneratedId ||
        rawOrder.clientGeneratedId ||
        crypto.randomUUID(),
      source: (payload.source as 'POS' | 'SMART_ORDERS') || 'POS',
      order: {
        items: normalizedItems,
        totalNet: rawOrder.totalNet ?? rawOrder.netTotalToman ?? 0,
        payments: normalizedPayments,
        createdAt: rawOrder.createdAt || new Date().toISOString(),
      },
    };

    const result = await processOfflineOrderSync(db, normalizedPayload);

    // اگر مغایرت انباری رخ داده باشد، به سایر پنلها اطلاعرسانی زنده میکنیم
    if (result.hasInventoryConflicts && result.conflicts && result.conflicts.length > 0) {
      // ۱. رویداد مخصوص صفحه باریستا (جهت 86 کردن یا اتمام موجودی زدن آیتم در منو)
      websocketServer.broadcastToTenant(tenantId, 'INVENTORY_STOCKOUT_ALERT', {
        type: 'STOCKOUT',
        orderId: result.orderId,
        items: result.conflicts.map((c) => ({
          productId: c.details.productId,
          productName: c.details.productName,
          deficit: c.details.deficit,
        })),
        timestamp: new Date().toISOString(),
      });

      // ۲. رویداد مخصوص پنل مدیریت (جهت ایجاد کارت مغایرت در گزارش روزانه)
      websocketServer.broadcastToRole(tenantId, 'MANAGER', 'AUDIT_DISCREPANCY_CREATED', {
        conflicts: result.conflicts,
      });
    }

    // پاسخ مستقیم به همان دستگاهی که تازه آنلاین شده
    return res.status(200).json({
      success: true,
      orderId: result.orderId,
      warnings: result.conflicts || [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
