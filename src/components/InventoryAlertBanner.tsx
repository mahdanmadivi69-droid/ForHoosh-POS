// InventoryAlertBanner.tsx
import React from 'react';
import { StockAlert } from './useInventoryAlerts';

interface Props {
  alerts: StockAlert[];
  onDismiss: (id: string) => void;
  onMarkAsSoldOut: (productId: string) => void;
}

export const InventoryAlertBanner: React.FC<Props> = ({ alerts, onDismiss, onMarkAsSoldOut }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 max-w-2xl mx-auto font-sans" dir="rtl">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all ${
            alert.severity === 'CRITICAL'
              ? 'bg-rose-950/90 border-rose-700/60 text-rose-100'
              : 'bg-amber-950/90 border-amber-700/60 text-amber-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold">{alert.productName} (کسری انبار)</p>
              <p className="text-xs opacity-80">{alert.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onMarkAsSoldOut(alert.productId);
                onDismiss(alert.id);
              }}
              className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition cursor-pointer"
            >
              ناموجود کردن در منو (Sold Out)
            </button>
            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1 hover:bg-white/10 rounded-lg text-xs opacity-60 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
