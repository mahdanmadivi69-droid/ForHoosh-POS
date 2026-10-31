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
  IS_LOGGED_IN: 'smartorders_is_logged_in_v1',
  CATEGORIES: 'smartorders_categories_v2',
  MENU_ITEMS: 'smartorders_menu_items_v2',
  SHIFTS: 'smartorders_shifts_v1',
  ACTIVE_SHIFT_ID: 'smartorders_active_shift_id_v1',
  ORDERS: 'smartorders_orders_v1',
  PAYMENTS: 'smartorders_payments_v1',
  EXPENSES: 'smartorders_expenses_v1',
  AUDIT_LOGS: 'smartorders_audit_logs_v1',
};

// Pilot Tenant: قهوه‌فروشی ۱۰۰هیچ (100 Hich Specialty Coffee Roasters)
const DEFAULT_TENANT: Tenant = {
  id: 'tenant-100hich-01',
  name: 'قهوه‌فروشی صَد هیچ (100 HICH Coffee Roasters)',
  currency: 'TOMAN',
  phone: '021-44668090',
  address: 'اکباتان، فاز ۱، بازارچه ۱۰، جنب پیتزا پیت باکس',
};

const DEFAULT_USERS: User[] = [
  {
    id: 'user-01',
    tenantId: 'tenant-100hich-01',
    fullName: 'مهدان مددی (مدیر و مالک)',
    phoneNumber: '09120000001',
    username: 'admin',
    password: '123',
    role: 'OWNER',
    isActive: true,
  },
  {
    id: 'user-02',
    tenantId: 'tenant-100hich-01',
    fullName: 'سارا رضایی (سرپرست شیفت)',
    phoneNumber: '09120000002',
    username: 'sara',
    password: '123',
    role: 'MANAGER',
    isActive: true,
  },
  {
    id: 'user-03',
    tenantId: 'tenant-100hich-01',
    fullName: 'علی مرادی (صندوق‌دار)',
    phoneNumber: '09120000003',
    username: 'ali',
    password: '123',
    role: 'CASHIER',
    isActive: true,
  },
  {
    id: 'user-04',
    tenantId: 'tenant-100hich-01',
    fullName: 'نیما کمالی (باریستا)',
    phoneNumber: '09120000004',
    username: 'nima',
    password: '123',
    role: 'BARISTA',
    isActive: true,
  },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-espresso', tenantId: 'tenant-100hich-01', nameFa: 'قهوه بر پایه اسپرسو (گرم)', nameEn: 'Hot Espresso Bar', sortOrder: 1, isActive: true },
  { id: 'cat-iced', tenantId: 'tenant-100hich-01', nameFa: 'قهوه بر پایه اسپرسو (آیس)', nameEn: 'Iced Espresso Bar', sortOrder: 2, isActive: true },
  { id: 'cat-flavored-latte', tenantId: 'tenant-100hich-01', nameFa: 'انواع لاته با سیروپ', nameEn: 'Flavored Lattes', sortOrder: 3, isActive: true },
  { id: 'cat-tea-infusion', tenantId: 'tenant-100hich-01', nameFa: 'چای و دمنوش‌ها', nameEn: 'Tea & Herbal Infusions', sortOrder: 4, isActive: true },
  { id: 'cat-hot-drinks', tenantId: 'tenant-100hich-01', nameFa: 'نوشیدنی گرم', nameEn: 'Hot Drinks', sortOrder: 5, isActive: true },
  { id: 'cat-cold-drinks', tenantId: 'tenant-100hich-01', nameFa: 'نوشیدنی سرد بر پایه سیروپ', nameEn: 'Cold Drinks & Mocktails', sortOrder: 6, isActive: true },
  { id: 'cat-brewed', tenantId: 'tenant-100hich-01', nameFa: 'قهوه‌های دمی', nameEn: 'Brewed Coffee (Single Origin)', sortOrder: 7, isActive: true },
  { id: 'cat-retail-beans', tenantId: 'tenant-100hich-01', nameFa: 'دان و پودر قهوه (کیلویی)', nameEn: 'Beans & Retail Powders', sortOrder: 8, isActive: true },
];

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // -------------------------------------------------------------
  // ۱. قهوه بر پایه اسپرسو (گرم)
  // -------------------------------------------------------------
  {
    id: 'item-esp-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'اسپرسو (۵۰/۵۰)',
    nameEn: 'Espresso (Blend 50/50)',
    priceToman: 175000,
    isAvailable: true,
    currentStock: 50,
    lowStockThreshold: 10,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-esp-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'اسپرسو (۱۰۰٪ عربیکا)',
    nameEn: 'Espresso (100% Arabica)',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 50,
    lowStockThreshold: 10,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ame-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'آمریکانو (۵۰/۵۰)',
    nameEn: 'Americano (Blend 50/50)',
    priceToman: 175000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 10,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ame-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'آمریکانو (۱۰۰٪ عربیکا)',
    nameEn: 'Americano (100% Arabica)',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 10,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-mac-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'اسپرسو ماکیاتو (۵۰/۵۰)',
    nameEn: 'Espresso Macchiato (50/50)',
    priceToman: 195000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-mac-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'اسپرسو ماکیاتو (۱۰۰٪ عربیکا)',
    nameEn: 'Espresso Macchiato (100% Arabica)',
    priceToman: 210000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-cor-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'کورتادو (۵۰/۵۰)',
    nameEn: 'Cortado (Blend 50/50)',
    priceToman: 210000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-cor-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'کورتادو (۱۰۰٪ عربیکا)',
    nameEn: 'Cortado (100% Arabica)',
    priceToman: 220000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-cap-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'کاپوچینو (۵۰/۵۰)',
    nameEn: 'Cappuccino (Blend 50/50)',
    priceToman: 220000,
    isAvailable: true,
    currentStock: 35,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-cap-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'کاپوچینو (۱۰۰٪ عربیکا)',
    nameEn: 'Cappuccino (100% Arabica)',
    priceToman: 230000,
    isAvailable: true,
    currentStock: 35,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-lat-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'لاته (۵۰/۵۰)',
    nameEn: 'Caffe Latte (Blend 50/50)',
    priceToman: 220000,
    isAvailable: true,
    currentStock: 45,
    lowStockThreshold: 10,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-lat-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'لاته (۱۰۰٪ عربیکا)',
    nameEn: 'Caffe Latte (100% Arabica)',
    priceToman: 230000,
    isAvailable: true,
    currentStock: 45,
    lowStockThreshold: 10,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-flw-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'فلت وایت (۵۰/۵۰)',
    nameEn: 'Flat White (Blend 50/50)',
    priceToman: 220000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-flw-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'فلت وایت (۱۰۰٪ عربیکا)',
    nameEn: 'Flat White (100% Arabica)',
    priceToman: 230000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-crm-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'کارامل ماکیاتو (۵۰/۵۰)',
    nameEn: 'Caramel Macchiato (50/50)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-crm-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'کارامل ماکیاتو (۱۰۰٪ عربیکا)',
    nameEn: 'Caramel Macchiato (100% Arabica)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-moc-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'موکا (۵۰/۵۰)',
    nameEn: 'Caffe Mocha (50/50)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-moc-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-espresso',
    nameFa: 'موکا (۱۰۰٪ عربیکا)',
    nameEn: 'Caffe Mocha (100% Arabica)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۲. قهوه بر پایه اسپرسو (آیس)
  // -------------------------------------------------------------
  {
    id: 'item-ice-ame-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس آمریکانو (۵۰/۵۰)',
    nameEn: 'Iced Americano (50/50)',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 10,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-ame-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس آمریکانو (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Americano (100% Arabica)',
    priceToman: 195000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 10,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-ton-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس تونیک (۵۰/۵۰)',
    nameEn: 'Espresso Tonic (50/50)',
    priceToman: 190000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-ton-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس تونیک (۱۰۰٪ عربیکا)',
    nameEn: 'Espresso Tonic (100% Arabica)',
    priceToman: 200000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-lat-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته (۵۰/۵۰)',
    nameEn: 'Iced Latte (50/50)',
    priceToman: 230000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 10,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-lat-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Latte (100% Arabica)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 10,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-moc-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس موکا (۵۰/۵۰)',
    nameEn: 'Iced Mocha (50/50)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-moc-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس موکا (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Mocha (100% Arabica)',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-crm-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس کارامل ماکیاتو (۵۰/۵۰)',
    nameEn: 'Iced Caramel Macchiato (50/50)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-crm-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس کارامل ماکیاتو (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Caramel Macchiato (100% Arabica)',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-haz-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته فندق (۵۰/۵۰)',
    nameEn: 'Iced Hazelnut Latte (50/50)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-haz-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته فندق (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Hazelnut Latte (100% Arabica)',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-str-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته توت فرنگی (۵۰/۵۰)',
    nameEn: 'Iced Strawberry Latte (50/50)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-str-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته توت فرنگی (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Strawberry Latte (100% Arabica)',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-ice-coc-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته نارگیل (۵۰/۵۰)',
    nameEn: 'Iced Coconut Latte (50/50)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-ice-coc-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-iced',
    nameFa: 'آیس لاته نارگیل (۱۰۰٪ عربیکا)',
    nameEn: 'Iced Coconut Latte (100% Arabica)',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۳. انواع لاته با سیروپ (گرم)
  // -------------------------------------------------------------
  {
    id: 'item-lat-haz-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته فندق (۵۰/۵۰)',
    nameEn: 'Hazelnut Latte (50/50)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-lat-haz-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته فندق (۱۰۰٪ عربیکا)',
    nameEn: 'Hazelnut Latte (100% Arabica)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-lat-crm-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته کارامل (۵۰/۵۰)',
    nameEn: 'Caramel Latte (50/50)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-lat-crm-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته کارامل (۱۰۰٪ عربیکا)',
    nameEn: 'Caramel Latte (100% Arabica)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-lat-str-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته توت فرنگی (۵۰/۵۰)',
    nameEn: 'Strawberry Latte (50/50)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-lat-str-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته توت فرنگی (۱۰۰٪ عربیکا)',
    nameEn: 'Strawberry Latte (100% Arabica)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },
  {
    id: 'item-lat-rum-50',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته آیریش / رام (۵۰/۵۰)',
    nameEn: 'Irish / Rum Latte (50/50)',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۵۰/۵۰',
    isBean: false,
  },
  {
    id: 'item-lat-rum-100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-flavored-latte',
    nameFa: 'لاته آیریش / رام (۱۰۰٪ عربیکا)',
    nameEn: 'Irish / Rum Latte (100% Arabica)',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 6,
    badge: '۱۰۰٪ عربیکا',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۴. چای و دمنوش‌ها
  // -------------------------------------------------------------
  {
    id: 'item-tea-lahijan',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-tea-infusion',
    nameFa: 'چای تخصصی لاهیجان',
    nameEn: 'Specialty Lahijan Black Tea',
    priceToman: 75000,
    isAvailable: true,
    currentStock: 100,
    lowStockThreshold: 15,
    badge: 'دمی اصیل',
    isBean: false,
  },
  {
    id: 'item-inf-green',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-tea-infusion',
    nameFa: 'دمنوش چای سبز',
    nameEn: 'Green Tea Infusion',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'طبیعی',
    isBean: false,
  },
  {
    id: 'item-inf-lemon',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-tea-infusion',
    nameFa: 'دمنوش به‌لیمو',
    nameEn: 'Lemon Verbena Infusion',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'معطر',
    isBean: false,
  },
  {
    id: 'item-inf-calm',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-tea-infusion',
    nameFa: 'دمنوش آرامش',
    nameEn: 'Relaxing Herbal Infusion',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'آرامش‌بخش',
    isBean: false,
  },
  {
    id: 'item-inf-cold',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-tea-infusion',
    nameFa: 'دمنوش سرماخوردگی',
    nameEn: 'Cold & Flu Relief Herbal Infusion',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'تقویت سیستم ایمنی',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۵. نوشیدنی گرم (سایر)
  // -------------------------------------------------------------
  {
    id: 'item-hot-choc',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-hot-drinks',
    nameFa: 'هات چاکلت',
    nameEn: 'Rich Hot Chocolate',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 35,
    lowStockThreshold: 8,
    badge: 'غلیظ بلژیکی',
    isBean: false,
  },
  {
    id: 'item-hot-masala',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-hot-drinks',
    nameFa: 'ماسالا',
    nameEn: 'Spiced Chai Masala',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 35,
    lowStockThreshold: 8,
    badge: 'ادویه‌ای هندی',
    isBean: false,
  },
  {
    id: 'item-hot-karak',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-hot-drinks',
    nameFa: 'چای کرک',
    nameEn: 'Authentic Karak Tea',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'زعفران و هل',
    isBean: false,
  },
  {
    id: 'item-hot-cider',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-hot-drinks',
    nameFa: 'اپل سایدر',
    nameEn: 'Spiced Hot Apple Cider',
    priceToman: 270000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 5,
    badge: 'سیب و دارچین',
    isBean: false,
  },
  {
    id: 'item-hot-milk-cin',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-hot-drinks',
    nameFa: 'شیر عسل دارچین',
    nameEn: 'Honey Cinnamon Warm Milk',
    priceToman: 250000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 8,
    badge: 'مقوی',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۶. نوشیدنی سرد بر پایه سیروپ
  // -------------------------------------------------------------
  {
    id: 'item-cold-lem',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'لیموناد',
    nameEn: 'Fresh Lemonade',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'خنک و تازه',
    isBean: false,
  },
  {
    id: 'item-cold-moj',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'موهیتو',
    nameEn: 'Classic Mint Mojito',
    priceToman: 270000,
    isAvailable: true,
    currentStock: 40,
    lowStockThreshold: 8,
    badge: 'نعناع و لیمو ترش',
    isBean: false,
  },
  {
    id: 'item-cold-lem-gin',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'لیموناد زنجبیل',
    nameEn: 'Ginger Lemonade',
    priceToman: 280000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: 'تند و گوارا',
    isBean: false,
  },
  {
    id: 'item-cold-moj-gin',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'موهیتو زنجبیل',
    nameEn: 'Ginger Mojito',
    priceToman: 280000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: 'اسپایسی',
    isBean: false,
  },
  {
    id: 'item-cold-icetea',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'آیس تی',
    nameEn: 'Classic Iced Tea',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 35,
    lowStockThreshold: 8,
    badge: null,
    isBean: false,
  },
  {
    id: 'item-cold-icetea-van',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'آیس تی وانیل',
    nameEn: 'Vanilla Iced Tea',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: null,
    isBean: false,
  },
  {
    id: 'item-cold-icetea-crm',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'آیس تی کارامل',
    nameEn: 'Caramel Iced Tea',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: null,
    isBean: false,
  },
  {
    id: 'item-cold-redmoon',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'ردمون',
    nameEn: 'Red Moon Mocktail',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: 'کوکتل اختصاصی',
    isBean: false,
  },
  {
    id: 'item-cold-raypo',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'رایپو',
    nameEn: 'Raypo Fruity Refresher',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: 'ترکیب میوه‌ای',
    isBean: false,
  },
  {
    id: 'item-cold-neon',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-cold-drinks',
    nameFa: 'نئون',
    nameEn: 'Neon Blue Refresher',
    priceToman: 270000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 6,
    badge: 'طعم کهکشانی',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۷. قهوه‌های دمی (Single Origin)
  // -------------------------------------------------------------
  {
    id: 'item-brew-v60',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-brewed',
    nameFa: 'قهوه دمی V60 (تک‌خاستگاه)',
    nameEn: 'Manual Pour-Over V60 (Single Origin)',
    priceToman: 320000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 5,
    badge: 'تک‌خاستگاه تخصصی',
    isBean: false,
  },
  {
    id: 'item-brew-chemex',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-brewed',
    nameFa: 'قهوه دمی کمکس Chemex (تک‌خاستگاه)',
    nameEn: 'Chemex Brewer (Single Origin)',
    priceToman: 320000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 5,
    badge: 'فیلتر ضخیم ابریشمی',
    isBean: false,
  },

  // -------------------------------------------------------------
  // ۸. دان و پودر قهوه (فروش کیلویی / بسته‌ای از لیست کارگاه)
  // -------------------------------------------------------------
  {
    id: 'item-bean-7030',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه ۷۰/۳۰ عربیکا (۱ کیلوگرم)',
    nameEn: '70/30 Arabica Blend (1kg)',
    priceToman: 4250000,
    isAvailable: true,
    currentStock: 1092, // 1.092 kg
    lowStockThreshold: 500,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۱.۰۹۲ کیلو',
    isBean: true,
  },
  {
    id: 'item-bean-6040',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه ۶۰/۴۰ عربیکا (۱ کیلوگرم)',
    nameEn: '60/40 Arabica Blend (1kg)',
    priceToman: 4200000,
    isAvailable: true,
    currentStock: 1050, // 1.050 kg
    lowStockThreshold: 500,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۱.۰۵۰ کیلو',
    isBean: true,
  },
  {
    id: 'item-bean-5050',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه ۵۰/۵۰ عربیکا (۱ کیلوگرم)',
    nameEn: '50/50 Arabica Blend (1kg)',
    priceToman: 4150000,
    isAvailable: true,
    currentStock: 1037, // 1.037 kg
    lowStockThreshold: 500,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۱.۰۳۷ کیلو',
    isBean: true,
  },
  {
    id: 'item-bean-8020',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه ۸۰/۲۰ عربیکا (۱ کیلوگرم)',
    nameEn: '80/20 Arabica Blend (1kg)',
    priceToman: 4280000,
    isAvailable: true,
    currentStock: 1070, // 1.070 kg
    lowStockThreshold: 500,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۱.۰۷۰ کیلو',
    isBean: true,
  },
  {
    id: 'item-bean-robusta',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه ۱۰۰٪ روبوستا (۱ کیلوگرم)',
    nameEn: '100% Robusta Roast (1kg)',
    priceToman: 3210000,
    isAvailable: true,
    currentStock: 802, // 0.802 kg
    lowStockThreshold: 400,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۰.۸۰۲ کیلو',
    isBean: true,
  },
  {
    id: 'item-bean-arabica100',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه ۱۰۰٪ عربیکا بلند (۱ کیلوگرم)',
    nameEn: '100% Arabica Blend (1kg)',
    priceToman: 4800000,
    isAvailable: true,
    currentStock: 1200, // 1.200 kg
    lowStockThreshold: 500,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۱.۲۰۰ کیلو',
    isBean: true,
  },
  {
    id: 'item-bean-colombia',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'دان قهوه سینگل اورجین کلمبیا (۱ کیلوگرم)',
    nameEn: 'Colombia Single Origin (1kg)',
    priceToman: 6300000,
    isAvailable: true,
    currentStock: 1575, // 1.575 kg
    lowStockThreshold: 500,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۱.۵۷۵ کیلو',
    isBean: true,
  },
  {
    id: 'item-powder-choc',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'پودر هات چاکلت اعلا (۱ کیلوگرم)',
    nameEn: 'Hot Chocolate Powder (1kg)',
    priceToman: 1400000,
    isAvailable: true,
    currentStock: 350, // 0.350 kg
    lowStockThreshold: 200,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۰.۳۵۰ کیلو',
    isBean: false,
  },
  {
    id: 'item-powder-masala',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'پودر ماسالا اعلا (۱ کیلوگرم)',
    nameEn: 'Chai Masala Powder (1kg)',
    priceToman: 1400000,
    isAvailable: true,
    currentStock: 340, // 0.340 kg
    lowStockThreshold: 200,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۰.۳۴۰ کیلو',
    isBean: false,
  },
  {
    id: 'item-powder-karak',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'پودر چای کرک اعلا (۱ کیلوگرم)',
    nameEn: 'Karak Tea Powder (1kg)',
    priceToman: 1450000,
    isAvailable: true,
    currentStock: 362, // 0.362 kg
    lowStockThreshold: 200,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۰.۳۶۲ کیلو',
    isBean: false,
  },
  {
    id: 'item-retail-tea',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-retail-beans',
    nameFa: 'چای لاهیجان دست‌چین اعلا (۱ کیلوگرم)',
    nameEn: 'Lahijan Premium Tea (1kg)',
    priceToman: 1350000,
    isAvailable: true,
    currentStock: 675, // 0.675 kg
    lowStockThreshold: 300,
    weight: '۱ کیلوگرم',
    badge: 'موجودی: ۰.۶۷۵ کیلو',
    isBean: false,
  },
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

  // Users & Authentication
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

  static isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      // Require active session so freshly opening the application starts at Login
      return window.sessionStorage?.getItem('smartorders_session_active_v1') === 'true';
    } catch {
      return false;
    }
  }

  static login(usernameOrPhone: string, password: string): { success: boolean; user?: User; error?: string } {
    const trimmed = (usernameOrPhone || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    if (!trimmed || !cleanPass) {
      return { success: false, error: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }

    const users = this.getUsers();
    const matched = users.find(
      (u) =>
        u.isActive &&
        (u.username?.toLowerCase() === trimmed ||
          u.phoneNumber === trimmed ||
          u.phoneNumber.replace(/^0/, '') === trimmed.replace(/^0/, ''))
    );

    if (!matched) {
      return { success: false, error: 'کاربری با این مشخصات یافت نشد یا حساب غیرفعال است.' };
    }

    if (matched.password && matched.password !== cleanPass) {
      return { success: false, error: 'رمز عبور وارد شده نادرست است.' };
    }

    this.setActiveUserId(matched.id);
    try {
      window.sessionStorage?.setItem('smartorders_session_active_v1', 'true');
    } catch {}
    save(STORAGE_KEYS.IS_LOGGED_IN, true);
    this.addAuditLog('USER_LOGIN', 'User', matched.id, `ورود موفق کاربر ${matched.fullName} (${matched.username}) با نقش ${matched.role}`);

    return { success: true, user: matched };
  }

  static logout(): void {
    const user = this.getActiveUser();
    try {
      window.sessionStorage?.removeItem('smartorders_session_active_v1');
    } catch {}
    save(STORAGE_KEYS.IS_LOGGED_IN, false);
    this.addAuditLog('USER_LOGOUT', 'User', user.id, `خروج کاربر ${user.fullName}`);
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
    } else {
      const users = this.getUsers();
      let updated = false;
      const patched = users.map((u) => {
        const def = DEFAULT_USERS.find((du) => du.id === u.id);
        if (!u.username || !u.password) {
          updated = true;
          return {
            ...u,
            username: u.username || def?.username || u.phoneNumber,
            password: u.password || def?.password || '123',
          };
        }
        return u;
      });
      if (updated) {
        save(STORAGE_KEYS.USERS, patched);
      }
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
