/**
 * Polling döngüsü. Her döngüde bir app.js çalıştırır, sonra uyur.
 *
 * Önceki versiyondan farkı: Child process'in EXIT CODE'unu OKUR.
 * Bu olmadan "slot yok" ile "block" ile "tarayıcı çöktü" aynı görünür
 * ve döngü hepsinde aynı şekilde devam eder — bu da saatlerce bir
 * block'un içinden geçmek ve kaydını tutmamak demektir.
 *
 * Fork'tan alınan iyileştirmeler:
 * - Öğleden sonra intervali: 120dk → 40dk
 * - Block durumunda exponential backoff ile retry (günü durdurmak yerine)
 * - Ardışık hata takibi ile otomatik durma
 * - Telegram sadece döngü durduğunda (her döngüde değil)
 * - Gece sonrası block streak sıfırlanır
 */
const { spawn } = require('child_process');

// ⏰ Çalışma Saatleri Ayarları
const WORK_START_HOUR = 8;   // Sabah 08:00'da başla
const WORK_END_HOUR = 24;    // Gece 00:00'da dur
const MORNING_END_HOUR = 12; // Sabah 12:00'a kadar yoğun mod

const MORNING_INTERVAL = 20; // 08:00-12:00 arası 20 dakika
const AFTERNOON_INTERVAL = 40; // 12:00-24:00 arası 40 dakika (eski: 120dk)

// === Block/Hata Yönetimi ===
const MAX_CONSECUTIVE_FAILURES = 3;  // Ardışık crash sayısı limiti
const MAX_CONSECUTIVE_BLOCKS = 12;   // Ardışık block sayısı limiti
const BLOCK_BACKOFF_MULTIPLIER = 1.5; // Her ardışık block'ta bekleme çarpanı
const BLOCK_BACKOFF_MAX_MIN = 120;   // Maksimum backoff süresi (dk)

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

// Bir sonraki çalışma saatine kadar bekle (dakika hassasiyetinde)
function getTimeUntilWorkStart() {
  const now = new Date();
  const hour = now.getHours();
  const minutesIntoHour = now.getMinutes();
  const secondsIntoMinute = now.getSeconds();

  let hoursToWait;
  if (hour < WORK_START_HOUR) {
    hoursToWait = WORK_START_HOUR - hour;
  } else {
    hoursToWait = 24 - hour + WORK_START_HOUR;
  }

  // Saatin tepesine kadar bekle (tam saatte başla)
  const msIntoHour = minutesIntoHour * 60000 + secondsIntoMinute * 1000 + now.getMilliseconds();
  return hoursToWait * 60 * 60 * 1000 - msIntoHour;
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

// ============================================
// EXIT CODE SINIFLANDIRMA
// ============================================
// exit code → döngünün ne yapması gerektiği
function classify(code) {
  if (code === 0) return { result: 'NO_SLOTS', halt: false, failure: false, blocked: false };
  if (code === 10) return { result: 'SLOTS_FOUND', halt: true, failure: false, blocked: false };
  if (code === 20) return { result: 'BLOCKED', halt: false, failure: false, blocked: true };
  if (code === 30) return { result: 'GUARD_ABORT', halt: false, failure: true, blocked: false };
  return { result: 'CRASH', halt: false, failure: true, blocked: false };
}

// ============================================
// STREAK TAKİBİ
// ============================================
// Streak bookkeeping — başarılı bir döngü HER İKİ streak'i de sıfırlar
function nextStreaks(prev, { blocked, failure }) {
  if (blocked) return { failures: prev.failures, blocks: prev.blocks + 1 };
  if (failure) return { failures: prev.failures + 1, blocks: prev.blocks };
  return { failures: 0, blocks: 0 }; // Başarılı: her ikisini de sıfırla
}

// Gece uykusundan sonra: block streak sıfırlanır (gece geçince block kalkar),
// ama failure streak kalır (crash eden setup uyuyunca düzelmez)
function afterNightSleep(streaks) {
  return { failures: streaks.failures, blocks: 0 };
}

// N'inci ardışık block'tan sonra ne kadar beklemeli
// n=1: normal interval, sonra her block'ta çarpan uygulanır (tavana kadar)
function blockWaitMinutes(baseMin, consecutiveBlocks) {
  const steps = Math.max(0, consecutiveBlocks - 1);
  const grown = baseMin * Math.pow(BLOCK_BACKOFF_MULTIPLIER, steps);
  return Math.min(grown, BLOCK_BACKOFF_MAX_MIN);
}

// ============================================
// TELEGRAM BİLDİRİM (sadece döngü durduğunda)
// ============================================
async function tellTelegram(message) {
  try {
    const { notifyBotError } = require('./telegramNotifier');
    await notifyBotError(message);
  } catch (e) {
    console.log(`⚠️ Telegram bildirimi başarısız: ${e.message}`);
  }
}

// ============================================
// ANA DÖNGÜ
// ============================================
(async function loop() {
  console.log('🚀 BLS Vize Bot Başlatıldı!');
  console.log(`⏰ Çalışma Saatleri: ${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00`);
  console.log(`🌅 Sabah (${WORK_START_HOUR}:00-${MORNING_END_HOUR}:00): Her ${MORNING_INTERVAL} dakika`);
  console.log(`🌆 Öğleden Sonra (${MORNING_END_HOUR}:00-${WORK_END_HOUR}:00): Her ${AFTERNOON_INTERVAL} dakika`);
  console.log(`🛡️ Block yönetimi: backoff ${BLOCK_BACKOFF_MULTIPLIER}x, max ${BLOCK_BACKOFF_MAX_MIN}dk, limit ${MAX_CONSECUTIVE_BLOCKS}`);
  console.log(`⚠️ Hata limiti: ${MAX_CONSECUTIVE_FAILURES} ardışık crash'te durur\n`);

  let cycle = 0;
  let streaks = { failures: 0, blocks: 0 };

  while (true) {
    // Çalışma saatleri kontrolü
    if (!isWorkingHours()) {
      const waitTime = getTimeUntilWorkStart();
      console.log(`😴 [${getTimeString()}] Gece modu - Uyku zamanı!`);
      console.log(`⏰ Sabah ${WORK_START_HOUR}:00'da uyanacağım (${formatDuration(waitTime)})\n`);
      await new Promise(res => setTimeout(res, waitTime));
      // Gece sonrası block streak sıfırla
      if (streaks.blocks > 0) {
        console.log(`🌅 Yeni gün - ${streaks.blocks} block streak sıfırlandı, sabah normal ${MORNING_INTERVAL}dk intervalle başlıyor.`);
      }
      streaks = afterNightSleep(streaks);
      console.log(`\n☀️ Günaydın! Çalışmaya başlıyorum!\n`);
      continue;
    }

    cycle++;
    const morning = isMorning();
    const startedAt = Date.now();

    // Bot'u çalıştır ve EXIT CODE'u oku
    console.log(`\n🔍 [${getTimeString()}] Döngü #${cycle} başlıyor (${morning ? 'sabah' : 'öğleden sonra'})...`);

    const exitCode = await new Promise((resolve) => {
      const child = spawn('node', ['app.js'], { stdio: 'inherit' });
      child.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
      child.on('error', (e) => {
        console.log(`❌ app.js başlatılamadı: ${e.message}`);
        resolve(1);
      });
    });

    const durationMs = Date.now() - startedAt;
    const verdict = classify(exitCode);
    const { result, halt, blocked } = verdict;

    console.log(`\n📊 [${getTimeString()}] Döngü #${cycle} bitti: ${result} (exit ${exitCode}) - ${Math.round(durationMs / 1000)}s`);

    // === SLOT BULUNDU → DURDUR ===
    if (halt) {
      console.log('🎉🎉🎉 SLOT BULUNDU! Döngü durduruluyor. Tarayıcı açık tutuluyor.');
      return;
    }

    // Streak güncelle
    const recovered = streaks.blocks > 0 && !blocked;
    streaks = nextStreaks(streaks, verdict);

    // === BLOCK DURUMU ===
    if (blocked) {
      console.log(`🚫 Block tespit edildi! (${streaks.blocks}/${MAX_CONSECUTIVE_BLOCKS} ardışık)`);

      if (streaks.blocks >= MAX_CONSECUTIVE_BLOCKS) {
        console.log(`❌ ${MAX_CONSECUTIVE_BLOCKS} ardışık block — döngü durduruluyor!`);
        await tellTelegram(`🛑 Döngü durdu (Döngü #${cycle}): ${streaks.blocks} ardışık block sonrası (exit ${exitCode}).`);
        return;
      }
      // Block'ta Telegram GÖNDERME — retry edilecek, log yeterli
      console.log('🔄 Backoff ile yeniden denenecek...');
    } else if (recovered) {
      console.log('✅ Blocktan kurtulundu — streak sıfırlandı, normal intervale dönüldü.');
    }

    // === ARDIŞ İK HATA KONTROLÜ ===
    if (streaks.failures > 0) {
      console.log(`⚠️ ${result} (${streaks.failures}/${MAX_CONSECUTIVE_FAILURES} ardışık hata)`);

      if (streaks.failures >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`❌ ${MAX_CONSECUTIVE_FAILURES} ardışık hata — döngü durduruluyor!`);
        await tellTelegram(`🛑 Döngü durdu (Döngü #${cycle}): ${MAX_CONSECUTIVE_FAILURES} ardışık hata (son: ${result}, exit ${exitCode}).`);
        return;
      }
    }

    // === BEKLEME SÜRESİ HESAPLA ===
    const baseInterval = morning ? MORNING_INTERVAL : AFTERNOON_INTERVAL;
    const interval = blocked ? blockWaitMinutes(baseInterval, streaks.blocks) : baseInterval;
    const backedOff = blocked && interval !== baseInterval ? ` (backoff: ${baseInterval}dk → ${Math.round(interval)}dk)` : '';

    const modeEmoji = morning ? '🌅' : '🌆';
    const modeName = morning ? 'Sabah Modu' : 'Öğleden Sonra';

    console.log(`${modeEmoji} [${getTimeString()}] ${modeName} - ${Math.round(interval)} dakika sonra tekrar kontrol edilecek${backedOff}...`);
    await new Promise(res => setTimeout(res, interval * 60 * 1000));
  }
})();
