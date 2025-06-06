const groceryService = require('../services/groceryService');
const GroceryItem = require('../models/GroceryItem');
const MessageFormatter = require('../utils/messageFormatter');
const loggerService = require('../services/loggerService');
const { CATEGORIES } = require('../config/categories');

class CallbackHandlers {
    // Handle all callback queries
    static async handleCallbackQuery(bot, query) {
        try {
            const callbackData = query.data;
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;

            console.log('📞 Callback received:', callbackData);

            // Parse callback data
            const [action, ...params] = callbackData.split(':');
            console.log('🔍 Parsed callback - Action:', action, 'Params:', params);

            // Route based on action
            switch (action) {
                case 'confirm_item':
                    await this.handleConfirmItem(bot, query, params[0], params[1]); // batchId, itemId
                    break;
                
                case 'change_cat':
                    await this.handleChangeCategory(bot, query, params[0], params[1]); // batchId, itemId
                    break;
                
                case 'update_cat':
                    await this.handleUpdateCategory(bot, query, params[0], params[1], params[2], params[3]); // batchId, itemId, newCategory, originalMessageId
                    break;
                
                case 'upd_cat':
                    await this.handleUpdateCategoryByIndex(bot, query, params[0], params[1], params[2], params[3]); // batchId, itemId, categoryIndex, originalMessageId
                    break;
                
                case 'cancel_batch':
                    await this.handleCancelBatch(bot, query, params[0]);
                    break;
                
                case 'item-status':
                    await this.handleItemStatus(bot, query, params[0], params[1]);
                    break;
                
                case 'clear-found':
                    await this.handleClearFound(bot, query);
                    break;
                
                case 'refresh':
                    await this.handleRefresh(bot, query);
                    break;
                
                case 'clear-selection':
                    await this.handleClearSelection(bot, query);
                    break;
                
                case 'shop-category':
                    await this.handleShopCategory(bot, query, params[0]); // category name
                    break;
                
                case 'back-to-categories':
                    await this.handleBackToCategories(bot, query);
                    break;
                
                default:
                    await bot.answerCallbackQuery(query.id, {
                        text: '❌ Unknown action',
                        show_alert: true
                    });
            }

        } catch (error) {
            console.error('Error handling callback query:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ An error occurred',
                show_alert: true
            });
        }
    }

    // Handle confirming an item from batch
    static async handleConfirmItem(bot, query, batchId, itemId) {
        try {
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;

            // Verify the item exists and belongs to the specified batch
            const tempItem = await GroceryItem.findById(itemId);
            if (!tempItem || tempItem.batch_id !== batchId) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Item not found or batch mismatch',
                    show_alert: true
                });
                return;
            }

            // Confirm the item
            const confirmedItem = await groceryService.confirmItemFromBatch(itemId);
            
            if (!confirmedItem) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Failed to confirm item',
                    show_alert: true
                });
                return;
            }
            
            console.log('🔍 Confirmed item status after confirmation:', confirmedItem.status, 'batch_id:', confirmedItem.batch_id);
            
            // Log activity
            await loggerService.sendActivity(
                query.from, 
                'Added grocery item', 
                `Added ${confirmedItem.article} (x${confirmedItem.quantity}) to ${confirmedItem.category}`
            );

            await bot.answerCallbackQuery(query.id, {
                text: `✅ ${confirmedItem.article} → ${confirmedItem.category}`,
                show_alert: false
            });

            // Get remaining items in the batch (AFTER confirmation so the confirmed item is excluded)
            const remainingItems = await GroceryItem.findByBatchIdAndStatus(batchId, 'confirming');
            
            // Get all added items from this batch (items with status 'pending' and same batch_id)
            const addedItems = await GroceryItem.findByBatchIdAndStatus(batchId, 'pending');
            console.log('🔍 Debug - Remaining items:', remainingItems.length, 'Added items:', addedItems.length);
            console.log('🔍 Added items details:', addedItems.map(item => `${item.article} (${item.status})`));

            if (remainingItems.length === 0) {
                // No more items, show final success message with all added items
                let messageText = '';
                addedItems.forEach(item => {
                    messageText += `✅ ${MessageFormatter.escapeHtml(item.article)} (x${item.quantity}) → ${item.category}\n`;
                });
                messageText += '\n🎉 All items processed!';

                await loggerService.logMessageUpdate(
                    messageId,
                    chatId,
                    'editMessageText',
                    query.message.text,
                    messageText,
                    `Batch ${batchId} complete - all items processed (callback: confirm_item:${batchId}:${itemId})`
                );
                await bot.editMessageText(messageText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML'
                });
            } else {
                // Update message to show all added items and remaining buttons
                const messageText = MessageFormatter.createBatchConfirmationMessage(batchId, addedItems);
                console.log('🔍 Created message text:', messageText);
                const keyboard = MessageFormatter.createBatchConfirmationKeyboard(batchId, remainingItems);

                await loggerService.logMessageUpdate(
                    messageId,
                    chatId,
                    'editMessageText',
                    query.message.text,
                    messageText,
                    `Batch ${batchId} - confirmed ${confirmedItem.article}, ${remainingItems.length} items remaining (callback: confirm_item:${batchId}:${itemId})`
                );
                await bot.editMessageText(messageText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            }

        } catch (error) {
            console.error('Error confirming item:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to add item',
                show_alert: true
            });
        }
    }

    // Handle category change request
    static async handleChangeCategory(bot, query, batchId, itemId) {
        try {
            const item = await GroceryItem.findById(itemId);
            if (!item || item.batch_id !== batchId) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Item not found or batch mismatch',
                    show_alert: true
                });
                return;
            }

            // Create category selection keyboard with original message ID
            const originalMessageId = query.message.message_id;
            const keyboard = MessageFormatter.createBatchCategoryKeyboard(batchId, itemId, originalMessageId);

            // Send category selection message
            const categoryMessage = await bot.sendMessage(query.message.chat.id, 
                `Select a new category for ${MessageFormatter.escapeHtml(item.article)}:`, {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

            await bot.answerCallbackQuery(query.id);

        } catch (error) {
            console.error('Error handling category change:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to show categories',
                show_alert: true
            });
        }
    }

    // Handle category update
    static async handleUpdateCategory(bot, query, batchId, itemId, newCategory, originalMessageId) {
        try {
            const item = await GroceryItem.findById(itemId);
            if (!item || item.batch_id !== batchId) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Item not found or batch mismatch',
                    show_alert: true
                });
                return;
            }

            // Update the item's category
            item.category = newCategory;
            await item.save();

            await bot.answerCallbackQuery(query.id, {
                text: `✅ Updated ${item.article} category to ${newCategory}`,
                show_alert: false
            });

            // Delete the category selection message
            await bot.deleteMessage(query.message.chat.id, query.message.message_id);

            // Update the original confirmation message with new keyboard showing updated category
            if (originalMessageId) {
                const batchItems = await GroceryItem.findByBatchIdAndStatus(batchId, 'confirming');
                const keyboard = MessageFormatter.createBatchConfirmationKeyboard(batchId, batchItems);

                try {
                    await loggerService.logMessageUpdate(
                        parseInt(originalMessageId),
                        query.message.chat.id,
                        'editMessageReplyMarkup',
                        '',
                        JSON.stringify(keyboard),
                        `Updated keyboard after category change: ${item.article} → ${newCategory} (callback: update_cat:${batchId}:${itemId}:${newCategory}:${originalMessageId})`
                    );
                    await bot.editMessageReplyMarkup({
                        inline_keyboard: keyboard
                    }, {
                        chat_id: query.message.chat.id,
                        message_id: parseInt(originalMessageId)
                    });
                } catch (editError) {
                    console.error('Error updating original message keyboard:', editError);
                    // If we can't update the keyboard, that's okay - the category is still updated in the database
                }
            }
            
                } catch (error) {
            console.error('Error updating category:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to update category',
                show_alert: true
            });
        }
    }

    // Handle category update using category index (for more compact callbacks)
    static async handleUpdateCategoryByIndex(bot, query, batchId, itemId, categoryIndex, originalMessageId) {
        try {
            // Convert category index back to category name
            const categoryIdx = parseInt(categoryIndex);
            if (categoryIdx < 0 || categoryIdx >= CATEGORIES.length) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Invalid category',
                    show_alert: true
                });
                return;
            }
            const newCategory = CATEGORIES[categoryIdx];

            // Find the item
            const item = await GroceryItem.findById(itemId);
            if (!item || item.batch_id !== batchId) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Item not found or batch mismatch',
                    show_alert: true
                });
                return;
            }

            // Update the item's category
            item.category = newCategory;
            await item.save();

            await bot.answerCallbackQuery(query.id, {
                text: `✅ Updated ${item.article} category to ${newCategory}`,
                show_alert: false
            });

            // Delete the category selection message
            await bot.deleteMessage(query.message.chat.id, query.message.message_id);

            // Update the original confirmation message with new keyboard showing updated category
            if (originalMessageId) {
                const batchItems = await GroceryItem.findByBatchIdAndStatus(batchId, 'confirming');
                const keyboard = MessageFormatter.createBatchConfirmationKeyboard(batchId, batchItems);

                try {
                    await loggerService.logMessageUpdate(
                        parseInt(originalMessageId),
                        query.message.chat.id,
                        'editMessageReplyMarkup',
                        '',
                        JSON.stringify(keyboard),
                        `Updated keyboard after category change: ${item.article} → ${newCategory} (callback: upd_cat:${batchId}:${itemId}:${categoryIndex}:${originalMessageId})`
                    );
                    await bot.editMessageReplyMarkup({
                        inline_keyboard: keyboard
                    }, {
                        chat_id: query.message.chat.id,
                        message_id: parseInt(originalMessageId)
                    });
                } catch (editError) {
                    console.error('Error updating original message keyboard:', editError);
                    // If we can't update the keyboard, that's okay - the category is still updated in the database
                }
            }
            
        } catch (error) {
            console.error('Error updating category by index:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to update category',
                show_alert: true
            });
        }
    }

    // Handle cancelling remaining items in batch
    static async handleCancelBatch(bot, query, batchId) {
        try {
            // Get all items from the batch to show what was added vs cancelled
            const allBatchItems = await GroceryItem.findByBatchId(batchId);
            
            // Separate confirmed items (already added) from remaining items (to be cancelled)
            const addedItems = allBatchItems.filter(item => item.status === 'pending');
            const remainingItems = allBatchItems.filter(item => item.status === 'confirming');
            
            // Cancel only the remaining unconfirmed items
            const deletedCount = await groceryService.cancelBatch(batchId);
            
            // Create summary message
            let messageText = '';
            
            // Show added items
            if (addedItems.length > 0) {
                addedItems.forEach(item => {
                    messageText += `✅ ${MessageFormatter.escapeHtml(item.article)} (x${item.quantity}) → ${item.category}\n`;
                });
                messageText += '\n';
            }
            
            // Show cancelled items
            if (remainingItems.length > 0) {
                remainingItems.forEach(item => {
                    messageText += `❌ ${MessageFormatter.escapeHtml(item.article)} (x${item.quantity}) → ${item.category}\n`;
                });
            } else {
                messageText += '❌ No remaining items to cancel';
            }
            
            await bot.answerCallbackQuery(query.id, {
                text: `❌ Cancelled ${deletedCount} remaining items`,
                show_alert: false
            });

            await loggerService.logMessageUpdate(
                query.message.message_id,
                query.message.chat.id,
                'editMessageText',
                query.message.text,
                messageText,
                `Batch ${batchId} cancelled - ${addedItems.length} items added, ${remainingItems.length} items cancelled`
            );
            await bot.editMessageText(messageText, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });

        } catch (error) {
            console.error('Error cancelling batch:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to cancel',
                show_alert: true
            });
        }
    }

    // Handle item status change (for shopping mode)
    static async handleItemStatus(bot, query, itemId, newStatus) {
        try {
            const success = await groceryService.updateItemStatus(itemId, newStatus);
            
            if (success) {
                // Check if we're in a category view by examining the current message
                const currentMessage = query.message.text;
                const categoryMatch = currentMessage.match(/🛒 <b>Shopping List - ([^<]+)<\/b>/);
                
                if (categoryMatch) {
                    // We're in a category view, refresh the same category
                    const category = categoryMatch[1];
                    await this.handleShopCategory(bot, query, category);
                } else {
                    // We're in the general view, go back to category selection
                    await this.handleBackToCategories(bot, query);
                }
                
                await bot.answerCallbackQuery(query.id);
            } else {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Failed to update item',
                    show_alert: true
                });
            }

        } catch (error) {
            console.error('Error updating item status:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error updating item',
                show_alert: true
            });
        }
    }

    // Handle clearing found items
    static async handleClearFound(bot, query) {
        try {
            const deletedCount = await groceryService.clearFoundItems();
            
            await bot.answerCallbackQuery(query.id, {
                text: `🗑️ Cleared ${deletedCount} found items`,
                show_alert: false
            });

            // Refresh back to category selection
            await this.handleBackToCategories(bot, query);

        } catch (error) {
            console.error('Error clearing found items:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to clear found items',
                show_alert: true
            });
        }
    }

    // Handle refresh
    static async handleRefresh(bot, query) {
        try {
            await bot.answerCallbackQuery(query.id, {
                text: '🔄 Refreshing list...',
                show_alert: false
            });

            // Refresh back to category selection
            await this.handleBackToCategories(bot, query);

        } catch (error) {
            console.error('Error refreshing list:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to refresh',
                show_alert: true
            });
        }
    }

    // Handle clearing selection
    static async handleClearSelection(bot, query) {
        try {
            const updatedCount = await groceryService.clearSelection();
            
            await bot.answerCallbackQuery(query.id, {
                text: `⬅️ Reset ${updatedCount} items to pending`,
                show_alert: false
            });

            // Refresh back to category selection
            await this.handleBackToCategories(bot, query);

        } catch (error) {
            console.error('Error clearing selection:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to clear selection',
                show_alert: true
            });
        }
    }

    // Handle category selection in shop mode
    static async handleShopCategory(bot, query, category) {
        try {
            const groceryData = await groceryService.getAllItemsSorted();
            
            const messageText = MessageFormatter.createCategoryShoppingMessage(groceryData, category);
            const CommandHandlers = require('./commandHandlers');
            const keyboard = CommandHandlers.createCategoryShoppingKeyboard(
                groceryData.activeItems, 
                groceryData.foundItems, 
                category
            );

            await bot.editMessageText(messageText, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

            await bot.answerCallbackQuery(query.id, {
                text: `📋 ${category}`,
                show_alert: false
            });

        } catch (error) {
            console.error('Error handling shop category:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error loading category',
                show_alert: true
            });
        }
    }

    // Handle back to categories navigation
    static async handleBackToCategories(bot, query) {
        try {
            const groceryData = await groceryService.getAllItemsSorted();
            
            const messageText = MessageFormatter.createCategorySelectionMessage(groceryData);
            const CommandHandlers = require('./commandHandlers');
            const keyboard = CommandHandlers.createCategorySelectionKeyboard(groceryData);

            await bot.editMessageText(messageText, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

            await bot.answerCallbackQuery(query.id, {
                text: '🔙 Categories',
                show_alert: false
            });

        } catch (error) {
            console.error('Error handling back to categories:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error loading categories',
                show_alert: true
            });
        }
    }

    // Register callback handlers
    static register(bot) {
        bot.on('callback_query', (query) => {
            this.handleCallbackQuery(bot, query);
        });

        console.log('✅ Callback handlers registered');
    }
}

module.exports = CallbackHandlers; 