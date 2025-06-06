#!/bin/bash

# Telegram Grocery Bot - Safe Deployment Script
# This script safely updates the bot while preserving data

set -e  # Exit on any error

echo "🚀 Starting safe deployment of Telegram Grocery Bot..."

# Function to create backup
create_backup() {
    local backup_name="grocery_bot_backup_$(date +%Y%m%d_%H%M%S).db"
    echo "📦 Creating backup: $backup_name"
    
    docker run --rm \
        -v grocery_data:/data \
        -v "$(pwd)":/backup \
        alpine cp /data/grocery_bot.db "/backup/$backup_name" 2>/dev/null || {
        echo "⚠️  No existing database found - this might be a fresh deployment"
    }
    
    echo "✅ Backup completed: $backup_name"
}

# Function to check if container is running
is_container_running() {
    docker compose ps -q grocery-bot | grep -q . 2>/dev/null
}

# Main deployment process
main() {
    echo "🔍 Checking current state..."
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        echo "❌ docker-compose.yml not found. Please run this script from the client directory."
        exit 1
    fi
    
    # Create backup if container exists and is running
    if is_container_running; then
        echo "📋 Bot is currently running. Creating backup before update..."
        create_backup
    else
        echo "📋 No running container found."
    fi
    
    echo "🛑 Stopping current containers..."
    docker compose down
    
    echo "🔨 Building new image..."
    docker compose build --no-cache
    
    echo "🚀 Starting updated bot..."
    docker compose up -d
    
    echo "⏳ Waiting for bot to start..."
    sleep 3
    
    echo "📜 Showing recent logs..."
    docker compose logs --tail=20 grocery-bot
    
    echo ""
    echo "✅ Deployment completed successfully!"
    echo "🔍 Monitor logs with: docker compose logs -f grocery-bot"
    echo "📊 Check status with: docker compose ps"
}

# Handle script interruption
trap 'echo "❌ Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@" 