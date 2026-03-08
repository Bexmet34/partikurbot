const { MessageFlags, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { t } = require('../services/i18n');
const { getGuildConfig } = require('../services/guildConfig');
const { removeActiveParty } = require('../services/partyManager');
const { createClosedButton, createCustomPartyComponents, isSelectMenuMode } = require('../builders/componentBuilder');
const db = require('../services/db');
const { EMPTY_SLOT } = require('../constants/constants');

async function handleManageMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('manage_party_')) return;

    const ownerId = customId.split('_')[2];
    const guildConfig = await getGuildConfig(interaction.guildId);
    const lang = guildConfig?.language || 'tr';

    if (interaction.user.id !== ownerId) {
        return await interaction.reply({
            content: `⛔ **${t('common.only_owner_can_close', lang)}**`,
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
    const message = interaction.message;
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
    removeActiveParty(ownerId, message.id);

    await interaction.update({ embeds: [closedEmbed], components: [closedRow] });
}

async function handleEditOption(interaction, lang) {
    const oldEmbed = interaction.message.embeds[0];
    const fields = oldEmbed.fields;

    // Parse existing data
    const genelBilgiler = fields.find(f => f.name === 'Genel Bilgiler')?.value || '';
    const rollerValue = fields.find(f => f.name === 'Roller')?.value || '';

    const placeMatch = genelBilgiler.match(/Çıkış Yeri: (.*)\nAçıklama: (.*)/);
    const content = placeMatch ? placeMatch[1] : '';
    const description = placeMatch ? placeMatch[2] : '';

    const roleRegex = /(?:🔴|🟡) \*\*(.*?):\*\* (?:<@\d+>|" ")/g;
    let roles = [];
    let match;
    while ((match = roleRegex.exec(rollerValue)) !== null) {
        roles.push(match[1]);
    }

    const modal = new ModalBuilder()
        .setCustomId(`edit_party_modal:${interaction.message.id}`)
        .setTitle(lang === 'tr' ? 'Partiyi Düzenle' : 'Edit Party');

    const headerInput = new TextInputBuilder()
        .setCustomId('party_header')
        .setLabel(t('party.party_header_label', lang))
        .setValue(oldEmbed.title || '')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('party_content')
        .setLabel(lang === 'tr' ? 'Çıkış Yeri' : 'Exit Location')
        .setValue(content)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const rolesInput = new TextInputBuilder()
        .setCustomId('party_roles')
        .setLabel(t('party.party_roles_label', lang))
        .setValue(roles.join('\n'))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('party_description')
        .setLabel(lang === 'tr' ? 'Parti Açıklaması' : 'Description')
        .setValue(description)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(headerInput),
        new ActionRowBuilder().addComponents(contentInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(rolesInput)
    );

    await interaction.showModal(modal);
}

async function handleManageMembersOption(interaction, lang) {
    const fields = interaction.message.embeds[0].fields;
    const rollerValue = fields.find(f => f.name === 'Roller')?.value || '';

    const roleRegex = /(?:🔴|🟡) \*\*(.*?):\*\* <@(\d+)>/g;
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
        .setCustomId(`kick_member_${interaction.message.id}`)
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
    const content = interaction.fields.getTextInputValue('party_content');
    const rolesRaw = interaction.fields.getTextInputValue('party_roles');
    const description = interaction.fields.getTextInputValue('party_description') || '';

    // Parse existing rolls with members to preserve them
    const fields = message.embeds[0].fields;
    const rollerValue = fields.find(f => f.name === 'Roller')?.value || '';
    const roleMatchRegex = /(?:🔴|🟡) \*\*(.*?):\*\* (?:<@(\d+)>|" ")/g;
    let oldMembers = {};
    let match;
    while ((match = roleMatchRegex.exec(rollerValue)) !== null) {
        if (match[2]) oldMembers[match[1]] = match[2];
    }

    const newRolesList = rolesRaw.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    const rolesWithMembers = newRolesList.map(role => ({
        role: role,
        userId: oldMembers[role] || null
    }));

    const { createPartikurEmbed, buildRolesValue, addFooterFields } = require('../builders/embedBuilder');
    const { createCustomPartyComponents, updateButtonStates } = require('../builders/componentBuilder');

    const filledCount = rolesWithMembers.filter(r => r.userId).length;
    const totalCount = rolesWithMembers.length;

    const ownerId = message.components[message.components.length - 1].components[0].customId.split('_')[2];

    const embed = createPartikurEmbed(header, newRolesList, description, content, filledCount, guildName, lang, ownerId);
    embed.addFields({
        name: 'Roller',
        value: buildRolesValue(rolesWithMembers, lang),
        inline: true
    });
    addFooterFields(embed, filledCount, totalCount, lang);

    // Select menu mode or button mode
    let finalComponents;
    if (isSelectMenuMode(newRolesList.length)) {
        finalComponents = createCustomPartyComponents(newRolesList, ownerId, lang, rolesWithMembers);
    } else {
        const { updateButtonStates } = require('../builders/componentBuilder');
        const components = createCustomPartyComponents(newRolesList, ownerId, lang);
        finalComponents = updateButtonStates(components, rolesWithMembers.map(r => ({
            name: r.role,
            value: r.userId ? `<@${r.userId}>` : EMPTY_SLOT
        })));
    }

    await message.edit({ embeds: [embed], components: finalComponents });
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

    const fields = message.embeds[0].fields;
    const rollerValue = fields.find(f => f.name === 'Roller')?.value || '';
    const genelBilgiler = fields.find(f => f.name === 'Genel Bilgiler')?.value || '';

    // Extract Location and Description
    const placeMatch = genelBilgiler.match(/Çıkış Yeri: (.*)\nAçıklama: (.*)/);
    const content = placeMatch ? placeMatch[1] : '';
    const description = placeMatch ? placeMatch[2] : '';

    const roleRegex = /(?:🔴|🟡) \*\*(.*?):\*\* (?:<@(\d+)>|" ")/g;
    let rolesWithMembers = [];
    let match;
    while ((match = roleRegex.exec(rollerValue)) !== null) {
        rolesWithMembers.push({
            role: match[1],
            userId: match[2] || null
        });
    }

    // Remove the user
    rolesWithMembers = rolesWithMembers.map(r => r.userId === userId ? { ...r, userId: null } : r);
    db.run('UPDATE party_members SET user_id = NULL WHERE party_id = (SELECT id FROM parties WHERE message_id = ?) AND user_id = ?', [message.id, userId]).catch(e => console.error(e));

    const { createPartikurEmbed, buildRolesValue, addFooterFields } = require('../builders/embedBuilder');
    const { updateButtonStates } = require('../builders/componentBuilder');

    const filledCount = rolesWithMembers.filter(r => r.userId).length;
    const totalCount = rolesWithMembers.length;

    const ownerId = interaction.user.id;
    const embed = createPartikurEmbed(message.embeds[0].title, rolesWithMembers.map(r => r.role), description, content, filledCount, guildName, lang, ownerId);
    embed.addFields({
        name: 'Roller',
        value: buildRolesValue(rolesWithMembers, lang),
        inline: true
    });
    addFooterFields(embed, filledCount, totalCount, lang);

    // Select menu mode or button mode
    let newComponents;
    if (isSelectMenuMode(rolesWithMembers.length)) {
        newComponents = createCustomPartyComponents(
            rolesWithMembers.map(r => r.role),
            ownerId,
            lang,
            rolesWithMembers
        );
    } else {
        newComponents = updateButtonStates(message.components, rolesWithMembers.map(r => ({
            name: r.role,
            value: r.userId ? `<@${r.userId}>` : EMPTY_SLOT
        })));
    }

    await message.edit({ embeds: [embed], components: newComponents });
    await interaction.update({ content: lang === 'tr' ? '✅ Kullanıcı çıkarıldı.' : '✅ Member removed.', components: [], flags: [MessageFlags.Ephemeral] });
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

    const oldEmbed = message.embeds[0];
    const fields = oldEmbed.fields;
    const genelBilgiler = fields.find(f => f.name === 'Genel Bilgiler')?.value || '';
    const rollerValue = fields.find(f => f.name === 'Roller')?.value || '';

    // Extract Owner ID
    const ownerMatch = genelBilgiler.match(/<@(\d+)>/);
    const ownerId = ownerMatch ? ownerMatch[1] : null;

    // Extract Location and Description
    const placeMatch = genelBilgiler.match(/Çıkış Yeri: (.*)\nAçıklama: (.*)/);
    const content = placeMatch ? placeMatch[1] : '';
    const description = placeMatch ? placeMatch[2] : '';

    // Parse Roles
    const roleRegex = /(?:🔴|🟡) \*\*(.*?):\*\* (?:<@(\d+)>|" ")/g;
    let rolesWithMembers = [];
    let match;
    while ((match = roleRegex.exec(rollerValue)) !== null) {
        rolesWithMembers.push({
            role: match[1],
            userId: match[2] || null
        });
    }

    // Check if selected slot exists
    if (selectedIndex < 0 || selectedIndex >= rolesWithMembers.length) {
        return await interaction.reply({
            content: `❌ ${t('common.error', lang)}`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    // Check if the selected slot is already filled
    if (rolesWithMembers[selectedIndex].userId && rolesWithMembers[selectedIndex].userId !== userId) {
        return await interaction.reply({
            content: lang === 'tr' ? '❌ Bu rol zaten dolu!' : '❌ This role is already full!',
            flags: [MessageFlags.Ephemeral]
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

    // Reconstruct Embed
    const { createPartikurEmbed, buildRolesValue, addFooterFields } = require('../builders/embedBuilder');
    const filledCount = rolesWithMembers.filter(r => r.userId).length;
    const totalCount = rolesWithMembers.length;

    const newEmbed = createPartikurEmbed(oldEmbed.title, rolesWithMembers.map(r => r.role), description, content, filledCount, guildName, lang, ownerId);
    newEmbed.addFields({
        name: 'Roller',
        value: buildRolesValue(rolesWithMembers, lang),
        inline: true
    });
    addFooterFields(newEmbed, filledCount, totalCount, lang);

    // Regenerate select menu components with updated member state
    const newComponents = createCustomPartyComponents(
        rolesWithMembers.map(r => r.role),
        ownerId,
        lang,
        rolesWithMembers
    );

    await interaction.update({ embeds: [newEmbed], components: newComponents });
}

module.exports = {
    handleManageMenu,
    handleEditModal,
    handleKickMember,
    handleJoinRoleSelect
};
