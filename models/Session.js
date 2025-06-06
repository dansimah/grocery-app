const database = require('../config/database');
const { BOT_CONFIG } = require('../config/bot');

class Session {
    constructor(data = {}) {
        this.id = data.id;
        this.message_id = data.message_id;
        this.data = typeof data.data === 'string' ? data.data : JSON.stringify(data.data || {});
        this.created_at = data.created_at;
        this.expires_at = data.expires_at;
    }

    // Save session to database
    async save() {
        try {
            if (!this.expires_at) {
                // Set expiration time
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + BOT_CONFIG.SESSION_EXPIRE_HOURS);
                this.expires_at = expiresAt.toISOString();
            }

            const result = await database.run(
                `INSERT OR REPLACE INTO sessions (id, message_id, data, expires_at) 
                 VALUES (?, ?, ?, ?)`,
                [this.id, this.message_id, this.data, this.expires_at]
            );
            return this;
        } catch (error) {
            console.error('Error saving session:', error);
            throw error;
        }
    }

    // Get parsed data object
    getParsedData() {
        try {
            return JSON.parse(this.data);
        } catch (error) {
            console.error('Error parsing session data:', error);
            return {};
        }
    }

    // Static methods
    static async findById(id) {
        try {
            const row = await database.get(
                'SELECT * FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP',
                [id]
            );
            return row ? new Session(row) : null;
        } catch (error) {
            console.error('Error finding session by id:', error);
            throw error;
        }
    }

    static async findByMessageId(messageId) {
        try {
            const rows = await database.all(
                'SELECT * FROM sessions WHERE message_id = ? AND expires_at > CURRENT_TIMESTAMP',
                [messageId]
            );
            return rows.map(row => new Session(row));
        } catch (error) {
            console.error('Error finding sessions by message id:', error);
            throw error;
        }
    }

    static async deleteById(id) {
        try {
            const result = await database.run(
                'DELETE FROM sessions WHERE id = ?',
                [id]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting session by id:', error);
            throw error;
        }
    }

    static async deleteByMessageId(messageId) {
        try {
            const result = await database.run(
                'DELETE FROM sessions WHERE message_id = ?',
                [messageId]
            );
            return result.changes;
        } catch (error) {
            console.error('Error deleting sessions by message id:', error);
            throw error;
        }
    }

    static async cleanupExpired() {
        try {
            const result = await database.run(
                'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP'
            );
            if (result.changes > 0) {
                console.log(`🧹 Cleaned up ${result.changes} expired sessions`);
            }
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            throw error;
        }
    }

    async delete() {
        try {
            if (!this.id) return false;
            const result = await database.run(
                'DELETE FROM sessions WHERE id = ?',
                [this.id]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }

    // Create session with data
    static async create(id, messageId, data) {
        try {
            const session = new Session({
                id,
                message_id: messageId,
                data: data
            });
            return await session.save();
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }
}

module.exports = Session; 