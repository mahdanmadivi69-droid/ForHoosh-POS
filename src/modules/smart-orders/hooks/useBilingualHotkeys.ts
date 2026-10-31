import { useEffect } from 'react';

/**
 * Physical keycode scan listener with fallback for Persian character sets
 * Enables 0-latency injection regardless of whether OS keyboard layout is EN or FA.
 */
export function useBilingualHotkeys(onHotkey: (index: number) => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 1. Check physical key scan-code (hardware level, layout-independent)
      const code = e.code; // e.g. "Digit1", "Numpad1"
      const digitMatch = code.match(/^(?:Digit|Numpad)([1-9])$/);
      if (digitMatch) {
        e.preventDefault();
        onHotkey(parseInt(digitMatch[1], 10));
        return;
      }

      // 2. Direct fallback for Persian localized digit characters (۱ تا ۹)
      const faDigits = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      const faIndex = faDigits.indexOf(e.key);
      if (faIndex !== -1) {
        e.preventDefault();
        onHotkey(faIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onHotkey]);
}
