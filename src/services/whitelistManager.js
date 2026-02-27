const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'whitelist.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

/**
 * Reads the whitelist data from JSON file
 */
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[WhitelistManager] Error reading database:', error.message);
        return [];
    }
}

/**
 * Writes the whitelist data to JSON file
 */
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[WhitelistManager] Error writing to database:', error.message);
    }
}

/**
 * Check if user is whitelisted
 */
function isWhitelisted(userId) {
    const data = readData();
    return data.includes(userId);
}

/**
 * Add user to whitelist
 */
function addToWhitelist(userId) {
    const data = readData();
    if (!data.includes(userId)) {
        data.push(userId);
        writeData(data);
        return true;
    }
    return false;
}

/**
 * Remove user from whitelist
 */
function removeFromWhitelist(userId) {
    const data = readData();
    const index = data.indexOf(userId);
    if (index !== -1) {
        data.splice(index, 1);
        writeData(data);
        return true;
    }
    return false;
}

module.exports = {
    isWhitelisted,
    addToWhitelist,
    removeFromWhitelist
};
