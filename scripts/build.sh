#!/bin/bash

# Telegram Grocery Bot - Build Script
# This script builds and deploys the bot using Docker Compose

set -e  # Exit on any error

echo "🚀 Starting build and deployment of Telegram Grocery Bot..."

# Function to check if docker compose is available
check_docker_compose() {
    if command -v "docker" >/dev/null 2>&1; then
        if docker compose version >/dev/null 2>&1; then
            echo "✅ Docker Compose V2 detected"
            DOCKER_COMPOSE_CMD="docker compose"
        elif command -v "docker-compose" >/dev/null 2>&1; then
            echo "✅ Docker Compose V1 detected"
            DOCKER_COMPOSE_CMD="docker-compose"
        else
            echo "❌ Docker Compose not found"
            exit 1
        fi
    else
        echo "❌ Docker not found"
        exit 1
    fi
}

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
    $DOCKER_COMPOSE_CMD ps -q grocery-bot | grep -q . 2>/dev/null
}

# Main build and deployment process
main() {
    echo "🔍 Checking Docker setup..."
    check_docker_compose
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        echo "❌ docker-compose.yml not found. Please run this script from the project root directory."
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
    $DOCKER_COMPOSE_CMD down || true
    
    echo "🔨 Building new image..."
    $DOCKER_COMPOSE_CMD build --no-cache
    
    echo "🚀 Starting updated bot..."
    $DOCKER_COMPOSE_CMD up -d
    
    echo "⏳ Waiting for bot to start..."
    sleep 5
    
    echo "📜 Showing recent logs..."
    $DOCKER_COMPOSE_CMD logs --tail=20 grocery-bot || true
    
    echo ""
    echo "✅ Build and deployment completed successfully!"
    echo "🔍 Monitor logs with: $DOCKER_COMPOSE_CMD logs -f grocery-bot"
    echo "📊 Check status with: $DOCKER_COMPOSE_CMD ps"
}

# Handle script interruption
trap 'echo "❌ Build interrupted"; exit 1' INT TERM

# Run main function
main "$@" 