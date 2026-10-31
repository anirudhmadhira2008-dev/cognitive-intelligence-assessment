@echo off
title Psychometric Platform Cleanup
echo ========================================================
echo   Stopping Psychometric Platform
echo ========================================================
echo.
echo [*] Terminating Node.js processes...
taskkill /F /IM node.exe /T 2>nul
echo [*] Unmapping drive P:...
subst P: /d 2>nul
echo [*] Done!
pause
