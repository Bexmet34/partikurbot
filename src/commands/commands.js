const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('partikur')
        .setDescription('Özel bir parti başvurusu oluşturur.'),
    new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Bot komutları ve geliştirici hakkında bilgi verir.'),
    new SlashCommandBuilder()
        .setName('partikapat')
        .setDescription('Aktif partinizi sonlandırır.'),
    new SlashCommandBuilder()
        .setName('uyeler')
        .setDescription('Avrupa sunucusu lonca üyelerini listeler.'),


    new SlashCommandBuilder()
        .setName('player')
        .setDescription('Bir oyuncunun istatistiklerini gösterir.')
        .addStringOption(option =>
            option.setName('isim')
                .setDescription('İstatistikleri görülecek oyuncunun adı')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('wladd')
        .setDescription('Kullanıcıyı beyaz listeye ekler (Maks 3 parti kurabilir).')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Beyaz listeye eklenecek kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('wlremove')
        .setDescription('Kullanıcıyı beyaz listeden çıkarır.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Beyaz listeden çıkarılacak kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ayar')
        .setDescription('Sunucuya özel bot ayarlarını yapılandırır.')
        .addStringOption(option =>
            option.setName('lonca-ismi')
                .setDescription('Loncanızın görünen adı (Örn: Turquoise)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('lonca-id')
                .setDescription('Albion API Guild IDsi (Oyun içi API ID)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

].map(command => command.toJSON());

module.exports = commands;
