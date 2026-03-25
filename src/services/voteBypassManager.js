const db = require('./db');
const config = require('../config/config');

/**
 * Check if user is in the vote bypass list
 * Always returns true for Bot Owner
 * @param {string} userId
 */
async function isVoteBypassed(userId) {
    // 1. Check if Bot Owner
    if (config.OWNER_ID && userId === config.OWNER_ID) {
        return true;
    }

    // 2. Check Database
    try {
        const row = await db.get(
            'SELECT 1 FROM vote_bypass WHERE user_id = ?',
            [userId]
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
 */
async function addToVoteBypass(userId) {
    try {
        await db.run(
            'INSERT OR IGNORE INTO vote_bypass (user_id) VALUES (?)',
            [userId]
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
 */
async function removeFromVoteBypass(userId) {
    try {
        const result = await db.run(
            'DELETE FROM vote_bypass WHERE user_id = ?',
            [userId]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('[VoteBypassManager] Error removing from vote bypass:', error.message);
        return false;
    }
}

module.exports = {
    isVoteBypassed,
    addToVoteBypass,
    removeFromVoteBypass
};
