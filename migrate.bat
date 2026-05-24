@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   تطبيق هجرات قاعدة البيانات
echo ========================================
echo.
if not exist node_modules (
  echo تثبيت الحزم...
  call npm install
)
call npm run db:migrate
echo.
pause
