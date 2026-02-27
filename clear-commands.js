require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🗑️  Tüm komutlar siliniyor...');

        // Guild komutlarını sil
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: [] }
        );

        console.log('✅ Guild komutları silindi!');

        // Global komutları da sil (eğer varsa)
        try {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: [] }
            );
            console.log('✅ Global komutlar silindi!');
        } catch (err) {
            console.log('⚠️  Global komut yok veya silinemedi (normal)');
        }

        console.log('\n🔄 Şimdi botu yeniden başlatın:');
        console.log('   npm start');
        console.log('\nBot başladığında komutlar otomatik olarak yeniden kaydedilecek.');

    } catch (error) {
        console.error('❌ Hata:', error);
    }
})();
