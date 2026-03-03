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
// YARDIMCI: Görüntü işleme pipeline'ı
// ============================================
async function processImageForOCR(imgBuffer, config) {
  try {
    let pipeline = sharp(imgBuffer);

    // 1. Kanal seçimi (RGB kanallarından birini al)
    if (config.channel === 'blue') {
      pipeline = sharp(await pipeline.extractChannel(2).toBuffer());
    } else if (config.channel === 'green') {
      pipeline = sharp(await pipeline.extractChannel(1).toBuffer());
    } else if (config.channel === 'red') {
      pipeline = sharp(await pipeline.extractChannel(0).toBuffer());
    } else {
      // Grayscale yap
      pipeline = pipeline.grayscale();
    }

    // 2. Boyutlandırma (hız için optimize - 2x yeterli)
    const resizeFactor = config.resize || 2;
    pipeline = pipeline.resize({
      width: 120 * resizeFactor,
      height: 60 * resizeFactor,
      kernel: sharp.kernel.nearest, // En hızlı kernel
      fit: 'fill'
    });

    // 3. Kontrast ve parlaklık ayarı
    if (config.brightness || config.contrast) {
      // linear(a, b) -> output = input * a + b
      const contrast = config.contrast || 1.0;
      const brightness = config.brightness || 1.0;
      pipeline = pipeline.linear(contrast, (brightness - 1) * 128);
    }

    // 4. Gamma düzeltmesi
    if (config.gamma) {
      pipeline = pipeline.gamma(config.gamma);
    }

    // 5. Normalize (histogram equalization)
    if (config.normalize) {
      pipeline = pipeline.normalize();
    }

    // 6. Median blur (çizgileri silmek için çok etkili!)
    if (config.median) {
      pipeline = pipeline.median(config.median);
    }

    // 7. Blur (gürültü azaltma)
    if (config.blur) {
      pipeline = pipeline.blur(config.blur);
    }

    // 8. Sharpen (keskinleştirme)
    if (config.sharpen) {
      if (typeof config.sharpen === 'object') {
        pipeline = pipeline.sharpen(config.sharpen.sigma, config.sharpen.flat, config.sharpen.jagged);
      } else {
        pipeline = pipeline.sharpen();
      }
    }

    // 9. Threshold (binary görüntü oluştur)
    if (config.threshold) {
      pipeline = pipeline.threshold(config.threshold);
    }

    // 10. Invert (renkleri tersine çevir)
    if (config.invert) {
      pipeline = pipeline.negate();
    }

    // 11. Morphological işlemler (dilate/erode simülasyonu)
    if (config.morphKernel) {
      pipeline = pipeline.convolve({
        width: 3,
        height: 3,
        kernel: config.morphKernel
      });
    }

    return await pipeline.png().toBuffer();
  } catch (err) {
    // Sessizce devam et, farklı yöntemler deneyecek
    return imgBuffer;
  }
}

// ============================================
// YARDIMCI: Tek bir kutu için OCR çalıştır
// TURBO MOD: 5 yöntem + erken çıkış
// ============================================
async function runOCRWithVoting(imgBuffer, boxIndex) {
  // 12 OCR konfigürasyonu - TÜM RENKLER İÇİN OPTİMİZE (yeşil, pembe, turuncu, altın)
  const ocrConfigs = [
    // === TEMEL (en hızlı) ===
    { name: 'fast_1', threshold: 150, resize: 2, contrast: 1.6, brightness: 1.2, normalize: true, sharpen: true },
    { name: 'fast_2', threshold: 180, resize: 2, contrast: 2.0, brightness: 1.4, normalize: true, sharpen: true },

    // === YEŞİL KANAL (yeşil yazı için PERFECT!) ===
    { name: 'green', channel: 'green', threshold: 140, resize: 2, contrast: 2.0, brightness: 1.2, normalize: true, sharpen: true },

    // === KIRMIZI KANAL + INVERT (pembe arka plan yakalar, invert ile yeşil yazı çıkar) ===
    { name: 'red_inv', channel: 'red', threshold: 130, resize: 2, contrast: 1.8, brightness: 1.3, invert: true, normalize: true, sharpen: true },

    // === YEŞİL ZEMİN + AÇIK YEŞİL YAZI (camouflage kombinasyon) ===
    // Green channel işe yaramaz (hem bg hem yazı yeşil görünür), blue+invert ile kontrast sağlanır
    { name: 'lightgreen_blue_inv', channel: 'blue', threshold: 120, resize: 2, contrast: 3.0, brightness: 1.5, invert: true, normalize: true, sharpen: true },
    { name: 'lightgreen_red_inv', channel: 'red', threshold: 110, resize: 2, contrast: 3.0, brightness: 1.6, invert: true, normalize: true, sharpen: true },
    { name: 'lightgreen_blue_2', channel: 'blue', threshold: 100, resize: 3, contrast: 3.5, brightness: 1.4, invert: true, normalize: true, sharpen: true, gamma: 0.8 },

    // === PEMBE ZEMİN + CYAN/TURKUAZ YAZI (camouflage kombinasyon) ===
    // Cyan = yüksek mavi, düşük kırmızı. Pembe zemin = yüksek kırmızı, orta mavi
    // Blue channel'da: cyan yazı parlak, pembe zemin karanlık → mükemmel kontrast!
    { name: 'cyan_blue_1', channel: 'blue', threshold: 130, resize: 2, contrast: 2.8, brightness: 1.4, normalize: true, sharpen: true },
    { name: 'cyan_blue_2', channel: 'blue', threshold: 110, resize: 3, contrast: 3.2, brightness: 1.5, normalize: true, sharpen: true },
    // Underline/çizgi varsa median ile sil, sonra blue channel oku
    { name: 'cyan_median_blue', channel: 'blue', threshold: 120, resize: 2, contrast: 2.5, brightness: 1.4, median: 3, normalize: true, sharpen: true },
    // Invert versiyonu (bazen ters kontrast daha iyi sonuç verir)
    { name: 'cyan_blue_inv', channel: 'blue', threshold: 140, resize: 2, contrast: 3.0, brightness: 1.3, invert: true, normalize: true, sharpen: true },

    // === PEMBE RAKAMLAR İÇİN YENİ KONFİGÜRASYONLAR ===
    { name: 'pink_1', channel: 'red', threshold: 120, resize: 2, contrast: 2.5, brightness: 1.4, normalize: true, sharpen: true },
    { name: 'pink_2', channel: 'red', threshold: 100, resize: 2, contrast: 3.0, brightness: 1.5, normalize: true, sharpen: true },

    // === TURUNCU/ALTIN RAKAMLAR İÇİN YENİ KONFİGÜRASYONLAR ===
    { name: 'orange_1', channel: 'red', threshold: 110, resize: 2, contrast: 2.2, brightness: 1.3, normalize: true, sharpen: true },
    { name: 'orange_2', threshold: 140, resize: 2, contrast: 2.4, brightness: 1.4, normalize: true, sharpen: true, gamma: 1.2 },

    // === MEDİAN (çizgili rakamlar) ===
    { name: 'median', threshold: 160, resize: 2, contrast: 1.8, brightness: 1.3, median: 3, normalize: true, sharpen: true },

    // === MAVİ KANAL ===
    { name: 'blue', channel: 'blue', threshold: 150, resize: 2, contrast: 1.7, brightness: 1.3, normalize: true, sharpen: true },

    // === DÜŞÜK THRESHOLD (koyu yazılar) ===
    { name: 'low_thr', threshold: 100, resize: 2, contrast: 2.2, brightness: 1.5, normalize: true, sharpen: true },

    // === YÜKSEK THRESHOLD + INVERT (açık yazılar) ===
    { name: 'high_inv', threshold: 200, resize: 2, contrast: 1.8, brightness: 1.4, invert: true, normalize: true, sharpen: true },

    // === RENK BAĞIMSIZ GENEL (tüm renkler için) ===
    { name: 'universal', threshold: 130, resize: 3, contrast: 2.5, brightness: 1.3, normalize: true, sharpen: true, gamma: 1.1 },
  ];

  // Voting için sonuçları topla
  const results = {};
  const allResults = [];
  const EARLY_EXIT_VOTES = 3; // 3+ oy alınca dur (hız için)

  for (const config of ocrConfigs) {
    try {
      ocrStats.totalAttempts++;

      // Görüntüyü işle
      const processedBuffer = await processImageForOCR(imgBuffer, config);

      // OCR çalıştır - RAKAM-ONLY OPTİMİZASYONU
      const { data: { text, confidence } } = await Tesseract.recognize(
        processedBuffer,
        'eng',
        {
          logger: m => { },
          tessedit_char_whitelist: '0123456789',
          tessedit_pageseg_mode: '8', // Single word mode - rakamlar için ideal
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
        await driver.sleep(30000);
        await driver.navigate().refresh();
        await driver.sleep(5000);
        if (retryCount < maxRetries) {
          return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
        }
        return;
      }
    } catch (e) { }

    // Hedef sayıyı bul
    const targetNumber = await findTargetNumber(driver);
    console.log(`\n🎯 Hedef sayımız: ${targetNumber} - Hadi onu bulalım! 💪\n`);

    // Kutuları seç
    await selectCaptchaBoxes(driver, targetNumber);

    const successRate = calculateOCRSuccessRate();
    // Çok düşük başarı kontrolü
    if (successRate < 20 && ocrStats.targetMatches === 0 && ocrStats.totalAttempts > 50) {
      console.log('⚠️ OCR başarı oranı çok düşük, captcha kesiliyor...');
      await driver.switchTo().defaultContent();
      return;
    }

    await driver.sleep(2000);
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
          await driver.sleep(30000);
          await driver.navigate().refresh();
          await driver.sleep(5000);
          if (retryCount < maxRetries) {
            return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries, isLoginCaptcha);
          }
          return;
        }

        alertPresent = true;
        await alert.accept();
        await driver.sleep(500);
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
      await driver.sleep(500);

      // Kalan alertleri temizle
      try {
        while (true) {
          await driver.wait(until.alertIsPresent(), 1000);
          const alert = await driver.switchTo().alert();
          await alert.accept();
          await driver.sleep(500);
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
        await driver.sleep(500);
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

  console.log(`📦 ${boxImgs.length} kutu → ${boxesToScan.length} benzersiz pozisyon taranacak`);

  let clickedCount = 0;

  for (let [idx, box] of boxesToScan.entries()) {
    const { index: i, img, parentDiv } = box;

    try {
      // Base64 görüntüyü al
      const base64src = await img.getAttribute('src');
      if (!base64src || !base64src.includes('base64')) continue;

      const imgBuffer = Buffer.from(base64src.split(',')[1], 'base64');

      // Voting ile OCR çalıştır
      const { bestResult, results } = await runOCRWithVoting(imgBuffer, i);

      if (bestResult) {
        const votingInfo = Object.entries(results)
          .map(([text, data]) => `${text}(${data.count})`)
          .join(', ');

        // Hedef sayı eşleşiyor mu?
        if (bestResult.text === targetNumber) {
          ocrStats.targetMatches++;

          // 🛡️ ZATEN SEÇİLİ Mİ KONTROL ET - img-selected class'ı varsa tıklama!
          let alreadySelected = false;
          try {
            const imgClass = await img.getAttribute('class');
            if (imgClass && imgClass.includes('img-selected')) {
              alreadySelected = true;
              console.log(`\n🎯 Kutu #${idx + 1} → ${bestResult.text} (zaten seçili ✓)`);
              clickedCount++; // Sayıya dahil et ama tıklama
            }
          } catch (e) { }

          if (!alreadySelected) {
            console.log(`\n🎯 Buldum! Kutu #${idx + 1} → ${bestResult.text} ✨`);

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
              console.log(`   👆 Tık! Seçildi 💚`);
            }
          }
        } else {
          // Sadece yüksek oylu sonuçları göster
          if (bestResult.votes >= 5) {
            console.log(`   Kutu #${idx + 1}: ${bestResult.text} (${bestResult.votes} oy)`);
          }
        }
      }
    } catch (e) {
      // Sessizce devam et
    }
  }

  console.log('\n' + '═'.repeat(50));
  const resultEmoji = clickedCount >= 3 ? '🎉' : clickedCount > 0 ? '👍' : '😅';
  console.log(`${resultEmoji} ${clickedCount} kutu tıklandı! ${clickedCount >= 3 ? 'Mükemmel!' : clickedCount > 0 ? 'İyi gidiyoruz!' : 'Hmm, bi daha deneyelim...'}`);
  console.log('═'.repeat(50));

  // Submit butonu
  console.log('\n📤 Submit ediliyor...');
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
      await driver.sleep(300);
      await driver.executeScript("arguments[0].click();", elem);
      console.log(`   ✅ Submit başarılı (${method.name})`);
      submitted = true;
    } catch (e) { }
  }

  // Son çare: JS fonksiyonu çağır
  if (!submitted) {
    try {
      await driver.executeScript('if(typeof onSubmit === "function") onSubmit();');
      console.log('   ✅ Submit başarılı (JS onSubmit())');
      submitted = true;
    } catch (e) { }
  }

  if (!submitted) {
    console.log('   ⚠️ Submit butonu bulunamadı!');
  }

  await driver.sleep(2000);
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

