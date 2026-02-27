require('dotenv').config();

module.exports = {
    // Discord Configuration
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    OWNER_ID: process.env.OWNER_ID,

    // Albion Online Configuration
    ALBION_GUILD_ID: process.env.ALBION_GUILD_ID || 'y76J2p2cR-mI0k5P1N9M8w', // Varsayılan/Örnek ID
    GUILD_NAME: process.env.GUILD_NAME || 'Albion Guild',

    // Registration Settings
    REGISTER_GLOBAL: process.env.REGISTER_GLOBAL === 'true',

    // Bot Settings
    MAX_ACTIVE_PARTIES: 3,

    // Activity
    ACTIVITY_TEXT: '/partikur',

    // Security
    WHITELIST_USERS: process.env.OWNER_ID ? [process.env.OWNER_ID] : [],

    // Log Kanalları
    LOG_CHANNELS: process.env.LOG_CHANNELS ? process.env.LOG_CHANNELS.split(',') : [],
};

