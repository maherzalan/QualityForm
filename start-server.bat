@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   خادم محلي لنظام ضبط الجودة
echo ========================================
echo.

if exist package.json (
  if exist node_modules\ (
    echo جاري تطبيق هجرات قاعدة البيانات...
    call npm run db:migrate 2>nul
    echo.
    echo تشغيل الخادم مع الهجرات التلقائية...
    call npm start
    goto :end
  ) else (
    echo لتفعيل الهجرات التلقائية: npm install
    echo ثم أضف DATABASE_URL في ملف .env
    echo.
  )
)

echo افتح المتصفح على: http://localhost:5500
echo اضغط Ctrl+C لإيقاف الخادم
echo.
python -m http.server 5500 2>nul
if errorlevel 1 (
  echo Python غير متوفر، جاري تجربة npx serve...
  npx --yes serve -l 5500 .
)

:end
pause
