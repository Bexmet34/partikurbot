const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { EMPTY_SLOT, ROLE_ICONS } = require('../constants/constants');
const { t } = require('../services/i18n');


/**
 * Creates PVE action buttons
 */
function createPveButtons(ownerId, lang = 'tr') {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('join_tank').setLabel('Tank').setEmoji(ROLE_ICONS.TANK).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('join_heal').setLabel('Heal').setEmoji(ROLE_ICONS.HEAL).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('join_dps').setLabel('DPS').setEmoji(ROLE_ICONS.DPS).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('leave').setLabel(t('common.leave', lang)).setStyle(ButtonStyle.Secondary)
        );

    const manageMenu = new StringSelectMenuBuilder()
        .setCustomId(`manage_party_${ownerId}`)
        .setPlaceholder(lang === 'tr' ? '⚙️ Partiyi Yönet' : '⚙️ Manage Party')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel(lang === 'tr' ? 'Partiyi Düzenle' : 'Edit Party').setValue('edit_party').setEmoji('📝'),
            new StringSelectMenuOptionBuilder().setLabel(lang === 'tr' ? 'Katılımcı Yönetimi' : 'Member Management').setValue('manage_members').setEmoji('👥'),
            new StringSelectMenuOptionBuilder().setLabel(lang === 'tr' ? 'Partiyi Kapat' : 'Close Party').setValue('close_party').setEmoji('🔒')
        );

    return [row1, new ActionRowBuilder().addComponents(manageMenu)];
}

/**
 * Creates custom party buttons based on roles
 */
function createCustomPartyComponents(rolesList, ownerId, lang = 'tr') {
    const rows = [];
    let currentRow = new ActionRowBuilder();

    rolesList.forEach((role, index) => {
        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
        if (rows.length < 4) {
            let label = role;
            if (label.length > 80) label = label.substring(0, 77) + "...";
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_custom_${index}`)
                    .setLabel(label)
                    .setStyle(ButtonStyle.Primary)
            );
        }
    });

    if (currentRow.components.length > 0) rows.push(currentRow);

    const leaveBtn = new ButtonBuilder().setCustomId('leave').setLabel(t('common.leave', lang)).setStyle(ButtonStyle.Secondary);

    // Add leave button to the roles rows if there's space, or a new row
    let lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.components.length < 5) {
        lastRow.addComponents(leaveBtn);
    } else {
        rows.push(new ActionRowBuilder().addComponents(leaveBtn));
    }

    // Add Management Menu
    const manageMenu = new StringSelectMenuBuilder()
        .setCustomId(`manage_party_${ownerId}`)
        .setPlaceholder(lang === 'tr' ? '⚙️ Partiyi Yönet' : '⚙️ Manage Party')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(lang === 'tr' ? 'Partiyi Düzenle' : 'Edit Party')
                .setDescription(lang === 'tr' ? 'Başlık, açıklama ve rolleri günceller' : 'Updates title, description and roles')
                .setValue('edit_party')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel(lang === 'tr' ? 'Katılımcı Yönetimi' : 'Member Management')
                .setDescription(lang === 'tr' ? 'Kullanıcıları rolden çıkar veya taşı' : 'Remove or move users')
                .setValue('manage_members')
                .setEmoji('👥'),
            new StringSelectMenuOptionBuilder()
                .setLabel(lang === 'tr' ? 'Partiyi Kapat' : 'Close Party')
                .setDescription(lang === 'tr' ? 'Partiyi sonlandırır ve başvuruları durdurur' : 'Ends the party and stops applications')
                .setValue('close_party')
                .setEmoji('🔒')
        );

    rows.push(new ActionRowBuilder().addComponents(manageMenu));

    return rows;
}

/**
 * Creates closed party button
 */
function createClosedButton(lang = 'tr') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('closed').setLabel(t('common.party_closed_label', lang)).setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
}


/**
 * Updates button states based on field availability
 */
function updateButtonStates(oldComponents, newFields) {
    const rows = [];
    const isEmptySlot = (value) => value === '-' || value.includes(EMPTY_SLOT);

    for (const oldRow of oldComponents) {
        const newRow = new ActionRowBuilder();

        // Handle Select Menu Rows (keep them unchanged)
        const firstComponent = oldRow.components[0];
        if (firstComponent && (firstComponent.data.type === 3 || firstComponent.data.type === 'STRING_SELECT' || firstComponent.constructor.name.includes('Select'))) {
            newRow.addComponents(firstComponent);
            rows.push(newRow);
            continue;
        }

        for (const component of oldRow.components) {
            const btn = ButtonBuilder.from(component);
            const customId = btn.data.custom_id;
            let isFull = false;

            if (customId === 'join_tank') {
                const tankField = newFields.find(f => f.name.includes('Tank'));
                if (tankField && !isEmptySlot(tankField.value)) isFull = true;
                btn.setLabel('Tank').setEmoji(ROLE_ICONS.TANK);
            } else if (customId === 'join_heal') {
                const healField = newFields.find(f => f.name.includes('Heal'));
                if (healField && !isEmptySlot(healField.value)) isFull = true;
                btn.setLabel('Heal').setEmoji(ROLE_ICONS.HEAL);
            } else if (customId === 'join_dps') {
                const dpsFields = newFields.filter(f => f.name.includes('DPS'));
                const emptyDps = dpsFields.filter(f => isEmptySlot(f.value));
                if (emptyDps.length === 0) isFull = true;
                btn.setLabel('DPS').setEmoji(ROLE_ICONS.DPS);
            } else if (customId === 'leave') {
                btn.setDisabled(false).setStyle(ButtonStyle.Secondary);
            } else if (customId && customId.startsWith('join_custom_')) {
                const customIndex = parseInt(customId.split('_')[2]);
                const field = newFields[customIndex];
                if (field && !isEmptySlot(field.value)) isFull = true;

                if (field) {
                    const label = field.name.replace(/^[^\w\s]*\s*/, '').replace(/:$/, '');
                    if (label) btn.setLabel(label);
                    else btn.setLabel(customIndex.toString());
                }
            }

            if (isFull) {
                btn.setDisabled(true).setStyle(ButtonStyle.Secondary);
            } else if (customId !== 'leave' && !customId?.startsWith('close_party_') && !customId?.startsWith('manage_party_')) {
                if (customId === 'join_tank') btn.setStyle(ButtonStyle.Primary);
                else if (customId === 'join_heal') btn.setStyle(ButtonStyle.Success);
                else if (customId === 'join_dps') btn.setStyle(ButtonStyle.Danger);
                else if (customId && customId.startsWith('join_custom_')) btn.setStyle(ButtonStyle.Primary);
                btn.setDisabled(false);
            }

            // Final safety for Discord restrictions
            if (!btn.data.label && !btn.data.emoji) {
                btn.setLabel('Slot ' + (customId?.split('_').pop() || ''));
            }

            newRow.addComponents(btn);
        }
        rows.push(newRow);
    }
    return rows;
}

module.exports = {
    createPveButtons,
    createCustomPartyComponents,
    createClosedButton,
    updateButtonStates
};
