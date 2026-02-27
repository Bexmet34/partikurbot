require('dotenv').config({ quiet: true });
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 to prevent ENETUNREACH errors on VPS
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const config = require('./config/config');
const fs = require('fs');
const path = require('path');
const { registerCommands } = require('./services/commandRegistration');
const { handleYardimCommand, handlePartikapatCommand, handleUyelerCommand, handleMeCommand, handleWladdCommand, handleWlremoveCommand, handleAyarCommand } = require('./handlers/commandHandler');

const { handlePartikurCommand } = require('./handlers/partikurHandler');
const { handlePartyButtons } = require('./handlers/buttonHandler');
const { handlePartiModal } = require('./handlers/modalHandler');
const { handleInteractionError } = require('./utils/interactionUtils');
const { initDb } = require('./services/db');
const { getGuildConfig } = require('./services/guildConfig');
const { MessageFlags } = require('discord.js');




// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
        // MessageContent intent requires enabling in Discord Developer Portal
        // Go to: https://discord.com/developers/applications
        // Select your bot -> Bot -> Privileged Gateway Intents -> Enable "Message Content Intent"
    ]
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
    console.log('\x1b[32m%s\x1b[0m', `🚀 ${c.user.tag} Aktif!`);
    console.log('\x1b[35m%s\x1b[0m', `🌍 ${c.guilds.cache.size} sunucuda hizmet veriyor.`);
    console.log('\x1b[36m%s\x1b[0m', '-------------------------------------------');

    // Set activity safely
    try {
        client.user.setActivity(config.ACTIVITY_TEXT || '/yardim', { type: ActivityType.Listening });
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
        }
    }
});

client.on('interactionCreate', async interaction => {
    try {
        // Sunucu yapılandırma kontrolü
        if (interaction.guildId) {
            const guildSettings = await getGuildConfig(interaction.guildId);
            const isConfigured = guildSettings && guildSettings.guild_name && guildSettings.albion_guild_id;

            // Eğer ayarlar yapılmamışsa ve kullanılan komut /ayar veya /yardim değilse engelle
            const allowedCommands = ['ayar', 'yardim'];
            if (!isConfigured && interaction.isChatInputCommand() && !allowedCommands.includes(interaction.commandName)) {
                return await interaction.reply({
                    content: '⚠️ **Bot henüz bu sunucu için yapılandırılmamış!**\n\nKomutları kullanabilmek için önce bir yönetici tarafından `/ayar` komutu ile sunucu bilgilerinin (Lonca ismi ve Albion Guild ID) sisteme kaydedilmesi gerekmektedir.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Buton ve Modal koruması (Yardım butonları hariç)
            if (!isConfigured && (interaction.isButton() || interaction.isModalSubmit())) {
                if (interaction.isButton() && interaction.customId.startsWith('help_page_')) {
                    // Yardım butonlarına izin ver
                } else {
                    return await interaction.reply({
                        content: '⚠️ **Hata:** Sunucu ayarları tamamlanmadan bu işlemi yapamazsınız. Lütfen önce `/ayar` komutunu kullanın.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
            }
        }

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'yardim') {
                const { AttachmentBuilder } = require('discord.js');
                const path = require('path');
                const pp = new AttachmentBuilder(path.join(process.cwd(), 'assets/images/partibotpp.png'), { name: 'pp.png' });
                const banner = new AttachmentBuilder(path.join(process.cwd(), 'assets/images/partibotbanner.png'), { name: 'banner.png' });
                await handleYardimCommand(interaction, [pp, banner]);

            } else if (interaction.commandName === 'partikur') {
                await handlePartikurCommand(interaction);
            } else if (interaction.commandName === 'partikapat') {
                await handlePartikapatCommand(interaction);
            } else if (interaction.commandName === 'uyeler') {
                await handleUyelerCommand(interaction);
            } else if (interaction.commandName === 'player') {
                await handleMeCommand(interaction);

            } else if (interaction.commandName === 'wladd') {
                await handleWladdCommand(interaction);
            } else if (interaction.commandName === 'wlremove') {
                await handleWlremoveCommand(interaction);
            } else if (interaction.commandName === 'ayar') {
                await handleAyarCommand(interaction);
            }
        } else if (interaction.isButton()) {
            await handlePartyButtons(interaction);
        } else if (interaction.isModalSubmit()) {
            await handlePartiModal(interaction);
        }
    } catch (error) {
        await handleInteractionError(interaction, error);
    }
});



// Start the bot
startBot();
