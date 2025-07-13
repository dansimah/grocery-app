const Session = require('../models/Session');
const { v4: uuidv4 } = require('uuid');

class SessionService {
    // Create a short callback ID and store data in session
    async createCallbackSession(messageId, data, userId = null) {
        try {
            const callbackId = uuidv4().substring(0, 8); // Short 8-character ID
            const session = await Session.create(callbackId, messageId, data, userId);
            return callbackId;
        } catch (error) {
            console.error('Error creating callback session:', error);
            throw error;
        }
    }

    // Get session data by callback ID
    async getCallbackData(callbackId) {
        try {
            const session = await Session.findById(callbackId);
            if (!session) {
                console.warn(`Session not found for callback ID: ${callbackId}`);
                return null;
            }
            return session.getParsedData();
        } catch (error) {
            console.error('Error getting callback data:', error);
            throw error;
        }
    }

    // Delete session by callback ID
    async deleteCallbackSession(callbackId) {
        try {
            return await Session.deleteById(callbackId);
        } catch (error) {
            console.error('Error deleting callback session:', error);
            throw error;
        }
    }

    // Clean up sessions associated with a message
    async cleanupMessageSessions(messageId) {
        try {
            const deletedCount = await Session.deleteByMessageId(messageId);
            if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} sessions for message ${messageId}`);
            }
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up message sessions:', error);
            throw error;
        }
    }

    // Periodic cleanup of expired sessions
    async cleanupExpiredSessions() {
        try {
            return await Session.cleanupExpired();
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            throw error;
        }
    }

    // Get all sessions for a message (useful for debugging)
    async getMessageSessions(messageId) {
        try {
            return await Session.findByMessageId(messageId);
        } catch (error) {
            console.error('Error getting message sessions:', error);
            throw error;
        }
    }

    // Get active sessions for a user (useful for note editing)
    async getUserSessions(userId) {
        try {
            return await Session.findByUserId(userId);
        } catch (error) {
            console.error('Error getting user sessions:', error);
            throw error;
        }
    }

    // Update session data
    async updateCallbackSession(callbackId, newData) {
        try {
            const session = await Session.findById(callbackId);
            if (!session) {
                return false;
            }
            
            session.data = JSON.stringify(newData);
            await session.save();
            return true;
        } catch (error) {
            console.error('Error updating callback session:', error);
            throw error;
        }
    }

    // Start periodic cleanup (call this on app start)
    startPeriodicCleanup(intervalHours = 1) {
        setInterval(async () => {
            try {
                await this.cleanupExpiredSessions();
            } catch (error) {
                console.error('Error in periodic session cleanup:', error);
            }
        }, intervalHours * 60 * 60 * 1000); // Convert hours to milliseconds
        
        console.log(`🔄 Started periodic session cleanup every ${intervalHours} hour(s)`);
    }
}

// Create singleton instance
const sessionService = new SessionService();

module.exports = sessionService; 