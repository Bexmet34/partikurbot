const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.sqlite');

// Ensure data folder exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

/**
 * Initialize database tables
 */
function initDb() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Parties table
            db.run(`CREATE TABLE IF NOT EXISTS parties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE,
                channel_id TEXT,
                owner_id TEXT,
                type TEXT, -- pve, pvp
                title TEXT,
                status TEXT DEFAULT 'active', -- active, closed, pending, verified
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Party members table (attendance)
            db.run(`CREATE TABLE IF NOT EXISTS party_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                party_id INTEGER,
                user_id TEXT,
                role TEXT,
                status TEXT DEFAULT 'joined', -- joined, confirmed, no_show, cancelled
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
            )`);

            // System settings for persistent configs (like leaderboard message ID)
            db.run(`CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);

            // User stats for prestige
            db.run(`CREATE TABLE IF NOT EXISTS user_stats (
                user_id TEXT PRIMARY KEY,
                confirmed_count INTEGER DEFAULT 0,
                no_show_count INTEGER DEFAULT 0,
                pve_confirmed INTEGER DEFAULT 0,
                pvp_confirmed INTEGER DEFAULT 0,
                total_participated INTEGER DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Per-guild configurations for public use
            db.run(`CREATE TABLE IF NOT EXISTS guild_configs (
                guild_id TEXT PRIMARY KEY,
                guild_name TEXT,
                albion_guild_id TEXT,
                log_channel_id TEXT,
                setup_completed INTEGER DEFAULT 0
            )`);

            // Per-guild whitelist for party limit bypass
            db.run(`CREATE TABLE IF NOT EXISTS guild_whitelist (
                guild_id TEXT,
                user_id TEXT,
                PRIMARY KEY (guild_id, user_id)
            )`, (err) => {


                if (err) reject(err);
                else {
                    // Migration for existing tables: Add columns if they don't exist
                    db.serialize(() => {
                        db.run("ALTER TABLE user_stats ADD COLUMN pve_confirmed INTEGER DEFAULT 0", () => { });
                        db.run("ALTER TABLE user_stats ADD COLUMN pvp_confirmed INTEGER DEFAULT 0", () => { });
                        // Ensure system_settings exists for existing DBs
                        db.run(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`, () => { });
                        resolve();
                    });
                }
            });
        });
    });
}

/**
 * Execute a query with parameters (Run)
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

/**
 * Get a single row
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Get multiple rows
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = {
    initDb,
    run,
    get,
    all
};
