const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'parties.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

/**
 * Reads the parties data from JSON file
 */
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[PartyManager] Error reading database:', error.message);
        return {};
    }
}

/**
 * Writes the parties data to JSON file
 */
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[PartyManager] Error writing to database:', error.message);
    }
}

/**
 * Check if user has an active party
 */
function hasActiveParty(userId) {
    const data = readData();
    const entry = data[userId];
    if (!entry) return false;
    return entry.length > 0;
}

/**
 * Get active party count for a user
 */
function getActivePartyCount(userId) {
    const data = readData();
    const entry = data[userId];
    if (!entry) return 0;
    return entry.length;
}

/**
 * Get user's active parties info [{ messageId, channelId }]
 */
function getActiveParties(userId) {
    const data = readData();
    const entry = data[userId];
    if (!entry) return [];

    // Support legacy single-object storage by wrapping it in an array
    if (!Array.isArray(entry)) {
        return [entry];
    }

    return entry;
}

/**
 * Set user's active party (Persistent)
 */
function setActiveParty(userId, messageId, channelId) {
    const data = readData();
    const newParty = { messageId, channelId };

    if (!data[userId]) {
        data[userId] = [newParty];
    } else {
        data[userId].push(newParty);
    }

    writeData(data);
    // console.log(`[PartyManager] Database Updated: User ${userId} -> Party ${messageId} in ${channelId}`);

}

/**
 * Remove user's active party (Persistent)
 */
function removeActiveParty(userId, messageId = null) {
    const data = readData();
    const entry = data[userId];

    if (!entry) {
        console.log(`[PartyManager] User ${userId} requested to close a party but no active party found in Database.`);
        return false;
    }

    // If no specific messageId, clear EVERYTHING for this user
    if (!messageId) {
        delete data[userId];
        writeData(data);
        console.log(`[PartyManager] ✅ Database Updated: User ${userId} all status cleared.`);
        return true;
    }

    if (!Array.isArray(entry)) {
        // Legacy single object handling
        const storedId = typeof entry === 'object' ? entry.messageId : entry;
        if (storedId !== messageId) {
            console.log(`[PartyManager] Note: Closing party ${messageId} while DB tracked ${storedId}. Clearing status.`);
        }
        delete data[userId];
        writeData(data);
        console.log(`[PartyManager] ✅ Database Updated: User ${userId} legacy status cleared.`);
        return true;
    }

    // Array handling
    if (Array.isArray(entry)) {
        data[userId] = entry.filter(p => {
            const mid = typeof p === 'object' ? p.messageId : p;
            return mid !== messageId;
        });

        if (data[userId].length === 0) {
            delete data[userId];
        }
    } else {
        // Handle legacy single object or non-array (already checked not null/undefined)
        const storedId = typeof entry === 'object' ? entry.messageId : entry;
        if (storedId === messageId) {
            delete data[userId];
        }
    }

    writeData(data);
    return true;
}

module.exports = {
    hasActiveParty,
    getActivePartyCount,
    getActiveParties,
    setActiveParty,
    removeActiveParty
};
