const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(path.join(__dirname, '..', 'data'));
const DATA_FILE = path.join(DATA_DIR, 'ceza_sistemi.json');

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify({ guilds: {}, cases: [] }, null, 2),
            'utf8'
        );
    }
}

function readDB() {
    ensureDataFile();
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.guilds) parsed.guilds = {};
        if (!Array.isArray(parsed.cases)) parsed.cases = [];
        return parsed;
    } catch {
        return { guilds: {}, cases: [] };
    }
}

function writeDB(data) {
    ensureDataFile();
    const temp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, DATA_FILE);
}

function getGuildSettings(guildId) {
    const db = readDB();
    if (!db.guilds[guildId]) {
        db.guilds[guildId] = {
            cezaChannelId: null,
            cezaliRoleId: null,
            yetkiliRoleId: null,
        };
        writeDB(db);
    }
    return db.guilds[guildId];
}

function updateGuildSettings(guildId, partial) {
    const db = readDB();
    if (!db.guilds[guildId]) {
        db.guilds[guildId] = {
            cezaChannelId: null,
            cezaliRoleId: null,
            yetkiliRoleId: null,
        };
    }
    db.guilds[guildId] = { ...db.guilds[guildId], ...partial };
    writeDB(db);
    return db.guilds[guildId];
}

function createCase(data) {
    const db = readDB();
    db.cases.push(data);
    writeDB(db);
    return data;
}

function updateCase(caseId, updater) {
    const db = readDB();
    const index = db.cases.findIndex((x) => x.caseId === caseId);
    if (index === -1) return null;

    const current = db.cases[index];
    db.cases[index] =
        typeof updater === 'function' ? updater(current) : { ...current, ...updater };

    writeDB(db);
    return db.cases[index];
}

function getCaseById(caseId) {
    const db = readDB();
    return db.cases.find((x) => x.caseId === caseId) || null;
}

function getCasesByUser(guildId, userId) {
    const db = readDB();
    return db.cases
        .filter((x) => x.guildId === guildId && x.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getActiveCasesByUser(guildId, userId) {
    const db = readDB();
    return db.cases.filter(
        (x) => x.guildId === guildId && x.userId === userId && x.status === 'active'
    );
}

module.exports = {
    getGuildSettings,
    updateGuildSettings,
    createCase,
    updateCase,
    getCaseById,
    getCasesByUser,
    getActiveCasesByUser,
};
