const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMPTY_SLOT } = require('../constants/constants');
const { updateButtonStates, createClosedButton } = require('../builders/componentBuilder');
const { removeActiveParty } = require('../services/partyManager');
const { getEuropeGuildMembers } = require('../services/albionApiService');
const { createMemberPageEmbed } = require('./commandHandler');
const { createProgressBar } = require('../utils/generalUtils');
const { getGuildConfig } = require('../services/guildConfig');
const { createHelpEmbed, createDonateEmbed } = require('../builders/embedBuilder');
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
            new ButtonBuilder().setCustomId('help_page_1').setLabel(`📊 ${t('help.page_1', lang)}`).setStyle(pageIndex === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_page_2').setLabel(`🛡️ ${t('help.page_2', lang)}`).setStyle(pageIndex === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_page_3').setLabel(`🌐 ${t('help.page_3', lang)}`).setStyle(pageIndex === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
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
        // console.log(`[ButtonHandler] Close request from ${interaction.user.tag} for party owned by ${ownerId}`);

        if (interaction.user.id !== ownerId) {
            return await interaction.reply({
                content: `⛔ **${t('common.only_owner_can_close', lang)}**`,
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

        // console.log(`[ButtonHandler] ✅ Party ${message.id} closed by owner.`);


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

    // ONLY proceed to party join/leave logic if it's a join/leave button
    if (customId === 'leave' || customId.startsWith('join_')) {
        const oldEmbed = message.embeds[0];
        const userId = interaction.user.id;

        let fields = [...oldEmbed.fields];
        const isUserInAnySlot = fields.some(f => f.value.includes(userId));

        // Helper function to check if a slot is empty
        const isEmptySlot = (value) => value === EMPTY_SLOT;

        if (customId === 'leave') {
            fields = fields.map(f => {
                if (f.value.includes(userId)) {
                    return {
                        ...f,
                        name: f.name.replace('🔴', '🟡'),
                        value: EMPTY_SLOT
                    };
                }
                return f;
            });

            // DB SYNC: Remove user from all roles in this party
            db.run('UPDATE party_members SET user_id = NULL WHERE party_id = (SELECT id FROM parties WHERE message_id = ?) AND user_id = ?', [message.id, userId]).catch(e => console.error(e));
        } else if (customId.startsWith('join_')) {
            // If user is already in a slot, leave it first
            if (isUserInAnySlot) {
                fields = fields.map(f => {
                    if (f.value.includes(userId)) {
                        return {
                            ...f,
                            name: f.name.replace('🔴', '🟡'),
                            value: EMPTY_SLOT
                        };
                    }
                    return f;
                });
            }

            let targetIndex = -1;

            if (customId === 'join_tank') {
                targetIndex = fields.findIndex(f => f.name.includes('Tank') && !f.name.includes('👥'));
            } else if (customId === 'join_heal') {
                targetIndex = fields.findIndex(f => f.name.includes('Heal') && !f.name.includes('👥'));
            } else if (customId === 'join_dps') {
                // Find first empty DPS slot
                targetIndex = fields.findIndex(f =>
                    f.name.includes('DPS') &&
                    !f.name.includes('👥') &&
                    isEmptySlot(f.value)
                );
            } else if (customId.startsWith('join_custom_')) {
                const customIndex = parseInt(customId.split('_')[2]);
                // Find the actual field index for custom roles
                let roleCounter = 0;
                for (let i = 0; i < fields.length; i++) {
                    if (!fields[i].name.includes('👥') &&
                        !fields[i].name.includes('📌') &&
                        fields[i].name !== '\u200b' &&
                        !fields[i].name.includes('KURALLAR')) {
                        if (roleCounter === customIndex) {
                            targetIndex = i;
                            break;
                        }
                        roleCounter++;
                    }
                }
            }

            if (targetIndex !== -1) {
                if (isEmptySlot(fields[targetIndex].value)) {
                    fields[targetIndex].value = `<@${userId}>`;
                    fields[targetIndex].name = fields[targetIndex].name.replace('🟡', '🔴');

                    // DB SYNC: Update user in DB
                    const roleName = fields[targetIndex].name.split('. ')[1]?.replace(':', '') || 'Unknown';
                    db.run('INSERT INTO party_members (party_id, user_id, role, status) SELECT id, ?, ?, "joined" FROM parties WHERE message_id = ?', [userId, roleName, message.id]).catch(e => console.error(e));
                } else {
                    return interaction.reply({ content: `❌ ${t('common.error', lang)}`, flags: [MessageFlags.Ephemeral] });
                }
            }
        }

        // Recalculate filled slots for progress bar
        const roleFields = fields.filter(f =>
            !f.name.includes('👥') &&
            !f.name.includes('📌') &&
            f.name !== '\u200b' &&
            !f.name.includes('KURALLAR')
        );
        const filledCount = roleFields.filter(f => !isEmptySlot(f.value)).length;
        const totalCount = roleFields.length;

        const newEmbed = EmbedBuilder.from(oldEmbed)
            .setFields(fields)
            .setFooter({ text: `${t('common.fullness', lang)}: ${createProgressBar(filledCount, totalCount)}` });

        // Re-generate components to update "DOLU" status
        const newComponents = updateButtonStates(message.components, fields);

        await interaction.update({ embeds: [newEmbed], components: newComponents });
    }

}

module.exports = {
    handlePartyButtons
};
