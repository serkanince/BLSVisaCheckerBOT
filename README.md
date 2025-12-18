# 🤖 BLS Vize Randevu Bulucu

BLS Turkey İspanya vize randevularını otomatik bulan bot.

## 📋 Ne İşe Yarar?

BLS Turkey sitesinde İspanya vizesi randevularını 7/24 kontrol eder, uygun randevu bulduğunda Telegram'dan haber verir.

## 🚀 Hızlı Başlangıç

```bash
# Kurulum
npm install
brew install chromedriver  # macOS için

# Yapılandırma
cp .env.example .env        # .env dosyasını düzenle

# Başlat
npm start
```

## ⚙️ Yapılandırma

`.env` dosyasını düzenleyin:

```env
EMAIL=bls_hesap_email@example.com
PASSWORD=bls_hesap_sifresi

# Telegram (opsiyonel ama önerilir)
TELEGRAM_BOT_TOKEN=bot_tokeniniz
TELEGRAM_CHAT_ID=chat_id_niz
```

**Telegram Bot Oluşturma:**
1. [@BotFather](https://t.me/BotFather) → `/newbot` → Token'ı kopyala
2. [@userinfobot](https://t.me/userinfobot) → Chat ID'yi kopyala

## 🎯 Nasıl Çalışır?

1. **Otomatik Giriş:** BLS hesabınıza giriş yapar
2. **Captcha Çözme:** Tesseract OCR ile captcha'ları çözer (10 farklı yöntem)
3. **Form Doldurma:** Ankara + Schengen Turist vizesi formunu doldurur
4. **Takvim Tarama:** 12 aya kadar yeşil (uygun) tarihleri arar
5. **Telegram Bildirimi:** Randevu bulursa size haber verir
6. **Döngü:** Her 15 dakikada tekrar kontrol eder

## 📱 Bildirimler

- 🎉 **Randevu Bulundu:** Uygun tarihler ve direkt link
- ❌ **Randevu Yok:** Tarama tamamlandı, randevu bulunamadı
- 🚫 **Randevular Kapalı:** Sistemde slot açılmamış
- ⚠️ **Hata:** Form veya captcha hataları

## 🔧 Teknik Detaylar

### Dosya Yapısı
```
├── app.js              # Ana bot mantığı
├── captchaSolver.js    # OCR captcha çözücü
├── telegramNotifier.js # Telegram bildirimleri
├── main.js             # Döngü yönetimi
└── .env                # Konfigürasyon
```

### Kullanılan Teknolojiler
- **Selenium WebDriver:** Tarayıcı otomasyonu
- **Tesseract.js:** OCR görüntü tanıma
- **Sharp:** Görüntü işleme
- **Axios:** Telegram API

### Öne Çıkan Özellikler
- **Dinamik Element Seçimi:** BLS'in değişken ID'lerinden bağımsız
- **RGB Renk Analizi:** Yeşil tarihleri algılama
- **Deep Scan:** Çizgili rakamlar için gelişmiş OCR
- **Hata Yönetimi:** Otomatik retry ve refresh
- **Kendo UI Desteği:** Dropdown ve datepicker kontrolü

### Performans
- 🕐 Tarama Süresi: ~3-5 dakika (12 ay)
- ✅ Captcha Başarı: %60-75
- 🔄 Kontrol Aralığı: 15 dakika
- 📅 Maksimum Tarama: 12 ay

## 🛠 Sorun Giderme

```bash
# ChromeDriver izin hatası
xattr -d com.apple.quarantine $(which chromedriver)

# Homebrew izin hatası
sudo chown -R $USER /opt/homebrew/Cellar

# Node.js versiyon hatası (v23+ için)
npm update tesseract.js
```

## ⚙️ Özelleştirme

`app.js` içinde:
```javascript
const maxMonthsToCheck = 12;    // Kaç ay ileriye bakılacak
const maxLoginRetries = 3;       // Giriş deneme sayısı
const maxCaptchaRetries = 3;     // Captcha deneme sayısı
```

`main.js` içinde:
```javascript
const interval = 15 * 60 * 1000; // Kontrol aralığı (ms)
```

## ⚠️ Önemli Notlar

- Bot sadece **Ankara** lokasyonu için optimize edilmiştir
- Telegram bildirimleri **strongly recommended** (7/24 çalışma için)
- `.env` dosyasını **asla paylaşmayın**
- Randevu bulunca **hızla dolabilir**, beklemeden giriş yapın

---

💡 **Pro Tip:** Botu sunucuda 7/24 çalıştırın, Telegram sayesinde her yerden bildirim alırsınız!
