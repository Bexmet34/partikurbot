const { EmbedBuilder, Events } = require('discord.js');
const { NOTLAR_METNI, ROLE_ICONS, LINKS, LOGO_NAME } = require('../constants/constants');
const config = require('../config/config');
const { t } = require('../services/i18n');
const { createProgressBar, cleanTitle, stripEmojis, resolveRoleEmoji } = require('../utils/generalUtils');

/**
 * Parses embed fields to reconstruct the party data
 */
function parseEmbedData(embed, lang) {
    const fields = embed.fields || [];
    // Identify fields containing roles or headers
    const rollerFields = fields.filter(f => 
        (f.name && (f.name.includes('Roller') || f.name.includes('Roles') || f.name.includes('📌'))) ||
        (f.value && (f.value.includes('🔹') || /<a?:\w+:\d+>/.test(f.value) || f.value.includes('📌')))
    );

    const infoField = fields.find(f => f.value && (f.value.includes('👑') || f.value.includes('📝')))?.value || '';
    const ownerId = infoField.match(/<@(\d+)>/)?.[1] || null;
    
    let description = '';
    const descLabel = t('party.party_description', lang);
    const descLine = infoField.split('\n').find(l => l.includes('📝'));
    if (descLine) {
        const labelIndex = descLine.indexOf(descLabel);
        if (labelIndex !== -1) {
            description = descLine.substring(labelIndex + descLabel.length).replace(/^[:\s*]+/, '').trim();
            // Handle double labels if any
            while (description.startsWith(descLabel)) {
                description = description.substring(descLabel.length).replace(/^[:\s*]+/, '').trim();
            }
        } else {
            // Fallback: strip the emoji and "Description:" prefix if present
            description = descLine.replace(/^📝\s*(\*\*.*?\*\*\s*:\s*)?/, '').trim();
        }
        
        if (description === t('common.not_set', lang) || description === descLabel) {
            description = '';
        }
    }

    let rolesWithMembers = [];
    
    for (const field of rollerFields) {
        // If the title of the field is a header (📌)
        if (field.name && field.name.includes('📌')) {
            const headerName = field.name.replace(/^[^📌]*📌/, '').split('[')[0].trim();
            if (headerName) {
                rolesWithMembers.push({
                    role: `#${headerName}`,
                    userId: null
                });
            }
        } else if (field.value && field.value.includes('📌')) {
            // Handle cases where header might still be in the value (migration/fallback)
            const subEntries = field.value.split(/(?=📌)/);
            for (const sub of subEntries) {
                if (sub.startsWith('📌')) {
                    const hName = sub.substring(1).split('\n')[0].trim();
                    rolesWithMembers.push({ role: `#${hName}`, userId: null });
                }
            }
        }

        // Parse roles from values (🔹 or custom emojis)
        const entries = field.value.split(/(?=🔹|<a?:\w+:\d+>)/).map(e => e.trim()).filter(e => e.length > 0);
        for (const entry of entries) {
            // If it's not a role entry, skip
            if (!entry.startsWith('🔹') && !/^<a?:\w+:\d+>/.test(entry)) continue;

            const lines = entry.split('\n');
            const firstLine = lines[0];
            const gear = lines.slice(1).join('\n').trim();
            
            const lineMatch = firstLine.match(/^(?:🔹|<a?:\w+:\d+>)\s*(.*?):\s*(?:<@(\d+)>|)/);
            if (lineMatch) {
                const roleName = lineMatch[1].trim().replace(/\*\*/g, '');
                const userId = lineMatch[2] || null;
                
                let fullRole = roleName;
                if (gear) fullRole += ">" + gear;
                
                rolesWithMembers.push({
                    role: fullRole,
                    userId: userId
                });
            }
        }
    }

    // Waitlist parsing
    let multiRoleWaitlist = [];
    const waitlistField = fields.find(f => f.name && f.name.includes('⏳'));
    if (waitlistField && waitlistField.value) {
        const lines = waitlistField.value.split('\n');
        for (const line of lines) {
            const match = line.match(/<@(\d+)>\s*:\s*(?:\[(.*?)\]\s*)?(.*)/);
            if (match) {
                const userId = match[1];
                const legacyIndicesMatch = match[2];
                const roleNamesStr = match[3];

                let roleIndices = [];
                if (legacyIndicesMatch) {
                    roleIndices = legacyIndicesMatch.split(',').map(n => parseInt(n.trim(), 10));
                } else {
                    const roleNames = roleNamesStr.split(',').map(n => n.trim());
                    roleIndices = roleNames.map(rName => {
                        return rolesWithMembers.findIndex(r => {
                            const baseRole = r.role.includes('>') ? r.role.split('>')[0].trim() : r.role;
                            return baseRole === rName;
                        });
                    }).filter(idx => idx !== -1);
                }
                
                if (roleIndices.length > 0) {
                    multiRoleWaitlist.push({ userId, roleIndices });
                }
            }
        }
    }

    return {
        title: embed.title,
        ownerId,
        content: '',
        partyTime: '',
        description,
        rolesWithMembers,
        multiRoleWaitlist
    };
}


/**
 * Creates a PVE embed (Legacy / Standard)
 */
function createEmbed(title, details, content, roles, isClosed = false, guild = null, lang = 'tr', thumbnailUrl = null) {
    const guildName = guild?.name || 'Albion';
    const cleanTitle = title.replace(new RegExp(`^🛡️ ${guildName} \\| `), '').replace(/ \[.*?\]$/, '');

    // Build description with better formatting
    let description = `📝 **${t('common.details', lang)}:**\n${details}\n\n`;
    description += `📍 **${t('common.content', lang)}:**\n${content}`;

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} | ${cleanTitle}${isClosed ? ` [${t('common.closed', lang)}]` : ''}`)
        .setDescription(description)
        .setColor(isClosed ? '#808080' : '#F1C40F')
        .setThumbnail(thumbnailUrl || `attachment://${LOGO_NAME}`);

    embed.addFields(
            { name: `👥 **${t('common.party_roster', lang)}**`, value: '\u200b', inline: false },
            {
                name: `${resolveRoleEmoji('Tank', guild)} 1. Tank:`,
                value: roles.tank,
                inline: false
            },
            {
                name: `${resolveRoleEmoji('Heal', guild)} 2. Heal:`,
                value: roles.heal,
                inline: false
            },
            ...roles.dps.map((d, index) => ({
                name: `${resolveRoleEmoji('DPS', guild)} ${index + 3}. DPS:`,
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
 * Creates a custom party embed for the Partikur system
 */
function createPartikurEmbed(header, rolesList, description = '', content = '', currentCount = 0, guild = null, lang = 'tr', ownerId = null, thumbnailUrl = null) {
    let sanitizedHeader = header ? cleanTitle(header) : '';
    
    // Explicitly check for generic titles
    const isGeneric = !sanitizedHeader || sanitizedHeader === '**PARTI KURULDU**' || sanitizedHeader === 'PARTI KURULDU' || sanitizedHeader.includes('PARTI KURULDU');

    // If title is generic and first item is a header, use header as title
    const firstRole = rolesList[0];
    if (firstRole && (firstRole.startsWith('#HEADER:') || firstRole.startsWith('#')) && isGeneric) {
        const headerLabel = firstRole.startsWith('#HEADER:') ? firstRole.substring(8).trim() : firstRole.substring(1).trim();
        if (headerLabel) sanitizedHeader = headerLabel.toUpperCase();
    }

    if (!sanitizedHeader) sanitizedHeader = '**PARTİ KURULDU**';

    const embed = new EmbedBuilder()
        .setTitle(sanitizedHeader)
        .setColor(12770100) // Default Gold Color
        .setThumbnail(thumbnailUrl || `attachment://${LOGO_NAME}`);

    const leaderText = ownerId ? `<@${ownerId}>` : t('common.not_set', lang);
    const descText = description || t('common.not_set', lang);

    embed.addFields({
        name: '',
        value: `👑 **${t('party.party_leader', lang)}:** ${leaderText}\n📝 **${t('party.party_description', lang)}:** ${descText}`
    });

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
            value: `[Website](${LINKS.WEBSITE}) - [Top.gg](${LINKS.TOPGG}) - [Shop](${LINKS.SHOPIER})\n\n`
        }
    );
}

/**
 * Creates a paginated help embed
 */
function createHelpEmbed(page = 0, guild = null, lang = 'tr', thumbnailUrl = null) {
    const embeds = [
        // Page 0: Overview
        new EmbedBuilder()
            .setTitle(t('help.title_page_0', lang))
            .setColor(15844367) // #F1C40F
            .setThumbnail(thumbnailUrl || `attachment://${LOGO_NAME}`)
            .setDescription(t('help.desc_page_0', lang))
            .addFields(
                { name: t('help.field_features_title', lang), value: t('help.field_features_value', lang), inline: false },
                { name: t('help.field_categories_title', lang), value: t('help.field_categories_value', lang), inline: false },
                { name: t('help.field_nav_title', lang), value: t('help.field_nav_value', lang), inline: false }
            )
            .setFooter({ text: t('help.footer_page_0', lang) }),

        // Page 1: Commands
        new EmbedBuilder()
            .setTitle(t('help.title_page_1', lang))
            .setColor(3447003) // #3498DB
            .setThumbnail(thumbnailUrl || `attachment://${LOGO_NAME}`)
            .setDescription(t('help.desc_page_1', lang))
            .addFields(
                { name: '🚀 /createparty', value: t('help.cmd_createparty', lang), inline: false },
                { name: '🗳️ /vote', value: t('help.cmd_vote', lang), inline: false },
                { name: 'ℹ️ /help', value: t('help.cmd_help', lang), inline: false },
                { name: '🔒 /closeparty', value: lang === 'tr' ? 'Aktif partilerinizi manuel olarak kapatmanızı sağlar.' : 'Manually end your active parties.', inline: false },
                { name: '👥 /members', value: t('help.cmd_members', lang), inline: false },
                { name: '📊 /stats [name]', value: t('help.cmd_stats', lang), inline: false },
                { name: '✅ /whitelistadd [user]', value: lang === 'tr' ? 'Bir kullanıcıyı beyaz listeye ekler. **Yönetici yetkisi gerekir.**' : 'Add a user to the whitelist. **Admin permission required.**', inline: false },
                { name: '❌ /whitelistremove [user]', value: lang === 'tr' ? 'Bir kullanıcıyı beyaz listeden çıkarır. **Yönetici yetkisi gerekir.**' : 'Remove a user from the whitelist. **Admin permission required.**', inline: false },
                { name: '⚙️ /settings', value: t('help.cmd_settings', lang) + (lang === 'tr' ? ' **Yönetici yetkisi gerekir.**' : ' **Admin permission required.**'), inline: false }
            )
            .setFooter({ text: t('help.footer_page_1', lang) })
    ];

    return embeds[page] || embeds[0];
}

/**
 * Creates the donation embed
 */
function createDonateEmbed(lang = 'tr', guild = null, thumbnailUrl = null) {
    const embed = new EmbedBuilder()
        .setTitle(t('help.donate_title', lang))
        .setDescription(t('help.donate_description', lang))
        .setColor('#E91E63')
        .setThumbnail(thumbnailUrl || `attachment://${LOGO_NAME}`);

    embed.addFields(
            { name: '\u200b', value: t('help.donate_bank_info', lang) }
        )
        .setFooter({ text: t('help.donate_paytr_soon', lang) });

    return embed;
}


/**
 * Builds the multi-line string for the 'Roller' field
 */
function buildRolesValue(rolesWithMembers, lang = 'tr', guildOrClient = null) {
    return rolesWithMembers.map(item => {
        let emoji = '🔹';
        const mention = item.userId ? `<@${item.userId}>` : '';
        
        if (item.role && (item.role.startsWith('#HEADER:') || item.role.startsWith('#'))) {
            const headerLabel = item.role.startsWith('#HEADER:') ? item.role.substring(8).trim() : item.role.substring(1).trim();
            return `\n📌 ${headerLabel}`;
        }

        // Parse Role>Gear format for better display
        let displayRole = item.role;
        let gearInfo = '';
        if (item.role.includes('>')) {
            const parts = item.role.split('>');
            displayRole = parts[0].trim();
            gearInfo = parts.slice(1).join('>').trim();
            if (gearInfo.endsWith('=')) gearInfo = gearInfo.slice(0, -1).trim();
        }

        displayRole = stripEmojis(displayRole);
        emoji = resolveRoleEmoji(displayRole, guildOrClient);

        let line = `${emoji} **${displayRole}**: ${mention}`;
        if (gearInfo) {
            line += `\n${gearInfo}`;
        }
        return line;
    }).join('\n');
}

/**
 * Builds an array of field objects, splitting roles if they exceed 1024 chars
 */
function buildRolesFields(rolesWithMembers, lang = 'tr', guildOrClient = null) {
    const fields = [];
    const hasHeaders = rolesWithMembers.some(r => r.role && (r.role.startsWith('#HEADER:') || r.role.startsWith('#')));
    
    let currentFieldName = hasHeaders ? '\u200b' : `👥 **${lang === 'tr' ? 'Roller' : 'Roles'}**`;
    let currentChunk = [];
    let currentLength = 0;

    rolesWithMembers.forEach((item, index) => {
        const isHeader = item.role && (item.role.startsWith('#HEADER:') || item.role.startsWith('#'));
        
        if (isHeader) {
            const headerLabel = item.role.startsWith('#HEADER:') ? item.role.substring(8).trim() : item.role.substring(1).trim();
            
            if (currentChunk.length > 0) {
                fields.push({
                    name: currentFieldName,
                    value: currentChunk.join('\n'),
                    inline: false
                });
                currentChunk = [];
                currentLength = 0;
            }
            
            currentFieldName = `📌 ${headerLabel}`;
        } else {
            let emoji = '🔹';
            const mention = item.userId ? `<@${item.userId}>` : '';
            
            let displayRole = item.role;
            let gearInfo = '';
            if (item.role.includes('>')) {
                const parts = item.role.split('>');
                displayRole = parts[0].trim();
                gearInfo = parts.slice(1).join('>').trim();
                if (gearInfo.endsWith('=')) gearInfo = gearInfo.slice(0, -1).trim();
            }

            displayRole = stripEmojis(displayRole);
            emoji = resolveRoleEmoji(displayRole, guildOrClient);

            let line = `${emoji} **${displayRole}**: ${mention}`;
            if (gearInfo) {
                line += `\n${gearInfo}`;
            }

            if (currentLength + line.length + 2 > 1000) {
                fields.push({
                    name: currentFieldName,
                    value: currentChunk.join('\n'),
                    inline: false
                });
                currentChunk = [line];
                currentLength = line.length;
            } else {
                currentChunk.push(line);
                currentLength += line.length + 1;
            }
        }
    });

    if (currentChunk.length > 0 || fields.length === 0) {
        fields.push({
            name: currentFieldName,
            value: currentChunk.length > 0 ? currentChunk.join('\n') : '\u200b',
            inline: false
        });
    }

    return fields;
}

/**
 * Builds the field for multi-role waitlist
 */
function buildWaitlistField(multiRoleWaitlist, rolesWithMembers, lang = 'tr') {
    if (!multiRoleWaitlist || multiRoleWaitlist.length === 0) return null;
    
    const lines = multiRoleWaitlist.map(u => {
        const roleNames = u.roleIndices.map(idx => rolesWithMembers[idx]?.role || 'Unknown').map(r => r.includes('>') ? r.split('>')[0].trim() : r);
        return `<@${u.userId}> : ${roleNames.join(', ')}`;
    });
    
    return {
        name: `⏳ **${lang === 'tr' ? 'Çoklu Rol Bekleyenler' : 'Multi-role Waitlist'}**`,
        value: lines.join('\n'),
        inline: false
    };
}

module.exports = {
    createEmbed,
    createPartikurEmbed,
    addFooterFields,
    buildRolesValue,
    buildRolesFields,
    buildWaitlistField,
    createHelpEmbed,
    createDonateEmbed,
    parseEmbedData
};
