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

async function handleTempCommand(interaction) {
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    // 0. Subscription Check
    const active = await isSubscriptionActive(interaction.guildId, interaction.guild.name, interaction.guild.ownerId);
    if (!active) {
        const expiredEmbed = new EmbedBuilder()
            .setTitle(t('subscription.expired_title', lang))
            .setDescription(t('subscription.expired_desc', lang))
            .setColor('#FF0000');
        return await interaction.reply({ embeds: [expiredEmbed], flags: [MessageFlags.Ephemeral] });
    }

    const templatesStr = guildConfig?.party_templates;
    let templates = [];
    try {
        if (templatesStr) templates = typeof templatesStr === 'string' ? JSON.parse(templatesStr) : templatesStr;
    } catch(e) {}

    if (!templates || templates.length === 0) {
        return await interaction.reply({
            content: lang === 'tr' ? '❌ Veritabanında hiçbir şablon bulunamadı. Lütfen web paneli üzerinden ekleyin.' : '❌ No templates found in the database. Please add them via the web panel.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('temp_party_select')
        .setPlaceholder(lang === 'tr' ? 'Bir parti şablonu seçin...' : 'Select a party template...')
        .addOptions(templates.slice(0, 25).map((t, index) => {
            return new StringSelectMenuOptionBuilder()
                .setLabel(t.name || t.header?.substring(0, 50) || `Template ${index + 1}`)
                .setDescription((t.description || '').substring(0, 100))
                .setValue(index.toString());
        }));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({
        content: lang === 'tr' ? 'Lütfen kullanmak istediğiniz şablonu seçin:' : 'Please select the template you want to use:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
}

function getTemplateByIndex(templatesStr, indexStr) {
    try {
        let templates = typeof templatesStr === 'string' ? JSON.parse(templatesStr) : templatesStr;
        const i = parseInt(indexStr, 10);
        return templates[i];
    } catch(e) {
        return null;
    }
}

async function handleTempPartySelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'temp_party_select') return;
    
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const userId = interaction.user.id;

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

        return await interaction.update({
            content: errorMsg,
            components: []
        });
    }

    const template = getTemplateByIndex(guildConfig?.party_templates, interaction.values[0]);
    if (!template) {
        return await interaction.update({ content: '❌ Hata: Şablon bulunamadı!', components: [] });
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
        return await interaction.update({ content: '❌ Bu şablonda hiç rol tanımlanmamış.', components: [] });
    }

    await interaction.update({ content: '⏳ Şablon yükleniyor...', components: [] });

    // Use shared creation logic
    const { createPartikurEmbed, buildRolesFields, addFooterFields } = require('../builders/embedBuilder');
    const { createCustomPartyComponents } = require('../builders/componentBuilder');
    const db = require('../services/db');

    const embed = createPartikurEmbed(header, rolesList, description, '', 0, interaction.guild, lang, userId, guildConfig?.embed_thumbnail_url);
    const rolesWithMembers = rolesList.map(role => ({ role, userId: null }));
    const components = createCustomPartyComponents(rolesList, userId, lang, rolesWithMembers);
    
    embed.addFields(...buildRolesFields(rolesWithMembers, lang, interaction.guild));

    const actualRoles = rolesList.filter(r => !r.startsWith('#HEADER:') && !r.startsWith('#'));
    addFooterFields(embed, 0, actualRoles.length, lang);

    const { safeReply } = require('../utils/interactionUtils');
    // Safe reply as new message in the channel since update edit ephemeral
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
        
        await interaction.followUp({ content: '✅ Başarıyla oluşturuldu!', flags: [MessageFlags.Ephemeral] }).catch(()=>{});
    }
}

module.exports = {
    handleCreatePartyCommand,
    handleTempCommand,
    handleTempPartySelect
};
