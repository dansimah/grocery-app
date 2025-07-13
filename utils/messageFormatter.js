const { CATEGORIES } = require('../config/categories');

class MessageFormatter {
    // Format HTML entities for Telegram
    static escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Escape markdown special characters
    static escapeMarkdown(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/[_*`\[\]()~>#+\\=|{}.!-]/g, '\\$&');
    }

    // Create confirmation message for parsed items
    static createConfirmationMessage(items) {
        let messageText = '🛒 <b>Items to add:</b>\n\n';
        items.forEach(item => {
            messageText += `• ${this.escapeHtml(item.article)} (x${item.quantity}) [${item.category}]\n`;
        });
        return messageText;
    }

    // Create batch confirmation message (buttons only)
    static createBatchConfirmationMessage(batchId, addedItems = []) {
        let message = '';
        
        // Show added items first (if any)
        if (addedItems && addedItems.length > 0) {
            for (const item of addedItems) {
                message += `✅ ${this.escapeHtml(item.article)} (x${item.quantity}) → ${item.category}\n`;
            }
            message += '\n';
        }
        
        message += '🛒 <b>Items to Add:</b>';
        
        return message;
    }

    // Create grocery list message with notes support
    static createGroceryListMessage(groceryData) {
        const { grouped, foundItems } = groceryData;
        
        if (Object.keys(grouped).length === 0 && foundItems.length === 0) {
            return '🛒 <b>Current Grocery List:</b>\n\nYour list is empty!';
        }

        let messageText = '🛒 <b>Current Grocery List:</b>\n\n';

        // Display active items by category
        Object.keys(grouped).forEach(category => {
            const items = grouped[category];
            if (items.length === 0) return;

            messageText += `<b>${category}</b>\n`;
            items.forEach(item => {
                let prefix = '';
                switch (item.status) {
                    case 'selected':
                        prefix = '➡️ ';
                        break;
                    case 'not_found':
                        prefix = '🚫 ';
                        break;
                    default: // 'pending'
                        prefix = '• ';
                        break;
                }
                const escapedArticle = this.escapeMarkdown(item.article);
                const noteText = item.note ? ` (Note: ${this.escapeMarkdown(item.note)})` : '';
                messageText += `${prefix}${escapedArticle} (x${item.quantity})${noteText}\n`;
            });
            messageText += '\n';
        });

        // Display found items if any
        if (foundItems.length > 0) {
            messageText += '\n\n✅ <b>Found Items (Clear to remove):</b>\n';
            foundItems.forEach(item => {
                const escapedArticle = this.escapeHtml(item.article);
                const noteText = item.note ? ` (Note: ${this.escapeHtml(item.note)})` : '';
                messageText += `✅ ${escapedArticle} (x${item.quantity})${noteText}\n`;
            });
        }

        return messageText;
    }

    // Create auto-add message (new workflow)
    static createAutoAddMessage(batchId, addedItems = []) {
        let message = '';
        
        // Show auto-added items
        if (addedItems && addedItems.length > 0) {
            message += '✅ <b>Auto-Added Items:</b>\n';
            for (const item of addedItems) {
                const noteText = item.note ? ` (Note: ${this.escapeHtml(item.note)})` : '';
                message += `✅ ${this.escapeHtml(item.article)} (x${item.quantity}) [${item.category}]${noteText}\n`;
            }
            message += '\n';
        }
        
        message += '👇 <b>Click "Edit" to modify any items:</b>';
        
        return message;
    }

    // Create edit interface message
    static createEditInterfaceMessage(item) {
        const noteText = item.note ? ` (Note: ${this.escapeHtml(item.note)})` : '';
        return `✏️ <b>Editing:</b> ${this.escapeHtml(item.article)} (x${item.quantity}) [${item.category}]${noteText}`;
    }

    // Create category selection message for shopping mode
    static createCategorySelectionMessage(groceryData) {
        const { activeItems, foundItems } = groceryData;
        
        let message = `🛒 <b>Shopping List - Select Category</b>\n\n`;
        
        // Add the full categorized grocery list
        message += this.createGroceryListMessage(groceryData);
        
        message += `\n${'─'.repeat(30)}\n\n`;
        message += `👇 <b>Select a category to manage items:</b>`;
        
        return message;
    }

    // Create category-specific message for shopping mode  
    static createCategoryShoppingMessage(groceryData, selectedCategory) {
        const { activeItems, foundItems } = groceryData;
        
        let message = `🛒 <b>Shopping List - ${selectedCategory}</b>\n\n`;
        
        // Add full categorized list at the top
        message += this.createGroceryListMessage(groceryData);
        message += `\n${'─'.repeat(30)}\n\n`;
        
        // Filter items by category for buttons
        const categoryItems = activeItems.filter(item => item.category === selectedCategory);
        
        if (categoryItems.length === 0) {
            message += `<b>📋 ${selectedCategory}:</b> No items in this category.\n\n`;
            message += `👇 <b>Use buttons below to navigate:</b>`;
        } else {
            message += `<b>📋 Managing: ${selectedCategory} (${categoryItems.length} items)</b>\n\n`;
            message += `👇 <b>Click items below to change their status:</b>`;
        }
        
        return message;
    }

    // Create inline keyboard for confirmation
    static createConfirmationKeyboard(items, sessionService, messageId) {
        return new Promise(async (resolve) => {
            const inlineKeyboard = [];

            for (const item of items) {
                // Create session for each item's data
                const addCallbackId = await sessionService.createCallbackSession(messageId, {
                    action: 'add-item',
                    article: item.article,
                    quantity: item.quantity,
                    category: item.category
                });

                const changeCategoryCallbackId = await sessionService.createCallbackSession(messageId, {
                    action: 'change-category',
                    article: item.article,
                    quantity: item.quantity,
                    category: item.category
                });

                // Add item row
                inlineKeyboard.push([{
                    text: `✅ ${item.article} (x${item.quantity}) [${item.category}]`,
                    callback_data: addCallbackId
                }]);

                // Add change category button
                inlineKeyboard.push([{
                    text: '🔄 Change Category',
                    callback_data: changeCategoryCallbackId
                }]);
            }

            // Add cancel button
            const cancelCallbackId = await sessionService.createCallbackSession(messageId, {
                action: 'cancel'
            });

            inlineKeyboard.push([{
                text: '❌ Cancel',
                callback_data: cancelCallbackId
            }]);

            resolve(inlineKeyboard);
        });
    }

    // Create category selection keyboard
    static createCategoryKeyboard(sessionService, messageId, article, quantity, originalCallbackId, originalMessageId) {
        return new Promise(async (resolve) => {
            const inlineKeyboard = [];

            // Create rows of 2 buttons each
            for (let i = 0; i < CATEGORIES.length; i += 2) {
                const row = [];
                
                const firstCategoryCallbackId = await sessionService.createCallbackSession(messageId, {
                    action: 'update-category',
                    originalCallbackId: originalCallbackId,
                    originalMessageId: originalMessageId,
                    article: article,
                    quantity: quantity,
                    category: CATEGORIES[i]
                });

                row.push({
                    text: CATEGORIES[i],
                    callback_data: firstCategoryCallbackId
                });

                if (i + 1 < CATEGORIES.length) {
                    const secondCategoryCallbackId = await sessionService.createCallbackSession(messageId, {
                        action: 'update-category',
                        originalCallbackId: originalCallbackId,
                        originalMessageId: originalMessageId,
                        article: article,
                        quantity: quantity,
                        category: CATEGORIES[i + 1]
                    });

                    row.push({
                        text: CATEGORIES[i + 1],
                        callback_data: secondCategoryCallbackId
                    });
                }

                inlineKeyboard.push(row);
            }

            resolve(inlineKeyboard);
        });
    }

    // Create shopping list keyboard with item buttons
    static createShoppingListKeyboard(activeItems, sessionService, messageId) {
        return new Promise(async (resolve) => {
            const inlineKeyboard = [];

            for (const item of activeItems) {
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

                const callbackId = await sessionService.createCallbackSession(messageId, {
                    action: 'item-status',
                    itemId: item.id,
                    newStatus: nextStatus
                });

                inlineKeyboard.push([{
                    text: mainButtonText,
                    callback_data: callbackId
                }]);
            }

            // Add action buttons
            const clearFoundCallbackId = await sessionService.createCallbackSession(messageId, {
                action: 'clear-found'
            });

            const refreshCallbackId = await sessionService.createCallbackSession(messageId, {
                action: 'refresh'
            });

            const clearSelectionCallbackId = await sessionService.createCallbackSession(messageId, {
                action: 'clear-selection'
            });

            inlineKeyboard.push([
                { text: '🗑️ Clear Found Items', callback_data: clearFoundCallbackId },
                { text: '🔄 Refresh List', callback_data: refreshCallbackId }
            ]);

            inlineKeyboard.push([
                { text: '⬅️ Clear Selection', callback_data: clearSelectionCallbackId }
            ]);

            resolve(inlineKeyboard);
        });
    }

    // Create success message
    static createSuccessMessage(article, quantity, category) {
        return `✅ Added ${this.escapeHtml(article)} (x${quantity}) to ${category}`;
    }

    // Create error message
    static createErrorMessage(error) {
        return `❌ Error: ${this.escapeHtml(error)}`;
    }

    // Create cancel message
    static createCancelMessage() {
        return '❌ Operation cancelled';
    }

    // Create auto-add keyboard (new workflow)
    static createAutoAddKeyboard(batchId, items) {
        const inlineKeyboard = [];

        for (const item of items) {
            // Add edit button for each item with batchId
            inlineKeyboard.push([{
                text: `✏️ Edit ${item.article}`,
                callback_data: `edit_item:${item.id}:${batchId}`
            }]);
        }

        // Cancel entire batch button
        inlineKeyboard.push([{
            text: '❌ Cancel All',
            callback_data: `cancel_batch:${batchId}`
        }]);

        return inlineKeyboard;
    }

    // Create edit interface keyboard
    static createEditKeyboard(itemId, currentCategory, currentQuantity, currentNote = '', batchId = null) {
        const inlineKeyboard = [];

        // URL encode the note to prevent callback data corruption
        const encodedNote = encodeURIComponent(currentNote || '');

        // Category selection (first row)
        const categoryRow = [];
        for (let i = 0; i < CATEGORIES.length; i += 2) {
            const row = [];
            
            row.push({
                text: CATEGORIES[i],
                callback_data: `update_item:${itemId}:${CATEGORIES[i]}:${currentQuantity}:${encodedNote}`
            });

            if (i + 1 < CATEGORIES.length) {
                row.push({
                    text: CATEGORIES[i + 1],
                    callback_data: `update_item:${itemId}:${CATEGORIES[i + 1]}:${currentQuantity}:${encodedNote}`
                });
            }
            
            inlineKeyboard.push(row);
        }

        // Quantity controls
        const quantityRow = [];
        quantityRow.push({ text: '➖', callback_data: `update_qty:${itemId}:${currentCategory}:${Math.max(1, currentQuantity - 1)}:${encodedNote}` });
        quantityRow.push({ text: `[${currentQuantity}]`, callback_data: `noop` });
        quantityRow.push({ text: '➕', callback_data: `update_qty:${itemId}:${currentCategory}:${currentQuantity + 1}:${encodedNote}` });
        inlineKeyboard.push(quantityRow);

        // Note input (simplified - user can edit via text message)
        inlineKeyboard.push([{
            text: `📝 Note: ${currentNote || 'Add note...'}`,
            callback_data: `edit_note:${itemId}:${currentCategory}:${currentQuantity}`
        }]);

        // Action buttons
        const actionButtons = [
            { text: '💾 Save', callback_data: `save_edit:${itemId}:${currentCategory}:${currentQuantity}:${encodedNote}` }
        ];

        // Add "Back to Edit List" if we have a batchId
        if (batchId) {
            actionButtons.push({ text: '⬅️ Back to List', callback_data: `back_to_edit_list:${batchId}` });
        }

        actionButtons.push({ text: '❌ Cancel', callback_data: `cancel_edit:${itemId}` });
        inlineKeyboard.push(actionButtons);

        return inlineKeyboard;
    }

    // Create batch confirmation keyboard (updated for auto-add workflow)
    static createBatchConfirmationKeyboard(batchId, items) {
        const inlineKeyboard = [];

        for (const item of items) {
            // Add item button (now shows as auto-added)
            inlineKeyboard.push([{
                text: `✅ ${item.article} (x${item.quantity}) [${item.category}]`,
                callback_data: `confirm_item:${batchId}:${item.id}`
            }]);

            // Change category button
            inlineKeyboard.push([{
                text: '🔄 Change Category',
                callback_data: `change_cat:${batchId}:${item.id}`
            }]);
        }

        // Cancel entire batch button
        inlineKeyboard.push([{
            text: '❌ Cancel All',
            callback_data: `cancel_batch:${batchId}`
        }]);

        return inlineKeyboard;
    }

    // Create category selection keyboard for batch items
    static createBatchCategoryKeyboard(batchId, itemId, originalMessageId) {
        const inlineKeyboard = [];

        // Create rows of 2 buttons each
        for (let i = 0; i < CATEGORIES.length; i += 2) {
            const row = [];
            
            // Use category index instead of full name for shorter callbacks
            row.push({
                text: CATEGORIES[i],
                callback_data: `upd_cat:${batchId}:${itemId}:${i}:${originalMessageId}`
            });

            if (i + 1 < CATEGORIES.length) {
                row.push({
                    text: CATEGORIES[i + 1],
                    callback_data: `upd_cat:${batchId}:${itemId}:${i + 1}:${originalMessageId}`
                });
            }

            inlineKeyboard.push(row);
        }

        return inlineKeyboard;
    }
}

module.exports = MessageFormatter;