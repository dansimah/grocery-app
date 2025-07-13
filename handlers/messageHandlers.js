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

            // Check for note editing session first
            const noteSession = await this.checkForNoteEditingSession(bot, msg);
            if (noteSession) {
                return; // Note editing handled, don't proceed with grocery parsing
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

    // Check if user is in note editing session
    static async checkForNoteEditingSession(bot, msg) {
        try {
            const chatId = msg.chat.id;
            const text = msg.text.trim();
            const userId = msg.from.id;
            
            // Look for active note editing sessions for this user
            const sessions = await sessionService.getUserSessions(userId);
            console.log(`🔍 Checking for note sessions for user ${userId}, found ${sessions.length} sessions`);
            
            for (const session of sessions) {
                const sessionData = session.getParsedData();
                console.log(`📝 Session data:`, sessionData);
                if (sessionData && sessionData.action === 'edit_note') {
                    // Found note editing session
                    console.log(`✅ Found note editing session for item ${sessionData.itemId}`);
                    await this.handleNoteUpdate(bot, msg, session, text);
                    return true; // Session handled
                }
            }
            
            return false; // No note editing session found
        } catch (error) {
            console.error('Error checking for note editing session:', error);
            return false;
        }
    }

    // Handle note update from text message
    static async handleNoteUpdate(bot, msg, session, newNote) {
        try {
            const chatId = msg.chat.id;
            const sessionData = session.getParsedData();
            const itemId = sessionData.itemId;
            const category = sessionData.category;
            const quantity = sessionData.quantity;
            
            console.log(`📝 Processing note update for item ${itemId}: "${newNote}"`);
            
            // Handle "clear" and "cancel" commands
            if (newNote.toLowerCase() === 'cancel') {
                await bot.sendMessage(chatId, '❌ Note editing cancelled.');
                await sessionService.deleteCallbackSession(session.id);
                return;
            }
            
            const finalNote = newNote.toLowerCase() === 'clear' ? '' : newNote;
            
            // Update the item with new note
            const success = await groceryService.editItem(itemId, category, quantity, finalNote);
            
            if (success) {
                const item = await groceryService.getItemForEdit(itemId);
                const noteText = finalNote ? ` (Note: ${finalNote})` : '';
                
                // Send confirmation
                await bot.sendMessage(chatId, 
                    `✅ Note updated for ${item.article} (x${item.quantity}) [${item.category}]${noteText}`,
                    { parse_mode: 'HTML' }
                );
                
                // Clean up the session
                await sessionService.deleteCallbackSession(session.id);
                
            } else {
                await bot.sendMessage(chatId, '❌ Failed to update note. Please try again.');
            }
            
        } catch (error) {
            console.error('Error handling note update:', error);
            await bot.sendMessage(msg.chat.id, '❌ Error updating note. Please try again.');
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