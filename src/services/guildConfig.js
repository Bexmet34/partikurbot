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
    const { guild_name, albion_guild_id, log_channel_id } = data;
    try {
        await db.run(
            `INSERT INTO guild_configs (guild_id, guild_name, albion_guild_id, log_channel_id, setup_completed) 
             VALUES (?, ?, ?, ?, 1) 
             ON CONFLICT(guild_id) DO UPDATE SET 
                guild_name = excluded.guild_name, 
                albion_guild_id = excluded.albion_guild_id, 
                log_channel_id = excluded.log_channel_id`,
            [guildId, guild_name, albion_guild_id, log_channel_id]
        );
        return true;
    } catch (error) {
        console.error(`[GuildConfig] Error updating for ${guildId}:`, error);
        return false;
    }
}

module.exports = { getGuildConfig, updateGuildConfig };
