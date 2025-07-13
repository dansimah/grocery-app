const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const DB_PATH = path.join(__dirname, '../data/grocery_bot.db');
const DATA_DIR = path.dirname(DB_PATH);

class Database {
    constructor() {
        this.db = null;
    }

    async initialize() {
        try {
            // Ensure data directory exists
            await fs.ensureDir(DATA_DIR);
            
            // Create database connection
            this.db = new sqlite3.Database(DB_PATH);
            
            // Initialize schema if tables don't exist
            await this.initializeSchema();
            
            console.log('✅ Database initialized successfully');
            return this.db;
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    async initializeSchema() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create grocery_items table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS grocery_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        article TEXT NOT NULL,
                        quantity INTEGER NOT NULL DEFAULT 1,
                        category TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        batch_id TEXT,
                        note TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating grocery_items table:', err);
                        reject(err);
                        return;
                    }
                });

                // Add batch_id column if it doesn't exist (for existing databases)
                this.db.run(`
                    ALTER TABLE grocery_items ADD COLUMN batch_id TEXT
                `, (err) => {
                    // Ignore error if column already exists
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('Error adding batch_id column:', err);
                    }
                });

                // Add note column if it doesn't exist (for existing databases)
                this.db.run(`
                    ALTER TABLE grocery_items ADD COLUMN note TEXT
                `, (err) => {
                    // Ignore error if column already exists
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('Error adding note column:', err);
                    }
                });

                // Create sessions table for temporary callback data
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        message_id INTEGER NOT NULL,
                        data TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating sessions table:', err);
                        reject(err);
                        return;
                    }
                });

                // Create indexes
                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_grocery_status 
                    ON grocery_items(status)
                `, (err) => {
                    if (err) {
                        console.error('Error creating grocery status index:', err);
                        reject(err);
                        return;
                    }
                });

                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_grocery_batch 
                    ON grocery_items(batch_id)
                `, (err) => {
                    if (err) {
                        console.error('Error creating grocery batch index:', err);
                        reject(err);
                        return;
                    }
                });

                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires 
                    ON sessions(expires_at)
                `, (err) => {
                    if (err) {
                        console.error('Error creating sessions expires index:', err);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    getConnection() {
        return this.db;
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }

    // Helper method to run queries with promises
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Helper method to get single row
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Helper method to get multiple rows
    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

// Create singleton instance
const database = new Database();

module.exports = database; 