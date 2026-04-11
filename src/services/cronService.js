const cron = require('node-cron');
const supabase = require('./supabaseClient');
const { LINKS } = require('../constants/constants');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const { getGuildConfig } = require('./guildConfig');
const { t } = require('./i18n');

/**
 * Starts the cron service for automatic subscription checks
 * @param {import('discord.js').Client} client 
 */
function startCronService(client) {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('[CronService] 24-hour expiration check running...');
        
        try {
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Fetch subs expiring within 24 hours that haven't been notified
            const { data: subs, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('one_day_notified', false)
                .eq('is_unlimited', false) // Unlimited servers don't need warnings
                .lt('expires_at', tomorrow.toISOString())
                .gt('expires_at', now.toISOString());

            if (error) throw error;

            if (subs && subs.length > 0) {
                console.log(`[CronService] Found ${subs.length} subs requiring notification.`);
                
                for (const sub of subs) {
                    try {
                        const user = await client.users.fetch(sub.owner_id);
                        if (!user) continue;

                        const guildSettings = await getGuildConfig(sub.guild_id);
                        const lang = guildSettings?.language || 'tr';

                        const embed = new EmbedBuilder()
                            .setTitle(t('subscription.one_day_warning_title', lang))
                            .setDescription(t('subscription.one_day_warning_desc', lang).replace('{guildName}', sub.guild_name))
                            .addFields(
                                { name: t('subscription.expires_at', lang), value: new Date(sub.expires_at).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US'), inline: true }
                            )
                            .setColor('#E67E22')
                            .setFooter({ text: 'Veyronix Party Master • Subscription System' });

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel(t('subscription.join_support', lang))
                                .setURL(LINKS.SUPPORT_SERVER)
                                .setStyle(ButtonStyle.Link)
                        );

                        await user.send({ embeds: [embed], components: [row] });
                        
                        // Mark as notified in DB
                        await supabase
                            .from('subscriptions')
                            .update({ one_day_notified: true })
                            .eq('guild_id', sub.guild_id);

                        console.log(`[CronService] Notification sent to owner of ${sub.guild_name}`);

                    } catch (err) {
                        console.error(`[CronService] Failed to notify owner of ${sub.guild_name}:`, err.message);
                        // Even if DM fails, we mark it so we don't try forever if DMs are closed
                        await supabase
                            .from('subscriptions')
                            .update({ one_day_notified: true })
                            .eq('guild_id', sub.guild_id);
                    }
                }
            }

        } catch (err) {
            console.error('[CronService] Error:', err.message);
        }
    });

    // --- Nightly Server Cleanup (02:00 UTC) ---
    cron.schedule('0 2 * * *', async () => {
        console.log('[CronService] Nightly server cleanup running (02:00 UTC)...');
        await performServerCleanup(client, 'Otomatik Gece Taraması');
    }, { timezone: "UTC" });
}

/**
 * Performs server cleanup by comparing database with active guilds.
 * @param {import('discord.js').Client} client 
 * @param {string} source Reason for cleanup (Auto/Manual)
 */
async function performServerCleanup(client, source = 'Sistem') {
    try {
        const BOT_OWNER_ID = '407234961582587916';
        
        // 1. Fetch all subscriptions
        const { data: subs, error } = await supabase
            .from('subscriptions')
            .select('guild_id, guild_name');

        if (error) throw error;

        const deletedServers = [];

        // 2. Check each server
        for (const sub of subs) {
            if (!client.guilds.cache.has(sub.guild_id)) {
                // Bot is not in this server, delete it
                const { error: delError } = await supabase
                    .from('subscriptions')
                    .delete()
                    .eq('guild_id', sub.guild_id);

                if (!delError) {
                    deletedServers.push(`${sub.guild_name} (\`${sub.guild_id}\`)`);
                }
            }
        }

        // 3. Notify Owner
        if (deletedServers.length > 0) {
            try {
                const owner = await client.users.fetch(BOT_OWNER_ID);
                if (owner) {
                    const embed = new EmbedBuilder()
                        .setTitle('🧹 Sunucu Temizliği Tamamlandı')
                        .setDescription(`Botun artık bulunmadığı sunucular veritabanından başarıyla temizlendi.\n\n**Kaynak:** \`${source}\``)
                        .addFields({ 
                            name: `Silinen Sunucular (${deletedServers.length})`, 
                            value: deletedServers.join('\n').substring(0, 1024) 
                        })
                        .setColor('#F1C40F')
                        .setTimestamp();

                    await owner.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('[Cleanup] Owner notification failed:', err.message);
            }
        } else {
            console.log(`[Cleanup] ${source}: Herhangi bir geçersiz sunucu bulunamadı.`);
        }

    } catch (err) {
        console.error(`[Cleanup] Error during ${source}:`, err.message);
    }
}

module.exports = { startCronService, performServerCleanup };
