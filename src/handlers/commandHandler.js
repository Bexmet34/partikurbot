const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { DEFAULT_CONTENT, LOGO_NAME, LINKS } = require('../constants/constants');
const { sendSubscriptionNotification } = require('../utils/notificationUtils');
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
const { performServerCleanup } = require('../services/cronService');

/**
 * Handles /help command
 */
async function handleHelpCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    const embed = createHelpEmbed(0, interaction.guild, lang);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('help_page_0').setLabel('🏠').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('help_page_1').setLabel(`⚔️ ${t('help.page_2', lang)}`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_vote').setLabel(`🗳️ /vote`).setStyle(ButtonStyle.Success)
    );

    const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(`🌐 Website`).setStyle(ButtonStyle.Link).setURL(LINKS.WEBSITE),
        new ButtonBuilder().setLabel(t('help.donate_button', lang)).setStyle(ButtonStyle.Link).setURL(LINKS.SHOPIER)
    );

    return await safeReply(interaction, {
        embeds: [embed],
        components: [row, linkRow],
        flags: [MessageFlags.Ephemeral]
    });
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

        for (const partyInfo of parties) {
            const messageId = typeof partyInfo === 'object' ? partyInfo.messageId : partyInfo;
            const channelId = typeof partyInfo === 'object' ? partyInfo.channelId : null;

            if (channelId && messageId) {
                try {
                    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(messageId).catch(() => null);

                        if (message && message.embeds && message.embeds[0]) {
                            const oldEmbed = message.embeds[0];
                            const fields = oldEmbed.fields || [];
                            const newFields = fields.filter(f => f.name && !f.name.includes('📌') && !f.name.includes('KURALLAR'));

                            const closedEmbed = EmbedBuilder.from(oldEmbed)
                                .setTitle(`${oldEmbed.title || 'Party'} [${t('common.closed', lang)}]`)
                                .setColor('#808080')
                                .setFields(newFields)
                                .setThumbnail(`attachment://${LOGO_NAME}`)
                                .setFooter(null)
                                .setTimestamp(null);

                            const closedRow = createClosedButton(lang);
                            const { AttachmentBuilder } = require('discord.js');
                            const { LOGO_PATH } = require('../constants/constants');
                            await message.edit({ 
                                embeds: [closedEmbed], 
                                components: [closedRow],
                                files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
                            }).catch(() => { });
                            totalClosed++;
                        }
                    }
                } catch (err) { }
            }
            removeActiveParty(userId, messageId);
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
        removeActiveParty(userId);
        await db.run('UPDATE parties SET status = ? WHERE owner_id = ? AND status = ?', ['closed', userId, 'active']).catch(() => { });
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

    const userId = interaction.user.id;
    const isBotOwner = userId === config.OWNER_ID;
    const isGuildOwner = interaction.guild && userId === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isBotOwner && !isGuildOwner && !isAdmin) {
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

    const userId = interaction.user.id;
    const isBotOwner = userId === config.OWNER_ID;
    const isGuildOwner = interaction.guild && userId === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isBotOwner && !isGuildOwner && !isAdmin) {
        return await safeReply(interaction, { content: `❌ ${t('common.owner_only', lang)}`, flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = interaction.options.getUser('user');

    if (await removeFromWhitelist(targetUser.id, interaction.guildId)) {
        return await safeReply(interaction, {
            content: `✅ **${targetUser.tag}** ${t('whitelist.removed', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }
}

/**
 * Pagination helper for member list
 */
function createMemberPageEmbed(members, page = 0, guild = null, lang = 'tr') {
    const guildName = guild?.name || 'Albion';
    const pageSize = 20;
    const start = page * pageSize;
    const end = start + pageSize;
    const currentMembers = members.slice(start, end);
    const totalPages = Math.ceil(members.length / pageSize);

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} ${t('members.guild_members', lang)}`)
        .setColor('#2ECC71');

    embed.setDescription(`**${t('common.total_members', lang)}:** ${members.length}\n**${t('common.page', lang)}:** ${page + 1} / ${totalPages}\n\n${currentMembers.map(m => `• ${m.Name}`).join('\n')}`);

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
        members.sort((a, b) => a.Name.localeCompare(b.Name));

        const embed = createMemberPageEmbed(members, 0, interaction.guild, lang);

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
        const playerData = await searchPlayer(ign);
        if (!playerData) {
            return await interaction.editReply({ content: `❌ **${ign}** ${t('stats.not_found', lang)}` });
        }

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
            .setThumbnail(`https://render.albiononline.com/v1/spell/PLAYER_PORTRAIT_FARMER.png`)
            .addFields(
                { name: `🏰 ${t('stats.guild', lang)}`, value: stats.GuildName || t('common.not_set', lang), inline: true },
                { name: `🆔 ${t('stats.player_id', lang)}`, value: `\`${stats.Id}\``, inline: true },
                { name: `⭐ ${t('stats.total_fame', lang)}`, value: (stats.KillFame || 0).toLocaleString(), inline: true },
                { name: '\u200b', value: `⚔️ **${t('stats.pvp_title', lang)}**`, inline: false },
                { name: `💀 ${t('stats.kill_fame', lang)}`, value: killFame.toLocaleString(), inline: true },
                { name: `⚰️ ${t('stats.death_fame', lang)}`, value: deathFame.toLocaleString(), inline: true },
                { name: `📊 ${t('stats.kd', lang)}`, value: kd.toString(), inline: true },
                { name: '\u200b', value: `🏹 **${t('stats.pve_title', lang)}**`, inline: false },
                { name: 'Total PVE', value: (pve.Total || 0).toLocaleString(), inline: true }
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
    const guildConfig = await getGuildConfig(interaction.guildId) || {};
    const lang = guildConfig.language || 'tr';

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Bot Ayarları')
        .setDescription('Lütfen botun dilini aşağıdan seçin:')
        .setColor(3447003)
        .addFields({ name: `Mevcut Dil`, value: lang === 'tr' ? '🇹🇷 Türkçe' : '🇺🇸 English', inline: true });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('settings_lang_select')
        .setPlaceholder('Bir dil seçin...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Türkçe 🇹🇷').setValue('tr').setEmoji('🇹🇷'),
            new StringSelectMenuOptionBuilder().setLabel('English 🇺🇸').setValue('en').setEmoji('🇺🇸')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return await safeReply(interaction, {
        embeds: [embed],
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
}

/**
 * Handles /servers command (Owner Only)
 */
async function handleServersCommand(interaction) {
    const isBotOwner = interaction.user.id === config.OWNER_ID;
    
    if (!isBotOwner) {
        return await safeReply(interaction, { content: '❌ Bu komutu sadece bot yetkilisi kullanabilir.', flags: [MessageFlags.Ephemeral] });
    }

    const guilds = interaction.client.guilds.cache;
    const guildList = guilds.map(g => `• **${g.name}** (${g.id}) - ${g.memberCount} üye`).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('🏢 Sunucu Listesi')
        .setDescription(`Toplam **${guilds.size}** sunucuda bulunuyorum.\n\n${guildList.length > 2000 ? guildList.substring(0, 1900) + '...' : guildList}`)
        .setColor('#2ECC71');

    return await safeReply(interaction, {
        embeds: [embed],
        flags: [MessageFlags.Ephemeral]
    });
}

const { addSubscriptionDays, removeSubscriptionDays, setUnlimitedSubscription, setSubscriptionActive, getSubscription } = require('../services/subscriptionService');

/**
 * Handles /subscription command (Owner Only)
 */
async function handleSubscriptionCommand(interaction) {
    const isBotOwner = interaction.user.id === config.OWNER_ID;
    
    if (!isBotOwner) {
        return await safeReply(interaction, { content: '❌ Bu komutu sadece bot sahibi kullanabilir.', flags: [MessageFlags.Ephemeral] });
    }

    const guildId = interaction.options.getString('guild_id');
    const sub = await getSubscription(guildId, 'Sistem Sorgusu', interaction.user.id);

    if (!sub) {
        return await safeReply(interaction, { content: `❌ **${guildId}** ID'li sunucu veritabanında bulunamadı.`, flags: [MessageFlags.Ephemeral] });
    }

    const embed = createSubscriptionEmbed(sub);
    const row = createSubscriptionMenu(guildId, sub);

    return await safeReply(interaction, {
        embeds: [embed],
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
}

function createSubscriptionEmbed(sub) {
    const expiresAt = new Date(sub.expires_at);
    const timestamp = Math.floor(expiresAt.getTime() / 1000);
    const now = new Date();
    const isExpired = !sub.is_unlimited && expiresAt < now;

    let statusText = sub.is_active ? (isExpired ? 'Süresi Dolmuş ⚠️' : 'Aktif ✅') : 'Devre Dışı ❌';
    if (sub.is_unlimited) statusText = 'Sınırsız ✅';

    return new EmbedBuilder()
        .setTitle(`🏢 Abonelik Yönetimi: ${sub.guild_name}`)
        .setColor(sub.is_active && !isExpired ? '#2ECC71' : '#E74C3C')
        .setFields(
            { name: 'Sunucu ID', value: `\`${sub.guild_id}\``, inline: true },
            { name: 'Durum', value: statusText, inline: true },
            { name: 'Sınırsız mı?', value: sub.is_unlimited ? 'Evet' : 'Hayır', inline: true },
            { name: 'Bitiş Tarihi', value: sub.is_unlimited ? '∞' : `<t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false }
        )
        .setFooter({ text: 'Aşağıdaki menüden işlem seçiniz.' })
        .setTimestamp();
}

function createSubscriptionMenu(guildId, sub) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`sub_manage:${guildId}`)
        .setPlaceholder('Hızlı İşlemler...')
        .addOptions(
            { label: 'Gün Ekle', value: 'add_custom', description: 'Sunucuya belirli bir gün kadar abonelik ekler.', emoji: '➕' },
            { label: 'Gün Çıkar', value: 'rem_custom', description: 'Sunucudan belirli bir gün kadar abonelik çıkarır.', emoji: '➖' },
            { label: sub.is_unlimited ? 'Sınırsız Modu Kapat' : 'Sınırsız Modu Aç', value: 'toggle_unlimited', description: sub.is_unlimited ? 'Sınırsız erişimi kaldırır.' : 'Sınırsız abonelik tanımlar.', emoji: '♾️' },
            { label: sub.is_active ? 'Devre Dışı Bırak' : 'Aktifleştir', value: 'toggle_active', description: sub.is_active ? 'Aboneliği dondurur/kapatır.' : 'Aboneliği tekrar aktif eder.', emoji: sub.is_active ? '🚫' : '✅' }
        );

    return new ActionRowBuilder().addComponents(select);
}

async function handleSubscriptionSelect(interaction) {
    const isBotOwner = interaction.user.id === config.OWNER_ID;
    if (!isBotOwner) return;

    const [_, guildId] = interaction.customId.split(':');
    const action = interaction.values[0];

    let success = false;

    if (action === 'add_custom' || action === 'rem_custom') {
        const modal = new ModalBuilder()
            .setCustomId(`sub_modal:${action}:${guildId}`)
            .setTitle(action === 'add_custom' ? 'Abonelik Günü Ekle' : 'Abonelik Günü Çıkar');

        const input = new TextInputBuilder()
            .setCustomId('days_input')
            .setLabel('Kaç gün?')
            .setPlaceholder('Örn: 30')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    } else if (action === 'toggle_unlimited') {
        const sub = await getSubscription(guildId, 'Sistem', interaction.user.id);
        success = await setUnlimitedSubscription(guildId, !sub?.is_unlimited);
    } else if (action === 'toggle_active') {
        const sub = await getSubscription(guildId, 'Sistem', interaction.user.id);
        success = await setSubscriptionActive(guildId, !sub?.is_active);
    }

    if (success) {
        const updatedSub = await getSubscription(guildId, 'Sistem', interaction.user.id);
        await interaction.update({
            embeds: [createSubscriptionEmbed(updatedSub)],
            components: [createSubscriptionMenu(guildId, updatedSub)],
            files: []
        });
    }
}

async function handleSubscriptionModal(interaction) {
    const isBotOwner = interaction.user.id === config.OWNER_ID;
    if (!isBotOwner) return;

    const [_, action, guildId] = interaction.customId.split(':');
    const daysStr = interaction.fields.getTextInputValue('days_input');
    const days = parseInt(daysStr);

    if (isNaN(days) || days <= 0) {
        return await interaction.reply({ content: '❌ Lütfen geçerli bir sayı giriniz.', flags: [MessageFlags.Ephemeral] });
    }

    let success = false;
    if (action === 'add_custom') {
        success = await addSubscriptionDays(guildId, days);
    } else if (action === 'rem_custom') {
        success = await removeSubscriptionDays(guildId, days);
    }

    if (success) {
        const updatedSub = await getSubscription(guildId, 'Sistem', interaction.user.id);
        await interaction.update({
            embeds: [createSubscriptionEmbed(updatedSub)],
            components: [createSubscriptionMenu(guildId, updatedSub)],
            files: []
        });
    }
}

/**
 * Handles /cleanup-manual command (Owner Only)
 */
async function handleCleanupManualCommand(interaction) {
    const BOT_OWNER_ID = '407234961582587916';
    
    if (interaction.user.id !== BOT_OWNER_ID) {
        return await safeReply(interaction, { 
            content: '❌ Bu komutu sadece bot sahibi kullanabilir.', 
            flags: [MessageFlags.Ephemeral] 
        });
    }

    await interaction.reply({ 
        content: '⏳ Sunucu temizleme işlemi başlatıldı. Veritabanı taranıyor...', 
        flags: [MessageFlags.Ephemeral] 
    });

    try {
        await performServerCleanup(interaction.client, `Manuel Komut (${interaction.user.tag})`);
        await interaction.editReply({ 
            content: '✅ Sunucu temizleme işlemi başarıyla tamamlandı. Rapor özel mesaj ile gönderildi.' 
        });
    } catch (err) {
        await interaction.editReply({ 
            content: `❌ Temizleme sırasında hata oluştu: ${err.message}` 
        });
    }
}

/**
 * Handles /vote command
 */
async function handleVoteCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    const embed = new EmbedBuilder()
        .setTitle(t('vote.title', lang))
        .setDescription(t('vote.description', lang))
        .setColor('#5865F2')
        .setThumbnail(`attachment://${LOGO_NAME}`)
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(t('vote.button_text', lang))
            .setStyle(ButtonStyle.Link)
            .setURL(LINKS.TOPGG)
    );

    const { AttachmentBuilder } = require('discord.js');
    const { LOGO_PATH } = require('../constants/constants');
    const logo = new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME });

    return await safeReply(interaction, {
        embeds: [embed],
        components: [row],
        files: [logo],
        flags: [MessageFlags.Ephemeral]
    });
}

module.exports = {
    handleHelpCommand,
    handleVoteCommand,
    handleClosePartyCommand,
    handleMembersCommand,
    handleStatsCommand,
    handleWhitelistAddCommand,
    handleWhitelistRemoveCommand,
    handleSettingsCommand,
    handleServersCommand,
    handleSubscriptionCommand,
    handleSubscriptionSelect,
    handleSubscriptionModal,
    handleCleanupManualCommand,
    createMemberPageEmbed
};
