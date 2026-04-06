/**
 * Creates a progress bar
 * @param {number} current Current value
 * @param {number} total Total value
 * @param {number} size Size of the progress bar (default: 15)
 * @returns {string} Formatted progress bar string
 */
function createProgressBar(current, total, size = 15) {
    const progress = Math.round((size * current) / total);
    const emptyProgress = size - progress;

    const progressText = '■'.repeat(progress);
    const emptyProgressText = '□'.repeat(emptyProgress);

    return `${progressText}${emptyProgressText}`;
}

/**
 * Replaces Turkish characters with English equivalents and converts to uppercase
 * @param {string} text Input text
 * @returns {string} Sanitized uppercase text
 */
function cleanTitle(text) {
    if (!text) return '';
    const charMap = {
        'ç': 'C', 'ğ': 'G', 'ı': 'I', 'i': 'I', 'ö': 'O', 'ş': 'S', 'ü': 'U',
        'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    };

    let result = text.split('').map(char => charMap[char] || char).join('');
    return result.toUpperCase();
}

/**
 * Strips discord custom emojis and standard icon emojis from a string
 */
function stripEmojis(text) {
    if (!text) return text;
    let clean = text.replace(/<a?:[^>]+>/g, '');
    clean = clean.replace(/[🔹🔴🟡🟢🟣🟠🔵🟤⚫⚪]/g, '');
    return clean.trim();
}

/**
 * Resolves the appropriate emoji for a given role name
 * @param {string} displayRole 
 * @param {object} guildOrClient 
 * @returns {string} Emoji string (e.g. '🔹' or '<:name:id>')
 */
function resolveRoleEmoji(displayRole, guildOrClient) {
    let emoji = '🔹';
    const client = guildOrClient?.client || guildOrClient;

    if (client) {
        const normRole = displayRole.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Match functions
        const exactFinder = (e) => e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normRole;
        const subFinder = (e) => {
            const normEmoji = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normEmoji.includes(normRole) || normRole.includes(normEmoji);
        };

        let customEmoji = null;
        
        // Pass 1: Application Emojis (Bot's own global emojis) - EXCLUSIVE
        if (client.application && client.application.emojis) {
            const customEmoji = client.application.emojis.cache.find(exactFinder) || 
                              client.application.emojis.cache.find(subFinder);
            if (customEmoji) {
                emoji = customEmoji.toString();
            }
        }
    }
    return emoji;
}

module.exports = {
    createProgressBar,
    cleanTitle,
    stripEmojis,
    resolveRoleEmoji
};
