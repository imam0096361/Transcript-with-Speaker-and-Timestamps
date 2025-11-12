@echo off
REM Transcript Studio AI - Enhanced Setup Script (Windows)
REM This script sets up both frontend and backend services

echo ==========================================
echo Transcript Studio AI - Enhanced Setup
echo ==========================================
echo.

REM Check if Python is installed
echo Checking prerequisites...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed
    echo Please install Python 3.9+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION%

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version 2^>^&1') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION%

REM Check if pip is installed
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pip is not installed
    pause
    exit /b 1
)

echo [OK] pip is installed
echo.

REM Setup frontend
echo Setting up frontend...
if not exist package.json (
    echo [ERROR] package.json not found
    pause
    exit /b 1
)

echo Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

if not exist .env.local (
    echo Creating .env.local from template...
    copy .env.example .env.local
    echo [WARNING] Please edit .env.local and add your Gemini API key
) else (
    echo [OK] .env.local already exists
)

echo.

REM Setup backend
echo Setting up backend...
cd backend

if not exist requirements.txt (
    echo [ERROR] requirements.txt not found
    cd ..
    pause
    exit /b 1
)

echo Installing Python dependencies (this may take several minutes)...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed
    cd ..
    pause
    exit /b 1
)

if not exist .env (
    echo Creating .env from template...
    copy .env.example .env
    echo [WARNING] Please edit backend\.env and add your Hugging Face token
) else (
    echo [OK] backend\.env already exists
)

cd ..

echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo.
echo 1. Configure API keys:
echo    - Edit .env.local and add your Gemini API key
echo    - Edit backend\.env and add your Hugging Face token
echo.
echo 2. Accept Pyannote model licenses:
echo    - https://huggingface.co/pyannote/speaker-diarization-3.1
echo    - https://huggingface.co/pyannote/segmentation-3.0
echo.
echo 3. Test backend setup:
echo    cd backend
echo    python test_backend.py
echo.
echo 4. Start the services:
echo    Terminal 1: cd backend ^&^& python main.py
echo    Terminal 2: npm run dev
echo.
echo 5. Open http://localhost:5173/ in your browser
echo.
echo Documentation:
echo    - Quick start: QUICKSTART.md
echo    - Technical guide: ENHANCED_ACCURACY_GUIDE.md
echo    - Backend docs: backend\README.md
echo.
pause
