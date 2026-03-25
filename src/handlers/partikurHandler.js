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

/**
 * Handles /createparty command
 */
async function handleCreatePartyCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);

    const lang = guildConfig?.language || 'tr';
    const userId = interaction.user.id;
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isDeveloper = config.WHITELIST_USERS.includes(userId);
    const whitelisted = isOwner || isDeveloper || await isWhitelisted(userId, interaction.guildId);
    const voteBypassed = await isVoteBypassed(userId);

    // 1. Top.gg Vote Check (Bypass ONLY for Vote Bypass Users/Bot Owner)
    if (topggApi && !voteBypassed) {
        let hasVoted = false;
        try {
            console.log(`[Top.gg] Checking vote for user: ${userId}`);
            hasVoted = await topggApi.hasVoted(userId);
            console.log(`[Top.gg] User ${userId} hasVoted result: ${hasVoted}`);
        } catch (error) {
            // 404 = kullanıcı hiç oy atmamış, bu beklenen bir durum
            if (error.message?.includes('404') || error.status === 404) {
                console.warn(`[Top.gg] User ${userId} has not voted (404 Not Found - expected).`);
            } else {
                console.error(`[Top.gg] API Error for ${userId}:`, error.message);
            }
            hasVoted = false;
        }

        if (!hasVoted) {
            const voteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(t('party.vote_link_text', lang))
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://top.gg/bot/1082239904169336902/vote')
            );

            return await interaction.reply({
                content: t('party.vote_required', lang),
                components: [voteRow],
                flags: [MessageFlags.Ephemeral]
            });
        }
    } else if (!topggApi && !isDeveloper) {
        console.warn('[Top.gg] API not initialized! Check TOPGG_TOKEN in .env');
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

