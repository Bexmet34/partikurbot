const https = require('https');

/**
 * Albion Avrupa API'sinden lonca üyelerini çeker
 */
async function getEuropeGuildMembers(guildId) {
    return new Promise((resolve, reject) => {
        const url = `https://gameinfo-ams.albiononline.com/api/gameinfo/guilds/${guildId}/members`;

        https.get(url, { family: 4 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`API Hatası: ${res.statusCode}`));
                    }
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('API yanıtı çözümlenemedi.'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

/**
 * Albion Avrupa sunucusunda ismiyle oyuncu arar
 */
async function searchPlayer(name) {
    return new Promise((resolve, reject) => {
        const url = `https://gameinfo-ams.albiononline.com/api/gameinfo/search?q=${name}`;
        https.get(url, { family: 4 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    // Sadece oyuncular (players) içindeki tam isim eşleşmesini bul
                    const player = parsed.players?.find(p => p.Name.toLowerCase() === name.toLowerCase());
                    resolve(player || null);
                } catch (e) {
                    reject(new Error('Oyuncu araması sırasında hata oluştu.'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

/**
 * Oyuncu ID'sine göre detaylı istatistikleri çeker
 */
async function getPlayerStats(playerId) {
    return new Promise((resolve, reject) => {
        const url = `https://gameinfo-ams.albiononline.com/api/gameinfo/players/${playerId}`;
        https.get(url, { family: 4 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('İstatistikler çekilemedi.'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

module.exports = { getEuropeGuildMembers, searchPlayer, getPlayerStats };
