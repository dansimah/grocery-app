const database = require('../config/database');

class GroceryItem {
    constructor(data = {}) {
        this.id = data.id;
        this.article = data.article;
        this.quantity = data.quantity || 1;
        this.category = data.category;
        this.status = data.status || 'pending';
        this.batch_id = data.batch_id; // For tracking confirmation batches
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Create a new grocery item
    async save() {
        try {
            if (this.id) {
                // Update existing item
                const result = await database.run(
                    `UPDATE grocery_items 
                     SET article = ?, quantity = ?, category = ?, status = ?, batch_id = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`,
                    [this.article, this.quantity, this.category, this.status, this.batch_id, this.id]
                );
                return result.changes > 0;
            } else {
                // Create new item
                const result = await database.run(
                    `INSERT INTO grocery_items (article, quantity, category, status, batch_id) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [this.article, this.quantity, this.category, this.status, this.batch_id]
                );
                this.id = result.id;
                return this;
            }
        } catch (error) {
            console.error('Error saving grocery item:', error);
            throw error;
        }
    }

    // Static methods for querying
    static async findAll() {
        try {
            const rows = await database.all(
                'SELECT * FROM grocery_items ORDER BY created_at DESC'
            );
            return rows.map(row => new GroceryItem(row));
        } catch (error) {
            console.error('Error finding all grocery items:', error);
            throw error;
        }
    }

    static async findByStatus(status) {
        try {
            const rows = await database.all(
                'SELECT * FROM grocery_items WHERE status = ? ORDER BY created_at DESC',
                [status]
            );
            return rows.map(row => new GroceryItem(row));
        } catch (error) {
            console.error('Error finding grocery items by status:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const row = await database.get(
                'SELECT * FROM grocery_items WHERE id = ?',
                [id]
            );
            return row ? new GroceryItem(row) : null;
        } catch (error) {
            console.error('Error finding grocery item by id:', error);
            throw error;
        }
    }

    static async updateStatus(id, status) {
        try {
            const result = await database.run(
                'UPDATE grocery_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, id]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating grocery item status:', error);
            throw error;
        }
    }

    static async deleteByStatus(status) {
        try {
            const result = await database.run(
                'DELETE FROM grocery_items WHERE status = ?',
                [status]
            );
            return result.changes;
        } catch (error) {
            console.error('Error deleting grocery items by status:', error);
            throw error;
        }
    }

    static async clearAll() {
        try {
            const result = await database.run('DELETE FROM grocery_items');
            return result.changes;
        } catch (error) {
            console.error('Error clearing all grocery items:', error);
            throw error;
        }
    }

    // Find existing item by article name (case insensitive)
    static async findByArticle(article) {
        try {
            const row = await database.get(
                'SELECT * FROM grocery_items WHERE LOWER(article) = LOWER(?)',
                [article]
            );
            return row ? new GroceryItem(row) : null;
        } catch (error) {
            console.error('Error finding grocery item by article:', error);
            throw error;
        }
    }

    async delete() {
        try {
            if (!this.id) return false;
            const result = await database.run(
                'DELETE FROM grocery_items WHERE id = ?',
                [this.id]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting grocery item:', error);
            throw error;
        }
    }

    static async findByBatchId(batchId) {
        try {
            const items = await database.all(
                'SELECT * FROM grocery_items WHERE batch_id = ? ORDER BY created_at ASC',
                [batchId]
            );
            return items.map(item => new GroceryItem(item));
        } catch (error) {
            console.error('Error finding items by batch ID:', error);
            return [];
        }
    }

    static async findByBatchIdAndStatus(batchId, status) {
        try {
            const items = await database.all(
                'SELECT * FROM grocery_items WHERE batch_id = ? AND status = ? ORDER BY created_at ASC',
                [batchId, status]
            );
            return items.map(item => new GroceryItem(item));
        } catch (error) {
            console.error('Error finding items by batch ID and status:', error);
            return [];
        }
    }

    static async deleteBatch(batchId) {
        try {
            const result = await database.run('DELETE FROM grocery_items WHERE batch_id = ?', [batchId]);
            return result.changes;
        } catch (error) {
            console.error('Error deleting batch:', error);
            return 0;
        }
    }
}

module.exports = GroceryItem; 