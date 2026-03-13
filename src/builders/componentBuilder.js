const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { EMPTY_SLOT, ROLE_ICONS, SELECT_MENU_THRESHOLD } = require('../constants/constants');
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

    const manageBtn = new ButtonBuilder()
        .setCustomId(`open_settings_${ownerId}`)
        .setLabel(lang === 'tr' ? '⚙️ Ayarlar' : '⚙️ Settings')
        .setStyle(ButtonStyle.Secondary);

    return [row1, new ActionRowBuilder().addComponents(manageBtn)];
}

/**
 * Creates custom party components — buttons (≤7 roles) or select menu (>7 roles)
 * @param {string[]} rolesList - List of role names
 * @param {string} ownerId - Party owner's Discord ID
 * @param {string} lang - Language code
 * @param {Array|null} rolesWithMembers - Array of {role, userId} objects (for select menu mode state)
 */
function createCustomPartyComponents(rolesList, ownerId, lang = 'tr', rolesWithMembers = null) {
    return createSelectMenuPartyComponents(rolesList, ownerId, lang, rolesWithMembers);
}

/**
 * Creates SELECT MENU based party components for parties with >7 roles.
 * Layout: Row 1 = Join Role Select | Row 2 = Leave Button | Row 3 = Management Menu
 * Total: 3 rows (well within 5-row limit)
 */
function createSelectMenuPartyComponents(rolesList, ownerId, lang, rolesWithMembers) {
    const rows = [];

    // --- Row 1: Join role select menu ---
    const joinMenu = new StringSelectMenuBuilder()
        .setCustomId(`join_role_${ownerId}`)
        .setPlaceholder(lang === 'tr' ? '🎮 Bir rol seçerek katıl' : '🎮 Select a role to join');

    rolesList.forEach((role, index) => {
        const member = rolesWithMembers ? rolesWithMembers[index] : null;
        const isFull = member && member.userId != null;

        let label = role;
        if (label.length > 90) label = label.substring(0, 87) + '...';

        const option = new StringSelectMenuOptionBuilder()
            .setLabel(`${index + 1}. ${label}`)
            .setValue(`${index}`)
            .setEmoji(isFull ? '🔴' : '🟢');

        if (isFull) {
            option.setDescription(lang === 'tr' ? 'Dolu' : 'Full');
        } else {
            option.setDescription(lang === 'tr' ? 'Boş - Katılmak için seç' : 'Available - Select to join');
        }

        joinMenu.addOptions(option);
    });

    rows.push(new ActionRowBuilder().addComponents(joinMenu));

    // --- Row 2: Management menu & Leave button ---
    rows.push(new ActionRowBuilder().addComponents(
        createManageMenu(ownerId, lang),
        new ButtonBuilder()
            .setCustomId('leave')
            .setLabel(t('common.leave', lang))
            .setStyle(ButtonStyle.Secondary)
    ));

    return rows; // Always 2 rows
}

/**
 * Creates BUTTON based party components for parties with ≤7 roles.
 * Discord max 5 Action Rows: up to 3 rows buttons + 1 leave row + 1 management menu
 */
function createButtonPartyComponents(rolesList, ownerId, lang) {
    const MAX_TOTAL_ROWS = 5;
    const RESERVED_ROWS = 1; // 1 for management menu

    const rows = [];
    let currentRow = new ActionRowBuilder();
    const maxRoleRows = MAX_TOTAL_ROWS - RESERVED_ROWS - 1; // 3

    rolesList.forEach((role, index) => {
        if (currentRow.components.length === 5) {
            if (rows.length < maxRoleRows) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            } else {
                return;
            }
        }
        if (rows.length < maxRoleRows) {
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

    // Merge leave button into last row if there's space
    let lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.components.length < 5) {
        lastRow.addComponents(leaveBtn);
    } else if (rows.length < MAX_TOTAL_ROWS - RESERVED_ROWS) {
        rows.push(new ActionRowBuilder().addComponents(leaveBtn));
    } else {
        // Safety fallback
        if (lastRow && lastRow.components.length === 5) {
            const components = lastRow.components.slice(0, 4);
            const newLastRow = new ActionRowBuilder().addComponents(...components, leaveBtn);
            rows[rows.length - 1] = newLastRow;
        }
    }

    // Management Menu (last row)
    rows.push(new ActionRowBuilder().addComponents(createManageMenu(ownerId, lang)));

    // Safety check
    if (rows.length > 5) {
        console.warn(`[ComponentBuilder] WARNING: ${rows.length} rows generated, trimming to 5.`);
        return rows.slice(0, 5);
    }

    return rows;
}

/**
 * Creates the management select menu (shared between button and select menu modes)
 */
function createManageMenu(ownerId, lang) {
    return new ButtonBuilder()
        .setCustomId(`open_settings_${ownerId}`)
        .setLabel(lang === 'tr' ? '⚙️ Ayarlar' : '⚙️ Settings')
        .setStyle(ButtonStyle.Secondary);
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
 * Updates button states based on field availability (for BUTTON mode only)
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

    // Safety check - Discord hard limit of 5 action rows
    if (rows.length > 5) {
        console.warn(`[ComponentBuilder] updateButtonStates: ${rows.length} rows, trimming to 5.`);
        return rows.slice(0, 5);
    }

    return rows;
}

/**
 * Checks if a party uses select menu mode based on role count
 */
function isSelectMenuMode(roleCount) {
    return true;
}

module.exports = {
    createPveButtons,
    createCustomPartyComponents,
    createClosedButton,
    updateButtonStates,
    isSelectMenuMode
};
