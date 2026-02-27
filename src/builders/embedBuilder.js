const { EmbedBuilder } = require('discord.js');
const { NOTLAR_METNI, ROLE_ICONS } = require('../constants/constants');
const config = require('../config/config');


/**
 * Creates a PVE embed
 */
/**
 * Creates a PVE embed
 */
function createEmbed(title, details, content, roles, isClosed = false, guildName = 'Albion') {
    const cleanTitle = title.replace(new RegExp(`^🛡️ ${guildName} \\| `), '').replace(/ \[KAPALI\]$/, '');


    // Build description with better formatting
    let description = `📋 **Detaylar:**\n${details}\n\n`;
    description += `🎯 **İçerik:**\n${content}`;

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} | ${cleanTitle}${isClosed ? ' [KAPALI]' : ''}`)


        .setDescription(description)
        .setColor(isClosed ? '#808080' : '#F1C40F')
        .addFields(
            { name: '👥 **PARTİ KADROSU**', value: '\u200b', inline: false },
            {
                name: `${roles.tank === '-' ? '🟡' : '🔴'} 1. Tank:`,
                value: roles.tank,
                inline: false
            },
            {
                name: `${roles.heal === '-' ? '🟡' : '🔴'} 2. Heal:`,
                value: roles.heal,
                inline: false
            },
            ...roles.dps.map((d, index) => ({
                name: `${d === '-' ? '🟡' : '🔴'} ${index + 3}. DPS:`,
                value: d,
                inline: false
            }))
        );

    if (!isClosed) {
        // Calculate counts for progress bar
        const total = 2 + roles.dps.length;
        const filled = [roles.tank, roles.heal, ...roles.dps].filter(v => v !== '-').length;
        embed.setFooter({ text: `Doluluk: ${createProgressBar(filled, total)}` });
    }

    return embed;
}

const { createProgressBar } = require('../utils/generalUtils');

/**
 * Creates a custom party embed
 */
function createPartikurEmbed(header, rolesList, description = '', content = '', currentCount = 0, guildName = 'Albion') {
    let desc = `📍 **Çıkış Yeri:** ${content}`;
    if (description) {
        desc += `\n\n📝 **Parti Notları:**\n${description}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guildName} | ${header}`)


        .setDescription(desc)
        .setColor('#F1C40F')
        .setFooter({ text: `Doluluk: ${createProgressBar(currentCount, rolesList.length)}` });

    return embed;
}

/**
 * Creates a paginated help embed
 * @param {number} page Page index (0-3)
 * @param {string} guildName Name of the guild
 */
function createHelpEmbed(page = 0, guildName = 'Albion') {
    const embeds = [
        // Page 0: Genel Bakış
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | Yardım Menüsü - Genel`)
            .setColor('#F1C40F')
            .setThumbnail('attachment://pp.png')
            .setDescription(`**${guildName} Content Bot** sunucunuzdaki etkinlik yönetimini kolaylaştırmak için tasarlanmış profesyonel bir araçtır.\n\n` +
                `🔹 **Temel Amaç:** Karmaşık rollerle uğraşmadan hızlıca parti formları oluşturmak ve oyuncu istatistiklerini takip etmek.\n\n` +
                `🔽 Sayfalar arasında geçiş yapmak için aşağıdaki butonları kullanabilirsiniz.`)
            .addFields(
                { name: '📄 Sayfa 1', value: '📊 Komut Listesi', inline: true },
                { name: '📄 Sayfa 2', value: '🛡️ Yönetim & Limitler', inline: true },
                { name: '📄 Sayfa 3', value: '🌐 Bağlantılar', inline: true }
            )
            .setImage('attachment://banner.png')
            .setFooter({ text: 'Sayfa 1/4 • Navigasyon butonlarını kullanın' }),

        // Page 1: Komutlar
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | Komut Listesi`)
            .setColor('#3498DB')
            .setThumbnail('attachment://pp.png')
            .setDescription('Botun sunduğu tüm komutlar ve kullanım amaçları:')
            .addFields(
                { name: '🏗️ `/partikur`', value: 'Dinamik bir form açar. İçerik, çıkış yeri ve özel rolleri belirlemenizi sağlar.' },
                { name: '🔍 `/player [isim]`', value: 'Bir oyuncunun Albion Online (Europe) istatistiklerini döküm halinde getirir.' },
                { name: '👥 `/uyeler`', value: 'Loncanızdaki aktif üyeleri sayfa sayfa listeler.' },
                { name: '⚙️ `/ayar`', value: '**(Yetkili)** Sunucu adını ve Albion Lonca ID\'sini sisteme tanımlar.' },
                { name: 'ℹ️ `/yardim`', value: 'Bu interaktif menüyü açar.' }
            )
            .setImage('attachment://banner.png')
            .setFooter({ text: 'Sayfa 2/4 • Detaylı komut yardımı' }),

        // Page 2: Yönetim & Limitler
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | Yönetim & Limitler`)
            .setColor('#E67E22')
            .setThumbnail('attachment://pp.png')
            .setDescription('Parti yönetimi ve kısıtlamalar hakkında bilmeniz gerekenler:')
            .addFields(
                { name: '🚫 Limitler', value: 'Normal kullanıcılar aynı anda **1** aktif parti kurabilir. Beyaz listedeki kullanıcılar **3** parti açabilir.' },
                { name: '🔑 Whitelist (Beyaz Liste)', value: '`/wladd` ve `/wlremove` komutları ile yetkili kişiler kullanıcılara limit ayrıcalığı verebilir.' },
                { name: '🧹 Temizlik', value: '`/partikapat` komutu veya embed altındaki "Partiyi Kapat" butonu ile aktif partinizi elle sonlandırabilirsiniz.' }
            )
            .setImage('attachment://banner.png')
            .setFooter({ text: 'Sayfa 3/4 • Limit ve Kurallar' }),

        // Page 3: Bağlantılar & Destek
        new EmbedBuilder()
            .setTitle(`🛡️ ${guildName} | Bağlantılar & Destek`)
            .setColor('#2ECC71')
            .setThumbnail('attachment://pp.png')
            .setDescription('Bize ulaşabileceğiniz ve bot hakkında daha fazla bilgi alabileceğiniz adresler:')
            .addFields(
                { name: '🌐 Web Sitesi', value: '`Yakında`', inline: true },
                { name: '💬 Destek Sunucusu', value: '`Yakında`', inline: true },
                { name: '💎 Geliştirici', value: 'Hakkı', inline: true }
            )
            .setImage('attachment://banner.png')
            .setTimestamp()
            .setFooter({ text: 'Sayfa 4/4 • İletişim' })
    ];

    return embeds[page] || embeds[0];
}


module.exports = {
    createEmbed,
    createPartikurEmbed,
    createHelpEmbed,
    createProgressBar
};

