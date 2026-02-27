const tr = require('../locales/tr');
const en = require('../locales/en');

const locales = { tr, en };

/**
 * Get translation for a specific key and language
 * @param {string} key - Translation key (e.g. 'help.title')
 * @param {string} lang - Language code ('tr' or 'en')
 * @param {Object} params - Dynamic parameters to replace in the string
 */
function t(key, lang = 'tr', params = {}) {
    const locale = locales[lang] || locales['tr'];
    let text = key.split('.').reduce((obj, i) => (obj ? obj[i] : null), locale);

    if (!text) {
        // Fallback to Turkish if key not found in selected language
        text = key.split('.').reduce((obj, i) => (obj ? obj[i] : null), locales['tr']);
    }

    if (!text) return key;

    // Replace parameters {name}
    Object.keys(params).forEach(p => {
        text = text.replace(new RegExp(`{${p}}`, 'g'), params[p]);
    });

    return text;
}

module.exports = { t };
