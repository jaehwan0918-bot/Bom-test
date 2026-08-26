@echo off
setlocal
cd /d "%~dp0"
title Smart BOM Selector V5 - Local

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required.
  pause
  exit /b 1
)

echo Starting local mode...
start "" "http://127.0.0.1:8765"
set MOUSER_API_KEY=
set DIGIKEY_CLIENT_ID=
set DIGIKEY_CLIENT_SECRET=
set DIGIKEY_ACCOUNT_ID=
set NEXAR_CLIENT_ID=
set NEXAR_CLIENT_SECRET=
node server.js
pause
