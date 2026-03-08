const { REST, Routes } = require('discord.js');
const config = require('../config/config');

async function clearAllCommands() {
    const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

    try {
        console.log('--- Slash Komutları Temizleme Başlatıldı ---');

        // 1. Temizle: Global Komutlar
        console.log('Global komutlar temizleniyor...');
        await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: [] });
        console.log('✅ Global komutlar temizlendi.');

        // 2. Temizle: Guild Komutları
        if (config.GUILD_ID) {
            console.log(`Guild (${config.GUILD_ID}) komutları temizleniyor...`);
            await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: [] });
            console.log('✅ Guild komutları temizlendi.');
        }

        console.log('--- Temizleme Tamamlandı ---');
    } catch (error) {
        console.error('Temizleme hatası:', error);
    }
}

clearAllCommands();
