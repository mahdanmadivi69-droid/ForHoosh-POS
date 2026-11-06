import { describe, it, expect } from 'vitest';
import { decodeTableBarcode } from '../src/utils/tableTokenDecoder';

describe('Table QR & Barcode Token Decoder', () => {
  it('correctly decodes standard KW format for valid tenant', () => {
    const raw = 'KW:tenant-100hich-01:T8:signature999';
    const decoded = decodeTableBarcode(raw, 'tenant-100hich-01');

    expect(decoded.isValid).toBe(true);
    expect(decoded.tenantId).toBe('tenant-100hich-01');
    expect(decoded.tableNumber).toBe('T8');
    expect(decoded.signature).toBe('signature999');
    expect(decoded.raw).toBe(raw);
  });

  it('rejects barcode when tenant does not match expected tenant (multi-tenant guard)', () => {
    const alienBarcode = 'KW:tenant-modendo-01:T14:other';
    const decoded = decodeTableBarcode(alienBarcode, 'tenant-100hich-01');

    expect(decoded.isValid).toBe(false);
    expect(decoded.tableNumber).toBe('T14');
    expect(decoded.error).toContain('Tenant mismatch');
  });

  it('parses JSON formatted table barcodes', () => {
    const jsonBarcode = JSON.stringify({
      tenantId: 'tenant-100hich-01',
      tableNumber: 'BAR-02',
      signature: 'sig-abc',
    });

    const decoded = decodeTableBarcode(jsonBarcode, 'tenant-100hich-01');
    expect(decoded.isValid).toBe(true);
    expect(decoded.tableNumber).toBe('BAR-02');
  });

  it('handles empty or corrupted barcode strings gracefully', () => {
    const empty = decodeTableBarcode('', 'tenant-100hich-01');
    expect(empty.isValid).toBe(false);

    const corrupt = decodeTableBarcode('???', 'tenant-100hich-01');
    expect(corrupt.isValid).toBe(false);
  });
});
