const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMPTY_SLOT, ROLE_ICONS } = require('../constants/constants');

/**
 * Creates PVE action buttons
 */
/**
 * Creates PVE action buttons
 */
function createPveButtons(ownerId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('join_tank').setLabel('Tank').setEmoji(ROLE_ICONS.TANK).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('join_heal').setLabel('Heal').setEmoji(ROLE_ICONS.HEAL).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('join_dps').setLabel('DPS').setEmoji(ROLE_ICONS.DPS).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('leave').setLabel('Ayrıl').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`close_party_${ownerId}`).setLabel('Partiyi Kapat').setStyle(ButtonStyle.Danger)
        );
}

/**
 * Creates custom party buttons based on roles
 */
function createCustomPartyComponents(rolesList, ownerId) {
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

    const leaveBtn = new ButtonBuilder().setCustomId('leave').setLabel('Ayrıl').setStyle(ButtonStyle.Secondary);
    const closeBtn = new ButtonBuilder().setCustomId(`close_party_${ownerId}`).setLabel('Partiyi Kapat').setStyle(ButtonStyle.Danger);

    // Add buttons logically
    let lastRow = rows[rows.length - 1];

    // Try to fit Leave and Close buttons
    if (lastRow.components.length <= 3) {
        lastRow.addComponents(leaveBtn, closeBtn);
    } else if (lastRow.components.length === 4) {
        lastRow.addComponents(leaveBtn);
        rows.push(new ActionRowBuilder().addComponents(closeBtn));
    } else {
        rows.push(new ActionRowBuilder().addComponents(leaveBtn, closeBtn));
    }

    return rows;
}

/**
 * Creates closed party button
 */
function createClosedButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('closed').setLabel('BU BAŞVURU KAPANDI').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
}

/**
 * Updates button states based on field availability
 */
function updateButtonStates(oldComponents, newFields) {
    const rows = [];

    // Helper function to check if a slot is empty
    const isEmptySlot = (value) => value === '-' || value.includes(EMPTY_SLOT);

    for (const oldRow of oldComponents) {
        const newRow = new ActionRowBuilder();
        for (const component of oldRow.components) {
            const btn = ButtonBuilder.from(component);
            let isFull = false;

            if (btn.data.custom_id === 'join_tank') {
                const tankField = newFields.find(f => f.name.includes('Tank') && !f.name.includes('👥'));
                if (tankField && !isEmptySlot(tankField.value)) isFull = true;
            } else if (btn.data.custom_id === 'join_heal') {
                const healField = newFields.find(f => f.name.includes('Heal') && !f.name.includes('👥'));
                if (healField && !isEmptySlot(healField.value)) isFull = true;
            } else if (btn.data.custom_id === 'join_dps') {
                const dpsFields = newFields.filter(f => f.name.includes('DPS') && !f.name.includes('👥'));
                const emptyDps = dpsFields.filter(f => isEmptySlot(f.value));
                if (emptyDps.length === 0) isFull = true;
            } else if (btn.data.custom_id && btn.data.custom_id.startsWith('join_custom_')) {
                const customIndex = parseInt(btn.data.custom_id.split('_')[2]);
                // Find the actual field for custom roles
                let roleCounter = 0;
                for (let i = 0; i < newFields.length; i++) {
                    if (!newFields[i].name.includes('👥') &&
                        !newFields[i].name.includes('📌') &&
                        newFields[i].name !== '\u200b' &&
                        !newFields[i].name.includes('KURALLAR')) {
                        if (roleCounter === customIndex) {
                            if (!isEmptySlot(newFields[i].value)) {
                                isFull = true;
                            }
                            break;
                        }
                        roleCounter++;
                    }
                }
            }

            if (isFull) {
                btn.setDisabled(true);
                btn.setStyle(ButtonStyle.Secondary);
            } else {
                if (btn.data.disabled && btn.data.style === ButtonStyle.Secondary) {
                    if (btn.data.custom_id === 'join_tank') {
                        btn.setLabel('Tank').setStyle(ButtonStyle.Primary).setDisabled(false);
                    } else if (btn.data.custom_id === 'join_heal') {
                        btn.setLabel('Heal').setStyle(ButtonStyle.Success).setDisabled(false);
                    } else if (btn.data.custom_id === 'join_dps') {
                        btn.setLabel('DPS').setStyle(ButtonStyle.Danger).setDisabled(false);
                    } else if (btn.data.custom_id.startsWith('join_custom_')) {
                        const customIndex = parseInt(btn.data.custom_id.split('_')[2]);
                        let roleCounter = 0;
                        for (let i = 0; i < newFields.length; i++) {
                            if (!newFields[i].name.includes('👥') &&
                                !newFields[i].name.includes('📌') &&
                                newFields[i].name !== '\u200b' &&
                                !newFields[i].name.includes('KURALLAR')) {
                                if (roleCounter === customIndex) {
                                    const recoveredLabel = newFields[i].name.replace(/^[^\w\s]*\s*/, '');
                                    btn.setLabel(recoveredLabel || newFields[i].name).setStyle(ButtonStyle.Primary).setDisabled(false);
                                    break;
                                }
                                roleCounter++;
                            }
                        }
                    }
                }
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
