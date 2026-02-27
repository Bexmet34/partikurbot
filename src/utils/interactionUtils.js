const { MessageFlags } = require('discord.js');

/**
 * Safely replies to an interaction and ALWAYS returns the message object
 */
async function safeReply(interaction, payload) {
    const options = {
        ...payload,
        allowedMentions: { parse: ['everyone', 'roles', 'users'] }
    };

    try {
        // 1. Send the response
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(options);
        } else {
            await interaction.reply(options);
        }

        // 2. Fetch and return the actual message object (for ID and Channel ID)
        // This is the most reliable way in discord.js v14
        const message = await interaction.fetchReply();
        console.log(`[SafeReply] Message captured: ${message.id}`);
        return message;

    } catch (error) {
        const isSsl = error.code === 'ERR_SSL_INVALID_SESSION_ID' ||
            error.message?.includes('SSL') ||
            error.message?.includes('session id');

        if (isSsl) {
            console.log('[SafeReply] SSL/Transient error, attempting fetchReply fallback...');
            try {
                // If the message was actually sent but errored during return
                return await interaction.fetchReply();
            } catch (e) {
                console.log('[SafeReply] fetchReply fallback failed, trying channel.send...');
            }
        }

        // Final fallback: channel.send
        if (interaction.channel) {
            try {
                const legacyMsg = await interaction.channel.send(options);
                console.log('[SafeReply] Fallback successful via channel.send');
                return legacyMsg;
            } catch (sendError) {
                console.error('[SafeReply] All delivery methods failed.');
            }
        }

        throw error;
    }
}

/**
 * Handles interaction errors - Suppresses transient SSL warnings
 */
async function handleInteractionError(interaction, error) {
    const isSslError = error.code === 'ERR_SSL_INVALID_SESSION_ID' ||
        error.message?.includes('SSL') ||
        error.message?.includes('session id');

    if (isSslError) {
        console.log(`[InteractionError] SSL Session Error suppressed. Bot continues.`);
        return;
    }

    console.error(`[InteractionError] Real Error: ${error.message} (Code: ${error.code})`);

    let errorMessage = error.message || 'Bilinmeyen bir hata';
    if (error.code === 50013) {
        errorMessage = "Botun bu işlemi yapmak için yetkisi yok (Yetki Hatası).";
    }

    const responseContent = `❌ **Bu komutu çalıştırırken bir hata oluştu!**\n` +
        `**Hata Özeti:** ${errorMessage}\n\n` +
        `**✅ Çözüm:** Botun sunucudaki rolüne **'Mesaj Gönder'**, **'Link Yerleştir'** ve özellikle **'Herkesten Bahset' (@everyone)** yetkilerini verin.`;

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
