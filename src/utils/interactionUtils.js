const { MessageFlags, AttachmentBuilder } = require('discord.js');
const { LOGO_PATH, LOGO_NAME } = require('../constants/constants');

/**
 * Safely replies to an interaction and ALWAYS returns the message object
 */
async function safeReply(interaction, payload) {
    // Automatically add logo file if embeds are present and file is not already there
    if (payload.embeds && payload.embeds.length > 0) {
        if (!payload.files) payload.files = [];
        if (!payload.files.some(f => f.name === LOGO_NAME || (typeof f === 'string' && f.includes(LOGO_NAME)))) {
            payload.files.push(new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME }));
        }
    }

    const options = {
        ...payload,
        allowedMentions: { parse: ['everyone', 'roles', 'users'] }
    };

    let initiated = false;

    try {
        // 1. Send the response and get resource in one go (Modern D.JS v14.14+)
        let response;
        if (interaction.replied || interaction.deferred) {
            response = await interaction.followUp({ ...options, withResponse: true });
        } else {
            response = await interaction.reply({ ...options, withResponse: true });
        }

        initiated = true;
        // withResponse returns an object { resource: Message, ... } or just Message depending on version
        return response.resource || response;

    } catch (error) {
        // Handle Aborted error specifically
        if (error.code === 20 || error.message?.includes('aborted')) {
            console.log('[SafeReply] Operation aborted, attempting fetchReply fallback...');
            try {
                return await interaction.fetchReply();
            } catch (e) {
                if (interaction.replied || interaction.deferred) return null;
            }
        }

        // Final fallback: channel.send ONLY if we haven't initiated a reply yet
        if (!initiated && interaction.channel) {
            try {
                const legacyMsg = await interaction.channel.send(options);
                // console.log('[SafeReply] Fallback successful via channel.send');
                return legacyMsg;
            } catch (sendError) {
                // console.error('[SafeReply] All delivery methods failed.');
            }
        }

        throw error;
    }
}


const { t } = require('../services/i18n');

/**
 * Handles interaction errors - Suppresses transient SSL warnings
 */
async function handleInteractionError(interaction, error, lang = 'tr') {
    const isSslError = error.code === 'ERR_SSL_INVALID_SESSION_ID' ||
        error.message?.includes('SSL') ||
        error.message?.includes('session id');

    // Discord bazen error.code yerine error.errors objesi ile dönüyor
    const errorCode = error.code ?? error.errors?.[0]?.code;

    // Interaction zaman aşımı (10062) veya zaten cevaplanmış (40060) hatalari
    const isUnknownInteraction = error.message?.includes('Unknown interaction') ||
        error.message?.includes('already been acknowledged') ||
        error.message?.includes('Interaction has already been');

    const isIgnorable = isSslError ||
        errorCode === 10062 ||
        errorCode === 40060 ||
        isUnknownInteraction;

    if (isIgnorable) {
        return;
    }

    console.error(`[InteractionError] Real Error: ${error.message} (Code: ${errorCode ?? 'unknown'})`);

    let errorMessage = error.message || t('common.error', lang);
    if (errorCode === 50013) {
        errorMessage = lang === 'en' ? 'Bot lack permissions for this action.' : 'Botun bu işlemi yapmak için yetkisi yok (Yetki Hatası).';
    }

    const responseContent = `❌ **${t('party.error', lang) || t('common.error', lang)}**\n` +
        `**Summary:** ${errorMessage}\n\n` +
        `**✅ Solution:** Check bot permissions for **'Send Messages'**, **'Embed Links'**, and **'Mention @everyone'**.`;

    try {
        const errorOptions = { content: responseContent, flags: [MessageFlags.Ephemeral] };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorOptions).catch(() => { });
        } else {
            await interaction.reply(errorOptions).catch(() => { });
        }
    } catch (err) { }
}


module.exports = {
    safeReply,
    handleInteractionError
};
