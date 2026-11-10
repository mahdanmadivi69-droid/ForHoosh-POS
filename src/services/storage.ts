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
import { InvoiceSequenceService } from './invoiceSequence';
import { getDexiePOSDatabase } from '../db/DexiePOSDatabase';
import { hashPassword, verifyPassword, SecureCredential } from './credentials';
import { normalizeDigits } from '../utils/digitNormalizer';

const STORAGE_KEYS = {
  ACTIVE_TENANT_ID: 'smartorders_active_tenant_id_v2',
  TENANT: 'smartorders_tenant_v1',
  TENANT_MODENDO: 'smartorders_tenant_modendo_v1',
  USERS: 'smartorders_users_v1',
  USERS_MODENDO: 'smartorders_users_modendo_v1',
  ACTIVE_USER_ID: 'smartorders_active_user_id_v1',
  IS_LOGGED_IN: 'smartorders_is_logged_in_v1',
  CATEGORIES: 'smartorders_categories_v2',
  CATEGORIES_MODENDO: 'smartorders_categories_modendo_v1',
  MENU_ITEMS: 'smartorders_menu_items_v2',
  MENU_ITEMS_MODENDO: 'smartorders_menu_items_modendo_v1',
  SHIFTS: 'smartorders_shifts_v1',
  ACTIVE_SHIFT_ID: 'smartorders_active_shift_id_v1',
  ORDERS: 'smartorders_orders_v1',
  PAYMENTS: 'smartorders_payments_v1',
  EXPENSES: 'smartorders_expenses_v1',
  AUDIT_LOGS: 'smartorders_audit_logs_v1',
};

// Modendo Cafe (Modendo Boardgame & Gaming Cafe - Primary Tenant)
export const MODENDO_TENANT: Tenant = {
  id: 'tenant-modendo-01',
  name: 'کافه بردگیم و گیمینگ مودندو (Modendo Cafe)',
  currency: 'TOMAN',
  phone: '021-88997766',
  address: 'تهران، خیابان شریعتی، مجتمع تجاری مودندو، طبقه منفی ۱ و همکف',
};

export const MODENDO_USERS: User[] = [
  {
    id: 'user-mod-01',
    tenantId: 'tenant-modendo-01',
    fullName: 'مهدان مهدوی (مدیر کل و مالک)',
    phoneNumber: '09121110001',
    username: 'admin',
    mustChangePassword: true,
    pin: '1380',
    role: 'OWNER',
    isActive: true,
  },
  {
    id: 'user-mod-02',
    tenantId: 'tenant-modendo-01',
    fullName: 'علی شریفی (سرپرست و مدیر سالن)',
    phoneNumber: '09121110002',
    username: 'ali',
    mustChangePassword: true,
    pin: '2468',
    role: 'MANAGER',
    isActive: true,
  },
  {
    id: 'user-mod-03',
    tenantId: 'tenant-modendo-01',
    fullName: 'مهسا کاظمی (صندوق‌دار شیفت)',
    phoneNumber: '09121110003',
    username: 'mahsa',
    mustChangePassword: true,
    pin: '1122',
    role: 'CASHIER',
    isActive: true,
  },
  {
    id: 'user-mod-04',
    tenantId: 'tenant-modendo-01',
    fullName: 'پویا مرادی (بارتندر و باریستا)',
    phoneNumber: '09121110004',
    username: 'pouya',
    mustChangePassword: true,
    pin: '3344',
    role: 'BARISTA',
    isActive: true,
  },
  {
    id: 'user-mod-05',
    tenantId: 'tenant-modendo-01',
    fullName: 'آرین خسروی (گیم‌مستر و مسئول کنسول PS5)',
    phoneNumber: '09121110005',
    username: 'arian',
    mustChangePassword: true,
    pin: '5566',
    role: 'BARISTA',
    isActive: true,
  },
];

export const MODENDO_CATEGORIES: Category[] = [
  { id: 'cat-mod-gaming', tenantId: 'tenant-modendo-01', nameFa: 'سشن‌های بازی و کنسول PS5', nameEn: 'Boardgame & PS5 Sessions', sortOrder: 1, isActive: true },
  { id: 'cat-mod-espresso', tenantId: 'tenant-modendo-01', nameFa: 'بار گرم و اسپرسو بار', nameEn: 'Hot Espresso Bar', sortOrder: 2, isActive: true },
  { id: 'cat-mod-cold', tenantId: 'tenant-modendo-01', nameFa: 'بار سرد و ماکتل‌های گیمینگ', nameEn: 'Gaming Mocktails & Cold Bar', sortOrder: 3, isActive: true },
  { id: 'cat-mod-food', tenantId: 'tenant-modendo-01', nameFa: 'برگر، پنینی و اسنک گرم', nameEn: 'Burgers, Panini & Snacks', sortOrder: 4, isActive: true },
  { id: 'cat-mod-terrace', tenantId: 'tenant-modendo-01', nameFa: 'پذیرایی تراس و دمنوش‌های آرامش', nameEn: 'Terrace & Herbal Blends', sortOrder: 5, isActive: true },
];

export const MODENDO_MENU_ITEMS: MenuItem[] = [
  // 1. سشن‌های بازی و کنسول
  {
    id: 'item-mod-bg-hourly',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-gaming',
    nameFa: 'ورودی بردگیم (ساعتی / هر نفر)',
    nameEn: 'Boardgame Table Fee (Per Person/Hr)',
    priceToman: 50000,
    isAvailable: true,
    currentStock: 999,
    lowStockThreshold: 10,
    badge: 'بردگیم',
    station: 'BAR',
  },
  {
    id: 'item-mod-ps5-hourly',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-gaming',
    nameFa: 'کنسول پلی‌استیشن ۵ (ساعتی)',
    nameEn: 'PS5 Gaming Pod (Hourly)',
    priceToman: 120000,
    isAvailable: true,
    currentStock: 999,
    lowStockThreshold: 10,
    badge: 'PS5 Standard',
    station: 'BAR',
  },
  {
    id: 'item-mod-lounge-token',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-gaming',
    nameFa: 'پکیج ژتون لانژ (سفارش آزاد)',
    nameEn: 'Lounge Token Pass',
    priceToman: 80000,
    isAvailable: true,
    currentStock: 999,
    lowStockThreshold: 10,
    badge: 'ژتون لانژ',
    station: 'BAR',
  },
  // 2. بار گرم و اسپرسو بار
  {
    id: 'item-mod-esp-single',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'اسپرسو سینگل مودندو',
    nameEn: 'Single Espresso Modendo',
    priceToman: 110000,
    isAvailable: true,
    currentStock: 100,
    lowStockThreshold: 15,
    badge: 'اسپرسو',
    station: 'BAR',
  },
  {
    id: 'item-mod-esp-double',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'اسپرسو دبل مودندو',
    nameEn: 'Double Espresso Modendo',
    priceToman: 130000,
    isAvailable: true,
    currentStock: 100,
    lowStockThreshold: 15,
    badge: 'دبل شات',
    station: 'BAR',
  },
  {
    id: 'item-mod-americano',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'آمریکانو گیمر (بزرگ)',
    nameEn: 'Americano Gamer Size',
    priceToman: 135000,
    isAvailable: true,
    currentStock: 80,
    lowStockThreshold: 15,
    badge: 'آمریکانو',
    station: 'BAR',
  },
  {
    id: 'item-mod-latte',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'کافه لاته مخملی',
    nameEn: 'Velvet Cafe Latte',
    priceToman: 150000,
    isAvailable: true,
    currentStock: 80,
    lowStockThreshold: 15,
    badge: 'لاته',
    station: 'BAR',
  },
  {
    id: 'item-mod-cappuccino',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'کاپوچینو ایتالیایی',
    nameEn: 'Italian Cappuccino',
    priceToman: 150000,
    isAvailable: true,
    currentStock: 70,
    lowStockThreshold: 15,
    badge: 'کاپوچینو',
    station: 'BAR',
  },
  {
    id: 'item-mod-caramel-mac',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'کارامل ماکیاتو ویژه',
    nameEn: 'Caramel Macchiato Special',
    priceToman: 165000,
    isAvailable: true,
    currentStock: 60,
    lowStockThreshold: 12,
    badge: 'کارامل',
    station: 'BAR',
  },
  {
    id: 'item-mod-mocha',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-espresso',
    nameFa: 'دارک موکا شکلات بلژیکی',
    nameEn: 'Belgian Dark Mocha',
    priceToman: 170000,
    isAvailable: true,
    currentStock: 50,
    lowStockThreshold: 10,
    badge: 'شکلات',
    station: 'BAR',
  },
  // 3. بار سرد و ماکتل‌های گیمینگ
  {
    id: 'item-mod-blue-electric',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-cold',
    nameFa: 'ماکتل الکتریک گیمر (بلوبری و سودا)',
    nameEn: 'Electric Gamer Mocktail',
    priceToman: 165000,
    isAvailable: true,
    currentStock: 60,
    lowStockThreshold: 10,
    badge: 'ویژه گیمینگ',
    station: 'BAR',
  },
  {
    id: 'item-mod-mojito',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-cold',
    nameFa: 'موهیتو کراش نعنا لیمو تازه',
    nameEn: 'Fresh Mint Lime Mojito',
    priceToman: 145000,
    isAvailable: true,
    currentStock: 60,
    lowStockThreshold: 10,
    badge: 'موهیتو',
    station: 'BAR',
  },
  {
    id: 'item-mod-iced-latte',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-cold',
    nameFa: 'آیس لاته با سیروپ وانیل',
    nameEn: 'Iced Vanilla Latte',
    priceToman: 160000,
    isAvailable: true,
    currentStock: 70,
    lowStockThreshold: 10,
    badge: 'آیس',
    station: 'BAR',
  },
  {
    id: 'item-mod-redbull-special',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-cold',
    nameFa: 'ردبول میکس استوایی گیمر',
    nameEn: 'RedBull Tropical Mix',
    priceToman: 185000,
    isAvailable: true,
    currentStock: 45,
    lowStockThreshold: 8,
    badge: 'انرژی‌زا',
    station: 'BAR',
  },
  // 4. برگر، پنینی و اسنک گرم (آشپزخانه)
  {
    id: 'item-mod-burger-classic',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-food',
    nameFa: 'برگر کلاسیک دست‌ساز مودندو (۲۰۰ گرم)',
    nameEn: 'Modendo Classic Beef Burger',
    priceToman: 295000,
    isAvailable: true,
    currentStock: 35,
    lowStockThreshold: 5,
    badge: 'آشپزخانه',
    station: 'KITCHEN',
  },
  {
    id: 'item-mod-panini-turkey',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-food',
    nameFa: 'پنینی بوقلمون دودی و پنیر گودا',
    nameEn: 'Smoked Turkey Gouda Panini',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 5,
    badge: 'پنینی',
    station: 'KITCHEN',
  },
  {
    id: 'item-mod-panini-pesto',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-food',
    nameFa: 'پنینی فیله مرغ گریل و سس پستو',
    nameEn: 'Grilled Chicken Pesto Panini',
    priceToman: 230000,
    isAvailable: true,
    currentStock: 30,
    lowStockThreshold: 5,
    badge: 'پنینی',
    station: 'KITCHEN',
  },
  {
    id: 'item-mod-fries-cheddar',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-food',
    nameFa: 'سیب‌زمینی سرخ‌کرده ویژه با دیپ چدار',
    nameEn: 'Special Fries with Hot Cheddar Dip',
    priceToman: 145000,
    isAvailable: true,
    currentStock: 50,
    lowStockThreshold: 10,
    badge: 'پیش‌غذا',
    station: 'KITCHEN',
  },
  {
    id: 'item-mod-croissant-ham',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-food',
    nameFa: 'کروسان برشته ژامبون و پنیر',
    nameEn: 'Ham & Cheese Croissant',
    priceToman: 160000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 5,
    badge: 'بیکری',
    station: 'KITCHEN',
  },
  {
    id: 'item-mod-cheesecake',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-food',
    nameFa: 'چیزکیک سن سباستین با سس شکلات',
    nameEn: 'San Sebastian Cheesecake',
    priceToman: 155000,
    isAvailable: true,
    currentStock: 25,
    lowStockThreshold: 5,
    badge: 'دسر',
    station: 'KITCHEN',
  },
  // 5. پذیرایی تراس و دمنوش‌های آرامش
  {
    id: 'item-mod-tea-lahijan',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-terrace',
    nameFa: 'چای دمی لاهیجان قوری ۲ نفره با نبات و هل',
    nameEn: 'Lahijan Black Tea Pot (2 Person)',
    priceToman: 85000,
    isAvailable: true,
    currentStock: 80,
    lowStockThreshold: 15,
    badge: 'تراس',
    station: 'BAR',
  },
  {
    id: 'item-mod-herbal-calm',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-mod-terrace',
    nameFa: 'دمنوش آرامش گیمر (به‌لیمو، بابونه و گل‌گاوزبان)',
    nameEn: 'Calm Gamer Herbal Infusion',
    priceToman: 95000,
    isAvailable: true,
    currentStock: 60,
    lowStockThreshold: 10,
    badge: 'دمنوش',
    station: 'BAR',
  },
];

// Secondary Tenant: قهوه‌فروشی ۱۰۰هیچ (100 Hich Specialty Coffee Roasters)
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
    fullName: 'مهدان مهدوی',
    phoneNumber: '09120000001',
    username: 'admin',
    mustChangePassword: true,
    role: 'OWNER',
    isActive: true,
  },
  {
    id: 'user-02',
    tenantId: 'tenant-100hich-01',
    fullName: 'صندوقدار شیفت',
    phoneNumber: '09120000002',
    username: 'cashier',
    mustChangePassword: true,
    role: 'CASHIER',
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
  { id: 'cat-bakery', tenantId: 'tenant-100hich-01', nameFa: 'بیکری و شیرینی‌جات', nameEn: 'Bakery & Pastry', sortOrder: 9, isActive: true },
  { id: 'cat-warm-food', tenantId: 'tenant-100hich-01', nameFa: 'ساندویچ و غذای گرم', nameEn: 'Sandwiches & Warm Food', sortOrder: 10, isActive: true },
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
    station: 'BAR',
  },
  // -------------------------------------------------------------
  // ۹. بیکری و شیرینی‌جات (KITCHEN)
  // -------------------------------------------------------------
  {
    id: 'item-bakery-croissant',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-bakery',
    nameFa: 'کروسان فرانسوی کره‌ای',
    nameEn: 'Butter Croissant',
    priceToman: 110000,
    isAvailable: true,
    currentStock: 24,
    lowStockThreshold: 5,
    station: 'KITCHEN',
    badge: 'تازه پخت',
    isBean: false,
  },
  {
    id: 'item-bakery-carrot-cake',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-bakery',
    nameFa: 'کیک هویج و گردو اسپشیال',
    nameEn: 'Carrot Walnut Cake',
    priceToman: 135000,
    isAvailable: true,
    currentStock: 18,
    lowStockThreshold: 4,
    station: 'KITCHEN',
    badge: 'شیرینی روز',
    isBean: false,
  },
  {
    id: 'item-bakery-cheesecake',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-bakery',
    nameFa: 'چیزکیک سن سباستین',
    nameEn: 'San Sebastian Cheesecake',
    priceToman: 160000,
    isAvailable: true,
    currentStock: 12,
    lowStockThreshold: 3,
    station: 'KITCHEN',
    badge: 'محبوب',
    isBean: false,
  },
  // -------------------------------------------------------------
  // ۱۰. ساندویچ و غذای گرم (KITCHEN)
  // -------------------------------------------------------------
  {
    id: 'item-food-turkey-sandwich',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-warm-food',
    nameFa: 'ساندویچ بوقلمون دودی و پنیر گودا',
    nameEn: 'Smoked Turkey Sandwich',
    priceToman: 240000,
    isAvailable: true,
    currentStock: 15,
    lowStockThreshold: 4,
    station: 'KITCHEN',
    badge: 'غذای گرم',
    isBean: false,
  },
  {
    id: 'item-food-spinach-toast',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-warm-food',
    nameFa: 'تست پنیر گودا و اسفناج',
    nameEn: 'Spinach & Gouda Toast',
    priceToman: 180000,
    isAvailable: true,
    currentStock: 20,
    lowStockThreshold: 5,
    station: 'KITCHEN',
    badge: 'غذای گرم',
    isBean: false,
  },
  {
    id: 'item-food-chicken-panini',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-warm-food',
    nameFa: 'پنینی مرغ و سس پستو',
    nameEn: 'Chicken Pesto Panini',
    priceToman: 260000,
    isAvailable: true,
    currentStock: 16,
    lowStockThreshold: 4,
    station: 'KITCHEN',
    badge: 'غذای گرم',
    isBean: false,
  },
];

// Helper to access LocalStorage safely
function load<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

export class StorageWriteError extends Error {
  readonly code: 'QUOTA_EXCEEDED' | 'STORAGE_UNAVAILABLE';
  readonly storageKey: string;

  constructor(storageKey: string, code: 'QUOTA_EXCEEDED' | 'STORAGE_UNAVAILABLE') {
    super(
      code === 'QUOTA_EXCEEDED'
        ? 'ذخیره‌سازی محلی انجام نشد: حافظه مرورگر (LocalStorage) پر شده است. این عملیات ثبت نشد؛ لطفاً از داده‌ها پشتیبان بگیرید و حافظه را آزاد کنید. تا رفع مشکل وجهی دریافت نکنید.'
        : 'ذخیره‌سازی محلی انجام نشد: مرورگر دسترسی نوشتن به LocalStorage را مسدود کرده است. این عملیات ثبت نشد؛ تا رفع مشکل وجهی دریافت نکنید.'
    );
    this.name = 'StorageWriteError';
    this.code = code;
    this.storageKey = storageKey;
  }
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { name?: string; code?: number; message?: string };
  return (
    anyErr.name === 'QuotaExceededError' ||
    anyErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    anyErr.code === 22 ||
    anyErr.code === 1014 ||
    (typeof anyErr.message === 'string' && /quota/i.test(anyErr.message))
  );
}

function save<T>(key: string, data: T): void {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key}:`, err);
    throw new StorageWriteError(key, isQuotaExceededError(err) ? 'QUOTA_EXCEEDED' : 'STORAGE_UNAVAILABLE');
  }
}

interface ThrottleState {
  attempts: number;
  lockedUntil?: number;
}

const loginThrottles = new Map<string, ThrottleState>();

export class SmartOrdersStore {
  // Tenant-scoped key helper
  static getTenantKey(baseKey: string): string {
    const activeTenantId = this.getActiveTenantId();
    return `${baseKey}_${activeTenantId}`;
  }

  // Active Tenant Management
  static getActiveTenantId(): string {
    const envTenant = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TENANT_ID) || '';
    if (envTenant) {
      return envTenant;
    }
    return load<string>(STORAGE_KEYS.ACTIVE_TENANT_ID, 'tenant-modendo-01');
  }

  static setActiveTenantId(tenantId: string): void {
    save(STORAGE_KEYS.ACTIVE_TENANT_ID, tenantId);
  }

  static getAvailableTenants(): Tenant[] {
    return [MODENDO_TENANT, DEFAULT_TENANT];
  }

  static switchTenant(tenantId: string): Tenant {
    this.setActiveTenantId(tenantId);
    const users = this.getUsers();
    if (users.length > 0) {
      this.setActiveUserId(users[0].id);
    }
    this.initSeedData();
    return this.getTenant();
  }

  // Tenant
  static getTenant(): Tenant {
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-100hich-01') {
      return load(STORAGE_KEYS.TENANT, DEFAULT_TENANT);
    }
    return load(STORAGE_KEYS.TENANT_MODENDO, MODENDO_TENANT);
  }

  static updateTenant(updated: Partial<Tenant>): Tenant {
    const current = this.getTenant();
    const merged = { ...current, ...updated };
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-100hich-01') {
      save(STORAGE_KEYS.TENANT, merged);
    } else {
      save(STORAGE_KEYS.TENANT_MODENDO, merged);
    }
    return merged;
  }

  // Users & Authentication
  static getUsers(): User[] {
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-100hich-01') {
      return load(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }
    return load(STORAGE_KEYS.USERS_MODENDO, MODENDO_USERS);
  }

  static getActiveUser(): User {
    const users = this.getUsers();
    const activeId = load(STORAGE_KEYS.ACTIVE_USER_ID, users[0].id);
    return users.find((u) => u.id === activeId) || users[0];
  }

  static setActiveUserId(userId: string): void {
    try {
      save(STORAGE_KEYS.ACTIVE_USER_ID, userId);
    } catch (err) {
      console.error('[storage] active user pointer could not be persisted', err);
    }
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

  static saveUsers(users: User[]): void {
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-100hich-01' || !activeTenantId) {
      save(STORAGE_KEYS.USERS, users);
    } else {
      save(STORAGE_KEYS.USERS_MODENDO, users);
    }
  }

  static updateUser(updated: User): void {
    const users = this.getUsers().map((u) => (u.id === updated.id ? updated : u));
    this.saveUsers(users);
  }

  static addUser(newUser: User): void {
    const users = this.getUsers();
    const existingIndex = users.findIndex((u) => u.id === newUser.id || u.username === newUser.username);
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...newUser };
      this.saveUsers(users);
    } else {
      this.saveUsers([...users, newUser]);
    }
  }

  static async migrateLegacyUserPasswords(): Promise<void> {
    try {
      const users = this.getUsers();
      let modified = false;
      const cleanUsers: User[] = [];

      for (const u of users) {
        const legacyPass = (u as any).password;
        if (legacyPass && typeof legacyPass === 'string') {
          modified = true;
          const cred = await hashPassword(legacyPass);
          const copy = { ...u };
          delete (copy as any).password;
          copy.credential = cred;
          copy.mustChangePassword = true;
          cleanUsers.push(copy);
        } else {
          const copy = { ...u };
          delete (copy as any).password;
          cleanUsers.push(copy);
        }
      }

      if (modified) {
        this.saveUsers(cleanUsers);
        console.log('[Security] Legacy plaintext passwords migrated to PBKDF2-SHA256 credentials.');
      }
    } catch (err) {
      console.error('[Security] Legacy password migration failed:', err);
    }
  }

  static hasOwnerCredential(): boolean {
    return this.getUsers().some((u) => u.role === 'OWNER' && !!u.credential);
  }

  private static async verifyOwnerSetupCode(code: string): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/setup/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { ok?: boolean };
      return data?.ok === true;
    } catch {
      return false;
    }
  }

  static async enrollCredential(
    usernameOrPhone: string,
    password: string,
    setupCode?: string
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = normalizeDigits((usernameOrPhone || '').trim()).toLowerCase();
    const cleanPass = normalizeDigits((password || '').trim());
    if (!trimmed || !cleanPass) {
      return { success: false, error: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }
    if (cleanPass.length < 6) {
      return { success: false, error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' };
    }

    const matched = this.getUsers().find(
      (u) =>
        u.isActive &&
        (u.username?.toLowerCase() === trimmed ||
          u.phoneNumber === trimmed ||
          u.phoneNumber.replace(/^0/, '') === trimmed.replace(/^0/, ''))
    );
    if (!matched) {
      return { success: false, error: 'کاربری با این مشخصات یافت نشد یا حساب غیرفعال است.' };
    }
    if (matched.credential) {
      return { success: false, error: 'این حساب قبلاً رمز عبور دارد.' };
    }

    if (matched.role === 'OWNER') {
      if (this.hasOwnerCredential()) {
        return { success: false, error: 'حساب مالک قبلاً راه‌اندازی شده است.' };
      }
      const code = (setupCode || '').trim();
      if (!code) {
        return { success: false, error: 'کد راه‌اندازی مالک لازم است.' };
      }
      const verified = await SmartOrdersStore.verifyOwnerSetupCode(code);
      if (!verified) {
        return { success: false, error: 'کد راه‌اندازی نامعتبر است یا سرور در دسترس نیست.' };
      }
    } else if (!this.hasOwnerCredential()) {
      return { success: false, error: 'ابتدا حساب مالک باید راه‌اندازی شود.' };
    }

    const credential = await hashPassword(cleanPass);
    this.updateUser({ ...matched, credential, mustChangePassword: false });
    this.addAuditLog(
      'USER_ENROLLED',
      'User',
      matched.id,
      `تعریف رمز عبور برای ${matched.fullName} (${matched.username}) با نقش ${matched.role}`
    );
    return { success: true };
  }

  static async login(usernameOrPhone: string, password: string): Promise<{
    success: boolean;
    user?: User;
    error?: string;
    requiresEnrollment?: boolean;
    enrollmentRequiresSetupCode?: boolean;
  }> {
    const trimmed = normalizeDigits(usernameOrPhone || '').trim().toLowerCase();
    const cleanPass = normalizeDigits(password || '').trim();
    if (!trimmed || !cleanPass) {
      return { success: false, error: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }

    const now = Date.now();
    const throttle = loginThrottles.get(trimmed);
    if (throttle?.lockedUntil && throttle.lockedUntil > now) {
      const remainingSec = Math.ceil((throttle.lockedUntil - now) / 1000);
      return {
        success: false,
        error: `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${remainingSec} ثانیه صبر کنید.`,
      };
    }

    const recordFailure = () => {
      const record = loginThrottles.get(trimmed) || { attempts: 0 };
      record.attempts += 1;
      if (record.attempts >= 5) {
        record.lockedUntil = Date.now() + 30000;
        record.attempts = 0;
      }
      loginThrottles.set(trimmed, record);
    };

    const users = this.getUsers();
    const matched = users.find(
      (u) =>
        u.isActive &&
        (u.username?.toLowerCase() === trimmed ||
          u.phoneNumber === trimmed ||
          u.phoneNumber.replace(/^0/, '') === trimmed.replace(/^0/, ''))
    );

    if (!matched) {
      recordFailure();
      return { success: false, error: 'کاربری با این مشخصات یافت نشد یا حساب غیرفعال است.' };
    }
    if (matched.credential) {
      const isValid = await verifyPassword(cleanPass, matched.credential);
      if (!isValid) {
        recordFailure();
        return { success: false, error: 'رمز عبور وارد شده نادرست است.' };
      }
    } else if (matched.mustChangePassword) {
      return {
        success: false,
        requiresEnrollment: true,
        enrollmentRequiresSetupCode: matched.role === 'OWNER',
        error:
          matched.role === 'OWNER'
            ? 'این حساب هنوز رمز ندارد. برای تعریف رمز مالک، کد راه‌اندازی را از کنسول سرور بردارید.'
            : 'این حساب هنوز رمز ندارد. ابتدا حساب مالک باید راه‌اندازی شود.',
      };
    } else {
      return {
        success: false,
        requiresEnrollment: true,
        enrollmentRequiresSetupCode: matched.role === 'OWNER',
        error: 'این حساب هنوز رمز ندارد. ابتدا حساب مالک باید راه‌اندازی شود.',
      };
    }

    loginThrottles.delete(trimmed);
    this.setActiveUserId(matched.id);
    try {
      window.sessionStorage?.setItem('smartorders_session_active_v1', 'true');
    } catch {}
    try {
      save(STORAGE_KEYS.IS_LOGGED_IN, true);
    } catch (err) {
      console.error('[storage] login flag could not be persisted', err);
    }
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
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-modendo-01') {
      return load(STORAGE_KEYS.CATEGORIES_MODENDO, MODENDO_CATEGORIES);
    }
    return load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  }

  static saveCategories(cats: Category[]): void {
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-modendo-01') {
      save(STORAGE_KEYS.CATEGORIES_MODENDO, cats);
    } else {
      save(STORAGE_KEYS.CATEGORIES, cats);
    }
  }

  // Menu Items
  static getMenuItems(): MenuItem[] {
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-modendo-01') {
      const rawItems = load<MenuItem[]>(STORAGE_KEYS.MENU_ITEMS_MODENDO, MODENDO_MENU_ITEMS);
      const existingIds = new Set(rawItems.map((i) => i.id));
      const missingDefaults = MODENDO_MENU_ITEMS.filter((d) => !existingIds.has(d.id));
      const combined = missingDefaults.length > 0 ? [...rawItems, ...missingDefaults] : rawItems;

      return combined.map((item) => {
        const def = MODENDO_MENU_ITEMS.find((d) => d.id === item.id);
        const stock = item.currentStock !== undefined && item.currentStock !== null ? item.currentStock : (def?.currentStock ?? 50);
        const threshold = item.lowStockThreshold !== undefined && item.lowStockThreshold !== null ? item.lowStockThreshold : (def?.lowStockThreshold ?? 10);
        const station = item.station || def?.station || (item.categoryId === 'cat-mod-food' ? 'KITCHEN' : 'BAR');
        return { ...item, currentStock: stock, lowStockThreshold: threshold, station };
      });
    }

    const rawItems = load<MenuItem[]>(STORAGE_KEYS.MENU_ITEMS, DEFAULT_MENU_ITEMS);
    let modified = false;

    // Ensure newly added default items (e.g. bakery/kitchen items) are available
    const existingIds = new Set(rawItems.map((i) => i.id));
    const missingDefaults = DEFAULT_MENU_ITEMS.filter((d) => !existingIds.has(d.id));
    const combined = missingDefaults.length > 0 ? [...rawItems, ...missingDefaults] : rawItems;
    if (missingDefaults.length > 0) modified = true;

    const items = combined.map((item) => {
      const defaultMatch = DEFAULT_MENU_ITEMS.find((d) => d.id === item.id);
      let updated = false;
      let stock = item.currentStock;
      let threshold = item.lowStockThreshold;
      let station = item.station;

      if (stock === undefined || stock === null) {
        stock = defaultMatch?.currentStock !== undefined ? defaultMatch.currentStock : 15;
        updated = true;
      }
      if (threshold === undefined || threshold === null) {
        threshold = defaultMatch?.lowStockThreshold !== undefined ? defaultMatch.lowStockThreshold : 5;
        updated = true;
      }
      if (!station) {
        if (item.categoryId === 'cat-bakery' || item.categoryId === 'cat-warm-food') {
          station = 'KITCHEN';
        } else {
          station = defaultMatch?.station || 'BAR';
        }
        updated = true;
      }

      if (updated) {
        modified = true;
        return { ...item, currentStock: stock, lowStockThreshold: threshold, station };
      }
      return item;
    });

    if (modified) {
      save(STORAGE_KEYS.MENU_ITEMS, items);
    }
    return items;
  }

  static saveMenuItems(items: MenuItem[]): void {
    const activeTenantId = this.getActiveTenantId();
    if (activeTenantId === 'tenant-modendo-01') {
      save(STORAGE_KEYS.MENU_ITEMS_MODENDO, items);
    } else {
      save(STORAGE_KEYS.MENU_ITEMS, items);
    }
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
    const key = this.getTenantKey(STORAGE_KEYS.SHIFTS);
    const activeTenantId = this.getActiveTenantId();
    const scoped = load<Shift[]>(key, []);
    if (scoped.length > 0) return scoped;

    const legacy = load<Shift[]>(STORAGE_KEYS.SHIFTS, []);
    const matching = legacy.filter((s) => s.tenantId === activeTenantId);
    if (matching.length > 0) {
      save(key, matching);
      return matching;
    }
    return [];
  }

  static saveShifts(shifts: Shift[]): void {
    const key = this.getTenantKey(STORAGE_KEYS.SHIFTS);
    save(key, shifts);
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
    this.saveShifts(shifts);
    const activeShiftKey = this.getTenantKey(STORAGE_KEYS.ACTIVE_SHIFT_ID);
    save(activeShiftKey, newShift.id);

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
    this.saveShifts(shifts);
    const activeShiftKey = this.getTenantKey(STORAGE_KEYS.ACTIVE_SHIFT_ID);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(activeShiftKey);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT_ID);
    }

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
    const key = this.getTenantKey(STORAGE_KEYS.ORDERS);
    const activeTenantId = this.getActiveTenantId();
    const scoped = load<Order[]>(key, []);
    if (scoped.length > 0) return scoped;

    const legacy = load<Order[]>(STORAGE_KEYS.ORDERS, []);
    const matching = legacy.filter((o) => o.tenantId === activeTenantId);
    if (matching.length > 0) {
      save(key, matching);
      return matching;
    }
    return [];
  }

  static saveOrders(orders: Order[]): void {
    const key = this.getTenantKey(STORAGE_KEYS.ORDERS);
    save(key, orders);
    if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
      try {
        const tenantId = this.getTenant().id;
        const db = getDexiePOSDatabase(tenantId);
        db.orders.bulkPut(
          orders.map((o) => ({
            id: o.id,
            clientGeneratedId: (o as any).clientGeneratedId || o.id,
            tenantId: o.tenantId || tenantId,
            shiftId: o.shiftId,
            orderNumber: o.orderNumber,
            tableLabel: o.tableLabel,
            orderType: o.orderType,
            status: (o.status === 'COMPLETED' ? 'PAID' : (o.status as any)) || 'PAID',
            grossAmountToman: o.grossAmountToman,
            discountAmountToman: o.discountAmountToman,
            netTotalToman: o.netTotalToman,
            paidAmountToman: o.netTotalToman,
            vatTotalToman: 0,
            customerName: o.customerName,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            synced: (o as any).synced ?? false,
          }))
        ).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  static async hydrateOrdersFromDexie(tenantId?: string): Promise<Order[]> {
    if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
      try {
        const tid = tenantId || this.getTenant().id;
        const db = getDexiePOSDatabase(tid);
        const dexieOrders = await db.orders.toArray();
        if (dexieOrders && dexieOrders.length > 0) {
          const localOrders = this.getOrders();
          if (localOrders.length === 0) {
            const key = this.getTenantKey(STORAGE_KEYS.ORDERS);
            save(key, dexieOrders as any);
            return dexieOrders as any;
          }
        }
      } catch {
        // ignore
      }
    }
    return this.getOrders();
  }

  static createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'>): Order {
    const orders = this.getOrders();
    const tenantId = this.getTenant().id;
    const nextOrderNumber = InvoiceSequenceService.nextOrderNumber(tenantId, orders);
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
    this.savePayments(updatedPayments);

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
    const key = this.getTenantKey(STORAGE_KEYS.PAYMENTS);
    const activeTenantId = this.getActiveTenantId();
    const scoped = load<Payment[]>(key, []);
    if (scoped.length > 0) return scoped;

    const legacy = load<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
    const matching = legacy.filter((p) => p.tenantId === activeTenantId);
    if (matching.length > 0) {
      save(key, matching);
      return matching;
    }
    return [];
  }

  static savePayments(payments: Payment[]): void {
    const key = this.getTenantKey(STORAGE_KEYS.PAYMENTS);
    save(key, payments);
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
    this.savePayments(payments);

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
    const key = this.getTenantKey(STORAGE_KEYS.EXPENSES);
    const activeTenantId = this.getActiveTenantId();
    const scoped = load<Expense[]>(key, []);
    if (scoped.length > 0) return scoped;

    const legacy = load<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    const matching = legacy.filter((e) => e.tenantId === activeTenantId);
    if (matching.length > 0) {
      save(key, matching);
      return matching;
    }
    return [];
  }

  static saveExpenses(expenses: Expense[]): void {
    const key = this.getTenantKey(STORAGE_KEYS.EXPENSES);
    save(key, expenses);
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
    this.saveExpenses(expenses);

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
    const key = this.getTenantKey(STORAGE_KEYS.AUDIT_LOGS);
    const activeTenantId = this.getActiveTenantId();
    const scoped = load<AuditLog[]>(key, []);
    if (scoped.length > 0) return scoped;

    const legacy = load<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    const matching = legacy.filter((l) => l.tenantId === activeTenantId);
    if (matching.length > 0) {
      save(key, matching);
      return matching;
    }
    return [];
  }

  static saveAuditLogs(logs: AuditLog[]): void {
    const key = this.getTenantKey(STORAGE_KEYS.AUDIT_LOGS);
    try {
      save(key, logs);
    } catch (err) {
      console.error('[storage] audit log could not be persisted', err);
    }
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
    this.saveAuditLogs(logs.slice(0, 300));
  }

  // Seed sample initial shift and history if fresh install
  static initSeedData(): void {
    // 1. Modendo Primary Tenant Data Seeding
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT_ID)) {
      save(STORAGE_KEYS.ACTIVE_TENANT_ID, 'tenant-modendo-01');
    }
    if (!localStorage.getItem(STORAGE_KEYS.TENANT_MODENDO)) {
      save(STORAGE_KEYS.TENANT_MODENDO, MODENDO_TENANT);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS_MODENDO)) {
      save(STORAGE_KEYS.USERS_MODENDO, MODENDO_USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES_MODENDO)) {
      save(STORAGE_KEYS.CATEGORIES_MODENDO, MODENDO_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MENU_ITEMS_MODENDO)) {
      save(STORAGE_KEYS.MENU_ITEMS_MODENDO, MODENDO_MENU_ITEMS);
    }

    // 2. Secondary Tenant (100 Hich) Data Seeding
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      save(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MENU_ITEMS)) {
      save(STORAGE_KEYS.MENU_ITEMS, DEFAULT_MENU_ITEMS);
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
      const initialShift = this.openShift(500000, 'شیفت صبح آزمایشی');

      // Create two sample completed orders
      const user = this.getActiveUser();
      const menu = this.getMenuItems();

      const latteItem = menu.find((m) => m.nameFa.includes('لاته') || m.id.includes('lat')) || menu[0];
      const bakeryItem = menu.find((m) => m.nameFa.includes('چیزکیک') || m.nameFa.includes('کروسان') || m.nameFa.includes('برگر')) || menu[1];
      const americanoItem = menu.find((m) => m.nameFa.includes('آمریکانو') || m.nameFa.includes('اسپرسو') || m.id.includes('ame')) || menu[0];
      const pastryItem = menu.find((m) => m.nameFa.includes('کروسان') || m.id.includes('cro') || m.nameFa.includes('پنینی')) || menu[1];

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
            menuItemId: latteItem.id,
            itemNameSnapshot: latteItem.nameFa,
            unitPriceSnapshotToman: latteItem.priceToman,
            quantity: 2,
            subtotalToman: latteItem.priceToman * 2,
          },
          {
            id: 'item-snap-2',
            menuItemId: bakeryItem.id,
            itemNameSnapshot: bakeryItem.nameFa,
            unitPriceSnapshotToman: bakeryItem.priceToman,
            quantity: 1,
            subtotalToman: bakeryItem.priceToman,
          },
        ],
        grossAmountToman: latteItem.priceToman * 2 + bakeryItem.priceToman,
        discountAmountToman: 15000,
        netTotalToman: latteItem.priceToman * 2 + bakeryItem.priceToman - 15000,
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
            menuItemId: americanoItem.id,
            itemNameSnapshot: americanoItem.nameFa,
            unitPriceSnapshotToman: americanoItem.priceToman,
            quantity: 1,
            subtotalToman: americanoItem.priceToman,
          },
          {
            id: 'item-snap-4',
            menuItemId: pastryItem.id,
            itemNameSnapshot: pastryItem.nameFa,
            unitPriceSnapshotToman: pastryItem.priceToman,
            quantity: 1,
            subtotalToman: pastryItem.priceToman,
          },
        ],
        grossAmountToman: americanoItem.priceToman + pastryItem.priceToman,
        discountAmountToman: 0,
        netTotalToman: americanoItem.priceToman + pastryItem.priceToman,
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
      users: this.getUsers().map(({ credential, password, ...rest }: any) => rest),
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
      if (Array.isArray(parsed.users)) {
        const priorCredentials = new Map(
          this.getUsers().map((u) => [u.id, u.credential] as const)
        );
        const imported = parsed.users.map((u: any) => {
          const { credential, password, ...rest } = u;
          const prior = priorCredentials.get(rest.id);
          if (prior) {
            return { ...rest, credential: prior, mustChangePassword: false };
          }
          return { ...rest, mustChangePassword: true };
        });
        this.saveUsers(imported);
      }
      if (Array.isArray(parsed.categories)) save(STORAGE_KEYS.CATEGORIES, parsed.categories);
      if (Array.isArray(parsed.menuItems)) save(STORAGE_KEYS.MENU_ITEMS, parsed.menuItems);
      if (Array.isArray(parsed.shifts)) save(STORAGE_KEYS.SHIFTS, parsed.shifts);
      if (Array.isArray(parsed.orders)) {
        save(STORAGE_KEYS.ORDERS, parsed.orders);
        InvoiceSequenceService.reconcile(parsed.tenant?.id || this.getTenant().id, parsed.orders);
      }
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
