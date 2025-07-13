const { BOT_CONFIG } = require('../config/bot');

class LoggerService {
    constructor() {
        this.bot = null;
        this.statusChatId = BOT_CONFIG.STATUS_CHAT_ID;
    }

    // Initialize with bot instance
    init(bot) {
        this.bot = bot;
        if (this.statusChatId) {
            console.log(`📡 Status reporting enabled for chat: ${this.statusChatId}`);
        }
    }

    // Send status message to Telegram group
    async sendStatus(message, emoji = '📊') {
        if (!this.bot || !this.statusChatId || !BOT_CONFIG.STATUS_REPORTING_ENABLED) {
            return;
        }

        try {
            const formattedMessage = `${emoji} <b>Bot Status</b>\n\n${message}`;
            await this.bot.sendMessage(this.statusChatId, formattedMessage, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending status message:', error);
        }
    }

    // Send error log to Telegram group
    async sendError(error, context = '') {
        if (!this.bot || !this.statusChatId || !BOT_CONFIG.STATUS_REPORTING_ENABLED) {
            return;
        }

        try {
            const errorMessage = `❌ <b>Bot Error</b>\n\n` +
                `<b>Context:</b> ${context}\n` +
                `<b>Error:</b> <code>${error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>\n` +
                `<b>Time:</b> ${new Date().toISOString()}`;

            await this.bot.sendMessage(this.statusChatId, errorMessage, {
                parse_mode: 'HTML'
            });
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }

    // Send activity log to Telegram group
    async sendActivity(user, action, details = '') {
        if (!this.bot || !this.statusChatId || !BOT_CONFIG.STATUS_REPORTING_ENABLED) {
            return;
        }

        try {
            const username = user.username || user.first_name || 'Unknown';
            const activityMessage = `🔄 <b>Bot Activity</b>\n\n` +
                `<b>User:</b> ${username}\n` +
                `<b>Action:</b> ${action}\n` +
                `<b>Details:</b> ${details}\n` +
                `<b>Time:</b> ${new Date().toISOString()}`;

            await this.bot.sendMessage(this.statusChatId, activityMessage, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending activity message:', error);
        }
    }

    // Send startup message
    async sendStartup() {
        const message = `🚀 <b>Grocery Bot Started</b>\n\n` +
            `<b>Database:</b> SQLite\n` +
            `<b>Authorized Users:</b> ${BOT_CONFIG.AUTHORIZED_USERS.length > 0 ? BOT_CONFIG.AUTHORIZED_USERS.join(', ') : 'All users'}\n` +
            `<b>Time:</b> ${new Date().toISOString()}`;

        await this.sendStatus(message, '🚀');
    }

    // Send shutdown message
    async sendShutdown() {
        const message = `🛑 <b>Grocery Bot Shutting Down</b>\n\n` +
            `<b>Time:</b> ${new Date().toISOString()}`;

        await this.sendStatus(message, '🛑');
    }

    // Send daily summary (can be called periodically)
    async sendDailySummary(stats) {
        const message = `📈 <b>Daily Summary</b>\n\n` +
            `<b>Items Added:</b> ${stats.itemsAdded || 0}\n` +
            `<b>Commands Used:</b> ${stats.commandsUsed || 0}\n` +
            `<b>Active Users:</b> ${stats.activeUsers || 0}\n` +
            `<b>Date:</b> ${new Date().toDateString()}`;

        await this.sendStatus(message, '📈');
    }

    // Log method that both console logs and sends to Telegram
    async log(level, message, context = '', sendToTelegram = true) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        // Always log to console
        console.log(logMessage);

        // Send to Telegram based on level and settings
        if (sendToTelegram && this.bot && this.statusChatId && BOT_CONFIG.STATUS_REPORTING_ENABLED) {
            let emoji = '📝';
            switch (level.toLowerCase()) {
                case 'error':
                    emoji = '❌';
                    break;
                case 'warn':
                case 'warning':
                    emoji = '⚠️';
                    break;
                case 'info':
                    emoji = 'ℹ️';
                    break;
                case 'success':
                    emoji = '✅';
                    break;
            }

            const telegramMessage = `${emoji} <b>${level.toUpperCase()}</b>\n\n` +
                `<b>Message:</b> ${message}\n` +
                (context ? `<b>Context:</b> ${context}\n` : '') +
                `<b>Time:</b> ${timestamp}`;

            try {
                await this.bot.sendMessage(this.statusChatId, telegramMessage, {
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error('Error sending log to Telegram:', error);
            }
        }
    }

    // Log message updates for debugging
    async logMessageUpdate(messageId, chatId, updateType, oldContent = '', newContent = '', context = '') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] MESSAGE_UPDATE: ${updateType} - Chat: ${chatId}, Message: ${messageId}`;
        
        // Always log to console with details
        console.log(logMessage);
        if (oldContent && newContent) {
            console.log(`  Old: ${oldContent.substring(0, 100)}${oldContent.length > 100 ? '...' : ''}`);
            console.log(`  New: ${newContent.substring(0, 100)}${newContent.length > 100 ? '...' : ''}`);
        }
        if (context) {
            console.log(`  Context: ${context}`);
        }

        // Send detailed info to Telegram if enabled
        if (this.bot && this.statusChatId && BOT_CONFIG.STATUS_REPORTING_ENABLED) {
            try {
                const telegramMessage = `🔄 <b>Message Update</b>\n\n` +
                    `<b>Type:</b> ${updateType}\n` +
                    `<b>Chat ID:</b> <code>${chatId}</code>\n` +
                    `<b>Message ID:</b> <code>${messageId}</code>\n` +
                    (context ? `<b>Context:</b> ${context.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n` : '') +
                    (oldContent ? `<b>Old Content:</b> <code>${oldContent.substring(0, 100).replace(/</g, '&lt;').replace(/>/g, '&gt;')}${oldContent.length > 100 ? '...' : ''}</code>\n` : '') +
                    (newContent ? `<b>New Content:</b> <code>${newContent.substring(0, 100).replace(/</g, '&lt;').replace(/>/g, '&gt;')}${newContent.length > 100 ? '...' : ''}</code>\n` : '') +
                    `<b>Time:</b> ${timestamp}`;

                await this.bot.sendMessage(this.statusChatId, telegramMessage, {
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error('Error sending message update log to Telegram:', error);
            }
        }
    }

    // Convenience methods
    async info(message, context = '', sendToTelegram = false) {
        await this.log('info', message, context, sendToTelegram);
    }

    async success(message, context = '', sendToTelegram = true) {
        await this.log('success', message, context, sendToTelegram);
    }

    async warn(message, context = '', sendToTelegram = true) {
        await this.log('warn', message, context, sendToTelegram);
    }

    async error(message, context = '', sendToTelegram = true) {
        await this.log('error', message, context, sendToTelegram);
    }
}

// Create singleton instance
const loggerService = new LoggerService();

module.exports = loggerService; 