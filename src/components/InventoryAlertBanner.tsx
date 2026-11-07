// InventoryAlertBanner.tsx
import React from 'react';
import { StockAlert } from '../hooks/useInventoryAlerts';

interface Props {
  alerts: StockAlert[];
  onDismiss: (id: string) => void;
  onMarkAsSoldOut: (productId: string) => void;
}

export const InventoryAlertBanner: React.FC<Props> = ({
  alerts,
  onDismiss,
  onMarkAsSoldOut,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-amber-950/80 border-b border-amber-600/40 text-amber-200 px-4 py-2 text-xs flex flex-col gap-1 z-40 relative backdrop-blur animate-in fade-in">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
            <span className="font-medium text-amber-100">
              [هشدار موجودی بحرانی] کالای «{alert.productName}» به حداقل مجاز (
              {alert.currentStock} عدد) رسیده است!
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onMarkAsSoldOut(alert.productId)}
              className="bg-red-800/80 hover:bg-red-700 text-white font-semibold px-2 py-0.5 rounded text-[10px] transition border border-red-500/50"
            >
              ۸۶ کردن آیتم در منو
            </button>
            <button
              onClick={() => onDismiss(alert.id)}
              className="text-amber-400 hover:text-white px-1.5 py-0.5 text-[11px]"
              title="نادیده گرفتن موقت"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
