const GroceryItem = require('../models/GroceryItem');
const aiService = require('./aiService');

class GroceryService {
    // Parse and create temp batch for confirmation
    async parseItemsForConfirmation(groceryText) {
        try {
            // Use AI to parse the grocery text
            const parsedItems = await aiService.parseGroceryItems(groceryText);
            
            // Generate short batch ID (8 characters)
            const batchId = require('crypto').randomBytes(4).toString('hex');
            
            // Create temporary items with batch_id and 'confirming' status
            const tempItems = [];
            for (const newItem of parsedItems) {
                if (!newItem.article || !newItem.category) continue;
                
                const groceryItem = new GroceryItem({
                    article: newItem.article,
                    quantity: newItem.quantity,
                    category: newItem.category,
                    status: 'confirming', // Special status for confirmation
                    batch_id: batchId
                });
                
                await groceryItem.save();
                tempItems.push(groceryItem);
            }
            
            console.log(`✅ Created batch ${batchId} with ${tempItems.length} items for confirmation`);
            return { batchId, items: tempItems };
            
        } catch (error) {
            console.error('Error parsing items for confirmation:', error);
            throw error;
        }
    }

    // Confirm an item from a batch (add to main list or update existing)
    async confirmItemFromBatch(itemId) {
        try {
            const tempItem = await GroceryItem.findById(itemId);
            console.log('📦 Confirming item:', itemId, 'Found item:', tempItem ? { id: tempItem.id, article: tempItem.article, status: tempItem.status, batch_id: tempItem.batch_id } : 'null');
            
            if (!tempItem) {
                throw new Error(`Item with ID ${itemId} not found`);
            }
            
            if (tempItem.status !== 'confirming') {
                // If it's already confirmed (status='pending'), just return it
                if (tempItem.status === 'pending') {
                    console.log('⚠️ Item already confirmed, returning existing item');
                    return tempItem;
                }
                throw new Error(`Item ${itemId} has status '${tempItem.status}' instead of 'confirming'`);
            }

            // Check if item already exists in main list
            const existingItem = await GroceryItem.findByArticle(tempItem.article);
            
            if (existingItem && existingItem.batch_id !== tempItem.batch_id) {
                // Update existing item - add quantities and update category
                existingItem.quantity = parseInt(existingItem.quantity) + parseInt(tempItem.quantity);
                existingItem.category = tempItem.category;
                existingItem.batch_id = tempItem.batch_id; // Update to current batch for proper tracking
                
                // Reset status if it was 'not_found' or 'found'
                if (existingItem.status === 'not_found' || existingItem.status === 'found') {
                    existingItem.status = 'pending';
                }
                
                await existingItem.save();
                
                // Delete the temp item
                await tempItem.delete();
                
                return existingItem;
            } else {
                // Convert temp item to regular item
                tempItem.status = 'pending';
                await tempItem.save();
                return tempItem;
            }
            
        } catch (error) {
            console.error('Error confirming item from batch:', error);
            throw error;
        }
    }

    // Delete remaining unconfirmed items in batch (cancel confirmation)
    async cancelBatch(batchId) {
        try {
            // Only delete items that are still in 'confirming' status
            const remainingItems = await GroceryItem.findByBatchIdAndStatus(batchId, 'confirming');
            let deletedCount = 0;
            
            for (const item of remainingItems) {
                const success = await item.delete();
                if (success) deletedCount++;
            }
            
            console.log(`🗑️ Cancelled batch ${batchId} remaining items (${deletedCount} items)`);
            return deletedCount;
        } catch (error) {
            console.error('Error cancelling batch:', error);
            throw error;
        }
    }

    // Get all items sorted by category (maintains order regardless of status)
    async getAllItemsSorted() {
        try {
            const allItems = await GroceryItem.findAll();
            
            // Separate found items (they get displayed separately)
            const foundItems = allItems.filter(item => item.status === 'found');
            
            // Get active items (all statuses except 'found')
            const activeItems = allItems.filter(item => item.status !== 'found');
            
            // Sort active items by category only (not by status) to maintain shopping order
            activeItems.sort((a, b) => {
                const categoryA = (a.category || '').toLowerCase();
                const categoryB = (b.category || '').toLowerCase();
                return categoryA.localeCompare(categoryB);
            });
            
            // Group by category for display
            const grouped = this.groupItemsByCategory(activeItems);
            
            return {
                allItems,
                activeItems,
                foundItems,
                grouped
            };
        } catch (error) {
            console.error('Error getting sorted items:', error);
            throw error;
        }
    }

    // Group items by category
    groupItemsByCategory(items) {
        return items.reduce((acc, item) => {
            const category = item.category || 'Sans catégorie';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {});
    }

    // Update item status
    async updateItemStatus(itemId, newStatus) {
        try {
            const success = await GroceryItem.updateStatus(itemId, newStatus);
            if (success) {
                console.log(`✅ Updated item ${itemId} status to ${newStatus}`);
            }
            return success;
        } catch (error) {
            console.error('Error updating item status:', error);
            throw error;
        }
    }

    // Clear all found items
    async clearFoundItems() {
        try {
            const deletedCount = await GroceryItem.deleteByStatus('found');
            console.log(`🗑️ Cleared ${deletedCount} found items`);
            return deletedCount;
        } catch (error) {
            console.error('Error clearing found items:', error);
            throw error;
        }
    }

    // Reset all selected items to pending
    async clearSelection() {
        try {
            const selectedItems = await GroceryItem.findByStatus('selected');
            let updatedCount = 0;
            
            for (const item of selectedItems) {
                const success = await GroceryItem.updateStatus(item.id, 'pending');
                if (success) updatedCount++;
            }
            
            console.log(`⬅️ Reset ${updatedCount} selected items to pending`);
            return updatedCount;
        } catch (error) {
            console.error('Error clearing selection:', error);
            throw error;
        }
    }

    // Get grocery list formatted for display
    async getFormattedList() {
        try {
            const { grouped, foundItems } = await this.getAllItemsSorted();
            
            if (Object.keys(grouped).length === 0 && foundItems.length === 0) {
                return '🛒 Your grocery list is empty!';
            }
            
            let message = '🛒 **Current Grocery List:**\n\n';
            
            // Display active items by category
            for (const [category, items] of Object.entries(grouped)) {
                if (items.length === 0) continue;
                
                message += `**${category}**\n`;
                for (const item of items) {
                    let prefix = '';
                    switch (item.status) {
                        case 'selected':
                            prefix = '➡️ ';
                            break;
                        case 'not_found':
                            prefix = '🚫 ';
                            break;
                        default:
                            prefix = '• ';
                            break;
                    }
                    message += `${prefix}${item.article} (x${item.quantity})\n`;
                }
                message += '\n';
            }
            
            // Display found items if any
            if (foundItems.length > 0) {
                message += '\n✅ **Found Items (Clear to remove):**\n';
                foundItems.forEach(item => {
                    message += `✅ ${item.article} (x${item.quantity})\n`;
                });
            }
            
            return message;
        } catch (error) {
            console.error('Error getting formatted list:', error);
            throw error;
        }
    }

    // Clear entire list
    async clearAllItems() {
        try {
            const deletedCount = await GroceryItem.clearAll();
            console.log(`🗑️ Cleared entire grocery list (${deletedCount} items)`);
            return deletedCount;
        } catch (error) {
            console.error('Error clearing all items:', error);
            throw error;
        }
    }
}

// Create singleton instance
const groceryService = new GroceryService();

module.exports = groceryService; 