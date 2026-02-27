@echo off
REM ============================================
REM  Xaytheon — One-Command Local Setup (Windows)
REM  Usage:  setup.bat
REM ============================================

echo.
echo ======================================
echo     Xaytheon Local Setup (Windows)
echo ======================================
echo.

REM ─── Pre-flight checks ────────────────────────────────
echo [1/6] Checking prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   X  Node.js is not installed. Please install Node.js 18+ from https://nodejs.org
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VER=%%a
echo   OK  Node.js detected

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   X  npm is not installed.
    exit /b 1
)
echo   OK  npm detected

REM ─── Install root dependencies ────────────────────────
echo.
echo [2/6] Installing root dependencies...
call npm install --silent
if %ERRORLEVEL% neq 0 (
    echo   X  Failed to install root dependencies
    exit /b 1
)

REM ─── Install backend dependencies ─────────────────────
echo.
echo [3/6] Installing backend dependencies...
pushd backend
call npm install --silent
if %ERRORLEVEL% neq 0 (
    echo   X  Failed to install backend dependencies
    popd
    exit /b 1
)

REM ─── Setup .env ────────────────────────────────────────
echo.
echo [4/6] Setting up environment variables...
if not exist .env (
    copy .env.example .env >nul
    echo   OK  Created backend\.env from .env.example
    echo   !   Edit backend\.env to add GitHub OAuth credentials (optional)
) else (
    echo   OK  backend\.env already exists, skipping.
)

REM ─── Seed demo data ───────────────────────────────────
echo.
echo [5/6] Seeding demo data...
node scripts\seed-data.js
if %ERRORLEVEL% neq 0 (
    echo   !   Seed script had issues (non-critical, continuing...)
)

REM ─── Done ──────────────────────────────────────────────
popd
echo.
echo ======================================================
echo   Setup complete!
echo.
echo   Demo login:
echo     Email:    demo@xaytheon.dev
echo     Password: demo1234
echo ======================================================
echo.
echo Starting frontend and backend now... (Ctrl+C to stop)
echo Opening browser...
echo.

start http://127.0.0.1:5500
call npm start
