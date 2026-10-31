@echo off
title Psychometric AI Assessment Platform Launcher
echo ========================================================
echo   Multimodal Psychometric AI Assessment Platform
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

:: 2. Set Node memory allocation for handling 140+ concurrent students
set NODE_OPTIONS=--max-old-space-size=4096

:: 3. Launch Backend Server (Port 5000)
echo [*] Starting Backend Server (Port 5000)...
start "Psychometric - Backend (Port 5000)" cmd /k "cd /d P:\psychometric-patent\psychometric-system-backup\backend && npm run dev"

:: 4. Launch Frontend Server (Port 5173)
echo [*] Starting Frontend Server (Port 5173)...
start "Psychometric - Frontend (Port 5173)" cmd /k "cd /d P:\psychometric-patent\psychometric-system-backup\frontend && npm run dev"

echo.
echo [*] Waiting 3 seconds for servers to initialize...
timeout /t 3 /nobreak >nul

:: 5. Open Application in Default Browser
echo [*] Opening application in browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ========================================================
echo   Platform is running!
echo   - Local Host:     http://localhost:5173
echo   - Backend API:    http://localhost:5000
echo   - Health Check:   http://localhost:5000/api/health
echo.
echo   Link for Students on the same Wi-Fi / LAN:
ipconfig | findstr /i "IPv4"
echo   (e.g., http://192.168.29.77:5173)
========================================================
echo.
pause
