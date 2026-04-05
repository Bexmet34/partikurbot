const { MessageFlags, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { EMPTY_SLOT, LOGO_PATH, LOGO_NAME } = require('../constants/constants');
const { t } = require('../services/i18n');
const { getGuildConfig } = require('../services/guildConfig');
const { removeActiveParty } = require('../services/partyManager');
const { createClosedButton, createCustomPartyComponents, isSelectMenuMode, updateButtonStates } = require('../builders/componentBuilder');
const { createPartikurEmbed, buildRolesValue, buildRolesFields, addFooterFields, parseEmbedData } = require('../builders/embedBuilder');

const db = require('../services/db');
const isActualRole = (r) => r.role && !r.role.startsWith('#HEADER:') && !r.role.startsWith('#');

async function handleManageMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('manage_party_')) return;

    const ownerId = customId.split('_')[2];
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    if (interaction.user.id !== ownerId) {
        return await interaction.reply({
            content: `⛔ **${t('common.only_leader_can_manage', lang)}**`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    const value = interaction.values[0];

    if (value === 'close_party') {
        await handleCloseOption(interaction, ownerId, lang);
    } else if (value === 'edit_party') {
        await handleEditOption(interaction, lang);
    } else if (value === 'manage_members') {
        await handleManageMembersOption(interaction, lang);
    }
}

async function handleCloseOption(interaction, ownerId, lang) {
    let message = interaction.message;
    if (interaction.customId.startsWith('settings_close_')) {
        const partyMsgId = interaction.customId.split('_')[2];
        message = await interaction.channel.messages.fetch(partyMsgId);
    }
    if (!message || !message.embeds[0]) return;

    const oldEmbed = message.embeds[0];
    const fields = oldEmbed.fields || [];
    const newFields = fields.filter(f => !f.value?.includes('📌') && !f.name?.includes('KURALLAR'));

    const closedEmbed = EmbedBuilder.from(oldEmbed)
        .setTitle(`${oldEmbed.title || 'Party'} [${t('common.closed', lang)}]`)
        .setColor('#808080')
        .setFields(newFields)
        .setFooter(null)
        .setTimestamp(null);

    const closedRow = createClosedButton(lang);
    removeActiveParty(ownerId, message.id);

    // If it's a settings button, update the settings message to say "Closed" and edit the main message
    if (interaction.customId.startsWith('settings_close_')) {
        await message.edit({ 
            embeds: [closedEmbed], 
            components: [closedRow],
            files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
        });
        await interaction.update({ content: `✅ ${t('common.party_closed_label', lang)}`, embeds: [], components: [] });
    } else {
        await interaction.update({ 
            embeds: [closedEmbed], 
            components: [closedRow],
            files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
        });
    }
}

async function handleEditOption(interaction, lang) {
    let message = interaction.message;
    if (interaction.customId.startsWith('settings_edit_')) {
        const partyMsgId = interaction.customId.split('_')[2];
        message = await interaction.channel.messages.fetch(partyMsgId);
    }
    if (!message || !message.embeds[0]) return;

    const data = parseEmbedData(message.embeds[0], lang);

    const modal = new ModalBuilder()
        .setCustomId(`edit_party_modal:${message.id}`)
        .setTitle(lang === 'tr' ? 'Partiyi Düzenle' : 'Edit Party');

    const headerInput = new TextInputBuilder()
        .setCustomId('party_header')
        .setLabel(t('party.party_header_label', lang))
        .setValue(data.title || '')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);


    const rolesInput = new TextInputBuilder()
        .setCustomId('party_roles')
        .setLabel(t('party.party_roles_label', lang))
        .setValue(data.rolesWithMembers.map(r => r.role).join('\n'))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('party_description')
        .setLabel(lang === 'tr' ? 'Parti Açıklaması' : 'Description')
        .setValue(data.description)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(headerInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(rolesInput)
    );

    await interaction.showModal(modal);
}

async function handleManageMembersOption(interaction, lang) {
    let message = interaction.message;
    if (interaction.customId.startsWith('settings_kick_')) {
        const partyMsgId = interaction.customId.split('_')[2];
        message = await interaction.channel.messages.fetch(partyMsgId);
    }
    if (!message || !message.embeds[0]) return;
    const fields = message.embeds[0].fields;
    const rollerFields = fields.filter(f => f.value && (f.value.includes('🔴') || f.value.includes('🟡') || f.value.includes('📌')));
    const rollerValue = rollerFields.map(f => f.value).join('\n');


    const roleRegex = /(?:🔴|🟡)\s*(.*?):\s*<@(\d+)>/g;
    let members = [];
    let match;
    while ((match = roleRegex.exec(rollerValue)) !== null) {
        members.push({
            role: match[1],
            userId: match[2]
        });
    }

    if (members.length === 0) {
        return await interaction.reply({
            content: lang === 'tr' ? '❌ Partide henüz kimse yok.' : '❌ No members in party yet.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`kick_member_${message.id}`)
        .setPlaceholder(lang === 'tr' ? 'Kullanıcıyı Çıkar' : 'Remove Member')
        .addOptions(
            members.map((m, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${m.role}: ${m.userId}`)
                    .setValue(`${m.userId}_${i}`)
            )
        );

    await interaction.reply({
        content: lang === 'tr' ? 'Çıkarmak istediğiniz kullanıcıyı seçin:' : 'Select member to remove:',
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        flags: [MessageFlags.Ephemeral]
    });
}

async function handleEditModal(interaction) {
    const modalId = interaction.customId;
    const originalMsgId = modalId.split(':')[1];
    const message = await interaction.channel.messages.fetch(originalMsgId);
    if (!message) return;

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    const header = interaction.fields.getTextInputValue('party_header');
    const rolesRaw = interaction.fields.getTextInputValue('party_roles');
    const description = interaction.fields.getTextInputValue('party_description') || '';

    // Parse existing data with members to preserve them
    const oldData = parseEmbedData(message.embeds[0], lang);
    const oldMembers = {};
    oldData.rolesWithMembers.forEach(r => {
        if (r.userId) {
            if (!oldMembers[r.role]) oldMembers[r.role] = [];
            oldMembers[r.role].push(r.userId);
        }
    });

    const newRolesList = rolesRaw.split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);
    const rolesWithMembers = newRolesList.map(role => {
        let userId = null;
        if (oldMembers[role] && oldMembers[role].length > 0) {
            userId = oldMembers[role].shift();
        }
        return {
            role: role,
            userId: userId
        };
    });

    const { createPartikurEmbed, buildRolesValue, addFooterFields } = require('../builders/embedBuilder');
    const { createCustomPartyComponents, updateButtonStates } = require('../builders/componentBuilder');

    const actualRoles = rolesWithMembers.filter(isActualRole);
    const filledCount = actualRoles.filter(r => r.userId).length;
    const totalCount = actualRoles.length;

    const ownerId = oldData.ownerId;

    const embed = createPartikurEmbed(header, newRolesList, description, '', filledCount, interaction.guild, lang, ownerId);
    embed.addFields(...buildRolesFields(rolesWithMembers, lang, interaction.guild));
    addFooterFields(embed, filledCount, totalCount, lang);

    // Update DB
    db.run('UPDATE parties SET title = ? WHERE message_id = ?', [header, originalMsgId]).catch(e => console.error(e));

    // Select menu mode or button mode
    let finalComponents;
    if (isSelectMenuMode(newRolesList.length)) {
        finalComponents = createCustomPartyComponents(newRolesList, ownerId, lang, rolesWithMembers, interaction.guild || interaction.client);
    } else {
        const { updateButtonStates } = require('../builders/componentBuilder');
        const components = createCustomPartyComponents(newRolesList, ownerId, lang, null, interaction.guild || interaction.client);
        finalComponents = updateButtonStates(components, rolesWithMembers.map(r => ({
            name: r.role,
            value: r.userId ? `<@${r.userId}>` : EMPTY_SLOT
        })));
    }

    await message.edit({ 
        embeds: [embed], 
        components: finalComponents,
        files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
    });
    await interaction.reply({ content: lang === 'tr' ? '✅ Parti başarıyla güncellendi.' : '✅ Party updated successfully.', flags: [MessageFlags.Ephemeral] });
}

async function handleKickMember(interaction) {
    const customId = interaction.customId;
    const originalMsgId = customId.split('_')[2];
    const message = await interaction.channel.messages.fetch(originalMsgId);
    if (!message) return;

    const [userId, roleIndex] = interaction.values[0].split('_');
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    const data = parseEmbedData(message.embeds[0], lang);
    let rolesWithMembers = data.rolesWithMembers;

    // Remove the user
    rolesWithMembers = rolesWithMembers.map(r => r.userId === userId ? { ...r, userId: null } : r);
    db.run('UPDATE party_members SET user_id = NULL WHERE party_id = (SELECT id FROM parties WHERE message_id = ?) AND user_id = ?', [message.id, userId]).catch(e => console.error(e));

    const { createPartikurEmbed, buildRolesValue, addFooterFields } = require('../builders/embedBuilder');
    const { createCustomPartyComponents, updateButtonStates } = require('../builders/componentBuilder');

    const actualRoles = rolesWithMembers.filter(isActualRole);
    const filledCount = actualRoles.filter(r => r.userId).length;
    const totalCount = actualRoles.length;

    const embed = createPartikurEmbed(message.embeds[0].title, rolesWithMembers.map(r => r.role), data.description, '', filledCount, interaction.guild, lang, data.ownerId);
    embed.addFields(...buildRolesFields(rolesWithMembers, lang, interaction.guild));

    addFooterFields(embed, filledCount, totalCount, lang);

    // Select menu mode or button mode
    let newComponents;
    if (isSelectMenuMode(rolesWithMembers.length)) {
        newComponents = createCustomPartyComponents(
            rolesWithMembers.map(r => r.role),
            data.ownerId,
            lang,
            rolesWithMembers,
            interaction.guild || interaction.client
        );
    } else {
        newComponents = updateButtonStates(message.components, rolesWithMembers.map(r => ({
            name: r.role,
            value: r.userId ? `<@${r.userId}>` : EMPTY_SLOT
        })));
    }

    await message.edit({ 
        embeds: [embed], 
        components: newComponents,
        files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
    });
    await interaction.update({ content: lang === 'tr' ? '✅ Kullanıcı çıkarıldı.' : '✅ Member removed.', components: [], flags: [MessageFlags.Ephemeral] });
}

async function finalizeRoleUpdate(message, rolesWithMembers, multiRoleWaitlist, data, lang, guildName) {
    const isActualRole = (r) => r.role && !r.role.startsWith('#HEADER:') && !r.role.startsWith('#');
    const actualRoles = rolesWithMembers.filter(isActualRole);
    let filledCount = actualRoles.filter(r => r.userId).length;
    const totalCount = actualRoles.length;

    const { createPartikurEmbed, buildRolesFields, buildWaitlistField, addFooterFields } = require('../builders/embedBuilder');
    const { createCustomPartyComponents } = require('../builders/componentBuilder');

    const newEmbed = createPartikurEmbed(message.embeds[0].title, rolesWithMembers.map(r => r.role), data.description, '', filledCount, message.guild, lang, data.ownerId);
    newEmbed.addFields(...buildRolesFields(rolesWithMembers, lang, message.guild));
    
    const waitlistField = buildWaitlistField(multiRoleWaitlist, rolesWithMembers, lang);
    if (waitlistField) {
        newEmbed.addFields(waitlistField);
    }

    addFooterFields(newEmbed, filledCount, totalCount, lang);

    const newComponents = createCustomPartyComponents(
        rolesWithMembers.map(r => r.role),
        data.ownerId,
        lang,
        rolesWithMembers,
        message.guild || message.client // Note: here we only have message
    );

    return { newEmbed, newComponents };
}

/**
 * Handles role selection from the join role select menu (for parties with >7 roles)
 */
async function handleJoinRoleSelect(interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const message = interaction.message;
    if (!message.embeds[0]) return;

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    const userId = interaction.user.id;
    const selectedIndex = parseInt(interaction.values[0]);

    const data = parseEmbedData(message.embeds[0], lang);
    let rolesWithMembers = data.rolesWithMembers;

    // Check if selected slot exists
    if (selectedIndex < 0 || selectedIndex >= rolesWithMembers.length) {
        return await interaction.reply({
            content: `❌ ${t('common.error', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    // Check if the selected slot is already filled
    let multiRoleWaitlist = data.multiRoleWaitlist || [];
    
    if (rolesWithMembers[selectedIndex].userId && rolesWithMembers[selectedIndex].userId !== userId) {
        const occupierId = rolesWithMembers[selectedIndex].userId;

        // Check if the occupier has ANY swap choices
        const occupierSwapEntry = multiRoleWaitlist.find(u => u.userId === occupierId);
        if (!occupierSwapEntry) {
            const roleName = rolesWithMembers[selectedIndex].role.split('>')[0].trim();
            const failMsg = lang === 'tr'
                ? `❌ **${roleName}** rolüne geçmek istediniz fakat <@${occupierId}> isimli oyuncunun geçebileceği herhangi bir Yedek rolü (Swap) yok.`
                : `❌ You tried to join **${roleName}** but player <@${occupierId}> has no available Swap roles.`;
            return await interaction.reply({ content: failMsg, flags: [MessageFlags.Ephemeral] });
        }

        // Simulate the swap using Bipartite Algorithm
        const simRoles = rolesWithMembers.map(r => ({ ...r }));
        
        // Remove clicker from old slot inside simulation
        const userBOldIndex = simRoles.findIndex(r => r.userId === userId);
        if (userBOldIndex !== -1) simRoles[userBOldIndex].userId = null;
        
        // Put clicker into the targeted slot
        simRoles[selectedIndex].userId = userId;

        // Extract flexible users in slots (for existingMatches)
        const existingMatches = {};
        simRoles.forEach((r, idx) => {
            if (r.userId && multiRoleWaitlist.some(u => u.userId === r.userId)) {
                existingMatches[idx] = multiRoleWaitlist.find(u => u.userId === r.userId);
            }
        });

        // Collect available empty slots
        const emptySlots = [];
        simRoles.forEach((r, idx) => {
            if (!r.role.startsWith('#') && !r.userId) {
                emptySlots.push({ index: idx, role: r.role });
            }
        });

        const { allocateMultiRoleUsers } = require('../utils/partyAllocator');
        const { assignments, unassignedUsers } = allocateMultiRoleUsers([occupierSwapEntry], emptySlots, existingMatches);

        if (unassignedUsers.length > 0) {
            // Cannot satisfy swap locally
            const roleName = rolesWithMembers[selectedIndex].role.split('>')[0].trim();
            const failMsg = lang === 'tr'
                ? `❌ **${roleName}** rolüne geçmek istediniz fakat <@${occupierId}> isimli oyuncunun geçebileceği uygun (boş) bir Yedek rol kalmamış.`
                : `❌ You tried to join **${roleName}** but player <@${occupierId}> has no empty Swap positions left.`;
            return await interaction.reply({ content: failMsg, flags: [MessageFlags.Ephemeral] });
        }

        // SWAP SUCCESSFUL! Apply the assignments
        rolesWithMembers = simRoles;
        
        // Clear slots of flexible users in simulation to avoid ghosting
        Object.keys(existingMatches).forEach(idx => {
            rolesWithMembers[idx].userId = null;
        });

        for (const [slotIndex, uId] of Object.entries(assignments)) {
            rolesWithMembers[slotIndex].userId = uId;
        }

        // Sync with DB
        const usersToSync = Object.values(existingMatches).map(u => u.userId);
        usersToSync.push(occupierId);
        usersToSync.push(userId); // the clicker

        const db = require('../services/db');
        const uniqueUsersToSync = [...new Set(usersToSync)];
        const placeholders = uniqueUsersToSync.map(() => '?').join(',');
        db.run(`DELETE FROM party_members WHERE user_id IN (${placeholders}) AND party_id = (SELECT id FROM parties WHERE message_id = ?)`, [...uniqueUsersToSync, message.id]).catch(console.error);

        for (const uId of uniqueUsersToSync) {
            const slotIdx = rolesWithMembers.findIndex(r => r.userId === uId);
            if (slotIdx !== -1) {
                const roleName = rolesWithMembers[slotIdx].role;
                db.run('INSERT INTO party_members (party_id, user_id, role, status) SELECT id, ?, ?, "joined" FROM parties WHERE message_id = ?', [uId, roleName, message.id]).catch(console.error);
            }
        }

        multiRoleWaitlist = multiRoleWaitlist.filter(u => u.userId !== userId); // clicker's swap is erased

        const allocationResult = await finalizeRoleUpdate(message, rolesWithMembers, multiRoleWaitlist, data, lang, guildName);
        return await interaction.update({ 
            embeds: [allocationResult.newEmbed], 
            components: allocationResult.newComponents,
            files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
        });
    }

    const isUserInAnySlot = rolesWithMembers.some(r => r.userId === userId);

    // Remove from old slot if switching
    if (isUserInAnySlot) {
        rolesWithMembers = rolesWithMembers.map(r => r.userId === userId ? { ...r, userId: null } : r);
    }

    // Join the new slot
    rolesWithMembers[selectedIndex].userId = userId;

    // DB update
    const roleName = rolesWithMembers[selectedIndex].role;
    db.run('INSERT INTO party_members (party_id, user_id, role, status) SELECT id, ?, ?, "joined" FROM parties WHERE message_id = ?',
        [userId, roleName, message.id]).catch(e => console.error(e));

    // Regenerate select menu components with updated member state
    multiRoleWaitlist = multiRoleWaitlist.filter(u => u.userId !== userId);

    const allocationResult = await finalizeRoleUpdate(message, rolesWithMembers, multiRoleWaitlist, data, lang, guildName);
    await interaction.update({ 
        embeds: [allocationResult.newEmbed], 
        components: allocationResult.newComponents,
        files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
    });
}

async function handleJoinMultiRoleSelect(interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const partyMessageId = interaction.customId.split('_')[3];
    const message = await interaction.channel.messages.fetch(partyMessageId).catch(() => null);
    if (!message || !message.embeds[0]) {
        return await interaction.reply({ content: '❌ Parti mesajı bulunamadı.', flags: [MessageFlags.Ephemeral] });
    }

    const { getGuildConfig } = require('../services/guildConfig');
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    const userId = interaction.user.id;
    const selectedIndices = interaction.values.map(v => parseInt(v));

    const data = parseEmbedData(message.embeds[0], lang);
    let rolesWithMembers = data.rolesWithMembers;
    let multiRoleWaitlist = data.multiRoleWaitlist || [];

    // Do not remove them from primary slot, swap roles are strictly supplementary.

    multiRoleWaitlist = multiRoleWaitlist.filter(u => u.userId !== userId);
    multiRoleWaitlist.push({ userId, roleIndices: selectedIndices });

    const allocationResult = await finalizeRoleUpdate(message, rolesWithMembers, multiRoleWaitlist, data, lang, guildName);

    await message.edit({ 
        embeds: [allocationResult.newEmbed], 
        components: allocationResult.newComponents,
        files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
    });
    await interaction.update({ content: lang === 'tr' ? '✅ Yedek rolleriniz başarıyla kaydedildi.' : '✅ Swap roles successfully saved.', embeds: [], components: [] });
}

async function handleAddMemberSelect(interaction) {
    const customId = interaction.customId;
    const messageId = customId.split('_')[3];
    const roleIndex = interaction.values[0];
    const roleName = interaction.component.options.find(o => o.value === roleIndex)?.label || 'Role';

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`add_member_user_select_${messageId}_${roleIndex}`)
        .setPlaceholder(t('manage.user_id_label', lang) + ` (${roleName})`);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await interaction.update({
        content: `👤 **${roleName}** rolüne eklenecek kullanıcıyı seçin:`,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
}

async function handleAddMemberUserSelect(interaction) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const messageId = parts[4];
    const roleIndex = parseInt(parts[5]);
    const targetUserId = interaction.values[0];

    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';
    const guildName = guildConfig?.guild_name || 'Albion';

    const message = await interaction.channel.messages.fetch(messageId);
    if (!message) return;

    const data = parseEmbedData(message.embeds[0], lang);
    let rolesWithMembers = data.rolesWithMembers;

    // Check if user is already in another slot
    const alreadyInSlot = rolesWithMembers.find(r => r.userId === targetUserId);
    if (alreadyInSlot) {
        rolesWithMembers = rolesWithMembers.map(r => r.userId === targetUserId ? { ...r, userId: null } : r);
    }

    if (roleIndex < 0 || roleIndex >= rolesWithMembers.length) {
        return await interaction.reply({ content: `❌ ${t('common.error', lang)}`, flags: [MessageFlags.Ephemeral] });
    }

    rolesWithMembers[roleIndex].userId = targetUserId;

    // DB update
    const roleName = rolesWithMembers[roleIndex].role;
    db.run('INSERT INTO party_members (party_id, user_id, role, status) SELECT id, ?, ?, "joined" FROM parties WHERE message_id = ?',
        [targetUserId, roleName, messageId]).catch(e => console.error(e));

    // Reconstruct Embed
    const actualRoles = rolesWithMembers.filter(isActualRole);
    const filledCount = actualRoles.filter(r => r.userId).length;
    const totalCount = actualRoles.length;

    const embed = createPartikurEmbed(data.title, rolesWithMembers.map(r => r.role), data.description, '', filledCount, interaction.guild, lang, data.ownerId);
    embed.addFields(...buildRolesFields(rolesWithMembers, lang, interaction.guild));

    addFooterFields(embed, filledCount, totalCount, lang);

    // Update components
    let newComponents;
    if (isSelectMenuMode(rolesWithMembers.length)) {
        newComponents = createCustomPartyComponents(
            rolesWithMembers.map(r => r.role),
            data.ownerId,
            lang,
            rolesWithMembers,
            interaction.guild || interaction.client
        );
    } else {
        newComponents = updateButtonStates(message.components, rolesWithMembers.map(r => ({
            name: r.role,
            value: r.userId ? `<@${r.userId}>` : EMPTY_SLOT
        })));
    }

    await message.edit({ 
        embeds: [embed], 
        components: newComponents,
        files: [new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME })]
    });
    await interaction.update({ content: `✅ ${t('manage.member_added', lang)}`, components: [], flags: [MessageFlags.Ephemeral] });
}

module.exports = {
    handleManageMenu,
    handleEditModal,
    handleKickMember,
    handleJoinRoleSelect,
    handleJoinMultiRoleSelect,
    handleAddMemberSelect,
    handleAddMemberUserSelect,
    handleEditOption,
    handleManageMembersOption,
    handleCloseOption
};
