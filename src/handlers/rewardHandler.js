const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { hasUserReceivedReward, getUserOwnedGuilds, claimSupportReward } = require('../services/subscriptionService');
const { logPublicTransaction } = require('../utils/notificationUtils');
const config = require('../config/config');

/**
 * Handles the "Claim Reward" button click in the support server
 */
async function handleClaimRewardButton(interaction) {
    const userId = interaction.user.id;

    // 1. Check if already rewarded
    const alreadyRewarded = await hasUserReceivedReward(userId);
    if (alreadyRewarded) {
        return await interaction.reply({
            content: '❌ **Zaten ödül aldınız!** | **You have already claimed your reward!**\nBu ödül her kullanıcı için sadece bir kez verilebilir.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    // 2. Get owned guilds
    const ownedGuilds = await getUserOwnedGuilds(userId);
    if (!ownedGuilds || ownedGuilds.length === 0) {
        return await interaction.reply({
            content: '❌ **Hata!** | **Error!**\nBotun ekli olduğu ve sahibi olduğunuz bir sunucu bulunamadı. Lütfen önce botu kendi sunucunuza ekleyin.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    // 3. Show selection menu
    const embed = new EmbedBuilder()
        .setTitle('🎁 Destek Sunucusu Ödülü | Support Server Reward')
        .setDescription('Lütfen 30 günlük ödülün tanımlanmasını istediğiniz sunucuyu seçin:')
        .setColor('#5865F2')
        .setFooter({ text: 'Sadece sahibi olduğunuz sunucular listelenir.' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('sub_reward_guild_select')
        .setPlaceholder('Sunucu Seçin / Select Server')
        .addOptions(
            ownedGuilds.map(g => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(g.guild_name || 'Bilinmeyen Sunucu')
                    .setValue(g.guild_id)
                    .setDescription(`ID: ${g.guild_id}`)
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
}

/**
 * Handles the guild selection for the reward
 */
async function handleRewardGuildSelect(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.values[0];
    const guild = ownedGuilds = await getUserOwnedGuilds(userId);
    const selectedGuild = guild.find(g => g.guild_id === guildId);
    
    if (!selectedGuild) {
        return await interaction.reply({ content: '❌ Sunucu bulunamadı.', flags: [MessageFlags.Ephemeral] });
    }

    // Double check reward status to prevent race conditions
    const alreadyRewarded = await hasUserReceivedReward(userId);
    if (alreadyRewarded) {
        return await interaction.update({ content: '❌ Zaten ödül aldınız.', embeds: [], components: [] });
    }

    const success = await claimSupportReward(userId, guildId);

    if (success) {
        // Log transaction
        await logPublicTransaction(
            interaction.client, 
            userId, 
            guildId, 
            selectedGuild.guild_name, 
            'reward', 
            '🎁 Destek sunucusu katılım ödülü (30 Gün) tanımlandı.'
        );

        await interaction.update({
            content: `✅ **İşlem Başarılı!**\n**${selectedGuild.guild_name}** sunucusuna 30 günlük süreniz tanımlanmıştır.\n\nDestek olduğunuz için teşekkürler! 🚀`,
            embeds: [],
            components: []
        });
    } else {
        await interaction.update({
            content: '❌ Ödül tanımlanırken bir hata oluştu. Lütfen bot sahibi ile iletişime geçin.',
            embeds: [],
            components: []
        });
    }
}

/**
 * Handles /setup-reward command (Owner Only)
 */
async function handleSetupRewardCommand(interaction) {
    const isBotOwner = interaction.user.id === config.OWNER_ID;
    if (!isBotOwner) {
        return await interaction.reply({ content: '❌ Bu komutu sadece bot sahibi kullanabilir.', flags: [MessageFlags.Ephemeral] });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎁 Destek Sunucusu Katılım Ödülü | Support Server Join Reward')
        .setDescription(
            'Destek sunucumuza katıldığınız için teşekkür ederiz! 🎉\n\n' +
            'Botumuzu kullandığınız bir sunucunuza **30 günlük ücretsiz süre** tanımlamak için aşağıdaki butona tıklayın.\n\n' +
            '**Not:** Bu ödül her kullanıcı için sadece **bir kez** alınabilir.'
        )
        .setColor('#2ECC71')
        .setThumbnail(interaction.client.user.displayAvatarURL());

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sub_claim_reward')
            .setLabel('🎁 Ödül Al / Claim Reward')
            .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ content: '✅ Kurulum mesajı gönderiliyor...', flags: [MessageFlags.Ephemeral] });
    await interaction.channel.send({ embeds: [embed], components: [row] });
}

module.exports = {
    handleClaimRewardButton,
    handleRewardGuildSelect,
    handleSetupRewardCommand
};
