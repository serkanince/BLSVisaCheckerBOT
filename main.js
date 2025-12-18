const { spawn } = require('child_process');

// ⏰ Çalışma Saatleri Ayarları
const WORK_START_HOUR = 8;   // Sabah 08:00'da başla
const WORK_END_HOUR = 24;    // Gece 00:00'da dur
const MORNING_END_HOUR = 12; // Sabah 12:00'a kadar yoğun mod

const MORNING_INTERVAL = 20; // 08:00-12:00 arası 20 dakika
const AFTERNOON_INTERVAL = 60; // 12:00-24:00 arası 60 dakika (1 saat)

// Şu anki saat çalışma saatleri içinde mi?
function isWorkingHours() {
  const hour = new Date().getHours();
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

// Şu an sabah mı (yoğun mod)?
function isMorning() {
  const hour = new Date().getHours();
  return hour >= WORK_START_HOUR && hour < MORNING_END_HOUR;
}

// Bir sonraki çalışma saatine kadar bekle
function getTimeUntilWorkStart() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(WORK_START_HOUR, 0, 0, 0);
  
  const todayStart = new Date(now);
  todayStart.setHours(WORK_START_HOUR, 0, 0, 0);
  
  // Eğer bugün henüz çalışma saati başlamadıysa
  if (now.getHours() < WORK_START_HOUR) {
    return todayStart - now;
  }
  
  // Gece yarısından sonra, yarın sabaha bekle
  return tomorrow - now;
}

// Bekleme süresini insan okunabilir formatta göster
function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} saat ${minutes} dakika`;
}

// Şu anki saati göster
function getTimeString() {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

(async function loop() {
  console.log('🚀 BLS Vize Bot Başlatıldı!');
  console.log(`⏰ Çalışma Saatleri: ${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00`);
  console.log(`🌅 Sabah (${WORK_START_HOUR}:00-${MORNING_END_HOUR}:00): Her ${MORNING_INTERVAL} dakika`);
  console.log(`🌆 Öğleden Sonra (${MORNING_END_HOUR}:00-${WORK_END_HOUR}:00): Her ${AFTERNOON_INTERVAL} dakika\n`);
  
  while (true) {
    // Çalışma saatleri kontrolü
    if (!isWorkingHours()) {
      const waitTime = getTimeUntilWorkStart();
      console.log(`😴 [${getTimeString()}] Gece modu - Uyku zamanı!`);
      console.log(`⏰ Sabah ${WORK_START_HOUR}:00'da uyanacağım (${formatDuration(waitTime)})\n`);
      await new Promise(res => setTimeout(res, waitTime));
      console.log(`\n☀️ Günaydın! Çalışmaya başlıyorum!\n`);
      continue;
    }
    
    // Bot'u çalıştır
    console.log(`\n🔍 [${getTimeString()}] Randevu kontrolü başlıyor...`);
    await new Promise((resolve) => {
      const child = spawn('node', ['app.js'], { stdio: 'inherit' });
      child.on('exit', resolve);
    });
    
    // Saate göre bekleme süresi
    const interval = isMorning() ? MORNING_INTERVAL : AFTERNOON_INTERVAL;
    const modeEmoji = isMorning() ? '🌅' : '🌆';
    const modeName = isMorning() ? 'Sabah Modu' : 'Öğleden Sonra';
    
    console.log(`\n${modeEmoji} [${getTimeString()}] ${modeName} - ${interval} dakika sonra tekrar kontrol edilecek...`);
    await new Promise(res => setTimeout(res, interval * 60 * 1000));
  }
})();
