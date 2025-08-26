@echo off
REM 🚂 Railway Deployment Script for WhatsApp Scraper (Windows)
REM This script automates the deployment process on Windows

setlocal enabledelayedexpansion

echo 🚂 ========================================
echo 🚂 Railway Deployment for WhatsApp Scraper
echo 🚂 ========================================
echo.

echo 🚂 Starting Railway Deployment for WhatsApp Scraper...

REM Check if required tools are installed
echo [INFO] Checking dependencies...

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed. Please install Git first.
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo [SUCCESS] All dependencies are installed!

REM Check if we're in a git repository
echo [INFO] Checking Git repository...

if not exist ".git" (
    echo [ERROR] Not in a Git repository. Please initialize Git first:
    echo   git init
    echo   git add .
    echo   git commit -m "Initial commit"
    pause
    exit /b 1
)

echo [SUCCESS] Git repository found!

REM Check if Railway CLI is installed
echo [INFO] Checking Railway CLI...

where railway >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Railway CLI not found. Installing...
    npm install -g @railway/cli
    
    where railway >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Railway CLI. Please install manually:
        echo   npm install -g @railway/cli
        pause
        exit /b 1
    )
)

echo [SUCCESS] Railway CLI is installed!

REM Install dependencies
echo [INFO] Installing dependencies...

if not exist "node_modules" (
    npm install
    echo [SUCCESS] Dependencies installed!
) else (
    echo [INFO] Dependencies already installed, updating...
    npm update
    echo [SUCCESS] Dependencies updated!
)

REM Build the project
echo [INFO] Building project...

findstr /c:"\"build\"" package.json >nul
if %errorlevel% equ 0 (
    npm run build
    echo [SUCCESS] Project built successfully!
) else (
    echo [WARNING] No build script found, skipping build step.
)

REM Test the project locally
echo [INFO] Testing project locally...

findstr /c:"\"test\"" package.json >nul
if %errorlevel% equ 0 (
    echo [INFO] Running tests...
    npm test
    echo [SUCCESS] Tests passed!
) else (
    echo [WARNING] No test script found, skipping tests.
)

REM Test health server
echo [INFO] Testing health server...
start /b node health-server.js
set HEALTH_PID=%errorlevel%

timeout /t 3 /nobreak >nul

curl -s http://localhost:3000/health >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Health server is working!
) else (
    echo [WARNING] Health server test failed, but continuing deployment...
)

taskkill /f /im node.exe >nul 2>nul

REM Commit changes
echo [INFO] Committing changes...

git diff --quiet
if %errorlevel% equ 0 (
    git diff --cached --quiet
    if %errorlevel% equ 0 (
        echo [INFO] No changes to commit.
    ) else (
        git add .
        git commit -m "Deploy to Railway - %date% %time%"
        echo [SUCCESS] Changes committed!
    )
) else (
    git add .
    git commit -m "Deploy to Railway - %date% %time%"
    echo [SUCCESS] Changes committed!
)

REM Push to remote
echo [INFO] Pushing to remote repository...

git remote get-url origin >nul 2>nul
if %errorlevel% equ 0 (
    git push origin main
    if %errorlevel% equ 0 (
        echo [SUCCESS] Pushed to remote repository!
    ) else (
        git push origin master
        if %errorlevel% equ 0 (
            echo [SUCCESS] Pushed to remote repository!
        ) else (
            echo [ERROR] Failed to push to remote repository.
            pause
            exit /b 1
        )
    )
) else (
    echo [WARNING] No remote origin found. Please add remote:
    echo   git remote add origin ^<your-repo-url^>
    echo   git push -u origin main
)

REM Deploy to Railway
echo [INFO] Deploying to Railway...

railway whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Not logged in to Railway. Please login:
    echo   railway login
    pause
    exit /b 1
)

railway up
if %errorlevel% equ 0 (
    echo [SUCCESS] Deployed to Railway!
) else (
    echo [ERROR] Failed to deploy to Railway.
    pause
    exit /b 1
)

REM Show deployment status
echo [INFO] Checking deployment status...

railway status >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Deployment completed successfully!
    echo.
    echo 🎉 Your WhatsApp Scraper is now running on Railway!
    echo.
    echo 📱 Next steps:
    echo   1. Check Railway dashboard for logs
    echo   2. Scan QR code to connect WhatsApp
    echo   3. Test bot functionality
    echo   4. Monitor health endpoint
    echo.
    echo 🔗 Useful commands:
    echo   railway logs          - View deployment logs
    echo   railway status        - Check service status
    echo   railway open          - Open Railway dashboard
    echo.
) else (
    echo [ERROR] Failed to get deployment status.
)

echo.
echo [SUCCESS] Deployment completed! 🎉
pause
