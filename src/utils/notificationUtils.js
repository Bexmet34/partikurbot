const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { LINKS, LOGO_NAME, LOGO_PATH } = require('../constants/constants');
const { t } = require('../services/i18n');

/**
 * Sends a notification to the server owner about subscription changes.
 * Hem Türkçe hem İngilizce mesajı tek embed içinde gönderir.
 * @param {import('discord.js').Client} client 
 * @param {string} guildId 
 * @param {string} type 'extended' | 'unlimited' | 'disabled'
 * @param {number} [days] 
 */
async function sendSubscriptionNotification(client, guildId, type, days = 0) {
    try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const owner = await guild.fetchOwner().catch(() => null);
        if (!owner) return;

        const embed = new EmbedBuilder()
            .setColor(type === 'disabled' ? '#FF0000' : '#00FF00')
            .setThumbnail(`attachment://${LOGO_NAME}`)
            .setTimestamp()
            .setFooter({ text: 'Veyronix Party Master • Subscription Notification' });

        let key = '';
        if (type === 'extended') key = 'extended';
        else if (type === 'unlimited') key = 'unlimited';
        else if (type === 'disabled') key = 'disabled';

        if (!key) return;

        const titleTR = t(`subscription.notification_${key}_title`, 'tr');
        const titleEN = t(`subscription.notification_${key}_title`, 'en');
        
        let descTR = t(`subscription.notification_${key}_desc`, 'tr')
            .replace('{guildName}', guild.name)
            .replace('{days}', days);
        
        let descEN = t(`subscription.notification_${key}_desc`, 'en')
            .replace('{guildName}', guild.name)
            .replace('{days}', days);

        embed.setTitle(`${titleTR} / ${titleEN}`);
        embed.setDescription(`${descTR}\n\n${descEN}`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Website')
                .setStyle(ButtonStyle.Link)
                .setURL(LINKS.WEBSITE),
            new ButtonBuilder()
                .setLabel('Destek / Support')
                .setStyle(ButtonStyle.Link)
                .setURL(LINKS.SUPPORT_SERVER)
        );

        const logo = new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME });

        await owner.send({
            embeds: [embed],
            components: [row],
            files: [logo]
        }).catch(err => console.error(`[NotificationUtils] Could not send DM to owner of ${guild.name}: ${err.message}`));

    } catch (err) {
        console.error('[NotificationUtils] Notification Error:', err.message);
    }
}

module.exports = {
    sendSubscriptionNotification
};
