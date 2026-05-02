@echo off
title Bronze Crown — dev server
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js not found in PATH. Install Node from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 pause & exit /b 1
)

echo.
echo Starting Vite. Close this window or press Ctrl+C to stop.
echo Browser should open the game page: http://localhost:5173/dev.html
echo If index.html opened instead, manually open dev.html in that same server tab.
echo.
call npm run dev
pause
