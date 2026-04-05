const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { EMPTY_SLOT, LOGO_PATH, LOGO_NAME } = require('../constants/constants');
const { updateButtonStates, createClosedButton, createCustomPartyComponents, isSelectMenuMode } = require('../builders/componentBuilder');
const { removeActiveParty } = require('../services/partyManager');
const { getEuropeGuildMembers } = require('../services/albionApiService');
const { createMemberPageEmbed } = require('./commandHandler');
const { createProgressBar } = require('../utils/generalUtils');
const { getGuildConfig } = require('../services/guildConfig');
const { createHelpEmbed, createDonateEmbed, createPartikurEmbed, addFooterFields, buildRolesValue, buildRolesFields, parseEmbedData } = require('../builders/embedBuilder');

const db = require('../services/db');
const { t } = require('../services/i18n');





/**
 * Handles join and leave button interactions
 */
async function handlePartyButtons(interaction) {
    const { finalizeRoleUpdate } = require('./menuHandler');
    const customId = interaction.customId;
    const message = interaction.message;
    if (!message.embeds[0]) return;

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    // Help Page Navigation
    if (customId.startsWith('help_page_')) {
        const pageIndex = parseInt(customId.split('_')[2]);

        const newEmbed = createHelpEmbed(pageIndex, interaction.guild, lang);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_page_0').setLabel('🏠').setStyle(pageIndex === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_page_1').setLabel(`⚔️ ${t('help.page_2', lang)}`).setStyle(pageIndex === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_page_2').setLabel(`🚨 ${t('help.page_3', lang)}`).setStyle(pageIndex === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

        const linkRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(`🌐 Website`).setStyle(ButtonStyle.Link).setURL('https://veyronixbot.vercel.app/'),
            new ButtonBuilder().setLabel(`🚀 ${t('help.top_gg', lang)}`).setStyle(ButtonStyle.Link).setURL('https://top.gg/tr/bot/1082239904169336902'),
            new ButtonBuilder().setLabel(t('help.donate_button', lang)).setStyle(ButtonStyle.Link).setURL('https://www.shopier.com/CyberShadows/44734656')
        );


        return await interaction.update({ 
            embeds: [newEmbed], 
            components: [row, linkRow],
            files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
        });
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
        const newFields = fields.filter(f => !f.value?.includes('📌') && !f.name?.includes('KURALLAR'));

        const closedEmbed = EmbedBuilder.from(oldEmbed)
            .setTitle(`${oldEmbed.title || 'Party'} [${t('common.closed', lang)}]`)
            .setColor('#808080')
            .setFields(newFields)
            .setThumbnail(`attachment://${LOGO_NAME}`)
            .setFooter(null)
            .setTimestamp(null);

        const closedRow = createClosedButton(lang);

        // Remove from active parties
        removeActiveParty(ownerId, message.id);


        const response = await interaction.update({ 
            embeds: [closedEmbed], 
            components: [closedRow],
            files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
        });

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

            const newEmbed = createMemberPageEmbed(members, newPage, interaction.guild, lang);

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

            return await interaction.editReply({ 
                embeds: [newEmbed], 
                components: [row],
                files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
            });
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

        let multiRoleWaitlist = data.multiRoleWaitlist || [];
        // If user left, remove from waitlist. If user joined/switched, their old swap choice is still valid unless we want them to re-pick.
        // The user complained that roles 'disappear', so I will ONLY remove if they leave entirely.
        if (customId === 'leave') {
            multiRoleWaitlist = multiRoleWaitlist.filter(u => u.userId !== userId);
        }

        const { newEmbed, newComponents } = await finalizeRoleUpdate(message, rolesWithMembers, multiRoleWaitlist, data, lang, guildName);

        await interaction.update({ 
            embeds: [newEmbed], 
            components: newComponents,
            files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
        });
        return; // Interaction zaten cevaplandı, settings bloklarına düşmesin
    }

    // --- SETTINGS BUTTON HANDLERS ---
    
    if (customId === 'swap_roles_btn') {
        const data = parseEmbedData(message.embeds[0], lang);
        const rolesWithMembers = data.rolesWithMembers;
        const isUserInAnySlot = rolesWithMembers.some(r => r.userId === interaction.user.id);
        
        if (!isUserInAnySlot) {
            return await interaction.reply({ content: lang === 'tr' ? '❌ Yedek rol seçmek için önce ana bir role katılmalısınız.' : '❌ You must join a primary role before selecting swap roles.', flags: [MessageFlags.Ephemeral] });
        }

        const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
        const multiJoinMenu = new StringSelectMenuBuilder()
            .setCustomId(`join_multi_role_${message.id}`)
            .setPlaceholder(lang === 'tr' ? '🎲 Yedek (Swap) rolleri seçin' : '🎲 Select swap roles')
            .setMinValues(1);

        let optionCount = 0;
        rolesWithMembers.forEach((r, index) => {
            if (r.role.startsWith('#')) return;
            optionCount++;
            let label = r.role.includes('>') ? r.role.split('>')[0].trim() : r.role;
            if (label.length > 90) label = label.substring(0, 87) + '...';

            const multiOption = new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(`${index}`)
                .setEmoji('🔄')
                .setDescription(lang === 'tr' ? 'Yedek rol seçiminiz için işaretleyin' : 'Select for swap role option');
            
            multiJoinMenu.addOptions(multiOption);
        });

        multiJoinMenu.setMaxValues(Math.min(25, optionCount));

        await interaction.reply({
            content: lang === 'tr' ? 'Lütfen geçebileceğiniz **Yedek Rolleri** seçin:' : 'Please select your **Swap Roles**:',
            components: [new ActionRowBuilder().addComponents(multiJoinMenu)],
            flags: [MessageFlags.Ephemeral]
        });
        return;
    }

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

    const data = parseEmbedData(message.embeds[0], lang);
    
    // Map with original indices and filter for empty actual roles
    const rolesWithIndex = data.rolesWithMembers.map((r, i) => ({ ...r, originalIndex: i }));
    const emptyRoles = rolesWithIndex.filter(r => !r.userId && !r.role.startsWith('#'));

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
            emptyRoles.map((r) => {
                let displayName = r.role.includes('>') ? r.role.split('>')[0].trim() : r.role;
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${displayName}`) // Removed index number as per user preference
                    .setValue(`${r.originalIndex}`);
            })
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
