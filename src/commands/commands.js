const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('createparty')
        .setDescription('Create a dynamic party recruitment form.'),
    new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Support the bot by voting on Top.gg.'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows bot commands and assistance.'),
    new SlashCommandBuilder()
        .setName('closeparty')
        .setDescription('Manually end your active parties.'),
    new SlashCommandBuilder()
        .setName('members')
        .setDescription('List active guild members from the Europe server.'),
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Display statistics for a specific player.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the player to fetch stats for')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('whitelistadd')
        .setDescription('Add a user to the whitelist (Can create up to 3 parties).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add to the whitelist')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('whitelistremove')
        .setDescription('Remove a user from the whitelist.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remove from the whitelist')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure guild-specific bot settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('premiumadd')
        .setDescription('[Owner] Add a user to the premium list (Skip voting).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add to the premium list')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('premiumremove')
        .setDescription('[Owner] Remove a user from the premium list.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remove from the premium list')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('servers')
        .setDescription('[Owner] Display a list of servers the bot is in.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('subscription')
        .setDescription('[Owner] Manage guild subscriptions.')
        .addSubcommand(sub =>
            sub.setName('ver')
                .setDescription('Add days to guild subscription')
                .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID').setRequired(true))
                .addIntegerOption(opt => opt.setName('gun').setDescription('Days to add').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('durum')
                .setDescription('Check guild subscription status')
                .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('sinirsiz')
                .setDescription('Set guild subscription to unlimited')
                .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID').setRequired(true))
                .addBooleanOption(opt => opt.setName('aktif').setDescription('True for unlimited, False to remove').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // ── Ceza Sistemi ──────────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('ceza')
        .setDescription('Kullanıcıya ceza verir.')
        .addUserOption((opt) =>
            opt.setName('kullanici').setDescription('Ceza verilecek kullanıcı').setRequired(true)
        )
        .addStringOption((opt) =>
            opt.setName('aciklama').setDescription('Ceza açıklaması').setRequired(true).setMaxLength(500)
        )
        .addStringOption((opt) =>
            opt.setName('ucret').setDescription('Ceza ücreti').setRequired(true).setMaxLength(100)
        ),

    new SlashCommandBuilder()
        .setName('ceza-gecmis')
        .setDescription('Kullanıcının ceza geçmişini gösterir.')
        .addUserOption((opt) =>
            opt.setName('kullanici').setDescription('Geçmişi gösterilecek kullanıcı').setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('ceza-ayar')
        .setDescription('Ceza sistemi ayarları')
        .addSubcommand((sub) =>
            sub
                .setName('kanal')
                .setDescription('Ceza kanalını ayarla')
                .addChannelOption((opt) =>
                    opt.setName('kanal').setDescription('Ceza mesajlarının atılacağı kanal').setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('rol')
                .setDescription('Cezalı rolünü ayarla')
                .addRoleOption((opt) =>
                    opt.setName('rol').setDescription('Ceza alınca verilecek rol').setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('yetkili-rol')
                .setDescription('Ceza komutlarını kullanacak yetkili rolünü ayarla')
                .addRoleOption((opt) =>
                    opt.setName('rol').setDescription('Ceza yetkilisi rolü').setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('goster').setDescription('Mevcut ceza ayarlarını gösterir')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    // ─────────────────────────────────────────────────────────────────────────

].map(command => command.toJSON());


module.exports = commands;
