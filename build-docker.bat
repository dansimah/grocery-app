@echo off
echo 🐳 Building Telegram Grocery Bot Docker image...

docker build -t telegram-grocery-bot .

if %errorlevel% equ 0 (
    echo ✅ Docker image built successfully!
    echo.
    echo 🚀 To run the bot:
    echo    docker-compose up -d
    echo.
    echo 📊 To view logs:
    echo    docker-compose logs -f
    echo.
    echo 🛑 To stop the bot:
    echo    docker-compose down
    echo.
    echo 🔧 To rebuild and restart:
    echo    docker-compose up -d --build
) else (
    echo ❌ Failed to build Docker image
    exit /b 1
) 