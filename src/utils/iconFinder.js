const fs = require('fs');
const path = require('path');

/**
 * Normalizes string for fuzzy matching (lowercase, remove spaces and non-word chars)
 */
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Recursively finds all .png files in the given directory
 */
function getAllPngs(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllPngs(fullPath, fileList);
        } else if (file.toLowerCase().endsWith('.png')) {
            fileList.push({
                name: file.substring(0, file.length - 4), // remove .png
                fullPath: fullPath,
                normalized: normalize(file.substring(0, file.length - 4))
            });
        }
    }
    return fileList;
}

/**
 * Finds the icon path for the given roles list
 * @param {string[]} rolesList Array of role strings (e.g., ['Hallowfall>8.3', 'Tank', '#HEADER: Healer'])
 * @returns {string} Absolute path to the matched icon or bulunamadi.png
 */
function findIconForRoles(rolesList) {
    const iconsPath = path.join(__dirname, '..', 'icons');
    const defaultIcon = path.join(iconsPath, 'bulunamadi.png');
    
    if (!fs.existsSync(iconsPath)) {
        return defaultIcon;
    }

    const allIcons = getAllPngs(iconsPath);
    if (allIcons.length === 0) return defaultIcon;

    for (const roleStr of rolesList) {
        if (!roleStr || roleStr.startsWith('#')) continue;
        
        // Extract base role (e.g. Hallowfall>8.3 => Hallowfall)
        const baseRole = roleStr.split('>')[0].trim();
        const normRole = normalize(baseRole);

        if (!normRole) continue;

        // 1. Exact normalized match
        const exactMatch = allIcons.find(icon => icon.normalized === normRole);
        if (exactMatch) return exactMatch.fullPath;

        // 2. Substring match
        const subMatch = allIcons.find(icon => 
            icon.normalized.includes(normRole) || normRole.includes(icon.normalized)
        );
        if (subMatch) return subMatch.fullPath;
    }

    return defaultIcon;
}

module.exports = {
    findIconForRoles
};
