const Tesseract = require('tesseract.js')
const sharp = require('sharp')
const { By, until } = require('selenium-webdriver')

let ocrStats = {
  totalAttempts: 0,
  successfulReads: 0,
  threeDigitReads: 0,
  targetMatches: 0
}

function calculateOCRSuccessRate() {
  if (ocrStats.totalAttempts === 0) return 0;
  return (ocrStats.threeDigitReads / ocrStats.totalAttempts) * 100;
}

function resetOCRStats() {
  ocrStats = {
    totalAttempts: 0,
    successfulReads: 0,
    threeDigitReads: 0,
    targetMatches: 0
  }
}

// ============================================
// ADAPTİF PREPROCESSING
// ------------------------------------------------
// Sabit global threshold'lar soluk rakamları siliyordu: arka plandan
// PARLAKLK değil RENK TONU ile ayrılan rakamlar boş çıkıyordu.
// Bu üç adım 20 elle ayarlanmış renk konfigürasyonunun yerini aldı
// ve offline doğruluğu %74.1'den %94.4'e çıkardı.
// ============================================

// Her tile'ın kendi histogramından threshold hesapla (sabit sayı yerine)
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

// Arka plan = en sık kullanılan renk. Rakamlar arka plandan renk tonu ile
// ayrılır, bu yüzden arka plandan uzaklık onları hangi renkte olurlarsa
// olsunlar ayırır.
function colourDistanceMap(data, w, h) {
  const bucket = {};
  const q = v => (v >> 4) << 4;
  for (let i = 0; i < data.length; i += 3) {
    const k = `${q(data[i])},${q(data[i + 1])},${q(data[i + 2])}`;
    bucket[k] = (bucket[k] || 0) + 1;
  }
  const [br, bg, bb] = Object.entries(bucket).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const dist = new Float32Array(w * h); let max = 1;
  for (let p = 0, i = 0; i < data.length; i += 3, p++) {
    const d = Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb);
    dist[p] = d; if (d > max) max = d;
  }
  const out = Buffer.alloc(w * h);
  for (let p = 0; p < dist.length; p++) out[p] = Math.round((dist[p] / max) * 255);
  return out;
}

// Büyük blob'ları (rakam çizgileri) tut, küçükleri (gürültü/çizgi) at.
// Bu adım Tesseract'ın gürültülü tile'larda boş dönmesini engeller.
function filterComponents(bin, w, h, minPx) {
  const lbl = new Int32Array(w * h).fill(-1);
  const sizes = []; const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 || lbl[i] !== -1) continue;
    const id = sizes.length; let n = 0;
    stack.push(i); lbl[i] = id;
    while (stack.length) {
      const pq = stack.pop(); n++;
      const x = pq % w, y = (pq / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const qq = ny * w + nx;
        if (bin[qq] === 0 && lbl[qq] === -1) { lbl[qq] = id; stack.push(qq); }
      }
    }
    sizes.push(n);
  }
  const out = Buffer.alloc(w * h, 255);
  for (let i = 0; i < w * h; i++) {
    const id = lbl[i];
    if (id >= 0 && sizes[id] >= minPx) out[i] = 0;
  }
  return out;
}

// Adaptif preprocessing pipeline: colour distance → blur → normalize → otsu → upscale → component filter
async function preprocessAdaptive(imgBuffer, cfg) {
  const { data, info } = await sharp(imgBuffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const map = colourDistanceMap(data, info.width, info.height);
  let pipe = sharp(map, { raw: { width: info.width, height: info.height, channels: 1 } });
  if (cfg.blur) pipe = pipe.blur(cfg.blur);
  pipe = pipe.normalize();
  const g = await pipe.clone().raw().toBuffer();
  const thr = otsuThreshold(g);
  const scale = cfg.resize || 3;
  const binPng = await pipe.resize(info.width * scale, info.height * scale)
    .threshold(thr).negate().png().toBuffer();
  // Binarize edilmiş, büyütülmüş görüntüde component filter uygula
  const bi = await sharp(binPng).grayscale().raw().toBuffer({ resolveWithObject: true });
  const bin = Buffer.from(bi.data).map(v => (v < 128 ? 0 : 255));
  const cleaned = filterComponents(bin, bi.info.width, bi.info.height, cfg.minPx || 120);
  // Tesseract document-like input bekler: beyaz margin, ~300dpi
  return sharp(cleaned, { raw: { width: bi.info.width, height: bi.info.height, channels: 1 } })
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: '#fff' })
    .withMetadata({ density: 300 }).png().toBuffer();
}

// ============================================
// YARDIMCI: Tek bir kutu için OCR çalıştır
// TURBO MOD: Adaptif configs + erken çıkış
// ============================================
async function runOCRWithVoting(imgBuffer, boxIndex) {
  // Adaptif konfigürasyonlar. Tek başına biri bile %93 doğruluk veriyor;
  // varyasyonlar kenar durumlarını kapsıyor.
  // Eski sistem: 20 sabit threshold/renk config = %74.1
  // Yeni sistem: 6 adaptif config = %94.4
  const ocrConfigs = [
    { name: 'cd_b2_cc120',  blur: 2,   resize: 3, minPx: 120 },
    { name: 'cd_b2_cc60',   blur: 2,   resize: 3, minPx: 60 },
    { name: 'cd_b3_cc120',  blur: 3,   resize: 3, minPx: 120 },
    { name: 'cd_b15_cc120', blur: 1.5, resize: 3, minPx: 120 },
    { name: 'cd_b2_cc200',  blur: 2,   resize: 3, minPx: 200 },
    { name: 'cd_b25_cc80',  blur: 2.5, resize: 3, minPx: 80 },
  ];

  // Voting için sonuçları topla
  const results = {};
  const allResults = [];
  const EARLY_EXIT_VOTES = 3; // 3+ oy alınca dur (hız için)

  for (const config of ocrConfigs) {
    try {
      ocrStats.totalAttempts++;

      // Görüntüyü adaptif pipeline ile işle
      const processedBuffer = await preprocessAdaptive(imgBuffer, config);

      // OCR çalıştır - RAKAM-ONLY OPTİMİZASYONU
      const { data: { text, confidence } } = await Tesseract.recognize(
        processedBuffer,
        'eng',
        {
          logger: m => { },
          tessedit_char_whitelist: '0123456789',
          tessedit_pageseg_mode: '7', // Single text line — PSM 8 (single word) %44 vs burada %94
          tessedit_ocr_engine_mode: '1', // LSTM only - daha hızlı
          tessedit_create_hocr: '0', // HOCR çıktısını kapat (hız için)
          tessedit_create_tsv: '0', // TSV çıktısını kapat (hız için)
          tessedit_create_pdf: '0', // PDF çıktısını kapat (hız için)
          preserve_interword_spaces: '0', // Kelime arası boşlukları koruma (rakamlar için gerekli değil)
          classify_bln_numeric_mode: '1', // Numeric mode - sadece rakamlar için optimize
          textord_min_linesize: '2.5', // Minimum satır boyutu (küçük rakamlar için)
          classify_enable_learning: '0' // Öğrenmeyi kapat (hız için)
        }
      );

      // Sadece rakamları al
      const cleanText = text.replace(/\D/g, '');

      // 3 haneli mi kontrol et
      if (/^\d{3}$/.test(cleanText)) {
        ocrStats.threeDigitReads++;

        // Voting için say
        if (!results[cleanText]) {
          results[cleanText] = { count: 0, configs: [], totalConfidence: 0 };
        }
        results[cleanText].count++;
        results[cleanText].configs.push(config.name);
        results[cleanText].totalConfidence += confidence || 0;

        allResults.push({ text: cleanText, config: config.name, confidence });

        // ERKEN ÇIKIŞ: Yeterli oy alındıysa dur
        if (results[cleanText].count >= EARLY_EXIT_VOTES) {
          break;
        }
      }
    } catch (e) {
      // Sessizce atla
    }
  }

  // En çok oy alan sonucu bul
  let bestResult = null;
  let maxVotes = 0;

  for (const [text, data] of Object.entries(results)) {
    if (data.count > maxVotes) {
      maxVotes = data.count;
      bestResult = {
        text,
        votes: data.count,
        avgConfidence: data.totalConfidence / data.count,
        configs: data.configs
      };
    }
  }

  return { bestResult, allResults, results };
}

// ============================================
// ANA FONKSİYON: Captcha çözme
// ============================================
async function solveCaptchaInIframe(driver, retryCount = 0, maxRetries = 3, isLoginCaptcha = false) {
  try {
    if (retryCount === 0) {
      resetOCRStats();
    }

    // Rate limiting kontrolü
    try {
      const rateLimitElems = await driver.findElements(By.xpath("//*[contains(text(), 'maximum number of captcha request') or contains(text(), 'Please try after sometime')]"));
      if (rateLimitElems.length > 0) {
        console.log('😤 Rate limiting! Biraz sakinleşelim... 30 saniye mola ☕');
        await driver.sleep(60000);
        await driver.navigate().refresh();
        await driver.sleep(10000);
        if (retryCount < maxRetries) {
          return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
        }
        return;
      }
    } catch (e) { }

    // Hedef sayıyı bul
    const targetNumber = await findTargetNumber(driver);

    // Kutuları seç
    await selectCaptchaBoxes(driver, targetNumber);

    const successRate = calculateOCRSuccessRate();
    // Çok düşük başarı kontrolü
    if (successRate < 20 && ocrStats.targetMatches === 0 && ocrStats.totalAttempts > 50) {
      console.log('⚠️ OCR başarı oranı çok düşük, captcha kesiliyor...');
      await driver.switchTo().defaultContent();
      return;
    }

    await driver.sleep(4000);
    await driver.switchTo().defaultContent();

    // Alert kontrolü
    let alertPresent = false;
    try {
      while (true) {
        await driver.wait(until.alertIsPresent(), 1000);
        const alert = await driver.switchTo().alert();
        const alertText = await alert.getText();
        console.log('⚠️ Alert:', alertText);

        if (alertText.includes('maximum number of captcha request') || alertText.includes('Please try after sometime')) {
          await alert.accept();
          await driver.sleep(60000);
          await driver.navigate().refresh();
          await driver.sleep(10000);
          if (retryCount < maxRetries) {
            return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
          }
          return;
        }

        alertPresent = true;
        await alert.accept();
        await driver.sleep(1000);
      }
    } catch (e) { }

    if (alertPresent && retryCount < maxRetries) {
      console.log(`🔄 Captcha tekrar deneniyor (alert) (${retryCount + 1}/${maxRetries})`);
      await driver.sleep(2000 + Math.random() * 2000);
      return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
    }

    // Invalid captcha kontrolü
    let invalid = false;
    try {
      const errorElems = await driver.findElements(By.xpath("//*[contains(text(), 'Invalid captcha') or contains(text(), 'invalid captcha') or contains(text(), 'Geçersiz')]"));
      if (errorElems.length > 0) {
        invalid = true;
        console.log('❌ Invalid captcha mesajı bulundu!');
      }

      const modalOpen1 = await driver.findElements(By.css('iframe[title="Verify Selection"]'));
      const modalOpen2 = await driver.findElements(By.css('iframe[title="Verify Registration"]'));
      if ((modalOpen1.length > 0 || modalOpen2.length > 0) && !invalid) {
        invalid = true;
        console.log('❌ CAPTCHA modal hala açık!');
      }
    } catch (e) { }

    if (invalid) {
      // Login captcha ise üst seviyeye fırlat (password kontrolü için)
      // Diğer captcha'lar için kendi retry'ını yap
      if (isLoginCaptcha) {
        console.log('⚠️ Invalid login captcha - üst seviyede retry yapılacak (password kontrolü için)');
        throw new Error('Invalid captcha - password kontrolü gerekli');
      } else if (retryCount < maxRetries) {
        console.log(`🔄 Tekrar deneyelim! Pes etmiyoruz 💪 (${retryCount + 1}/${maxRetries})`);
        await driver.sleep(3000 + Math.random() * 3000);
        return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
      } else {
        console.log('😢 Maksimum deneme aşıldı, captcha bu sefer olmadı...');
      }
    } else {
      await driver.sleep(1000);

      // Kalan alertleri temizle
      try {
        while (true) {
          await driver.wait(until.alertIsPresent(), 1000);
          const alert = await driver.switchTo().alert();
          await alert.accept();
          await driver.sleep(1000);
        }
      } catch (e) { }

      // btnSubmit varsa tıkla
      try {
        await driver.wait(until.elementLocated(By.id('btnSubmit')), 5000);
        const submitBtn = await driver.findElement(By.id('btnSubmit'));
        await submitBtn.click();
        console.log('✅ btnSubmit tıklandı');
      } catch (e) { }
    }
  } catch (e) {
    console.log(`❌ Captcha hatası: ${e.message}`);

    // Alert temizle
    try {
      while (true) {
        await driver.wait(until.alertIsPresent(), 1000);
        const alert = await driver.switchTo().alert();
        const alertText = await alert.getText();

        if (alertText.includes('maximum number of captcha request')) {
          await alert.accept();
          console.log('😤 Rate limiting! Hata fırlatılıyor, üst seviyede yeniden denenecek...');
          throw new Error('Rate limiting - sayfa refresh gerekli');
        }

        await alert.accept();
        await driver.sleep(1000);
      }
    } catch (e2) {
      // e2 bizim fırlattığımız hata olabilir, tekrar fırlat
      if (e2.message && e2.message.includes('Rate limiting')) {
        throw e2;
      }
    }

    // Login captcha için özel hatalar - direkt üst seviyeye fırlat (password kontrolü için)
    if (e.message && (
      e.message.includes('password kontrolü gerekli') ||
      e.message.includes('Hedef sayı bulunamadı')
    )) {
      if (isLoginCaptcha) {
        console.log('🔄 Hata üst seviyeye iletiliyor (password kontrolü için)...');
        throw e;
      }
    }

    // Diğer hatalar için retry yap
    if (retryCount < maxRetries) {
      console.log(`🔄 Tekrar deneniyor... (${retryCount + 1}/${maxRetries})`);
      return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
    } else {
      throw e; // Maksimum deneme aşıldı, hatayı fırlat
    }
  }
}

// ============================================
// Hedef sayıyı bul
// ============================================
async function findTargetNumber(driver) {
  let isInIframe = false;

  // Hedef sayı metnini bul
  let labelDivs = await driver.findElements(By.css('div.box-label'));

  if (labelDivs.length === 0) {
    labelDivs = await driver.findElements(By.xpath("//*[contains(text(), 'number ') or contains(text(), 'Please select')]"));
  }

  let visibleDivs = [];
  for (let div of labelDivs) {
    try {
      const isDisplayed = await div.isDisplayed();
      if (isDisplayed) {
        const text = await div.getText();
        const opacity = await div.getCssValue('opacity');
        const display = await div.getCssValue('display');
        const visibility = await div.getCssValue('visibility');

        if (opacity === '1' && display !== 'none' && visibility !== 'hidden') {
          const zIndexRaw = await div.getCssValue('z-index');
          const zIndex = parseInt(zIndexRaw) || 0;
          const rect = await div.getRect();
          visibleDivs.push({ div, zIndex, y: rect.y, text });
        }
      }
    } catch (e) { }
  }

  if (visibleDivs.length === 0) {
    if (isInIframe) await driver.switchTo().defaultContent();
    throw new Error('Hedef sayı metni bulunamadı!');
  }

  // En üstteki görünür div'i al
  visibleDivs.sort((a, b) => b.zIndex - a.zIndex || a.y - b.y);
  const visibleText = visibleDivs[0].text;

  const match = visibleText.match(/number (\d+)/);
  if (isInIframe) await driver.switchTo().defaultContent();

  if (match) {
    return match[1];
  }

  throw new Error('Hedef sayı bulunamadı!');
}

// ============================================
// Kutuları seç - VOTING SİSTEMİ İLE
// ============================================
async function selectCaptchaBoxes(driver, targetNumber) {
  let isInIframe = false;

  // Kutuları bul
  let boxImgs = await driver.findElements(By.css('div.col-4 img'));

  if (boxImgs.length === 0) {
    boxImgs = await driver.findElements(By.css('img[src*="data:image"]'));
  }

  // Tüm kutuları pozisyon ve z-index ile topla
  const allBoxes = [];
  for (let [i, img] of boxImgs.entries()) {
    try {
      const rect = await img.getRect();
      if (rect.width < 10 || rect.height < 10) continue;
      const parentDiv = await img.findElement(By.xpath('..'));
      const zIndexRaw = await parentDiv.getCssValue('z-index');
      const zIndex = parseInt(zIndexRaw) || 1;
      const posKey = `${Math.round(rect.y)}_${Math.round(rect.x)}`;
      allBoxes.push({ index: i, img, parentDiv, zIndex, rect, posKey });
    } catch (e) { }
  }

  // Pozisyona göre grupla, her pozisyonda en üstteki kutuyu al
  const positionMap = {};
  for (const box of allBoxes) {
    if (!positionMap[box.posKey]) positionMap[box.posKey] = [];
    positionMap[box.posKey].push(box);
  }

  const boxesToScan = [];
  for (const [posKey, boxes] of Object.entries(positionMap)) {
    boxes.sort((a, b) => b.zIndex - a.zIndex);
    boxesToScan.push(boxes[0]);
  }

  boxesToScan.sort((a, b) => {
    if (Math.abs(a.rect.y - b.rect.y) > 20) return a.rect.y - b.rect.y;
    return a.rect.x - b.rect.x;
  });

  let clickedCount = 0;

  for (let [idx, box] of boxesToScan.entries()) {
    const { index: i, img, parentDiv } = box;

    try {
      // Base64 görüntüyü al
      const base64src = await img.getAttribute('src');
      if (!base64src || !base64src.includes('base64')) continue;

      const imgBuffer = Buffer.from(base64src.split(',')[1], 'base64');

      // Voting ile OCR çalıştır
      const { bestResult } = await runOCRWithVoting(imgBuffer, i);

      if (bestResult) {
        // Hedef sayı eşleşiyor mu?
        if (bestResult.text === targetNumber) {
          ocrStats.targetMatches++;

          // 🛡️ ZATEN SEÇİLİ Mİ KONTROL ET - img-selected class'ı varsa tıklama!
          let alreadySelected = false;
          try {
            const imgClass = await img.getAttribute('class');
            if (imgClass && imgClass.includes('img-selected')) {
              alreadySelected = true;
              clickedCount++; // Sayıya dahil et ama tıklama
            }
          } catch (e) { }

          if (!alreadySelected) {
            // HEMEN TIKLA - stale element olmadan
            let clicked = false;
            try {
              await parentDiv.click();
              clicked = true;
            } catch (e1) {
              try {
                await driver.executeScript('arguments[0].click();', parentDiv);
                clicked = true;
              } catch (e2) {
                try {
                  await img.click();
                  clicked = true;
                } catch (e3) {
                  await driver.executeScript('arguments[0].click();', img);
                  clicked = true;
                }
              }
            }

            if (clicked) {
              clickedCount++;
            }
          }
        }
      }
    } catch (e) {
      // Sessizce devam et
    }
  }

  let submitted = false;

  const submitMethods = [
    { selector: 'i#submit', name: 'i#submit' },
    { selector: 'div.img-action-div[onclick*="onSubmit"]', name: 'div.img-action-div' },
    { selector: 'button[type="submit"]', name: 'button[type=submit]' },
    { selector: '.submit-btn', name: '.submit-btn' }
  ];

  for (const method of submitMethods) {
    if (submitted) break;
    try {
      const elem = await driver.findElement(By.css(method.selector));
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", elem);
      await driver.sleep(600);
      await driver.executeScript("arguments[0].click();", elem);
      submitted = true;
    } catch (e) { }
  }

  // Son çare: JS fonksiyonu çağır
  if (!submitted) {
    try {
      await driver.executeScript('if(typeof onSubmit === "function") onSubmit();');
      submitted = true;
    } catch (e) { }
  }

  const submitOk = submitted;
  console.log(
    `Captcha ${targetNumber}: ${clickedCount}/${boxesToScan.length} kutu${submitOk ? ', gönderildi' : ', submit yok'}`
  );

  await driver.sleep(4000);
  if (isInIframe) await driver.switchTo().defaultContent();
}

module.exports = {
  solveCaptchaInIframe,
  findTargetNumber,
  selectCaptchaBoxes,
  calculateOCRSuccessRate,
  resetOCRStats,
  ocrStats
}
