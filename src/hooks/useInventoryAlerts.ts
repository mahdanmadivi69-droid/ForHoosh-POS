import { useState, useEffect, useMemo, useCallback } from 'react';
import { MenuItem } from '../types/domain';
import { evaluateStockStatus, formatToman } from '../services/financialMath';
import { SmartOrdersStore } from '../services/storage';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  currentStock: number;
  threshold: number;
  deficit?: number;
}

export function useInventoryAlerts(
  menuItems: MenuItem[],
  globalThreshold: number = 5,
  onItemUpdated?: (updatedItem: MenuItem) => void
) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Generate alerts from current menu items
  const activeAlerts: StockAlert[] = useMemo(() => {
    const list: StockAlert[] = [];

    for (const item of menuItems) {
      if (item.currentStock === undefined) continue;

      const evalResult = evaluateStockStatus(
        item.currentStock,
        item.lowStockThreshold,
        globalThreshold
      );

      if (evalResult.status === 'OUT_OF_STOCK') {
        const alertId = `alert-out-${item.id}`;
        if (!dismissedIds.has(alertId)) {
          list.push({
            id: alertId,
            productId: item.id,
            productName: item.nameFa,
            severity: 'CRITICAL',
            message: `موجودی به صفر رسیده است (${item.currentStock} عدد). فروش بیشتر بدون شارژ انبار مجاز نیست.`,
            currentStock: item.currentStock,
            threshold: evalResult.effectiveThreshold,
            deficit: evalResult.deficit,
          });
        }
      } else if (evalResult.status === 'LOW') {
        const alertId = `alert-low-${item.id}`;
        if (!dismissedIds.has(alertId)) {
          list.push({
            id: alertId,
            productId: item.id,
            productName: item.nameFa,
            severity: 'WARNING',
            message: `موجودی فعلی (${item.currentStock} عدد) کمتر از آستانه هشدار (${evalResult.effectiveThreshold} عدد) است.`,
            currentStock: item.currentStock,
            threshold: evalResult.effectiveThreshold,
            deficit: evalResult.deficit,
          });
        }
      }
    }

    return list;
  }, [menuItems, globalThreshold, dismissedIds]);

  const dismissAlert = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const markAsSoldOut = useCallback(
    (productId: string) => {
      try {
        const items = SmartOrdersStore.getMenuItems();
        const target = items.find((i) => i.id === productId);
        if (target) {
          const updated: MenuItem = {
            ...target,
            isAvailable: false,
            currentStock: 0,
          };
          SmartOrdersStore.updateMenuItem(updated);
          if (onItemUpdated) {
            onItemUpdated(updated);
          }
        }
      } catch (err) {
        console.error('Failed to mark item as sold out:', err);
      }
    },
    [onItemUpdated]
  );

  const clearDismissed = useCallback(() => {
    setDismissedIds(new Set());
  }, []);

  return {
    alerts: activeAlerts,
    dismissAlert,
    markAsSoldOut,
    clearDismissed,
  };
}
