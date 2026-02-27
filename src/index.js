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
        console.log('[Sistem] Veritabanı hazır.');
        await client.login(config.DISCORD_TOKEN);
        console.log('[Sistem] Discord bağlantısı kuruldu, hazır olması bekleniyor...');
    } catch (error) {
        console.error('Bot login error:', error);
        setTimeout(startBot, 5000);
    }
}

// Client ready event
client.once('ready', async () => {
    console.log(`[Bot] ${client.user.tag} tam anlamıyla aktif!`);

    // Set activity safely with a small delay and error handling
    setTimeout(() => {
        try {
            client.user.setActivity(config.ACTIVITY_TEXT, { type: ActivityType.Listening });
            console.log(`[Bot] Durum güncellendi: ${config.ACTIVITY_TEXT}`);
        } catch (err) {
            console.warn('[Bot] Durum ayarlanırken Shard hatası oluştu, önemsemiyorum.');
        }
    }, 2000);

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
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'yardim') {
                await handleYardimCommand(interaction);
            } else if (interaction.commandName === 'partikur') {
                await handlePartikurCommand(interaction);
            } else if (interaction.commandName === 'partikapat') {
                await handlePartikapatCommand(interaction);
            } else if (interaction.commandName === 'uyeler') {
                await handleUyelerCommand(interaction);
            } else if (interaction.commandName === 'me') {
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
