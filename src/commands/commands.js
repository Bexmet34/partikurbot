const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('createparty')
        .setDescription('Create a dynamic party recruitment form.'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows bot commands and assistance.'),
    new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Support the bot by voting on Top.gg.'),
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
        .setName('temp')
        .setDescription('Create a party using ready-made templates.')
        .addStringOption(option => 
            option.setName('template')
                .setDescription('Select the template you want to use')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    new SlashCommandBuilder()
        .setName('servers')
        .setDescription('[Owner] Display a list of servers the bot is in.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('subscription')
        .setDescription('[Owner] Manage guild subscriptions.')
        .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('cleanup-manual')
        .setDescription('[Owner Only] Manually trigger server cleanup.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

].map(command => command.toJSON());


module.exports = commands;
