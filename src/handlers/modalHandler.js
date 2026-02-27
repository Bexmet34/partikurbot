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
        const content = interaction.fields.getTextInputValue('party_content');
        const rolesRaw = interaction.fields.getTextInputValue('party_roles');
        const description = interaction.fields.getTextInputValue('party_description') || '';

        // Split by newline and filter empty lines
        const rolesList = rolesRaw.split('\n').map(r => r.trim()).filter(r => r.length > 0);

        // CREATE PAYLOAD
        const embed = createPartikurEmbed(header, rolesList, description, content, 0, guildName, lang);
        const components = createCustomPartyComponents(rolesList, userId, lang);

        // Add fields to embed based on roles
        const fields = [];
        rolesList.forEach((role, index) => {
            fields.push({
                name: `🟡 ${index + 1}. ${role}:`,
                value: EMPTY_SLOT,
                inline: false
            });
        });

        embed.addFields(fields);

        const msg = await safeReply(interaction, { content: '@everyone', embeds: [embed], components: components });

        const msgId = msg?.id;
        const chanId = msg?.channelId || interaction.channelId;

        if (msgId) {
            setActiveParty(userId, msgId, chanId);

            // SAVE TO DB
            try {
                const result = await db.run(
                    'INSERT INTO parties (message_id, channel_id, owner_id, type, title) VALUES (?, ?, ?, ?, ?)',
                    [msgId, chanId, userId, type, header]
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
