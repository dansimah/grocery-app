const groceryService = require('../services/groceryService');
const sessionService = require('../services/sessionService');
const MessageFormatter = require('../utils/messageFormatter');
const loggerService = require('../services/loggerService');

class MessageHandlers {
    // Handle text messages that contain grocery lists
    static async handleTextMessage(bot, msg) {
        try {
            const chatId = msg.chat.id;
            const messageId = msg.message_id;
            const text = msg.text;

            // Skip if it's a command
            if (text.startsWith('/')) {
                return;
            }

            // Check if this might be a note update (simple heuristic)
            if (text.length < 100 && !text.includes('\n')) {
                // Could be a note - check if user is in edit mode
                // For now, we'll just proceed with normal parsing
                // In a more sophisticated version, we could track edit sessions
            }

            // Keep the original text with newlines intact for proper line-by-line parsing
            const cleanedText = text.trim();

            // Send "parsing" message
            const parsingMessage = await bot.sendMessage(chatId, '🔄 Parsing your grocery list...');

            try {
                // Parse and auto-add items
                const { batchId, items } = await groceryService.parseItemsForConfirmation(cleanedText);

                if (items.length === 0) {
                    const newText = '❌ No valid grocery items found in your message.';
                    await loggerService.logMessageUpdate(
                        parsingMessage.message_id,
                        chatId,
                        'editMessageText',
                        '🔄 Parsing your grocery list...',
                        newText,
                        'No items found during parsing'
                    );
                    await bot.editMessageText(
                        newText,
                        {
                            chat_id: chatId,
                            message_id: parsingMessage.message_id
                        }
                    );
                    return;
                }

                // Log activity
                await loggerService.sendActivity(
                    msg.from, 
                    'Auto-adding grocery items', 
                    `Auto-added batch ${batchId} with ${items.length} items: ${items.map(item => item.article).join(', ')}`
                );

                // Create auto-add message
                const messageText = MessageFormatter.createAutoAddMessage(batchId, items);
                
                // Create keyboard with edit options
                const keyboard = MessageFormatter.createAutoAddKeyboard(batchId, items);

                // Edit the parsing message into auto-add message
                await loggerService.logMessageUpdate(
                    parsingMessage.message_id,
                    chatId,
                    'editMessageText',
                    '🔄 Parsing your grocery list...',
                    messageText,
                    `Auto-add interface for ${items.length} items`
                );
                await bot.editMessageText(messageText, {
                    chat_id: chatId,
                    message_id: parsingMessage.message_id,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });

            } catch (parseError) {
                console.error('Error parsing grocery items:', parseError);
                await loggerService.sendError(parseError, 'Grocery parsing');
                const errorText = MessageFormatter.createErrorMessage('Failed to parse grocery items. Please try again.');
                await loggerService.logMessageUpdate(
                    parsingMessage.message_id,
                    chatId,
                    'editMessageText',
                    '🔄 Parsing your grocery list...',
                    errorText,
                    `Parse error: ${parseError.message}`
                );
                await bot.editMessageText(
                    errorText,
                    {
                        chat_id: chatId,
                        message_id: parsingMessage.message_id,
                        parse_mode: 'HTML'
                    }
                );
            }

        } catch (error) {
            console.error('Error handling text message:', error);
            await bot.sendMessage(msg.chat.id, MessageFormatter.createErrorMessage(error.message), {
                parse_mode: 'HTML'
            });
        }
    }

    // Register message handlers
    static register(bot) {
        // Handle all text messages that are not commands
        bot.on('message', (msg) => {
            // Only handle text messages
            if (msg.text && !msg.text.startsWith('/')) {
                this.handleTextMessage(bot, msg);
            }
        });

        console.log('✅ Message handlers registered');
    }
}

module.exports = MessageHandlers; 