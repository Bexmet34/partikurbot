const db = require('./db');
const { getSupabaseGuildSettings, updateGuildLanguage } = require('./guildSettingsService');

/**
 * Gets configuration for a specific guild
 */
async function getGuildConfig(guildId) {
    try {
        const row = await db.get('SELECT * FROM guild_configs WHERE guild_id = ?', [guildId]);
        let configResult = row || {};
        
        const sbSettings = await getSupabaseGuildSettings(guildId);
        if (sbSettings) {
            if (sbSettings.language) configResult.language = sbSettings.language;
            configResult.embed_thumbnail_url = sbSettings.embed_thumbnail_url;
            configResult.party_templates = sbSettings.party_templates;
        }

        return Object.keys(configResult).length > 0 ? configResult : null;

    } catch (error) {
        console.error(`[GuildConfig] Error fetching for ${guildId}:`, error);
        return null;
    }
}

/**
 * Updates or sets configuration for a guild
 */
async function updateGuildConfig(guildId, data) {
    const { guild_name, albion_guild_id, log_channel_id, language, welcome_message } = data;
    try {
        if (data.language) {
            await updateGuildLanguage(guildId, data.language);
        }

        await db.run(
            `INSERT INTO guild_configs (guild_id, guild_name, albion_guild_id, log_channel_id, language, welcome_message, setup_completed) 
             VALUES (?, ?, ?, ?, ?, ?, 1) 
             ON CONFLICT(guild_id) DO UPDATE SET 
                guild_name = COALESCE(excluded.guild_name, guild_name), 
                albion_guild_id = COALESCE(excluded.albion_guild_id, albion_guild_id), 
                log_channel_id = COALESCE(excluded.log_channel_id, log_channel_id),
                language = COALESCE(excluded.language, language),
                welcome_message = COALESCE(excluded.welcome_message, welcome_message)`,
            [guildId, guild_name, albion_guild_id, log_channel_id, language || 'tr', welcome_message || 'Selam, Hoşgeldiniz!']
        );
        return true;
    } catch (error) {

        console.error(`[GuildConfig] Error updating for ${guildId}:`, error);
        return false;
    }
}

module.exports = { getGuildConfig, updateGuildConfig };
