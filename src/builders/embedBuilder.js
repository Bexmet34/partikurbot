const { EmbedBuilder } = require('discord.js');
const { NOTLAR_METNI, ROLE_ICONS } = require('../constants/constants');
const config = require('../config/config');


/**
 * Creates a PVE embed
 */
/**
 * Creates a PVE embed
 */
function createEmbed(title, details, content, roles, isClosed = false, guildName = 'Albion') {
    const cleanTitle = title.replace(new RegExp(`^🛡️ ${guildName} \\| `), '').replace(/ \[KAPALI\]$/, '');


    // Build description with better formatting
    let description = `📋 **Detaylar:**\n${details}\n\n`;
    description += `🎯 **İçerik:**\n${content}`;

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} | ${cleanTitle}${isClosed ? ' [KAPALI]' : ''}`)


        .setDescription(description)
        .setColor(isClosed ? '#808080' : '#F1C40F')
        .addFields(
            { name: '👥 **PARTİ KADROSU**', value: '\u200b', inline: false },
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
        embed.setFooter({ text: `Doluluk: ${createProgressBar(filled, total)}` });
    }

    return embed;
}

const { createProgressBar } = require('../utils/generalUtils');

/**
 * Creates a custom party embed
 */
function createPartikurEmbed(header, rolesList, description = '', content = '', currentCount = 0, guildName = 'Albion') {
    let desc = `📍 **Çıkış Yeri:** ${content}`;
    if (description) {
        desc += `\n\n📝 **Parti Notları:**\n${description}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} | ${header}`)


        .setDescription(desc)
        .setColor('#F1C40F')
        .setFooter({ text: `Doluluk: ${createProgressBar(currentCount, rolesList.length)}` });

    return embed;
}

/**
 * Creates a help embed
 */
function createHelpEmbed(guildName = 'Albion') {
    return new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} Content Bot Yardım Menüsü`)


        .setColor('#F1C40F')
        .setDescription('Discord sunucunuz için gelişmiş parti kurma ve yönetim botu.')
        .addFields(
            { name: '🏗️ /partikur', value: 'Özel roller belirleyebileceğiniz parti formu açar.', inline: false },
            { name: 'ℹ️ /yardim', value: 'Bu menüyü görüntüler.', inline: false },
            { name: '💎 Geliştirici', value: '```ansi\n\u001b[31mHakkı\u001b[0m\n```', inline: false }
        );
}

module.exports = {
    createEmbed,
    createPartikurEmbed,
    createHelpEmbed,
    createProgressBar
};
