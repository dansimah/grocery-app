# Telegram Grocery Bot

A Node.js Telegram bot for managing grocery lists with AI-powered item parsing using Google Gemini.

## Features

- 🤖 **AI-Powered Parsing**: Uses Google Gemini to parse and categorize grocery items from natural language
- 🛒 **Interactive Shopping**: Interactive shopping mode with status tracking (pending, selected, found, not found)
- 📱 **Telegram Integration**: Full Telegram bot integration with inline keyboards
- 🏷️ **Smart Categorization**: Automatically categorizes items into predefined categories
- 💾 **Persistent Storage**: JSON file-based storage for grocery lists
- 🔐 **User Authorization**: Optional user authorization system
- 🇫🇷 **French Language Support**: Optimized for French grocery items and categories

## Commands

- `/start` - Welcome message and bot introduction
- `/shop` - Start interactive shopping mode with clickable buttons
- `/list` - View current grocery list in a formatted text view
- Send any text - Parse it as a grocery list and add items

## Installation

### Prerequisites

- **For Direct Installation:** Node.js 18+ and npm
- **For Docker:** Docker and Docker Compose

### Setup Steps

1. Clone or download this project

2. Create a `.env` file in the client folder with the following variables:
   ```
   TELEGRAM_TOKEN=your_telegram_bot_token_here
   GOOGLE_API_KEY=your_google_gemini_api_key_here
   AUTHORIZED_USERS=username1,username2,first_name1,first_name2
   ```

3. **For Direct Installation:**
   ```bash
   npm install
   ```

4. **For Docker Deployment:**
   - Install Docker and Docker Compose
   - Run: `docker compose up -d --build`

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token and add it to your `.env` file

### 2. Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key and add it to your `.env` file

### 3. Configure Authorization (Optional)

Add usernames or first names to the `AUTHORIZED_USERS` environment variable, separated by commas. If left empty, the bot will be accessible to everyone.

## Usage

### Option 1: Direct Node.js

1. Start the bot:
   ```bash
   npm start
   ```

2. For development with auto-restart:
   ```bash
   npm run dev
   ```

### Option 2: Docker Deployment (Recommended)

1. **Build and run with Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

2. **Or use the comprehensive build script:**
   ```bash
   ./scripts/build.sh
   ```

3. **Monitor logs:**
   ```bash
   docker compose logs -f
   ```

4. **Stop the bot:**
   ```bash
   docker compose down
   ```

#### Docker Benefits:
- ✅ **Isolated environment** - No Node.js installation required
- ✅ **Persistent data** - Database survives container restarts
- ✅ **Auto-restart** - Bot automatically restarts if it crashes
- ✅ **Easy deployment** - Works on any Docker-capable system
- ✅ **Resource management** - Built-in logging and resource limits

## How It Works

### Adding Items
1. Send a grocery list message like: "pommes, 2 bananes, lait, fromage"
2. The AI will parse and categorize the items
3. Confirm or modify categories before adding to your list

### Shopping Mode (`/shop`)
- View your list organized by category
- Click items to change their status:
  - `•` Pending (not selected yet)
  - `➡️` Selected (currently looking for)
  - `✅` Found (completed)
  - `🚫` Not Found (unavailable)
- Use action buttons to manage your list

### Categories

The bot automatically categorizes items into:
- Fruits et légumes
- Boulangerie
- Produits laitiers
- Viandes et Poulet
- Épicerie
- Surgelés
- Boissons
- Hygiène
- Conserves

## File Structure

```
grocery_app/
├── index.js              # Main bot application
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables (create this)
├── README.md            # This file
├── Dockerfile           # Docker container configuration
├── docker-compose.yml   # Docker Compose setup
├── .dockerignore        # Docker build exclusions
├── scripts/             # Build and deployment scripts
│   ├── build.sh         # Comprehensive build script
│   └── README.md        # Scripts documentation
├── data/                # SQLite database storage (Docker)
├── grocery_app_data/    # Data storage (created automatically)
│   └── list.json        # Grocery list storage
├── config/              # Configuration modules
├── services/            # Business logic services
├── handlers/            # Telegram event handlers
├── utils/               # Utility functions
└── models/              # Data models
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_TOKEN` | Bot token from @BotFather | Yes |
| `GOOGLE_API_KEY` | Google Gemini API key | Yes |
| `AUTHORIZED_USERS` | Comma-separated list of authorized users | No |

## Development

The bot uses:
- **node-telegram-bot-api** for Telegram integration
- **@google/generative-ai** for AI-powered item parsing
- **fs-extra** for file system operations
- **uuid** for generating unique item IDs

## Troubleshooting

### Bot doesn't respond
- Check if the Telegram token is correct
- Ensure the bot is started with `npm start`
- Check console for error messages

### AI parsing not working
- Verify Google API key is correct and valid
- Check if you have API quota remaining
- Ensure internet connection for API calls

### Permission errors
- Check if user is in the `AUTHORIZED_USERS` list
- Verify usernames/first names are spelled correctly

## Converting from n8n

This Node.js implementation replicates the functionality of the original n8n workflow:

- ✅ Telegram trigger handling
- ✅ AI-powered grocery parsing with Google Gemini
- ✅ Interactive confirmation with inline keyboards
- ✅ Category selection and updates
- ✅ Shopping mode with status tracking
- ✅ File-based data persistence
- ✅ User authorization
- ✅ All original commands and features

## License

MIT License - feel free to modify and use as needed!

## Safe Deployment & Data Preservation

### Updating the Bot

When updating your bot code, follow these steps to preserve your data:

```bash
# 1. Stop the current container (data persists in Docker volume)
docker compose down

# 2. Pull/update your code changes
git pull  # or however you update your code

# 3. Rebuild with new code
docker compose build --no-cache

# 4. Start with preserved data
docker compose up -d
```

### Data Backup

To backup your SQLite database:

```bash
# Create backup
docker run --rm -v grocery_data:/data -v $(pwd):/backup alpine cp /data/grocery_bot.db /backup/grocery_bot_backup_$(date +%Y%m%d_%H%M%S).db

# Or on Windows PowerShell:
docker run --rm -v grocery_data:/data -v ${PWD}:/backup alpine cp /data/grocery_bot.db /backup/grocery_bot_backup.db
```

### Data Restore

To restore from backup:

```bash
# Stop the bot
docker compose down

# Restore database
docker run --rm -v grocery_data:/data -v $(pwd):/backup alpine cp /backup/grocery_bot_backup.db /data/grocery_bot.db

# Start the bot
docker compose up -d
```

### Volume Management

```bash
# List Docker volumes
docker volume ls

# Inspect volume location
docker volume inspect grocery_data

# Remove volume (⚠️ This deletes all data!)
docker volume rm grocery_data
```

### Migration from Bind Mount (if needed)

If you were previously using bind mounts and need to migrate existing data:

```bash
# 1. Stop current setup
docker compose down

# 2. Copy data from host to volume
docker run --rm -v grocery_data:/dest -v $(pwd)/data:/src alpine cp /src/grocery_bot.db /dest/

# 3. Start with new volume setup
docker compose up -d
``` 