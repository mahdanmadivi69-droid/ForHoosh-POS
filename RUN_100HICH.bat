@echo off
chcp 65001 > nul
title ☕ CAFE OS — 100 HICH Specialty Coffee
color 0A

echo ============================================================
echo   ☕ CAFE OS — سامانه صندوق و مدیریت کافه ۱۰۰ هیچ
echo   (100 Hich Specialty Coffee Lab - Ekbatan)
echo ============================================================
echo.
echo [1/3] بررسی محیط اجرایی Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] نرم‌افزار Node.js روی این سیستم نصب نیست!
    echo لطفاً Node.js نسخه 18 یا بالاتر را از وب‌سایت nodejs.org نصب کنید.
    pause
    exit /b 1
)

echo [2/3] بررسی بیلد پروداکشن...
if not exist "dist\index.html" (
    echo [اطلاع] فایل‌های بیلد یافت نشد. در حال کامپایل خودکار...
    call npm run build
)

echo [3/3] اجرای سرور پرسرعت کافه روی پورت ۳۰۰۰...
echo.
echo ------------------------------------------------------------
echo ✅ سرور آماده به کار است.
echo 🌐 آدرس صندوق فروش: http://localhost:3000
echo 👤 کاربر مدیر: admin   | رمز: 123
echo 👤 سرپرست شیفت: sara   | رمز: 123
echo 👤 باریستا: nima       | رمز: 123
echo ------------------------------------------------------------
echo.
echo در حال باز کردن مرورگر پیش‌فرض...
start http://localhost:3000

:: اجرای سرور پروداکشن
set NODE_ENV=production
node --loader tsx server.ts
if %errorlevel% neq 0 (
    echo تلاش با دستور جایگزین tsx...
    npx tsx server.ts
)
pause
