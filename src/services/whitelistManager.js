const db = require('./db');
const config = require('../config/config');

/**
 * Check if user is whitelisted in a specific guild
 * Always returns true for Bot Owner
 * @param {string} userId
 * @param {string} guildId
 */
async function isWhitelisted(userId, guildId) {
    // 1. Check if Bot Owner (Global Access)
    if (config.OWNER_ID && userId === config.OWNER_ID) {
        return true;
    }

    // 2. Check Database for guild specific whitelist
    try {
        const row = await db.get(
            'SELECT 1 FROM guild_whitelist WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        return !!row;
    } catch (error) {
        console.error('[WhitelistManager] Error checking whitelist:', error.message);
        return false;
    }
}

/**
 * Add user to guild-specific whitelist
 * @param {string} userId
 * @param {string} guildId
 */
async function addToWhitelist(userId, guildId) {
    try {
        await db.run(
            'INSERT OR IGNORE INTO guild_whitelist (guild_id, user_id) VALUES (?, ?)',
            [guildId, userId]
        );
        return true;
    } catch (error) {
        console.error('[WhitelistManager] Error adding to whitelist:', error.message);
        return false;
    }
}

/**
 * Remove user from guild-specific whitelist
 * @param {string} userId
 * @param {string} guildId
 */
async function removeFromWhitelist(userId, guildId) {
    try {
        const result = await db.run(
            'DELETE FROM guild_whitelist WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('[WhitelistManager] Error removing from whitelist:', error.message);
        return false;
    }
}

module.exports = {
    isWhitelisted,
    addToWhitelist,
    removeFromWhitelist
};
