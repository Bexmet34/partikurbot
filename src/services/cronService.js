const cron = require('node-cron');
const supabase = require('./supabaseClient');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

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

                        const embed = new EmbedBuilder()
                            .setTitle('⚠️ Abonelik Süreniz Bitmek Üzere!')
                            .setDescription(`**${sub.guild_name}** sunucusu için Discord Bot aboneliğinizin süresi **24 saatten az** bir süre sonra dolacaktır.\n\nSüre dolduğunda `/createparty` komutu kullanılamayacaktır. Süreyi uzatmak için hemen destek sunucumuza katılabilirsiniz.`)
                            .addFields(
                                { name: 'Bitiş Tarihi', value: new Date(sub.expires_at).toLocaleString('tr-TR'), inline: true }
                            )
                            .setColor('#E67E22')
                            .setFooter({ text: 'Veyronix Party Master • Subscription System' });

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('Destek Sunucusuna Katıl')
                                .setURL(config.SUPPORT_SERVER_LINK)
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
}

module.exports = { startCronService };
