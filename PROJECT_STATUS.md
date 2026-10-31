# وضعیت پروژه: SmartOrders POS (PROJECT STATUS)
**تاریخ آخرین به‌روزرسانی:** ۱۰/۰۸/۱۴۰۵  
**پایلوت هدف:** قهوه‌فروشی ۱۰۰هیچ (100 Hich Specialty Coffee Lab)  
**فاز جاری:** فاز ۵ (دیتابیس آفلاین Dexie، کنترل رسپی و موجودی BOM، مودال پین‌کد مدیر، ایزولاسیون پرینت حرارتی ۸۰mm و دپلویمنت خودکار گیت‌هاب)

---

## ۱. وضعیت نیازمندی‌های فاز ۵ و آزمون‌ها (Verification & Test Evidence)
- **پایگاه‌داده آفلاین کلاینت با Dexie (IndexedDB Native Database):** [VERIFIED]
  - پیاده‌سازی کامل دیتابیس لوکال `CafeOS_LocalDB` در `src/db/cafeDb.ts` بر پایه کتابخانه قدرتمند Dexie.
  - تعاریف جامع انواع داده و جداول `inventoryItems`, `menuItems`, `orders`, `auditLogs` در `src/types/db.ts`.
- **موتور تراکنشی مدیریت سفارش و کسر رسپی انبار (BOM Recipe Engine):** [VERIFIED]
  - پیاده‌سازی سرویس `src/services/orderService.ts` با کسر اتمیک مواد اولیه در تراکنش‌های `db.transaction('rw', ...)`.
  - کسر آنی متریال هنگام انتقال سفارش به `sent_to_bar` یا `settled`.
  - بازگشت خودکار مواد اولیه مصرفی به موجودی انبار در صورت ابطال سفارش (`voided`).
  - ثبت جزئیات دقیق تمامی ویرایش‌ها و علل تغییرات در جدول `auditLogs`.
- **مودال تایید پین‌کد مدیر و ابطال ایمن فاکتور (`OrderActionModal`):** [VERIFIED]
  - پیاده‌سازی کامپوننت `src/components/OrderActionModal.tsx` مجهز به کنترل پین‌کد مدیر (پیش‌فرض: `1234`).
  - الزام ورود فیلد «علت ابطال/ویرایش» برای ثبت در زنجیره حسابرسی امنیتی و انبارداری.
  - بازخورد صوتی و پیام‌های استاندارد خطا و موفقیت.
- **ایزولاسیون کامل چاپ حرارتی ۸۰ میلی‌متری (Zero Viewport Leakage):** [VERIFIED]
  - ایجاد کامپوننت اتمیک `src/components/ReceiptPrintTemplate.tsx` منطبق با ابعاد رول حرارتی ۸۰mm و فاکتور رسمی ۱۰۰هیچ.
  - بازنویسی سرویس `src/services/receiptPrinter.ts` بر پایه سندباکس IFrame ایزوله بدون کوچک‌ترین نشت المان‌های UI (کاتالوگ ۷۵ آیتمی، وضعیت بویلرها و نمودارها).
  - حذف قطعی متد پیش‌فرض `window.print()` و اعمال استایل‌های محکم `@media print` در `src/index.css`.
- **کانفیگ PWA و کش استاتیک و پایپ‌لاین گیت‌هاب Actions:** [VERIFIED]
  - پیکربندی مانیفست اختصاصی کافه ۱۰۰هیچ با تم رنگی `#0F223D` و بک‌گراند `#121417` در `vite.config.ts`.
  - تنظیم کش کامل `workbox.globPatterns` برای کلیه فایل‌های استاتیک، فونت‌ها و اسکریپت‌ها.
  - ایجاد پایپ‌لاین CI/CD در مسیر `.github/workflows/deploy.yml` جهت اعتبارسنجی کیفیت و دپلوی خودکار PWA روی GitHub Pages.
- **سرویس پایگاه‌داده اتمیک PostgreSQL با Row-Level Security (Multi-Tenant RLS):** [VERIFIED]
  - پیاده‌سازی `src/services/dbOrderService.ts` با سیاست‌های امنیتی RLS بر پایه `SET LOCAL app.current_tenant_id = $1`.
  - جلوگیری قطعی از تکرار فاکتور با بررسی و ثبت کلیدهای Idempotency در جدول `idempotency_keys` بر اساس `clientGeneratedId` (UUIDv4).
  - الزام قطعی مقادیر صحیح تومانی (`Number.isInteger() === true`) و منع مطلق اعداد اعشاری (Float).
- **موتور کش آفلاین کلاینت با IndexedDB (Offline-First Queue):** [VERIFIED]
  - پیاده‌سازی کامل کلاس `OfflineSyncQueue` در دیتابیس `CafeOS_OfflineDB` و مخزن `order_queue`.
  - وضعیت‌های صف `PENDING` ،`SYNCING` و `FAILED` با استراتژی تلاش مجدد تصاعدی و ارسال با هدرهای استاندارد `X-Tenant-Id` و `Idempotency-Key`.
  - اشتراک واکنشی (Reactive Subscription) وضعیت صف در هدر و بنر اعلان صندوق فروش.
- **کنترلر همگام‌سازی و برودکست وب‌سوکت بلادرنگ (Sync Controller & WebSocket Server):** [VERIFIED]
  - پیاده‌سازی `src/services/sync-controller.ts` مجهز به `handleOrderSync` برای هندل درخواست‌های همگام‌سازی فرانت‌اند و تطبیق ساختار پی‌لودها.
  - پیاده‌سازی سرور وب‌سوکت چندمستأجره `src/services/websocket-server.ts` با متدهای تفکیک‌شده `broadcastToTenant` و `broadcastToRole` و هماهنگی بین‌تبی از طریق `BroadcastChannel`.
  - ارسال بلادرنگ رویداد `INVENTORY_STOCKOUT_ALERT` به کلاینت‌های مستأجر (صفحه باریستا جهت ۸۶ کردن سریع اقلام کسری).
  - ارسال بلادرنگ رویداد `AUDIT_DISCREPANCY_CREATED` به نقش مدیریت (MANAGER جهت ایجاد کارت‌های مغایرت در گزارش حسابرسی روزانه).
- **نمایشگر بار باریستا و اعلان ۸۶ شدن اقلام (Barista Bar KDS & 86 Alerts):** [VERIFIED]
  - ماژول `src/services/baristaDispatcher.ts` برای تفکیک مودیفایرها و ارسال وضعیت فاکتورهای تسویه‌شده (`PAID`).
  - پخش صدای زنگ دوصدائه اختصاصی کافه با Web Audio API بدون فایل صوتی خارجی.
  - بنر اخطار اتمام موجودی روی KDS با دکمه ۱-لمسی «۸۶ کردن آیتم در منو» و برچسب‌گذاری زنده روی اقلام تیکت‌ها.
- **سامانه ردپای حسابرسی و کارت‌های مغایرت کسری انبار (Shift Manager Discrepancy Audit):** [VERIFIED]
  - پنل `AuditLogView` مجهز به اشتراک وب‌سوکت `AUDIT_DISCREPANCY_CREATED` و نمایش کارت‌های اختصاصی کسری همگام‌سازی آفلاین.
  - تفکیک وضعیت مغایرت، مقدار کسری فیزیکی، زمان رخ‌داد، و دکمه تایید و تسویه سند اصلاحیه انبار.
- **یکپارچه‌سازی سخت‌افزاری چاپگر حرارتی ۸۰ میلی‌متری (ESC/POS Raster):** [VERIFIED]
  - پیاده‌سازی درایور بدون واسط `src/services/escposThermalPrinter.ts` سازگار با WebUSB و Web Bluetooth.
  - رندر فاکتور روی Canvas با عرض استاندارد ۵۷۶ نقطه و تبدیل پیکسل‌ها به بایت‌های خام بیت‌مپ ESC/POS با فرمان `GS v 0` و برش خودکار کاغذ.
- **بک‌اند فول‌استک Express روی پورت ۳۰۰۰:** [VERIFIED]
  - فایل `server.ts` مجهز به روت‌های `/api/v1/orders/sync`، `/api/v1/sync/orders`، `/api/v1/barista/incoming` و `/api/v1/barista/tickets`.
- **هندلر همگام‌سازی و حل تضاد موجودی (Inventory Overdraft & Audit Logging):** [VERIFIED]
  - پیاده‌سازی `src/services/sync-order-handler.ts` جهت پردازش تراکنشی `processOfflineOrderSync`.
  - عدم توقف ثبت مالی فیش‌های آفلاین، اجازه منفی شدن موجودی (`allowNegative: true`) جهت تطابق با واقعیت فیزیکی بار، و ثبت رخداد `STOCKOUT_OVERDRAFT` در لاگ حسابرسی انباردار همراه با میزان کسری (`deficit`).

- **خروجی استاندارد فایل اکسل و CSV برای حسابداری و امور مالی (Orders & Expenses CSV Export):** [VERIFIED]
  - پیاده‌سازی متدهای `generateOrdersCSV` ،`downloadOrdersCSV` ،`generateExpensesCSV` و `downloadExpensesCSV` با رعایت استاندارد RFC 4180.
  - کدگذاری UTF-8 BOM (`\uFEFF`) جهت تضمین خوانایی و نمایش صحیح بدون به‌هم‌ریختگی حروف فارسی در Microsoft Excel.
  - قالب‌بندی بدون کوتیشن اعداد جهت پشتیبانی از محاسبات فرمولی اکسل (`=SUM(...)`)، سطرهای خلاصه تفکیک‌شده (تفکیک کسر از نقد و غیرنقدی) و نام‌گذاری استاندارد فایل‌ها.
  - دکمه‌های مستقیم استخراج در نوار ابزار بالای گزارشات، جدول سوابق فاکتورها، و پنل هزینه‌های ثبت‌شده شیفت.

- **کارت محاسباتی خلاصه سود عملیاتی شیفت (Shift Profit Summary Card):** [VERIFIED]
  - پیاده‌سازی متد `calculateShiftProfit` با رعایت اصل محاسبات بدون اعشار تومانی (`Number.isInteger() === true`).
  - کسر دقیق هزینه‌های ثبت‌شده شیفت از درآمد خالص سفارشات تسویه‌شده (`Net Order Revenue - Total Recorded Expenses`).
  - نمایش کارت اختصاصی شاخص‌های مالی ۵گانه در پنل `ReportsView` با رنگ‌بندی متناسب با سودآوری (زمردی برای سود، یاقوتی برای زیان) و درصد حاشیه سود خالص شیفت.

---

## ۲. گزارش اجرای دستورات و نتایج اعتبارسنجی (Tests & Build Output)
- **دستور تست خودکار (`npm test` -> `tsx tests/financialMath.test.ts`):**  
  `161 Passed, 0 Failed` (۱۴ مجموعه آزمون جامع، خروجی کد 0)
- **بررسی صحت تایپ و نحو (`npm run lint` -> `tsc --noEmit`):**  
  `Zero TypeScript Errors` (خروجی کد 0)
- **کامپایل نهایی بیلد (`compile_applet`):**  
  `Build succeeded`

