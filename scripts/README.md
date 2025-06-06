# Deployment Scripts

This directory contains scripts for building and deploying the Telegram Grocery Bot.

## Scripts

### `build.sh`
**Main build and deployment script for production**

- ✅ **Auto-detects** Docker Compose version (V1 or V2)
- ✅ **Creates backups** before deployment
- ✅ **Safe deployment** with rollback capability
- ✅ **Cross-platform** compatible (Linux/macOS)

**Usage:**
```bash
./scripts/build.sh
```

**What it does:**
1. Checks Docker setup
2. Creates database backup (if existing deployment)
3. Stops current containers
4. Builds new Docker image
5. Starts updated containers
6. Shows deployment status

### `deploy.sh`
**Interactive deployment script with enhanced features**

- ✅ **Interactive** deployment process
- ✅ **Backup creation** before updates
- ✅ **Error handling** and recovery
- ✅ **Status reporting** and logging

**Usage:**
```bash
./scripts/deploy.sh
```

## GitHub Actions Deployment

The project includes automated deployment via GitHub Actions:

**File:** `.github/workflows/deploy.yml`

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Environment:**
- **OS:** Ubuntu 24.04
- **Docker:** Latest with Compose V2
- **Script:** Executes `scripts/build.sh`

**Required Secrets:**
```
TELEGRAM_BOT_TOKEN    # Bot token from @BotFather
GEMINI_API_KEY        # Google Gemini API key
AUTHORIZED_USERS      # Comma-separated list of authorized users
```

**Setup in GitHub:**
1. Go to repository Settings → Secrets and variables → Actions
2. Add the required secrets
3. Push to main branch or manually trigger the workflow

## Local Development

For local testing and development:

**Direct Docker Compose:**
```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

**Using build script:**
```bash
./scripts/build.sh
```

## Data Persistence

All scripts use Docker volumes for data persistence:

- **Database:** `grocery_data` volume
- **Backups:** Created in project root
- **Logs:** Available via `docker compose logs`

**Manual backup:**
```bash
docker run --rm -v grocery_data:/data -v $(pwd):/backup alpine cp /data/grocery_bot.db /backup/manual_backup.db
```

## Troubleshooting

**Common Issues:**

1. **Permission denied:** `chmod +x scripts/*.sh`
2. **Docker not found:** Install Docker and Docker Compose
3. **Secrets missing:** Add required GitHub secrets
4. **Port conflicts:** Stop other services on port 3000

**Debug commands:**
```bash
# Check container status
docker compose ps

# View logs
docker compose logs grocery-bot

# Check volumes
docker volume ls

# Inspect volume
docker volume inspect grocery_data
``` 