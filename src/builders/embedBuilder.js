const { EmbedBuilder } = require('discord.js');
const { NOTLAR_METNI, ROLE_ICONS } = require('../constants/constants');
const config = require('../config/config');
const { t } = require('../services/i18n');
const { createProgressBar, cleanTitle } = require('../utils/generalUtils');


/**
 * Creates a PVE embed
 */
function createEmbed(title, details, content, roles, isClosed = false, guildName = 'Albion', lang = 'tr') {
    const cleanTitle = title.replace(new RegExp(`^🛡️ ${guildName} \\| `), '').replace(/ \[.*?\]$/, '');

    // Build description with better formatting
    let description = `📋 **${t('common.details', lang)}:**\n${details}\n\n`;
    description += `🎯 **${t('common.content', lang)}:**\n${content}`;

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} | ${cleanTitle}${isClosed ? ` [${t('common.closed', lang)}]` : ''}`)
        .setDescription(description)
        .setColor(isClosed ? '#808080' : '#F1C40F')
        .addFields(
            { name: `👥 **${t('common.party_roster', lang)}**`, value: '\u200b', inline: false },
            {
                name: `${roles.tank === '-' ? '🟡' : '🔴'} 1. Tank:`,
                value: roles.tank,
                inline: false
            },
            {
                name: `${roles.heal === '-' ? '🟡' : '🔴'} 2. Heal:`,
                value: roles.heal,
                inline: false
            },
            ...roles.dps.map((d, index) => ({
                name: `${d === '-' ? '🟡' : '🔴'} ${index + 3}. DPS:`,
                value: d,
                inline: false
            }))
        );

    if (!isClosed) {
        // Calculate counts for progress bar
        const total = 2 + roles.dps.length;
        const filled = [roles.tank, roles.heal, ...roles.dps].filter(v => v !== '-').length;
        embed.setFooter({ text: `${t('common.fullness', lang)}: ${createProgressBar(filled, total)}` });
    }

    return embed;
}

/**
 * Creates a custom party embed
 */
function createPartikurEmbed(header, rolesList, description = '', content = '', currentCount = 0, guildName = 'Albion', lang = 'tr', ownerId = null) {
    const sanitizedHeader = cleanTitle(header) || '**PARTI KURULDU**';

    const embed = new EmbedBuilder()
        .setTitle(sanitizedHeader)
        .setColor(12770100);

    const leaderText = ownerId ? `<@${ownerId}>` : t('common.not_set', lang);
    const placeText = content || t('common.not_set', lang);
    const descText = description || t('common.not_set', lang);

    embed.addFields({
        name: 'Genel Bilgiler',
        value: `Parti Lideri: ${leaderText}\nÇıkış Yeri: ${placeText}\nAçıklama: ${descText}`
    });

    // The 'Roller' field will be added in handlePartiModal or buttonHandler
    // with value as a multi-line string.

    return embed;
}

/**
 * Creates the footer links and progress bar as fields
 */
function addFooterFields(embed, currentCount, totalCount, lang = 'tr') {
    const progressBar = createProgressBar(currentCount, totalCount);

    embed.addFields(
        {
            name: '',
            value: `${currentCount}/${totalCount} ${progressBar} (${Math.round((currentCount / totalCount) * 100)}%)`
        },
        {
            name: '',
            value: `[Website ](https://veyronixbot.vercel.app/) - [Support](https://discord.gg/RZJE77KEVB)  -  [Donate](https://www.shopier.com/CyberShadows/44734656)\n\n`
        }
    );
}

/**
 * Creates a paginated help embed
 */
function createHelpEmbed(page = 0, guildName = 'Albion', lang = 'tr') {
    const embeds = [
        // Page 0: Overview
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | ${t('help.title_general', lang)}`)
            .setColor('#F1C40F')
            .setDescription(`**${guildName} Content Bot** ${t('help.desc_general', lang)}\n\n` +
                `🔹 **${t('common.details', lang)}:** ${t('help.desc_goal', lang)}\n\n` +
                `🔽 ${t('help.desc_nav', lang)}`)
            .addFields(
                { name: `📄 ${t('common.page', lang)} 1`, value: `📊 ${t('help.page_1', lang)}`, inline: true },
                { name: `📄 ${t('common.page', lang)} 2`, value: `🛡️ ${t('help.page_2', lang)}`, inline: true },
                { name: `📄 ${t('common.page', lang)} 3`, value: `🌐 ${t('help.page_3', lang)}`, inline: true }
            )
            .setFooter({ text: `${t('common.page', lang)} 1/4 • ${t('help.footer_nav', lang)}` }),

        // Page 1: Commands
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | ${t('help.title_commands', lang)}`)
            .setColor('#3498DB')
            .setDescription(`${t('help.title_commands', lang)}:`)
            .addFields(
                { name: '🏗️ `/createparty`', value: t('help.cmd_createparty', lang) },
                { name: '🔍 `/stats [name]`', value: t('help.cmd_stats', lang) },
                { name: '👥 `/members`', value: t('help.cmd_members', lang) },
                { name: '⚙️ `/settings`', value: t('help.cmd_settings', lang) },
                { name: 'ℹ️ `/help`', value: t('help.cmd_help', lang) }
            )
            .setFooter({ text: `${t('common.page', lang)} 2/4 • ${t('help.footer_commands', lang)}` }),

        // Page 2: Management & Limits
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | ${t('help.title_management', lang)}`)
            .setColor('#E67E22')
            .setDescription(`${t('help.title_management', lang)}:`)
            .addFields(
                { name: `🚫 ${t('help.mgmt_limits_title', lang)}`, value: t('help.mgmt_limits_desc', lang) },
                { name: `🔑 ${t('help.mgmt_whitelist_title', lang)}`, value: t('help.mgmt_whitelist_desc', lang) },
                { name: `🧹 ${t('help.mgmt_cleanup_title', lang)}`, value: t('help.mgmt_cleanup_desc', lang) }
            )
            .setFooter({ text: `${t('common.page', lang)} 3/4 • ${t('help.footer_limits', lang)}` }),

        // Page 3: Links & Support
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | ${t('help.title_links', lang)}`)
            .setColor('#2ECC71')
            .setDescription(`${t('help.title_links', lang)}:`)
            .addFields(
                { name: '🌐 Web Site', value: '[veyronixbot.vercel.app](https://veyronixbot.vercel.app/)', inline: true },
                { name: `💬 ${t('help.support_server', lang)}`, value: `[${t('settings.success', lang).includes('successfully') ? 'Join here' : 'Katılmak için tıkla'}](https://discord.gg/RZJE77KEVB)`, inline: true },

                { name: '💎 Developer', value: 'Nyks', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `${t('common.page', lang)} 4/4 • ${t('help.footer_contact', lang)}` })
    ];




    return embeds[page] || embeds[0];
}

/**
 * Creates the donation embed
 */
function createDonateEmbed(lang = 'tr') {
    const embed = new EmbedBuilder()
        .setTitle(t('help.donate_title', lang))
        .setDescription(t('help.donate_description', lang))
        .setColor('#E91E63')
        .addFields(
            { name: '\u200b', value: t('help.donate_bank_info', lang) }
        )
        // .setImage('QR_CODE_IMAGE_URL_HERE') // QR kod görselini buraya ekleyebilirsiniz
        .setFooter({ text: t('help.donate_paytr_soon', lang) });

    return embed;
}


/**
 * Builds the multi-line string for the 'Roller' field
 */
function buildRolesValue(rolesWithMembers, lang = 'tr') {
    return rolesWithMembers.map(item => {
        const emoji = item.userId ? '🔴' : '🟡';
        const mention = item.userId ? `<@${item.userId}>` : '" "';
        return `${emoji} **${item.role}:** ${mention}`;
    }).join('\n');
}

module.exports = {
    createEmbed,
    createPartikurEmbed,
    addFooterFields,
    buildRolesValue,
    createHelpEmbed,
    createDonateEmbed,
    createProgressBar
};

