@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   خادم محلي لنظام ضبط الجودة
echo   افتح المتصفح على:
echo   http://localhost:5500
echo ========================================
echo.
echo اضغط Ctrl+C لإيقاف الخادم
echo.
python -m http.server 5500 2>nul
if errorlevel 1 (
  echo Python غير متوفر، جاري تجربة npx serve...
  npx --yes serve -l 5500 .
)
pause
