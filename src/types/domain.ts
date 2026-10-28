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

export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  nameFa: string;
  nameEn?: string;
  priceToman: number; // Stored as integer Toman
  isAvailable: boolean;
  description?: string;
  currentStock?: number; // موجودی فعلی انبار/کافه به عدد
  lowStockThreshold?: number; // آستانه هشدار کسری موجودی اختصاصی آیتم
  roast?: 'all' | 'medium' | 'dark' | 'light';
  roastLevelText?: string;
  weight?: string;
  origin?: string;
  process?: string;
  elevation?: string;
  notes?: string[];
  badge?: string | null;
  isBean?: boolean;
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
  openingCashToman: number; // موجودی اولیه صندوق نقد
  expectedClosingCashToman: number; // موجودی نقد محاسبه‌شده توسط سیستم
  actualCountedCashToman?: number; // نقد شمرده‌شده فیزیکی در پایان شیفت
  cashDiscrepancyToman?: number; // actual - expected (منفی یعنی کسری، مثبت یعنی مازاد)
  discrepancyReason?: string;
  status: ShiftStatus;
  notes?: string;
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
  modifiers?: Array<{ id: string; nameFa: string; priceDeltaToman: number }>;
}

export interface Order {
  id: string;
  tenantId: string;
  shiftId: string;
  createdByUserId: string;
  createdByUserName: string;
  orderNumber: number;
  orderType: OrderType;
  tableLabel?: string;
  customerName?: string;
  status: OrderStatus;
  items: OrderItem[];
  grossAmountToman: number; // مجموع قیمت آیتم‌ها قبل از تخفیف
  discountAmountToman: number; // تخفیف
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
  referenceCode?: string; // شماره پیگیری کارتخوان
  terminalName?: string; // نام دستگاه کارتخوان مثلاً "به‌پرداخت ملت"
  status: PaymentStatus;
  createdAt: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  shiftId: string;
  recordedByUserId: string;
  recordedByUserName: string;
  category: string; // مثلاً: شیر و لبنیات، میوه، ظروف یکبارمصرف، کرایه پیک، متفرقه
  amountToman: number;
  isPaidFromCashDrawer: boolean; // آیا از کشوی نقد پرداخت شد؟ (روی محاسبه موجودی پایانی اثر دارد)
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
  
  // آمار سفارشات
  orderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;

  // گزارش مالی فروش
  grossSalesToman: number;
  discountsToman: number;
  netRevenueToman: number;

  // تفکیک دریافت‌ها
  cashReceivedToman: number;
  cardReceivedToman: number;
  otherReceivedToman: number;
  totalCollectedToman: number;

  // هزینه‌ها
  cashDrawerExpensesToman: number;
  otherExpensesToman: number;
  totalExpensesToman: number;

  // کشوی نقد فیزیکی
  openingCashToman: number;
  expectedCashToman: number;
  actualCashToman?: number;
  discrepancyToman?: number;
  discrepancyReason?: string;
}
