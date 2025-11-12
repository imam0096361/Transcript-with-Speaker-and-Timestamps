#!/bin/bash

# Transcript Studio AI - Enhanced Setup Script
# This script sets up both frontend and backend services

set -e  # Exit on error

echo "=========================================="
echo "Transcript Studio AI - Enhanced Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python is installed
echo "🔍 Checking prerequisites..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    echo "Please install Python 3.9+ from https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ pip is installed${NC}"
echo ""

# Setup frontend
echo "📦 Setting up frontend..."
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

echo "Installing npm dependencies..."
npm install

if [ ! -f ".env.local" ]; then
    echo "Creating .env.local from template..."
    cp .env.example .env.local
    echo -e "${YELLOW}⚠️  Please edit .env.local and add your Gemini API key${NC}"
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi

echo ""

# Setup backend
echo "🐍 Setting up backend..."
cd backend

if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi

echo "Installing Python dependencies (this may take several minutes)..."
pip3 install -r requirements.txt

if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit backend/.env and add your Hugging Face token${NC}"
else
    echo -e "${GREEN}✅ backend/.env already exists${NC}"
fi

cd ..

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Configure API keys:"
echo "   - Edit .env.local and add your Gemini API key"
echo "   - Edit backend/.env and add your Hugging Face token"
echo ""
echo "2. Accept Pyannote model licenses:"
echo "   - https://huggingface.co/pyannote/speaker-diarization-3.1"
echo "   - https://huggingface.co/pyannote/segmentation-3.0"
echo ""
echo "3. Test backend setup:"
echo "   cd backend"
echo "   python3 test_backend.py"
echo ""
echo "4. Start the services:"
echo "   Terminal 1: cd backend && python3 main.py"
echo "   Terminal 2: npm run dev"
echo ""
echo "5. Open http://localhost:5173/ in your browser"
echo ""
echo "📖 Documentation:"
echo "   - Quick start: QUICKSTART.md"
echo "   - Technical guide: ENHANCED_ACCURACY_GUIDE.md"
echo "   - Backend docs: backend/README.md"
echo ""
