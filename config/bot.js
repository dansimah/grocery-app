require('dotenv').config();

const BOT_CONFIG = {
    // Bot tokens and API keys
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    
    // Authorization
    AUTHORIZED_USERS: process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [],
    
    // Status reporting
    STATUS_CHAT_ID: process.env.STATUS_CHAT_ID || null,
    STATUS_REPORTING_ENABLED: true, // Set to true to enable Telegram status notifications
    
    // Bot settings
    POLLING: true,
    
    // Session settings
    SESSION_EXPIRE_HOURS: 24, // Sessions expire after 24 hours
    
    // Gemini model settings
    GEMINI_MODEL: "gemini-2.0-flash"
};

function isAuthorized(user) {
    if (!user) return false;
    if (BOT_CONFIG.AUTHORIZED_USERS.length === 0) return true;
    return BOT_CONFIG.AUTHORIZED_USERS.includes(user.username) || 
           BOT_CONFIG.AUTHORIZED_USERS.includes(user.first_name);
}

module.exports = {
    BOT_CONFIG,
    isAuthorized
}; 