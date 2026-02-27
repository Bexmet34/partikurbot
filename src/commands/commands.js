const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('createparty')
        .setDescription('Create a dynamic party recruitment form.'),
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
        .addStringOption(option =>
            option.setName('guild-name')
                .setDescription('Your guild name display (e.g., Turquoise)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('guild-id')
                .setDescription('Albion API Guild ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Language for the bot (Turkish or English)')
                .addChoices(
                    { name: 'Türkçe', value: 'tr' },
                    { name: 'English', value: 'en' }
                )
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(command => command.toJSON());


module.exports = commands;
