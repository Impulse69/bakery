@echo off
echo ==============================================
echo Installing Bread Faculty Backend Services
echo ==============================================

echo [1/3] Generating Database Client...
call npx prisma generate
if %errorlevel% neq 0 (
  echo Error generating Prisma client.
  pause
  exit /b %errorlevel%
)

echo [2/3] Building Database Tables...
call npx prisma migrate deploy
if %errorlevel% neq 0 (
  echo Error applying database migrations.
  pause
  exit /b %errorlevel%
)

echo [3/3] Installing Background Service...
call node scripts/install-service.js
if %errorlevel% neq 0 (
  echo Error installing Windows Service.
  pause
  exit /b %errorlevel%
)

echo.
echo ==============================================
echo Setup Complete! The server is now running in
echo the background as a native Windows service.
echo You can now open the Desktop POS app.
echo ==============================================
pause
