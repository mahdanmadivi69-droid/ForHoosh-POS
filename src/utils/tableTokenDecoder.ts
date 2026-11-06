/**
 * CAFE OS — Table QR / Barcode Token Decoder
 * Path: src/utils/tableTokenDecoder.ts
 *
 * Decodes table identifiers from physical barcodes or QR codes:
 * 1. Supports KW token format: "KW:<tenantId>:<tableNumber>:<signature>"
 * 2. Supports JSON format: '{"tenantId":"...","table":"..."}'
 * 3. Enforces strict multi-tenant isolation against expectedTenantId.
 */

export interface DecodedTablePayload {
  isValid: boolean;
  tenantId?: string;
  tableNumber?: string;
  signature?: string;
  raw: string;
  error?: string;
}

export function decodeTableBarcode(
  rawBarcode: string,
  expectedTenantId?: string
): DecodedTablePayload {
  const trimmed = (rawBarcode || '').trim();

  if (!trimmed) {
    return {
      isValid: false,
      raw: rawBarcode,
      error: 'Empty barcode string',
    };
  }

  // 1. Format: KW:<tenantId>:<tableNumber>:<signature>
  if (trimmed.startsWith('KW:')) {
    const parts = trimmed.split(':');
    if (parts.length >= 3) {
      const tenantId = parts[1];
      const tableNumber = parts[2];
      const signature = parts.slice(3).join(':');

      if (expectedTenantId && tenantId !== expectedTenantId) {
        return {
          isValid: false,
          tenantId,
          tableNumber,
          signature,
          raw: rawBarcode,
          error: `Tenant mismatch: expected ${expectedTenantId}, got ${tenantId}`,
        };
      }

      return {
        isValid: true,
        tenantId,
        tableNumber,
        signature: signature || undefined,
        raw: rawBarcode,
      };
    }
  }

  // 2. Format: JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const tenantId = parsed.tenantId || parsed.tenant_id;
      const tableNumber = parsed.tableNumber || parsed.table || parsed.table_number;

      if (tableNumber) {
        if (expectedTenantId && tenantId && tenantId !== expectedTenantId) {
          return {
            isValid: false,
            tenantId,
            tableNumber: String(tableNumber),
            raw: rawBarcode,
            error: `Tenant mismatch: expected ${expectedTenantId}, got ${tenantId}`,
          };
        }

        return {
          isValid: true,
          tenantId: tenantId || expectedTenantId,
          tableNumber: String(tableNumber),
          signature: parsed.signature,
          raw: rawBarcode,
        };
      }
    } catch {
      // Fall through if JSON parsing fails
    }
  }

  // 3. Fallback for simple table codes if no tenant constraint specified
  if (/^[A-Za-z0-9_-]{1,10}$/.test(trimmed) && !expectedTenantId) {
    return {
      isValid: true,
      tableNumber: trimmed,
      raw: rawBarcode,
    };
  }

  return {
    isValid: false,
    raw: rawBarcode,
    error: 'Unrecognized barcode format or missing tenant token',
  };
}
