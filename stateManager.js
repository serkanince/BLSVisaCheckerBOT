/**
 * BLS Visa Checker - State Manager
 * BLS'de işlenen son şehri kaydeder ve okur.
 * Bir sonraki çalışmada kaldığı yerden devam eder.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'last_city.json');

/**
 * BLS profilinde işlenen son şehri kaydet (lokasyon güncellemesinden / resume sonrası).
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
 * Şehir listesini son kaydedilen şehrin KENDİSİNDEN başlayacak şekilde döndürür.
 * lastCity = BLS'de o lokasyon zaten set edilmiş demek, direkt taramaya başlanabilir.
 * Tüm şehirlerin taranmasını garantiler (wrap-around).
 * @param {Array} cities - CFG.CITIES dizisi
 * @returns {Array} Yeniden sıralanmış şehir listesi
 */
function getOrderedCities(cities) {
    const lastCity = loadLastCity();
    if (!lastCity) return cities; // İlk çalışma - sırayı değiştirme

    const lastIdx = cities.findIndex(c => c.name === lastCity);
    if (lastIdx === -1) return cities; // Bilinmeyen şehir - sırayı değiştirme

    // lastCity'den başla: lokasyon zaten o şehre set edilmiş
    return [...cities.slice(lastIdx), ...cities.slice(0, lastIdx)];
}

/**
 * İlk taranacak şehrin lokasyonu BLS'de zaten set edilmiş mi?
 * Evet ise setApplicantLocation adımı atlanabilir.
 * @param {Array} cities - CFG.CITIES dizisi
 * @param {object} firstCity - Taranacak ilk şehir
 * @returns {boolean}
 */
function isLocationAlreadySet(cities, firstCity) {
    const lastCity = loadLastCity();
    if (!lastCity) return false; // İlk çalışma
    return lastCity === firstCity.name;
}

module.exports = { saveLastCity, loadLastCity, getOrderedCities, isLocationAlreadySet };
