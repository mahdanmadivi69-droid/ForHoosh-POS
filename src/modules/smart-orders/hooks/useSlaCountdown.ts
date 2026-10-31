import { useState, useEffect } from 'react';
import { formatTimerSeconds } from '../utils/farsiFormatting';

export interface SlaState {
  elapsedSeconds: number;
  remainingSeconds: number;
  isBreached: boolean;
  percentage: number;
  slaColor: string; // '#10B981' | '#F59E0B' | '#D71921'
  slaStatusText: 'NORMAL' | 'WARNING' | 'BREACHED';
  formattedElapsed: string;
}

/**
 * 1000ms drift-safe SLA timer tick
 * Smooth transition: Emerald (#10B981) -> Amber (#F59E0B) -> Crimson (#D71921)
 */
export function useSlaCountdown(
  createdAtMs: number,
  targetSlaSeconds: number = 180,
  isCompleted: boolean = false
): SlaState {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (isCompleted) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isCompleted]);

  const elapsedSeconds = Math.max(0, Math.floor((now - createdAtMs) / 1000));
  const remainingSeconds = Math.max(0, targetSlaSeconds - elapsedSeconds);
  const percentage = Math.min(150, Math.round((elapsedSeconds / targetSlaSeconds) * 100));

  let slaColor = '#10B981'; // Emerald
  let slaStatusText: 'NORMAL' | 'WARNING' | 'BREACHED' = 'NORMAL';

  if (percentage >= 100) {
    slaColor = '#D71921'; // Crimson (Breached)
    slaStatusText = 'BREACHED';
  } else if (percentage >= 70) {
    slaColor = '#F59E0B'; // Amber (Warning)
    slaStatusText = 'WARNING';
  }

  return {
    elapsedSeconds,
    remainingSeconds,
    isBreached: percentage >= 100,
    percentage,
    slaColor,
    slaStatusText,
    formattedElapsed: formatTimerSeconds(elapsedSeconds),
  };
}
