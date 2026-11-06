import React, { useState, useCallback } from 'react';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { decodeTableBarcode, DecodedTablePayload } from '../utils/tableTokenDecoder';

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number; // Integer Toman precision
  notes?: string;
}

interface PosCheckoutViewProps {
  currentTenantId: string;
  cartItems: CartItem[];
  onTableChange: (tableNumber: string) => void;
  onDispatchOrder: (orderPayload: {
    tableNumber: string;
    items: CartItem[];
    subtotal: number;
  }) => Promise<void>;
}

export const PosCheckoutView: React.FC<PosCheckoutViewProps> = ({
  currentTenantId,
  cartItems,
  onTableChange,
  onDispatchOrder,
}) => {
  const [activeTable, setActiveTable] = useState<string>('T1');
  const [scanNotification, setScanNotification] = useState<{
    text: string;
    status: 'success' | 'warning' | 'idle';
  }>({ text: '', status: 'idle' });

  // 1. Hardware Scanner Hook Integration
  const handleBarcodeScanned = useCallback(
    (rawBarcode: string) => {
      const decoded: DecodedTablePayload = decodeTableBarcode(rawBarcode, currentTenantId);

      if (decoded.isValid && decoded.tableNumber) {
        setActiveTable(decoded.tableNumber);
        onTableChange(decoded.tableNumber);

        // Tactile & visual feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([40, 60, 40]);
        }

        setScanNotification({
          text: `میز ${decoded.tableNumber} با اسکنر سخت‌افزاری انتخاب شد`,
          status: 'success',
        });

        // Auto-dismiss alert banner after 2.5s
        setTimeout(() => {
          setScanNotification({ text: '', status: 'idle' });
        }, 2500);
      } else {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(180); // Long buzz for error
        }

        setScanNotification({
          text: `بارکد نامعتبر یا متعلق به این کافه نیست: ${rawBarcode}`,
          status: 'warning',
        });

        setTimeout(() => {
          setScanNotification({ text: '', status: 'idle' });
        }, 3000);
      }
    },
    [currentTenantId, onTableChange]
  );

  useHardwareScanner({
    onScan: handleBarcodeScanned,
    maxIntervalMs: 40,      // Keystroke gap threshold for HID hardware
    minBarcodeLength: 3,
    ignoreInInputs: true,   // Allow barista to type notes into search/note fields
  });

  // Calculate cart totals (strictly integer Toman)
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <div className="flex flex-col h-full bg-[#121417] text-zinc-100 select-none">
      {/* Top Bar: Table Assignment & Hardware Scanner Status */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0F223D]/80 border-b border-zinc-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700">
            <span className="text-xs text-zinc-400 font-medium">میز فعال:</span>
            <span
              data-testid="active-table-badge"
              className="text-sm font-bold text-amber-400 font-mono tracking-wide"
            >
              {activeTable}
            </span>
          </div>

          {/* Scanner Pulse Telemetry */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>HID SCANNER READY</span>
          </div>
        </div>

        {/* Quick Table Manual Switchers */}
        <div className="flex items-center gap-1">
          {['T1', 'T2', 'T3', 'BAR'].map((tbl) => (
            <button
              key={tbl}
              type="button"
              onClick={() => {
                setActiveTable(tbl);
                onTableChange(tbl);
              }}
              className={`px-2.5 py-1 text-xs rounded transition-all ${
                activeTable === tbl
                  ? 'bg-[#D71921] text-white font-bold'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {tbl}
            </button>
          ))}
        </div>
      </div>

      {/* Floating HUD Banner on Scan Discovery */}
      {scanNotification.status !== 'idle' && (
        <div
          data-testid="scanner-notification-banner"
          className={`mx-4 mt-2 px-3 py-2 rounded text-xs flex items-center justify-between border transition-all animate-in fade-in slide-in-from-top-1 ${
            scanNotification.status === 'success'
              ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-300'
              : 'bg-rose-950/70 border-rose-600/50 text-rose-300'
          }`}
        >
          <span>{scanNotification.text}</span>
          <span className="font-mono text-[10px] opacity-75">AUTO-ATTACHED</span>
        </div>
      )}

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-zinc-800/60">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm">
            <span>سبد سفارش خالی است</span>
            <span className="text-xs text-zinc-600 mt-1">
              اسکن بارکد میز در هر لحظه میز را تغییر می‌دهد
            </span>
          </div>
        ) : (
          cartItems.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-zinc-200">{item.name}</div>
                {item.notes && (
                  <div className="text-xs text-amber-500/80 mt-0.5">{item.notes}</div>
                )}
                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                  {item.quantity} × {item.unitPrice.toLocaleString('fa-IR')} تومان
                </div>
              </div>
              <div className="text-sm font-bold text-zinc-100 font-mono">
                {(item.quantity * item.unitPrice).toLocaleString('fa-IR')} تومان
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Dispatch Actions */}
      <div className="p-4 bg-zinc-950/90 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-zinc-400">جمع کل سفارش:</span>
          <span className="text-base font-bold text-white font-mono">
            {subtotal.toLocaleString('fa-IR')} تومان
          </span>
        </div>

        <button
          type="button"
          disabled={cartItems.length === 0}
          onClick={() =>
            onDispatchOrder({
              tableNumber: activeTable,
              items: cartItems,
              subtotal,
            })
          }
          className="w-full py-3.5 rounded-lg bg-[#D71921] hover:bg-[#b01319] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm tracking-wide shadow-lg shadow-red-950/40 transition-all"
        >
          ثبت و ارسال سفارش میز {activeTable}
        </button>
      </div>
    </div>
  );
};
