/**
 * Persian (Farsi) Localization & Numeral Normalization Engine
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts any ASCII digits to Persian digits (۰-۹)
 */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (char) => FA_DIGITS[parseInt(char, 10)]);
}

/**
 * Formats monetary amounts into localized Persian Toman with comma separation.
 * e.g. 45000 -> "۴۵٬۰۰۰ تومان" or "45,000 تومان"
 */
export function formatToman(
  amount: number,
  digits: 'persian' | 'latin' = 'persian'
): string {
  const safeInt = Math.round(Number.isFinite(amount) ? amount : 0);
  
  if (digits === 'latin') {
    // Tabular ASCII numerals for cashier receipts/monospace telemetry
    return `${safeInt.toLocaleString('en-US')} تومان`;
  }
  
  const formattedNumber = new Intl.NumberFormat('fa-IR').format(safeInt);
  return `${formattedNumber} تومان`;
}

/**
 * Safe conversion of seconds into formatted MM:SS string with LTR isolation
 */
export function formatTimerSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}`;
}
