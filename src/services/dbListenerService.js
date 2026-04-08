const supabase = require('./supabaseClient');
const { sendSubscriptionNotification } = require('../utils/notificationUtils');

let lastKnownSubs = new Map();

/**
 * Periodically checks the database for changes (Polling).
 * This works on all Supabase plans (including Free) without requiring Realtime setup.
 * @param {import('discord.js').Client} client 
 */
async function initDbListeners(client) {
    console.log('[DbListenerService] Polling system started (checking every 60 seconds)...');

    // Fetch initial state to avoid spamming notifications on bot restart
    await checkUpdates(client, true);

    // Check for updates every 60 seconds
    setInterval(async () => {
        await checkUpdates(client);
    }, 60000);
}

/**
 * Checks for differences between current DB state and the last known state.
 */
async function checkUpdates(client, initial = false) {
    try {
        const { data: subs, error } = await supabase
            .from('subscriptions')
            .select('*');

        if (error) throw error;

        for (const sub of subs) {
            const guildId = sub.guild_id;
            const oldSub = lastKnownSubs.get(guildId);

            // If we have an old record, compare for changes
            if (!initial && oldSub) {
                // 1. Unlimited Mode Activation
                if (!oldSub.is_unlimited && sub.is_unlimited) {
                    await sendSubscriptionNotification(client, guildId, 'unlimited');
                }
                // 2. Server Disabled (active -> inactive)
                else if (oldSub.is_active && !sub.is_active) {
                    await sendSubscriptionNotification(client, guildId, 'disabled');
                }
                // 3. Subscription Extension (expiry date increased)
                else if (sub.expires_at !== oldSub.expires_at) {
                    const oldExpiry = new Date(oldSub.expires_at);
                    const newExpiry = new Date(sub.expires_at);

                    if (newExpiry > oldExpiry) {
                        const diffInMs = newExpiry - oldExpiry;
                        const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
                        
                        if (diffInDays > 0) {
                            await sendSubscriptionNotification(client, guildId, 'extended', diffInDays);
                        }
                    }
                }
            }

            // Update the memory map with the latest record
            lastKnownSubs.set(guildId, sub);
        }
    } catch (err) {
        console.error('[DbListenerService] Polling Error:', err.message);
    }
}

module.exports = { initDbListeners };
