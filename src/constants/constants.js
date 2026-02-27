// Slot and Party Constants
const EMPTY_SLOT = '-';

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

module.exports = {
    EMPTY_SLOT,
    DEFAULT_CONTENT,
    getNotlarMetni,
    ROLE_ICONS
};

