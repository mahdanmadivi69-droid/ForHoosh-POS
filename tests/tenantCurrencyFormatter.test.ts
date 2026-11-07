// tests/tenantCurrencyFormatter.test.ts
import { describe, it, expect } from 'vitest';
import { formatTenantMoney } from '../src/utils/tenantCurrencyFormatter';

describe('formatTenantMoney Multi-Currency Engine', () => {
  describe('European / Vienna Tenant (EUR)', () => {
    it('formats 1050 cents into Austrian German locale (de-AT)', () => {
      const result = formatTenantMoney(1050, 'tenant-vienna-bistro-01', { locale: 'de' });
      // Non-breaking space or standard space before €
      expect(result).toMatch(/10,50\s*€/);
    });

    it('formats 1050 cents into English locale (en)', () => {
      const result = formatTenantMoney(1050, 'tenant-vienna-bistro-01', { locale: 'en' });
      expect(result).toMatch(/10\.50\s*€/);
    });

    it('formats EUR into Persian locale with localized symbol', () => {
      const result = formatTenantMoney(1050, 'tenant-vienna-bistro-01', { locale: 'fa' });
      expect(result).toContain('یورو');
    });

    it('suppresses symbol when showSymbol is false', () => {
      const result = formatTenantMoney(1050, 'tenant-vienna-bistro-01', {
        locale: 'en',
        showSymbol: false,
      });
      expect(result).toBe('10.50');
    });
  });

  describe('Iranian / Tehran Tenant (IRT - Toman)', () => {
    it('formats 140000 Toman in Persian locale with Persian digits', () => {
      const result = formatTenantMoney(140000, 'tenant-100hich-01', { locale: 'fa' });
      expect(result).toContain('تومان');
      expect(result).toContain('۱۴۰٬۰۰۰');
    });

    it('formats 140000 Toman in English locale without decimals', () => {
      const result = formatTenantMoney(140000, 'tenant-100hich-01', { locale: 'en' });
      expect(result).toBe('140,000 Toman');
    });
  });

  describe('Edge cases and fallbacks', () => {
    it('returns placeholder for NaN or invalid amounts', () => {
      expect(formatTenantMoney(NaN, 'EUR')).toBe('—');
      expect(formatTenantMoney(undefined as unknown as number, 'EUR')).toBe('—');
    });

    it('handles zero minor amount correctly', () => {
      const result = formatTenantMoney(0, 'tenant-vienna-bistro-01', { locale: 'de' });
      expect(result).toMatch(/0,00\s*€/);
    });

    it('formats explicit currency code if tenantId is omitted', () => {
      const result = formatTenantMoney(2500, 'USD', { locale: 'en' });
      expect(result).toBe('$25.00');
    });
  });
});
