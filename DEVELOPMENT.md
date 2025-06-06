# Development Guide - Telegram Grocery Bot

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [API Integrations](#api-integrations)
- [Shopping Interface Architecture](#shopping-interface-architecture)
- [Development Workflow](#development-workflow)
- [Key Design Patterns](#key-design-patterns)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

The Telegram Grocery Bot is a Node.js application that provides intelligent grocery list management through Telegram. The architecture follows a modular, service-oriented design with clear separation of concerns.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram API  │◄──►│   Bot Service   │◄──►│  Google Gemini  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                       ┌───────▼───────┐
                       │  Core Services │
                       └───────┬───────┘
                               │
                    ┌──────────▼──────────┐
                    │   SQLite Database   │
                    └─────────────────────┘
```

### Technology Stack
- **Runtime**: Node.js 18+
- **Bot Framework**: node-telegram-bot-api
- **AI Service**: Google Gemini API (@google/generative-ai)
- **Database**: SQLite3
- **Containerization**: Docker with Docker Compose
- **Architecture Pattern**: Service Layer + Repository Pattern

## Project Structure

```
grocery_app/
├── index.js                 # Application entry point
├── package.json            # Dependencies and scripts
├── package-lock.json        # Dependency lock file
├── .env                    # Environment variables
├── .gitignore              # Git ignore rules
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Multi-service orchestration
├── .dockerignore           # Docker build exclusions
├── scripts/                # Build and deployment scripts
│   ├── build.sh           # Comprehensive build script
│   └── README.md          # Scripts documentation
├── config/                 # Configuration modules
│   ├── bot.js             # Bot configuration
│   ├── database.js        # Database configuration
│   └── categories.js      # Grocery categories definition
├── models/                 # Data models (Repository pattern)
│   └── GroceryItem.js     # Grocery item model with CRUD operations
├── services/              # Business logic services
│   ├── groceryService.js  # Core grocery business logic
│   ├── aiService.js       # AI parsing and categorization
│   ├── sessionService.js  # Callback session management
│   └── loggerService.js   # Logging and monitoring
├── handlers/              # Telegram event handlers
│   ├── commandHandlers.js # Command processing (/shop, /list, etc.)
│   ├── callbackHandlers.js# Button callback processing
│   └── messageHandlers.js # Text message processing
├── utils/                 # Utility functions
│   └── messageFormatter.js# Message and keyboard formatting
└── data/                  # SQLite database storage (Docker volume)
```

## Core Components

### 1. Application Entry Point (`index.js`)
- Initializes bot instance
- Registers all handlers
- Manages application lifecycle
- Handles graceful shutdown

### 2. Configuration Layer (`config/`)

#### `bot.js`
```javascript
const BOT_CONFIG = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    AUTHORIZED_USERS: process.env.AUTHORIZED_USERS?.split(','),
    STATUS_CHAT_ID: process.env.STATUS_CHAT_ID
};
```

#### `database.js`
- SQLite connection management
- Database initialization
- Connection pooling and error handling

#### `categories.js`
- Predefined grocery categories
- Category validation
- Localization support (French)

### 3. Data Layer (`models/`)

#### `GroceryItem.js`
**Repository Pattern Implementation**
```javascript
class GroceryItem {
    // Static methods (Repository interface)
    static async findAll()
    static async findById(id)
    static async findByArticle(article)
    static async findByBatchIdAndStatus(batchId, status)
    static async updateStatus(id, status)
    
    // Instance methods
    async save()
    async delete()
}
```

**Item States:**
- `confirming`: Temporary state during AI parsing confirmation
- `pending`: Active item, not yet being looked for
- `selected`: Currently looking for this item
- `found`: Item found (moved to completed list)
- `not_found`: Item not available

### 4. Service Layer (`services/`)

#### `groceryService.js`
**Core Business Logic**
- Item lifecycle management
- Batch processing for AI-parsed items
- Shopping list organization
- Status management

**Key Methods:**
```javascript
async getAllItemsSorted()           // Get organized shopping data
async confirmItemFromBatch(itemId)  // Confirm AI-parsed item
async updateItemStatus(id, status)  // Change item status
async clearFoundItems()             // Remove completed items
async clearSelection()              // Reset selected items to pending
```

#### `aiService.js`
**Google Gemini Integration**
- Natural language grocery list parsing
- Automatic categorization
- Quantity extraction
- French language support

**AI Workflow:**
1. User sends grocery text
2. AI parses into structured items
3. Each item gets category, quantity, article name
4. Items enter "confirming" state for user validation

#### `sessionService.js`
**Callback Session Management**
- Temporary storage for callback data
- Session-based callback routing
- Memory cleanup and TTL management

#### `loggerService.js`
**Monitoring and Logging**
- Activity logging
- Message update tracking
- Error reporting
- Optional status reporting to Telegram channel

### 5. Handler Layer (`handlers/`)

#### `commandHandlers.js`
**Telegram Command Processing**
- `/shop`: Shopping interface
- `/list`: Display current list
- `/clear`: Clear all items
- `/help`: Help information

#### `callbackHandlers.js`
**Button Interaction Processing**
- Callback query parsing
- Action routing and delegation
- Context-aware navigation
- Error handling

**Callback Actions:**
- `confirm_item`: Confirm AI-parsed item
- `change_cat`: Change item category
- `shop-category`: Enter category shopping mode
- `item-status`: Change item status
- `back-to-categories`: Navigation
- `clear-found`, `refresh`, `clear-selection`: List management

#### `messageHandlers.js`
**Text Message Processing**
- AI parsing trigger
- Authorization validation
- Message routing

### 6. Utility Layer (`utils/`)

#### `messageFormatter.js`
**Message and Keyboard Generation**
- HTML message formatting
- Inline keyboard creation
- Category-specific displays
- Shopping interface generation

## Data Flow

### 1. Adding Items (AI-Powered)

```
User Text Message
       ↓
messageHandlers.js → Authorization Check
       ↓
aiService.js → Google Gemini API → Parse & Categorize
       ↓
groceryService.js → Create items with status='confirming'
       ↓
messageFormatter.js → Confirmation interface
       ↓
User Confirms/Modifies → callbackHandlers.js
       ↓
groceryService.js → Status='pending' (active list)
```

### 2. Shopping Flow

```
/shop Command
       ↓
commandHandlers.js → Category Selection Interface
       ↓ (User selects category)
callbackHandlers.js → Category Management Interface
       ↓ (User changes item status)
callbackHandlers.js → Stay in category (smart navigation)
       ↓ (Category empty OR user clicks back)
callbackHandlers.js → Return to Category Selection
```

### 3. Status Management

```
Item Status Transitions:
pending → selected → found (removed from active list)
not_found → pending (retry)
```

## Database Schema

### `grocery_items` Table

```sql
CREATE TABLE grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    batch_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_status ON grocery_items(status);
CREATE INDEX idx_category ON grocery_items(category);
CREATE INDEX idx_batch_id ON grocery_items(batch_id);
```

## API Integrations

### Telegram Bot API
- **Webhook vs Polling**: Uses polling for development simplicity
- **Message Types**: Text messages, callback queries
- **Features Used**: Inline keyboards, HTML formatting, message editing

### Google Gemini API
- **Model**: gemini-pro
- **Input**: Raw French grocery text
- **Output**: Structured JSON with items, quantities, categories
- **Error Handling**: Graceful fallback for API failures

## Shopping Interface Architecture

### Two-State Navigation System

#### State 1: Category Selection
```
🛒 Shopping List - Select Category

[Full Categorized List Display]
──────────────────────────────
👇 Select a category to manage items:

[Category Buttons with counts]
[Action Buttons: Clear Found, Refresh, Clear Selection]
```

#### State 2: Category Management
```
🛒 Shopping List - [Category Name]

[Full Categorized List Display]
──────────────────────────────
📋 Managing: [Category] (X items)
👇 Click items below to change their status:

[Item Status Buttons for category]
[Back to Categories]
[Action Buttons: Clear Found, Refresh]
```

### Smart Navigation Logic

```javascript
// Context-aware navigation
if (in_category_view && category_has_items) {
    stay_in_category();
} else if (in_category_view && category_empty) {
    return_to_category_selection();
} else {
    refresh_category_selection();
}
```

## Development Workflow

### Local Development Setup

1. **Environment Setup**
```bash
# Copy environment template
cp env.example .env
# Edit with your tokens
```

2. **Docker Development**
```bash
# Build and run
./scripts/build.sh

# View logs
docker compose logs -f grocery-bot

# Debug mode
docker compose down
docker compose up
```

3. **Database Access**
```bash
# Access SQLite database
docker exec -it telegram-grocery-bot sqlite3 /app/data/grocery_bot.db
```

### Testing Workflow

1. **Manual Testing**
   - Send grocery lists in French
   - Test category navigation
   - Verify status transitions
   - Test edge cases (empty categories, etc.)

2. **AI Testing**
   - Various input formats
   - Quantity parsing accuracy
   - Category assignment validation

3. **UI Testing**
   - Button responsiveness
   - Message formatting
   - Navigation flow consistency

### Deployment

1. **Production Environment**
```bash
# Ensure .env is properly configured
# Run comprehensive build
./scripts/build.sh
```

2. **Data Persistence**
   - Database stored in Docker volume `grocery_data`
   - Automatic backups in deployment scripts
   - Volume inspection: `docker volume inspect grocery_data`

## Key Design Patterns

### 1. Repository Pattern (`models/`)
- Encapsulates data access logic
- Static methods for queries
- Instance methods for operations

### 2. Service Layer Pattern (`services/`)
- Business logic separation
- Cross-cutting concerns (logging, AI)
- Stateless service design

### 3. Handler Pattern (`handlers/`)
- Event-driven architecture
- Separation by input type
- Centralized error handling

### 4. Session Management Pattern
- Temporary state storage
- Callback data persistence
- Memory cleanup

### 5. Factory Pattern (`utils/messageFormatter.js`)
- Message generation
- Keyboard creation
- Context-aware formatting

## Troubleshooting

### Common Issues

1. **Bot Not Responding**
   - Check `TELEGRAM_TOKEN` validity
   - Verify bot is started: `/start` command
   - Check authorization settings

2. **AI Parsing Failures**
   - Verify `GOOGLE_API_KEY`
   - Check API quotas
   - Review error logs for API responses

3. **Database Issues**
   - Check Docker volume persistence
   - Verify database initialization
   - Review migration scripts

4. **Navigation Issues**
   - Check callback session validity
   - Verify regex patterns for category detection
   - Review context-aware navigation logic

### Debug Modes

1. **Verbose Logging**
   - Add console.log statements
   - Check Docker logs: `docker compose logs grocery-bot`

2. **Database Inspection**
   - Direct SQLite access
   - Query active items and statuses

3. **Callback Debugging**
   - Log callback data parsing
   - Verify session management

### Performance Considerations

1. **Database Optimization**
   - Indexed queries on status and category
   - Batch operations for AI confirmations
   - Regular cleanup of found items

2. **Memory Management**
   - Session cleanup
   - Bounded callback storage
   - Efficient message formatting

3. **API Rate Limiting**
   - Google Gemini API quotas
   - Telegram Bot API limits
   - Graceful error handling

---

## Contributing

When contributing to this project:

1. **Follow the established patterns** (Repository, Service Layer, Handler)
2. **Maintain separation of concerns** between layers
3. **Add appropriate error handling** and logging
4. **Test the complete user flow** after changes
5. **Update this documentation** for architectural changes

## Future Enhancements

- **Multi-language Support**: Extend beyond French
- **User Preferences**: Personal category customization
- **Shopping History**: Track and suggest frequently bought items
- **Voice Integration**: Voice message parsing
- **Shopping Analytics**: Usage patterns and insights 