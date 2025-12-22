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
  // Category bilgisini al (varsa)
  const category = availableDates.length > 0 && availableDates[0].category 
    ? availableDates[0].category 
    : "Normal";
  
  const categoryEmoji = category === "Premium" ? "⭐️" : "🎫";
  
  const header = "🎊🎉✨ *MUHTEŞEM HABER!* ✨🎉🎊\n";
  const subHeader = "🇪🇸 *RANDEVU TARİHLERİ AÇILDI!* 🇪🇸\n\n";
  
  const summary = `🌟 *${availableDates.length} harika tarih seni bekliyor!*\n\n`;
  
  // Tarihleri aya göre grupla
  const datesByMonth = {};
  for (const dateObj of availableDates) {
    if (!datesByMonth[dateObj.month]) {
      datesByMonth[dateObj.month] = [];
    }
    datesByMonth[dateObj.month].push(dateObj.text);
  }
  
  // Gruplanmış tarihleri ekle
  let datesText = "📅 *Müsait Tarihler:*\n";
  for (const [month, dates] of Object.entries(datesByMonth)) {
    datesText += `\n🗓 *${month}*\n`;
    datesText += `   💚 ${dates.join(' • ')}\n`;
  }
  
  const location = "\n📍 *Nereden:* Ankara 🏛\n";
  const visaType = "🎫 *Ne için:* Schengen Turist Vizesi ✈️\n";
  const categoryInfo = `${categoryEmoji} *Kategori:* ${category}\n\n`;
  
  const action = "🚀 *HEMEN KOŞŞŞ:*\n";
  const link = "🔗 [BLS Spain Portal'a Git!](https://turkey.blsspainglobal.com/Global/Account/LogIn)\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const warning = "⚡️ _Hızlı ol! Randevular uçuyor!_ 🏃‍♂️💨";
  
  const message = header + subHeader + summary + datesText + location + visaType + categoryInfo + action + link + footer + warning;
  
  return await sendMessageToTelegram(message);
};

// 😔 HİÇBİR TARİH YOK
const notifyNoAppointments = async (monthsScanned) => {
  const header = "😔 *Bugün de olmadı...*\n\n";
  
  const info = `🔍 ${monthsScanned} ay boyunca baktım\n`;
  const result = "📅 Hiç müsait tarih yok şu an 😢\n\n";
  
  const location = "📍 Ankara\n";
  const visaType = "🎫 Schengen Turist\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "💪 _Ama pes etmiyoruz! Aramaya devam..._";
  
  const message = header + info + result + location + visaType + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🔒 RANDEVULAR KAPALI
const notifyAppointmentsClosed = async () => {
  const header = "🔒 *Kapılar Kapalı* 🚪\n\n";
  
  const info = "😞 Randevu sistemi şu an kapalı\n";
  const reason = "🇪🇸 İspanya bu kategori için randevu vermiyor\n\n";
  
  const location = "📍 Ankara\n";
  const visaType = "🎫 Schengen Turist\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "🤞 _Umarım yakında açılır, gözüm üstünde!_";
  
  const message = header + info + reason + location + visaType + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🤔 FORM DOLDURMA HATASI
const notifyFormError = async (errorStep) => {
  const header = "🤔 *Bir Aksilik Oldu*\n\n";
  
  const error = `📝 Form doldurulamadı:\n_${errorStep}_\n\n`;
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "🔄 _Sorun değil, tekrar denerim!_";
  
  const message = header + error + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🧩 CAPTCHA HATASI
const notifyCaptchaError = async (retryCount) => {
  const header = "🧩 *Captcha Zor Geldi* 😅\n\n";
  
  const info = `🔢 Deneme: ${retryCount}/3\n`;
  const status = "🤖 O bulmacayı çözemedim bu sefer\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "🎯 _Bir daha deniyorum, bu sefer çözerim!_";
  
  const message = header + info + status + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🚀 BOT BAŞLADI
const notifyBotStarted = async () => {
  const header = "🚀 *Merhaba! Göreve Hazırım* 👋\n\n";
  
  const info = "🤖 İspanya vizesi avcısı aktif!\n\n";
  
  const settings = "⚙️ *Ne yapıyorum:*\n";
  const location = "   📍 Ankara'dan bakıyorum\n";
  const visaType = "   🎫 Schengen Turist arıyorum\n";
  const interval = "   ⏱ Her 10 dakika kontrol\n\n";
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "🔔 _Randevu açılınca hemen haber veririm!_ ✨";
  
  const message = header + info + settings + location + visaType + interval + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 😵 BOT DURDURULDU / HATA
const notifyBotError = async (errorMessage) => {
  const header = "😵 *Hay aksi! Bir şeyler ters gitti*\n\n";
  
  const error = `🐛 _${errorMessage}_\n\n`;
  
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n";
  const note = "🔧 _Kendimi tamir edip geliyorum!_ 🏃‍♂️";
  
  const message = header + error + footer + note;
  
  return await sendMessageToTelegram(message);
};

// 🔔 SLOT SAYFASI AÇIK AMA OKUNAMIYOR
const notifySlotPageReached = async (errorDetail) => {
  const header = "🔔🔔🔔 *DİKKAT!* 🔔🔔🔔\n\n";
  
  const good = "✅ *SLOT SEÇİM SAYFASINA ULAŞILDI!*\n\n";
  const bad = `⚠️ Takvim okunamadı: _${errorDetail}_\n\n`;
  
  const important = "🚨 *BU ÖNEMLİ!*\n";
  const meaning = "📅 Slot seçim sayfası açık = Randevu VAR olabilir!\n\n";
  
  const action = "👉 *HEMEN MANUEL KONTROL ET:*\n";
  const link = "🔗 [BLS Spain Portal](https://turkey.blsspainglobal.com/Global/Account/LogIn)\n\n";
  
  const location = "📍 Ankara | 🎫 Schengen Turist\n";
  const footer = "⏰ " + new Date().toLocaleString('tr-TR') + "\n\n";
  const note = "⚡️ _Bot takvimi okuyamadı ama sen bakabilirsin!_";
  
  const message = header + good + bad + important + meaning + action + link + location + footer + note;
  
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
  notifyBotError,
  notifySlotPageReached
};
