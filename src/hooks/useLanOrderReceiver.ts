// src/hooks/useLanOrderReceiver.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { LanOrderPayload, WsMessageEnvelope } from '../services/lanOrderSocketDaemon';

export interface UseLanOrderReceiverOptions {
  tenantId: string;
  enabled?: boolean;
  daemonUrl?: string; // Default: 'ws://127.0.0.1:9101'
  onOrderArrived: (order: LanOrderPayload) => void;
}

export function useLanOrderReceiver({
  tenantId,
  enabled = true,
  daemonUrl = 'ws://127.0.0.1:9101',
  onOrderArrived,
}: UseLanOrderReceiverOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onOrderArrivedRef = useRef(onOrderArrived);

  useEffect(() => {
    onOrderArrivedRef.current = onOrderArrived;
  }, [onOrderArrived]);

  // Zero-asset synthetic chime using Web Audio API
  const playArrivalChime = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Dual-tone chime (587.33 Hz [D5] -> 880 Hz [A5])
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // AudioContext might be blocked until first user interaction
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      try {
        const ws = new WebSocket(daemonUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          // Register station role and tenant
          const registerEnvelope: WsMessageEnvelope = {
            type: 'REGISTER',
            role: 'KDS',
            tenantId,
          };
          ws.send(JSON.stringify(registerEnvelope));
        };

        ws.onmessage = (event) => {
          try {
            const envelope: WsMessageEnvelope = JSON.parse(event.data);
            if (envelope.type === 'ORDER_INJECT' && envelope.payload) {
              const order = envelope.payload as LanOrderPayload;
              playArrivalChime();
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
              }
              onOrderArrivedRef.current(order);
            }
          } catch (err) {
            console.error('Failed to parse LAN order envelope:', err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;
          if (!isDisposed) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!isDisposed) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tenantId, enabled, daemonUrl, playArrivalChime]);

  return { isConnected };
}
