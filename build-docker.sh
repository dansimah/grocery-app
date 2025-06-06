#!/bin/bash

# Build and deploy Telegram Grocery Bot with Docker

echo "🐳 Building Telegram Grocery Bot Docker image..."

# Build the Docker image
docker build -t telegram-grocery-bot .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo ""
    echo "🚀 To run the bot:"
    echo "   docker-compose up -d"
    echo ""
    echo "📊 To view logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 To stop the bot:"
    echo "   docker-compose down"
    echo ""
    echo "🔧 To rebuild and restart:"
    echo "   docker-compose up -d --build"
else
    echo "❌ Failed to build Docker image"
    exit 1
fi 