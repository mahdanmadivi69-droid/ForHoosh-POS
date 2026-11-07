// src/utils/tenantCurrencyFormatter.ts
import { SupportedLocale } from '../i18n/translations';

export interface CurrencyRule {
  code: string;            // ISO 4217 code
  minorUnitFactor: number; // Factor to convert minor unit to major (100 for EUR/USD, 1 for IRT)
  fractionDigits: number;  // 2 for EUR/USD, 0 for IRT
  symbol: Record<SupportedLocale, string>;
  symbolPosition: 'prefix' | 'suffix';
}

export interface TenantFinanceProfile {
  currencyCode: string;
  defaultLocale: SupportedLocale;
  taxRegistrationNumber?: string;
}

// Global registry of supported venue currencies
export const CURRENCY_REGISTRY: Record<string, CurrencyRule> = {
  EUR: {
    code: 'EUR',
    minorUnitFactor: 100,
    fractionDigits: 2,
    symbol: {
      en: '€',
      fa: 'یورو',
    },
    symbolPosition: 'suffix',
  },
  USD: {
    code: 'USD',
    minorUnitFactor: 100,
    fractionDigits: 2,
    symbol: {
      en: '$',
      fa: 'دلار',
    },
    symbolPosition: 'prefix',
  },
  IRT: {
    code: 'IRT',
    minorUnitFactor: 1,
    fractionDigits: 0,
    symbol: {
      en: 'Toman',
      fa: 'تومان',
    },
    symbolPosition: 'suffix',
  },
};

// Preset tenant profiles (supports dynamic resolution from tenantConfig/centralDb)
export const TENANT_FINANCE_REGISTRY: Record<string, TenantFinanceProfile> = {
  'tenant-vienna-bistro-01': {
    currencyCode: 'EUR',
    defaultLocale: 'en', // English UI with EUR currency for international venue
    taxRegistrationNumber: 'ATU78912345',
  },
  'tenant-100hich-01': {
    currencyCode: 'IRT',
    defaultLocale: 'fa',
  },
  'tenant-modendo-01': {
    currencyCode: 'IRT',
    defaultLocale: 'fa',
  },
};

export interface FormatMoneyOptions {
  locale?: SupportedLocale;
  showSymbol?: boolean;
  overrideCurrency?: string;
  useGrouping?: boolean; // Default: true (1,000 separators)
}

/**
 * Resolves standard BCP 47 locale tag from application SupportedLocale and currency
 */
function resolveBcp47Locale(locale: SupportedLocale, currencyCode: string): string {
  switch (locale) {
    case 'fa':
      return 'fa-IR';
    case 'en':
    default:
      return currencyCode === 'EUR' ? 'en-IE' : 'en-US';
  }
}

/**
 * Formats minor currency integer amounts into localized, human-readable monetary strings.
 *
 * @param minorAmount - Raw integer amount in minor currency units (e.g., 1050 cents = 10.50 EUR, 140000 = 140,000 Toman)
 * @param tenantIdOrCurrency - Tenant identifier (e.g. "tenant-vienna-bistro-01") or explicit ISO currency code ("EUR")
 * @param options - Customization flags for active locale, symbol visibility, and grouping
 */
export function formatTenantMoney(
  minorAmount: number,
  tenantIdOrCurrency: string,
  options: FormatMoneyOptions = {}
): string {
  if (typeof minorAmount !== 'number' || isNaN(minorAmount)) {
    return '—';
  }

  // 1. Resolve tenant currency and profile
  const tenantProfile = TENANT_FINANCE_REGISTRY[tenantIdOrCurrency];
  const currencyCode = (
    options.overrideCurrency ||
    tenantProfile?.currencyCode ||
    tenantIdOrCurrency
  ).toUpperCase();

  const rule = CURRENCY_REGISTRY[currencyCode] || CURRENCY_REGISTRY.EUR;

  // 2. Resolve active locale (options > tenant default > english fallback)
  const activeLocale: SupportedLocale =
    options.locale || tenantProfile?.defaultLocale || 'en';

  const bcp47 = resolveBcp47Locale(activeLocale, currencyCode);

  // 3. Convert minor units to major decimal
  const majorAmount = minorAmount / rule.minorUnitFactor;

  // 4. Format base numeric representation
  const useGrouping = options.useGrouping ?? true;
  const numberFormatter = new Intl.NumberFormat(bcp47, {
    minimumFractionDigits: rule.fractionDigits,
    maximumFractionDigits: rule.fractionDigits,
    useGrouping,
  });

  const formattedNumber = numberFormatter.format(majorAmount);

  // Return bare formatted number if symbol is omitted
  if (options.showSymbol === false) {
    return formattedNumber;
  }

  // 5. Append localized currency symbol
  const symbol = rule.symbol[activeLocale] || rule.code;

  if (activeLocale === 'fa') {
    // Standard Persian RTL order: "۱۰٫۵۰ یورو" or "۱۴۰٬۰۰۰ تومان"
    return `${formattedNumber} ${symbol}`;
  }

  if (rule.symbolPosition === 'prefix') {
    return `${symbol}${formattedNumber}`;
  }

  return `${formattedNumber} ${symbol}`;
}
