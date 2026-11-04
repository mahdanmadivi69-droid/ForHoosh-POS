/**
 * CAFE OS — Seed Catalog: 100 HICH Coffee Roasters (قهوه‌فروشی ۱۰۰هیچ)
 * Tenant ID: tenant-100hich-01
 * Path: src/db/seeds/menu-100hich.ts
 *
 * Menu Profile:
 * - Specialty Espresso Bar (Single origins, cortado, flat white, oat milk)
 * - Slow Brew Bar / Pourover (V60 Geisha, Chemex, Aeropress, Nitro Cold Brew)
 * - Retail Whole Beans (250g and 1kg bags, origin & roast profiling)
 * - Retail Specialty Tea Packs (Golden Tips, Jasmine, Herbal, Chai)
 *
 * Strict Accounting Invariants:
 * - All prices in integer Toman (Number.isInteger(priceToman) === true).
 * - Multi-tenant isolation guaranteed via explicit tenantId on every entity.
 */

import { PrepStation } from '../../modules/smart-orders/types';

export interface SeedMenuItem100Hich {
  id: string;
  tenantId: 'tenant-100hich-01';
  categoryId: string;
  categoryNameFa: string;
  categoryNameEn: string;
  title: string;
  titleEn: string;
  descriptionFa?: string;
  priceToman: number;
  station: PrepStation;
  isAvailable: boolean;
  packageWeightGrams?: number;
  originCountry?: string;
  roastLevel?: 'LIGHT' | 'MEDIUM_LIGHT' | 'MEDIUM' | 'MEDIUM_DARK';
  processMethod?: 'WASHED' | 'NATURAL' | 'ANAEROBIC' | 'HONEY';
  modifiers?: Array<{
    id: string;
    nameFa: string;
    priceDeltaToman: number;
  }>;
  updatedAt: string;
}

export const MENU_SEEDS_100HICH: SeedMenuItem100Hich[] = [
  // ===========================================================================
  // 1. اسپرسوبار تخصصی (Espresso Bar)
  // ===========================================================================
  {
    id: '100hich-esp-single',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'اسپرسو تک‌شات سینگل اوریجین',
    titleEn: 'Single Origin Espresso Shot',
    descriptionFa: 'عصاره‌گیری استاندارد از دانه‌های تک‌خاستگاه با نمایه میوه‌ای و اسیدیته شفاف',
    priceToman: 65000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-esp-double-yirgacheffe',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'اسپرسو دوبل اتیوپی یرگاچف',
    titleEn: 'Double Espresso Ethiopia Yirgacheffe',
    descriptionFa: 'شات دوبل با نت‌های ترنج، یاسمن و شیرینی عسلی',
    priceToman: 85000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-esp-americano',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'آمریکانو تخصصی',
    titleEn: 'Specialty Americano',
    descriptionFa: 'اسپرسو دوبل بر روی آب تصفیه‌شده با دمای ۹۲ درجه سانتی‌گراد',
    priceToman: 75000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-esp-cortado',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'کورتادو',
    titleEn: 'Cortado',
    descriptionFa: 'نسبت ۱ به ۱ اسپرسو دوبل با فوم ابریشمی شیر تازه',
    priceToman: 85000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-esp-flat-white',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'فلت وایت',
    titleEn: 'Flat White',
    descriptionFa: 'دو شات ریسترتو همراه با میکروفوم متراکم و نرم',
    priceToman: 95000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-esp-latte-oat',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'کافه لاته با شیر تازه',
    titleEn: 'Cafe Latte Fresh Milk',
    descriptionFa: 'اسپرسو اسپشالتی با بافت شیر دست‌چین',
    priceToman: 95000,
    station: 'BAR',
    isAvailable: true,
    modifiers: [
      { id: 'mod-oat-milk', nameFa: 'شیر جو دوسر (Oat Milk)', priceDeltaToman: 25000 },
      { id: 'mod-almond-milk', nameFa: 'شیر بادام ارگانیک', priceDeltaToman: 30000 },
      { id: 'mod-extra-shot', nameFa: 'اکسترا شات اسپرسو', priceDeltaToman: 35000 },
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-esp-cappuccino',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-espresso',
    categoryNameFa: 'اسپرسوبار تخصصی',
    categoryNameEn: 'Specialty Espresso Bar',
    title: 'کاپوچینو ایتالیایی کلاسیک',
    titleEn: 'Classic Italian Cappuccino',
    descriptionFa: 'تعادل یکپارچه از اسپرسو، شیر بخارپز و فوم مخملی',
    priceToman: 90000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },

  // ===========================================================================
  // 2. دم‌آوری تخصصی و پوراور (Slow Brew Bar)
  // ===========================================================================
  {
    id: '100hich-brew-v60-geisha',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-pourover',
    categoryNameFa: 'دم‌آوری تخصصی و پوراور',
    categoryNameEn: 'Slow Brew Bar & Filter Coffee',
    title: 'دمی V60 کلمبیا گیشا هیلسیلو',
    titleEn: 'V60 Colombia Geisha Hillsilo',
    descriptionFa: 'قهوه فوق‌العاده با رایحه گل یاس، هلوی سفید و پایانی بسیار کشدار',
    priceToman: 145000,
    station: 'BAR',
    isAvailable: true,
    originCountry: 'Colombia',
    roastLevel: 'LIGHT',
    processMethod: 'WASHED',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-brew-chemex-sidamo',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-pourover',
    categoryNameFa: 'دم‌آوری تخصصی و پوراور',
    categoryNameEn: 'Slow Brew Bar & Filter Coffee',
    title: 'کمکس اتیوپی سیدامو نچرال',
    titleEn: 'Chemex Ethiopia Sidamo Natural',
    descriptionFa: 'عصاره‌گیری تمیز با فیلتر ضخیم کمکس، نت بلوبری و کاکائو',
    priceToman: 135000,
    station: 'BAR',
    isAvailable: true,
    originCountry: 'Ethiopia',
    roastLevel: 'LIGHT',
    processMethod: 'NATURAL',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-brew-aeropress-kenya',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-pourover',
    categoryNameFa: 'دم‌آوری تخصصی و پوراور',
    categoryNameEn: 'Slow Brew Bar & Filter Coffee',
    title: 'ایروپرس کنیا کیامبو AA',
    titleEn: 'Aeropress Kenya Kiambu AA',
    descriptionFa: 'بادی متراکم، اسیدیته آبدار توت سیاه و گوجه‌فرنگی شیرین',
    priceToman: 125000,
    station: 'BAR',
    isAvailable: true,
    originCountry: 'Kenya',
    roastLevel: 'MEDIUM_LIGHT',
    processMethod: 'WASHED',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-brew-kalita-costa-rica',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-pourover',
    categoryNameFa: 'دم‌آوری تخصصی و پوراور',
    categoryNameEn: 'Slow Brew Bar & Filter Coffee',
    title: 'کالیتا ویو کاستاریکا هانی',
    titleEn: 'Kalita Wave Costa Rica Honey',
    descriptionFa: 'استخراج متوازن با کفی تخت، طعم بادام زمینی کاراملی و سیب زرد',
    priceToman: 130000,
    station: 'BAR',
    isAvailable: true,
    originCountry: 'Costa Rica',
    roastLevel: 'MEDIUM_LIGHT',
    processMethod: 'HONEY',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-brew-coldbrew-nitro',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-pourover',
    categoryNameFa: 'دم‌آوری تخصصی و پوراور',
    categoryNameEn: 'Slow Brew Bar & Filter Coffee',
    title: 'کلد برو نیترو ۲۴ ساعته',
    titleEn: 'Nitro Cold Brew 24h Steeped',
    descriptionFa: 'عصاره‌گیری سرد ۲۴ ساعته با تزریق گاز نیتروژن برای ایجاد کفی مخملی گینس‌مانند',
    priceToman: 98000,
    station: 'BAR',
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  },

  // ===========================================================================
  // 3. دانه‌های برشته‌کاری خرده‌فروشی (Retail Whole Beans)
  // ===========================================================================
  {
    id: '100hich-retail-beans-guji-250g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-beans',
    categoryNameFa: 'دانه‌های برشته‌کاری خرده‌فروشی',
    categoryNameEn: 'Retail Coffee Beans Bags',
    title: 'بسته ۲۵۰ گرم دانه اتیوپی گوجی نچرال',
    titleEn: 'Whole Bean Ethiopia Guji Natural 250g',
    descriptionFa: 'برشته‌کاری سبک مخصوص دمی، شیرینی توت‌فرنگی و عطر گل زنبق',
    priceToman: 420000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 250,
    originCountry: 'Ethiopia',
    roastLevel: 'LIGHT',
    processMethod: 'NATURAL',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-retail-beans-paraiso-250g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-beans',
    categoryNameFa: 'دانه‌های برشته‌کاری خرده‌فروشی',
    categoryNameEn: 'Retail Coffee Beans Bags',
    title: 'بسته ۲۵۰ گرم کلمبیا ال‌پارائیسو انیروبیک',
    titleEn: 'Whole Bean Colombia El Paraiso Anaerobic 250g',
    descriptionFa: 'فرآوری بی‌هوازی تجربی با نت میوه‌های استوایی و پشن‌فروت',
    priceToman: 480000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 250,
    originCountry: 'Colombia',
    roastLevel: 'LIGHT',
    processMethod: 'ANAEROBIC',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-retail-beans-kenya-250g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-beans',
    categoryNameFa: 'دانه‌های برشته‌کاری خرده‌فروشی',
    categoryNameEn: 'Retail Coffee Beans Bags',
    title: 'بسته ۲۵۰ گرم کنیا نیری واشد',
    titleEn: 'Whole Bean Kenya Nyeri Washed 250g',
    descriptionFa: 'برشته‌کاری متوسط-روشن با رایحه توت‌فرنگی وحشی و ریواس',
    priceToman: 390000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 250,
    originCountry: 'Kenya',
    roastLevel: 'MEDIUM_LIGHT',
    processMethod: 'WASHED',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-retail-beans-signature-250g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-beans',
    categoryNameFa: 'دانه‌های برشته‌کاری خرده‌فروشی',
    categoryNameEn: 'Retail Coffee Beans Bags',
    title: 'بلند امضا ۱۰۰هیچ (۸۰/۲۰ اسپشیالتی) ۲۵۰ گرم',
    titleEn: '100 HICH Signature Blend 80/20 250g',
    descriptionFa: 'ترکیب برگزیده برزیل سرادو و اتیوپی، کرمای غنی و تلخی شکلاتی لذیذ',
    priceToman: 290000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 250,
    roastLevel: 'MEDIUM',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-retail-beans-signature-1kg',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-beans',
    categoryNameFa: 'دانه‌های برشته‌کاری خرده‌فروشی',
    categoryNameEn: 'Retail Coffee Beans Bags',
    title: 'کیسه ۱ کیلوگرمی بلند اسپرسو ۱۰۰هیچ',
    titleEn: '100 HICH Espresso Blend 1kg Commercial Bag',
    descriptionFa: 'بسته اقتصادی ۱ کیلوگرمی ویژه کافه‌ها و مصرف‌کنندگان خانگی پروپاقرص',
    priceToman: 1120000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 1000,
    roastLevel: 'MEDIUM',
    updatedAt: new Date().toISOString(),
  },

  // ===========================================================================
  // 4. چای و دمنوش‌های تخصصی بسته‌بندی (Retail Specialty Tea Packs)
  // ===========================================================================
  {
    id: '100hich-tea-earlgrey-100g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-tea',
    categoryNameFa: 'چای و دمنوش‌های تخصصی بسته‌بندی',
    categoryNameEn: 'Retail Specialty Teas',
    title: 'چای سیاه ارل گری رزرو زرین ۱۰۰ گرم',
    titleEn: 'Earl Grey Reserve Golden Tips 100g',
    descriptionFa: 'برگ‌های دست‌چین بهاره سیلان با اسانس طبیعی روغن ترنج برگاموت ایتالیایی',
    priceToman: 220000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 100,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-tea-jasmine-100g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-tea',
    categoryNameFa: 'چای و دمنوش‌های تخصصی بسته‌بندی',
    categoryNameEn: 'Retail Specialty Teas',
    title: 'چای سبز شکوفه یاسمن بهاره ۱۰۰ گرم',
    titleEn: 'Jasmine Spring Blossom Green Tea 100g',
    descriptionFa: 'چای سبز ارگانیک معطر شده طبیعی با گل‌های تازه یاسمن',
    priceToman: 240000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 100,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-tea-herbal-relax-100g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-tea',
    categoryNameFa: 'چای و دمنوش‌های تخصصی بسته‌بندی',
    categoryNameEn: 'Retail Specialty Teas',
    title: 'دمنوش آرامش بابونه و اسطوخودوس ۱۰۰ گرم',
    titleEn: 'Chamomile & Lavender Herbal Infusion 100g',
    descriptionFa: 'ترکیب آرام‌بخش گل بابونه، اسطوخودوس فرانسوی، بادرنجبویه و نعنا فلفلی',
    priceToman: 185000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 100,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '100hich-tea-chai-masala-250g',
    tenantId: 'tenant-100hich-01',
    categoryId: 'cat-100hich-retail-tea',
    categoryNameFa: 'چای و دمنوش‌های تخصصی بسته‌بندی',
    categoryNameEn: 'Retail Specialty Teas',
    title: 'چای ماسالا دست‌ساز با ادویه اصیل ۲۵۰ گرم',
    titleEn: 'Handcrafted Authentic Chai Masala 250g',
    descriptionFa: 'پودر چای آسام به همراه دانه‌های کوبیده‌شده هل سبز، دارچین سیلان، زنجبیل و میخک',
    priceToman: 260000,
    station: 'NO_PREP',
    isAvailable: true,
    packageWeightGrams: 250,
    updatedAt: new Date().toISOString(),
  },
];
