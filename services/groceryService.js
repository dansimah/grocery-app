const GroceryItem = require('../models/GroceryItem');
const aiService = require('./aiService');
const productCacheService = require('./productCacheService');

class GroceryService {
    // Parse and auto-add items (new workflow with cache)
    async parseItemsForConfirmation(groceryText) {
        try {
            // Step 1: Try cache first
            const { cachedItems, unparsedLines } = await productCacheService.parseWithCache(groceryText);
            
            // Step 2: Use AI only for items not in cache
            let geminiItems = [];
            if (unparsedLines.length > 0) {
                console.log(`🤖 Sending ${unparsedLines.length} unparsed items to Gemini...`);
                geminiItems = await aiService.parseGroceryItems(unparsedLines.join('\n'));
                
                // Add originalInput to gemini items (the unparsed line)
                geminiItems = geminiItems.map((item, index) => ({
                    ...item,
                    originalInput: unparsedLines[index] || item.article
                }));
            } else {
                console.log('✨ All items found in cache, skipping Gemini API call!');
            }
            
            // Step 3: Combine cached and AI-parsed items
            const parsedItems = [...cachedItems, ...geminiItems];
            
            // Generate short batch ID (8 characters)
            const batchId = require('crypto').randomBytes(4).toString('hex');
            
            // Auto-add items directly to main list
            const addedItems = [];
            for (const newItem of parsedItems) {
                if (!newItem.article || !newItem.category) continue;
                
                const groceryItem = new GroceryItem({
                    article: newItem.article,
                    quantity: newItem.quantity,
                    category: newItem.category,
                    status: 'pending', // Directly add to main list
                    batch_id: batchId,
                    original_input: newItem.originalInput || newItem.article
                });
                
                await groceryItem.save();
                addedItems.push(groceryItem);
            }
            
            console.log(`✅ Auto-added batch ${batchId} with ${addedItems.length} items (${cachedItems.length} from cache, ${geminiItems.length} from AI)`);
            return { batchId, items: addedItems };
            
        } catch (error) {
            console.error('Error parsing and auto-adding items:', error);
            throw error;
        }
    }

    // Edit an existing item (category, quantity, note)
    async editItem(itemId, newCategory, newQuantity, newNote) {
        try {
            const item = await GroceryItem.findById(itemId);
            if (!item) {
                throw new Error(`Item with ID ${itemId} not found`);
            }
            
            // Update the item
            item.category = newCategory;
            item.quantity = newQuantity;
            item.note = newNote;
            await item.save();
            
            console.log(`✅ Updated item ${itemId}: ${item.article} (x${item.quantity}) [${item.category}] ${item.note ? `(Note: ${item.note})` : ''}`);
            return item;
            
        } catch (error) {
            console.error('Error editing item:', error);
            throw error;
        }
    }

    // Get item for editing
    async getItemForEdit(itemId) {
        try {
            const item = await GroceryItem.findById(itemId);
            if (!item) {
                throw new Error(`Item with ID ${itemId} not found`);
            }
            return item;
        } catch (error) {
            console.error('Error getting item for edit:', error);
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

    // Delete all items in batch (cancel confirmation - updated for auto-add workflow)
    async cancelBatch(batchId) {
        try {
            // Delete all items from the batch (in auto-add workflow, they all have status='pending')
            const batchItems = await GroceryItem.findByBatchId(batchId);
            let deletedCount = 0;
            
            for (const item of batchItems) {
                const success = await item.delete();
                if (success) deletedCount++;
            }
            
            console.log(`🗑️ Cancelled batch ${batchId} (${deletedCount} items)`);
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