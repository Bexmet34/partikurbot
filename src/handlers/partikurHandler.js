const { MessageFlags, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getActivePartyCount } = require('../services/partyManager');
const { isWhitelisted } = require('../services/whitelistManager');
const { getGuildConfig } = require('../services/guildConfig');
const { t } = require('../services/i18n');
const config = require('../config/config');

const { isSubscriptionActive } = require('../services/subscriptionService');

/**
 * Handles /createparty command
 */
async function handleCreatePartyCommand(interaction) {
    // 0. Subscription Check
    const active = await isSubscriptionActive(interaction.guildId, interaction.guild.name, interaction.guild.ownerId);
    
    if (!active) {
        const guildConfig = await getGuildConfig(interaction.guildId);
        const lang = guildConfig?.language || 'tr';

        const expiredEmbed = new EmbedBuilder()
            .setTitle(t('subscription.expired_title', lang))
            .setDescription(t('subscription.expired_desc', lang))
            .setColor('#FF0000')
            .setFooter({ text: 'Veyronix Party Master • Subscription System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(t('subscription.support_button', lang))
                .setURL(config.SUPPORT_SERVER_LINK)
                .setStyle(ButtonStyle.Link)
        );

        return await interaction.reply({
            embeds: [expiredEmbed],
            components: [row],
            flags: [MessageFlags.Ephemeral]
        });
    }

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const userId = interaction.user.id;

    const isOwner = userId === interaction.guild.ownerId;
    const isDeveloper = config.WHITELIST_USERS.includes(userId);
    const whitelisted = isOwner || isDeveloper || await isWhitelisted(userId, interaction.guildId);

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

module.exports = {
    handleCreatePartyCommand
};
