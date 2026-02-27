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

    const progressText = '█'.repeat(progress);
    const emptyProgressText = '░'.repeat(emptyProgress);
    const percentage = Math.round((current / total) * 100);

    return `[${progressText}${emptyProgressText}] ${current}/${total} (%${percentage})`;
}

module.exports = {
    createProgressBar
};
