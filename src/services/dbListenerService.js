const supabase = require('./supabaseClient');
const { sendSubscriptionNotification } = require('../utils/notificationUtils');

/**
 * Initializes listeners for database changes to trigger notifications.
 * @param {import('discord.js').Client} client 
 */
function initDbListeners(client) {
    console.log('[DbListenerService] Initializing Realtime listeners for subscriptions...');

    // Note: To get 'oldData', the table must have REPLICA IDENTITY FULL.
    // Run this in Supabase SQL Editor: ALTER TABLE subscriptions REPLICA IDENTITY FULL;
    
    supabase
        .channel('subscription_changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'subscriptions'
            },
            async (payload) => {
                const oldData = payload.old;
                const newData = payload.new;

                console.log(`[DbListenerService] Change detected for guild: ${newData.guild_id}`);
                await handleSubscriptionUpdate(client, oldData, newData);
            }
        )
        .subscribe((status) => {
            console.log(`[DbListenerService] Subscription listener status: ${status}`);
        });
}

/**
 * Handles subscription update logic and sends notifications.
 */
async function handleSubscriptionUpdate(client, oldData, newData) {
    const guildId = newData.guild_id;

    // 1. Check for 'disabled' (is_active: false)
    // If oldData is available, check for transition. If not, just check current value.
    if (newData.is_active === false) {
        if (!oldData || oldData.is_active !== false) {
            await sendSubscriptionNotification(client, guildId, 'disabled');
            return;
        }
    }

    // 2. Check for 'unlimited' (is_unlimited: true)
    if (newData.is_unlimited === true) {
        if (!oldData || oldData.is_unlimited !== true) {
            await sendSubscriptionNotification(client, guildId, 'unlimited');
            return;
        }
    }

    // 3. Check for 'extended' (expires_at change)
    if (newData.expires_at) {
        if (oldData && oldData.expires_at) {
            const oldExpiry = new Date(oldData.expires_at);
            const newExpiry = new Date(newData.expires_at);

            if (newExpiry > oldExpiry) {
                const diffInMs = newExpiry - oldExpiry;
                const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

                if (diffInDays > 0) {
                    await sendSubscriptionNotification(client, guildId, 'extended', diffInDays);
                }
            }
        } else if (!oldData) {
            // Fallback: If we don't have old data, we can't calculate days, 
            // but we know it's an update. We can send a generic extension message or skip.
            // For now, let's skip to avoid spamming on every minor update.
        }
    }
}

module.exports = { initDbListeners };
