import { Category, MenuItem, Tenant } from '../types/domain';

export const MODENDO_TENANT: Tenant = {
  id: 'tenant-modendo-01',
  name: 'کافه گیمینگ و بردگیم مودندو',
  currency: 'TOMAN',
  phone: '021-88994455',
  address: 'تهران، خیابان شریعتی، مجتمع مودندو، منفی ۱',
};

const T_ID = MODENDO_TENANT.id;

export const MODENDO_CATEGORIES: Category[] = [
  { id: 'mod-cat-gaming', tenantId: T_ID, nameFa: 'سشن‌های بازی و کنسول PS5', nameEn: 'PS5 & Boardgames', sortOrder: 1, isActive: true },
  { id: 'mod-cat-espresso', tenantId: T_ID, nameFa: 'بار گرم و اسپرسوبار', nameEn: 'Hot Espresso Bar', sortOrder: 2, isActive: true },
  { id: 'mod-cat-mocha', tenantId: T_ID, nameFa: 'موکا و نوشیدنی‌های گرم', nameEn: 'Mocha & Hot Drinks', sortOrder: 3, isActive: true },
  { id: 'mod-cat-tea', tenantId: T_ID, nameFa: 'چای و دمنوش‌های گیمر', nameEn: 'Tea & Infusions', sortOrder: 4, isActive: true },
  { id: 'mod-cat-iced', tenantId: T_ID, nameFa: 'آیس کافی بار', nameEn: 'Iced Coffee Bar', sortOrder: 5, isActive: true },
  { id: 'mod-cat-mocktails', tenantId: T_ID, nameFa: 'بار سرد و ماکتل‌های گیمینگ', nameEn: 'Gaming Mocktails', sortOrder: 6, isActive: true },
  { id: 'mod-cat-shakes', tenantId: T_ID, nameFa: 'شیک‌ها و اسموتی‌ها', nameEn: 'Shakes & Smoothies', sortOrder: 7, isActive: true },
  { id: 'mod-cat-bakery', tenantId: T_ID, nameFa: 'بیکری و صبحانه سبک', nameEn: 'Bakery & Croissants', sortOrder: 8, isActive: true },
  { id: 'mod-cat-burgers', tenantId: T_ID, nameFa: 'برگر، پنینی و اسنک گرم', nameEn: 'Burgers & Panini', sortOrder: 9, isActive: true },
  { id: 'mod-cat-pasta', tenantId: T_ID, nameFa: 'پاستا و غذاهای بیسترو', nameEn: 'Bistro Pasta', sortOrder: 10, isActive: true },
  { id: 'mod-cat-pizza', tenantId: T_ID, nameFa: 'پیتزاهای تنوری مودندو', nameEn: 'Stone-Baked Pizza', sortOrder: 11, isActive: true },
  { id: 'mod-cat-appetizers', tenantId: T_ID, nameFa: 'پیش‌غذا و فینگرفود لانژ', nameEn: 'Lounge Starters', sortOrder: 12, isActive: true },
  { id: 'mod-cat-salads', tenantId: T_ID, nameFa: 'سالادها و کاسه‌های رژیمی', nameEn: 'Salads & Bowls', sortOrder: 13, isActive: true },
  { id: 'mod-cat-desserts', tenantId: T_ID, nameFa: 'کیک و دسرهای دست‌ساز', nameEn: 'Cakes & Desserts', sortOrder: 14, isActive: true },
  { id: 'mod-cat-lounge', tenantId: T_ID, nameFa: 'پکیج ژتون لانژ و تنقلات', nameEn: 'Lounge Tokens & Snacks', sortOrder: 15, isActive: true },
];

const m = (
  id: string,
  categoryId: string,
  nameFa: string,
  nameEn: string,
  priceToman: number,
  options?: Partial<MenuItem>
): MenuItem => ({
  id,
  tenantId: T_ID,
  categoryId,
  nameFa,
  nameEn,
  priceToman,
  isAvailable: true,
  currentStock: 80,
  lowStockThreshold: 8,
  isBean: false,
  ...options,
});

export const MODENDO_MENU_ITEMS: MenuItem[] = [
  // 1. سشن‌های بازی و کنسول PS5 (5)
  m('mod-01', 'mod-cat-gaming', 'کنسول پلی‌استیشن ۵ (ساعتی)', 'PS5 Standard Session (1h)', 180000, { badge: 'PS5 STANDARD', roastLevelText: 'PS5 PRO' }),
  m('mod-02', 'mod-cat-gaming', 'کنسول PS5 با ۴ دسته هم‌زمان', 'PS5 4-Player Session (1h)', 260000, { badge: '۴ دسته', roastLevelText: 'PS5 CO-OP' }),
  m('mod-03', 'mod-cat-gaming', 'ورودی بردگیم (ساعتی / هر نفر)', 'Boardgame Entry (Per Hour)', 50000, { badge: 'بردگیم', roastLevelText: 'BOARDGAME' }),
  m('mod-04', 'mod-cat-gaming', 'رزرو میز VIP گیمینگ (۲ ساعته)', 'VIP Gaming Booth (2h)', 380000, { badge: 'VIP', roastLevelText: 'VIP BOOTH' }),
  m('mod-05', 'mod-cat-gaming', 'پکیج ژتون لانژ (سفارش آزاد)', 'Lounge Token Package', 800000, { badge: 'ژتون لانژ', roastLevelText: 'LOUNGE' }),

  // 2. بار گرم و اسپرسوبار (7)
  m('mod-06', 'mod-cat-espresso', 'اسپرسو سینگل مودندو', 'Modendo Single Espresso', 110000, { badge: 'اسپرسو', roastLevelText: 'SINGLE' }),
  m('mod-07', 'mod-cat-espresso', 'اسپرسو دبل مودندو', 'Modendo Double Espresso', 130000, { badge: 'دبل شات', roastLevelText: 'DOUBLE' }),
  m('mod-08', 'mod-cat-espresso', 'آمریکانو گیمر (بزرگ)', 'Gamer Large Americano', 135000, { badge: 'آمریکانو', roastLevelText: 'LARGE' }),
  m('mod-09', 'mod-cat-espresso', 'کافه لاته مخملی', 'Velvet Caffe Latte', 150000, { badge: 'لاته', roastLevelText: 'MILK BAR' }),
  m('mod-10', 'mod-cat-espresso', 'کاپوچینو ایتالیایی', 'Italian Cappuccino', 150000, { badge: 'کاپوچینو', roastLevelText: 'MILK BAR' }),
  m('mod-11', 'mod-cat-espresso', 'کارامل ماکیاتو ویژه', 'Signature Caramel Macchiato', 165000, { badge: 'کارامل', roastLevelText: 'SIGNATURE' }),
  m('mod-12', 'mod-cat-espresso', 'فلت وایت کلاسیک', 'Classic Flat White', 145000, { roastLevelText: 'ESPRESSO' }),

  // 3. موکا و نوشیدنی‌های گرم (5)
  m('mod-13', 'mod-cat-mocha', 'دارک موکا شکلات بلژیکی', 'Belgian Dark Mocha', 170000, { badge: 'شکلات', roastLevelText: 'DARK COCOA' }),
  m('mod-14', 'mod-cat-mocha', 'وایت موکا وانیلی', 'White Chocolate Mocha', 170000, { roastLevelText: 'WHITE COCOA' }),
  m('mod-15', 'mod-cat-mocha', 'هات چاکلت ایتالیایی غلیظ', 'Thick Italian Hot Chocolate', 165000, { badge: 'پرطرفدار' }),
  m('mod-16', 'mod-cat-mocha', 'ماسالا چای ادویه‌دار', 'Spiced Chai Masala', 140000),
  m('mod-17', 'mod-cat-mocha', 'کرک تی زعفرانی ویژه', 'Saffron Karak Chai', 145000),

  // 4. چای و دمنوش‌های گیمر (5)
  m('mod-18', 'mod-cat-tea', 'چای دمی لاهیجان قوری ۲ نفره با نبات و هل', 'Lahijan Brewed Tea Pot (2P)', 85000, { badge: 'تراس' }),
  m('mod-19', 'mod-cat-tea', 'دمنوش آرامش گیمر (به‌لیمو، بابونه و اسطوخودوس)', 'Gamer Calm Infusion', 95000, { badge: 'دمنوش' }),
  m('mod-20', 'mod-cat-tea', 'دمنوش انرژی‌زا (بهارنارنج، زنجبیل و دارچین)', 'Focus & Energy Herbal Tea', 95000),
  m('mod-21', 'mod-cat-tea', 'چای سبز نعنا مراکشی', 'Moroccan Mint Green Tea', 90000),
  m('mod-22', 'mod-cat-tea', 'دمنوش گل‌گاوزبان و لیموعمانی', 'Borage & Dried Lime Tea', 105000),

  // 5. آیس کافی بار (6)
  m('mod-23', 'mod-cat-iced', 'آیس آمریکانو گیمر', 'Iced Gamer Americano', 140000, { badge: 'آیس' }),
  m('mod-24', 'mod-cat-iced', 'آیس لاته کارامل نمکی', 'Salted Caramel Iced Latte', 165000, { badge: 'ویژه' }),
  m('mod-25', 'mod-cat-iced', 'آیس موکا شکلات تلخ', 'Iced Dark Mocha', 175000),
  m('mod-26', 'mod-cat-iced', 'اسپرسو تونیک پرتقالی', 'Orange Espresso Tonic', 170000),
  m('mod-27', 'mod-cat-iced', 'کلد برو ۲۴ ساعته مودندو', '24h Cold Brew Bottle', 165000),
  m('mod-28', 'mod-cat-iced', 'آفوگاتو وانیل با شات دبل', 'Double Shot Affogato', 175000),

  // 6. بار سرد و ماکتل‌های گیمینگ (6)
  m('mod-29', 'mod-cat-mocktails', 'ماکتل الکتریک گیمر (بلوبری و سودا)', 'Electric Gamer Mocktail', 165000, { badge: 'ویژه گیمینگ' }),
  m('mod-30', 'mod-cat-mocktails', 'موهیتو کراش نعنا لیمو تازه', 'Fresh Mint Crush Mojito', 145000, { badge: 'موهیتو' }),
  m('mod-31', 'mod-cat-mocktails', 'لیموناد رزماری و خیار خنک', 'Cucumber Rosemary Lemonade', 140000),
  m('mod-32', 'mod-cat-mocktails', 'ردبری اسپارکلینگ', 'Red Berry Sparkling', 160000),
  m('mod-33', 'mod-cat-mocktails', 'پاشن‌فروت کولر گیمینگ', 'Passionfruit Cooler', 170000),
  m('mod-34', 'mod-cat-mocktails', 'سان‌رایز انبه و پرتقال تازه', 'Mango Orange Sunrise', 165000),

  // 7. شیک‌ها و اسموتی‌ها (6)
  m('mod-35', 'mod-cat-shakes', 'شیک نوتلا و فندق برشته', 'Nutella Hazelnut Shake', 210000, { badge: 'پرطرفدار' }),
  m('mod-36', 'mod-cat-shakes', 'شیک لوتوس بیسکوف کاراملی', 'Lotus Biscoff Shake', 215000),
  m('mod-37', 'mod-cat-shakes', 'شیک اورئو کرانچ', 'Oreo Crunch Milkshake', 195000),
  m('mod-38', 'mod-cat-shakes', 'شیک کره بادام‌زمینی و موز', 'Peanut Butter Banana Shake', 205000),
  m('mod-39', 'mod-cat-shakes', 'اسموتی توت‌فرنگی و انبه', 'Strawberry Mango Smoothie', 185000),
  m('mod-40', 'mod-cat-shakes', 'اسموتی بری مکس سرد', 'Mixed Berry Smoothie', 190000),

  // 8. بیکری و صبحانه سبک (5)
  m('mod-41', 'mod-cat-bakery', 'کروسان برشته ژامبون و پنیر', 'Toasted Ham & Cheese Croissant', 160000, { badge: 'بیکری' }),
  m('mod-42', 'mod-cat-bakery', 'کروسان ساده کره فرانسوی', 'French Butter Croissant', 115000),
  m('mod-43', 'mod-cat-bakery', 'کروسان شکلاتی نوتلا و فندق', 'Nutella Chocolate Croissant', 145000),
  m('mod-44', 'mod-cat-bakery', 'سیمیت بوقلمون و پنیر خامه‌ای', 'Smoked Turkey Simit', 165000),
  m('mod-45', 'mod-cat-bakery', 'تست آووکادو و تخم‌مرغ پخته', 'Avocado Egg Toast', 195000),

  // 9. برگر، پنینی و اسنک گرم (6)
  m('mod-46', 'mod-cat-burgers', 'برگر پنیر و استیک گرم مودندو', 'Modendo Cheese & Steak Burger', 345000, { badge: 'سرآشپز' }),
  m('mod-47', 'mod-cat-burgers', 'اسمش برگر دوبل گیمینگ', 'Double Smash Gamer Burger', 365000, { badge: 'دوبل' }),
  m('mod-48', 'mod-cat-burgers', 'چیکن کریسپی برگر با سس مخصوص', 'Crispy Chicken Burger', 295000),
  m('mod-49', 'mod-cat-burgers', 'کلاب ساندویچ ویژه گیمر', 'Gamer Special Club Sandwich', 265000),
  m('mod-50', 'mod-cat-burgers', 'پنینی رست بیف و قارچ', 'Roast Beef & Mushroom Panini', 310000),
  m('mod-51', 'mod-cat-burgers', 'پنینی مرغ پستو و موزارلا', 'Chicken Pesto Panini', 275000),

  // 10. پاستا و غذاهای بیسترو (5)
  m('mod-52', 'mod-cat-pasta', 'پاستا آلفردو مرغ و قارچ', 'Chicken Alfredo Pasta', 325000, { badge: 'پاستا' }),
  m('mod-53', 'mod-cat-pasta', 'پاستا پنه پستو ریحان', 'Basil Pesto Penne', 295000),
  m('mod-54', 'mod-cat-pasta', 'پاستا بیف استراگانف ویژه', 'Beef Stroganoff Pasta', 375000),
  m('mod-55', 'mod-cat-pasta', 'فتوچینی بلونز گوشت تازه', 'Beef Bolognese Fettuccine', 340000),
  m('mod-56', 'mod-cat-pasta', 'لازانیا تنوری کلاسیک مودندو', 'Classic Baked Lasagna', 350000),

  // 11. پیتزاهای تنوری مودندو (5)
  m('mod-57', 'mod-cat-pizza', 'پیتزا پپرونی کلاسیک تنوری', 'Classic Pepperoni Pizza', 360000, { badge: 'تنوری' }),
  m('mod-58', 'mod-cat-pizza', 'پیتزا چیکن آلفردو و قارچ', 'Chicken Alfredo Pizza', 355000),
  m('mod-59', 'mod-cat-pizza', 'پیتزا مارگاریتا ناپولی', 'Napoli Margherita Pizza', 295000),
  m('mod-60', 'mod-cat-pizza', 'پیتزا بوقلمون و پیاز کاراملی', 'Smoked Turkey Caramelized Onion Pizza', 345000),
  m('mod-61', 'mod-cat-pizza', 'پیتزا مخصوص سرآشپز مودندو', 'Modendo Chef Special Pizza', 415000, { badge: 'ویژه' }),

  // 12. پیش‌غذا و فینگرفود لانژ (6)
  m('mod-62', 'mod-cat-appetizers', 'سیب‌زمینی سرخ‌کرده با سس چدار و بیکن', 'Loaded Cheddar Bacon Fries', 215000, { badge: 'گروهی' }),
  m('mod-63', 'mod-cat-appetizers', 'سیب‌زمینی ساده با ادویه کیجن', 'Cajun Spiced Fries', 145000),
  m('mod-64', 'mod-cat-appetizers', 'نان سیر تنوری با موزارلا', 'Cheesy Garlic Bread', 165000),
  m('mod-65', 'mod-cat-appetizers', 'فیله استریپس سوخاری (۵ تکه)', 'Crispy Chicken Strips (5pcs)', 265000),
  m('mod-66', 'mod-cat-appetizers', 'قارچ سوخاری با سس تارتار', 'Crispy Mushrooms & Tartar', 175000),
  m('mod-67', 'mod-cat-appetizers', 'بال و کتف اسپایسی بوفالو', 'Buffalo Spicy Chicken Wings', 255000),

  // 13. سالادها و کاسه‌های رژیمی (4)
  m('mod-68', 'mod-cat-salads', 'سالاد سزار با فیله گریل', 'Grilled Chicken Caesar Salad', 285000),
  m('mod-69', 'mod-cat-salads', 'سالاد سبز آووکادو و انار', 'Avocado Pomegranate Green Salad', 245000),
  m('mod-70', 'mod-cat-salads', 'سالاد یونانی کلاسیک', 'Classic Greek Salad', 215000),
  m('mod-71', 'mod-cat-salads', 'پاور بول مرغ و کینوا', 'Chicken Quinoa Power Bowl', 295000),

  // 14. کیک و دسرهای دست‌ساز (5)
  m('mod-72', 'mod-cat-desserts', 'چیزکیک سن سباستین با سس شکلات', 'San Sebastian Cheesecake', 155000, { badge: 'دسر' }),
  m('mod-73', 'mod-cat-desserts', 'تیرامیسو کلاسیک ایتالیایی', 'Classic Italian Tiramisu', 160000),
  m('mod-74', 'mod-cat-desserts', 'کیک شکلاتی دبل فاج', 'Double Fudge Chocolate Cake', 150000),
  m('mod-75', 'mod-cat-desserts', 'پای سیب گرم با بستنی وانیل', 'Warm Apple Pie & Ice Cream', 165000),
  m('mod-76', 'mod-cat-desserts', 'براونی فندقی مودندو', 'Modendo Hazelnut Brownie', 140000),

  // 15. پکیج ژتون لانژ و تنقلات (5)
  m('mod-77', 'mod-cat-lounge', 'پکیج چیپس و دیپ مکزیکی سالسا', 'Nachos & Salsa Dip', 155000),
  m('mod-78', 'mod-cat-lounge', 'بشقاب آجیل و اسنک گیمینگ', 'Gamer Mixed Nuts & Snacks', 220000),
  m('mod-79', 'mod-cat-lounge', 'سرویس چای و باقلوا لانژ', 'Lounge Tea & Baklava Tray', 175000),
  m('mod-80', 'mod-cat-lounge', 'نوشابه قوطی / نوشیدنی انرژی‌زا', 'Can Soda / Energy Drink', 55000),
  m('mod-81', 'mod-cat-lounge', 'آب معدنی کوچک', 'Mineral Water (500ml)', 20000),
];
