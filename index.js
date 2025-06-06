const TelegramBot = require('node-telegram-bot-api');

// Configuration
const { BOT_CONFIG, isAuthorized } = require('./config/bot');
const database = require('./config/database');

// Handlers
const CommandHandlers = require('./handlers/commandHandlers');
const MessageHandlers = require('./handlers/messageHandlers');
const CallbackHandlers = require('./handlers/callbackHandlers');

// Services
const sessionService = require('./services/sessionService');
const loggerService = require('./services/loggerService');

class GroceryBot {
    constructor() {
        this.bot = null;
    }

    async initialize() {
        try {
            console.log('🚀 Starting Grocery Bot...');

            // Validate configuration
            if (!BOT_CONFIG.TELEGRAM_TOKEN) {
                throw new Error('TELEGRAM_TOKEN is required');
            }

            if (!BOT_CONFIG.GOOGLE_API_KEY) {
                throw new Error('GOOGLE_API_KEY is required');
            }

            // Initialize database
            await database.initialize();

            // Create bot instance
            this.bot = new TelegramBot(BOT_CONFIG.TELEGRAM_TOKEN, { 
                polling: BOT_CONFIG.POLLING 
            });

            // Initialize logger with bot instance
            loggerService.init(this.bot);

            // Setup middleware for authorization
            this.setupMiddleware();

            // Register handlers
            this.registerHandlers();

            // Start periodic session cleanup
            sessionService.startPeriodicCleanup(1); // Every hour

            // Setup graceful shutdown
            this.setupGracefulShutdown();

            console.log('✅ Grocery Bot initialized successfully!');
            console.log(`📊 Database: SQLite`);
            console.log(`🔑 Authorized users: ${BOT_CONFIG.AUTHORIZED_USERS.length > 0 ? BOT_CONFIG.AUTHORIZED_USERS.join(', ') : 'All users'}`);

            // Send startup notification
            await loggerService.sendStartup();

        } catch (error) {
            console.error('❌ Failed to initialize bot:', error);
            throw error;
        }
    }

    setupMiddleware() {
        // Authorization middleware for messages
        this.bot.on('message', (msg) => {
            const user = msg.from;
            if (!user) {
                console.log('🚫 Message with no user information');
                return;
            }
            if (!isAuthorized(user)) {
                console.log(`🚫 Unauthorized access attempt from: ${user.username || user.first_name || 'Unknown'}`);
                this.bot.sendMessage(msg.chat.id, '❌ You are not authorized to use this bot.');
                return;
            }
        });

        // Authorization middleware for callback queries
        this.bot.on('callback_query', (query) => {
            const user = query.from;
            if (!user) {
                console.log('🚫 Callback query with no user information');
                return;
            }
            if (!isAuthorized(user)) {
                console.log(`🚫 Unauthorized callback attempt from: ${user.username || user.first_name || 'Unknown'}`);
                this.bot.answerCallbackQuery(query.id, {
                    text: '❌ You are not authorized to use this bot.',
                    show_alert: true
                });
                return;
            }
        });

        console.log('✅ Authorization middleware setup complete');
    }

    registerHandlers() {
        try {
            // Register all handlers
            CommandHandlers.register(this.bot);
            MessageHandlers.register(this.bot);
            CallbackHandlers.register(this.bot);

            // Error handling
            this.bot.on('error', (error) => {
                console.error('Bot error:', error);
                loggerService.sendError(error, 'Bot Error');
            });

            this.bot.on('polling_error', (error) => {
                console.error('Polling error:', error);
                loggerService.sendError(error, 'Polling Error');
            });

            console.log('✅ All handlers registered successfully');

        } catch (error) {
            console.error('❌ Failed to register handlers:', error);
            throw error;
        }
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(`\n📡 Received ${signal}. Gracefully shutting down...`);
            
            try {
                // Send shutdown notification
                await loggerService.sendShutdown();

                // Stop polling
                if (this.bot) {
                    await this.bot.stopPolling();
                    console.log('✅ Bot polling stopped');
                }

                // Close database connection
                await database.close();

                console.log('✅ Grocery Bot shutdown complete');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                await loggerService.sendError(error, 'Shutdown Error');
                process.exit(1);
            }
        };

        // Handle various shutdown signals
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });
    }
}

// Create and start the bot
const bot = new GroceryBot();

bot.initialize().catch((error) => {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
});

module.exports = bot; 