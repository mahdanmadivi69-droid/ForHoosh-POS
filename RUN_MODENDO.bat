@echo off
chcp 65001 > nul
title 🎮 CAFE OS — Modendo Boardgame & Gaming Cafe
color 0B

echo ============================================================
echo   🎮 CAFE OS — سامانه صندوق و مدیریت کافه مودندو
echo   (Modendo Boardgame & Gaming Cafe - Shariati)
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

echo [2/3] بررسی بیلد پروداکشن مودندو...
if not exist "dist\modendo\index.html" (
    echo [اطلاع] فایل‌های بیلد یافت نشد. در حال کامپایل خودکار...
    call npm run build:modendo
)

echo [3/3] اجرای سرور اختصاصی مودندو روی پورت ۳۰۰۱...
echo.
echo ------------------------------------------------------------
echo ✅ سرور کافه مودندو آماده به کار است.
echo 🌐 آدرس صندوق فروش: http://localhost:3001
echo 👤 کاربر مالک و ادمین: admin   | رمز: 123 | پین: 1380
echo 👤 مدیر و سرپرست سالن: ali     | رمز: 123 | پین: 2468
echo 👤 صندوق‌دار شیفت:     mahsa   | رمز: 123 | پین: 1122
echo 👤 باریستا و بارتندر:  pouya   | رمز: 123 | پین: 3344
echo 👤 گیم‌مستر کنسول PS5: arian   | رمز: 123 | پین: 5566
echo ------------------------------------------------------------
echo.
echo در حال باز کردن مرورگر پیش‌فرض...
start http://localhost:3001

:: اجرای سرور پروداکشن با تننت مودندو
set NODE_ENV=production
set VITE_TENANT_ID=tenant-modendo-01
set PORT=3001
node --loader tsx server.ts
if %errorlevel% neq 0 (
    echo تلاش با دستور جایگزین tsx...
    npx tsx server.ts
)
pause

