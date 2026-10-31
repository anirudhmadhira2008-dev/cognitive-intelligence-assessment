@echo off
title Psychometric Platform - One-Click Dependency Installer
echo ========================================================
echo   Installing Dependencies for Psychometric Platform
echo ========================================================
echo.

:: 1. Map current folder to virtual drive P: to bypass Windows 260-char path limit
echo [*] Mapping project drive (P:)...
subst P: /d >nul 2>&1
subst P: "%~dp0"
if not exist P:\ (
    echo [ERROR] Failed to map drive P:.
    pause
    exit /b 1
)

:: 2. Install Backend Dependencies
echo [*] Step 1/2: Installing Backend Dependencies (Express, Mongoose, Socket.io, Jest)...
cd /d P:\psychometric-patent\psychometric-system-backup\backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend npm install failed.
    pause
    exit /b 1
)

:: 3. Install Frontend Dependencies
echo [*] Step 2/2: Installing Frontend Dependencies (React, Vite, face-api.js, Lucide)...
cd /d P:\psychometric-patent\psychometric-system-backup\frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   [SUCCESS] All dependencies installed successfully!
echo   You can now start the platform anytime by running:
echo     -> run.bat
echo ========================================================
echo.
pause
