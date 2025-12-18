const axios = require("axios");
require("dotenv").config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Temel mesaj gönderme fonksiyonu
const sendMessageToTelegram = async (message, parseMode = 'Markdown') => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: parseMode,
    });
    return true;
  } catch (error) {
    console.error(
      "Telegram Error:",
      error.response ? error.response.data : error.message
    );
    return false;
  }
};

// 🎉 RANDEVU BULUNDU - Yeşil tarihlerle
const notifyAppointmentFound = async (availableDates) => {
  const header = "🎉🎉🎉 *RANDEVU TARİHLERİ BULUNDU!* 🎉🎉🎉\n\n";
  
  const summary = `✅ *Toplam ${availableDates.length} uygun tarih*\n\n`;
  
  // Tarihleri aya göre grupla
  const datesByMonth = {};
  for (const dateObj of availableDates) {
    if (!datesByMonth[dateObj.month]) {
      datesByMonth[dateObj.month] = [];
    }
    datesByMonth[dateObj.month].push(dateObj.text);
  }
  
  // Gruplanmış tarihleri ekle
  let datesText = "📅 *Uygun Tarihler:*\n";
  for (const [month, dates] of Object.entries(datesByMonth)) {
    datesText += `\n🗓 *${month}*\n`;
    datesText += `   ${dates.join(', ')}\n`;
  }
  
  const location = "\n📍 *Lokasyon:* Ankara\n";
  const visaType = "🎫 *Vize Tipi:* Schengen Turist Vizesi\n\n";
  
  const action = "⚡️ *HEMEN GİRİŞ YAPIN:*\n";
  const link = "🔗 [BLS Spain Turkey Portal](https://turkey.blsspainglobal.com/Global/Account/LogIn)\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const warning = "⚠️ Randevular hızla dolabilir!";
  
  const message = header + summary + datesText + location + visaType + action + link + footer + warning;
  
  return await sendMessageToTelegram(message);
};

// ❌ HİÇBİR TARİH YOK
const notifyNoAppointments = async (monthsScanned) => {
  const header = "❌ *RANDEVU BULUNAMADI*\n\n";
  
  const info = `🔍 *${monthsScanned} ay tarandı*\n`;
  const result = "📅 Hiçbir uygun tarih bulunamadı\n\n";
  
  const location = "📍 *Lokasyon:* Ankara\n";
  const visaType = "🎫 *Vize Tipi:* Schengen Turist Vizesi\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "ℹ️ Bot otomatik olarak kontrol etmeye devam edecek";
  
  const message = header + info + result + location + visaType + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🚫 RANDEVULAR KAPALI
const notifyAppointmentsClosed = async () => {
  const header = "🚫 *RANDEVULAR TAMAMEN KAPALI*\n\n";
  
  const info = "⚠️ Slot seçim ekranı açılmadı\n";
  const reason = "📋 Form gönderildikten sonra slot sayfasına yönlendirilmedi\n\n";
  
  const location = "📍 *Lokasyon:* Ankara\n";
  const visaType = "🎫 *Vize Tipi:* Schengen Turist Vizesi\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "ℹ️ Bot kontrol etmeye devam edecek";
  
  const message = header + info + reason + location + visaType + footer + note;
  
  return await sendMessageToTelegram(message);
};

// ⚠️ FORM DOLDURMA HATASI
const notifyFormError = async (errorStep) => {
  const header = "⚠️ *FORM DOLDURMA HATASI*\n\n";
  
  const error = `❌ *Hata:* ${errorStep}\n`;
  const info = "📋 Form dropdown'ları doldurulamadı\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "ℹ️ Sonraki denemede tekrar denenecek";
  
  const message = header + error + info + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🔒 CAPTCHA HATASI
const notifyCaptchaError = async (retryCount) => {
  const header = "🔒 *CAPTCHA ÇÖZME HATASI*\n\n";
  
  const info = `🔄 *Deneme Sayısı:* ${retryCount}/3\n`;
  const status = "❌ Captcha çözülemedi veya yanlış çözüldü\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "ℹ️ Tekrar denenecek...";
  
  const message = header + info + status + footer + note;
  
  return await sendMessageToTelegram(message);
};

// ✅ BOT BAŞLADI
const notifyBotStarted = async () => {
  const header = "✅ *BLS VİZE BOT BAŞLATILDI*\n\n";
  
  const info = "🤖 Bot aktif ve randevu aramaya başladı\n\n";
  
  const settings = "⚙️ *Ayarlar:*\n";
  const location = "   📍 Lokasyon: Ankara\n";
  const visaType = "   🎫 Vize: Schengen Turist\n";
  const interval = "   ⏱ Kontrol: Her 15 dakikada\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "✨ Randevu bulunduğunda bildirim alacaksınız!";
  
  const message = header + info + settings + location + visaType + interval + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🛑 BOT DURDURULDU / HATA
const notifyBotError = async (errorMessage) => {
  const header = "🛑 *BOT HATASI*\n\n";
  
  const error = `❌ *Hata:* ${errorMessage}\n\n`;
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "⚠️ Bot tekrar başlatılacak...";
  
  const message = header + error + footer + note;
  
  return await sendMessageToTelegram(message);
};

module.exports = {
  sendMessageToTelegram,
  notifyAppointmentFound,
  notifyNoAppointments,
  notifyAppointmentsClosed,
  notifyFormError,
  notifyCaptchaError,
  notifyBotStarted,
  notifyBotError
};
