/**
 * CAFE OS — Hardware HID Barcode Scanner React Hook
 * Path: src/hooks/useHardwareScanner.ts
 *
 * Captures high-frequency keystroke bursts emitted by USB/Bluetooth HID scanners:
 * 1. Measures inter-keystroke intervals (maxIntervalMs <= 40ms).
 * 2. Filters out normal human typing when interval threshold is exceeded.
 * 3. Can ignore input events originating from editable inputs and textareas (ignoreInInputs).
 * 4. Dispatches onScan callback upon receiving terminating key (default: Enter).
 */

import { useEffect, useRef } from 'react';

export interface UseHardwareScannerOptions {
  onScan: (rawBarcode: string) => void;
  maxIntervalMs?: number;     // Keystroke gap threshold for HID hardware (default: 40ms)
  minBarcodeLength?: number; // Minimum characters for a valid barcode (default: 3)
  ignoreInInputs?: boolean;  // Ignore keystrokes when focused on input/textarea (default: true)
  endKeys?: string[];        // Terminating keys (default: ['Enter'])
}

export function useHardwareScanner({
  onScan,
  maxIntervalMs = 40,
  minBarcodeLength = 3,
  ignoreInInputs = true,
  endKeys = ['Enter'],
}: UseHardwareScannerOptions): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Check if event originates in an input field
      if (ignoreInInputs) {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
      }

      const now = performance.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Clear any pending timeout
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      // If time between keystrokes exceeds threshold, this is not a continuation of an HID burst
      if (delta > maxIntervalMs) {
        bufferRef.current = '';
      }

      // Check if this key is a barcode terminator (e.g. Enter)
      if (endKeys.includes(event.key)) {
        if (bufferRef.current.length >= minBarcodeLength) {
          const barcode = bufferRef.current;
          bufferRef.current = '';
          onScanRef.current(barcode);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // Only append printable characters (length === 1)
      if (event.key && event.key.length === 1) {
        bufferRef.current += event.key;

        // Auto-clear buffer if no keystroke or terminator follows within maxIntervalMs * 4
        clearTimerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, maxIntervalMs * 4);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, [maxIntervalMs, minBarcodeLength, ignoreInInputs, endKeys]);
}
