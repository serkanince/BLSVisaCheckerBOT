/**
 * BLS Visa Checker - State Manager
 * Son taranan şehri kaydeder ve okur.
 * Bir sonraki çalışmada kaldığı yerden devam eder.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'last_city.json');

/**
 * Son başarıyla tamamlanan şehri kaydet.
 * @param {string} cityName - Şehir adı (config.CITIES[i].name ile aynı)
 */
function saveLastCity(cityName) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify({ lastCity: cityName, updatedAt: new Date().toISOString() }, null, 2));
    } catch (e) {
        console.error(`[StateManager] Durum kaydedilemedi: ${e.message}`);
    }
}

/**
 * Son kaydedilen şehri oku.
 * @returns {string|null} Şehir adı veya null (dosya yoksa)
 */
function loadLastCity() {
    try {
        if (!fs.existsSync(STATE_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return data.lastCity || null;
    } catch (e) {
        return null;
    }
}

/**
 * Şehir listesini son kaydedilen şehrin BİR SONRAKINDEN başlayacak şekilde döndürür.
 * Tüm şehirlerin taranmasını garantiler (wrap-around).
 * @param {Array} cities - CFG.CITIES dizisi
 * @returns {Array} Yeniden sıralanmış şehir listesi
 */
function getOrderedCities(cities) {
    const lastCity = loadLastCity();
    if (!lastCity) return cities; // İlk çalışma - sırayı değiştirme

    const lastIdx = cities.findIndex(c => c.name === lastCity);
    if (lastIdx === -1) return cities; // Bilinmeyen şehir - sırayı değiştirme

    // Son şehrin BİR SONRAKINDEN başla (wrap-around)
    const nextIdx = (lastIdx + 1) % cities.length;
    return [...cities.slice(nextIdx), ...cities.slice(0, nextIdx)];
}

module.exports = { saveLastCity, loadLastCity, getOrderedCities };
