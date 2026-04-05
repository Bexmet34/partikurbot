const { MessageFlags, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getActivePartyCount } = require('../services/partyManager');
const { isWhitelisted } = require('../services/whitelistManager');
const { isVoteBypassed } = require('../services/voteBypassManager');
const { getGuildConfig } = require('../services/guildConfig');
const { t } = require('../services/i18n');
const config = require('../config/config');
const { Api } = require('@top-gg/sdk');

// Initialize Top.gg API if token exists
const topggApi = config.TOPGG_TOKEN ? new Api(config.TOPGG_TOKEN) : null;

const { isSubscriptionActive } = require('../services/subscriptionService');
const { EmbedBuilder } = require('discord.js');

/**
 * Handles /createparty command
 */
async function handleCreatePartyCommand(interaction) {
    // 0. Subscription Check
    const active = await isSubscriptionActive(interaction.guildId, interaction.guild.name, interaction.guild.ownerId);
    
    if (!active) {
        const expiredEmbed = new EmbedBuilder()
            .setTitle('❌ Abonelik Süresi Doldu')
            .setDescription(`Bu sunucunun bot kullanım süresi (veya 3 günlük deneme süresi) sona ermiştir.\n\nSüreyi uzatmak ve botu kullanmaya devam etmek için lütfen bot sahibi ile iletişime geçin.`)
            .setColor('#FF0000')
            .setFooter({ text: 'Veyronix Party Master • Subscription System' });

        return await interaction.reply({
            embeds: [expiredEmbed],
            flags: [MessageFlags.Ephemeral]
        });
    }

    const guildConfig = await getGuildConfig(interaction.guildId);

    const lang = guildConfig?.language || 'tr';
    const userId = interaction.user.id;
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isDeveloper = config.WHITELIST_USERS.includes(userId);
    const whitelisted = isOwner || isDeveloper || await isWhitelisted(userId, interaction.guildId);
    const voteBypassed = await isVoteBypassed(userId, interaction.guildId);

    // 1. Top.gg Vote Check (Informational Reminder - Non-blocking)
    if (topggApi && !voteBypassed) {
        try {
            console.log(`[Top.gg] Checking vote status for informational purposes: ${userId}`);
            const hasVoted = await topggApi.hasVoted(userId).catch(() => false);
            
            if (!hasVoted) {
                // If the user hasn't voted, we can send a reminder as a follow-up or just mention it
                // But for now, we'll just proceed as per request "don't block"
                console.log(`[Top.gg] User ${userId} hasn't voted. Proceeding anyway.`);
            }
        } catch (error) {
            console.error(`[Top.gg] API Error (Non-blocking):`, error.message);
        }
    }

    const partyCount = getActivePartyCount(userId);
    const limit = whitelisted ? 3 : 1;

    if (partyCount >= limit) {
        let errorMsg = whitelisted
            ? `❌ **${t('party.limit_reached', lang)}**\n\n${t('party.limit_desc_whitelisted', lang)}`
            : `❌ **${t('party.already_active', lang)}**\n\n${t('party.limit_desc_normal', lang)}`;

        return await interaction.reply({
            content: errorMsg,
            flags: [MessageFlags.Ephemeral]
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('parti_modal:genel')
        .setTitle(t('party.create_party_title', lang));

    const headerInput = new TextInputBuilder()
        .setCustomId('party_header')
        .setLabel(t('party.party_header_label', lang))
        .setPlaceholder(t('party.party_header_placeholder', lang))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);


    const rolesInput = new TextInputBuilder()
        .setCustomId('party_roles')
        .setLabel(t('party.party_roles_label', lang))
        .setPlaceholder(t('party.party_roles_placeholder', lang))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('party_description')
        .setLabel(t('party.party_desc_label', lang))
        .setPlaceholder(t('party.party_desc_placeholder', lang))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);


    modal.addComponents(
        new ActionRowBuilder().addComponents(headerInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(rolesInput)
    );

    await interaction.showModal(modal);
}


// Deprecated func kept for safety, but unused
async function handleDurationButton(interaction) {
    return false;
}

module.exports = {
    handleDurationButton,
    handleCreatePartyCommand
};

