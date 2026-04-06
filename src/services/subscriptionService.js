const supabase = require('./supabaseClient');

/**
 * Gets subscription for a guild. If not exists, creates a 3-day trial.
 * @param {string} guildId 
 * @param {string} guildName 
 * @param {string} ownerId 
 */
async function getSubscription(guildId, guildName, ownerId) {
    try {
        // 1. Get from database
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('guild_id', guildId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
             console.error('[SubscriptionService] Fetch Error:', error.message);
             return null;
        }

        // 2. If exists, return it
        if (data) return data;

        // 3. If not exists, create 3-day trial
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 3);

        const { data: newData, error: insertError } = await supabase
            .from('subscriptions')
            .insert([
                { 
                    guild_id: guildId, 
                    guild_name: guildName || 'Unknown', 
                    owner_id: ownerId || 'Unknown',
                    expires_at: expiresAt.toISOString(),
                    trial_used: true
                }
            ])
            .select()
            .single();

        if (insertError) {
            console.error('[SubscriptionService] Trial Create Error:', insertError.message);
            return null;
        }

        console.log(`[SubscriptionService] 3-Day Trial created for ${guildName} (${guildId})`);
        return newData;

    } catch (err) {
        console.error('[SubscriptionService] Critical Error:', err.message);
        return null;
    }
}

/**
 * Checks if subscription is active
 * @param {string} guildId 
 * @param {string} guildName 
 * @param {string} ownerId 
 */
async function isSubscriptionActive(guildId, guildName, ownerId) {
    const sub = await getSubscription(guildId, guildName, ownerId);
    
    if (!sub) return false;
    if (sub.is_unlimited) return true;
    if (!sub.is_active) return false;

    const expiresAt = new Date(sub.expires_at);
    const now = new Date();

    return expiresAt > now;
}

/**
 * Adds days to subscription
 * @param {string} guildId 
 * @param {number} days 
 */
async function addSubscriptionDays(guildId, days) {
    // First get current
    const { data: current } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('guild_id', guildId)
        .single();
    
    let baseDate = new Date();
    if (current && new Date(current.expires_at) > baseDate) {
        baseDate = new Date(current.expires_at);
    }

    baseDate.setDate(baseDate.getDate() + parseInt(days));

    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            expires_at: baseDate.toISOString(), 
            is_active: true,
            updated_at: new Date().toISOString() 
        })
        .eq('guild_id', guildId);

    return !error;
}

/**
 * Sets unlimited subscription
 */
async function setUnlimitedSubscription(guildId, value = true) {
    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            is_unlimited: value, 
            is_active: true,
            updated_at: new Date().toISOString() 
        })
        .eq('guild_id', guildId);
    return !error;
}

/**
 * Removes days from subscription
 * @param {string} guildId 
 * @param {number} days 
 */
async function removeSubscriptionDays(guildId, days) {
    const { data: current } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('guild_id', guildId)
        .single();
    
    if (!current) return false;

    let baseDate = new Date(current.expires_at);
    baseDate.setDate(baseDate.getDate() - parseInt(days));

    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            expires_at: baseDate.toISOString(), 
            updated_at: new Date().toISOString() 
        })
        .eq('guild_id', guildId);

    return !error;
}

/**
 * Sets subscription active status
 */
async function setSubscriptionActive(guildId, value = true) {
    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            is_active: value,
            updated_at: new Date().toISOString() 
        })
        .eq('guild_id', guildId);
    return !error;
}

module.exports = {
    getSubscription,
    isSubscriptionActive,
    addSubscriptionDays,
    removeSubscriptionDays,
    setUnlimitedSubscription,
    setSubscriptionActive
};
