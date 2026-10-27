/**
 * Storage and State Management Service for SmartOrders
 * Implements Multi-Tenant Data Isolation, Local Persistence, and Initial Realistic Seed Data.
 */

import {
  Tenant,
  User,
  Category,
  MenuItem,
  Shift,
  Order,
  Payment,
  Expense,
  AuditLog,
} from '../types/domain';

const STORAGE_KEYS = {
  TENANT: 'smartorders_tenant_v1',
  USERS: 'smartorders_users_v1',
  ACTIVE_USER_ID: 'smartorders_active_user_id_v1',
  CATEGORIES: 'smartorders_categories_v1',
  MENU_ITEMS: 'smartorders_menu_items_v1',
  SHIFTS: 'smartorders_shifts_v1',
  ACTIVE_SHIFT_ID: 'smartorders_active_shift_id_v1',
  ORDERS: 'smartorders_orders_v1',
  PAYMENTS: 'smartorders_payments_v1',
  EXPENSES: 'smartorders_expenses_v1',
  AUDIT_LOGS: 'smartorders_audit_logs_v1',
};

// Pilot Tenant: قهوه‌فروشی ۱۰۰هیچ (100 Hich Specialty Coffee Lab)
const DEFAULT_TENANT: Tenant = {
  id: 'tenant-100hich-01',
  name: 'قهوه‌فروشی ۱۰۰هیچ (100 Hich Specialty Coffee Lab)',
  currency: 'TOMAN',
  phone: '021-88997766',
  address: 'تهران، خیابان کریمخان زند، خیابان سنایی، پلاک ۱۲',
};

const DEFAULT_USERS: User[] = [
  {
    id: 'user-01',
    tenantId: 'tenant-naranj-01',
    fullName: 'مهدان مددی (مدیر و مالک)',
    phoneNumber: '09120000001',
    role: 'OWNER',
    isActive: true,
  },
  {
    id: 'user-02',
    tenantId: 'tenant-naranj-01',
    fullName: 'سارا رضایی (سرپرست شیفت)',
    phoneNumber: '09120000002',
    role: 'MANAGER',
    isActive: true,
  },
  {
    id: 'user-03',
    tenantId: 'tenant-naranj-01',
    fullName: 'علی مرادی (صندوق‌دار)',
    phoneNumber: '09120000003',
    role: 'CASHIER',
    isActive: true,
  },
  {
    id: 'user-04',
    tenantId: 'tenant-naranj-01',
    fullName: 'نیما کمالی (باریستا)',
    phoneNumber: '09120000004',
    role: 'BARISTA',
    isActive: true,
  },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-espresso', tenantId: 'tenant-naranj-01', nameFa: 'اسپرسو بار', nameEn: 'Espresso Bar', sortOrder: 1, isActive: true },
  { id: 'cat-brew', tenantId: 'tenant-naranj-01', nameFa: 'قهوه دمی (Pour Over)', nameEn: 'Manual Brew', sortOrder: 2, isActive: true },
  { id: 'cat-cold', tenantId: 'tenant-naranj-01', nameFa: 'نوشیدنی‌های سرد', nameEn: 'Cold Drinks', sortOrder: 3, isActive: true },
  { id: 'cat-pastry', tenantId: 'tenant-naranj-01', nameFa: 'کیک و دسر', nameEn: 'Pastry & Dessert', sortOrder: 4, isActive: true },
  { id: 'cat-breakfast', tenantId: 'tenant-naranj-01', nameFa: 'صبحانه و میان‌وعده', nameEn: 'Breakfast & Snacks', sortOrder: 5, isActive: true },
];

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // اسپرسو بار
  { id: 'item-1', tenantId: 'tenant-naranj-01', categoryId: 'cat-espresso', nameFa: 'اسپرسو دوبل (Double Espresso)', priceToman: 65000, isAvailable: true, currentStock: 45, lowStockThreshold: 10 },
  { id: 'item-2', tenantId: 'tenant-naranj-01', categoryId: 'cat-espresso', nameFa: 'آمریکانو (Americano)', priceToman: 75000, isAvailable: true, currentStock: 30, lowStockThreshold: 10 },
  { id: 'item-3', tenantId: 'tenant-naranj-01', categoryId: 'cat-espresso', nameFa: 'کافه لاته (Caffè Latte)', priceToman: 95000, isAvailable: true, currentStock: 25, lowStockThreshold: 8 },
  { id: 'item-4', tenantId: 'tenant-naranj-01', categoryId: 'cat-espresso', nameFa: 'کاپوچینو (Cappuccino)', priceToman: 95000, isAvailable: true, currentStock: 22, lowStockThreshold: 8 },
  { id: 'item-5', tenantId: 'tenant-naranj-01', categoryId: 'cat-espresso', nameFa: 'فلت وایت (Flat White)', priceToman: 98000, isAvailable: true, currentStock: 18, lowStockThreshold: 5 },
  { id: 'item-6', tenantId: 'tenant-naranj-01', categoryId: 'cat-espresso', nameFa: 'کارامل ماکیاتو (Caramel Macchiato)', priceToman: 110000, isAvailable: true, currentStock: 15, lowStockThreshold: 5 },

  // قهوه دمی
  { id: 'item-7', tenantId: 'tenant-naranj-01', categoryId: 'cat-brew', nameFa: 'قهوه دمی V60 اتیوپی', priceToman: 135000, isAvailable: true, currentStock: 4, lowStockThreshold: 6 },
  { id: 'item-8', tenantId: 'tenant-naranj-01', categoryId: 'cat-brew', nameFa: 'کمکس کلمبیا (Chemex)', priceToman: 140000, isAvailable: true, currentStock: 12, lowStockThreshold: 5 },
  { id: 'item-9', tenantId: 'tenant-naranj-01', categoryId: 'cat-brew', nameFa: 'کلد برو (Cold Brew 16hr)', priceToman: 115000, isAvailable: true, currentStock: 10, lowStockThreshold: 5 },

  // نوشیدنی سرد
  { id: 'item-10', tenantId: 'tenant-naranj-01', categoryId: 'cat-cold', nameFa: 'آیس آمریکانو (Iced Americano)', priceToman: 85000, isAvailable: true, currentStock: 28, lowStockThreshold: 10 },
  { id: 'item-11', tenantId: 'tenant-naranj-01', categoryId: 'cat-cold', nameFa: 'آیس لاته وانیل (Iced Vanilla Latte)', priceToman: 115000, isAvailable: true, currentStock: 20, lowStockThreshold: 8 },
  { id: 'item-12', tenantId: 'tenant-naranj-01', categoryId: 'cat-cold', nameFa: 'موهیتو دست‌ساز تازه', priceToman: 98000, isAvailable: true, currentStock: 16, lowStockThreshold: 5 },
  { id: 'item-13', tenantId: 'tenant-naranj-01', categoryId: 'cat-cold', nameFa: 'لیموناد زعفرانی سنتی', priceToman: 92000, isAvailable: true, currentStock: 3, lowStockThreshold: 5 },

  // کیک و دسر
  { id: 'item-14', tenantId: 'tenant-naranj-01', categoryId: 'cat-pastry', nameFa: 'چیزکیک سن سباستین با شکلات داغ', priceToman: 145000, isAvailable: true, currentStock: 8, lowStockThreshold: 5 },
  { id: 'item-15', tenantId: 'tenant-naranj-01', categoryId: 'cat-pastry', nameFa: 'تارت توت‌فرنگی تازه', priceToman: 130000, isAvailable: true, currentStock: 2, lowStockThreshold: 5 },
  { id: 'item-16', tenantId: 'tenant-naranj-01', categoryId: 'cat-pastry', nameFa: 'کروسان کره‌ای شکلاتی', priceToman: 95000, isAvailable: true, currentStock: 0, lowStockThreshold: 5 },
  { id: 'item-17', tenantId: 'tenant-naranj-01', categoryId: 'cat-pastry', nameFa: 'کیک هویج و گردو با کرم‌چیز', priceToman: 110000, isAvailable: true, currentStock: 7, lowStockThreshold: 5 },

  // صبحانه و میان‌وعده
  { id: 'item-18', tenantId: 'tenant-naranj-01', categoryId: 'cat-breakfast', nameFa: 'ساندویچ پنینی مرغ و پستو', priceToman: 185000, isAvailable: true, currentStock: 14, lowStockThreshold: 5 },
  { id: 'item-19', tenantId: 'tenant-naranj-01', categoryId: 'cat-breakfast', nameFa: 'تست آووکادو و تخم‌مرغ پوچد', priceToman: 195000, isAvailable: true, currentStock: 9, lowStockThreshold: 5 },
  { id: 'item-20', tenantId: 'tenant-naranj-01', categoryId: 'cat-breakfast', nameFa: 'وافل عسل و خامه با موز', priceToman: 140000, isAvailable: true, currentStock: 11, lowStockThreshold: 5 },
];

// Helper to access LocalStorage safely
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading key ${key}:`, err);
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key}:`, err);
  }
}

export class SmartOrdersStore {
  // Tenant
  static getTenant(): Tenant {
    return load(STORAGE_KEYS.TENANT, DEFAULT_TENANT);
  }

  static updateTenant(updated: Partial<Tenant>): Tenant {
    const current = this.getTenant();
    const merged = { ...current, ...updated };
    save(STORAGE_KEYS.TENANT, merged);
    return merged;
  }

  // Users
  static getUsers(): User[] {
    return load(STORAGE_KEYS.USERS, DEFAULT_USERS);
  }

  static getActiveUser(): User {
    const users = this.getUsers();
    const activeId = load(STORAGE_KEYS.ACTIVE_USER_ID, users[0].id);
    return users.find((u) => u.id === activeId) || users[0];
  }

  static setActiveUserId(userId: string): void {
    save(STORAGE_KEYS.ACTIVE_USER_ID, userId);
  }

  // Categories
  static getCategories(): Category[] {
    return load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  }

  static saveCategories(cats: Category[]): void {
    save(STORAGE_KEYS.CATEGORIES, cats);
  }

  // Menu Items
  static getMenuItems(): MenuItem[] {
    const rawItems = load<MenuItem[]>(STORAGE_KEYS.MENU_ITEMS, DEFAULT_MENU_ITEMS);
    let modified = false;
    const items = rawItems.map((item) => {
      const defaultMatch = DEFAULT_MENU_ITEMS.find((d) => d.id === item.id);
      let updated = false;
      let stock = item.currentStock;
      let threshold = item.lowStockThreshold;

      if (stock === undefined || stock === null) {
        stock = defaultMatch?.currentStock !== undefined ? defaultMatch.currentStock : 15;
        updated = true;
      }
      if (threshold === undefined || threshold === null) {
        threshold = defaultMatch?.lowStockThreshold !== undefined ? defaultMatch.lowStockThreshold : 5;
        updated = true;
      }

      if (updated) {
        modified = true;
        return { ...item, currentStock: stock, lowStockThreshold: threshold };
      }
      return item;
    });

    if (modified) {
      save(STORAGE_KEYS.MENU_ITEMS, items);
    }
    return items;
  }

  static saveMenuItems(items: MenuItem[]): void {
    save(STORAGE_KEYS.MENU_ITEMS, items);
  }

  static updateMenuItem(item: MenuItem): void {
    const items = this.getMenuItems();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    this.saveMenuItems(items);
    this.addAuditLog(
      'MENU_ITEM_UPDATED',
      'MenuItem',
      item.id,
      `ویرایش آیتم منو: ${item.nameFa} با قیمت ${item.priceToman} تومان و موجودی ${item.currentStock ?? 0} عدد`
    );
  }

  static adjustItemStock(itemId: string, delta: number): MenuItem | null {
    const items = this.getMenuItems();
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx < 0) return null;
    const item = items[idx];
    const prevStock = item.currentStock ?? 0;
    const nextStock = Math.max(0, prevStock + delta);
    item.currentStock = nextStock;
    items[idx] = item;
    this.saveMenuItems(items);

    const user = this.getActiveUser();
    this.addAuditLog(
      'STOCK_ADJUSTED',
      'MenuItem',
      item.id,
      `تنظیم موجودی ${item.nameFa}: از ${prevStock} به ${nextStock} عدد (${delta >= 0 ? `+${delta}` : delta}) توسط ${user.fullName}`
    );

    return item;
  }

  static setItemStock(itemId: string, newStock: number, threshold?: number): MenuItem | null {
    const items = this.getMenuItems();
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx < 0) return null;
    const item = items[idx];
    item.currentStock = Math.max(0, Math.round(newStock));
    if (threshold !== undefined) {
      item.lowStockThreshold = Math.max(0, Math.round(threshold));
    }
    items[idx] = item;
    this.saveMenuItems(items);

    const user = this.getActiveUser();
    this.addAuditLog(
      'STOCK_UPDATED',
      'MenuItem',
      item.id,
      `بروزرسانی دستی موجودی ${item.nameFa}: موجودی فعلی ${item.currentStock} عدد توسط ${user.fullName}`
    );

    return item;
  }

  // Shifts
  static getShifts(): Shift[] {
    return load<Shift[]>(STORAGE_KEYS.SHIFTS, []);
  }

  static getActiveShift(): Shift | null {
    const shifts = this.getShifts();
    return shifts.find((s) => s.status === 'OPEN') || null;
  }

  static openShift(openingCashToman: number, notes?: string): Shift {
    const active = this.getActiveShift();
    if (active) {
      throw new Error('یک شیفت کاری هم‌اکنون باز است. ابتدا شیفت فعلی را ببندید.');
    }

    const tenant = this.getTenant();
    const user = this.getActiveUser();
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      tenantId: tenant.id,
      openedByUserId: user.id,
      openedByUserName: user.fullName,
      openedAt: new Date().toISOString(),
      openingCashToman: Math.round(openingCashToman),
      expectedClosingCashToman: Math.round(openingCashToman),
      status: 'OPEN',
      notes,
    };

    const shifts = [newShift, ...this.getShifts()];
    save(STORAGE_KEYS.SHIFTS, shifts);
    save(STORAGE_KEYS.ACTIVE_SHIFT_ID, newShift.id);

    this.addAuditLog(
      'SHIFT_OPENED',
      'Shift',
      newShift.id,
      `بازگشایی شیفت توسط ${user.fullName} با موجودی اولیه ${openingCashToman.toLocaleString('fa-IR')} تومان`
    );

    return newShift;
  }

  static closeShift(
    shiftId: string,
    actualCountedCashToman: number,
    expectedCashToman: number,
    discrepancyReason?: string,
    notes?: string
  ): Shift {
    const shifts = this.getShifts();
    const idx = shifts.findIndex((s) => s.id === shiftId);
    if (idx < 0) {
      throw new Error('شیفت مورد نظر یافت نشد.');
    }

    const user = this.getActiveUser();
    const shift = shifts[idx];
    const discrepancy = actualCountedCashToman - expectedCashToman;

    shift.status = 'CLOSED';
    shift.closedAt = new Date().toISOString();
    shift.closedByUserId = user.id;
    shift.closedByUserName = user.fullName;
    shift.expectedClosingCashToman = expectedCashToman;
    shift.actualCountedCashToman = actualCountedCashToman;
    shift.cashDiscrepancyToman = discrepancy;
    shift.discrepancyReason = discrepancyReason;
    if (notes) shift.notes = (shift.notes ? shift.notes + ' | ' : '') + notes;

    shifts[idx] = shift;
    save(STORAGE_KEYS.SHIFTS, shifts);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT_ID);

    this.addAuditLog(
      'SHIFT_CLOSED',
      'Shift',
      shift.id,
      `بستن شیفت توسط ${user.fullName}. نقد شمرده شده: ${actualCountedCashToman.toLocaleString('fa-IR')} تومان. مغایرت: ${discrepancy.toLocaleString('fa-IR')} تومان`
    );

    return shift;
  }

  // Orders
  static getOrders(): Order[] {
    return load<Order[]>(STORAGE_KEYS.ORDERS, []);
  }

  static saveOrders(orders: Order[]): void {
    save(STORAGE_KEYS.ORDERS, orders);
  }

  static createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'>): Order {
    const orders = this.getOrders();
    const nextOrderNumber = orders.length + 1;
    const now = new Date().toISOString();

    const newOrder: Order = {
      ...order,
      id: `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderNumber: nextOrderNumber,
      createdAt: now,
      updatedAt: now,
    };

    orders.unshift(newOrder);
    this.saveOrders(orders);

    // Deduct stock for ordered items
    const menuItems = this.getMenuItems();
    let stockChanged = false;
    for (const orderItem of newOrder.items || []) {
      const mIdx = menuItems.findIndex((m) => m.id === orderItem.menuItemId);
      if (mIdx >= 0 && menuItems[mIdx].currentStock !== undefined) {
        menuItems[mIdx].currentStock = Math.max(0, (menuItems[mIdx].currentStock || 0) - orderItem.quantity);
        stockChanged = true;
      }
    }
    if (stockChanged) {
      this.saveMenuItems(menuItems);
    }

    this.addAuditLog(
      'ORDER_CREATED',
      'Order',
      newOrder.id,
      `ثبت سفارش شماره #${newOrder.orderNumber} به مبلغ ${newOrder.netTotalToman.toLocaleString('fa-IR')} تومان`
    );

    return newOrder;
  }

  static updateOrderStatus(orderId: string, status: Order['status'], cancellationReason?: string): Order {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx < 0) throw new Error('سفارش یافت نشد.');

    const user = this.getActiveUser();
    const order = orders[idx];
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (cancellationReason) {
      order.cancellationReason = cancellationReason;
    }

    orders[idx] = order;
    this.saveOrders(orders);

    this.addAuditLog(
      status === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
      'Order',
      order.id,
      `تغییر وضعیت سفارش #${order.orderNumber} به ${status} توسط ${user.fullName}${cancellationReason ? ` (علت: ${cancellationReason})` : ''}`
    );

    return order;
  }

  static cancelOrder(orderId: string, cancellationReason: string): Order {
    const user = this.getActiveUser();
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      throw new Error('فقط مدیر یا مالک کافه مجاز به ابطال سفارش ثبت‌شده است.');
    }
    if (!cancellationReason || !cancellationReason.trim()) {
      throw new Error('درج علت ابطال فاکتور الزامی است.');
    }

    const order = this.updateOrderStatus(orderId, 'CANCELLED', cancellationReason.trim());

    // Void associated successful payments
    const payments = this.getPayments();
    const updatedPayments = payments.map((p) => {
      if (p.orderId === orderId && p.status === 'SUCCESSFUL') {
        return { ...p, status: 'VOIDED' as const };
      }
      return p;
    });
    save(STORAGE_KEYS.PAYMENTS, updatedPayments);

    // Restore stock for cancelled order items
    const menuItems = this.getMenuItems();
    let stockRestored = false;
    for (const orderItem of order.items || []) {
      const mIdx = menuItems.findIndex((m) => m.id === orderItem.menuItemId);
      if (mIdx >= 0 && menuItems[mIdx].currentStock !== undefined) {
        menuItems[mIdx].currentStock = (menuItems[mIdx].currentStock || 0) + orderItem.quantity;
        stockRestored = true;
      }
    }
    if (stockRestored) {
      this.saveMenuItems(menuItems);
    }

    this.addAuditLog(
      'ORDER_CANCELLED',
      'Order',
      order.id,
      `ابطال سفارش #${order.orderNumber} به مبلغ ${order.netTotalToman.toLocaleString('fa-IR')} تومان توسط ${user.fullName}. دلیل: ${cancellationReason.trim()}`
    );

    return order;
  }

  // Payments
  static getPayments(): Payment[] {
    return load<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  }

  static recordPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Payment {
    const payments = this.getPayments();

    // Prevent duplicate payment for identical order
    const existing = payments.find(
      (p) => p.orderId === payment.orderId && p.status === 'SUCCESSFUL' && p.amountToman === payment.amountToman
    );
    if (existing) {
      throw new Error('پرداخت موفق قبلاً برای این سفارش ثبت شده است.');
    }

    const newPayment: Payment = {
      ...payment,
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };

    payments.unshift(newPayment);
    save(STORAGE_KEYS.PAYMENTS, payments);

    // Also mark order as COMPLETED
    this.updateOrderStatus(payment.orderId, 'COMPLETED');

    this.addAuditLog(
      'ORDER_PAID',
      'Payment',
      newPayment.id,
      `ثبت پرداخت مبلغ ${newPayment.amountToman.toLocaleString('fa-IR')} تومان به روش ${newPayment.paymentMethod === 'CASH' ? 'نقد' : 'کارتخوان'} برای سفارش ${newPayment.orderId}`
    );

    return newPayment;
  }

  // Expenses
  static getExpenses(): Expense[] {
    return load<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  }

  static recordExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const expenses = this.getExpenses();
    const user = this.getActiveUser();

    const newExpense: Expense = {
      ...expense,
      id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };

    expenses.unshift(newExpense);
    save(STORAGE_KEYS.EXPENSES, expenses);

    this.addAuditLog(
      'EXPENSE_RECORDED',
      'Expense',
      newExpense.id,
      `ثبت هزینه: ${newExpense.category} - مبلغ: ${newExpense.amountToman.toLocaleString('fa-IR')} تومان (${newExpense.isPaidFromCashDrawer ? 'کسر از صندوق نقد' : 'پرداخت خارج از صندوق'}) توسط ${user.fullName}`
    );

    return newExpense;
  }

  // Audit Logs
  static getAuditLogs(): AuditLog[] {
    return load<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  }

  static addAuditLog(action: string, entityName: string, entityId: string, details: string): void {
    const logs = this.getAuditLogs();
    const user = this.getActiveUser();
    const tenant = this.getTenant();

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: tenant.id,
      userId: user.id,
      userName: user.fullName,
      action,
      entityName,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    };

    logs.unshift(newLog);
    // Keep last 300 logs
    save(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 300));
  }

  // Seed sample initial shift and history if fresh install
  static initSeedData(): void {
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      this.saveCategories(DEFAULT_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MENU_ITEMS)) {
      this.saveMenuItems(DEFAULT_MENU_ITEMS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      save(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TENANT)) {
      save(STORAGE_KEYS.TENANT, DEFAULT_TENANT);
    }

    // If no shift exists, create a sample open shift with 500,000 Toman opening cash
    const shifts = this.getShifts();
    if (shifts.length === 0) {
      const initialShift = this.openShift(500000, 'شیفت صبح آزمایشی کافه نارنج');

      // Create two sample completed orders
      const user = this.getActiveUser();
      const menu = this.getMenuItems();

      const order1 = this.createOrder({
        tenantId: initialShift.tenantId,
        shiftId: initialShift.id,
        createdByUserId: user.id,
        createdByUserName: user.fullName,
        orderType: 'DINE_IN',
        tableLabel: 'میز ۴',
        customerName: 'آقای شایان',
        status: 'COMPLETED',
        items: [
          {
            id: 'item-snap-1',
            menuItemId: menu[2].id, // کافه لاته
            itemNameSnapshot: menu[2].nameFa,
            unitPriceSnapshotToman: menu[2].priceToman,
            quantity: 2,
            subtotalToman: menu[2].priceToman * 2,
          },
          {
            id: 'item-snap-2',
            menuItemId: menu[13].id, // چیزکیک سن سباستین
            itemNameSnapshot: menu[13].nameFa,
            unitPriceSnapshotToman: menu[13].priceToman,
            quantity: 1,
            subtotalToman: menu[13].priceToman,
          },
        ],
        grossAmountToman: menu[2].priceToman * 2 + menu[13].priceToman,
        discountAmountToman: 15000,
        netTotalToman: menu[2].priceToman * 2 + menu[13].priceToman - 15000,
      });

      this.recordPayment({
        tenantId: initialShift.tenantId,
        orderId: order1.id,
        shiftId: initialShift.id,
        receivedByUserId: user.id,
        amountToman: order1.netTotalToman,
        paymentMethod: 'CARD_MANUAL',
        referenceCode: '78291034',
        terminalName: 'کارتخوان به‌پرداخت ۱',
        status: 'SUCCESSFUL',
      });

      // Sample cash order
      const order2 = this.createOrder({
        tenantId: initialShift.tenantId,
        shiftId: initialShift.id,
        createdByUserId: user.id,
        createdByUserName: user.fullName,
        orderType: 'TAKEAWAY',
        customerName: 'مریم ک.',
        status: 'COMPLETED',
        items: [
          {
            id: 'item-snap-3',
            menuItemId: menu[1].id, // آمریکانو
            itemNameSnapshot: menu[1].nameFa,
            unitPriceSnapshotToman: menu[1].priceToman,
            quantity: 1,
            subtotalToman: menu[1].priceToman,
          },
          {
            id: 'item-snap-4',
            menuItemId: menu[15].id, // کروسان کره‌ای
            itemNameSnapshot: menu[15].nameFa,
            unitPriceSnapshotToman: menu[15].priceToman,
            quantity: 1,
            subtotalToman: menu[15].priceToman,
          },
        ],
        grossAmountToman: menu[1].priceToman + menu[15].priceToman,
        discountAmountToman: 0,
        netTotalToman: menu[1].priceToman + menu[15].priceToman,
      });

      this.recordPayment({
        tenantId: initialShift.tenantId,
        orderId: order2.id,
        shiftId: initialShift.id,
        receivedByUserId: user.id,
        amountToman: order2.netTotalToman,
        paymentMethod: 'CASH',
        status: 'SUCCESSFUL',
      });

      // Sample expense from cash drawer (خرید بطری شیر تازه)
      this.recordExpense({
        tenantId: initialShift.tenantId,
        shiftId: initialShift.id,
        recordedByUserId: user.id,
        recordedByUserName: user.fullName,
        category: 'خرید روزمره (شیر و لبنیات)',
        amountToman: 60000,
        isPaidFromCashDrawer: true,
        description: 'خرید اضطراری ۲ بطری شیر پرچرب کاله از سوپرمارکت مجاور',
      });

      // Seed realistic completed orders across the last 30 days for rich trend reporting
      const pastDays = [1, 2, 4, 6, 8, 11, 14, 17, 20, 23, 26, 28];
      const nowTs = Date.now();
      const currentOrders = this.getOrders();
      const sampleCustomerNames = [
        'امیرحسین رضایی',
        'سارا کاظمی',
        'نیما حسینی',
        'الناز تقوی',
        'دکتر بهرامی',
        'مهسا کریمی',
        'پرهام علیزاده',
        'کیانوش راد',
      ];

      pastDays.forEach((daysAgo, idx) => {
        const orderDate = new Date(nowTs - daysAgo * 24 * 60 * 60 * 1000 + (idx % 8) * 3600 * 1000);
        const itemA = menu[(idx * 2) % menu.length];
        const itemB = menu[(idx * 3 + 1) % menu.length];
        const qtyA = (idx % 2) + 1;
        const qtyB = 1;
        const gross = itemA.priceToman * qtyA + itemB.priceToman * qtyB;
        const discount = idx % 3 === 0 ? 10000 : 0;
        const net = gross - discount;

        const histOrder: Order = {
          id: `order-seed-hist-${idx}`,
          tenantId: initialShift.tenantId,
          shiftId: initialShift.id,
          orderNumber: currentOrders.length + idx + 1,
          createdByUserId: user.id,
          createdByUserName: user.fullName,
          orderType: idx % 2 === 0 ? 'DINE_IN' : 'TAKEAWAY',
          tableLabel: idx % 2 === 0 ? `میز ${(idx % 5) + 1}` : undefined,
          customerName: sampleCustomerNames[idx % sampleCustomerNames.length],
          status: 'COMPLETED',
          items: [
            {
              id: `snap-h-${idx}-1`,
              menuItemId: itemA.id,
              itemNameSnapshot: itemA.nameFa,
              unitPriceSnapshotToman: itemA.priceToman,
              quantity: qtyA,
              subtotalToman: itemA.priceToman * qtyA,
            },
            {
              id: `snap-h-${idx}-2`,
              menuItemId: itemB.id,
              itemNameSnapshot: itemB.nameFa,
              unitPriceSnapshotToman: itemB.priceToman,
              quantity: qtyB,
              subtotalToman: itemB.priceToman * qtyB,
            },
          ],
          grossAmountToman: gross,
          discountAmountToman: discount,
          netTotalToman: net,
          createdAt: orderDate.toISOString(),
          updatedAt: orderDate.toISOString(),
        };

        currentOrders.push(histOrder);
      });
      this.saveOrders(currentOrders);
    }
  }

  // Backup & Restore System (Priority 9)
  static exportBackupData(): string {
    const backupPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tenant: this.getTenant(),
      users: this.getUsers(),
      categories: this.getCategories(),
      menuItems: this.getMenuItems(),
      shifts: this.getShifts(),
      orders: this.getOrders(),
      payments: this.getPayments(),
      expenses: this.getExpenses(),
      auditLogs: this.getAuditLogs(),
    };

    const user = this.getActiveUser();
    this.addAuditLog(
      'BACKUP_EXPORTED',
      'System',
      backupPayload.tenant.id,
      `خروجی پشتیبان دیتای کافه توسط ${user.fullName} در تاریخ ${new Date().toLocaleDateString('fa-IR')} دریافت شد.`
    );

    return JSON.stringify(backupPayload, null, 2);
  }

  static importBackupData(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !parsed.tenant || !Array.isArray(parsed.orders) || !Array.isArray(parsed.shifts)) {
        throw new Error('ساختار فایل پشتیبان معتبر نیست.');
      }

      save(STORAGE_KEYS.TENANT, parsed.tenant);
      if (Array.isArray(parsed.users)) save(STORAGE_KEYS.USERS, parsed.users);
      if (Array.isArray(parsed.categories)) save(STORAGE_KEYS.CATEGORIES, parsed.categories);
      if (Array.isArray(parsed.menuItems)) save(STORAGE_KEYS.MENU_ITEMS, parsed.menuItems);
      if (Array.isArray(parsed.shifts)) save(STORAGE_KEYS.SHIFTS, parsed.shifts);
      if (Array.isArray(parsed.orders)) save(STORAGE_KEYS.ORDERS, parsed.orders);
      if (Array.isArray(parsed.payments)) save(STORAGE_KEYS.PAYMENTS, parsed.payments);
      if (Array.isArray(parsed.expenses)) save(STORAGE_KEYS.EXPENSES, parsed.expenses);
      if (Array.isArray(parsed.auditLogs)) save(STORAGE_KEYS.AUDIT_LOGS, parsed.auditLogs);

      const user = this.getActiveUser();
      this.addAuditLog(
        'BACKUP_RESTORED',
        'System',
        parsed.tenant.id,
        `بازیابی اطلاعات از فایل پشتیبان توسط ${user.fullName} با موفقیت انجام شد.`
      );

      return { success: true, message: 'اطلاعات با موفقیت بازیابی شد.' };
    } catch (err: any) {
      return { success: false, message: `خطا در بازگردانی پشتیبان: ${err.message}` };
    }
  }

  static resetDatabaseToSeed(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    this.initSeedData();
  }
}
