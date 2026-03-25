require('dotenv').config({ quiet: true });
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 to prevent ENETUNREACH errors on VPS
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const config = require('./config/config');
const fs = require('fs');
const path = require('path');
const { registerCommands } = require('./services/commandRegistration');
const { handleHelpCommand, handleClosePartyCommand, handleMembersCommand, handleStatsCommand, handleWhitelistAddCommand, handleWhitelistRemoveCommand, handlePremiumAddCommand, handlePremiumRemoveCommand, handleSettingsCommand } = require('./handlers/commandHandler');

const { handleCreatePartyCommand } = require('./handlers/partikurHandler');

const { handlePartyButtons } = require('./handlers/buttonHandler');
const { handlePartiModal } = require('./handlers/modalHandler');
const { handleManageMenu, handleEditModal, handleKickMember, handleJoinRoleSelect, handleAddMemberSelect, handleAddMemberUserSelect } = require('./handlers/menuHandler');
const { handleSettingsLanguageSelect } = require('./handlers/settingsHandler');
const { handleInteractionError } = require('./utils/interactionUtils');
const { handleCezaButton, handleCezaAyarCommand, handleCezaCommand, handleCezaGecmisCommand } = require('./handlers/cezaHandler');
const { initDb } = require('./services/db');
const { getGuildConfig } = require('./services/guildConfig');
const { MessageFlags } = require('discord.js');
const { t } = require('./services/i18n');





// Create Discord client
const { Partials } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,   // Ceza sistemi: rol/nick işlemleri için
        GatewayIntentBits.DirectMessages, // Ceza sistemi: DM bildirimleri için
        // MessageContent intent requires enabling in Discord Developer Portal
        // Go to: https://discord.com/developers/applications
        // Select your bot -> Bot -> Privileged Gateway Intents -> Enable "Message Content Intent"
    ],
    partials: [Partials.Channel], // DM kanallarını almak için gerekli
});


// Error handling to prevent crashes
client.on('error', async error => {
    if (error.code === 'ERR_SSL_INVALID_SESSION_ID' || error.message.includes('SSL')) {
        setTimeout(startBot, 5000);
    } else {
        console.error('Discord client error:', error);
    }
});

process.on('unhandledRejection', error => {
    if (!error.message?.includes('SSL')) {
        console.error('Sistemsel bir hata oluştu (Promise Rejection):', error);
    }
});

process.on('uncaughtException', error => {
    const fs = require('fs');
    fs.writeFileSync('error.log', `Error: ${error.message}\nStack: ${error.stack}\n`);
    if (!error.message?.includes('SSL')) {
        console.error('Sistemsel bir hata oluştu (Uncaught Exception):', error);
    }
});

// Bot startup function
async function startBot() {
    try {
        await initDb();
        await client.login(config.DISCORD_TOKEN);


    } catch (error) {
        console.error('Bot login error:', error);
        setTimeout(startBot, 5000);
    }
}

// Client ready event
client.once('clientReady', async (c) => {
    console.log('\x1b[36m%s\x1b[0m', '-------------------------------------------');
    console.log('\x1b[32m%s\x1b[0m', `🚀 ${c.user.tag} Online! (${new Date().toLocaleTimeString()})`);
    console.log('\x1b[35m%s\x1b[0m', `🌍 Service active on ${c.guilds.cache.size} servers.`);
    console.log('\x1b[36m%s\x1b[0m', '-------------------------------------------');


    // Set activity safely
    try {
        client.user.setActivity(config.ACTIVITY_TEXT || '/help', { type: ActivityType.Listening });
    } catch (err) {

        // Silently fail activity set
    }

    registerCommands(client);




    // Güncelleme Bildirimi Kontrolü
    const updateFilePath = path.join(process.cwd(), '.update_success');
    if (fs.existsSync(updateFilePath)) {
        try {
            const ownerId = config.WHITELIST_USERS[0];
            if (ownerId) {
                const owner = await client.users.fetch(ownerId);
                if (owner) {
                    await owner.send('🚀 **Bot Başarıyla Güncellendi!**\nGitHub\'dan en son değişiklikler çekildi ve bot yeniden başlatıldı. Sistem şu an aktif.');
                    console.log(`[Bildirim] Güncelleme mesajı ${owner.tag} kullanıcısına gönderildi.`);
                }
            }
            fs.unlinkSync(updateFilePath); // Dosyayı sil
        } catch (err) {
            console.error('[Bildirim] Güncelleme mesajı gönderilirken hata:', err);
            console.error(t('bot.update_notification_error', defaultLang), err);
        }
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.guildId) {
            const guildSettings = await getGuildConfig(interaction.guildId);
            const lang = guildSettings?.language || 'tr';

            // No longer checking globally for Albion configuration. 
            // Individual commands will check for their required settings.
        }

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'help') {
                await handleHelpCommand(interaction);
            } else if (interaction.commandName === 'createparty') {
                await handleCreatePartyCommand(interaction);
            } else if (interaction.commandName === 'closeparty') {
                await handleClosePartyCommand(interaction);
            } else if (interaction.commandName === 'members') {
                await handleMembersCommand(interaction);
            } else if (interaction.commandName === 'stats') {
                await handleStatsCommand(interaction);
            } else if (interaction.commandName === 'whitelistadd') {
                await handleWhitelistAddCommand(interaction);
            } else if (interaction.commandName === 'whitelistremove') {
                await handleWhitelistRemoveCommand(interaction);
            } else if (interaction.commandName === 'premiumadd') {
                await handlePremiumAddCommand(interaction);
            } else if (interaction.commandName === 'premiumremove') {
                await handlePremiumRemoveCommand(interaction);
            } else if (interaction.commandName === 'settings') {
                await handleSettingsCommand(interaction);
            } else if (interaction.commandName === 'ceza') {
                await handleCezaCommand(interaction);
            } else if (interaction.commandName === 'ceza-gecmis') {
                await handleCezaGecmisCommand(interaction);
            } else if (interaction.commandName === 'ceza-ayar') {
                await handleCezaAyarCommand(interaction);
            }
        } else if (interaction.isButton()) {
            // Önce ceza butonunu kontrol et
            const wasCezaButton = await handleCezaButton(interaction, client);
            if (!wasCezaButton) {
                await handlePartyButtons(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('manage_party_')) {
                await handleManageMenu(interaction);
            } else if (interaction.customId.startsWith('join_role_')) {
                await handleJoinRoleSelect(interaction);
            } else if (interaction.customId.startsWith('kick_member_')) {
                await handleKickMember(interaction);
            } else if (interaction.customId.startsWith('add_member_select_')) {
                await handleAddMemberSelect(interaction);
            } else if (interaction.customId === 'settings_lang_select') {
                await handleSettingsLanguageSelect(interaction);
            }
        } else if (interaction.isUserSelectMenu()) {
            if (interaction.customId.startsWith('add_member_user_select_')) {
                await handleAddMemberUserSelect(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('edit_party_modal:')) {
                await handleEditModal(interaction);
            } else if (interaction.customId.startsWith('add_member_modal:')) {
                const { handleAddMemberModal } = require('./handlers/modalHandler');
                await handleAddMemberModal(interaction);
            } else {
                await handlePartiModal(interaction);
            }
        }
    } catch (error) {
        const guildSettings = await getGuildConfig(interaction.guildId);
        const lang = guildSettings?.language || 'tr';
        await handleInteractionError(interaction, error, lang);
    }

});



// Start the bot
startBot();
