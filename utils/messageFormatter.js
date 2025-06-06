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

    // Create grocery list display message
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
                messageText += `${prefix}${escapedArticle} (x${item.quantity})\n`;
            });
            messageText += '\n';
        });

        // Display found items if any
        if (foundItems.length > 0) {
            messageText += '\n\n✅ <b>Found Items (Clear to remove):</b>\n';
            foundItems.forEach(item => {
                const escapedArticle = this.escapeHtml(item.article);
                messageText += `✅ ${escapedArticle} (x${item.quantity})\n`;
            });
        }

        return messageText;
    }

    // Create category selection message for shopping mode
    static createCategorySelectionMessage(groceryData) {
        const { activeItems, foundItems } = groceryData;
        
        let message = `🛒 <b>Shopping List - Select Category</b>\n\n`;
        
        // Add summary stats
        const totalActive = activeItems.length;
        const totalFound = foundItems.length;
        const totalPending = activeItems.filter(item => item.status === 'pending').length;
        const totalSelected = activeItems.filter(item => item.status === 'selected').length;
        const totalNotFound = activeItems.filter(item => item.status === 'not_found').length;

        message += `📊 <b>Summary:</b>\n`;
        message += `• ${totalActive} active items\n`;
        message += `• ${totalFound} found items\n`;
        
        if (totalActive > 0) {
            message += `\n📋 <b>Status:</b>\n`;
            if (totalPending > 0) message += `• ${totalPending} pending\n`;
            if (totalSelected > 0) message += `➡️ ${totalSelected} selected\n`;
            if (totalNotFound > 0) message += `🚫 ${totalNotFound} not found\n`;
        }

        message += `\n👇 <b>Select a category to view items:</b>`;
        
        return message;
    }

    // Create category-specific message for shopping mode  
    static createCategoryShoppingMessage(groceryData, selectedCategory) {
        const { activeItems, foundItems } = groceryData;
        
        // Filter items by category
        const categoryItems = activeItems.filter(item => item.category === selectedCategory);
        
        let message = `🛒 <b>Shopping List - ${selectedCategory}</b>\n\n`;
        
        if (categoryItems.length === 0) {
            message += `No items in this category.`;
            return message;
        }

        // Group items by status
        const pendingItems = categoryItems.filter(item => item.status === 'pending');
        const selectedItems = categoryItems.filter(item => item.status === 'selected');
        const notFoundItems = categoryItems.filter(item => item.status === 'not_found');

        if (selectedItems.length > 0) {
            message += `➡️ <b>Looking for:</b>\n`;
            selectedItems.forEach(item => {
                message += `• ${item.article} (x${item.quantity})\n`;
            });
            message += `\n`;
        }

        if (pendingItems.length > 0) {
            message += `📋 <b>Pending:</b>\n`;
            pendingItems.forEach(item => {
                message += `• ${item.article} (x${item.quantity})\n`;
            });
            message += `\n`;
        }

        if (notFoundItems.length > 0) {
            message += `🚫 <b>Not Found:</b>\n`;
            notFoundItems.forEach(item => {
                message += `• ${item.article} (x${item.quantity})\n`;
            });
            message += `\n`;
        }

        if (foundItems.length > 0) {
            message += `✅ <b>Found Items:</b> ${foundItems.length}\n\n`;
        }

        message += `👇 <b>Click items to change status:</b>`;
        
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

    // Create batch confirmation keyboard (simple approach)
    static createBatchConfirmationKeyboard(batchId, items) {
        const inlineKeyboard = [];

        for (const item of items) {
            // Add item button
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