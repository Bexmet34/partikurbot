const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMPTY_SLOT } = require('../constants/constants');
const { updateButtonStates, createClosedButton, createCustomPartyComponents, isSelectMenuMode } = require('../builders/componentBuilder');
const { removeActiveParty } = require('../services/partyManager');
const { getEuropeGuildMembers } = require('../services/albionApiService');
const { createMemberPageEmbed } = require('./commandHandler');
const { createProgressBar } = require('../utils/generalUtils');
const { getGuildConfig } = require('../services/guildConfig');
const { createHelpEmbed, createDonateEmbed, createPartikurEmbed, addFooterFields, buildRolesValue, parseEmbedData } = require('../builders/embedBuilder');
const db = require('../services/db');
const { t } = require('../services/i18n');





/**
 * Handles join and leave button interactions
 */
async function handlePartyButtons(interaction) {
    const customId = interaction.customId;
    const message = interaction.message;
    if (!message.embeds[0]) return;

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    // Help Page Navigation
    if (customId.startsWith('help_page_')) {
        const pageIndex = parseInt(customId.split('_')[2]);

        const newEmbed = createHelpEmbed(pageIndex, guildName, lang);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_page_0').setLabel('🏠').setStyle(pageIndex === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_page_1').setLabel(`⚔️ ${t('help.page_2', lang)}`).setStyle(pageIndex === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_page_2').setLabel(`🚨 ${t('help.page_3', lang)}`).setStyle(pageIndex === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

        const linkRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(`🌐 ${t('help.title_links', lang).split('&')[0].trim()}`).setStyle(ButtonStyle.Link).setURL('https://veyronixbot.vercel.app/'),
            new ButtonBuilder().setLabel(`💬 ${t('help.support_server', lang)}`).setStyle(ButtonStyle.Link).setURL('https://discord.gg/RZJE77KEVB'),
            new ButtonBuilder().setLabel(t('help.donate_button', lang)).setStyle(ButtonStyle.Link).setURL('https://www.shopier.com/CyberShadows/44734656')
        );


        return await interaction.update({ embeds: [newEmbed], components: [row, linkRow] });
    }




    if (customId.startsWith('close_party_')) {
        const ownerId = customId.split('_')[2];

        if (interaction.user.id !== ownerId) {
            return await interaction.reply({
                content: `⛔ **${t('common.only_leader_can_close', lang)}**`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const oldEmbed = message.embeds[0];
        const fields = oldEmbed.fields || [];
        const newFields = fields.filter(f => f.name && !f.name.includes('📌') && !f.name.includes('KURALLAR'));

        const closedEmbed = EmbedBuilder.from(oldEmbed)
            .setTitle(`${oldEmbed.title || 'Party'} [${t('common.closed', lang)}]`)
            .setColor('#808080')
            .setFields(newFields)
            .setFooter(null)
            .setTimestamp(null);

        const closedRow = createClosedButton(lang);

        // Remove from active parties
        removeActiveParty(ownerId, message.id);


        const response = await interaction.update({ embeds: [closedEmbed], components: [closedRow] });

        return response;
    }


    if (customId.startsWith('members_')) {
        const parts = customId.split('_');
        const action = parts[1]; // prev or next
        let currentPage = parseInt(parts[2]);
        const newPage = action === 'next' ? currentPage + 1 : currentPage - 1;

        await interaction.deferUpdate();

        try {
            const guildId = guildConfig?.albion_guild_id;

            if (!guildId) return;

            const members = await getEuropeGuildMembers(guildId);
            members.sort((a, b) => a.Name.localeCompare(b.Name));

            const newEmbed = createMemberPageEmbed(members, newPage, guildConfig.guild_name, lang);

            const totalPages = Math.ceil(members.length / 20);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`members_prev_${newPage}`)
                    .setLabel(`⬅️ ${t('common.back', lang)}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === 0),
                new ButtonBuilder()
                    .setCustomId(`members_next_${newPage}`)
                    .setLabel(`${t('common.next', lang)} ➡️`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage >= totalPages - 1)
            );

            return await interaction.editReply({ embeds: [newEmbed], components: [row] });
        } catch (error) {
            console.error('[ButtonHandler] Uyeler Paging Error:', error);
            return;
        }
    }

    if (customId === 'leave' || customId.startsWith('join_')) {
        const oldEmbed = message.embeds[0];
        const userId = interaction.user.id;

        // Parse existing data
        const data = parseEmbedData(message.embeds[0], lang);
        let rolesWithMembers = data.rolesWithMembers;
        const ownerId = data.ownerId;
        const content = data.content;
        const partyTime = data.partyTime;
        const description = data.description;

        const isUserInAnySlot = rolesWithMembers.some(r => r.userId === userId);

        if (customId === 'leave') {
            rolesWithMembers = rolesWithMembers.map(r => r.userId === userId ? { ...r, userId: null } : r);
            db.run('UPDATE party_members SET user_id = NULL WHERE party_id = (SELECT id FROM parties WHERE message_id = ?) AND user_id = ?', [message.id, userId]).catch(e => console.error(e));
        } else {
            // Join logic
            let joinIndex = -1;
            if (customId === 'join_tank') joinIndex = rolesWithMembers.findIndex(r => r.role.toLowerCase().includes('tank') && !r.userId);
            else if (customId === 'join_heal') joinIndex = rolesWithMembers.findIndex(r => (r.role.toLowerCase().includes('heal') || r.role.toLowerCase().includes('healer')) && !r.userId);
            else if (customId === 'join_dps') joinIndex = rolesWithMembers.findIndex(r => r.role.toLowerCase().includes('dps') && !r.userId);
            else if (customId.startsWith('join_custom_')) {
                const customIdx = parseInt(customId.split('_')[2]);
                joinIndex = customIdx;
            }

            if (joinIndex !== -1 && !rolesWithMembers[joinIndex].userId) {
                // Remove from old slot if switching
                if (isUserInAnySlot) {
                    rolesWithMembers = rolesWithMembers.map(r => r.userId === userId ? { ...r, userId: null } : r);
                }
                rolesWithMembers[joinIndex].userId = userId;

                const roleName = rolesWithMembers[joinIndex].role;
                db.run('INSERT INTO party_members (party_id, user_id, role, status) SELECT id, ?, ?, "joined" FROM parties WHERE message_id = ?', [userId, roleName, message.id]).catch(e => console.error(e));
            } else if (joinIndex !== -1 && rolesWithMembers[joinIndex].userId) {
                return await interaction.reply({ content: `❌ ${t('common.error', lang)}`, flags: [MessageFlags.Ephemeral] });
            }
        }

        // Reconstruct Embed
        const filledCount = rolesWithMembers.filter(r => r.userId).length;
        const totalCount = rolesWithMembers.length;

        const newEmbed = createPartikurEmbed(oldEmbed.title, rolesWithMembers.map(r => r.role), description, content, filledCount, guildName, lang, ownerId, partyTime);
        newEmbed.addFields({
            name: '**Roller**',
            value: buildRolesValue(rolesWithMembers, lang),
            inline: true
        });
        addFooterFields(newEmbed, filledCount, totalCount, lang);

        // Update components — select menu mode or button mode
        let newComponents;
        if (isSelectMenuMode(rolesWithMembers.length)) {
            // Select menu mode: regenerate components with updated member state
            newComponents = createCustomPartyComponents(
                rolesWithMembers.map(r => r.role),
                ownerId,
                lang,
                rolesWithMembers
            );
        } else {
            // Button mode: update existing button states
            newComponents = updateButtonStates(message.components, rolesWithMembers.map(r => ({
                name: r.role,
                value: r.userId ? `<@${r.userId}>` : EMPTY_SLOT
            })));
        }

        await interaction.update({ embeds: [newEmbed], components: newComponents });
    }

    // --- SETTINGS BUTTON HANDLERS ---

    if (customId.startsWith('open_settings_')) {
        await handleOpenSettings(interaction, lang);
    }

    if (customId.startsWith('settings_edit_')) {
        const { handleEditOption } = require('./menuHandler');
        await handleEditOption(interaction, lang);
    }

    if (customId.startsWith('settings_kick_')) {
        const { handleManageMembersOption } = require('./menuHandler');
        await handleManageMembersOption(interaction, lang);
    }

    if (customId.startsWith('settings_add_member_')) {
        await handleAddMemberButton(interaction, lang);
    }

    if (customId.startsWith('settings_close_')) {
        const { handleCloseOption } = require('./menuHandler');
        const partyMsgId = customId.split('_')[2];
        const partyMessage = await interaction.channel.messages.fetch(partyMsgId);
        const infoField = partyMessage.embeds[0].fields.find(f => f.value && (f.value.includes('👑') || f.value.includes('📝')))?.value || '';
        const ownerMention = infoField.match(/<@(\d+)>/)?.[1];
        await handleCloseOption(interaction, ownerMention, lang);
    }

}

/**
 * Handles "Ayar" button click
 */
async function handleOpenSettings(interaction, lang) {
    const ownerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== ownerId) {
        return await interaction.reply({
            content: `⛔ **${t('common.only_leader_can_manage', lang)}**`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ ${t('manage.settings_title', lang)}`)
        .setDescription(t('manage.settings_desc', lang))
        .setColor('#2F3136');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`settings_edit_${interaction.message.id}`).setLabel(t('manage.edit_party', lang)).setStyle(ButtonStyle.Primary).setEmoji('📝'),
        new ButtonBuilder().setCustomId(`settings_add_member_${interaction.message.id}`).setLabel(t('manage.add_member', lang)).setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId(`settings_kick_${interaction.message.id}`).setLabel(t('manage.manage_members', lang)).setStyle(ButtonStyle.Danger).setEmoji('👥')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`settings_close_${interaction.message.id}`).setLabel(t('manage.close_party', lang)).setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        flags: [MessageFlags.Ephemeral]
    });
}

/**
 * Handles "Add Member" button click
 */
async function handleAddMemberButton(interaction, lang) {
    const messageId = interaction.customId.split('_')[3];
    const message = await interaction.channel.messages.fetch(messageId);
    if (!message) return;

    const fields = message.embeds[0].fields;
    const rollerValue = fields.find(f => f.name && f.name.includes('Roller'))?.value || '';

    // Parse Roles to find empty ones
    const roleRegex = /(?:🔴|🟡)\s*\*\*(.*?):\*\*\s*(<@(\d+)>|)/g;
    let roles = [];
    let match;
    let counter = 0;
    while ((match = roleRegex.exec(rollerValue)) !== null) {
        roles.push({
            name: match[1],
            isFull: !!match[2],
            index: counter++
        });
    }

    const emptyRoles = roles.filter(r => !r.isFull);

    if (emptyRoles.length === 0) {
        return await interaction.reply({
            content: `❌ ${t('manage.no_empty_roles', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`add_member_select_${messageId}`)
        .setPlaceholder(t('manage.select_role_to_add', lang))
        .addOptions(
            emptyRoles.map((r) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${r.index + 1}. ${r.name}`)
                    .setValue(`${r.index}`)
            )
        );

    await interaction.reply({
        content: t('manage.select_role_to_add', lang),
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        flags: [MessageFlags.Ephemeral]
    });
}

module.exports = {
    handlePartyButtons
};
