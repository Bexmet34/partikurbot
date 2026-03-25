const db = require('./db');
const config = require('../config/config');

// Hardcoded Bot Owner ID as requested
const HARDCODED_OWNER_ID = '407234961582587916';

/**
 * Check if user is in the vote bypass list
 * Always returns true for Bot Owner
 * @param {string} userId
 * @param {string} guildId
 */
async function isVoteBypassed(userId, guildId) {
    // 1. Check if Bot Owner
    if (userId === HARDCODED_OWNER_ID || (config.OWNER_ID && userId === config.OWNER_ID)) {
        return true;
    }

    // 2. Check Database for GLOBAL or Guild-specific bypass
    try {
        const row = await db.get(
            `SELECT 1 FROM vote_bypass 
             WHERE (guild_id = 'GLOBAL' AND user_id = ?) 
             OR (guild_id = ? AND user_id = ?)`,
            [userId, guildId, userId]
        );
        return !!row;
    } catch (error) {
        console.error('[VoteBypassManager] Error checking vote bypass:', error.message);
        return false;
    }
}

/**
 * Add user to vote bypass list
 * @param {string} userId
 * @param {string} guildId Use 'GLOBAL' for bot-wide bypass
 */
async function addToVoteBypass(userId, guildId) {
    try {
        await db.run(
            'INSERT OR IGNORE INTO vote_bypass (guild_id, user_id) VALUES (?, ?)',
            [guildId, userId]
        );
        return true;
    } catch (error) {
        console.error('[VoteBypassManager] Error adding to vote bypass:', error.message);
        return false;
    }
}

/**
 * Remove user from vote bypass list
 * @param {string} userId
 * @param {string} guildId
 */
async function removeFromVoteBypass(userId, guildId) {
    try {
        const result = await db.run(
            'DELETE FROM vote_bypass WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('[VoteBypassManager] Error removing from vote bypass:', error.message);
        return false;
    }
}

module.exports = {
    HARDCODED_OWNER_ID,
    isVoteBypassed,
    addToVoteBypass,
    removeFromVoteBypass
};
