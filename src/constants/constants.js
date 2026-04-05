// Slot and Party Constants
const EMPTY_SLOT = '-';

// If role count exceeds this, use a select menu instead of buttons
const SELECT_MENU_THRESHOLD = 7;

// Default Content
const DEFAULT_CONTENT = "STATİK RAT\nTRACKİNG BİZİM MAP\nGRUP CAMP BOSS LAIRY\nKRİSTAL";

const config = require('../config/config');

// Notes Text
const getNotlarMetni = (guildName, lang = 'tr') => {
    if (lang === 'en') {
        return [
            `**📌 ${guildName}** guild rules must be followed.`,
            '**🎤 Discord** voice channel is mandatory.',
            '**🛡️ No death risk** in our own territories.',
            '**💰 Loot** distribution belongs to the leader.',
            '**⏰ Latecomers** will not be accepted.'
        ].join('\n');
    }
    return [
        `**📌 ${guildName}** guild kurallarına uyum zorunludur.`,
        '**🎤 Discord** sesli kanala giriş zorunludur.',
        '**🛡️ Kendi bölgelerimizde** ölüm riski yoktur.',
        '**💰 Loot** dağıtımı lidere aittir.',
        '**⏰ Geç kalan** alınmaz.'
    ].join('\n');
};




// Role Icons
const ROLE_ICONS = {
    TANK: '🛡️',
    HEAL: '☘️',
    DPS: '⚔️',
    DEFAULT: '👤'
};

const LOGO_PATH = 'c:/Users/Casper/Desktop/partikurbot/assets/images/logo.png';
const LOGO_NAME = 'logo.png';

module.exports = {
    EMPTY_SLOT,
    SELECT_MENU_THRESHOLD,
    DEFAULT_CONTENT,
    getNotlarMetni,
    ROLE_ICONS,
    LOGO_PATH,
    LOGO_NAME
};

