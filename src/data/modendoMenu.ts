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
  { id: 'mod-cat-bakery', tenantId: T_ID, nameFa: 'صبحانه', nameEn: 'Breakfast', sortOrder: 1, isActive: true },
  { id: 'mod-cat-gaming', tenantId: T_ID, nameFa: 'بازی', nameEn: 'Boardgames & Events', sortOrder: 2, isActive: true },
  { id: 'mod-cat-mocktails', tenantId: T_ID, nameFa: 'نوشیدنی', nameEn: 'Beverages', sortOrder: 3, isActive: true },
  { id: 'mod-cat-tea', tenantId: T_ID, nameFa: 'نوشیدنی گرم', nameEn: 'Hot Drinks', sortOrder: 4, isActive: true },
  { id: 'mod-cat-shakes', tenantId: T_ID, nameFa: 'شیک', nameEn: 'Shakes', sortOrder: 5, isActive: true },
  { id: 'mod-cat-espresso', tenantId: T_ID, nameFa: 'قهوه', nameEn: 'Coffee', sortOrder: 6, isActive: true },
  { id: 'mod-cat-mocha', tenantId: T_ID, nameFa: 'نوشیدنی سرد', nameEn: 'Cold Drinks & Mocktails', sortOrder: 7, isActive: true },
  { id: 'mod-cat-iced', tenantId: T_ID, nameFa: 'قهوه سرد', nameEn: 'Iced Coffee', sortOrder: 8, isActive: true },
  { id: 'mod-cat-appetizers', tenantId: T_ID, nameFa: 'استارتر', nameEn: 'Starters & Fries', sortOrder: 9, isActive: true },
  { id: 'mod-cat-desserts', tenantId: T_ID, nameFa: 'دسر', nameEn: 'Desserts & Cakes', sortOrder: 10, isActive: true },
  { id: 'mod-cat-salads', tenantId: T_ID, nameFa: 'ساندویچ', nameEn: 'Sandwiches', sortOrder: 11, isActive: true },
  { id: 'mod-cat-pasta', tenantId: T_ID, nameFa: 'بشقاب', nameEn: 'Platters & Pasta', sortOrder: 12, isActive: true },
  { id: 'mod-cat-pizza', tenantId: T_ID, nameFa: 'پیتزا', nameEn: 'Stone-Baked Pizza', sortOrder: 13, isActive: true },
  { id: 'mod-cat-burgers', tenantId: T_ID, nameFa: 'برگر', nameEn: 'Burgers', sortOrder: 14, isActive: true },
  { id: 'mod-cat-packaging', tenantId: T_ID, nameFa: 'ظروف بسته بندی', nameEn: 'Packaging', sortOrder: 15, isActive: true },
  { id: 'mod-cat-lounge', tenantId: T_ID, nameFa: 'گیم نت', nameEn: 'PS5 Game Net', sortOrder: 16, isActive: true },
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
  // 1. صبحانه (KITCHEN) — 7 items
  m('mod-item-001', 'mod-cat-bakery', 'صبحانه انگلیسی', 'English Breakfast', 690000, { station: 'KITCHEN', description: 'صبحانه انگلیسی' }),
  m('mod-item-002', 'mod-cat-bakery', 'املت گوجه', 'Tomato Omelet', 340000, { station: 'KITCHEN', description: 'املت گوجه' }),
  m('mod-item-003', 'mod-cat-bakery', 'چوریتسو املت', 'Chorizo Omelet', 550000, { station: 'KITCHEN', description: 'چوریتسو املت' }),
  m('mod-item-004', 'mod-cat-bakery', 'املت ربی', 'Tomato Paste Omelet', 320000, { station: 'KITCHEN', description: 'املت ربی' }),
  m('mod-item-005', 'mod-cat-bakery', 'املت قارچ و زیتون', 'Mushroom & Olive Omelet', 340000, { station: 'KITCHEN', description: 'املت قارچ و زیتون' }),
  m('mod-item-006', 'mod-cat-bakery', 'نیمرو', 'Fried Eggs', 290000, { station: 'KITCHEN', description: 'نیمرو' }),
  m('mod-item-007', 'mod-cat-bakery', 'کوکو سیب زمینی', 'Potato Kuku', 340000, { station: 'KITCHEN', description: 'کوکو سیب زمینی' }),

  // 2. بازی (BAR / Counter) — 7 items
  m('mod-item-008', 'mod-cat-gaming', 'تماشای مسابقات فوتبال', 'Football Match Screening', 100000, { station: 'BAR', description: 'تماشای فوتبال' }),
  m('mod-item-009', 'mod-cat-gaming', 'بازی بعد از 2 ساعت', 'Game After 2 Hours', 50000, { station: 'BAR', description: 'بازی بعد از دو ساعت' }),
  m('mod-item-010', 'mod-cat-gaming', 'بازی بردگیم', 'Boardgame Session', 200000, { station: 'BAR', description: 'بازی های سبک تا 2 ساعت' }),
  m('mod-item-011', 'mod-cat-gaming', 'بازی سنگین', 'Heavy Boardgame Session', 300000, { station: 'BAR', description: 'بازی های سنگین' }),
  m('mod-item-012', 'mod-cat-gaming', 'مافیا ریگان', 'Mafia Reagan', 150000, { station: 'BAR', description: 'سه شنبه و جمعه' }),
  m('mod-item-013', 'mod-cat-gaming', 'بازی قبل مافیا', 'Pre-Mafia Game', 60000, { station: 'BAR', description: 'تخته' }),
  m('mod-item-014', 'mod-cat-gaming', 'مافیا سالواتوره', 'Mafia Salvatore', 100000, { station: 'BAR', description: 'دوشنبه و پنجشنبه' }),

  // 3. نوشیدنی (BAR) — 7 items
  m('mod-item-015', 'mod-cat-mocktails', 'انرژی زا', 'Energy Drink', 140000, { station: 'BAR', description: 'انرژی زا' }),
  m('mod-item-016', 'mod-cat-mocktails', 'دلستر نوستالژی', 'Classic Malt Delster', 160000, { station: 'BAR', description: 'دلستر نوستالژی' }),
  m('mod-item-017', 'mod-cat-mocktails', 'دوغ', 'Doogh', 120000, { station: 'BAR', description: 'دوغ' }),
  m('mod-item-018', 'mod-cat-mocktails', 'کوکا لیوانی', 'Glass Coca-Cola', 70000, { station: 'BAR', description: 'کوکا لیوانی' }),
  m('mod-item-019', 'mod-cat-mocktails', 'نوشابه قوطی زیرو', 'Can Soda Zero', 150000, { station: 'BAR', description: 'نوشابه قوطی زیرو' }),
  m('mod-item-020', 'mod-cat-mocktails', 'نوشابه قوطی', 'Can Soda', 130000, { station: 'BAR', description: 'نوشابه قوطی' }),
  m('mod-item-021', 'mod-cat-mocktails', 'آب معدنی', 'Mineral Water', 35000, { station: 'BAR', description: 'آب معدنی' }),

  // 4. نوشیدنی گرم (BAR) — 3 items
  m('mod-item-022', 'mod-cat-tea', 'چای', 'Brewed Tea', 135000, { station: 'BAR', description: 'چای سیاه دمی، نبات' }),
  m('mod-item-023', 'mod-cat-tea', 'هات چاکلت', 'Hot Chocolate', 280000, { station: 'BAR', description: 'شیر، پودر هات چاکلت' }),
  m('mod-item-024', 'mod-cat-tea', 'ماسالا', 'Chai Masala', 290000, { station: 'BAR', description: 'شیر، پودر چای ماسالا' }),

  // 5. شیک (BAR) — 5 items
  m('mod-item-025', 'mod-cat-shakes', 'شیک وانیل', 'Vanilla Shake', 370000, { station: 'BAR', description: 'بستنی وانیل، شیر، تاپینگ خامه' }),
  m('mod-item-026', 'mod-cat-shakes', 'شیک شکلات', 'Chocolate Shake', 390000, { station: 'BAR', description: 'بستنی شکلات، سس شکلات، شیر، تاپینگ خامه' }),
  m('mod-item-027', 'mod-cat-shakes', 'شیک لوتوس', 'Lotus Shake', 460000, { station: 'BAR', description: 'بستنی وانیل، کرم بیسکوییت لوتوس، شیر، تاپینگ خامه' }),
  m('mod-item-028', 'mod-cat-shakes', 'شیک کرنبری', 'Cranberry Shake', 410000, { station: 'BAR', description: 'بستنی وانیل، سیروپ کرنبری، آب آلبالو، شیر، تاپینگ خامه' }),
  m('mod-item-029', 'mod-cat-shakes', 'شیک بلوبری', 'Blueberry Shake', 390000, { station: 'BAR', description: 'شیک بلوبری' }),

  // 6. قهوه (BAR) — 6 items
  m('mod-item-030', 'mod-cat-espresso', 'اسپرسو', 'Espresso', 230000, { station: 'BAR', description: 'دبل شات 70/30 عربیکا' }),
  m('mod-item-031', 'mod-cat-espresso', 'آمریکانو', 'Americano', 230000, { station: 'BAR', description: 'آمریکانو' }),
  m('mod-item-032', 'mod-cat-espresso', 'کاپوچینو', 'Cappuccino', 300000, { station: 'BAR', description: 'اسپرسو، شیر' }),
  m('mod-item-033', 'mod-cat-espresso', 'لته', 'Caffe Latte', 320000, { station: 'BAR', description: 'اسپرسو، شیر' }),
  m('mod-item-034', 'mod-cat-espresso', 'کارامل ماکیاتو', 'Caramel Macchiato', 380000, { station: 'BAR', description: 'اسپرسو، شیر، سیروپ کارامل' }),
  m('mod-item-035', 'mod-cat-espresso', 'موکا', 'Caffe Mocha', 390000, { station: 'BAR', description: 'اسپرسو، شیر، سس شکلات' }),

  // 7. نوشیدنی سرد (BAR) — 9 items
  m('mod-item-036', 'mod-cat-mocha', 'سولاریس', 'Solaris', 360000, { station: 'BAR', description: 'سیروپ کرنبری، آب هلو، آب پرتقال، لیمو، سودا' }),
  m('mod-item-037', 'mod-cat-mocha', 'جانگل وایب', 'Jungle Vibe', 330000, { station: 'BAR', description: 'سیروپ پشن فروت، سیروپ نعنا، آب لیمو و سودا' }),
  m('mod-item-038', 'mod-cat-mocha', 'موهیتو 22', 'Mojito 22', 330000, { station: 'BAR', description: 'لیمو، نعنا، سیروپ لیمو، سودا' }),
  m('mod-item-039', 'mod-cat-mocha', 'لاکی لمون', 'Lucky Lemon', 310000, { station: 'BAR', description: 'لیموناد' }),
  m('mod-item-040', 'mod-cat-mocha', 'رد فلگ', 'Red Flag', 340000, { station: 'BAR', description: 'سیروپ کرنبری، توت فرنگی، آب آلبالو، لیمو، نمک، سودا' }),
  m('mod-item-041', 'mod-cat-mocha', 'اکسترا لایف', 'Extra Life', 350000, { station: 'BAR', description: 'سیروپ بلوکاراسائو، سیروپ نارگیل، آب آناناس، آب پرتقال، لیمو، سودا' }),
  m('mod-item-042', 'mod-cat-mocha', 'ویولت', 'Violet', 330000, { station: 'BAR', description: 'سیروپ توت فرنگی، سیروپ بلوکاراسائو، لیمو، سودا' }),
  m('mod-item-043', 'mod-cat-mocha', 'آب زرشک آلبالو', 'Barberry Sour Cherry Juice', 285000, { station: 'BAR', description: 'آب زرشک آلبالو' }),
  m('mod-item-044', 'mod-cat-mocha', 'سوییت ویکتوری', 'Sweet Victory', 350000, { station: 'BAR', description: 'سیروپ پشن فروت، سیروپ توت فرنگی، آب انبه، آب پرتقال، لیمو، سودا' }),

  // 8. قهوه سرد (BAR) — 6 items
  m('mod-item-045', 'mod-cat-iced', 'آیس آمریکانو', 'Iced Americano', 230000, { station: 'BAR', description: 'اسپرسو، آب، یخ' }),
  m('mod-item-046', 'mod-cat-iced', 'آیس لته', 'Iced Latte', 340000, { station: 'BAR', description: 'اسپرسو، شیر، یخ' }),
  m('mod-item-047', 'mod-cat-iced', 'آیس کارامل ماکیاتو', 'Iced Caramel Macchiato', 390000, { station: 'BAR', description: 'اسپرسو، شیر، سیروپ کارامل، یخ' }),
  m('mod-item-048', 'mod-cat-iced', 'آیس موکا', 'Iced Mocha', 410000, { station: 'BAR', description: 'اسپرسو، شیر، سس شکلات، یخ' }),
  m('mod-item-049', 'mod-cat-iced', 'اورنج اسپرسو', 'Orange Espresso', 350000, { station: 'BAR', description: 'اسپرسو، آب پرتقال، یخ' }),
  m('mod-item-050', 'mod-cat-iced', 'آفوگاتو', 'Affogato', 350000, { station: 'BAR', description: 'اسپرسو، بستنی وانیل' }),

  // 9. استارتر (KITCHEN) — 6 items
  m('mod-item-051', 'mod-cat-appetizers', 'سالاد سزار استیک', 'Steak Caesar Salad', 970000, { station: 'KITCHEN', description: 'سالاد سزار استیک' }),
  m('mod-item-052', 'mod-cat-appetizers', 'سالاد سزار با مرغ گریل', 'Grilled Chicken Caesar Salad', 750000, { station: 'KITCHEN', description: 'سالاد سزار با مرغ گریل' }),
  m('mod-item-053', 'mod-cat-appetizers', 'فرنچ فرایز با دیپ آلفردو', 'French Fries with Alfredo Dip', 420000, { station: 'KITCHEN', description: 'فرنچ فرایز با دیپ آلفردو' }),
  m('mod-item-054', 'mod-cat-appetizers', 'فرنچ فرایز با دیپ سالسا', 'French Fries with Salsa Dip', 390000, { station: 'KITCHEN', description: 'فرنچ فرایز با دیپ سالسا' }),
  m('mod-item-055', 'mod-cat-appetizers', 'فرنچ فرایز با دیپ گودا', 'French Fries with Gouda Dip', 420000, { station: 'KITCHEN', description: 'فرنچ فرایز با دیپ گودا' }),
  m('mod-item-056', 'mod-cat-appetizers', 'فرنچ فرایز ساده', 'Classic French Fries', 320000, { station: 'KITCHEN', description: 'فرنچ فرایز ساده' }),

  // 10. دسر (BAR) — 3 items
  m('mod-item-057', 'mod-cat-desserts', 'کیک روز', 'Cake of the Day', 240000, { station: 'BAR', description: 'کیک روز' }),
  m('mod-item-058', 'mod-cat-desserts', 'رد ولوت', 'Red Velvet Cake', 290000, { station: 'BAR', description: 'کیک رد ولوت' }),
  m('mod-item-059', 'mod-cat-desserts', 'چیز کیک سن سباستین', 'San Sebastian Cheesecake', 290000, { station: 'BAR', description: 'چیز کیک' }),

  // 11. ساندویچ (KITCHEN) — 4 items
  m('mod-item-060', 'mod-cat-salads', 'ژامبون تنوری', 'Baked Ham Sandwich', 690000, { station: 'KITCHEN', description: 'ژامبون تنوری' }),
  m('mod-item-061', 'mod-cat-salads', 'ساندویچ چیکن باربیکیو', 'BBQ Chicken Sandwich', 680000, { station: 'KITCHEN', description: 'ساندویچ چیکن باربیکیو' }),
  m('mod-item-062', 'mod-cat-salads', 'ساندویچ رست بیف', 'Roast Beef Sandwich', 895000, { station: 'KITCHEN', description: 'رست بیف' }),
  m('mod-item-063', 'mod-cat-salads', 'پاسترامی', 'Pastrami Sandwich', 975000, { station: 'KITCHEN', description: 'پاسترامی' }),

  // 12. بشقاب (KITCHEN) — 5 items
  m('mod-item-064', 'mod-cat-pasta', 'ساسج لاورز', 'Sausage Lovers Platter', 885000, { station: 'KITCHEN', description: 'ساسج لاورز' }),
  m('mod-item-065', 'mod-cat-pasta', 'پاستا مارگاریتا', 'Pasta Margherita', 750000, { station: 'KITCHEN', description: 'پاستا مارگاریتا' }),
  m('mod-item-066', 'mod-cat-pasta', 'پاستا آلفردو', 'Pasta Alfredo', 790000, { station: 'KITCHEN', description: 'پاستا آلفردو' }),
  m('mod-item-067', 'mod-cat-pasta', 'سبزیجات گرم', 'Warm Veggies Platter', 590000, { station: 'KITCHEN', description: 'سبزیجات گرم' }),
  m('mod-item-068', 'mod-cat-pasta', 'چیکن استیک', 'Chicken Steak Platter', 890000, { station: 'KITCHEN', description: 'چیکن استیک' }),

  // 13. پیتزا (KITCHEN) — 7 items
  m('mod-item-069', 'mod-cat-pizza', 'پپرونی', 'Pepperoni Pizza', 730000, { station: 'KITCHEN', description: 'پپرونی' }),
  m('mod-item-070', 'mod-cat-pizza', 'چیکن', 'Chicken Pizza', 850000, { station: 'KITCHEN', description: 'چیکن' }),
  m('mod-item-071', 'mod-cat-pizza', 'پیتزا کلاسیک', 'Classic Pizza', 940000, { station: 'KITCHEN', description: 'پیتزا کلاسیک' }),
  m('mod-item-072', 'mod-cat-pizza', 'میت بال', 'Meatball Pizza', 1035000, { station: 'KITCHEN', description: 'میت بال' }),
  m('mod-item-073', 'mod-cat-pizza', 'بیکن', 'Bacon Pizza', 1050000, { station: 'KITCHEN', description: 'بیکن' }),
  m('mod-item-074', 'mod-cat-pizza', 'رست بیف', 'Roast Beef Pizza', 1130000, { station: 'KITCHEN', description: 'رست بیف' }),
  m('mod-item-075', 'mod-cat-pizza', 'سیر و استیک', 'Garlic & Steak Pizza', 1320000, { station: 'KITCHEN', description: 'سیر و استیک' }),

  // 14. برگر (KITCHEN) — 5 items
  m('mod-item-076', 'mod-cat-burgers', 'بیکن برگر', 'Bacon Burger', 1170000, { station: 'KITCHEN', description: 'Bacon Burger' }),
  m('mod-item-077', 'mod-cat-burgers', 'چوریتسو برگر', 'Chorizo Burger', 1190000, { station: 'KITCHEN', description: 'چوریتسو برگر' }),
  m('mod-item-078', 'mod-cat-burgers', 'مایتی برگر', 'Mighty Burger', 1470000, { station: 'KITCHEN', description: 'Mighty Burger' }),
  m('mod-item-079', 'mod-cat-burgers', 'چیز برگر', 'Cheese Burger', 870000, { station: 'KITCHEN', description: 'چیز برگر' }),
  m('mod-item-080', 'mod-cat-burgers', 'کلاسیک برگر', 'Classic Burger', 790000, { station: 'KITCHEN', description: 'کلاسیک برگر' }),

  // 15. ظروف بسته بندی (KITCHEN / Packaging) — 2 items
  m('mod-item-081', 'mod-cat-packaging', 'ظرف بسته بندی 2', 'Takeaway Packaging 2', 30000, { station: 'KITCHEN', description: 'ظرف بیرون بر' }),
  m('mod-item-082', 'mod-cat-packaging', 'ظرف بسته بندی 1', 'Takeaway Packaging 1', 40000, { station: 'KITCHEN', description: 'ظرف بیرون بر' }),

  // 16. گیم نت (BAR / Counter) — 7 items
  m('mod-item-083', 'mod-cat-lounge', 'پی اس 5 3 دسته 12 شب', 'PS5 3-Controller (Midnight)', 400000, { station: 'BAR', description: 'پی اس 5 3 دسته 12 شب' }),
  m('mod-item-084', 'mod-cat-lounge', 'پی اس 5 4 دسته 12 شب', 'PS5 4-Controller (Midnight)', 470000, { station: 'BAR', description: 'پی اس 5 4 دسته 12 شب' }),
  m('mod-item-085', 'mod-cat-lounge', 'پی اس 5 2 دسته 12 شب', 'PS5 2-Controller (Midnight)', 340000, { station: 'BAR', description: 'پی اس 5 2 دسته 12 شب' }),
  m('mod-item-086', 'mod-cat-lounge', 'پی اس 5 سه دسته', 'PS5 3-Controller Standard', 350000, { station: 'BAR', description: 'پی اس 5 سه دسته' }),
  m('mod-item-087', 'mod-cat-lounge', 'پی اس 5 چهار دسته', 'PS5 4-Controller Standard', 420000, { station: 'BAR', description: 'پی اس 5 چهار دسته' }),
  m('mod-item-088', 'mod-cat-lounge', 'پی اس 5 یک و دو دسته', 'PS5 1-2 Controller Standard', 290000, { station: 'BAR', description: 'پی اس 5 یک و دو دسته' }),
  m('mod-item-089', 'mod-cat-lounge', 'پی اس نیم ساعت', 'PS5 Half Hour Session', 145000, { station: 'BAR', description: 'نیم ساعت' }),
];
