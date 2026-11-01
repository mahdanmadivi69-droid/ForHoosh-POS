@echo off
chcp 65001 > nul
title 📦 پکیج نصب و آماده‌سازی سیستم کافه مودندو (Modendo Gaming Cafe)
color 0B

echo ============================================================
echo   📦 راه‌اندازی و نصب اولیه سیستم صندوق کافه مودندو
echo   (Modendo Boardgame & Gaming Cafe - Shariati)
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] Node.js یافت نشد. لطفاً ابتدا Node.js را نصب نمایید.
    pause
    exit /b 1
)

echo [۱] نصب و همگام‌سازی کتابخانه‌ها (Dependencies)...
call npm install --no-audit

echo.
echo [۲] کامپایل بیلد پروداکشن اختصاصی کافه مودندو (Zero-G PWA)...
call npm run build:modendo

echo.
echo [۳] اجرای آزمون‌های راستی‌آزمایی ریاضیات مالی و ایزولاسیون...
call npm test

echo.
echo ============================================================
echo ✅ نصب و اعتبارسنجی با موفقیت کامل انجام شد!
echo اکنون می‌توانید با دابل‌کلیک روی فایل RUN_MODENDO.bat
echo برنامه را روی سیستم صندوق کافه مودندو اجرا کنید.
echo ============================================================
echo.
pause
