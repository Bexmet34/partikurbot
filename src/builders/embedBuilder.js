const { EmbedBuilder } = require('discord.js');
const { LOGO_NAME, LINKS } = require('../constants/constants');
const { t } = require('../services/i18n');

/**
 * Creates help embeds for the /help command
 */
function createHelpEmbed(page = 0, guild = null, lang = 'tr') {
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setThumbnail(`attachment://${LOGO_NAME}`)
        .setTimestamp()
        .setFooter({ text: 'Veyronix Party Master • ' + (page === 0 ? t('help.footer_page_0', lang) : t('help.footer_page_1', lang)) });

    if (page === 0) {
        embed.setTitle(t('help.title_page_0', lang))
            .setDescription(t('help.desc_page_0', lang))
            .addFields(
                { name: t('help.field_features_title', lang), value: t('help.field_features_value', lang) },
                { name: t('help.field_nav_title', lang), value: t('help.field_nav_value', lang).split('\n').slice(0, 3).join('\n') }
            );
    } else {
        embed.setTitle(t('help.title_page_1', lang))
            .setDescription(t('help.desc_page_1', lang))
            .addFields(
                { name: '`/createparty`', value: t('help.cmd_createparty', lang) },
                { name: '`/closeparty`', value: t('help.cmd_closeparty', lang) },
                { name: '`/stats`', value: t('help.cmd_stats', lang) },
                { name: '`/members`', value: t('help.cmd_members', lang) },
                { name: '`/settings`', value: t('help.cmd_settings', lang) },
                { name: '`/help`', value: t('help.cmd_help', lang) }
            );
    }

    return embed;
}

/**
 * Formats a party embed
 */
function createPartyEmbed(data, lang = 'tr') {
    const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description || t('common.not_set', lang))
        .setColor('#F1C40F')
        .addFields(
            { name: `👑 ${t('party.party_leader', lang)}`, value: `<@${data.leaderId}>`, inline: true }
        )
        .setThumbnail(`attachment://${LOGO_NAME}`)
        .setTimestamp();

    if (data.roles && data.roles.length > 0) {
        data.roles.forEach(role => {
            const memberList = role.members.length > 0 
                ? role.members.map(m => `<@${m}>`).join(', ') 
                : `*${t('common.waiting', lang)}...*`;
            
            embed.addFields({ 
                name: `${role.name} (${role.members.length}/${role.limit || '∞'})`, 
                value: memberList, 
                inline: false 
            });
        });
    }

    return embed;
}

module.exports = {
    createHelpEmbed,
    createPartyEmbed
};
