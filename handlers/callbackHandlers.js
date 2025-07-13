const groceryService = require('../services/groceryService');
const GroceryItem = require('../models/GroceryItem');
const MessageFormatter = require('../utils/messageFormatter');
const loggerService = require('../services/loggerService');
const { CATEGORIES } = require('../config/categories');
const CommandHandlers = require('./commandHandlers');

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
                
                case 'edit_item':
                    await this.handleEditItem(bot, query, params[0], params[1]); // itemId, batchId
                    break;
                
                case 'update_item':
                    await this.handleUpdateItem(bot, query, params[0], params[1], params[2], params[3]); // itemId, category, quantity, note
                    break;
                
                case 'update_qty':
                    await this.handleUpdateQuantity(bot, query, params[0], params[1], params[2], params[3]); // itemId, category, quantity, note
                    break;
                
                case 'edit_note':
                    await this.handleEditNote(bot, query, params[0], params[1], params[2]); // itemId, category, quantity
                    break;
                
                case 'save_edit':
                    await this.handleSaveEdit(bot, query, params[0], params[1], params[2], params[3]); // itemId, category, quantity, note
                    break;
                
                case 'cancel_edit':
                    await this.handleCancelEdit(bot, query, params[0]); // itemId
                    break;
                
                case 'back_to_edit_list':
                    await this.handleBackToEditList(bot, query, params[0]); // batchId
                    break;
                
                case 'noop':
                    await bot.answerCallbackQuery(query.id, { text: '' });
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

    // Handle confirming an item from batch (updated for auto-add workflow)
    static async handleConfirmItem(bot, query, batchId, itemId) {
        try {
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;

            // Verify the item exists and belongs to the specified batch
            const item = await GroceryItem.findById(itemId);
            if (!item || item.batch_id !== batchId) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Item not found or batch mismatch',
                    show_alert: true
                });
                return;
            }

            // In auto-add workflow, items are already added, so we just acknowledge
            await bot.answerCallbackQuery(query.id, {
                text: `✅ ${item.article} is already added`,
                show_alert: false
            });

            // Get all items from this batch
            const batchItems = await GroceryItem.findByBatchId(batchId);
            
            // Create auto-add message and keyboard
            const messageText = MessageFormatter.createAutoAddMessage(batchId, batchItems);
            const keyboard = MessageFormatter.createAutoAddKeyboard(batchId, batchItems);

            await loggerService.logMessageUpdate(
                messageId,
                chatId,
                'editMessageText',
                query.message.text,
                messageText,
                `Auto-add interface for ${batchItems.length} items`
            );
            await bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            console.error('Error handling confirm item:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to process item',
                show_alert: true
            });
        }
    }

    // Handle category change request (updated for auto-add workflow)
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

    // Handle category update (updated for auto-add workflow)
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

            // Update the original message with auto-add interface
            if (originalMessageId) {
                const batchItems = await GroceryItem.findByBatchId(batchId);
                const messageText = MessageFormatter.createAutoAddMessage(batchId, batchItems);
                const keyboard = MessageFormatter.createAutoAddKeyboard(batchId, batchItems);

                try {
                    await loggerService.logMessageUpdate(
                        parseInt(originalMessageId),
                        query.message.chat.id,
                        'editMessageText',
                        '',
                        messageText,
                        `Updated auto-add interface after category change: ${item.article} → ${newCategory}`
                    );
                    await bot.editMessageText(messageText, {
                        chat_id: query.message.chat.id,
                        message_id: parseInt(originalMessageId),
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    });
                } catch (editError) {
                    console.error('Error updating original message:', editError);
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

            // Update the original message with auto-add interface
            if (originalMessageId) {
                const batchItems = await GroceryItem.findByBatchId(batchId);
                const messageText = MessageFormatter.createAutoAddMessage(batchId, batchItems);
                const keyboard = MessageFormatter.createAutoAddKeyboard(batchId, batchItems);

                try {
                    await loggerService.logMessageUpdate(
                        parseInt(originalMessageId),
                        query.message.chat.id,
                        'editMessageText',
                        '',
                        messageText,
                        `Updated auto-add interface after category change: ${item.article} → ${newCategory}`
                    );
                    await bot.editMessageText(messageText, {
                        chat_id: query.message.chat.id,
                        message_id: parseInt(originalMessageId),
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    });
                } catch (editError) {
                    console.error('Error updating original message:', editError);
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

    // Handle cancelling remaining items in batch (updated for auto-add workflow)
    static async handleCancelBatch(bot, query, batchId) {
        try {
            // Get all items from the batch to show what was added vs cancelled
            const allBatchItems = await GroceryItem.findByBatchId(batchId);
            
            // In auto-add workflow, all items are already added (status='pending')
            // So we just delete all items from this batch
            const deletedCount = await groceryService.cancelBatch(batchId);
            
            // Create summary message
            let messageText = '';
            
            if (allBatchItems.length > 0) {
                messageText += '❌ <b>Cancelled Items:</b>\n';
                allBatchItems.forEach(item => {
                    const noteText = item.note ? ` (Note: ${MessageFormatter.escapeHtml(item.note)})` : '';
                    messageText += `❌ ${MessageFormatter.escapeHtml(item.article)} (x${item.quantity}) [${item.category}]${noteText}\n`;
                });
                messageText += '\n🗑️ All items removed from your list.';
            } else {
                messageText += '❌ No items to cancel';
            }
            
            await bot.answerCallbackQuery(query.id, {
                text: `❌ Cancelled ${deletedCount} items`,
                show_alert: false
            });

            await loggerService.logMessageUpdate(
                query.message.message_id,
                query.message.chat.id,
                'editMessageText',
                query.message.text,
                messageText,
                `Batch ${batchId} cancelled - ${deletedCount} items removed`
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
                const categoryMatch = currentMessage.match(/🛒 Shopping List - (.+)$/m);
                
                if (categoryMatch && categoryMatch[1] !== 'Select Category') {
                    // We're in a specific category view, check if category still has items
                    const category = categoryMatch[1];
                    
                    const groceryData = await groceryService.getAllItemsSorted();
                    const categoryItems = groceryData.activeItems.filter(item => item.category === category);
                    
                    if (categoryItems.length > 0) {
                        // Category still has items, stay in the same category
                        await this.handleShopCategory(bot, query, category);
                    } else {
                        // Category is now empty, go back to category selection
                        await this.handleBackToCategories(bot, query);
                    }
                } else {
                    // We're in category selection view, refresh it
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

            // Check if we're in a specific category view
            const currentMessage = query.message.text;
            const categoryMatch = currentMessage.match(/🛒 Shopping List - (.+)$/m);
            
            if (categoryMatch && categoryMatch[1] !== 'Select Category') {
                // We're in a specific category, check if it still has items
                const category = categoryMatch[1];
                const groceryData = await groceryService.getAllItemsSorted();
                const categoryItems = groceryData.activeItems.filter(item => item.category === category);
                
                if (categoryItems.length > 0) {
                    // Category still has items, stay in the same category
                    await this.handleShopCategory(bot, query, category);
                } else {
                    // Category is now empty, go back to category selection
                    await this.handleBackToCategories(bot, query);
                }
            } else {
                // We're in category selection, refresh category selection
                await this.handleBackToCategories(bot, query);
            }

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

            // Check if we're in a specific category view
            const currentMessage = query.message.text;
            const categoryMatch = currentMessage.match(/🛒 Shopping List - (.+)$/m);
            
            if (categoryMatch && categoryMatch[1] !== 'Select Category') {
                // We're in a specific category, check if it still has items
                const category = categoryMatch[1];
                const groceryData = await groceryService.getAllItemsSorted();
                const categoryItems = groceryData.activeItems.filter(item => item.category === category);
                
                if (categoryItems.length > 0) {
                    // Category still has items, refresh the same category
                    await this.handleShopCategory(bot, query, category);
                } else {
                    // Category is now empty, go back to category selection
                    await this.handleBackToCategories(bot, query);
                }
            } else {
                // We're in category selection, refresh category selection
                await this.handleBackToCategories(bot, query);
            }

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

    // Handle edit item request
    static async handleEditItem(bot, query, itemId, batchId) {
        try {
            const item = await groceryService.getItemForEdit(itemId);
            if (!item) {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Item not found',
                    show_alert: true
                });
                return;
            }

            // Create edit interface
            const messageText = MessageFormatter.createEditInterfaceMessage(item);
            const keyboard = MessageFormatter.createEditKeyboard(item.id, item.category, item.quantity, item.note, batchId);

            // Send edit interface message
            await bot.sendMessage(query.message.chat.id, messageText, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

            await bot.answerCallbackQuery(query.id);

        } catch (error) {
            console.error('Error handling edit item:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to open edit interface',
                show_alert: true
            });
        }
    }

    // Handle back to edit list
    static async handleBackToEditList(bot, query, batchId) {
        try {
            // Get items from the batch
            const batchItems = await GroceryItem.findByBatchId(batchId);
            
            // Create auto-add message and keyboard
            const messageText = MessageFormatter.createAutoAddMessage(batchId, batchItems);
            const keyboard = MessageFormatter.createAutoAddKeyboard(batchId, batchItems);

            await bot.editMessageText(messageText, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

            await bot.answerCallbackQuery(query.id, {
                text: '🔙 Back to Edit List',
                show_alert: false
            });

        } catch (error) {
            console.error('Error handling back to edit list:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error loading edit list',
                show_alert: true
            });
        }
    }

    // Handle item update (category change)
    static async handleUpdateItem(bot, query, itemId, newCategory, quantity, encodedNote) {
        try {
            const note = decodeURIComponent(encodedNote || '');
            const success = await groceryService.editItem(itemId, newCategory, parseInt(quantity), note);
            
            if (success) {
                // Refresh the edit interface with new category
                const item = await groceryService.getItemForEdit(itemId);
                const messageText = MessageFormatter.createEditInterfaceMessage(item);
                
                // Get batchId from the item
                const batchId = item.batch_id;
                const keyboard = MessageFormatter.createEditKeyboard(item.id, item.category, item.quantity, item.note, batchId);

                await bot.editMessageText(messageText, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });

                await bot.answerCallbackQuery(query.id, {
                    text: `✅ Updated category to ${newCategory}`,
                    show_alert: false
                });
            } else {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Failed to update item',
                    show_alert: true
                });
            }

        } catch (error) {
            console.error('Error updating item:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error updating item',
                show_alert: true
            });
        }
    }

    // Handle quantity update
    static async handleUpdateQuantity(bot, query, itemId, category, quantity, encodedNote) {
        try {
            const note = decodeURIComponent(encodedNote || '');
            const success = await groceryService.editItem(itemId, category, parseInt(quantity), note);
            
            if (success) {
                // Refresh the edit interface with new quantity
                const item = await groceryService.getItemForEdit(itemId);
                const messageText = MessageFormatter.createEditInterfaceMessage(item);
                
                // Get batchId from the item
                const batchId = item.batch_id;
                const keyboard = MessageFormatter.createEditKeyboard(item.id, item.category, item.quantity, item.note, batchId);

                await bot.editMessageText(messageText, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });

                await bot.answerCallbackQuery(query.id, {
                    text: `✅ Updated quantity to ${quantity}`,
                    show_alert: false
                });
            } else {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Failed to update quantity',
                    show_alert: true
                });
            }

        } catch (error) {
            console.error('Error updating quantity:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error updating quantity',
                show_alert: true
            });
        }
    }

    // Handle note editing (simplified - just show current note)
    static async handleEditNote(bot, query, itemId, category, quantity) {
        try {
            const item = await groceryService.getItemForEdit(itemId);
            
            await bot.answerCallbackQuery(query.id, {
                text: `📝 Current note: ${item.note || 'No note'}\n\nTo add/edit note, send a text message with the new note.`,
                show_alert: true
            });

        } catch (error) {
            console.error('Error handling note edit:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error handling note',
                show_alert: true
            });
        }
    }

    // Handle save edit
    static async handleSaveEdit(bot, query, itemId, category, quantity, encodedNote) {
        try {
            const note = decodeURIComponent(encodedNote || '');
            const success = await groceryService.editItem(itemId, category, parseInt(quantity), note);
            
            if (success) {
                const item = await groceryService.getItemForEdit(itemId);
                const noteText = item.note ? ` (Note: ${item.note})` : '';
                
                await bot.answerCallbackQuery(query.id, {
                    text: `✅ Saved: ${item.article} (x${item.quantity}) [${item.category}]${noteText}`,
                    show_alert: false
                });

                // Delete the edit message
                await bot.deleteMessage(query.message.chat.id, query.message.message_id);

            } else {
                await bot.answerCallbackQuery(query.id, {
                    text: '❌ Failed to save changes',
                    show_alert: true
                });
            }

        } catch (error) {
            console.error('Error saving edit:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error saving changes',
                show_alert: true
            });
        }
    }

    // Handle cancel edit
    static async handleCancelEdit(bot, query, itemId) {
        try {
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Edit cancelled',
                show_alert: false
            });

            // Delete the edit message
            await bot.deleteMessage(query.message.chat.id, query.message.message_id);

        } catch (error) {
            console.error('Error cancelling edit:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error cancelling edit',
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