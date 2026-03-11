const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');

const {
    getGuildSettings,
    updateGuildSettings,
    createCase,
    updateCase,
    getCaseById,
    getCasesByUser,
    getActiveCasesByUser,
} = require('../services/cezaDB');

/* ====================================================
   YARDIMCILAR
==================================================== */

const CEZALI_PREFIX = 'Cezalı | ';

function caseIdUret() {
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `CZ-${Date.now()}-${rand}`;
}

function makeNick(baseName) {
    const full = `${CEZALI_PREFIX}${baseName}`;
    return full.length > 32 ? full.slice(0, 32) : full;
}

function stripPrefix(name = '') {
    if (name.startsWith(CEZALI_PREFIX)) {
        return name.slice(CEZALI_PREFIX.length).trim();
    }
    return name;
}

function formatStatus(status) {
    if (status === 'paid') return 'Ödendi ✅';
    if (status === 'cancelled') return 'İptal ❌';
    return 'Ödenmedi ❌';
}

function buildCezaEmbed({ caseId, userId, moderatorId, aciklama, ucret, status, paidBy = null, paidAt = null }) {
    const paidText =
        status === 'paid'
            ? `Ödendi ✅${paidBy ? `\nOnaylayan: <@${paidBy}>` : ''}${paidAt ? `\nTarih: <t:${Math.floor(new Date(paidAt).getTime() / 1000)}:F>` : ''}`
            : 'Ödenmedi ❌';

    return new EmbedBuilder()
        .setColor(status === 'paid' ? 0x22c55e : 0xef4444)
        .setTitle(status === 'paid' ? '✅ Ceza Ödendi' : '🔨 Yeni Ceza')
        .setDescription(`<@${userId}> kullanıcısına ceza uygulandı.`)
        .addFields(
            { name: 'Ceza No', value: `\`${caseId}\``, inline: true },
            { name: 'Kullanıcı', value: `<@${userId}>`, inline: true },
            { name: 'Yetkili', value: `<@${moderatorId}>`, inline: true },
            { name: 'Açıklama', value: aciklama, inline: false },
            { name: 'Ücret', value: ucret, inline: true },
            { name: 'Durum', value: paidText, inline: true }
        )
        .setTimestamp();
}

function buildUserDMEmbed({ caseId, moderatorId, aciklama, ucret }) {
    return new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('📩 Hakkınızda Ceza Kaydı Oluşturuldu')
        .setDescription('Sunucuda hakkınızda bir ceza işlemi oluşturuldu.')
        .addFields(
            { name: 'Ceza No', value: `\`${caseId}\`` },
            { name: 'Açıklama', value: aciklama },
            { name: 'Ücret', value: ucret, inline: true },
            { name: 'Yetkili', value: `<@${moderatorId}>`, inline: true }
        )
        .setTimestamp();
}

function buildPaidDMEmbed({ caseId, paidBy }) {
    return new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('✅ Cezanız Kapatıldı')
        .setDescription(`\`${caseId}\` numaralı ceza ödendi olarak işaretlendi.`)
        .addFields({ name: 'Onaylayan', value: `<@${paidBy}>` })
        .setTimestamp();
}

function buildPayButton(caseId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ceza_odendi:${caseId}`)
            .setLabel(disabled ? 'Ödendi' : 'Ödendi Olarak İşaretle')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

function yetkiVarMi(interaction, settings) {
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const yetkiliRoleId = settings?.yetkiliRoleId;
    const hasYetkiliRole = yetkiliRoleId && interaction.member.roles.cache.has(yetkiliRoleId);
    return isOwner || isAdmin || hasYetkiliRole;
}

function ayarlarHazirMi(settings) {
    return !!(settings?.cezaChannelId && settings?.cezaliRoleId && settings?.yetkiliRoleId);
}

/* ====================================================
   BUTON HANDLER
==================================================== */

async function handleCezaButton(interaction, client) {
    if (!interaction.customId.startsWith('ceza_odendi:')) return false;

    if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Bu buton sadece sunucuda kullanılabilir.', ephemeral: true });
        return true;
    }

    const caseId = interaction.customId.split(':')[1];
    const cezaKaydi = getCaseById(caseId);

    if (!cezaKaydi) {
        await interaction.reply({ content: 'Ceza kaydı bulunamadı.', ephemeral: true });
        return true;
    }

    if (cezaKaydi.guildId !== interaction.guild.id) {
        await interaction.reply({ content: 'Bu ceza bu sunucuya ait değil.', ephemeral: true });
        return true;
    }

    const settings = getGuildSettings(interaction.guild.id);

    if (!yetkiVarMi(interaction, settings)) {
        await interaction.reply({ content: 'Bu butonu kullanmaya yetkin yok.', ephemeral: true });
        return true;
    }

    if (cezaKaydi.status === 'paid') {
        await interaction.reply({ content: 'Bu ceza zaten ödenmiş.', ephemeral: true });
        return true;
    }

    const updated = updateCase(caseId, (old) => ({
        ...old,
        status: 'paid',
        paidBy: interaction.user.id,
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));

    const updatedEmbed = buildCezaEmbed({
        caseId: updated.caseId,
        userId: updated.userId,
        moderatorId: updated.moderatorId,
        aciklama: updated.reason,
        ucret: updated.fee,
        status: updated.status,
        paidBy: updated.paidBy,
        paidAt: updated.paidAt,
    });

    await interaction.update({
        embeds: [updatedEmbed],
        components: [buildPayButton(caseId, true)],
    });

    const member = await interaction.guild.members.fetch(updated.userId).catch(() => null);
    const cezaRole = interaction.guild.roles.cache.get(settings.cezaliRoleId);

    const kalanAktifler = getActiveCasesByUser(interaction.guild.id, updated.userId).filter(
        (x) => x.caseId !== caseId
    );

    if (member && kalanAktifler.length === 0) {
        try {
            if (cezaRole && member.roles.cache.has(cezaRole.id)) {
                await member.roles.remove(cezaRole, `Ceza ödendi: ${caseId}`);
            }
        } catch (e) {
            console.error('[CezaHandler] Rol kaldırma hatası:', e);
        }

        try {
            if (updated.originalNickname !== undefined) {
                await member.setNickname(updated.originalNickname, `Ceza ödendi, eski nick geri yüklendi: ${caseId}`);
            } else {
                await member.setNickname(stripPrefix(member.displayName), `Prefix kaldırıldı: ${caseId}`);
            }
        } catch (e) {
            console.error('[CezaHandler] Nick geri alma hatası:', e);
        }
    }

    try {
        const user = await client.users.fetch(updated.userId);
        await user.send({ embeds: [buildPaidDMEmbed({ caseId: updated.caseId, paidBy: interaction.user.id })] });
    } catch {
        // DM kapalıysa geç
    }

    return true;
}

/* ====================================================
   KOMUT HANDLER'LARI
==================================================== */

async function handleCezaAyarCommand(interaction) {
    if (
        interaction.user.id !== interaction.guild.ownerId &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
        return interaction.reply({
            content: 'Sadece sunucu sahibi veya admin bu ayarı yapabilir.',
            ephemeral: true,
        });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'kanal') {
        const kanal = interaction.options.getChannel('kanal', true);
        updateGuildSettings(interaction.guild.id, { cezaChannelId: kanal.id });
        return interaction.reply({ content: `Ceza kanalı ${kanal} olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'rol') {
        const rol = interaction.options.getRole('rol', true);
        updateGuildSettings(interaction.guild.id, { cezaliRoleId: rol.id });
        return interaction.reply({ content: `Cezalı rolü <@&${rol.id}> olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'yetkili-rol') {
        const rol = interaction.options.getRole('rol', true);
        updateGuildSettings(interaction.guild.id, { yetkiliRoleId: rol.id });
        return interaction.reply({ content: `Ceza yetkili rolü <@&${rol.id}> olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'goster') {
        const settings = getGuildSettings(interaction.guild.id);
        const embed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle('⚙️ Ceza Sistemi Ayarları')
            .addFields(
                { name: 'Ceza Kanalı', value: settings.cezaChannelId ? `<#${settings.cezaChannelId}>` : 'Ayarlanmadı', inline: true },
                { name: 'Cezalı Rolü', value: settings.cezaliRoleId ? `<@&${settings.cezaliRoleId}>` : 'Ayarlanmadı', inline: true },
                { name: 'Yetkili Rolü', value: settings.yetkiliRoleId ? `<@&${settings.yetkiliRoleId}>` : 'Ayarlanmadı', inline: true }
            )
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleCezaCommand(interaction) {
    const settings = getGuildSettings(interaction.guild.id);

    if (!ayarlarHazirMi(settings)) {
        return interaction.reply({
            content:
                'Ceza sistemi ayarları eksik.\nÖnce şunları ayarla:\n' +
                '`/ceza-ayar kanal`\n' +
                '`/ceza-ayar rol`\n' +
                '`/ceza-ayar yetkili-rol`',
            ephemeral: true,
        });
    }

    if (!yetkiVarMi(interaction, settings)) {
        return interaction.reply({ content: 'Bu komutu kullanmaya yetkin yok.', ephemeral: true });
    }

    const user = interaction.options.getUser('kullanici', true);
    const aciklama = interaction.options.getString('aciklama', true);
    const ucret = interaction.options.getString('ucret', true);

    if (user.bot) {
        return interaction.reply({ content: 'Botlara ceza veremezsin.', ephemeral: true });
    }

    if (user.id === interaction.user.id) {
        return interaction.reply({ content: 'Kendine ceza veremezsin.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
        return interaction.reply({ content: 'Kullanıcı sunucuda bulunamadı.', ephemeral: true });
    }

    const cezaChannel = interaction.guild.channels.cache.get(settings.cezaChannelId);
    const cezaRole = interaction.guild.roles.cache.get(settings.cezaliRoleId);

    if (!cezaChannel || !cezaChannel.isTextBased()) {
        return interaction.reply({ content: 'Ayarlı ceza kanalı bulunamadı veya yazılabilir kanal değil.', ephemeral: true });
    }

    if (!cezaRole) {
        return interaction.reply({ content: 'Ayarlı cezalı rolü bulunamadı.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const caseId = caseIdUret();
    const originalNickname = member.nickname ?? null;

    let roleAdded = false;
    let nickUpdated = false;
    let dmSent = false;

    try {
        if (!member.roles.cache.has(cezaRole.id)) {
            await member.roles.add(cezaRole, `Ceza verildi: ${caseId}`);
        }
        roleAdded = true;
    } catch (e) {
        console.error('[CezaHandler] Rol ekleme hatası:', e);
    }

    try {
        if (!member.displayName.startsWith(CEZALI_PREFIX)) {
            await member.setNickname(makeNick(member.displayName), `Ceza verildi: ${caseId}`);
        }
        nickUpdated = true;
    } catch (e) {
        console.error('[CezaHandler] Nick değiştirme hatası:', e);
    }

    const embed = buildCezaEmbed({ caseId, userId: user.id, moderatorId: interaction.user.id, aciklama, ucret, status: 'active' });
    const row = buildPayButton(caseId, false);

    const msg = await cezaChannel.send({ content: `${user}`, embeds: [embed], components: [row] });

    createCase({
        caseId,
        guildId: interaction.guild.id,
        channelId: cezaChannel.id,
        messageId: msg.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason: aciklama,
        fee: ucret,
        status: 'active',
        originalNickname,
        paidBy: null,
        paidAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    try {
        await user.send({ embeds: [buildUserDMEmbed({ caseId, moderatorId: interaction.user.id, aciklama, ucret })] });
        dmSent = true;
    } catch {
        dmSent = false;
    }

    const aktifSayisi = getActiveCasesByUser(interaction.guild.id, user.id).length;

    return interaction.editReply({
        content:
            `Ceza başarıyla oluşturuldu.\n` +
            `Ceza No: \`${caseId}\`\n` +
            `Aktif ceza sayısı: **${aktifSayisi}**\n` +
            `Rol eklendi: **${roleAdded ? 'Evet' : 'Hayır'}**\n` +
            `Nick güncellendi: **${nickUpdated ? 'Evet' : 'Hayır'}**\n` +
            `DM gönderildi: **${dmSent ? 'Evet' : 'Hayır'}**`,
    });
}

async function handleCezaGecmisCommand(interaction) {
    const settings = getGuildSettings(interaction.guild.id);

    if (!yetkiVarMi(interaction, settings)) {
        return interaction.reply({ content: 'Bu komutu kullanmaya yetkin yok.', ephemeral: true });
    }

    const user = interaction.options.getUser('kullanici', true);
    const history = getCasesByUser(interaction.guild.id, user.id);

    if (!history.length) {
        return interaction.reply({ content: `${user} için kayıtlı ceza geçmişi bulunamadı.`, ephemeral: true });
    }

    const lines = history.slice(0, 10).map((c, i) => {
        return (
            `**${i + 1}.** \`${c.caseId}\`\n` +
            `Durum: ${formatStatus(c.status)}\n` +
            `Yetkili: <@${c.moderatorId}>\n` +
            `Ücret: ${c.fee}\n` +
            `Açıklama: ${c.reason}\n` +
            `Tarih: <t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:F>`
        );
    });

    const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`📚 Ceza Geçmişi - ${user.tag}`)
        .setDescription(lines.join('\n\n'))
        .setFooter({
            text: history.length > 10
                ? `Toplam ${history.length} kayıt var. İlk 10 gösterildi.`
                : `Toplam ${history.length} kayıt.`,
        })
        .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
    handleCezaButton,
    handleCezaAyarCommand,
    handleCezaCommand,
    handleCezaGecmisCommand,
};
