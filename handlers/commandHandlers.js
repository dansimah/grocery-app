const groceryService = require('../services/groceryService');
const sessionService = require('../services/sessionService');
const MessageFormatter = require('../utils/messageFormatter');
const loggerService = require('../services/loggerService');

class CommandHandlers {
    // Handle /shop command - displays category selection first
    static async handleShopCommand(msg, match, bot) {
        try {
            // Validate message structure
            if (!msg || !msg.chat || !msg.chat.id) {
                console.error('Invalid message structure:', msg);
                return;
            }

            const chatId = msg.chat.id;
            const messageId = msg.message_id;

            // Log activity (only if logger service is available and msg.from exists)
            if (msg.from) {
                await loggerService.sendActivity(msg.from, '/shop command', `Opened interactive shopping list`);
            }

            // Get grocery list data to show counts
            const groceryData = await groceryService.getAllItemsSorted();
            
            // Create category selection message and keyboard
            const messageText = MessageFormatter.createCategorySelectionMessage(groceryData);
            const keyboard = this.createCategorySelectionKeyboard(groceryData);

            // Send message with category selection
            await bot.sendMessage(chatId, messageText, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            console.error('Error handling /shop command:', error);
            try {
                await loggerService.sendError(error, '/shop command');
            } catch (logError) {
                console.error('Logger error:', logError);
            }
            
            // Safe error message sending
            if (msg && msg.chat && msg.chat.id) {
                await bot.sendMessage(msg.chat.id, MessageFormatter.createErrorMessage(error.message));
            } else {
                console.error('Cannot send error message - invalid message structure');
            }
        }
    }

    // Handle /list command - displays simple text list
    static async handleListCommand(msg, match, bot) {
        try {
            // Validate message structure
            if (!msg || !msg.chat || !msg.chat.id) {
                console.error('Invalid message structure:', msg);
                return;
            }

            const chatId = msg.chat.id;
            
            // Log activity (only if logger service is available and msg.from exists)
            if (msg.from) {
                await loggerService.sendActivity(msg.from, '/list command', `Viewed grocery list`);
            }
            
            // Get formatted grocery list
            const formattedList = await groceryService.getFormattedList();
            
            await bot.sendMessage(chatId, formattedList, {
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Error handling /list command:', error);
            try {
                await loggerService.sendError(error, '/list command');
            } catch (logError) {
                console.error('Logger error:', logError);
            }
            
            // Safe error message sending
            if (msg && msg.chat && msg.chat.id) {
                await bot.sendMessage(msg.chat.id, MessageFormatter.createErrorMessage(error.message));
            } else {
                console.error('Cannot send error message - invalid message structure');
            }
        }
    }

    // Handle /clear command - clear all items (optional feature)
    static async handleClearCommand(msg, match, bot) {
        try {
            const chatId = msg.chat.id;
            
            const deletedCount = await groceryService.clearAllItems();
            
            await bot.sendMessage(chatId, `🗑️ Cleared ${deletedCount} items from grocery list`);

        } catch (error) {
            console.error('Error handling /clear command:', error);
            await bot.sendMessage(msg.chat.id, MessageFormatter.createErrorMessage(error.message));
        }
    }

    // Handle /help command
    static async handleHelpCommand(msg, match, bot) {
        const helpText = `
🛒 **Grocery Bot Help**

**Commands:**
• \`/shop\` - Interactive shopping mode with buttons
• \`/list\` - View your grocery list  
• \`/clear\` - Clear entire grocery list
• \`/help\` - Show this help message

**Adding Items:**
Just send me a grocery list in French and I'll parse it automatically!

**Examples:**
\`\`\`
2 pommes
1kg de tomates
pain
lait
\`\`\`

**Shopping Mode:**
• \`•\` = Pending item (click to select)
• \`➡️\` = Selected (looking for this item)  
• \`🚫\` = Not found (click to reset)
• \`✅\` = Found (will be removed when cleared)

**Interactive Features:**
• Change item categories
• Mark items as found/not found
• Clear completed items
• Reset selections
        `;

        try {
            await bot.sendMessage(msg.chat.id, helpText, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Error handling /help command:', error);
            await bot.sendMessage(msg.chat.id, 'Error displaying help');
        }
    }

    // Create category selection keyboard
    static createCategorySelectionKeyboard(groceryData) {
        const CATEGORIES = require('../config/categories').CATEGORIES;
        const inlineKeyboard = [];

        // Get category counts
        const categoryCounts = this.getCategoryCounts(groceryData.activeItems);

        // Add category buttons
        for (const category of CATEGORIES) {
            const count = categoryCounts[category] || 0;
            if (count > 0) {
                inlineKeyboard.push([{
                    text: `${category} (${count})`,
                    callback_data: `shop-category:${category}`
                }]);
            }
        }

        // Add action buttons
        const actionButtons = [];
        
        // Show Clear Found Items button only if there are found items
        if (groceryData.foundItems && groceryData.foundItems.length > 0) {
            actionButtons.push({ text: '🗑️ Clear Found Items', callback_data: 'clear-found' });
        }
        
        actionButtons.push({ text: '🔄 Refresh List', callback_data: 'refresh' });
        
        if (actionButtons.length > 0) {
            inlineKeyboard.push(actionButtons);
        }

        // Add Clear Selection button only if there are active items
        if (groceryData.activeItems && groceryData.activeItems.length > 0) {
            inlineKeyboard.push([
                { text: '⬅️ Clear Selection', callback_data: 'clear-selection' }
            ]);
        }

        return inlineKeyboard;
    }

    // Get count of items per category
    static getCategoryCounts(activeItems) {
        const counts = {};
        if (activeItems && Array.isArray(activeItems)) {
            for (const item of activeItems) {
                counts[item.category] = (counts[item.category] || 0) + 1;
            }
        }
        return counts;
    }

    // Create category-specific shopping keyboard
    static createCategoryShoppingKeyboard(activeItems = [], foundItems = [], selectedCategory) {
        const inlineKeyboard = [];

        // Filter items by category
        const categoryItems = activeItems.filter(item => item.category === selectedCategory);

        // Add buttons for category items
        if (categoryItems && Array.isArray(categoryItems)) {
            for (const item of categoryItems) {
                if (!item || !item.id) {
                    console.error('Invalid item or missing ID:', item);
                    continue;
                }

                let mainButtonText = '';
                let nextStatus = '';

                switch (item.status) {
                    case 'selected':
                        mainButtonText = `➡️ ${item.article} (x${item.quantity})`;
                        nextStatus = 'found';
                        break;
                    case 'not_found':
                        mainButtonText = `🚫 ${item.article} (x${item.quantity})`;
                        nextStatus = 'pending';
                        break;
                    default: // 'pending'
                        mainButtonText = `• ${item.article} (x${item.quantity})`;
                        nextStatus = 'selected';
                        break;
                }

                // Add note to button text if it exists
                if (item.note) {
                    mainButtonText += ` (Note: ${item.note})`;
                }

                inlineKeyboard.push([{
                    text: mainButtonText,
                    callback_data: `item-status:${item.id}:${nextStatus}`
                }]);
            }
        }

        // Add back button
        inlineKeyboard.push([
            { text: '⬅️ Back to Categories', callback_data: 'back-to-categories' }
        ]);

        // Add action buttons
        const actionButtons = [];
        
        // Show Clear Found Items button only if there are found items
        if (foundItems && foundItems.length > 0) {
            actionButtons.push({ text: '🗑️ Clear Found Items', callback_data: 'clear-found' });
        }
        
        actionButtons.push({ text: '🔄 Refresh List', callback_data: 'refresh' });
        
        if (actionButtons.length > 0) {
            inlineKeyboard.push(actionButtons);
        }

        return inlineKeyboard;
    }

    // Register all command handlers
    static register(bot) {
        bot.onText(/\/shop/, (msg, match) => this.handleShopCommand(msg, match, bot));
        bot.onText(/\/list/, (msg, match) => this.handleListCommand(msg, match, bot)); 
        bot.onText(/\/clear/, (msg, match) => this.handleClearCommand(msg, match, bot));
        bot.onText(/\/help/, (msg, match) => this.handleHelpCommand(msg, match, bot));
        bot.onText(/\/start/, (msg, match) => this.handleHelpCommand(msg, match, bot)); // /start shows help too
        
        console.log('✅ Command handlers registered');
    }
}

module.exports = CommandHandlers; 