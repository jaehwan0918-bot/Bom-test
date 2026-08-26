@echo off
setlocal
cd /d "%~dp0"
title Smart BOM Selector V5

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

echo Starting Smart BOM Selector V5...
start "" "http://127.0.0.1:8765"
node server.js
pause
