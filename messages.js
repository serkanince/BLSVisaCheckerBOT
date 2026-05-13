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
    EMAIL_NOT_FOUND: '❌ Email input bulunamadı',
    EMAIL_ENTERING: 'Email giriliyor...',
    EMAIL_SUCCESS: '✅ Email başarıyla girildi!',
    EMAIL_ERROR: (msg) => `Email doldurma hatası: ${msg}`,

    VERIFY_CLICKED: '✅ Doğrulama gönderildi',
    VERIFY_NOT_FOUND: '⚠️ btnVerify bulunamadı',

    PASSWORD_WAITING: 'Password sayfası bekleniyor...',
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
    BOOK_NOW_CLICKED: '✅ "Book Now" tıklandı',
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
    FORM_FILLING_DROPDOWNS: '📝 Form alanları dolduruluyor...',
    FORM_SUBMIT_CHECKING: '📋 Form submit sonrası sayfa kontrol ediliyor...',
    FORM_ALL_DONE: '✅ Form alanları tamamlandı',
    FORM_SUBMIT_SEARCHING: 'Submit aranıyor...',
    FORM_SUBMITTED: '✅ Form gönderildi!',
    FORM_SUBMITTED_JS: '✅ Form JS ile gönderildi!',
    FORM_SUBMIT_JS_FALLBACK: 'JS ile gönderiliyor...',
    APPOINTMENT_FOR_INFO: '📌 Appointment For: Individual (varsayılan)',

    JURISDICTION_FAILED: '❌ Jurisdiction seçilemedi, form gönderilemez!',
    LOCATION_FAILED: '❌ Location seçilemedi, form gönderilemez!',
    VISA_TYPE_FAILED: '❌ Visa Type seçilemedi, form gönderilemez!',
    VISA_SUB_TYPE_FAILED: '❌ Visa Sub Type seçilemedi, form gönderilemez!',
    CATEGORY_FAILED: '❌ Category seçilemedi, form gönderilemez!',

    // === DROPDOWN (Kendo — yalnızca sonuç satırı) ===
    DROPDOWN_SELECTED: (label, value) => `✅ ${label}: ${value} seçildi`,
    DROPDOWN_NOT_FOUND: (label) => `❌ ${label} dropdown bulunamadı`,
    DROPDOWN_NOT_SELECTED: (label, value) => `❌ ${label}: "${value}" seçilemedi`,
    DROPDOWN_ERROR: (label, msg) => `❌ ${label} dropdown: ${msg}`,

    // === TRY AGAIN / BOOK NOW ===
    TRY_AGAIN_LINK_CLICKED: '✅ Try Again (link) tıklandı',
    TRY_AGAIN_BTN_CLICKED: '✅ Try Again tıklandı',
    TRY_AGAIN_NOT_FOUND: '⚠️ Try Again butonu bulunamadı, Book Now\'a tıklanıyor...',
    BOOK_NOW_BTN_CLICKED: '✅ Book Now\'a tıklandı!',
    TRY_AGAIN_FAILED: (msg) => `❌ Try Again/Book Now hatası: ${msg}`,

    // === PREMIUM ===
    PREMIUM_FLOW_STARTING: '🌟 Premium kategori akışı',
    PREMIUM_FORM_FILLING: '📝 Premium form dolduruluyor...',
    PREMIUM_MODAL_SUMMARY: (text) => `✅ Premium modal: ${text.substring(0, 80).replace(/\s+/g, ' ').trim()}…`,
    PREMIUM_MODAL_ACCEPT_CLICKED: '✅ Accept butonuna tıklandı!',
    PREMIUM_MODAL_ACCEPT_NOT_FOUND: '⚠️ Accept butonu bulunamadı, devam ediliyor...',
    PREMIUM_MODAL_NOT_FOUND: '⚠️ Premium modal dialog bulunamadı (zaten kapanmış olabilir)',
    PREMIUM_MODAL_ERROR: (msg) => `⚠️ Modal dialog kontrolü sırasında hata (önemsiz): ${msg}`,
    PREMIUM_FORM_DONE: '✅ Premium form tamamlandı',
    PREMIUM_SUBMIT_SEARCHING: 'Submit aranıyor...',
    PREMIUM_SUBMITTED: '✅ Premium form gönderildi!',
    PREMIUM_SUBMITTED_JS: '✅ Premium form JS ile gönderildi!',
    PREMIUM_CHECKING: '📋 Premium form sonrası sayfa kontrolü...',
    PREMIUM_SLOT_FOUND: '📅 Premium slot seçim sayfası',
    PREMIUM_SLOT_NOT_FOUND: '❌ Premium Category\'de de slot yok!',
    PREMIUM_BOTH_CLOSED: 'Her iki kategori de kapalı - script sonlanıyor...',
    PREMIUM_FAILED: (msg) => `❌ Premium Category akışında hata: ${msg}`,
    PREMIUM_CAPTION_PAGE_CHECKING: '📋 Sayfa kontrol ediliyor (captcha var mı?)...',
    PREMIUM_CAPTCHA_RETRYING: (num, max) => `🔄 Captcha tekrar (${num}/${max})...`,
    PREMIUM_CAPTCHA_FAILED: (msg) => `❌ Captcha hatası: ${msg}`,

    // === SLOT KONTROLÜ ===
    SLOT_OPEN: (cat) => `✅ ${cat}: slotlar açık`,
    SLOT_TELEGRAM_SENT: '✅ Slot açık bildirimi Telegram\'a gönderildi!',
    SLOT_TELEGRAM_FAILED: (msg) => `Telegram bildirimi gönderilemedi: ${msg}`,
    SLOT_CLOSED: (cat) => `❌ ${cat}: slotlar kapalı`,
    SLOT_NO_DATE_PICKER: (cat) => `🔔 AMA ${cat} SLOT SAYFASI AÇIK! Manuel kontrol öneriliyor...`,
    SLOT_NO_CALENDAR: (cat) => `🔔 AMA ${cat} SLOT SAYFASI AÇIK!`,

    // === TARİH TARAMA ===
    DATE_PICKER_READY: '✅ Randevu tarihi alanı hazır',
    DATE_PICKER_NOT_FOUND: '❌ Date picker bulunamadı!',
    CALENDAR_OPENING: '📅 Takvim açılıyor...',
    CALENDAR_OPENED: (method) => `✅ Takvim açıldı (${method})`,
    CALENDAR_NOT_OPENED: '❌ Takvim açılamadı',
    CALENDAR_ELEM_NOT_FOUND: '❌ Takvim elementi yok',
    CALENDAR_ELEM_FOUND: (count) => `✅ Takvim: ${count} panel`,
    CALENDAR_SEARCHING: (cat) => `🔍 ${cat} — müsait tarihler taranıyor`,
    CALENDAR_MONTH_CHECKING: (month) => `📅 ${month}`,
    CALENDAR_MONTH_NO_HEADER: (idx) => `⚠️ Ay ${idx + 1}: başlık yok`,
    CALENDAR_NO_DATES: '⚠️ Bu ayda tarih hücresi yok',
    CALENDAR_MONTH_GREEN: (month, count) => `✅ ${month}: ${count} müsait gün`,
    CALENDAR_MONTH_EMPTY: (month) => `⚪ ${month}: müsait gün yok`,
    CALENDAR_NEXT_MONTH: (num, max) => `➡️ Sonraki ay (${num}/${max})`,
    CALENDAR_NEXT_MONTH_ERROR: (msg) => `⚠️ Sonraki aya geçiş hatası: ${msg}`,
    CALENDAR_MONTH_ERROR: (msg) => `⚠️ Ay tarama hatası: ${msg}`,
    CALENDAR_TOTAL_GREEN: (cat, count) => `📊 ${cat}: toplam ${count} müsait gün`,
    CALENDAR_NO_DATES_FOUND: (cat) => `❌ ${cat}: HİÇBİR UYGUN TARİH YOK!`,
    CALENDAR_CLOSING: '📅 Takvim kapatılıyor...',
    CALENDAR_CLOSED: '✅ Takvim kapatıldı',
    CALENDAR_CLOSE_ERROR: (msg) => `⚠️ Takvim kapatma hatası (önemsiz): ${msg}`,
    SCAN_DONE: (cat) => `🎉 ${cat} taraması bitti`,

    // === TELEGRAM ===
    TELEGRAM_SENT: '✅ Telegram bildirimi gönderildi!',
    TELEGRAM_FAILED: (msg) => `❌ Telegram bildirimi gönderilemedi: ${msg}`,
    TELEGRAM_FAILED_SIMPLE: 'Telegram bildirimi gönderilemedi',

    // === ŞEHİR AKIŞI ===
    CITY_SCAN_START: (name) => `🏙️ ${name} taraması başlıyor`,
    CITY_SCAN_DONE: (name) => `✅ ${name} taraması bitti`,
    CITY_SCAN_ERROR: (name, msg) => `❌ ${name} taraması sırasında hata: ${msg}`,
    ALL_CITIES_DONE: '🏁 Tüm şehirler tarandı',
    CITY_ORDER_INFO: (names) => `📋 Bu oturumda tarama sırası: ${names.join(' → ')}`,
    CITY_LAST_SAVED: (name) => `💾 Son taranan şehir: ${name} — bir sonraki şehirden başlanıyor`,

    // === BAŞVURU SAHİBİ KONUM AYARI ===
    LOCATION_SET_STARTING: (city) => `📍 Başvuru sahibi konumu: ${city}`,
    LOCATION_SET_EDIT_CLICKED: '✅ Edit butonuna tıklandı, popup bekleniyor...',
    LOCATION_SET_POPUP_READY: '✅ Konum seçim popup\'ı hazır.',
    LOCATION_SET_DROPDOWN_SET: (city) => `✅ Location "${city}" olarak seçildi.`,
    LOCATION_SET_VISA_TYPE_OK: '✅ Visa Type zaten Schengen Visa/ Short Term Visa.',
    LOCATION_SET_VISA_TYPE_SET: '✅ Visa Type Schengen Visa/ Short Term Visa olarak seçildi.',
    LOCATION_SET_PROCEED_CLICKED: '✅ Proceed butonuna tıklandı...',
    LOCATION_SET_SUBMIT_CLICKED: '✅ Submit butonuna tıklandı...',
    LOCATION_SET_ALERT_CLOSED: '✅ Alert kapatıldı - konum başarıyla güncellendi!',
    LOCATION_SET_DONE: (city) => `✅ Başvuru sahibi konumu güncellendi: ${city}`,
    LOCATION_SET_ERROR: (msg) => `❌ Konum ayarlanırken hata: ${msg}`,

    // === NORMAL SLOT ===
    NORMAL_SLOT_FOUND: '📅 Normal kategori — slot seçim sayfası',
    NORMAL_NO_SLOT: '⚠️ Normal Category\'de slot yok, Premium Category deneniyor...',

    // === GENEL HATA ===
    GLOBAL_ERROR: (msg) => `❌ Hata oluştu: ${msg}`,
};

