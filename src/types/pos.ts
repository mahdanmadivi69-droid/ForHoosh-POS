/**
 * KarWand CafeOS â€” Deterministic POS Types & Multi-Tenant Transfer / Split-Tender Contracts
 * Enforces strict integer-Toman precision and multi-tenant isolation ('100hich' vs 'modendo').
 */

export type PosTenantId = '100hich' | 'modendo';

export type PaymentTenderMethod = 'POS_TERMINAL' | 'CASH' | 'CARD_TRANSFER';

export interface OrderPaymentSplit {
  readonly id: string;
  readonly method: PaymentTenderMethod;
  /** Strictly positive integer in Toman (no decimals, no Rial conversion) */
  readonly amountToman: number;
  readonly timestamp: number;
}

export interface TableTransferPayload {
  readonly tenantId: PosTenantId;
  readonly sourceTableId: string;
  readonly targetTableId: string;
  readonly itemIds: readonly string[];
}

export interface PosItemModifier {
  readonly id: string;
  readonly nameFa: string;
  readonly priceDeltaToman: number;
}

export interface PosTableItem {
  readonly id: string;
  readonly menuItemId: string;
  readonly itemNameSnapshot: string;
  readonly unitPriceSnapshotToman: number;
  readonly quantity: number;
  readonly subtotalToman: number;
  readonly notes?: string;
  readonly modifiers?: readonly PosItemModifier[];
}

export type PosTableStatus = 'FREE' | 'OCCUPIED' | 'PAYMENT_PENDING';

export interface PosTableSession {
  readonly tenantId: PosTenantId;
  readonly tableId: string;
  readonly tableLabel: string;
  readonly status: PosTableStatus;
  readonly guestCount: number;
  readonly customerName: string;
  readonly notes: string;
  readonly openedAt: string;
  readonly items: readonly PosTableItem[];
  readonly discountToman: number;
  readonly grossAmountToman: number;
  readonly netTotalToman: number;
  readonly ps5FeeToman: number;
}

export interface SplitSettlementPayload {
  readonly tenantId: PosTenantId;
  readonly tableId: string;
  readonly splits: readonly OrderPaymentSplit[];
  readonly settledByUserId: string;
  readonly settledByUserName: string;
}

export interface SplitSettlementReceipt {
  readonly receiptId: string;
  readonly tenantId: PosTenantId;
  readonly tableId: string;
  readonly tableLabel: string;
  readonly items: readonly PosTableItem[];
  readonly grossAmountToman: number;
  readonly discountToman: number;
  readonly ps5FeeToman: number;
  readonly totalDueToman: number;
  readonly totalPaidToman: number;
  readonly splits: readonly OrderPaymentSplit[];
  readonly settledAt: number;
  readonly settledByUserId: string;
  readonly settledByUserName: string;
}

export interface TransferExecutionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly sourceSession?: PosTableSession | null;
  readonly targetSession?: PosTableSession;
  readonly transferredCount: number;
  readonly transferredAmountToman: number;
}

export interface SplitSettlementResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly receipt?: SplitSettlementReceipt;
}
