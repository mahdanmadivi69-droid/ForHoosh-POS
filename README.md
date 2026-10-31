# SmartOrders POS (اسمارت‌اوردرز) - کافه ۱۰۰هیچ

[![CI & Deploy Quality Gate](https://github.com/mahdanmadivi69-droid/ForHoosh-POS/actions/workflows/deploy.yml/badge.svg)](https://github.com/mahdanmadivi69-droid/ForHoosh-POS/actions/workflows/deploy.yml)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20First-0F223D.svg)](https://mahdanmadivi69-droid.github.io/ForHoosh-POS)
[![Tests](https://img.shields.io/badge/Financial%20Math%20Tests-161%20Passed-emerald.svg)](./tests/financialMath.test.ts)

> **سامانه ابری و آفلاین مدیریت صندوق (POS)، شیفت و امور مالی اختصاصی کافه ۱۰۰هیچ (100 Hich Coffee Roasters)**
> 
> **آدرس دپلوی زنده وب‌اپلیکیشن (PWA):**  
> 🔗 [https://mahdanmadivi69-droid.github.io/ForHoosh-POS/](https://mahdanmadivi69-droid.github.io/ForHoosh-POS/)

---

## خلاصه پروژه (Project Summary)
اسمارت‌اوردرز یک سامانه صندوق، مدیریت شیفت، کنترل انبار و سفارش‌گیری صنعتی متمرکز بر کافه‌های تخصصی است. این سیستم مجهز به پایگاه‌داده آفلاین کلاینت، پشتیبانی بدون واسط از چاپگرهای حرارتی ۸۰ میلی‌متری (ESC/POS و IFrame Sandbox)، کنترل رسپی (BOM) برای کسر متریال اولیه و سیستم حسابرسی امنیتی با پین‌کد مدیر است.

---

## ویژگی‌های کلیدی
1. **دقت محاسباتی مالی بدون ممیز شناور (Zero-Float Precision):** کلیه محاسبات در واحد تومانی به‌صورت اعداد صحیح قطعی (`Number.isInteger() === true`) انجام می‌شود.
2. **پایگاه‌داده آفلاین محلی (Dexie / IndexedDB):** ثبت و نگهداری کلیه تراکنش‌ها، سفارش‌ها، منوها و لاگ‌ها در دیتابیس لوکال بدون نیاز به اینترنت.
3. **کسر خودکار مواد مصرفی بر پایه رسپی (BOM Inventory Deduction):** کسر آنی مقادیر متریال اولیه (قهوه، شیر، سیروپ و ...) هنگام ارسال به بار یا تسویه فاکتور و بازگشت خودکار در صورت ابطال.
4. **مودال امنیتی تایید پین‌کد مدیر (OrderActionModal):** حفاظت از عملیات ابطال و ویرایش فاکتور با پین‌کد اختصاصی (پیش‌فرض: `1234`) و ثبت اجباری دلیل تغییرات در ردپای حسابرسی (`AuditLog`).
5. **ایزولاسیون مطلق پرینت حرارتی ۸۰ میلی‌متری:** رندر فیش منحصراً در ابعاد ۸۰mm با الگوی سندباکس و حذف قطعی نشت المان‌های UI، کاتالوگ و نمودارها به پیش‌نمایش پرینت.
6. **پشتیبانی از سخت‌افزارهای ESC/POS:** اتصال مستقیم به پرینترهای حرارتی از طریق WebUSB و Web Bluetooth با رندر ۵۷۶ دات بر Canvas.

---

## ساختار مستندات
- [وضعیت جاری پروژه](./PROJECT_STATUS.md)
- [خلاصه مشخصات و نیازها](./docs/PROJECT_BRIEF.md)
- [معماری سیستم و پشته فنی](./docs/ARCHITECTURE.md)
- [مدل داده و قواعد مالی](./docs/DATA_MODEL.md)
- [هماهنگ‌کننده کل (Orchestrator Agent)](./agents/orchestrator/AGENT.md)

---

## راه‌اندازی و اجرا

### ۱. اجرای سریع در ویندوز (۱-کلیک)
- فایل `RUN_100HICH.bat` را اجرا کنید تا برنامه راه‌اندازی شده و خودکار در مرورگر باز شود.
- جهت نصب اولیه پیش‌نیازها از `INSTALL_100HICH.bat` استفاده کنید.

### ۲. اجرای دستی از طریق ترمینال
```bash
# نصب وابستگی‌ها
npm install --legacy-peer-deps

# اجرای تست‌های صحت حسابداری (۱۶۱ تست)
npm test

# بررسی تایپ‌اسکریپت و اعتبارسنجی کد
npm run lint

# اجرای سرور توسعه (پورت ۳۰۰۰)
npm run dev

# ساخت و کامپایل نسخه نهایی پروداکشن PWA
npm run build
```
