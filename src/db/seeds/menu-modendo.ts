/**
 * CAFE OS — Seed Catalog: Modendo Cafe & Gaming Lounge (کافه بازی و گیمینگ مودندو)
 * Tenant ID: tenant-modendo-01
 * Path: src/db/seeds/menu-modendo.ts
 *
 * Menu Profile:
 * - Gaming & Activity Charges (Boardgame entrance fees, 4 PS5 stations hourly billing, VIP suite)
 * - Cafe & Bistro Food (Smash burgers, chicken pesto panini, loaded fries, nachos, croissants)
 * - Lounge Beverages & Mocktails (Fresh mojito, Red Bull, Nutella shake, iced teas, specialty latte)
 * - Cakes & Desserts (San Sebastian cheesecake, warm brownies with ice cream)
 *
 * Strict Accounting Invariants:
 * - All prices in integer Toman (Number.isInteger(priceToman) === true).
 * - Multi-tenant isolation guaranteed via explicit tenantId on every entity.
 */

import { PrepStation } from '../../modules/smart-orders/types';

export interface SeedMenuItemModendo {
  id: string;
  tenantId: 'tenant-modendo-01';
  categoryId: string;
  categoryNameFa: string;
  categoryNameEn: string;
  title: string;
  titleEn: string;
  descriptionFa?: string;
  priceToman: number;
  station: PrepStation;
  isAvailable: boolean;
  isEntranceFee?: boolean;
  isHourlyGaming?: boolean;
  ps5StationNumber?: number; // 1, 2, 3, 4
  hourlyBillingRateToman?: number;
  modifiers?: Array<{
    id: string;
    nameFa: string;
    priceDeltaToman: number;
  }>;
  updatedAt: string;
}

export const MENU_SEEDS_MODENDO: SeedMenuItemModendo[] = [
  // ===========================================================================
  // 1. خدمات گیمینگ و ورودی بردگیم (Gaming & Boardgame Fees)
  // ===========================================================================
  {
    id: 'modendo-fee-boardgame-entry',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-gaming',
    categoryNameFa: 'خدمات گیمینگ و ورودی',
    categoryNameEn: 'Gaming Fees & Cover Charges',
    title: 'ورودی بازی‌های بردگیم (به ازای هر نفر)',
    titleEn: 'Boardgame Hall Entrance Fee (Per Player)',
    descriptionFa: 'دسترسی نامحدود به آرشیو ۲۰۰+ بازی رومیزی به همراه آموزش توسط گیم‌مستر',
    priceToman: 70000,
    station: 'NO_PREP',
    isAvailable: true,
    isEntranceFee: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-fee-ps5-station-1',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-gaming',
    categoryNameFa: 'خدمات گیمینگ و ورودی',
    categoryNameEn: 'Gaming Fees & Cover Charges',
    title: 'شارژ ساعتی پاد PS5 شماره ۱',
    titleEn: 'PS5 Gaming Pod 1 (Per Hour)',
    descriptionFa: 'کنسول پلی‌استیشن ۵ با مانیتور گیمینگ ۱۲۰ هرتز و دو دسته DualSense',
    priceToman: 90000,
    station: 'NO_PREP',
    isAvailable: true,
    isHourlyGaming: true,
    ps5StationNumber: 1,
    hourlyBillingRateToman: 90000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-fee-ps5-station-2',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-gaming',
    categoryNameFa: 'خدمات گیمینگ و ورودی',
    categoryNameEn: 'Gaming Fees & Cover Charges',
    title: 'شارژ ساعتی پاد PS5 شماره ۲',
    titleEn: 'PS5 Gaming Pod 2 (Per Hour)',
    descriptionFa: 'کنسول پلی‌استیشن ۵ با مانیتور گیمینگ ۱۲۰ هرتز و دو دسته DualSense',
    priceToman: 90000,
    station: 'NO_PREP',
    isAvailable: true,
    isHourlyGaming: true,
    ps5StationNumber: 2,
    hourlyBillingRateToman: 90000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-fee-ps5-station-3',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-gaming',
    categoryNameFa: 'خدمات گیمینگ و ورودی',
    categoryNameEn: 'Gaming Fees & Cover Charges',
    title: 'شارژ ساعتی پاد PS5 شماره ۳ (۴ نفره)',
    titleEn: 'PS5 Gaming Pod 3 (4 Players, Per Hour)',
    descriptionFa: 'کنسول پلی‌استیشن ۵ با تلویزیون ۵۵ اینچ ۴K OLED و چهار دسته برای بازی‌های گروهی',
    priceToman: 90000,
    station: 'NO_PREP',
    isAvailable: true,
    isHourlyGaming: true,
    ps5StationNumber: 3,
    hourlyBillingRateToman: 90000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-fee-ps5-station-4',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-gaming',
    categoryNameFa: 'خدمات گیمینگ و ورودی',
    categoryNameEn: 'Gaming Fees & Cover Charges',
    title: 'شارژ ساعتی پاد PS5 شماره ۴ (۴ نفره)',
    titleEn: 'PS5 Gaming Pod 4 (4 Players, Per Hour)',
    descriptionFa: 'کنسول پلی‌استیشن ۵ با تلویزیون ۵۵ اینچ ۴K OLED و چهار دسته برای فیفا و مورتال کامبت',
    priceToman: 90000,
    station: 'NO_PREP',
    isAvailable: true,
    isHourlyGaming: true,
    ps5StationNumber: 4,
    hourlyBillingRateToman: 90000,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-fee-vip-room',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-gaming',
    categoryNameFa: 'خدمات گیمینگ و ورودی',
    categoryNameEn: 'Gaming Fees & Cover Charges',
    title: 'شارژ ساعتی اتاق VIP بازی و استریم',
    titleEn: 'VIP Gaming & Streaming Suite (Per Hour)',
    descriptionFa: 'اتاق اختصاصی آکوستیک با ظرفیت ۸ نفر، سینمای خانگی و دو کنسول همزمان',
    priceToman: 150000,
    station: 'NO_PREP',
    isAvailable: true,
    isHourlyGaming: true,
    hourlyBillingRateToman: 150000,
    updatedAt: new Date().toISOString(),
  },

  // ===========================================================================
  // 2. غذا و اسنک بیسترو (Bistro Food & Snacks)
  // ===========================================================================
  {
    id: 'modendo-food-smash-burger',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-bistro',
    categoryNameFa: 'غذا و اسنک بیسترو',
    categoryNameEn: 'Bistro Food & Gourmet Snacks',
    title: 'اسمش برگر دوبل با پنیر چدار',
    titleEn: 'Double Smash Burger with Cheddar',
    descriptionFa: 'دو پتی گوشت گوساله برشته‌شده روی گریل داغ، پنیر چدار آب‌شده، پیاز کاراملی و سس مخصوص',
    priceToman: 240000,
    station: 'KITCHEN',
    isAvailable: true,
    modifiers: [
      { id: 'mod-extra-cheese', nameFa: 'پنیر چدار اضافه', priceDeltaToman: 25000 },
      { id: 'mod-extra-patty', nameFa: 'یک پتی اسمش اضافه', priceDeltaToman: 70000 },
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-food-chicken-panini',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-bistro',
    categoryNameFa: 'غذا و اسنک بیسترو',
    categoryNameEn: 'Bistro Food & Gourmet Snacks',
    title: 'ساندویچ پانینی مرغ گریل و سس پستو',
    titleEn: 'Grilled Chicken Pesto Panini',
    descriptionFa: 'فیله مرغ مرینیت‌شده با سبزیجات معطر، سس پستوی خانگی، پنیر موزارلا تازه و نان چاباتا',
    priceToman: 190000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-food-loaded-fries',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-bistro',
    categoryNameFa: 'غذا و اسنک بیسترو',
    categoryNameEn: 'Bistro Food & Gourmet Snacks',
    title: 'لودد فرایز با دیپ چدار و بیکن',
    titleEn: 'Loaded Fries with Cheddar Dip & Bacon',
    descriptionFa: 'سیب‌زمینی سرخ‌شده ترد همراه با سس پنیر چدار داغ، بیکن گوشت ترد و هالاپینو',
    priceToman: 165000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-food-crispy-fries',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-bistro',
    categoryNameFa: 'غذا و اسنک بیسترو',
    categoryNameEn: 'Bistro Food & Gourmet Snacks',
    title: 'سیب‌زمینی سرخ‌کرده با ادویه کیجن',
    titleEn: 'Crispy French Fries with Cajun Spice',
    descriptionFa: 'سیب‌زمینی خلال درشت ترد با ادویه اصیل کیجن و سس کچاپ سیر',
    priceToman: 95000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-food-nachos',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-bistro',
    categoryNameFa: 'غذا و اسنک بیسترو',
    categoryNameEn: 'Bistro Food & Gourmet Snacks',
    title: 'ناچوز مکزیکی با سالسا و دیپ لوبیا',
    titleEn: 'Mexican Nachos with Fresh Salsa',
    descriptionFa: 'چیپس ذرت ترد تنوری با پنیر فراوان، سس سالسای تند و دیپ لوبیا سیاه',
    priceToman: 175000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-food-turkey-croissant',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-bistro',
    categoryNameFa: 'غذا و اسنک بیسترو',
    categoryNameEn: 'Bistro Food & Gourmet Snacks',
    title: 'تست کرواسان بوقلمون دودی و پنیر گودا',
    titleEn: 'Smoked Turkey & Gouda Croissant',
    descriptionFa: 'کرواسان کره‌ای برشته با ژامبون بوقلمون ۹۰٪، پنیر گودای دودی و خردل دیژون',
    priceToman: 155000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },

  // ===========================================================================
  // 3. نوشیدنی‌های بار و ماکتیل (Lounge Drinks & Mocktails)
  // ===========================================================================
  {
    id: 'modendo-drink-strawberry-mojito',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-drinks',
    categoryNameFa: 'نوشیدنی‌های بار و ماکتیل',
    categoryNameEn: 'Bar Beverages & Mocktails',
    title: 'ماکتیل موهیتو توت‌فرنگی تازه',
    titleEn: 'Fresh Strawberry Mojito Mocktail',
    descriptionFa: 'پوره توت‌فرنگی تازه، برگ نعنا فلفلی دست‌کوب، لیمو ترش تازه و سودا',
    priceToman: 95000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-drink-redbull',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-drinks',
    categoryNameFa: 'نوشیدنی‌های بار و ماکتیل',
    categoryNameEn: 'Bar Beverages & Mocktails',
    title: 'نوشابه انرژی‌زا ردبول قوطی ۲۵۰ میلی‌لیتر',
    titleEn: 'Red Bull Energy Drink Can 250ml',
    descriptionFa: 'ردبول اتریشی خنک ویژه شب‌های گیمینگ',
    priceToman: 85000,
    station: 'NO_PREP',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-drink-nutella-shake',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-drinks',
    categoryNameFa: 'نوشیدنی‌های بار و ماکتیل',
    categoryNameEn: 'Bar Beverages & Mocktails',
    title: 'میلک‌شیک نوتلا فندق غلیظ',
    titleEn: 'Thick Nutella Hazelnut Milkshake',
    descriptionFa: 'بستنی خامه‌ای، شکلات نوتلا اصل ایتالیا، شیر تازه و مغز فندق خردشده',
    priceToman: 110000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-drink-peach-iced-tea',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-drinks',
    categoryNameFa: 'نوشیدنی‌های بار و ماکتیل',
    categoryNameEn: 'Bar Beverages & Mocktails',
    title: 'آیس تی هلو و نعنا',
    titleEn: 'Peach & Mint Iced Tea',
    descriptionFa: 'دم‌کرده چای سیاه سیلان خنک با شهد هلوی طبیعی و یخ قالبی',
    priceToman: 80000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-drink-cafe-latte',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-drinks',
    categoryNameFa: 'نوشیدنی‌های بار و ماکتیل',
    categoryNameEn: 'Bar Beverages & Mocktails',
    title: 'کافه لاته مودندو',
    titleEn: 'Modendo Signature Cafe Latte',
    descriptionFa: 'اسپرسو دوبل پرانرژی به همراه فوم شیر نرم',
    priceToman: 90000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-drink-hot-chocolate',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-drinks',
    categoryNameFa: 'نوشیدنی‌های بار و ماکتیل',
    categoryNameEn: 'Bar Beverages & Mocktails',
    title: 'هات چاکلت غلیظ شکلات بلژیکی',
    titleEn: 'Belgian Hot Chocolate',
    descriptionFa: 'ترکیب شیر جوشیده با شکلات تخته‌ای دارک ۷۰٪ کالیبائو',
    priceToman: 95000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },

  // ===========================================================================
  // 4. کیک و دسر (Cakes & Desserts)
  // ===========================================================================
  {
    id: 'modendo-dessert-san-sebastian',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-desserts',
    categoryNameFa: 'کیک و دسر',
    categoryNameEn: 'Cakes & Desserts',
    title: 'چیزکیک سن سباستین با سس شکلات',
    titleEn: 'San Sebastian Burnt Cheesecake',
    descriptionFa: 'چیزکیک سوخته اسپانیایی با بافت کرمی و سس گاناش شکلات داغ',
    priceToman: 120000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modendo-dessert-warm-brownie',
    tenantId: 'tenant-modendo-01',
    categoryId: 'cat-modendo-desserts',
    categoryNameFa: 'کیک و دسر',
    categoryNameEn: 'Cakes & Desserts',
    title: 'براونی گرم شکلاتی با بستنی وانیلی',
    titleEn: 'Warm Fudge Brownie with Vanilla Ice Cream',
    descriptionFa: 'کیک براونی غنی از کاکائو به همراه یک اسکوپ بستنی سنتی وانیلی',
    priceToman: 105000,
    station: 'KITCHEN',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
];
