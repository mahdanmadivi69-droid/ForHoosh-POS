import { SecureCredential } from '../services/credentials';
/**
 * Domain entities and types for SmartOrders
 * All monetary amounts are in Toman as exact integers (BigInt or number without fractional decimals)
 */

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'BARISTA';

export function isManagerOrOwner(role: UserRole): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}


export interface User {
  id: string;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  username: string;
  password?: string;
  pin?: string;
  credential?: SecureCredential;
  mustChangePassword?: boolean;
  role: UserRole;
  isActive: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  currency: 'TOMAN' | 'IRR' | 'USD';
  phone?: string;
  address?: string;
}

export interface Category {
  id: string;
  tenantId: string;
  nameFa: string;
  nameEn?: string;
  sortOrder: number;
  isActive: boolean;
}

export type PrepStation = 'BAR' | 'KITCHEN' | 'NO_PREP';

export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  nameFa: string;
  nameEn?: string;
  priceToman: number; // Stored as integer Toman
  isAvailable: boolean;
  station?: PrepStation;
  description?: string;
  currentStock?: number; // Ù…ÙˆØ¬ÙˆØ¯ÛŒ ÙØ¹Ù„ÛŒ Ø§Ù†Ø¨Ø§Ø±/Ú©Ø§ÙÙ‡ Ø¨Ù‡ Ø¹Ø¯Ø¯
  lowStockThreshold?: number; // Ø¢Ø³ØªØ§Ù†Ù‡ Ù‡Ø´Ø¯Ø§Ø± Ú©Ø³Ø±ÛŒ Ù…ÙˆØ¬ÙˆØ¯ÛŒ Ø§Ø®ØªØµØ§ØµÛŒ Ø¢ÛŒØªÙ…
  roast?: 'all' | 'medium' | 'dark' | 'light';
  roastLevelText?: string;
  weight?: string;
  origin?: string;
  process?: string;
  elevation?: string;
  notes?: string[];
  badge?: string | null;
  isBean?: boolean;
  hasDualBean?: boolean;
  priceArabica?: number;
  priceBlend?: number;
  bomGramsPerCup?: number;
}

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface Shift {
  id: string;
  tenantId: string;
  openedByUserId: string;
  openedByUserName: string;
  closedByUserId?: string;
  closedByUserName?: string;
  openedAt: string; // ISO string
  closedAt?: string; // ISO string
  openingCashToman: number; // Ù…ÙˆØ¬ÙˆØ¯ÛŒ Ø§ÙˆÙ„ÛŒÙ‡ ØµÙ†Ø¯ÙˆÙ‚ Ù†Ù‚Ø¯
  expectedClosingCashToman: number; // Ù…ÙˆØ¬ÙˆØ¯ÛŒ Ù†Ù‚Ø¯ Ù…Ø­Ø§Ø³Ø¨Ù‡â€ŒØ´Ø¯Ù‡ ØªÙˆØ³Ø· Ø³ÛŒØ³ØªÙ…
  actualCountedCashToman?: number; // Ù†Ù‚Ø¯ Ø´Ù…Ø±Ø¯Ù‡â€ŒØ´Ø¯Ù‡ ÙÛŒØ²ÛŒÚ©ÛŒ Ø¯Ø± Ù¾Ø§ÛŒØ§Ù† Ø´ÛŒÙØª
  cashDiscrepancyToman?: number; // actual - expected (Ù…Ù†ÙÛŒ ÛŒØ¹Ù†ÛŒ Ú©Ø³Ø±ÛŒØŒ Ù…Ø«Ø¨Øª ÛŒØ¹Ù†ÛŒ Ù…Ø§Ø²Ø§Ø¯)
  discrepancyReason?: string;
  status: ShiftStatus;
  notes?: string;
  /** Immutable lock â€” set on close; a closed shift's numbers must never be mutated retroactively. */
  locked?: boolean;
}

export type OrderStatus = 'DRAFT' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface OrderItem {
  id: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPriceSnapshotToman: number;
  quantity: number;
  subtotalToman: number; // unitPriceSnapshotToman * quantity
  notes?: string;
  station?: PrepStation;
  status?: 'PENDING_DISPATCH' | 'DISPATCHED' | 'PREPARING' | 'SERVED' | 'SETTLED';
  dispatchedAt?: string;
  modifiers?: Array<{ id: string; nameFa: string; priceDeltaToman: number }>;
}

export interface Order {
  id: string;
  tenantId: string;
  shiftId: string;
  createdByUserId: string;
  createdByUserName: string;
  orderNumber: number;
  /** Daily receipt sequence number (per tenant + local day, 1-based â†’ #001). Allocated inside the atomic checkout Dexie transaction. */
  dailyReceiptNumber?: number;
  orderType: OrderType;
  tableLabel?: string;
  customerName?: string;
  notes?: string;
  status: OrderStatus;
  items: OrderItem[];
  grossAmountToman: number; // Ù…Ø¬Ù…ÙˆØ¹ Ù‚ÛŒÙ…Øª Ø¢ÛŒØªÙ…â€ŒÙ‡Ø§ Ù‚Ø¨Ù„ Ø§Ø² ØªØ®ÙÛŒÙ
  discountAmountToman: number; // ØªØ®ÙÛŒÙ
  netTotalToman: number; // grossAmountToman - discountAmountToman
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'CASH' | 'CARD_MANUAL' | 'OTHER';
export type PaymentStatus = 'SUCCESSFUL' | 'REFUNDED' | 'VOIDED';

export interface Payment {
  id: string;
  tenantId: string;
  orderId: string;
  shiftId: string;
  receivedByUserId: string;
  amountToman: number;
  paymentMethod: PaymentMethod;
  referenceCode?: string; // Ø´Ù…Ø§Ø±Ù‡ Ù¾ÛŒÚ¯ÛŒØ±ÛŒ Ú©Ø§Ø±ØªØ®ÙˆØ§Ù†
  terminalName?: string; // Ù†Ø§Ù… Ø¯Ø³ØªÚ¯Ø§Ù‡ Ú©Ø§Ø±ØªØ®ÙˆØ§Ù† Ù…Ø«Ù„Ø§Ù‹ "Ø¨Ù‡â€ŒÙ¾Ø±Ø¯Ø§Ø®Øª Ù…Ù„Øª"
  status: PaymentStatus;
  createdAt: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  shiftId: string;
  recordedByUserId: string;
  recordedByUserName: string;
  category: string; // Ù…Ø«Ù„Ø§Ù‹: Ø´ÛŒØ± Ùˆ Ù„Ø¨Ù†ÛŒØ§ØªØŒ Ù…ÛŒÙˆÙ‡ØŒ Ø¸Ø±ÙˆÙ ÛŒÚ©Ø¨Ø§Ø±Ù…ØµØ±ÙØŒ Ú©Ø±Ø§ÛŒÙ‡ Ù¾ÛŒÚ©ØŒ Ù…ØªÙØ±Ù‚Ù‡
  amountToman: number;
  isPaidFromCashDrawer: boolean; // Ø¢ÛŒØ§ Ø§Ø² Ú©Ø´ÙˆÛŒ Ù†Ù‚Ø¯ Ù¾Ø±Ø¯Ø§Ø®Øª Ø´Ø¯ØŸ (Ø±ÙˆÛŒ Ù…Ø­Ø§Ø³Ø¨Ù‡ Ù…ÙˆØ¬ÙˆØ¯ÛŒ Ù¾Ø§ÛŒØ§Ù†ÛŒ Ø§Ø«Ø± Ø¯Ø§Ø±Ø¯)
  description: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string; // e.g. SHIFT_OPENED, SHIFT_CLOSED, ORDER_CREATED, ORDER_PAID, ORDER_CANCELLED, EXPENSE_RECORDED, MENU_ITEM_UPDATED
  entityName: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface ShiftReportSummary {
  shiftId: string;
  openedAt: string;
  closedAt?: string;
  status: ShiftStatus;
  openedBy: string;
  closedBy?: string;
  
  // Ø¢Ù…Ø§Ø± Ø³ÙØ§Ø±Ø´Ø§Øª
  orderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  // Ø§Ø±Ø²Ø´ Ø®Ø§Ù„Øµ Ø³ÙØ§Ø±Ø´Ø§Øª Ø§Ø¨Ø·Ø§Ù„â€ŒØ´Ø¯Ù‡ Ø¯Ø± Ù¾Ù†Ø¬Ø±Ù‡ Ø´ÛŒÙØª
  cancelledAmountToman: number;

  // Ú¯Ø²Ø§Ø±Ø´ Ù…Ø§Ù„ÛŒ ÙØ±ÙˆØ´
  grossSalesToman: number;
  discountsToman: number;
  netRevenueToman: number;

  // ØªÙÚ©ÛŒÚ© Ø¯Ø±ÛŒØ§ÙØªâ€ŒÙ‡Ø§
  cashReceivedToman: number;
  cardReceivedToman: number;
  otherReceivedToman: number;
  totalCollectedToman: number;

  // Ø¨Ø§Ø²Ú¯Ø´Øª ÙˆØ¬Ù‡ Ù†Ù‚Ø¯ (Ù¾Ø±Ø¯Ø§Ø®Øªâ€ŒÙ‡Ø§ÛŒ Ù†Ù‚Ø¯ÛŒ Ø§Ø¨Ø·Ø§Ù„â€ŒØ´Ø¯Ù‡ Ø¯Ø± Ù¾Ù†Ø¬Ø±Ù‡ Ø´ÛŒÙØª)
  cashRefundsToman: number;

  // Ù‡Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§
  cashDrawerExpensesToman: number;
  otherExpensesToman: number;
  totalExpensesToman: number;

  // Ú©Ø´ÙˆÛŒ Ù†Ù‚Ø¯ ÙÛŒØ²ÛŒÚ©ÛŒ
  openingCashToman: number;
  expectedCashToman: number;
  actualCashToman?: number;
  discrepancyToman?: number;
  discrepancyReason?: string;
}
