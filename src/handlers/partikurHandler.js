const { MessageFlags, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getActivePartyCount, setActiveParty } = require('../services/partyManager');
const { isWhitelisted } = require('../services/whitelistManager');
const { getGuildConfig } = require('../services/guildConfig');
const { t } = require('../services/i18n');
const config = require('../config/config');

const { isSubscriptionActive } = require('../services/subscriptionService');
const { createPartikurEmbed, buildRolesFields, addFooterFields } = require('../builders/embedBuilder');
const { createCustomPartyComponents } = require('../builders/componentBuilder');
const db = require('../services/db');

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

async function handleTempAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildConfig = await getGuildConfig(interaction.guildId);
    
    // 0. Subscription Check (optional but good idea, wait, discord doesn't need it on autocomplete, just return templates)
    const templatesStr = guildConfig?.party_templates;
    let templates = [];
    try {
        if (templatesStr) templates = typeof templatesStr === 'string' ? JSON.parse(templatesStr) : templatesStr;
    } catch(e) {}

    // Safe fallback if templates is not an array somehow
    if (!Array.isArray(templates)) templates = [];

    const choices = templates.map((t, index) => ({
        name: (t.name || t.header || `Template ${index + 1}`).substring(0, 100),
        value: index.toString()
    }));
    
    const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered);
}

async function handleTempCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const userId = interaction.user.id;

    // 0. Subscription Check
    const active = await isSubscriptionActive(interaction.guildId, interaction.guild.name, interaction.guild.ownerId);
    if (!active) {
        const expiredEmbed = new EmbedBuilder()
            .setTitle(t('subscription.expired_title', lang))
            .setDescription(t('subscription.expired_desc', lang))
            .setColor('#FF0000');
        return await interaction.reply({ embeds: [expiredEmbed], flags: [MessageFlags.Ephemeral] });
    }

    // Check Limits
    const isOwner = userId === interaction.guild?.ownerId;
    const isDeveloper = config.WHITELIST_USERS?.includes(userId);
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

    const templateIndex = interaction.options.getString('template');
    const template = getTemplateByIndex(guildConfig?.party_templates, templateIndex);
    
    if (!template) {
        return await interaction.reply({ content: '❌ Hata: Şablon bulunamadı!', flags: [MessageFlags.Ephemeral] });
    }

    const header = template.header || template.name || 'Parti';
    let rolesRaw = template.roles || template.rolesRaw || '';
    if (Array.isArray(template.roles)) {
        rolesRaw = template.roles.join('\n');
    }
    const description = template.description || '';

    const rolesList = rolesRaw.split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);

    if (rolesList.length === 0) {
        return await interaction.reply({ content: '❌ Bu şablonda hiç rol tanımlanmamış.', flags: [MessageFlags.Ephemeral] });
    }

    // Defer reply instead of replying immediately so we can create the party message and reference it if we want to confirm ephemeral, 
    // Wait, the regular /createparty responds an ephemeral wait then creates a real message. Actually /createparty opens modal, then modal completes.
    // Let's send the actual party into the channel directly, and reply ephemeral with success.
    await interaction.reply({ content: '⏳ Şablon yükleniyor ve parti oluşturuluyor...', flags: [MessageFlags.Ephemeral] });

    // Use shared creation logic
    const embed = createPartikurEmbed(header, rolesList, description, '', 0, interaction.guild, lang, userId, guildConfig?.embed_thumbnail_url);
    const rolesWithMembers = rolesList.map(role => ({ role, userId: null }));
    const components = createCustomPartyComponents(rolesList, userId, lang, rolesWithMembers);
    
    embed.addFields(...buildRolesFields(rolesWithMembers, lang, interaction.guild));

    const actualRoles = rolesList.filter(r => !r.startsWith('#HEADER:') && !r.startsWith('#'));
    addFooterFields(embed, 0, actualRoles.length, lang);

    const msg = await interaction.channel.send({ content: '@everyone', embeds: [embed], components: components });

    const msgId = msg?.id;
    const chanId = msg?.channelId || interaction.channelId;

    if (msgId) {
        setActiveParty(userId, msgId, chanId);

        try {
            const result = await db.run(
                'INSERT INTO parties (message_id, channel_id, owner_id, type, title, party_time) VALUES (?, ?, ?, ?, ?, ?)',
                [msgId, chanId, userId, 'genel', header, null]
            );
            const partyDbId = result.lastID;

            for (const role of rolesList) {
                await db.run(
                    'INSERT INTO party_members (party_id, user_id, role, status) VALUES (?, ?, ?, ?)',
                    [partyDbId, null, role, 'joined']
                );
            }
        } catch (err) {
            console.error('[PartikurHandler] DB Error:', err.message);
        }
        
        await interaction.editReply({ content: '✅ Başarıyla oluşturuldu!' }).catch(()=>{});
    } else {
         await interaction.editReply({ content: '❌ Parti oluşturulamadı (Mesaj gönderilemedi)!' }).catch(()=>{});
    }
}

module.exports = {
    handleCreatePartyCommand,
    handleTempCommand,
    handleTempAutocomplete
};
