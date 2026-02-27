const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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


/**
 * Handles /yardim command
 */
async function handleYardimCommand(interaction, attachments = []) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const guildName = guildConfig?.guild_name || 'Albion';

    const embed = createHelpEmbed(0, guildName);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('help_page_0').setLabel('🏠').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('help_page_1').setLabel('📊 Komutlar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_page_2').setLabel('🛡️ Yönetim').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_page_3').setLabel('🌐 Bağlantılar').setStyle(ButtonStyle.Secondary)
    );

    const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🌐 Web Sitesi').setStyle(ButtonStyle.Link).setURL('https://example.com'),
        new ButtonBuilder().setLabel('💬 Destek Sunucusu').setStyle(ButtonStyle.Link).setURL('https://discord.gg/example')
    );

    return await safeReply(interaction, { embeds: [embed], components: [row, linkRow], files: attachments });
}






/**
 * Handles /partikapat command
 */
async function handlePartikapatCommand(interaction) {
    const userId = interaction.user.id;
    console.log(`[CommandHandler] /partikapat triggered by ${interaction.user.tag}`);

    try {
        const parties = getActiveParties(userId);

        if (!parties || parties.length === 0) {
            return await safeReply(interaction, {
                content: '❌ **Aktif bir partiniz bulunmuyor.**',
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => { });

        let totalClosed = 0;
        for (const partyInfo of parties) {
            const messageId = partyInfo.messageId;
            const channelId = partyInfo.channelId;

            if (channelId && messageId) {
                try {
                    const channel = await interaction.client.channels.fetch(channelId);
                    const message = await channel?.messages.fetch(messageId);

                    if (message && message.embeds[0]) {
                        const oldEmbed = message.embeds[0];
                        const newFields = oldEmbed.fields.filter(f => !f.name.includes('📌') && !f.name.includes('KURALLAR'));
                        const closedEmbed = EmbedBuilder.from(oldEmbed)
                            .setTitle(`${oldEmbed.title} [KAPALI]`)
                            .setColor('#808080')
                            .setFields(newFields)
                            .setFooter(null)
                            .setTimestamp(null);

                        const closedRow = createClosedButton();
                        await message.edit({ embeds: [closedEmbed], components: [closedRow] });
                        totalClosed++;
                    }
                } catch (err) {
                    console.log(`[CommandHandler] Visual close failed for ${messageId}: ${err.message}`);
                }
            }
            // Clear each one from DB
            removeActiveParty(userId, messageId);
        }

        const responseContent = totalClosed > 0
            ? `✅ **Toplam ${totalClosed} aktif partiniz başarıyla kapatıldı.**`
            : '✅ **Aktif partileriniz sistemden temizlendi.**';

        await interaction.editReply({ content: responseContent }).catch(() => { });


    } catch (error) {
        console.error('[CommandHandler] Critical Error:', error);
        // Fallback: try to clear all for this user
        const parties = getActiveParties(userId);
        parties.forEach(p => removeActiveParty(userId, p.messageId));

        await interaction.followUp({ content: '❌ Bir hata oluştu ama kilitleriniz temizlendi.', flags: [MessageFlags.Ephemeral] }).catch(() => { });
    }
}

/**
 * Handles /wladd command
 */
async function handleWladdCommand(interaction) {
    if (interaction.user.id !== config.OWNER_ID) {
        return await safeReply(interaction, { content: '❌ Bu komutu sadece bot sahibi kullanabilir.', flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = interaction.options.getUser('kullanici');

    if (await addToWhitelist(targetUser.id, interaction.guildId)) {
        return await safeReply(interaction, {
            content: `✅ **${targetUser.tag}** başarıyla beyaz listeye eklendi. Artık aynı anda **3** parti kurabilir.`,
            flags: [MessageFlags.Ephemeral]
        });
    } else {
        return await safeReply(interaction, {
            content: `❌ **${targetUser.tag}** zaten beyaz listede bulunuyor.`,
            flags: [MessageFlags.Ephemeral]
        });
    }
}


/**
 * Handles /wlremove command
 */
async function handleWlremoveCommand(interaction) {
    if (interaction.user.id !== config.OWNER_ID) {
        return await safeReply(interaction, { content: '❌ Bu komutu sadece bot sahibi kullanabilir.', flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = interaction.options.getUser('kullanici');

    if (await removeFromWhitelist(targetUser.id, interaction.guildId)) {
        return await safeReply(interaction, {
            content: `✅ **${targetUser.tag}** başarıyla beyaz listeden çıkarıldı. Artık sadece **1** parti kurabilir.`,
            flags: [MessageFlags.Ephemeral]
        });
    } else {
        return await safeReply(interaction, {
            content: `❌ **${targetUser.tag}** beyaz listede bulunamadı.`,
            flags: [MessageFlags.Ephemeral]
        });
    }
}


/**
 * Pagination helper for member list
 */
function createMemberPageEmbed(members, page = 0) {
    const pageSize = 20;
    const start = page * pageSize;
    const end = start + pageSize;
    const currentMembers = members.slice(start, end);
    const totalPages = Math.ceil(members.length / pageSize);

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${config.GUILD_NAME} Lonca Üyeleri`)
        .setColor('#2ECC71')

        .setDescription(`**Toplam Üye:** ${members.length}\n**Sayfa:** ${page + 1} / ${totalPages}\n\n${currentMembers.map(m => `• ${m.Name}`).join('\n')}`);

    return embed;
}

/**
 * Handles /uyeler command
 */
async function handleUyelerCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const guildId = guildConfig?.albion_guild_id;

    if (!guildId) {
        return await safeReply(interaction, { content: '❌ Bu sunucu için Albion Lonca IDsi ayarlanmamış. Lütfen `/ayar` komutunu kullanın.', flags: [MessageFlags.Ephemeral] });
    }

    await interaction.deferReply();

    try {
        const { getEuropeGuildMembers } = require('../services/albionApiService');
        const members = await getEuropeGuildMembers(guildId);
        // Sort alphabetically
        members.sort((a, b) => a.Name.localeCompare(b.Name));

        const embed = createMemberPageEmbed(members, 0, guildConfig.guild_name);


        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('members_prev_0')
                .setLabel('⬅️ Geri')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`members_next_0`)
                .setLabel('İleri ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(members.length <= 20)
        );

        return await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('[Uyeler] Hata:', error);
        return await interaction.editReply({ content: `❌ Üye listesi alınırken bir hata oluştu: ${error.message}` });
    }
}


/**
 * Handles /me command
 */
async function handleMeCommand(interaction) {
    const ign = interaction.options.getString('isim');


    await interaction.deferReply();

    try {
        // 1. Oyuncuyu ara ve ID'sini bul
        const playerData = await searchPlayer(ign);
        if (!playerData) {
            return await interaction.editReply({ content: `❌ **${ign}** isminde bir oyuncu Avrupa sunucusunda bulunamadı.` });
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
            .setTitle(`👤 Oyuncu Profili: ${stats.Name}`)
            .setColor('#3498DB')
            .setThumbnail(`https://render.albiononline.com/v1/spell/PLAYER_PORTRAIT_FARMER.png`) // Geçici ikon
            .addFields(
                { name: '🏰 Lonca', value: stats.GuildName || 'Yok', inline: true },
                { name: '🆔 Player-ID', value: `\`${stats.Id}\``, inline: true },
                { name: '⭐ Total Fame', value: (stats.KillFame || 0).toLocaleString(), inline: true },

                { name: '\u200b', value: '⚔️ **PVP İSTATİSTİKLERİ**', inline: false },
                { name: '💀 Kill Fame', value: killFame.toLocaleString(), inline: true },
                { name: '⚰️ Death Fame', value: deathFame.toLocaleString(), inline: true },
                { name: '📊 K/D', value: kd.toString(), inline: true },

                { name: '\u200b', value: '🏹 **PVE İSTATİSTİKLERİ**', inline: false },
                { name: 'Total PVE', value: (pve.Total || 0).toLocaleString(), inline: true },
                { name: 'Royals', value: (pve.Royal || 0).toLocaleString(), inline: true },
                { name: 'Outlands', value: (pve.Outlands || 0).toLocaleString(), inline: true },
                { name: 'Avalon', value: (pve.Avalon || 0).toLocaleString(), inline: true },
                { name: 'Corrupted', value: (pve.CorruptedDungeon || 0).toLocaleString(), inline: true },
                { name: 'Mists', value: (pve.Mists || 0).toLocaleString(), inline: true },

                { name: '\u200b', value: '⛏️ **TOPLAYICILIK & DİĞER**', inline: false },
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
            .setFooter({ text: 'Veriler Albion Online Avrupa API üzerinden anlık alınmıştır.' })
            .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('[MeCommand] Hata:', error);
        return await interaction.editReply({ content: `❌ İstatistikler çekilirken bir hata oluştu: ${error.message}` });
    }
}

/**
 * Handles /ayar command
 */
async function handleAyarCommand(interaction) {
    const guildName = interaction.options.getString('lonca-ismi');
    const albionGuildId = interaction.options.getString('lonca-id');

    const success = await updateGuildConfig(interaction.guildId, {
        guild_name: guildName,
        albion_guild_id: albionGuildId
    });

    if (success) {
        return await safeReply(interaction, {
            content: `✅ **Sunucu ayarları başarıyla güncellendi!**\n\n🏰 **Lonca İsmi:** ${guildName}\n🆔 **Albion ID:** \`${albionGuildId}\``,
            flags: [MessageFlags.Ephemeral]
        });
    } else {
        return await safeReply(interaction, {
            content: '❌ Ayarlar kaydedilirken bir hata oluştu.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

module.exports = {
    handleYardimCommand,
    handlePartikapatCommand,
    handleUyelerCommand,
    handleMeCommand,
    handleWladdCommand,
    handleWlremoveCommand,
    handleAyarCommand,
    createMemberPageEmbed
};

