/**
 * src/utils/digitNormalizer.ts
 * 
 * Normalizes Eastern Arabic / Persian numerals (۰-۹, ٠-٩) to standard ASCII Latin digits (0-9).
 * Ensures that PIN keypad inputs, keyboard entry across Iranian locale keyboards,
 * and input field parsing maintain strict equality and arithmetic integrity.
 */

export function normalizeDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}
