// sync-controller.ts
import { Request, Response } from 'express';
import {
  processOfflineOrderSync,
  processOfflineOrderBatchSync,
  defaultDatabaseClient,
  DatabaseClient,
} from './sync-order-handler';
import { websocketServer } from './websocket-server'; // مدیریت اتصالات سوکت
import { AuthenticatedRequest } from '../../server/authMiddleware';

export const db: DatabaseClient = defaultDatabaseClient;

export async function handleOrderSync(req: Request | AuthenticatedRequest, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const sessionTenantId = authReq.user?.tenantId;
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  const bodyTenantId = (req.body?.tenantId || req.body?.order?.tenantId) as string | undefined;

  // Strict fail-closed tenant validation:
  // 1. If authenticated session exists, tenantId MUST derive from session.
  // 2. Any explicit tenant in header or body must match session (fail-closed 403 on mismatch).
  // 3. Silent fallback ('tenant_100hich') is completely eliminated.
  let tenantId: string;

  if (sessionTenantId) {
    if (headerTenantId && headerTenantId !== sessionTenantId) {
      return res.status(403).json({
        success: false,
        error: `Cross-tenant access denied. Header tenant "${headerTenantId}" does not match authenticated session "${sessionTenantId}".`,
      });
    }
    if (bodyTenantId && bodyTenantId !== sessionTenantId) {
      return res.status(403).json({
        success: false,
        error: `Cross-tenant access denied. Body tenant "${bodyTenantId}" does not match authenticated session "${sessionTenantId}".`,
      });
    }
    tenantId = sessionTenantId;
  } else {
    // When invoked outside middleware (e.g. unit tests), require an explicit tenant from header or body
    tenantId = (headerTenantId || bodyTenantId)!;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required tenant identifier. Silent tenant fallback is prohibited.',
      });
    }
  }
  const payload = req.body;

  try {
    // Handle batch mutations from DecomposedOfflineSyncQueue
    if (Array.isArray(payload) || payload.batch || payload.mutations) {
      const rawBatch = Array.isArray(payload) ? payload : (payload.batch || payload.mutations || []);
      const normalizedBatch = rawBatch.map((p: any) => {
        const rawOrder = p.order || {};
        return {
          tenantId,
          clientGeneratedId:
            p.clientGeneratedId ||
            rawOrder.clientGeneratedId ||
            crypto.randomUUID(),
          source: (p.source as 'POS' | 'SMART_ORDERS') || 'POS',
          order: {
            items: (rawOrder.items || []).map((i: any) => ({
              productId: i.productId || i.menuItemId || 'prod-unknown',
              quantity: i.quantity || 1,
              name: i.name || i.itemNameSnapshot || 'کالا',
            })),
            totalNet: rawOrder.totalNet ?? rawOrder.netTotalToman ?? 0,
            payments: (rawOrder.payments || []).map((pay: any) => ({
              method: pay.method || pay.paymentMethod || 'POS_TERMINAL',
              amount: pay.amount || pay.amountToman || 0,
              referenceNumber: pay.referenceNumber || pay.referenceCode,
            })),
            createdAt: rawOrder.createdAt || new Date().toISOString(),
          },
        };
      });

      const batchResult = await processOfflineOrderBatchSync(db, {
        tenantId,
        mutations: normalizedBatch,
      });

      if (batchResult.hasInventoryConflicts && batchResult.conflicts.length > 0) {
        websocketServer.broadcastToTenant(tenantId, 'INVENTORY_STOCKOUT_ALERT', {
          type: 'STOCKOUT_BATCH',
          conflicts: batchResult.conflicts,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        batch: true,
        ...batchResult,
      });
    }

    // Single order mutation
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
      isIdempotentReplay: result.isIdempotentReplay || false,
      warnings: result.conflicts || [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
