const { MessageFlags, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder } = require('discord.js');
const { getActivePartyCount } = require('../services/partyManager');
const { isWhitelisted } = require('../services/whitelistManager');
/**
 * Handles /partikur command
 * Shows modal directly without duration selection
 */
async function handlePartikurCommand(interaction) {
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

    const modal = new ModalBuilder()
        .setCustomId('parti_modal:genel') // Default to 'genel' or something neutral
        .setTitle('Parti Oluştur');

    const headerInput = new TextInputBuilder()
        .setCustomId('party_header')
        .setLabel('Parti Başlığı')
        .setPlaceholder('Başlığı giriniz')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('party_content')
        .setLabel('İçerik Başlangıç Yeri')
        .setPlaceholder('Örn: Berylo, Lymhurst, Fort Sterling...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const rolesInput = new TextInputBuilder()
        .setCustomId('party_roles')
        .setLabel('Roller')
        .setPlaceholder('Tank\nHeal\nDPS\n(Her satıra bir rol)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('party_description')
        .setLabel('Parti Açıklaması / Notlar')
        .setPlaceholder('Örn: T6-7 ayar. Kalite 4 ve üzeri haritalara gidicez.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(headerInput),
        new ActionRowBuilder().addComponents(contentInput),
        new ActionRowBuilder().addComponents(rolesInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
}

// Deprecated func kept for safety, but unused
async function handleDurationButton(interaction) {
    return false;
}

module.exports = {
    handleDurationButton,
    handlePartikurCommand
};
