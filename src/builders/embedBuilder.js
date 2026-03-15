const { EmbedBuilder } = require('discord.js');
const { NOTLAR_METNI, ROLE_ICONS } = require('../constants/constants');
const config = require('../config/config');
const { t } = require('../services/i18n');
const { createProgressBar, cleanTitle } = require('../utils/generalUtils');

function parseEmbedData(embed, lang) {
    const fields = embed.fields || [];
    const rollerValue = fields.find(f => f.name && f.name.includes('Roller'))?.value || '';

    const infoField = fields.find(f => f.value && (f.value.includes('👑') || f.value.includes('📝')))?.value || '';
    const ownerId = infoField.match(/<@(\d+)>/)?.[1] || null;
    
    let description = '';
    const descLabel = t('party.party_description', lang);
    const descLine = infoField.split('\n').find(l => l.includes('📝'));
    if (descLine) {
        // Find the index of the label and skip it along with the colon/bolding
        const labelIndex = descLine.indexOf(descLabel);
        if (labelIndex !== -1) {
            description = descLine.substring(labelIndex + descLabel.length).replace(/^[:\s*]+/, '').trim();
            // Clean up any double labels caused by the previous bug
            while (description.startsWith(descLabel)) {
                description = description.substring(descLabel.length).replace(/^[:\s*]+/, '').trim();
            }
        } else {
            // Fallback: remove icon and any bolded label before colon
            description = descLine.replace(/^📝\s*(\*\*.*?\*\*\s*:\s*)?/, '').trim();
        }
        
        if (description === t('common.not_set', lang) || description === descLabel) {
            description = '';
        }
    }

    const roleRegex = /(?:🔴|🟡)\s*\*\*(.*?):\*\*\s*(<@(\d+)>|)/g;
    let rolesWithMembers = [];
    let match;
    while ((match = roleRegex.exec(rollerValue)) !== null) {
        rolesWithMembers.push({
            role: match[1],
            userId: match[3] || null
        });
    }

    return {
        title: embed.title,
        ownerId,
        content: '',
        partyTime: '',
        description,
        rolesWithMembers
    };
}


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
        name: '',
        value: `👑 **${t('party.party_leader', lang)}:** ${leaderText}\n📝 **${t('party.party_description', lang)}:** ${descText}`
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
        // Page 0: Overview (General Information)
        new EmbedBuilder()
            .setTitle(t('help.title_page_0', lang))
            .setColor(15844367) // #F1C40F
            .setDescription(t('help.desc_page_0', lang))
            .setThumbnail('https://i.imgur.com/8Km9tLL.png')
            .addFields(
                { name: t('help.field_features_title', lang), value: t('help.field_features_value', lang), inline: false },
                { name: t('help.field_categories_title', lang), value: t('help.field_categories_value', lang), inline: false },
                { name: t('help.field_nav_title', lang), value: t('help.field_nav_value', lang), inline: false }
            )
            .setFooter({ text: t('help.footer_page_0', lang) }),

        // Page 1: Basic & Management Commands
        new EmbedBuilder()
            .setTitle(t('help.title_page_1', lang))
            .setColor(3447003) // #3498DB
            .setDescription(t('help.desc_page_1', lang))
            .addFields(
                { name: '🏗️ /createparty', value: t('help.cmd_createparty', lang), inline: false },
                { name: 'ℹ️ /help', value: t('help.cmd_help', lang), inline: false },
                { name: '🔒 /closeparty', value: lang === 'tr' ? 'Aktif partilerinizi manuel olarak kapatmanızı sağlar.' : 'Manually end your active parties.', inline: false },
                { name: '👥 /members', value: t('help.cmd_members', lang), inline: false },
                { name: '📊 /stats [name]', value: t('help.cmd_stats', lang), inline: false },
                { name: '✅ /whitelistadd [user]', value: lang === 'tr' ? 'Bir kullanıcıyı beyaz listeye ekler. **Yönetici yetkisi gerekir.**' : 'Add a user to the whitelist. **Admin permission required.**', inline: false },
                { name: '❌ /whitelistremove [user]', value: lang === 'tr' ? 'Bir kullanıcıyı beyaz listeden çıkarır. **Yönetici yetkisi gerekir.**' : 'Remove a user from the whitelist. **Admin permission required.**', inline: false },
                { name: '⚙️ /settings', value: t('help.cmd_settings', lang) + (lang === 'tr' ? ' **Yönetici yetkisi gerekir.**' : ' **Admin permission required.**'), inline: false }
            )
            .setFooter({ text: t('help.footer_page_1', lang) }),

        // Page 2: Punishment System Commands
        new EmbedBuilder()
            .setTitle(t('help.title_page_2', lang))
            .setColor(15158332) // #E74C3C
            .setDescription(t('help.desc_page_2', lang))
            .addFields(
                { name: '📝 /ceza [kullanici] [aciklama] [ucret]', value: lang === 'tr' ? 'Bir kullanıcıya açıklama ve ücret bilgisiyle birlikte ceza tanımlar.' : 'Defines a penalty with description and fee for a user.', inline: false },
                { name: '📚 /ceza-gecmis [kullanici]', value: lang === 'tr' ? 'Bir kullanıcının geçmişte aldığı cezaları listeler.' : 'Lists previous penalties for a specific user.', inline: false },
                { name: '🛠️ /ceza-ayar', value: t('help.field_ceza_ayar_value', lang), inline: false },
                { name: '📢 /ceza-ayar kanal', value: lang === 'tr' ? 'Ceza bildirimlerinin gönderileceği kanalı ayarlar.' : 'Sets the channel for penalty notifications.', inline: true },
                { name: '🏷️ /ceza-ayar rol', value: lang === 'tr' ? 'Ceza uygulanan kullanıcılara verilecek cezalı rolünü ayarlar.' : 'Sets the penalty role for restricted users.', inline: true },
                { name: '🛡️ /ceza-ayar yetkili-rol', value: lang === 'tr' ? 'Ceza komutlarını kullanabilecek yetkili rolünü ayarlar.' : 'Sets the role authorized to use penalty commands.', inline: true },
                { name: '📄 /ceza-ayar goster', value: lang === 'tr' ? 'Mevcut ceza sistemi ayarlarını görüntüler.' : 'Displays current penalty system configuration.', inline: true },
                { name: t('help.field_note_title', lang), value: t('help.field_note_value', lang), inline: false }
            )
            .setFooter({ text: t('help.footer_page_2', lang) })
            .setTimestamp()
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
        const mention = item.userId ? `<@${item.userId}>` : '';
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
    createProgressBar,
    parseEmbedData
};

