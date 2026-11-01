import { useEffect } from 'react';

export type HotkeyCommand = 'PUSH' | 'NAV_NEXT' | 'NAV_PREV' | 'ADVANCE' | 'ESCAPE';

/**
 * Physical keycode scan listener with fallback for Persian character sets
 * Enables 0-latency injection regardless of whether OS keyboard layout is EN or FA.
 * Also supports ergonomic POS control shortcuts (Ctrl+Enter, J/K, Space, Esc).
 */
export function useBilingualHotkeys(
  onHotkey: (index: number) => void,
  onCommand?: (command: HotkeyCommand) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input or textarea
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Handle Escape even inside inputs to allow quick unfocus/close
      if (e.key === 'Escape') {
        if (onCommand) {
          e.preventDefault();
          onCommand('ESCAPE');
        }
        return;
      }

      // Handle Ctrl+Enter / Cmd+Enter for instant Push-to-Execution even from input fields
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        if (onCommand) {
          e.preventDefault();
          onCommand('PUSH');
        }
        return;
      }

      // Skip remaining shortcuts if user is typing inside an input
      if (isInput) {
        return;
      }

      // 1. Navigation shortcuts (J/K or ArrowUp/ArrowDown)
      if (e.code === 'KeyJ' || e.key === 'ArrowDown') {
        if (onCommand) {
          e.preventDefault();
          onCommand('NAV_NEXT');
          return;
        }
      }
      if (e.code === 'KeyK' || e.key === 'ArrowUp') {
        if (onCommand) {
          e.preventDefault();
          onCommand('NAV_PREV');
          return;
        }
      }

      // 2. Advance Status shortcut (Spacebar)
      if (e.code === 'Space') {
        if (onCommand) {
          e.preventDefault();
          onCommand('ADVANCE');
          return;
        }
      }

      // 3. Check physical key scan-code (hardware level, layout-independent)
      const code = e.code; // e.g. "Digit1", "Numpad1"
      const digitMatch = code.match(/^(?:Digit|Numpad)([1-9])$/);
      if (digitMatch) {
        e.preventDefault();
        onHotkey(parseInt(digitMatch[1], 10));
        return;
      }

      // 4. Direct fallback for Persian localized digit characters (۱ تا ۹)
      const faDigits = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      const faIndex = faDigits.indexOf(e.key);
      if (faIndex !== -1) {
        e.preventDefault();
        onHotkey(faIndex + 1);
        return;
      }

      // 5. Arabic localized digit characters fallback (١ تا ٩)
      const arDigits = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      const arIndex = arDigits.indexOf(e.key);
      if (arIndex !== -1) {
        e.preventDefault();
        onHotkey(arIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onHotkey, onCommand]);
}
