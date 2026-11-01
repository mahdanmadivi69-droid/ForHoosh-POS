/**
 * CAFE OS — Dual Thermal KDS Dispatch Action Bar
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0
 *
 * Implements:
 *  - Industrial Dark Palette: Slate #0D0F12, Panel #161A1F, Crimson #D71921, Amber #F59E0B
 *  - Exact Button Token: bg-[#D71921] hover:bg-[#b01319] active:scale-[0.98] text-white font-mono
 *  - Acoustic Dual-Tone Feedback: sine wave [660, 880] Hz, 120ms duration via Web Audio API
 *  - Real-time Hardware Status Indicator: ready (emerald-500), busy (amber-500 pulse), offline (red-500), out_of_paper (orange-500)
 *  - Station Partitioning: automatic split into BAR and KITCHEN
 *  - Delta Print Indicator: suppresses duplicates, flags "سفارش تکمیلی / ADDITIONAL ORDER"
 *  - Table Preservation: keeps the table bill active and open without closing/settling.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  Coffee,
  UtensilsCrossed,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  StationRouter,
  RoutableCartItem,
  SplitTicketResult,
} from '../services/StationRouter';
import {
  thermalPrinterDriver,
  PrinterStatus,
  PrintDispatchResult,
} from '../services/ThermalPrinterDriver';

export interface DispatchActionBarProps {
  items: RoutableCartItem[];
  alreadyDispatchedIds?: string[] | Set<string>;
  tableLabel?: string;
  ticketId?: string | number;
  orderNumber?: number;
  cashierName?: string;
  orderNotes?: string;
  disabled?: boolean;
  onBeforeDispatch?: () => Promise<boolean> | boolean;
  onDispatchComplete?: (
    splitResult: SplitTicketResult,
    printResults: { barResult?: PrintDispatchResult; kitchenResult?: PrintDispatchResult }
  ) => void;
  className?: string;
  showStatusIndicator?: boolean;
}

/**
 * Plays the exact dual-tone acoustic chime requested in the specification:
 * Waveform: "sine", Frequencies: [660, 880] Hz, Duration: 120ms
 */
export function playDispatchTicketAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const duration = 0.12; // 120 ms

    const frequencies = [660, 880];
    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    });
  } catch (e) {
    console.warn('[DispatchActionBar] Web Audio dispatch chime playback ignored:', e);
  }
}

export const DispatchActionBar: React.FC<DispatchActionBarProps> = ({
  items,
  alreadyDispatchedIds,
  tableLabel = 'میز ۱',
  ticketId = 'T-101',
  orderNumber = 101,
  cashierName = 'صندوقدار',
  orderNotes,
  disabled = false,
  onBeforeDispatch,
  onDispatchComplete,
  className = '',
  showStatusIndicator = true,
}) => {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(
    thermalPrinterDriver.getStatus()
  );
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [lastDispatchedTimestamp, setLastDispatchedTimestamp] = useState<string | null>(null);

  // Subscribe to hardware printer driver status changes
  useEffect(() => {
    const unsubscribe = thermalPrinterDriver.subscribeStatus((status) => {
      setPrinterStatus(status);
    });
    return unsubscribe;
  }, []);

  // Compute live partition and delta detection via StationRouter
  const splitResult: SplitTicketResult = useMemo(() => {
    return StationRouter.splitTicket(items, alreadyDispatchedIds, {
      ticketId,
      orderNumber,
      tableLabel,
      cashierName,
      orderNotes,
    });
  }, [items, alreadyDispatchedIds, ticketId, orderNumber, tableLabel, cashierName, orderNotes]);

  const handleDispatch = useCallback(async () => {
    if (disabled || isDispatching || !splitResult.hasItemsToDispatch) {
      return;
    }

    if (onBeforeDispatch) {
      const proceed = await onBeforeDispatch();
      if (!proceed) return;
    }

    setIsDispatching(true);

    // 1. Play signature dual-tone acoustic ticket feedback [660, 880] Hz, 120ms
    playDispatchTicketAudio();

    try {
      // 2. Dispatch to thermal hardware drivers (WebSerial -> Raw Socket -> Headless Iframe)
      const printResults = await thermalPrinterDriver.printBothStations(splitResult);

      setLastDispatchedTimestamp(
        new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );

      // 3. Callback to parent container (updates session tab state without settling table)
      if (onDispatchComplete) {
        onDispatchComplete(splitResult, printResults);
      }
    } catch (err) {
      console.error('[DispatchActionBar] Dispatch execution error:', err);
    } finally {
      setIsDispatching(false);
    }
  }, [
    disabled,
    isDispatching,
    splitResult,
    onBeforeDispatch,
    onDispatchComplete,
  ]);

  // Printer status indicator tokens per handoff spec
  const statusColorToken: Record<PrinterStatus, string> = {
    ready: 'bg-emerald-500',
    busy: 'bg-amber-500 animate-pulse',
    offline: 'bg-red-500',
    out_of_paper: 'bg-orange-500',
  };

  const statusLabelFa: Record<PrinterStatus, string> = {
    ready: 'پرینتر آماده',
    busy: 'در حال ارسال',
    offline: 'پرینتر آفلاین',
    out_of_paper: 'اتمام کاغذ',
  };

  const canDispatch = splitResult.hasItemsToDispatch && !disabled && !isDispatching;

  return (
    <div
      className={`rounded-xl bg-[#161A1F] border border-white/[0.08] p-3 text-white space-y-2.5 shadow-lg select-none ${className}`}
    >
      {/* Top Meta Bar: Hardware Status & Station Breakdown */}
      <div className="flex items-center justify-between text-xs">
        {/* Hardware Status Dot */}
        {showStatusIndicator && (
          <div className="flex items-center gap-1.5 bg-[#0D0F12] px-2 py-1 rounded-md border border-white/[0.06]">
            <span
              className={`w-2 h-2 rounded-full ${statusColorToken[printerStatus]}`}
              aria-label={statusLabelFa[printerStatus]}
            />
            <span className="text-[11px] font-mono text-[#9EACB8]">
              {statusLabelFa[printerStatus]}
            </span>
          </div>
        )}

        {/* Station Breakdown Badges */}
        <div className="flex items-center gap-1.5">
          {splitResult.hasBarItems && (
            <div className="flex items-center gap-1 bg-blue-950/70 border border-blue-700/50 text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold">
              <Coffee className="w-3 h-3" />
              <span>بار ({splitResult.barTicket.items.length})</span>
            </div>
          )}

          {splitResult.hasKitchenItems && (
            <div className="flex items-center gap-1 bg-amber-950/70 border border-amber-700/50 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
              <UtensilsCrossed className="w-3 h-3" />
              <span>آشپزخانه ({splitResult.kitchenTicket.items.length})</span>
            </div>
          )}

          {/* Delta Ordering Badge */}
          {splitResult.isDelta && (
            <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-500 text-amber-400 px-2 py-0.5 rounded text-[10px] font-black animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>سفارش تکمیلی (Delta)</span>
            </div>
          )}
        </div>
      </div>

      {/* Delta Print Info Banner (when applicable) */}
      {splitResult.isDelta && (
        <div className="bg-[#0D0F12] rounded-lg p-2 border border-amber-500/30 text-[11px] text-amber-300/90 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>فقط {splitResult.totalItemsDispatched} قلم جدید به چاپگر ارسال می‌شود.</span>
          </div>
          <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700/60 font-mono">
            جلوگیری از چاپ تکراری
          </span>
        </div>
      )}

      {/* Primary Dispatch Button conforming to spec */}
      <button
        type="button"
        onClick={handleDispatch}
        disabled={!canDispatch}
        className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer font-bold text-sm ${
          canDispatch
            ? 'bg-[#D71921] hover:bg-[#b01319] active:scale-[0.98] text-white font-mono shadow-[0_0_20px_-2px_rgba(215,25,33,0.5)]'
            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/[0.05]'
        }`}
      >
        <Printer className={`w-4 h-4 ${isDispatching ? 'animate-bounce' : ''}`} />
        <span>
          {isDispatching
            ? 'در حال صدور فرمان پرینت...'
            : 'ارسال به آماده‌سازی (KDS & Print)'}
        </span>
        {splitResult.hasItemsToDispatch && (
          <span className="bg-black/30 border border-white/20 text-white text-[11px] px-1.5 py-0.5 rounded font-mono">
            {splitResult.totalItemsDispatched} قلم
          </span>
        )}
      </button>

      {/* Open Table Notice (Zero Session Closure) */}
      <div className="flex items-center justify-between text-[10px] text-[#9EACB8] pt-0.5 px-1 font-mono">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
          میز باز می‌ماند (Late Checkout)
        </span>
        {lastDispatchedTimestamp && (
          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3 h-3" />
            آخرین ارسال: {lastDispatchedTimestamp}
          </span>
        )}
      </div>
    </div>
  );
};

export default DispatchActionBar;
