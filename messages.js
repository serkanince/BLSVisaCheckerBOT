/**
 * BLS Visa Checker - Merkezi Log Mesajları
 * Tüm console.log mesajları buradan yönetilir.
 */

module.exports = {
    // === GENEL ===
    PAGE_LOADED: 'Sayfa yüklendi...',
    PAGE_REFRESHED: '✅ Sayfa yenilendi!',

    // === UNAVAILABLE ===
    UNAVAILABLE_DETECTED: '⚠️ "Application Temporarily Unavailable" hatası tespit edildi! 10 saniye bekleniyor...',
    UNAVAILABLE_REFRESHING: 'Sayfa yenileniyor...',

    // === GİRİŞ ===
    EMAIL_WAITING: 'Email input alanı bekleniyor...',
    EMAIL_FOUND: (id) => `✅ Email input bulundu: ${id}`,
    EMAIL_NOT_FOUND: '❌ Email input bulunamadı',
    EMAIL_ENTERING: 'Email giriliyor...',
    EMAIL_SUCCESS: '✅ Email başarıyla girildi!',
    EMAIL_ERROR: (msg) => `Email doldurma hatası: ${msg}`,

    VERIFY_CLICKING: 'btnVerify\'a tıklanıyor...',
    VERIFY_CLICKED: '✅ btnVerify\'a tıklandı!',
    VERIFY_NOT_FOUND: '⚠️ btnVerify bulunamadı',

    PASSWORD_WAITING: 'Password sayfası bekleniyor...',
    PASSWORD_FOUND: '✅ Password input bulundu!',
    PASSWORD_NOT_FOUND: '⚠️ Password alanı bulunamadı - email sayfasına dönülmüş olabilir',
    PASSWORD_ENTERING: 'Password giriliyor...',
    PASSWORD_SUCCESS: '✅ Password başarıyla girildi!',
    PASSWORD_RETRY_SUCCESS: '✅ Password tekrar girildi!',
    PASSWORD_JS_SUCCESS: '✅ Password JS ile girildi!',
    PASSWORD_ALREADY_FILLED: '✅ Password zaten dolu',
    PASSWORD_ERROR: (msg) => `Password doldurma hatası: ${msg}`,
    PASSWORD_FILL_FAILED: '❌ Password alanı doldurulamadı!',
    ENTRY_DISABLED_REMOVING: '⚠️ entry-disabled class\'ı tespit edildi, kaldırılıyor...',
    ENTRY_DISABLED_REMOVED: '⚠️ entry-disabled class\'ı kaldırılıyor...',

    LOGIN_RETRYING: (num, max) => `\n🔄 Login tekrar deneniyor (${num}/${max})...`,
    LOGIN_CAPTCHA_SOLVING: 'Login captcha çözülüyor...',
    LOGIN_SUCCESS: '✅ Giriş başarılı! Home sayfasına yönlendirildi.',
    LOGIN_FAILED: (msg) => `❌ Login başarısız: ${msg}`,
    LOGIN_MAX_RETRY: (max) => `❌ Maksimum retry sayısına ulaşıldı (${max})`,

    // === CAPTCHA ===
    CAPTCHA_SOLVING: 'Captcha çözülüyor...',
    CAPTCHA_SOLVED: '✅ Captcha çözüldü!',
    CAPTCHA_DETECTED: '🔒 Captcha ekranı tespit edildi, çözülüyor...',
    CAPTCHA_FORM_SUCCESS: '✅ Captcha çözüldü, form sayfasına yönlendirildi!',
    CAPTCHA_NOT_NEEDED: '✅ Form sayfasında - captcha yok!',
    CAPTCHA_FORM_DETECTED: '🔒 Form submit sonrası CAPTCHA ekranı tespit edildi!',
    CAPTCHA_PREMIUM_DETECTED: '🔒 Premium form submit sonrası CAPTCHA ekranı tespit edildi!',
    CAPTCHA_PREMIUM_SOLVED: '✅ Premium captcha çözüldü!',
    CAPTCHA_PREMIUM_FAILED: (msg) => `❌ Premium captcha çözülemedi: ${msg}`,
    CAPTCHA_FAILED: (msg) => `❌ Captcha çözülemedi: ${msg}`,
    RATE_LIMIT: '😤 Rate limiting! Biraz sakinleşelim... 30 saniye mola ☕',

    // === RANDEVU CAPTCHA ===
    BOOK_NOW_SEARCHING: '"Book Now" butonu aranıyor...',
    BOOK_NOW_CLICKED: '✅ "Book Now" butonuna tıklandı!',
    BOOK_NOW_NOT_FOUND: (msg) => `❌ "Book Now" butonu bulunamadı: ${msg}`,
    APPOINTMENT_PAGE_CHECKING: 'Randevu sayfası kontrol ediliyor...',
    APPOINTMENT_CAPTCHA_RETRYING: (num, max) => `\n🔄 Randevu captcha tekrar deneniyor (${num}/${max})...`,
    APPOINTMENT_CAPTCHA_SOLVING: 'Randevu sayfası captcha\'sı çözülüyor...',
    APPOINTMENT_CAPTCHA_SUCCESS: '✅ Randevu captcha başarılı! Form sayfasına yönlendirildi.',
    APPOINTMENT_CAPTCHA_ALT_SUCCESS: '✅ Form sayfası tespit edildi (alternatif kontrol)!',
    APPOINTMENT_CAPTCHA_FAILED: (msg) => `❌ Randevu captcha başarısız: ${msg}`,
    APPOINTMENT_MAX_RETRY: (max) => `❌ Maksimum retry sayısına ulaşıldı (${max})`,
    HOME_REDIRECT_BOOK_NOW: 'Home sayfasına geri döndük, tekrar \'Book Now\' tıklanıyor...',

    AFTER_LOGIN_CHECKING: 'Login captcha sonrası kontrol yapılıyor...',
    AFTER_CAPTCHA_CHECKING: 'Randevu captcha sonrası kontrol yapılıyor...',
    FORM_REDIRECT_WAITING: 'Form sayfasına yönlendirme bekleniyor...',
    FORM_DIRECT: '✅ Form sayfasına direkt gelinmiş - CAPTCHA ATLANMIŞ!\nForm ekranı hazır...',
    FORM_DETECTED_SOURCE: '✅ Form sayfası tespit edildi (page source) - CAPTCHA YOK!',
    FORM_CAPTCHA_DETECTED: 'Captcha sayfası tespit edildi, çözülüyor...',
    FORM_READY: '✅ Form sayfası hazır!',
    CURRENT_URL: (url) => `Mevcut URL: ${url}`,

    // === FORM DOLDURMA ===
    FORM_FILLING_DROPDOWNS: '📝 Dropdown\'lar yüklendi, form dolduruluyor...\n',
    FORM_SUBMIT_CHECKING: '📋 Form submit sonrası sayfa kontrol ediliyor...',
    FORM_ALL_DONE: '\n✅ TÜM FORM ALANLARI BAŞARIYLA DOLDURULDU!\n',
    FORM_SUBMIT_SEARCHING: 'Submit butonu aranıyor...',
    FORM_SUBMITTED: '✅ Form gönderildi!',
    FORM_SUBMITTED_JS: '✅ Form JS ile gönderildi!',
    FORM_SUBMIT_JS_FALLBACK: 'JS ile gönderiliyor...',
    APPOINTMENT_FOR_INFO: '\n📌 Appointment For: Individual (varsayılan)\n',

    JURISDICTION_FAILED: '❌ Jurisdiction seçilemedi, form gönderilemez!',
    LOCATION_FAILED: '❌ Location seçilemedi, form gönderilemez!',
    VISA_TYPE_FAILED: '❌ Visa Type seçilemedi, form gönderilemez!',
    VISA_SUB_TYPE_FAILED: '❌ Visa Sub Type seçilemedi, form gönderilemez!',
    CATEGORY_FAILED: '❌ Category seçilemedi, form gönderilemez!',

    // === DROPDOWN ===
    DROPDOWN_SEARCHING: (label, value) => `\n🔍 "${label}" dropdown'u aranıyor: "${value}"`,
    DROPDOWN_FOUND: (label) => `✅ Görünür "${label}" dropdown bulundu!`,
    DROPDOWN_OPENED: (label) => `✅ "${label}" dropdown açıldı`,
    DROPDOWN_SELECTED: (label, value) => `✅ "${label}": "${value}" seçildi!\n`,
    DROPDOWN_NOT_FOUND: (label) => `❌ "${label}" dropdown bulunamadı veya görünmüyor!`,
    DROPDOWN_NOT_SELECTED: (label, value) => `❌ "${label}": "${value}" seçeneği bulunamadı!\n`,
    DROPDOWN_ERROR: (label, msg) => `❌ "${label}" dropdown hatası: ${msg}`,

    // === TRY AGAIN / BOOK NOW ===
    TRY_AGAIN_SEARCHING: '🔄 Try Again butonu aranıyor...',
    TRY_AGAIN_LINK_CLICKED: '✅ Try Again linkine tıklandı!',
    TRY_AGAIN_BTN_CLICKED: '✅ Try Again butonuna tıklandı!',
    TRY_AGAIN_NOT_FOUND: '⚠️ Try Again butonu bulunamadı, Book Now\'a tıklanıyor...',
    BOOK_NOW_BTN_CLICKED: '✅ Book Now\'a tıklandı!',
    TRY_AGAIN_FAILED: (msg) => `❌ Try Again/Book Now hatası: ${msg}`,

    // === PREMIUM ===
    PREMIUM_FLOW_STARTING: '\n' + '='.repeat(60) + '\n🌟 PREMIUM CATEGORY AKIŞI BAŞLIYOR 🌟\n' + '='.repeat(60) + '\n',
    PREMIUM_FORM_FILLING: '\n📝 Premium Category için form dolduruluyor...\n',
    PREMIUM_CATEGORY_SELECTING: '\n🌟 Premium Category seçiliyor...\n',
    PREMIUM_MODAL_CHECKING: '\n🔔 Premium modal dialog kontrol ediliyor...\n',
    PREMIUM_MODAL_FOUND: '✅ Premium modal dialog bulundu!',
    PREMIUM_MODAL_TEXT: (text) => `   Modal mesajı: "${text.substring(0, 80)}..."`,
    PREMIUM_MODAL_ACCEPT_CLICKED: '✅ Accept butonuna tıklandı!',
    PREMIUM_MODAL_ACCEPT_NOT_FOUND: '⚠️ Accept butonu bulunamadı, devam ediliyor...',
    PREMIUM_MODAL_NOT_FOUND: '⚠️ Premium modal dialog bulunamadı (zaten kapanmış olabilir)',
    PREMIUM_MODAL_ERROR: (msg) => `⚠️ Modal dialog kontrolü sırasında hata (önemsiz): ${msg}`,
    PREMIUM_FORM_DONE: '\n✅ PREMIUM FORM ALANLARI BAŞARIYLA DOLDURULDU!\n',
    PREMIUM_SUBMIT_SEARCHING: 'Submit butonu aranıyor...',
    PREMIUM_SUBMITTED: '✅ Premium form gönderildi!',
    PREMIUM_SUBMITTED_JS: '✅ Premium form JS ile gönderildi!',
    PREMIUM_CHECKING: '\n📋 Premium form submit sonrası sayfa kontrol ediliyor...\n',
    PREMIUM_SLOT_FOUND: '\n📅 PREMIUM SLOT SELECTION SAYFASI\n',
    PREMIUM_SLOT_NOT_FOUND: '❌ Premium Category\'de de slot yok!',
    PREMIUM_BOTH_CLOSED: 'Her iki kategori de kapalı - script sonlanıyor...',
    PREMIUM_FAILED: (msg) => `❌ Premium Category akışında hata: ${msg}`,
    PREMIUM_CAPTION_PAGE_CHECKING: '📋 Sayfa kontrol ediliyor (captcha var mı?)...',
    PREMIUM_CAPTCHA_RETRYING: (num, max) => `\n🔄 Captcha tekrar deneniyor (${num}/${max})...`,
    PREMIUM_CAPTCHA_FAILED: (msg) => `❌ Captcha hatası: ${msg}`,

    // === SLOT KONTROLÜ ===
    SLOT_OPEN: (cat) => `✅ ${cat}: Slotlar AÇIK! "Appointment Slot" label'ı bulundu!`,
    SLOT_TELEGRAM_SENT: '✅ Slot açık bildirimi Telegram\'a gönderildi!',
    SLOT_TELEGRAM_FAILED: (msg) => `Telegram bildirimi gönderilemedi: ${msg}`,
    SLOT_CLOSED: (cat) => `❌ ${cat}: Slotlar kapalı - "Appointment Slot" label'ı bulunamadı`,
    SLOT_NO_DATE_PICKER: (cat) => `🔔 AMA ${cat} SLOT SAYFASI AÇIK! Manuel kontrol öneriliyor...`,
    SLOT_NO_CALENDAR: (cat) => `🔔 AMA ${cat} SLOT SAYFASI AÇIK!`,

    // === TARİH TARAMA ===
    DATE_PICKER_SEARCHING: '🔍 Appointment Date picker aranıyor...',
    DATE_PICKER_FOUND: (id) => `✅ Görünür date picker bulundu: ${id}`,
    DATE_PICKER_NOT_FOUND: '❌ Date picker bulunamadı!',
    CALENDAR_OPENING: '📅 Date picker açılıyor...',
    CALENDAR_OPENED: (method) => `✅ Takvim ${method} ile açıldı!`,
    CALENDAR_METHOD_TRYING: (name) => `  Deneniyor: ${name}...`,
    CALENDAR_METHOD_FAILED: (name, msg) => `  ⚠️ ${name} başarısız: ${msg}`,
    CALENDAR_NOT_OPENED: '❌ Takvim açılamadı!',
    CALENDAR_ELEM_NOT_FOUND: '❌ Takvim elementi bulunamadı!',
    CALENDAR_ELEM_FOUND: (count) => `✅ ${count} takvim elementi bulundu`,
    CALENDAR_SEARCHING: (cat) => `\n🔍 ${cat} için TÜM AYLARI TARAYARAK YEŞİL TARİHLER ARANIYOR...\n`,
    CALENDAR_MONTH_CHECKING: (month) => `📅 Ay kontrol ediliyor: ${month}`,
    CALENDAR_MONTH_NO_HEADER: (idx) => `⚠️ Ay ${idx + 1}: Ay başlığı bulunamadı`,
    CALENDAR_DATES_FOUND: (count) => `  Toplam ${count} tarih elementi bulundu`,
    CALENDAR_NO_DATES: '⚠️ Hiç tarih elementi bulunamadı',
    CALENDAR_GREEN_DATE: (text, month, value) => `  ✅ YEŞİL TARİH: ${text} ${month} (${value})`,
    CALENDAR_MONTH_GREEN: (month, count) => `✅ ${month}: ${count} yeşil tarih bulundu!`,
    CALENDAR_MONTH_EMPTY: (month) => `⚪ ${month}: Yeşil tarih yok`,
    CALENDAR_NEXT_MONTH: (num, max) => `➡️ Sonraki aya geçildi (${num}/${max})\n`,
    CALENDAR_NEXT_MONTH_ERROR: (msg) => `⚠️ Sonraki aya geçiş hatası: ${msg}`,
    CALENDAR_MONTH_ERROR: (msg) => `⚠️ Ay tarama hatası: ${msg}`,
    CALENDAR_TOTAL_GREEN: (cat, count) => `\n📊 ${cat}: TOPLAM ${count} YEŞİL TARİH BULUNDU!\n`,
    CALENDAR_NO_DATES_FOUND: (cat) => `❌ ${cat}: HİÇBİR UYGUN TARİH YOK!`,
    CALENDAR_CLOSING: '\n📅 Takvim kapatılıyor...',
    CALENDAR_CLOSED: '✅ Takvim kapatıldı',
    CALENDAR_CLOSE_ERROR: (msg) => `⚠️ Takvim kapatma hatası (önemsiz): ${msg}`,
    SCAN_DONE: (cat) => `\n🎉 ${cat} RANDEVU TARAMASI TAMAMLANDI!\n`,

    // === TELEGRAM ===
    TELEGRAM_SENT: '✅ Telegram bildirimi gönderildi!',
    TELEGRAM_FAILED: (msg) => `❌ Telegram bildirimi gönderilemedi: ${msg}`,
    TELEGRAM_FAILED_SIMPLE: 'Telegram bildirimi gönderilemedi',

    // === NORMAL SLOT ===
    NORMAL_SLOT_FOUND: '\n📅 NORMAL CATEGORY - SLOT SELECTION SAYFASI\n',
    NORMAL_NO_SLOT: '⚠️ Normal Category\'de slot yok, Premium Category deneniyor...',

    // === GENEL HATA ===
    GLOBAL_ERROR: (msg) => `❌ Hata oluştu: ${msg}`,
};
