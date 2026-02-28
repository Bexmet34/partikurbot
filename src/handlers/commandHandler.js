const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { DEFAULT_CONTENT } = require('../constants/constants');
const config = require('../config/config');
const { createHelpEmbed } = require('../builders/embedBuilder');
const { safeReply } = require('../utils/interactionUtils');
const { hasActiveParty, setActiveParty, getActiveParties, removeActiveParty, getActivePartyCount } = require('../services/partyManager');
const { addToWhitelist, removeFromWhitelist, isWhitelisted } = require('../services/whitelistManager');
const { createClosedButton } = require('../builders/componentBuilder');
const { getEuropeGuildMembers, searchPlayer, getPlayerStats } = require('../services/albionApiService');
const db = require('../services/db');
const { getGuildConfig, updateGuildConfig } = require('../services/guildConfig');
const { t } = require('../services/i18n');


/**
 * Handles /help command
 */
async function handleHelpCommand(interaction) {

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    const embed = createHelpEmbed(0, guildName, lang);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('help_page_0').setLabel('🏠').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('help_page_1').setLabel(`📊 ${t('help.page_1', lang)}`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_page_2').setLabel(`🛡️ ${t('help.page_2', lang)}`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_page_3').setLabel(`🌐 ${t('help.page_3', lang)}`).setStyle(ButtonStyle.Secondary)
    );

    // Store image URLs in customId metadata for buttons if needed, but for now we rely on embedBuilder defaults or passed objects

    const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(`🌐 ${t('help.title_links', lang).split('&')[0].trim()}`).setStyle(ButtonStyle.Link).setURL('https://veyronixbot.vercel.app/'),
        new ButtonBuilder().setLabel(`💬 ${t('help.support_server', lang)}`).setStyle(ButtonStyle.Link).setURL('https://discord.gg/RZJE77KEVB'),
        new ButtonBuilder().setCustomId('donate_info').setLabel(t('help.donate_button', lang)).setStyle(ButtonStyle.Danger)
    );


    return await safeReply(interaction, { embeds: [embed], components: [row, linkRow] });
}







/**
 * Handles /closeparty command
 */
async function handleClosePartyCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const userId = interaction.user.id;

    console.log(`[CommandHandler] /closeparty triggered by ${interaction.user.tag} (${userId})`);

    try {
        const parties = getActiveParties(userId);

        if (!parties || parties.length === 0) {
            console.log(`[CommandHandler] No active parties found for ${interaction.user.tag}`);
            return await safeReply(interaction, {
                content: `❌ **${t('common.no_party', lang)}**`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        console.log(`[CommandHandler] Closing ${parties.length} parties for ${interaction.user.tag}`);
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => { });

        let totalClosed = 0;

        // Use a copy of the array if needed, though getActiveParties returns a new array from JSON.parse
        for (const partyInfo of parties) {
            const messageId = typeof partyInfo === 'object' ? partyInfo.messageId : partyInfo;
            const channelId = typeof partyInfo === 'object' ? partyInfo.channelId : null;

            if (channelId && messageId) {
                try {
                    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                    if (!channel) {
                        console.log(`[CommandHandler] Channel ${channelId} not found or inaccessible for party ${messageId}`);
                    } else {
                        const message = await channel.messages.fetch(messageId).catch(() => null);

                        if (message && message.embeds && message.embeds[0]) {
                            const oldEmbed = message.embeds[0];
                            // FIX: Added optional chaining and default empty array for fields
                            const fields = oldEmbed.fields || [];
                            const newFields = fields.filter(f => f.name && !f.name.includes('📌') && !f.name.includes('KURALLAR'));

                            const closedEmbed = EmbedBuilder.from(oldEmbed)
                                .setTitle(`${oldEmbed.title || 'Party'} [${t('common.closed', lang)}]`)
                                .setColor('#808080')
                                .setFields(newFields)
                                .setFooter(null)
                                .setTimestamp(null);

                            const closedRow = createClosedButton(lang);
                            await message.edit({ embeds: [closedEmbed], components: [closedRow] }).catch(e => {
                                console.log(`[CommandHandler] Message edit failed for ${messageId}: ${e.message}`);
                            });
                            totalClosed++;
                        }
                    }
                } catch (err) {
                    console.log(`[CommandHandler] Visual close failed for ${messageId}: ${err.message}`);
                }
            }

            // Clear each one from JSON DB
            try {
                removeActiveParty(userId, messageId);
            } catch (dbErr) {
                console.error(`[CommandHandler] Failed to remove party ${messageId} from JSON DB:`, dbErr);
            }

            // Also attempt to clear from SQLite DB
            try {
                await db.run('UPDATE parties SET status = ? WHERE message_id = ?', ['closed', messageId]).catch(() => { });
            } catch (dbErr) { }
        }

        const responseContent = totalClosed > 0
            ? `✅ **${t('party.closed_success', lang, { count: totalClosed })}**`
            : `✅ **${t('party.cleared_success', lang)}**`;

        await interaction.editReply({ content: responseContent }).catch(() => { });

    } catch (error) {
        console.error('[CommandHandler] Critical Error in handleClosePartyCommand:', error);

        // Emergency cleanup: wipe all parties for this user if something went wrong
        try {
            const parties = getActiveParties(userId);
            if (Array.isArray(parties)) {
                parties.forEach(p => {
                    const mid = typeof p === 'object' ? p.messageId : p;
                    removeActiveParty(userId, mid);
                });
            } else {
                removeActiveParty(userId); // Total wipe for user
            }

            // Wipe from SQLite too
            await db.run('UPDATE parties SET status = ? WHERE owner_id = ? AND status = ?', ['closed', userId, 'active']).catch(() => { });
        } catch (backupErr) {
            console.error('[CommandHandler] Emergency cleanup failed:', backupErr);
        }

        await interaction.followUp({
            content: `❌ **${t('common.error', lang)}**\n${error.message}`,
            flags: [MessageFlags.Ephemeral]
        }).catch(() => { });
    }
}

/**
 * Handles /whitelistadd command
 */
async function handleWhitelistAddCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    const isOwner = interaction.user.id === config.OWNER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
        return await safeReply(interaction, { content: `❌ ${t('common.owner_only', lang)}`, flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = interaction.options.getUser('user');

    if (await addToWhitelist(targetUser.id, interaction.guildId)) {
        return await safeReply(interaction, {
            content: `✅ **${targetUser.tag}** ${t('whitelist.added', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    } else {
        return await safeReply(interaction, {
            content: `❌ **${targetUser.tag}** ${t('whitelist.already_in', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }
}


/**
 * Handles /whitelistremove command
 */
async function handleWhitelistRemoveCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    const isOwner = interaction.user.id === config.OWNER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
        return await safeReply(interaction, { content: `❌ ${t('common.owner_only', lang)}`, flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = interaction.options.getUser('user');

    if (await removeFromWhitelist(targetUser.id, interaction.guildId)) {
        return await safeReply(interaction, {
            content: `✅ **${targetUser.tag}** ${t('whitelist.removed', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    } else {
        return await safeReply(interaction, {
            content: `❌ **${targetUser.tag}** ${t('whitelist.not_found', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }
}


/**
 * Pagination helper for member list
 */
function createMemberPageEmbed(members, page = 0, guildName = 'Albion', lang = 'tr') {
    const pageSize = 20;
    const start = page * pageSize;
    const end = start + pageSize;
    const currentMembers = members.slice(start, end);
    const totalPages = Math.ceil(members.length / pageSize);

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} ${t('members.guild_members', lang)}`)
        .setColor('#2ECC71')

        .setDescription(`**${t('common.total_members', lang)}:** ${members.length}\n**${t('common.page', lang)}:** ${page + 1} / ${totalPages}\n\n${currentMembers.map(m => `• ${m.Name}`).join('\n')}`);

    return embed;
}

/**
 * Handles /members command
 */
async function handleMembersCommand(interaction) {

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildId = guildConfig?.albion_guild_id;

    if (!guildId) {
        return await safeReply(interaction, { content: `❌ ${t('common.config_required', lang)}`, flags: [MessageFlags.Ephemeral] });
    }

    await interaction.deferReply();

    try {
        const members = await getEuropeGuildMembers(guildId);
        // Sort alphabetically
        members.sort((a, b) => a.Name.localeCompare(b.Name));

        const embed = createMemberPageEmbed(members, 0, guildConfig.guild_name, lang);


        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('members_prev_0')
                .setLabel(`⬅️ ${t('common.back', lang)}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`members_next_0`)
                .setLabel(`${t('common.next', lang)} ➡️`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(members.length <= 20)
        );

        return await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('[Uyeler] Hata:', error);
        return await interaction.editReply({ content: `❌ ${t('common.error', lang)}: ${error.message}` });
    }
}


/**
 * Handles /stats command
 */
async function handleStatsCommand(interaction) {

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const ign = interaction.options.getString('name');


    await interaction.deferReply();

    try {
        // 1. Oyuncuyu ara ve ID'sini bul
        const playerData = await searchPlayer(ign);
        if (!playerData) {
            return await interaction.editReply({ content: `❌ **${ign}** ${t('stats.not_found', lang)}` });
        }

        // 2. ID ile detaylı istatistikleri çek
        const stats = await getPlayerStats(playerData.Id);

        const pve = stats.LifetimeStatistics?.PvE || {};
        const pvp = stats.LifetimeStatistics?.PvP || {};
        const gathering = stats.LifetimeStatistics?.Gathering || {};

        const killFame = pvp.KillFame || 0;
        const deathFame = pvp.DeathFame || 0;
        const kd = deathFame > 0 ? (killFame / deathFame).toFixed(2) : killFame.toFixed(2);

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${t('stats.profile', lang)}: ${stats.Name}`)
            .setColor('#3498DB')
            .setThumbnail(`https://render.albiononline.com/v1/spell/PLAYER_PORTRAIT_FARMER.png`) // Geçici ikon
            .addFields(
                { name: `🏰 ${t('stats.guild', lang)}`, value: stats.GuildName || t('common.not_set', lang), inline: true },
                { name: `🆔 ${t('stats.player_id', lang)}`, value: `\`${stats.Id}\``, inline: true },
                { name: `⭐ ${t('stats.total_fame', lang)}`, value: (stats.KillFame || 0).toLocaleString(), inline: true },

                { name: '\u200b', value: `⚔️ **${t('stats.pvp_title', lang)}**`, inline: false },
                { name: `💀 ${t('stats.kill_fame', lang)}`, value: killFame.toLocaleString(), inline: true },
                { name: `⚰️ ${t('stats.death_fame', lang)}`, value: deathFame.toLocaleString(), inline: true },
                { name: `📊 ${t('stats.kd', lang)}`, value: kd.toString(), inline: true },

                { name: '\u200b', value: `🏹 **${t('stats.pve_title', lang)}**`, inline: false },
                { name: 'Total PVE', value: (pve.Total || 0).toLocaleString(), inline: true },
                { name: 'Royals', value: (pve.Royal || 0).toLocaleString(), inline: true },
                { name: 'Outlands', value: (pve.Outlands || 0).toLocaleString(), inline: true },
                { name: 'Avalon', value: (pve.Avalon || 0).toLocaleString(), inline: true },
                { name: 'Corrupted', value: (pve.CorruptedDungeon || 0).toLocaleString(), inline: true },
                { name: 'Mists', value: (pve.Mists || 0).toLocaleString(), inline: true },

                { name: '\u200b', value: `⛏️ **${t('stats.gathering_title', lang)}**`, inline: false },
                { name: 'Gathering Total', value: (gathering.All?.Total || 0).toLocaleString(), inline: true },
                { name: 'Fiber', value: (gathering.Fiber?.Total || 0).toLocaleString(), inline: true },
                { name: 'Hide', value: (gathering.Hide?.Total || 0).toLocaleString(), inline: true },
                { name: 'Ore', value: (gathering.Ore?.Total || 0).toLocaleString(), inline: true },
                { name: 'Stone', value: (gathering.Rock?.Total || 0).toLocaleString(), inline: true },
                { name: 'Wood', value: (gathering.Wood?.Total || 0).toLocaleString(), inline: true },

                { name: 'Crafting', value: (stats.LifetimeStatistics?.Crafting?.Total || 0).toLocaleString(), inline: true },
                { name: 'Fishing', value: (stats.LifetimeStatistics?.FishingFame || 0).toLocaleString(), inline: true },
                { name: 'Farming', value: (stats.LifetimeStatistics?.FarmingFame || 0).toLocaleString(), inline: true }
            )
            .setFooter({ text: t('stats.api_footer', lang) })
            .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('[MeCommand] Hata:', error);
        return await interaction.editReply({ content: `❌ ${t('stats.api_error', lang)}: ${error.message}` });
    }
}

/**
 * Handles /settings command
 */
async function handleSettingsCommand(interaction) {

    const guildConfig = await getGuildConfig(interaction.guildId);
    const oldLang = guildConfig?.language || 'tr';

    const guildName = interaction.options.getString('guild-name');
    const albionGuildId = interaction.options.getString('guild-id');
    const language = interaction.options.getString('language');

    const success = await updateGuildConfig(interaction.guildId, {
        guild_name: guildName,
        albion_guild_id: albionGuildId,
        language: language
    });

    const lang = success ? language : oldLang;

    if (success) {
        return await safeReply(interaction, {
            content: `✅ **${t('settings.success', lang)}**\n\n🏰 **${t('settings.guild_name', lang)}:** ${guildName}\n🆔 **${t('settings.albion_id', lang)}:** \`${albionGuildId}\`\n🌐 **${t('settings.lang_set', lang)}:** ${language === 'tr' ? 'Türkçe' : 'English'}`,
            flags: [MessageFlags.Ephemeral]
        });
    } else {
        return await safeReply(interaction, {
            content: `❌ ${t('settings.error_saving', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }
}

module.exports = {
    handleHelpCommand,
    handleClosePartyCommand,
    handleMembersCommand,
    handleStatsCommand,
    handleWhitelistAddCommand,
    handleWhitelistRemoveCommand,
    handleSettingsCommand,
    createMemberPageEmbed
};

