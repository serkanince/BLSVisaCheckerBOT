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

async function solveCaptchaInIframe(driver, retryCount = 0, maxRetries = 3) {
  try {
    if (retryCount === 0) {
      resetOCRStats();
    }

    try {
      const rateLimitElems = await driver.findElements(By.xpath("//*[contains(text(), 'maximum number of captcha request') or contains(text(), 'Please try after sometime')]"));
      if (rateLimitElems.length > 0) {
        console.log('Rate limiting hatası tespit edildi! 30 saniye bekleniyor...');
        await driver.sleep(30000);
        await driver.navigate().refresh();
        await driver.sleep(5000);
        console.log('Sayfa yenilendi, captcha tekrar deneniyor...');
        if (retryCount < maxRetries) {
          return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries);
        }
        return;
      }
    } catch (e) {}

    const targetNumber = await findTargetNumber(driver);
    console.log('Gerçek hedef sayı:', targetNumber);
    await selectCaptchaBoxes(driver, targetNumber);

    const successRate = calculateOCRSuccessRate();
    console.log(`OCR Başarı Oranı: ${successRate.toFixed(1)}% (${ocrStats.threeDigitReads}/${ocrStats.totalAttempts})`);
    
    if (successRate < 30 && ocrStats.targetMatches === 0 && ocrStats.totalAttempts > 5) {
      console.log('OCR başarı oranı çok düşük (%30 altında) ve hiç hedef eşleşmesi yok. Captcha kesiliyor...');
      await driver.switchTo().defaultContent();
      return;
    }

    await driver.sleep(2000);
    await driver.switchTo().defaultContent();

    let alertPresent = false;
    try {
      while (true) {
        await driver.wait(until.alertIsPresent(), 1000);
        const alert = await driver.switchTo().alert();
        const alertText = await alert.getText();
        console.log('Alert bulundu:', alertText);
        
        
        if (alertText.includes('maximum number of captcha request') || alertText.includes('Please try after sometime')) {
          console.log('Rate limiting alert found! 30 seconds waiting...');
          await alert.accept();
          await driver.sleep(30000);
          
          await driver.navigate().refresh();
          await driver.sleep(5000);
          console.log('Page refreshed, trying captcha again...');
          if (retryCount < maxRetries) {
            return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries);
          }
          return;
        }
        
        alertPresent = true;
        await alert.accept();
        await driver.sleep(500);
      }
    } catch (e) {
      
    }

    if (alertPresent && retryCount < maxRetries) {
      console.log(`Retrying captcha (alert)! (${retryCount + 1}/${maxRetries})`);
      await driver.sleep(2000 + Math.floor(Math.random() * 2000));
      await solveCaptchaInIframe(driver, retryCount + 1, maxRetries);
      return;
    } else if (alertPresent) {
      console.log('Max retry limit reached (alert), captcha solving failed.');
      return;
    }

    let invalid = false;
    try {
      const errorElems = await driver.findElements(By.xpath("//*[contains(text(), 'Invalid captcha') or contains(text(), 'invalid captcha') or contains(text(), 'Geçersiz') or contains(text(), 'Yanlış')]"));
      if (errorElems.length > 0) {
        invalid = true;
        console.log('Invalid captcha message found!');
      }
      const modalOpen1 = await driver.findElements(By.css('iframe[title="Verify Selection"]'));
      const modalOpen2 = await driver.findElements(By.css('iframe[title="Verify Registration"]'));
      if ((modalOpen1.length > 0 || modalOpen2.length > 0) && !invalid) {
        invalid = true;
        console.log('CAPTCHA modal is still open, retrying...');
      }
    } catch (e) {}

    if (invalid && retryCount < maxRetries) {
      console.log(`Retrying captcha... (${retryCount + 1}/${maxRetries})`);
      await driver.sleep(5000 + Math.floor(Math.random() * 5000));
      await solveCaptchaInIframe(driver, retryCount + 1, maxRetries);
    } else if (invalid) {
      console.log('Max retry limit reached, captcha solving failed.');
    } else {
      console.log('Captcha successfully solved or modal closed.');
      await driver.sleep(1000);
      try {
        while (true) {
          await driver.wait(until.alertIsPresent(), 1000);
          const alert = await driver.switchTo().alert();
          await alert.accept();
          await driver.sleep(500);
        }
      } catch (e) {}
      try {
        await driver.wait(until.elementLocated(By.id('btnSubmit')), 10000);
        const submitBtns = await driver.findElements(By.id('btnSubmit'));
        if (submitBtns.length > 0) {
          await submitBtns[0].click();
          console.log('btnSubmit button clicked (any page), continuing...');
        } else {
          console.log('btnSubmit button not found (any page)!');
        }
      } catch (e) {
        console.log('btnSubmit click error:', e.message);
      }
    }
  } catch (e) {
    try {
      let alertCleared = false;
      while (true) {
        await driver.wait(until.alertIsPresent(), 1000);
        const alert = await driver.switchTo().alert();
        const alertText = await alert.getText();
        console.log('Error alert found after:', alertText);

        if (alertText.includes('maximum number of captcha request') || alertText.includes('Please try after sometime')) {
          console.log('Rate limiting alert found! 30 seconds waiting...');
          await alert.accept();
          await driver.sleep(30000);
          
          await driver.navigate().refresh();
          await driver.sleep(5000);
          console.log('Page refreshed, retrying captcha...');
          if (retryCount < maxRetries) {
            return await solveCaptchaInIframe(driver, retryCount + 1, maxRetries);
          }
          return;
        }
        
        await alert.accept();
        await driver.sleep(500);
        alertCleared = true;
      }
    } catch (e2) {}
    if (retryCount < maxRetries) {
      console.log(`Error alert found, retrying... (${retryCount + 1}/${maxRetries})`);
      await solveCaptchaInIframe(driver, retryCount + 1, maxRetries);
    } else {
      console.log('Max retry limit reached (after error), captcha solving failed.');
    }
    return;
  }
}

async function findTargetNumber(driver) {
  let captchaFrame;
  let isInIframe = false;
  
  try {
    await driver.wait(until.elementLocated(By.css('iframe[title="Verify Selection"]')), 3000);
    captchaFrame = await driver.findElement(By.css('iframe[title="Verify Selection"]'));
    console.log('Verify Selection iframe found (second captcha)');
    isInIframe = true;
    await driver.switchTo().frame(captchaFrame);
  } catch (e) {
    try {
      await driver.wait(until.elementLocated(By.css('iframe[title="Verify Registration"]')), 3000);
      captchaFrame = await driver.findElement(By.css('iframe[title="Verify Registration"]'));
      console.log('Verify Registration iframe found (first captcha)');
      isInIframe = true;
      await driver.switchTo().frame(captchaFrame);
    } catch (e2) {
      console.log('Iframe bulunamadı, captcha doğrudan sayfada olabilir');
      isInIframe = false;
    }
  }

  // Hedef sayıyı bul - div.box-label veya "number XXX" içeren text
  let labelDivs = await driver.findElements(By.css('div.box-label'));
  
  // Alternatif: "Please select" veya "number" içeren tüm elementleri ara
  if (labelDivs.length === 0) {
    console.log('div.box-label bulunamadı, alternatif aranıyor...');
    labelDivs = await driver.findElements(By.xpath("//*[contains(text(), 'number ') or contains(text(), 'Please select')]"));
  }
  
  console.log(`${labelDivs.length} label elementi bulundu`);
  
  let visibleDivs = [];
  for (let div of labelDivs) {
    try {
      const isDisplayed = await div.isDisplayed();
      if (isDisplayed) {
        const text = await div.getText();
        console.log('Label metni:', text);
        const opacity = await div.getCssValue('opacity');
        const display = await div.getCssValue('display');
        const visibility = await div.getCssValue('visibility');
        if (opacity === '1' && display !== 'none' && visibility !== 'hidden') {
          let zIndexRaw = await div.getCssValue('z-index');
          let zIndex = Number.isNaN(parseInt(zIndexRaw)) ? -9999 : parseInt(zIndexRaw);
          const rect = await div.getRect();
          visibleDivs.push({div, zIndex, y: rect.y});
        }
      }
    } catch (e) {
      console.log('Label kontrol hatası:', e.message);
    }
  }
  if (visibleDivs.length === 0) {
    if (isInIframe) await driver.switchTo().defaultContent();
    throw new Error('Target number text not found!');
  }
  visibleDivs.sort((a, b) => {
    if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
    return a.y - b.y;
  });
  const topDiv = visibleDivs[0].div;
  const visibleText = await topDiv.getText();
  console.log('Hedef metin:', visibleText);
  const match = visibleText.match(/number (\d+)/);
  if (isInIframe) await driver.switchTo().defaultContent();
  if (match) {
    console.log('Hedef sayı bulundu:', match[1]);
    return match[1];
  }
  throw new Error('Target number not found in text!');
}

// Find the actual boxes, read with OCR, click those matching the target number, and submit
async function selectCaptchaBoxes(driver, targetNumber) {
  let isInIframe = false;
  
  // First, try the "Verify Selection" iframe (for the second captcha)
  try {
    await driver.wait(until.elementLocated(By.css('iframe[title="Verify Selection"]')), 3000);
    const captchaFrame = await driver.findElement(By.css('iframe[title="Verify Selection"]'));
    console.log('Verify Selection iframe found (second captcha)');
    isInIframe = true;
    await driver.switchTo().frame(captchaFrame);
  } catch (e) {
    // Otherwise, try the "Verify Registration" iframe (for the first captcha)
    try {
      await driver.wait(until.elementLocated(By.css('iframe[title="Verify Registration"]')), 3000);
      const captchaFrame = await driver.findElement(By.css('iframe[title="Verify Registration"]'));
      console.log('Verify Registration iframe found (first captcha)');
      isInIframe = true;
      await driver.switchTo().frame(captchaFrame);
    } catch (e2) {
      console.log('Iframe bulunamadı, captcha doğrudan sayfada');
      isInIframe = false;
    }
  }

  // Captcha kutularını bul - OPTIMIZE: Sadece görünür olanları bul
  let boxImgs = await driver.findElements(By.css('div.col-4 img'));
  
  // Eğer kutu bulunamadıysa, alternatif seçiciler dene
  if (boxImgs.length === 0) {
    console.log('div.col-4 img ile kutu bulunamadı, alternatif aranıyor...');
    boxImgs = await driver.findElements(By.css('img[src*="data:image"]'));
  }
  
  console.log(`Toplam ${boxImgs.length} captcha kutusu bulundu, görünür olanlar filtreleniyor...`);
  let visibleBoxes = [];
  
  // Daha esnek görünürlük kontrolü
  for (let [i, img] of boxImgs.entries()) {
    try {
      const rect = await img.getRect();
      
      // Sadece boyut kontrolü - display/opacity kontrolü kaldırıldı
      if (rect.width < 10 || rect.height < 10) continue;
      
      const parentDiv = await img.findElement(By.xpath('..'));
      const zIndexRaw = await parentDiv.getCssValue('z-index');
      const zIndex = Number.isNaN(parseInt(zIndexRaw)) ? 1 : parseInt(zIndexRaw);
      const opacity = await parentDiv.getCssValue('opacity');
      
      // Collect box information
      visibleBoxes.push({
        index: i,
        img: img,
        parentDiv: parentDiv,
        zIndex: zIndex,
        opacity: opacity,
        rect: rect
      });
      
    } catch (e) {
      // Sessizce atla
    }
  }
  
  console.log(`${visibleBoxes.length} kutu bulundu (rect kontrolü ile)`);

  // Sort visible boxes by z-index (higher z-index first)
  visibleBoxes.sort((a, b) => b.zIndex - a.zIndex);

  console.log(`Toplam ${visibleBoxes.length} görünür kutu bulundu, z-index'e göre sıralandı`);

  // OPTIMIZE: Sadece ilk 20 kutuyu tara (gerçek kutular genelde ilk 20'de)
  const maxBoxesToScan = Math.min(20, visibleBoxes.length);
  console.log(`İlk ${maxBoxesToScan} kutu OCR ile taranacak (toplam ${visibleBoxes.length} görünür kutu)...`);
  
  let foundAny = false;
  for (let visibleIdx = 0; visibleIdx < maxBoxesToScan; visibleIdx++) {
    const box = visibleBoxes[visibleIdx];
    const { index: i, img, parentDiv } = box;
    console.log(`[${visibleIdx + 1}/${maxBoxesToScan}] Kutu taranıyor (z-index: ${box.zIndex})`);

    try {
      const base64src = await img.getAttribute('src');
      let cleanText = '';
      let ocrSuccess = false;
      // 8 farklı OCR yöntemi - çizgili sayılar için optimize edilmiş
      let ocrTries = [
        { name: 'basic_high_contrast', threshold: 160, psm: 8, resize: 3, brightness: 1.3, contrast: 1.8, sharpen: true, normalize: true },
        { name: 'basic_low_contrast', threshold: 110, psm: 8, resize: 3, brightness: 1.2, contrast: 1.5, sharpen: true, normalize: true },
        { name: 'high_res_aggressive', threshold: 200, psm: 7, resize: 4, brightness: 1.5, contrast: 2.2, sharpen: true, normalize: true, blur: 0.3 },
        { name: 'blue_channel', channel: 'blue', threshold: 140, psm: 8, resize: 3, brightness: 1.3, contrast: 1.7, sharpen: true, normalize: true },
        { name: 'green_channel', channel: 'green', threshold: 140, psm: 8, resize: 3, brightness: 1.3, contrast: 1.7, sharpen: true, normalize: true },
        { name: 'red_channel', channel: 'red', threshold: 140, psm: 8, resize: 3, brightness: 1.3, contrast: 1.7, sharpen: true, normalize: true },
        { name: 'morphological_strong', threshold: 220, psm: 8, resize: 3, brightness: 1.6, contrast: 2.5, sharpen: true, normalize: true, erode: true },
        { name: 'invert_colors', threshold: 100, psm: 8, resize: 3, brightness: 1.4, contrast: 2.0, invert: true, sharpen: true, normalize: true }
      ];
      for (let tryIdx = 0; tryIdx < ocrTries.length; tryIdx++) {
        const config = ocrTries[tryIdx];
        let processedBuffer;
        try {
          let sharpImg = sharp(Buffer.from(base64src.split(',')[1], 'base64')).grayscale();
          // Color channel-based processing
          if (config.channel) {
            const raw = await sharp(Buffer.from(base64src.split(',')[1], 'base64')).raw().toBuffer({ resolveWithObject: true });
            const { data, info } = raw;
            let channelIdx = 0;
            if (config.channel === 'red') channelIdx = 0;
            if (config.channel === 'green') channelIdx = 1;
            if (config.channel === 'blue') channelIdx = 2;
            // Only take the relevant channel
            let channelData = Buffer.alloc(info.width * info.height);
            for (let px = 0; px < info.width * info.height; px++) {
              channelData[px] = data[px * info.channels + channelIdx];
            }
            sharpImg = sharp(channelData, { raw: { width: info.width, height: info.height, channels: 1 } });
          }
          sharpImg = sharpImg.resize({ width: 150 * (config.resize || 2), height: 80 * (config.resize || 2), kernel: sharp.kernel.nearest });
          if (config.brightness !== 1.0 || config.contrast !== 1.0) {
            sharpImg = sharpImg.modulate({ brightness: config.brightness, contrast: config.contrast });
          }
          if (config.gamma) {
            sharpImg = sharpImg.gamma(config.gamma);
          }
          if (config.normalize) {
            sharpImg = sharpImg.normalize();
          }
          if (config.blur) {
            sharpImg = sharpImg.blur(config.blur);
          }
          if (config.sharpen) {
            sharpImg = sharpImg.sharpen();
          }
          if (config.emboss) {
            sharpImg = sharpImg.convolve({ width: 3, height: 3, kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2] });
          }
          if (config.invert) {
            sharpImg = sharpImg.negate();
          }
          sharpImg = sharpImg.threshold(config.threshold);
          if (config.erode) {
            sharpImg = sharpImg.convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, 1, 1, 0, 1, 0] });
          }
          // ALWAYS TAKE AS PNG
          processedBuffer = await sharpImg.png().toBuffer();
        } catch (err) {
          console.log(`[${i}] Image processing error (${config.name}):`, err.message);
          processedBuffer = Buffer.from(base64src.split(',')[1], 'base64');
        }
        ocrStats.totalAttempts++;
        const { data: { text } } = await Tesseract.recognize(
          processedBuffer,
          'eng',
          {
            logger: m => {}, // Logları kapat, hız için
            config: `tessedit_char_whitelist=0123456789 --psm ${config.psm} classify_bln_numeric_mode=1`
          }
        );
        cleanText = text.replace(/\D/g, '');
        // Only accept 3-digit numbers
        if (!/^\d{3}$/.test(cleanText)) {
          continue; // Sessizce devam et
        }
        ocrStats.threeDigitReads++;
        
        // Her 3 haneli sonucu göster (debug için)
        console.log(`  [${i}] OCR: ${cleanText} (${config.name})`);
        
        if (cleanText === targetNumber) {
          ocrStats.targetMatches++;
          ocrSuccess = true;
          console.log(`[${i}] ✅✅✅ HEDEFİ BULDUM! ${cleanText} ✅✅✅`);
          break;
        }
      }
      if (ocrSuccess) {
        foundAny = true;
        let clicked = false;
        try {
          await parentDiv.click();
          clicked = true;
          console.log(`[${i}] Parent div clicked, OCR: ${cleanText}`);
        } catch (e) {
          try {
            await img.click();
            clicked = true;
            console.log(`[${i}] Img clicked, OCR: ${cleanText}`);
          } catch (e2) {
            await driver.executeScript('arguments[0].click();', parentDiv);
            clicked = true;
            console.log(`[${i}] Parent div clicked by JS, OCR: ${cleanText}`);
          }
        }
        if (clicked) await driver.sleep(300); // Daha hızlı
      }
      // Başarısız kutuları sessizce atla
    } catch (e) {
      // Hata loglarını kapat, gereksiz
    }
  }
  const successRate = calculateOCRSuccessRate();
  console.log(`\n📊 OCR İstatistikleri:`);
  console.log(`  - Toplam OCR denemesi: ${ocrStats.totalAttempts}`);
  console.log(`  - 3 haneli okuma: ${ocrStats.threeDigitReads}`);
  console.log(`  - Hedef eşleşme: ${ocrStats.targetMatches}`);
  console.log(`  - Başarı oranı: ${successRate.toFixed(1)}%\n`);
  
  // ========== DERİN TARAMA: Az kutu bulunduysa tekrar tara ==========
  if (ocrStats.targetMatches > 0 && ocrStats.targetMatches < 3) {
    console.log(`\n⚠️ Sadece ${ocrStats.targetMatches} kutu seçildi - DERİN TARAMA BAŞLATILIYOR!\n`);
    
    // Derin tarama için tüm kutuları tekrar tara (limit kaldır)
    const deepScanBoxes = visibleBoxes.slice(maxBoxesToScan); // İlk 20'den sonrakiler
    console.log(`🔍 Kalan ${deepScanBoxes.length} kutu derin tarama ile kontrol ediliyor...`);
    
    for (let deepIdx = 0; deepIdx < deepScanBoxes.length; deepIdx++) {
      const box = deepScanBoxes[deepIdx];
      const { index: i, img, parentDiv } = box;
      
      try {
        const rect = await img.getRect();
        if (rect.width < 10 || rect.height < 10) continue;
        
        const screenshot = await img.takeScreenshot();
        const imgBuffer = Buffer.from(screenshot, 'base64');
        
        // Daha agresif OCR yöntemleri (sadece en iyi 3 tanesi)
        const aggressiveOcrTries = [
          { name: 'ultra_high_contrast', threshold: 200, psm: 7, resize: 4, brightness: 1.6, contrast: 2.5, sharpen: true, normalize: true },
          { name: 'extreme_morphological', threshold: 220, psm: 8, resize: 4, brightness: 1.7, contrast: 3.0, sharpen: true, normalize: true, erode: true },
          { name: 'deep_blue_channel', channel: 'blue', threshold: 180, psm: 8, resize: 4, brightness: 1.5, contrast: 2.2, sharpen: true, normalize: true }
        ];
        
        let deepOcrSuccess = false;
        let cleanText = '';
        
        for (const config of aggressiveOcrTries) {
          let sharpImg = sharp(imgBuffer);
          
          // Kanal seçimi
          if (config.channel === 'blue') {
            sharpImg = sharpImg.extractChannel(2);
          } else if (config.channel === 'green') {
            sharpImg = sharpImg.extractChannel(1);
          } else if (config.channel === 'red') {
            sharpImg = sharpImg.extractChannel(0);
          }
          
          // Boyutlandırma ve iyileştirme
          if (config.resize) sharpImg = sharpImg.resize(rect.width * config.resize, rect.height * config.resize, { kernel: 'lanczos3' });
          if (config.brightness || config.contrast) sharpImg = sharpImg.linear(config.contrast || 1, (config.brightness || 1) * 128 - 128);
          if (config.sharpen) sharpImg = sharpImg.sharpen();
          if (config.invert) sharpImg = sharpImg.negate();
          sharpImg = sharpImg.threshold(config.threshold);
          
          const processedBuffer = await sharpImg.toBuffer();
          const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng', {
            tessedit_char_whitelist: '0123456789',
            tessedit_pageseg_mode: config.psm
          });
          
          ocrStats.totalAttempts++;
          cleanText = text.replace(/\D/g, '');
          
          if (/^\d{3}$/.test(cleanText)) {
            ocrStats.threeDigitReads++;
            console.log(`  [DEEP ${i}] OCR: ${cleanText} (${config.name})`);
            
            if (cleanText === targetNumber) {
              ocrStats.targetMatches++;
              deepOcrSuccess = true;
              console.log(`[DEEP ${i}] ✅✅✅ HEDEFİ BULDUM (DERİN TARAMA)! ${cleanText} ✅✅✅`);
              break;
            }
          }
        }
        
        if (deepOcrSuccess) {
          foundAny = true;
          try {
            await driver.executeScript('arguments[0].click();', parentDiv);
            console.log(`[DEEP ${i}] Parent div clicked by JS (deep scan), OCR: ${cleanText}`);
            await driver.sleep(300);
          } catch (e) {
            // Tıklama başarısız
          }
        }
      } catch (e) {
        // Hata loglarını kapat
      }
    }
    
    console.log(`\n📊 DERİN TARAMA SONUÇLARI:`);
    console.log(`  - Toplam bulunan kutu: ${ocrStats.targetMatches}`);
    console.log(`  - Derin tarama katkısı: ${ocrStats.targetMatches - (ocrStats.targetMatches >= 3 ? ocrStats.targetMatches : ocrStats.targetMatches)}\n`);
  }
  
  if (!foundAny || ocrStats.targetMatches === 0) {
    console.log('⚠️ Hiçbir kutu seçilemedi! OCR tüm kutuları okuyamadı.');
    console.log('⚠️ Bu captcha başarısız sayılacak!');
  } else if (ocrStats.targetMatches < 3) {
    console.log(`⚠️ Sadece ${ocrStats.targetMatches} kutu seçildi - derin tarama da yardımcı olamadı!`);
  } else {
    console.log(`✅ Toplam ${ocrStats.targetMatches} kutu seçildi - İyi görünüyor!`);
  }

  // Submit butonu - birden fazla yöntem dene
  let submitted = false;
  
  // Yöntem 1: i#submit
  try {
    const submitIcon = await driver.findElement(By.css('i#submit'));
    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", submitIcon);
    await driver.sleep(500);
    await driver.executeScript("arguments[0].click();", submitIcon);
    console.log('✅ CAPTCHA submitted (i#submit - JS click)');
    submitted = true;
  } catch (e) {
    // Yöntem 2: div.img-action-div
    try {
      const submitDiv = await driver.findElement(By.css('div.img-action-div[onclick*="onSubmit"]'));
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", submitDiv);
      await driver.sleep(500);
      await driver.executeScript("arguments[0].click();", submitDiv);
      console.log('✅ CAPTCHA submitted (div.img-action-div - JS click)');
      submitted = true;
    } catch (e2) {
      // Yöntem 3: Herhangi bir Submit butonu
      try {
        const submitButtons = await driver.findElements(By.xpath("//button[contains(text(), 'Submit') or contains(text(), 'submit')]"));
        for (const btn of submitButtons) {
          try {
            await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", btn);
            await driver.sleep(500);
            await driver.executeScript("arguments[0].click();", btn);
            console.log('✅ CAPTCHA submitted (Submit button - JS click)');
            submitted = true;
            break;
          } catch (e) {}
        }
      } catch (e3) {
        // Yöntem 4: JavaScript onSubmit()
        try {
          await driver.executeScript('if(typeof onSubmit === "function") onSubmit();');
          console.log('✅ CAPTCHA submitted (JS onSubmit())');
          submitted = true;
        } catch (e4) {
          console.log('❌ CAPTCHA submit başarısız:', e4.message);
        }
      }
    }
  }
  
  if (!submitted) {
    console.log('⚠️ Submit button tıklanamadı!');
  }
  
  await driver.sleep(2000); // Submit sonrası biraz bekle
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