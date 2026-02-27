const db = require('./db');

/**
 * Gets configuration for a specific guild
 */
async function getGuildConfig(guildId) {
    try {
        const row = await db.get('SELECT * FROM guild_configs WHERE guild_id = ?', [guildId]);
        return row || null;

    } catch (error) {
        console.error(`[GuildConfig] Error fetching for ${guildId}:`, error);
        return null;
    }
}

/**
 * Updates or sets configuration for a guild
 */
async function updateGuildConfig(guildId, data) {
    const { guild_name, albion_guild_id, log_channel_id, language } = data;
    try {
        await db.run(
            `INSERT INTO guild_configs (guild_id, guild_name, albion_guild_id, log_channel_id, language, setup_completed) 
             VALUES (?, ?, ?, ?, ?, 1) 
             ON CONFLICT(guild_id) DO UPDATE SET 
                guild_name = COALESCE(excluded.guild_name, guild_name), 
                albion_guild_id = COALESCE(excluded.albion_guild_id, albion_guild_id), 
                log_channel_id = COALESCE(excluded.log_channel_id, log_channel_id),
                language = COALESCE(excluded.language, language)`,
            [guildId, guild_name, albion_guild_id, log_channel_id, language || 'tr']
        );
        return true;
    } catch (error) {

        console.error(`[GuildConfig] Error updating for ${guildId}:`, error);
        return false;
    }
}

module.exports = { getGuildConfig, updateGuildConfig };
