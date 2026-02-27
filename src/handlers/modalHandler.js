const { createPartikurEmbed } = require('../builders/embedBuilder');
const { createCustomPartyComponents } = require('../builders/componentBuilder');
const { safeReply } = require('../utils/interactionUtils');
const { MessageFlags } = require('discord.js');
const { getActivePartyCount, setActiveParty } = require('../services/partyManager');

const { isWhitelisted } = require('../services/whitelistManager');
const { getEuropeGuildMembers } = require('../services/albionApiService');
const db = require('../services/db');
const { getGuildConfig } = require('../services/guildConfig');

async function handlePartiModal(interaction) {
    if (interaction.customId.startsWith('parti_modal:')) {
        const type = interaction.customId.split(':')[1] || 'genel';
        const guildConfig = await getGuildConfig(interaction.guildId);
        const guildName = guildConfig?.guild_name || 'Albion';


        const userId = interaction.user.id;
        const whitelisted = await isWhitelisted(userId, interaction.guildId);
        const partyCount = getActivePartyCount(userId);

        const limit = whitelisted ? 3 : 1;

        if (partyCount >= limit) {
            let errorMsg = whitelisted
                ? `❌ **Limitinize ulaştınız!**\n\nWhite list üyesi olarak en fazla **3** aktif parti açabilirsiniz. Yeni bir parti açmadan önce mevcut partilerinizden birini kapatmalısınız.`
                : `❌ **Zaten aktif bir partiniz var!**\n\nYeni bir parti açmadan önce mevcut partinizi kapatmalısınız. Kapatmak için:\n1️⃣ Mevcut partideki **"Partiyi Kapat"** butonuna basabilir,\n2️⃣ Veya \`/partikapat\` komutunu kullanabilirsiniz.`;

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

        // CREATE PAYLOAD MANUALLY
        const embed = createPartikurEmbed(header, rolesList, description, content, 0, guildName);
        const components = createCustomPartyComponents(rolesList, userId);

        // Add fields to embed based on roles (initial state: empty)
        const fields = [];
        rolesList.forEach((role, index) => {
            fields.push({
                name: `🟡 ${index + 1}. ${role}:`,
                value: '-', // Or use constant for empty slot
                inline: false
            });
        });

        // Since createPartikurEmbed might not add fields (it just sets title/desc/footer), let's ensure fields are added.
        // Checking embedBuilder.js again, createPartikurEmbed does NOT add fields for roles. usage in deleted payloadBuilder must have done it.
        // But createPartikurEmbed returns an EmbedBuilder instance.

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

                // SAVE INITIAL EMPTY MEMBERS (optional but good for tracking roles)
                for (const role of rolesList) {
                    await db.run(
                        'INSERT INTO party_members (party_id, user_id, role, status) VALUES (?, ?, ?, ?)',
                        [partyDbId, null, role, 'joined']
                    );
                }

                // console.log(`[ModalHandler] Registered Log: User ${userId} -> Party ${msgId} (Type: ${type})`);
            } catch (err) {
                console.error('[ModalHandler] DB Error:', err.message);
            }
        } else {
            // console.log(`[ModalHandler] ⚠️ Failed to register party in DB (No ID captured).`);
        }

    }
}

module.exports = {
    handlePartiModal
};
