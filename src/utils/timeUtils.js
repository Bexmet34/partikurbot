/**
 * Parses a time string (e.g., "10dk", "2sa", "3g") into milliseconds.
 * Supports Turkish abbreviations:
 * - s: saniye
 * - dk, m: dakika
 * - sa, h: saat
 * - g, d: gün
 * 
 * @param {string} timeString The time string to parse
 * @returns {number|null} Time in milliseconds, or null if invalid
 */
function parseDuration(timeString) {
    if (!timeString) return null;

    // Normalize input
    const str = timeString.toLowerCase().trim();

    // Regex for number and unit
    const match = str.match(/^(\d+)\s*(s|sn|dk|m|sa|h|g|d)$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's':
        case 'sn':
            return value * 1000;
        case 'dk':
        case 'm':
            return value * 60 * 1000;
        case 'sa':
        case 'h':
            return value * 60 * 60 * 1000;
        case 'g':
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
}

/**
 * Adds milliseconds to current time and returns returns a localized end time string
 * But for Discord timestamps, we just need the deadline timestamp.
 */
function getDeadline(durationMs) {
    return Date.now() + durationMs;
}

module.exports = {
    parseDuration,
    getDeadline
};
