#!/usr/bin/env bash
# ============================================
#  Xaytheon — One-Command Local Setup
#  Usage:  bash setup.sh   (or chmod +x setup.sh && ./setup.sh)
# ============================================

set -e

BLUE='\033[1;34m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🚀  Xaytheon Local Setup  🚀      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── Pre-flight checks ────────────────────────────────
echo -e "${YELLOW}[1/6]${NC} Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}  ✗ Node.js 18+ required (found v$(node -v)). Please upgrade.${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}  ✗ npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ npm $(npm -v)${NC}"

# ─── Install root dependencies ────────────────────────
echo ""
echo -e "${YELLOW}[2/6]${NC} Installing root dependencies..."
npm install --silent

# ─── Install backend dependencies ─────────────────────
echo ""
echo -e "${YELLOW}[3/6]${NC} Installing backend dependencies..."
cd backend
npm install --silent

# ─── Setup .env ────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6]${NC} Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}  ✓ Created backend/.env from .env.example${NC}"
    echo -e "${YELLOW}  ℹ  Edit backend/.env to add GitHub OAuth credentials (optional)${NC}"
else
    echo -e "${GREEN}  ✓ backend/.env already exists, skipping.${NC}"
fi

# ─── Seed demo data ───────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6]${NC} Seeding demo data..."
node scripts/seed-data.js

# ─── Start everything ─────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6]${NC} Starting frontend and backend..."
cd ..

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Setup complete!                                ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   Demo login:                                        ║${NC}"
echo -e "${GREEN}║     Email:    demo@xaytheon.dev                      ║${NC}"
echo -e "${GREEN}║     Password: demo1234                               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Starting frontend and backend now... (Ctrl+C to stop)${NC}"
echo ""

# Try opening the browser automatically depending on the OS
if command -v xdg-open &> /dev/null; then
    xdg-open http://127.0.0.1:5500 &
elif command -v open &> /dev/null; then
    open http://127.0.0.1:5500 &
else
    echo -e "${YELLOW}ℹ Please open http://127.0.0.1:5500 in your browser manually.${NC}"
fi

npm start
