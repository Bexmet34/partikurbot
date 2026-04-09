const supabase = require('./supabaseClient');

/**
 * Fetch the guild settings from supabase database
 * @param {string} guildId 
 * @returns {Promise<Object|null>}
 */
async function getSupabaseGuildSettings(guildId) {
    try {
        if (!guildId) return null;
        const { data, error } = await supabase
            .from('guild_settings')
            .select('*')
            .eq('guild_id', guildId)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // PGRST116 is not found
                console.error(`[Supabase] Error fetching guild_settings for ${guildId}:`, error.message);
            }
            return null;
        }

        return data; // Returns the full row: id, guild_id, owner_id, language, embed_thumbnail_url, party_templates, etc.
    } catch (e) {
        console.error(`[Supabase] Exception fetching guild_settings for ${guildId}:`, e.message);
        return null;
    }
}

/**
 * Update the guild language in supabase database
 * @param {string} guildId 
 * @param {string} language 'en' or 'tr'
 * @returns {Promise<boolean>}
 */
async function updateGuildLanguage(guildId, language, ownerId = null) {
    try {
        const { data: existing } = await supabase
            .from('guild_settings')
            .select('id')
            .eq('guild_id', guildId)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('guild_settings')
                .update({ language, updated_at: new Date().toISOString() })
                .eq('guild_id', guildId);
            return !error;
        } else {
            const { error } = await supabase
                .from('guild_settings')
                .insert({ 
                    guild_id: guildId, 
                    owner_id: ownerId || guildId, // fallback if not provided
                    language, 
                    created_at: new Date().toISOString(), 
                    updated_at: new Date().toISOString() 
                });
            return !error;
        }
    } catch (error) {
        console.error(`[Supabase] Error updating language for ${guildId}:`, error);
        return false;
    }
}

module.exports = {
    getSupabaseGuildSettings,
    updateGuildLanguage
};
