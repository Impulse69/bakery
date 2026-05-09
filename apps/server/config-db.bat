@echo off
title Bread Faculty - Database Setup and Troubleshooting Utility
setlocal

:: ──────────────────────────────────────────────────────────────────────────────
:: 1. Check and Request Administrator Privileges
:: ──────────────────────────────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    goto :elevate
)

:elevate
echo ======================================================================
echo Bread Faculty - Database Setup and Troubleshooting Utility
echo ======================================================================
echo.
echo This utility needs to manage the background Windows Service and
echo requires Administrator privileges. 
echo.
echo Prompting for User Account Control (UAC) elevation...
echo.

powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:: ──────────────────────────────────────────────────────────────────────────────
:: 2. Run Database Configurator
:: ──────────────────────────────────────────────────────────────────────────────
:run
cd /d "%~dp0"

set "NODE_EXE=%~dp0runtime\node.exe"

if not exist "%NODE_EXE%" (
    set "NODE_EXE=node"
)

:: Detect where db-config.js was copied
set "CONFIG_JS="
if exist "%~dp0scripts\db-config.js" set "CONFIG_JS=%~dp0scripts\db-config.js"
if exist "%~dp0db-config.js" set "CONFIG_JS=%~dp0db-config.js"

if not "%CONFIG_JS%"=="" goto launch

echo.
echo [ERROR] Cannot find 'db-config.js' in the current folder or 'scripts' subfolder.
echo.
echo Please make sure you copied both config-db.bat and db-config.js to:
echo C:\Program Files (x86)\Bread Faculty\server\
echo.
pause
exit /b 1

:launch
echo.
echo [INFO] Launching Bread Faculty POS Database Configurator...
echo.

"%NODE_EXE%" "%CONFIG_JS%"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The Database Configurator encountered an error or was aborted.
    echo.
)

echo.
echo Press any key to close this troubleshooter...
pause >nul
exit /b
