@echo off
setlocal
set "SERVER_DIR=%~dp0"
set "NODE_EXE=%SERVER_DIR%runtime\node.exe"
set "PRISMA_CLI=%SERVER_DIR%node_modules\prisma\build\index.js"

if not exist "%NODE_EXE%" (
  set "NODE_EXE=node"
)

echo ==============================================
echo Installing Bread Faculty Backend Services
echo ==============================================

echo [1/4] Generating Database Client...
if exist "%PRISMA_CLI%" (
  call "%NODE_EXE%" "%PRISMA_CLI%" generate
) else (
  call npx prisma generate
)
if %errorlevel% neq 0 (
  echo Error generating Prisma client.
  exit /b %errorlevel%
)

echo [2/4] Building Database Tables...
if exist "%PRISMA_CLI%" (
  call "%NODE_EXE%" "%PRISMA_CLI%" migrate deploy
) else (
  call npx prisma migrate deploy
)
if %errorlevel% neq 0 (
  echo Error applying database migrations.
  exit /b %errorlevel%
)

echo [3/4] Ensuring Default Admin User...
call "%NODE_EXE%" dist\services\defaultAdmin.js
if %errorlevel% neq 0 (
  echo Error ensuring default admin user.
  exit /b %errorlevel%
)

echo [4/4] Installing Background Service...
call "%NODE_EXE%" scripts\install-service.js
if %errorlevel% neq 0 (
  echo Error installing Windows Service.
  exit /b %errorlevel%
)

echo.
echo ==============================================
echo Setup Complete! The server is now running in
echo the background as a native Windows service.
echo You can now open the Desktop POS app.
echo ==============================================
