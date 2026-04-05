const { createPartikurEmbed } = require('../builders/embedBuilder');
const { createCustomPartyComponents } = require('../builders/componentBuilder');
const { safeReply } = require('../utils/interactionUtils');
const { MessageFlags } = require('discord.js');
const { getActivePartyCount, setActiveParty } = require('../services/partyManager');
const { isWhitelisted } = require('../services/whitelistManager');
const db = require('../services/db');
const { getGuildConfig } = require('../services/guildConfig');
const { t } = require('../services/i18n');
const { EMPTY_SLOT } = require('../constants/constants');


async function handlePartiModal(interaction) {
    if (interaction.customId.startsWith('parti_modal:')) {
        const type = interaction.customId.split(':')[1] || 'genel';
        const guildConfig = await getGuildConfig(interaction.guildId);
        const lang = guildConfig?.language || 'tr';
        const guildName = guildConfig?.guild_name || 'Albion';

        const userId = interaction.user.id;
        const whitelisted = await isWhitelisted(userId, interaction.guildId);
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

        const header = interaction.fields.getTextInputValue('party_header');
        const rolesRaw = interaction.fields.getTextInputValue('party_roles');
        const description = interaction.fields.getTextInputValue('party_description') || '';

        // Split by newline and filter empty lines
        const rolesList = rolesRaw.split('\n')
            .map(r => r.trim())
            .filter(r => r.length > 0);

        // CREATE PAYLOAD
        const { buildRolesFields, addFooterFields } = require('../builders/embedBuilder');
        const embed = createPartikurEmbed(header, rolesList, description, '', 0, interaction.guild, lang, userId);
        const rolesWithMembers = rolesList.map(role => ({ role, userId: null }));
        const components = createCustomPartyComponents(rolesList, userId, lang, rolesWithMembers);
        
        embed.addFields(...buildRolesFields(rolesWithMembers, lang, interaction.guild));


        const actualRoles = rolesList.filter(r => !r.startsWith('#HEADER:') && !r.startsWith('#'));
        addFooterFields(embed, 0, actualRoles.length, lang);

        const msg = await safeReply(interaction, { content: '@everyone', embeds: [embed], components: components });

        const msgId = msg?.id;
        const chanId = msg?.channelId || interaction.channelId;

        if (msgId) {
            setActiveParty(userId, msgId, chanId);

            // Informational vote reminder
            await interaction.followUp({
                content: t('vote.info_reminder', lang),
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });

            // SAVE TO DB
            try {
                const result = await db.run(
                    'INSERT INTO parties (message_id, channel_id, owner_id, type, title, party_time) VALUES (?, ?, ?, ?, ?, ?)',
                    [msgId, chanId, userId, type, header, null]
                );
                const partyDbId = result.lastID;

                for (const role of rolesList) {
                    await db.run(
                        'INSERT INTO party_members (party_id, user_id, role, status) VALUES (?, ?, ?, ?)',
                        [partyDbId, null, role, 'joined']
                    );
                }
            } catch (err) {
                console.error('[ModalHandler] DB Error:', err.message);
            }
        }
    }
}


module.exports = {
    handlePartiModal
};
