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

module.exports = {
    createProgressBar,
    cleanTitle
};
