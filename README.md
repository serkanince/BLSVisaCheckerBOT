# 🤖 BLS Vize Randevu Bulucu

<p align="center">
  <img src="./logo.png" alt="BLS Visa Checker Logo" width="512">
</p>


BLS Turkey İspanya vize randevularını otomatik olarak takip eden ve uygun slot bulduğunda Telegram üzerinden haber veren bir otomasyon aracıdır.

## 🚀 Hızlı Başlangıç

### 1. Hazırlık
Sisteminizde Node.js yüklü olmalıdır. MacOS veya Linux terminalinde:
```bash
npm install
```
> [!NOTE]
> Selenium 4+ sayesinde ChromeDriver otomatik olarak yönetilir, manuel kuruluma gerek yoktur.


### 2. Yapılandırma
`.env.example` dosyasını `.env` olarak kopyalayın ve bilgilerinizi girin:
```env
EMAIL=BLS_EMAIL
PASSWORD=BLS_PASSWORD

# Telegram Bildirimleri (Önerilir)
TELEGRAM_BOT_TOKEN=bot_token
TELEGRAM_CHAT_ID=chat_id
```

### 3. Çalıştır
```bash
npm start
```

## 🎯 Temel Özellikler
- **7/24 Takip:** Özelleştirilebilir aralıklarla.
- **Akıllı Çözümler:** OCR desteği ile captcha'ları %70+ başarıyla aşar.
- **Geniş Tarama:** 12 ay ilerisine kadar tüm uygun tarihleri kontrol eder.
- **Anlık Bildirim:** Randevu bulunduğunda direkt link ile Telegram mesajı gönderir.

## 🔧 Teknik Yapı
- **Selenium WebDriver:** Tarayıcı otomasyonu.
- **Tesseract.js:** Görüntü işleme ve OCR.
- **Node.js:** Ana çalışma ortamı.

## ⚠️ Önemli Notlar
- Şu an için sadece **Ankara** ofisi için optimize edilmiştir.
- Randevu slotları hızla dolabildiği için bildirim gelir gelmez işlem yapmanız önerilir.
- `.env` dosyanızın güvenliğini sağlayın ve kimseyle paylaşmayın.

