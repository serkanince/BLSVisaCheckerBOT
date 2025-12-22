const { Builder, Browser, By, Key, until } = require("selenium-webdriver");
const { solveCaptchaInIframe } = require("./captchaSolver");
const {
  notifyAppointmentFound,
  notifyNoAppointments,
  notifyAppointmentsClosed,
  notifyFormError,
  notifyBotError,
  notifySlotPageReached
} = require("./telegramNotifier");

require("dotenv").config();

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

async function main() {
  // "Application Temporarily Unavailable" hatasını kontrol et ve düzelt
  async function checkAndHandleUnavailable(driver) {
    try {
      const pageSource = await driver.getPageSource();
      if (pageSource.includes('Application Temporarily Unavailable') || 
          pageSource.includes('Temporarily Unavailable')) {
        console.log('⚠️ "Application Temporarily Unavailable" hatası tespit edildi!');
        console.log('10 saniye bekleniyor...');
        await driver.sleep(10000);
        console.log('Sayfa yenileniyor...');
        await driver.navigate().refresh();
        await driver.sleep(3000);
        console.log('✅ Sayfa yenilendi!');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Yeni dropdown seçim fonksiyonu - LABEL TEXT'e göre
  async function selectKendoDropdownByLabel(
    driver,
    labelText, // "Jurisdiction", "Location", "Visa Type", "Visa Sub Type", "Category"
    visibleText,
    timeout = 10000
  ) {
    const targetText = visibleText.trim().toLowerCase();
    
    try {
      console.log(`\n🔍 "${labelText}" dropdown'u aranıyor: "${visibleText}"`);
      
      // Tüm label elementlerini bul
      const allLabels = await driver.findElements(By.css('label.form-label'));
      console.log(`Toplam ${allLabels.length} label bulundu`);
      
      let targetDropdown = null;
      
      // Her label'ı kontrol et
      for (const label of allLabels) {
        try {
          const labelTextContent = await label.getText();
          
          // Label text'i eşleşiyor mu?
          if (labelTextContent.includes(labelText)) {
            // Parent div'i bul
            const parentDiv = await label.findElement(By.xpath('..'));
            
            // Parent görünür mü?
            const isDisplayed = await parentDiv.isDisplayed();
            if (!isDisplayed) {
              continue; // Gizli, bir sonrakine geç
            }
            
            // Dropdown'u bul (parent div içinde)
            try {
              targetDropdown = await parentDiv.findElement(By.css('span.k-dropdown-wrap'));
              console.log(`✅ Görünür "${labelText}" dropdown bulundu!`);
              break;
            } catch (e) {
              // Bu div'de dropdown yok, devam et
              continue;
            }
          }
        } catch (e) {
          // Label okunamadı, devam et
          continue;
        }
      }
      
      if (!targetDropdown) {
        console.log(`❌ "${labelText}" dropdown bulunamadı veya görünmüyor!`);
        return false;
      }
      
      // Dropdown'a tıkla
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", targetDropdown);
      await driver.sleep(500);
      await driver.executeScript("arguments[0].click();", targetDropdown);
      console.log(`✅ "${labelText}" dropdown açıldı`);
      await driver.sleep(800);
      
      // Seçenekleri bul
      let found = false;
      let start = Date.now();
      
      while (Date.now() - start < timeout) {
        const allLists = await driver.findElements(
          By.css(".k-list-container ul, .k-animation-container ul")
        );
        
        for (const ul of allLists) {
          try {
            const isListDisplayed = await ul.isDisplayed();
            if (!isListDisplayed) continue;
            
            const items = await ul.findElements(By.css("li.k-item"));
            console.log(`  ${items.length} seçenek bulundu`);
            
            if (items.length > 0) {
              for (const item of items) {
                try {
                  const txt = (await item.getText()).trim();
                  if (txt && (txt.toLowerCase() === targetText || txt.toLowerCase().includes(targetText))) {
                    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", item);
                    await driver.sleep(300);
                    await driver.executeScript("arguments[0].click();", item);
                    console.log(`✅ "${labelText}": "${txt}" seçildi!\n`);
                    await driver.sleep(800);
                    found = true;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
              if (found) break;
            }
          } catch (e) {
            continue;
          }
        }
        if (found) break;
        await driver.sleep(400);
      }
      
      if (!found) {
        console.log(`❌ "${labelText}": "${visibleText}" seçeneği bulunamadı!\n`);
      }
      return found;
      
    } catch (e) {
      console.log(`❌ "${labelText}" dropdown hatası:`, e.message);
      return false;
    }
  }

  // Premium Category'yi deneme fonksiyonu
  async function tryPremiumCategory(driver) {
    console.log("\n" + "=".repeat(60));
    console.log("🌟 PREMIUM CATEGORY AKIŞI BAŞLIYOR 🌟");
    console.log("=".repeat(60) + "\n");
    
    // 1. Try Again butonu
    console.log("🔄 Try Again butonu aranıyor...");
    let tryAgainClicked = false;
    
    try {
      // Önce "Try Again" linkini ara
      const tryAgainLinks = await driver.findElements(By.xpath("//a[contains(text(), 'Try Again') or contains(text(), 'try again')]"));
      
      if (tryAgainLinks.length > 0) {
        for (const link of tryAgainLinks) {
          try {
            const isDisplayed = await link.isDisplayed();
            if (isDisplayed) {
              await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", link);
              await driver.sleep(500);
              await driver.executeScript("arguments[0].click();", link);
              console.log("✅ Try Again linkine tıklandı!");
              tryAgainClicked = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      // Link bulunamadıysa buton ara
      if (!tryAgainClicked) {
        const tryAgainBtns = await driver.findElements(By.xpath("//button[contains(text(), 'Try Again') or contains(text(), 'try again')]"));
        
        if (tryAgainBtns.length > 0) {
          for (const btn of tryAgainBtns) {
            try {
              const isDisplayed = await btn.isDisplayed();
              if (isDisplayed) {
                await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", btn);
                await driver.sleep(500);
                await driver.executeScript("arguments[0].click();", btn);
                console.log("✅ Try Again butonuna tıklandı!");
                tryAgainClicked = true;
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      if (!tryAgainClicked) {
        console.log("⚠️ Try Again butonu bulunamadı, Book Now'a tıklanıyor...");
        // Book Now'a tıkla
        const bookNowBtn = await driver.findElement(By.css('a[href="/Global/appointment/newappointment"]'));
        await bookNowBtn.click();
        console.log("✅ Book Now'a tıklandı!");
      }
    } catch (e) {
      console.log("❌ Try Again/Book Now hatası:", e.message);
      throw new Error("Try Again işlemi başarısız");
    }
    
    await driver.sleep(3000);
    
    // 2. "Application Temporarily Unavailable" kontrolü
    await checkAndHandleUnavailable(driver);
    
    // 3. Captcha kontrolü (randevu sayfası)
    console.log("📋 Sayfa kontrol ediliyor (captcha var mı?)...");
    await driver.sleep(2000);
    
    const currentUrl = await driver.getCurrentUrl();
    const pageSource = await driver.getPageSource();
    
    // Form sayfasında mıyız?
    const hasFormTitle = pageSource.includes('Book New Appointment - Visa Type Selection');
    
    if (!hasFormTitle && !currentUrl.includes('/Global/bls/visatype')) {
      console.log("🔒 Captcha ekranı tespit edildi, çözülüyor...");
      
      // Captcha'yı çöz
      let captchaSuccess = false;
      let captchaRetries = 0;
      const maxCaptchaRetries = 3;
      
      while (!captchaSuccess && captchaRetries < maxCaptchaRetries) {
        try {
          if (captchaRetries > 0) {
            console.log(`\n🔄 Captcha tekrar deneniyor (${captchaRetries + 1}/${maxCaptchaRetries})...`);
            await driver.sleep(2000);
          }
          
          await solveCaptchaInIframe(driver);
          
          // Captcha sonrası kontrol
          await driver.sleep(2000);
          await checkAndHandleUnavailable(driver);
          
          // Form sayfasına gidildi mi?
          await driver.sleep(3000);
          const afterCaptchaUrl = await driver.getCurrentUrl();
          const afterCaptchaPage = await driver.getPageSource();
          
          if (afterCaptchaUrl.includes('/Global/bls/visatype') || 
              afterCaptchaPage.includes('Book New Appointment - Visa Type Selection')) {
            console.log("✅ Captcha çözüldü, form sayfasına yönlendirildi!");
            captchaSuccess = true;
          } else {
            throw new Error("Form sayfasına yönlendirilemedi");
          }
          
        } catch (e) {
          captchaRetries++;
          console.log(`❌ Captcha hatası: ${e.message}`);
          
          if (captchaRetries >= maxCaptchaRetries) {
            throw new Error("Captcha çözülemedi - maksimum deneme aşıldı");
          }
          
          await driver.sleep(3000);
        }
      }
    } else {
      console.log("✅ Form sayfasında - captcha yok!");
    }
    
    await driver.sleep(2000);
    await checkAndHandleUnavailable(driver);
    
    // 4. Form doldurma - Premium seçimi
    console.log("\n📝 Premium Category için form dolduruluyor...\n");
    
    // Dropdown'ların yüklenmesini bekle
    await driver.wait(until.elementLocated(By.css("span.k-dropdown-wrap")), 10000);
    await driver.sleep(1000);
    
    const formSuccess = {
      jurisdiction: false,
      location: false,
      visaType: false,
      visaSubType: false,
      category: false
    };
    
    // Form alanlarını doldur (Normal akışıyla aynı, sadece Category farklı)
    formSuccess.jurisdiction = await selectKendoDropdownByLabel(driver, "Jurisdiction", "Ankara");
    if (!formSuccess.jurisdiction) {
      throw new Error("Premium: Jurisdiction seçilemedi");
    }
    await driver.sleep(500);
    
    formSuccess.location = await selectKendoDropdownByLabel(driver, "Location", "Ankara");
    if (!formSuccess.location) {
      throw new Error("Premium: Location seçilemedi");
    }
    await driver.sleep(500);
    
    formSuccess.visaType = await selectKendoDropdownByLabel(driver, "Visa Type", "Schengen Visa/ Short Term Visa");
    if (!formSuccess.visaType) {
      throw new Error("Premium: Visa Type seçilemedi");
    }
    await driver.sleep(500);
    
    formSuccess.visaSubType = await selectKendoDropdownByLabel(driver, "Visa Sub Type", "Tourist Visa");
    if (!formSuccess.visaSubType) {
      throw new Error("Premium: Visa Sub Type seçilemedi");
    }
    await driver.sleep(500);
    
    // 5. PREMIUM CATEGORY SEÇİMİ
    console.log("\n🌟 Premium Category seçiliyor...\n");
    formSuccess.category = await selectKendoDropdownByLabel(driver, "Category", "Premium");
    if (!formSuccess.category) {
      throw new Error("Premium: Category seçilemedi");
    }
    await driver.sleep(1000);
    
    // 6. PREMIUM MODAL DIALOG KONTROLÜ VE ACCEPT
    console.log("\n🔔 Premium modal dialog kontrol ediliyor...\n");
    
    try {
      // Modal'ın açılmasını bekle
      await driver.sleep(2000);
      
      // Modal body'yi ara
      const modalBodies = await driver.findElements(By.css('.modal-body, .scam-body'));
      let modalFound = false;
      
      for (const modalBody of modalBodies) {
        try {
          const isDisplayed = await modalBody.isDisplayed();
          if (isDisplayed) {
            const text = await modalBody.getText();
            
            // Premium Lounge mesajı var mı?
            if (text.includes('Premium Lounge') || text.includes('optional service')) {
              console.log("✅ Premium modal dialog bulundu!");
              console.log(`   Modal mesajı: "${text.substring(0, 80)}..."`);
              modalFound = true;
              
              // Accept butonu ara
              // Önce modal içindeki success butonunu ara
              let acceptBtns = await driver.findElements(By.css('.modal-footer .btn-success, .modal-footer button.btn-success'));
              
              if (acceptBtns.length === 0) {
                // Alternatif: Tüm success butonları
                acceptBtns = await driver.findElements(By.css('.btn-success, button.btn-success'));
              }
              
              // Accept butonuna tıkla
              let acceptClicked = false;
              for (const btn of acceptBtns) {
                try {
                  const btnDisplayed = await btn.isDisplayed();
                  const btnText = await btn.getText();
                  
                  if (btnDisplayed && btnText.toLowerCase().includes('accept')) {
                    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", btn);
                    await driver.sleep(300);
                    await driver.executeScript("arguments[0].click();", btn);
                    console.log("✅ Accept butonuna tıklandı!");
                    acceptClicked = true;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
              
              if (!acceptClicked) {
                console.log("⚠️ Accept butonu bulunamadı, devam ediliyor...");
              }
              
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!modalFound) {
        console.log("⚠️ Premium modal dialog bulunamadı (zaten kapanmış olabilir)");
      }
      
      await driver.sleep(1000);
      
    } catch (e) {
      console.log("⚠️ Modal dialog kontrolü sırasında hata (önemsiz):", e.message);
    }
    
    console.log("\n✅ PREMIUM FORM ALANLARI BAŞARIYLA DOLDURULDU!\n");
    
    await driver.sleep(500);
    await checkAndHandleUnavailable(driver);
    
    // 7. Submit butonu
    console.log("Submit butonu aranıyor...");
    const submitBtn = await driver.findElement(By.id("btnSubmit"));
    
    await driver.wait(until.elementIsVisible(submitBtn), 5000);
    await driver.wait(until.elementIsEnabled(submitBtn), 5000);
    
    try {
      await submitBtn.click();
      console.log("✅ Premium form gönderildi!");
    } catch (e) {
      await driver.executeScript("arguments[0].click();", submitBtn);
      console.log("✅ Premium form JS ile gönderildi!");
    }
    
    await driver.sleep(5000);
    await checkAndHandleUnavailable(driver);
    await driver.sleep(3000);
    
    // 8. PREMIUM SONUÇ KONTROLÜ
    console.log("\n📋 Premium form submit sonrası sayfa kontrol ediliyor...\n");
    const premiumPostUrl = await driver.getCurrentUrl();
    const premiumPostPage = await driver.getPageSource();
    
    const premiumHasSlotTitle = premiumPostPage.includes('Book New Appointment - Slot Selection');
    const premiumHasCaptcha = !premiumHasSlotTitle && premiumPostPage.includes('Please select all boxes');
    const premiumNoSlots = premiumPostPage.includes('Currently, no slots are available');
    
    if (premiumNoSlots) {
      console.log("❌ Premium Category'de de slot yok!");
      console.log("Her iki kategori de kapalı - script sonlanıyor...");
      return; // Sonlandır
    }
    
    const premiumClosed = !premiumHasSlotTitle && !premiumHasCaptcha && 
                          (premiumPostPage.includes('No appointments available') ||
                           premiumPostPage.includes('currently unavailable'));
    
    if (premiumHasCaptcha) {
      console.log("🔒 Premium için CAPTCHA ekranı!");
      console.log("Captcha çözülüyor...");
      
      await solveCaptchaInIframe(driver);
      await driver.sleep(2000);
      await checkAndHandleUnavailable(driver);
      await driver.sleep(3000);
      
      // Captcha sonrası tekrar kontrol
      const afterPremiumCaptcha = await driver.getPageSource();
      const afterPremiumSlotTitle = afterPremiumCaptcha.includes('Book New Appointment - Slot Selection');
      const afterPremiumNoSlots = afterPremiumCaptcha.includes('Currently, no slots are available');
      
      if (afterPremiumNoSlots) {
        console.log("❌ Premium'da da slot yok (captcha sonrası)!");
        return;
      }
      
      if (!afterPremiumSlotTitle) {
        console.log("❌ Premium captcha sonrası Slot sayfası açılmadı!");
        throw new Error("Premium slot sayfası açılmadı");
      }
      
      console.log("✅ Premium captcha çözüldü, Slot sayfası açıldı!");
      
    } else if (premiumClosed) {
      console.log("❌ Premium da kapalı!");
      return;
      
    } else if (premiumHasSlotTitle) {
      console.log("✅ Premium için Slot Selection sayfası açıldı (captcha yok)!");
    }
    
    // 9. SLOT TARAMA (Normal akışıyla aynı)
    console.log("\n📅 PREMIUM SLOT SELECTION SAYFASI\n");
    await driver.sleep(2000);
    
    await scanAndNotifySlots(driver, "Premium");
  }

  // Slot tarama ve bildirim fonksiyonu (kod tekrarını önlemek için)
  async function scanAndNotifySlots(driver, categoryName = "Normal") {
    // Date picker'ı bul
    console.log("🔍 Appointment Date picker aranıyor...");
    const allDatePickers = await driver.findElements(By.css('input.k-input[data-role="datepicker"]'));
    console.log(`Toplam ${allDatePickers.length} date picker bulundu`);
    
    let visibleDatePicker = null;
    for (const picker of allDatePickers) {
      try {
        const isDisplayed = await picker.isDisplayed();
        if (isDisplayed) {
          visibleDatePicker = picker;
          const pickerId = await picker.getAttribute('id');
          console.log(`✅ Görünür date picker bulundu: ${pickerId}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!visibleDatePicker) {
      console.log("❌ Date picker bulunamadı!");
      console.log(`🔔 AMA ${categoryName} SLOT SAYFASI AÇIK! Manuel kontrol öneriliyor...`);
      
      try {
        await notifySlotPageReached(`${categoryName}: Date picker bulunamadı ama slot sayfası açık!`);
      } catch (e) {
        console.log("Telegram bildirimi gönderilemedi");
      }
      
      throw new Error("Date picker bulunamadı");
    }
    
    // Date picker'a tıkla
    console.log("📅 Date picker açılıyor...");
    
    let calendarOpened = false;
    const openMethods = [
      {
        name: "JS Click",
        fn: async () => {
          await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", visibleDatePicker);
          await driver.sleep(500);
          await driver.executeScript("arguments[0].click();", visibleDatePicker);
        }
      },
      {
        name: "Normal Click",
        fn: async () => {
          await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", visibleDatePicker);
          await driver.sleep(500);
          await visibleDatePicker.click();
        }
      },
      {
        name: "Calendar Icon Click",
        fn: async () => {
          const parent = await visibleDatePicker.findElement(By.xpath('../..'));
          const calendarIcon = await parent.findElement(By.css('.k-icon.k-i-calendar'));
          await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", calendarIcon);
          await driver.sleep(500);
          await driver.executeScript("arguments[0].click();", calendarIcon);
        }
      }
    ];
    
    for (const method of openMethods) {
      try {
        console.log(`  Deneniyor: ${method.name}...`);
        await method.fn();
        await driver.sleep(2000);
        
        const calendarCheck = await driver.findElements(By.css('.k-calendar-container[aria-hidden="false"], .k-calendar-container:not([aria-hidden="true"])'));
        if (calendarCheck.length > 0) {
          console.log(`✅ Takvim ${method.name} ile açıldı!`);
          calendarOpened = true;
          break;
        }
      } catch (e) {
        console.log(`  ⚠️ ${method.name} başarısız: ${e.message}`);
      }
    }
    
    if (!calendarOpened) {
      console.log("❌ Takvim açılamadı!");
      console.log(`🔔 AMA ${categoryName} SLOT SAYFASI AÇIK!`);
      
      try {
        await notifySlotPageReached(`${categoryName}: Takvim açılamadı ama slot sayfası açık!`);
      } catch (e) {
        console.log("Telegram bildirimi gönderilemedi");
      }
      
      throw new Error("Takvim açılamadı");
    }
    
    await driver.sleep(2000);
    
    // Takvim kontrolü
    const calendarExists = await driver.findElements(By.css('.k-calendar'));
    if (calendarExists.length === 0) {
      console.log("❌ Takvim elementi bulunamadı!");
      
      try {
        await notifySlotPageReached(`${categoryName}: Takvim elementi yok ama slot sayfası açık!`);
      } catch (e) {
        console.log("Telegram bildirimi gönderilemedi");
      }
      
      throw new Error("Takvim elementi yok");
    }
    
    console.log(`✅ ${calendarExists.length} takvim elementi bulundu`);
    
    // YEŞİL TARİHLERİ BULMA
    console.log(`\n🔍 ${categoryName} için TÜM AYLARI TARAYARAK YEŞİL TARİHLER ARANIYOR...\n`);
    
    const availableDatesWithSlots = [];
    const maxMonthsToCheck = 12;
    
    for (let monthIndex = 0; monthIndex < maxMonthsToCheck; monthIndex++) {
      try {
        let monthTitle = null;
        try {
          monthTitle = await driver.findElement(By.css('.k-calendar .k-nav-fast'));
        } catch (e) {
          try {
            monthTitle = await driver.findElement(By.css('.k-calendar .k-header a.k-nav-fast'));
          } catch (e2) {
            console.log(`⚠️ Ay ${monthIndex + 1}: Ay başlığı bulunamadı`);
            break;
          }
        }
        
        const currentMonth = await monthTitle.getText();
        console.log(`📅 Ay kontrol ediliyor: ${currentMonth}`);
        
        await driver.sleep(1000);
        
        const allDateLinks = await driver.findElements(By.css('.k-calendar a.k-link[data-value]'));
        console.log(`  Toplam ${allDateLinks.length} tarih elementi bulundu`);
        
        if (allDateLinks.length === 0) {
          console.log("⚠️ Hiç tarih elementi bulunamadı");
          continue;
        }
        
        let foundInThisMonth = 0;
        
        for (let i = 0; i < allDateLinks.length; i++) {
          try {
            const dateLink = allDateLinks[i];
            const dataValue = await dateLink.getAttribute('data-value');
            
            if (!dataValue) continue;
            
            const parentTd = await dateLink.findElement(By.xpath('..'));
            const tdClass = await parentTd.getAttribute('class');
            if (tdClass && tdClass.includes('k-state-disabled')) continue;
            
            // Yeşil kontrol
            const colorInfo = await driver.executeScript(`
              const link = arguments[0];
              const style = window.getComputedStyle(link);
              const bgColor = style.backgroundColor;
              
              const match = bgColor.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
              if (!match) return { bgColor: bgColor, isGreen: false };
              
              const r = parseInt(match[1]);
              const g = parseInt(match[2]);
              const b = parseInt(match[3]);
              
              const isGreen = (g > 100 && g > r * 1.5 && g > b * 1.2 && r < 100);
              
              return {
                bgColor: bgColor,
                isGreen: isGreen,
                rgb: { r, g, b }
              };
            `, dateLink);
            
            if (colorInfo.isGreen) {
              const dateText = await dateLink.getText();
              availableDatesWithSlots.push({
                date: dataValue,
                text: dateText,
                month: currentMonth,
                bgColor: colorInfo.bgColor,
                rgb: colorInfo.rgb,
                category: categoryName
              });
              foundInThisMonth++;
              console.log(`  ✅ YEŞİL TARİH: ${dateText} ${currentMonth} (${dataValue})`);
            }
          } catch (e) {
            continue;
          }
        }
        
        if (foundInThisMonth > 0) {
          console.log(`✅ ${currentMonth}: ${foundInThisMonth} yeşil tarih bulundu!`);
        } else {
          console.log(`⚪ ${currentMonth}: Yeşil tarih yok`);
        }
        
        // Sonraki aya geç
        if (monthIndex < maxMonthsToCheck - 1) {
          try {
            const nextMonthBtns = await driver.findElements(By.css('.k-calendar .k-nav-next'));
            
            if (nextMonthBtns.length === 0) break;
            
            const nextMonthBtn = nextMonthBtns[0];
            const btnClass = await nextMonthBtn.getAttribute('class');
            if (btnClass && btnClass.includes('k-state-disabled')) break;
            
            await driver.executeScript("arguments[0].click();", nextMonthBtn);
            await driver.sleep(1500);
            
            console.log(`➡️ Sonraki aya geçildi (${monthIndex + 2}/${maxMonthsToCheck})\n`);
            
          } catch (e) {
            console.log(`⚠️ Sonraki aya geçiş hatası: ${e.message}`);
            break;
          }
        }
        
      } catch (e) {
        console.log(`⚠️ Ay tarama hatası: ${e.message}`);
        break;
      }
    }
    
    console.log(`\n📊 ${categoryName}: TOPLAM ${availableDatesWithSlots.length} YEŞİL TARİH BULUNDU!\n`);
    
    if (availableDatesWithSlots.length === 0) {
      console.log(`❌ ${categoryName}: HİÇBİR UYGUN TARİH YOK!`);
      
      // Premium için slot yoksa bildirim yok
      // Normal için zaten başka bir akış var
      
      return;
    }
    
    // Bulunan tarihleri Telegram'a bildir
    try {
      await notifyAppointmentFound(availableDatesWithSlots);
      console.log("✅ Telegram bildirimi gönderildi!");
    } catch (e) {
      console.log("❌ Telegram bildirimi gönderilemedi:", e.message);
    }
    
    // Takvimi kapat
    console.log("\n📅 Takvim kapatılıyor...");
    try {
      await driver.executeScript("arguments[0].blur();", visibleDatePicker);
      await driver.sleep(500);
      await driver.actions().sendKeys(Key.ESCAPE).perform();
      await driver.sleep(500);
      console.log("✅ Takvim kapatıldı");
    } catch (e) {
      console.log("⚠️ Takvim kapatma hatası (önemsiz):", e.message);
    }
    
    console.log(`\n🎉 ${categoryName} RANDEVU TARAMASI TAMAMLANDI!\n`);
  }

  (async function example() {
    const chromeOptions = new (require("selenium-webdriver/chrome").Options)();
    chromeOptions.addArguments("--start-maximized");
    let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(chromeOptions).build();
    try {
      await driver.get(
        "https://turkey.blsspainglobal.com/Global/Account/LogIn"
      );

      console.log("Sayfa yüklendi...");
      await driver.sleep(3000);

      // "Application Temporarily Unavailable" kontrolü
      let unavailableRetries = 0;
      while (await checkAndHandleUnavailable(driver) && unavailableRetries < 5) {
        unavailableRetries++;
        console.log(`Unavailable retry: ${unavailableRetries}/5`);
        await driver.sleep(2000);
      }

      console.log("Email input alanı bekleniyor...");
      await driver.sleep(2000);

      // İlk sayfada sadece email var - Email input'unu bul ve doldur
      let emailInput = null;
      try {
        const allInputs = await driver.findElements(By.css('input[type="text"]'));
        console.log(`Toplam ${allInputs.length} text input bulundu`);
        
        for (let i = 0; i < allInputs.length; i++) {
          try {
            const input = allInputs[i];
            const isDisplayed = await input.isDisplayed();
            const rect = await input.getRect();
            const id = await input.getAttribute("id");
            const name = await input.getAttribute("name");
            const className = await input.getAttribute("class");
            
            console.log(`Input ${i}: id=${id}, name=${name}, class=${className}, displayed=${isDisplayed}, width=${rect.width}`);
            
            if (isDisplayed && rect.width > 50 && rect.height > 20) {
              console.log(`✅ Email input bulundu: ${id || name}`);
              emailInput = input;
              break;
            }
          } catch (e) {
            console.log(`Input ${i} kontrol edilemedi:`, e.message);
          }
        }
      } catch (e) {
        console.log("Email input arama hatası:", e.message);
      }

      if (!emailInput) {
        throw new Error("Email alanı bulunamadı!");
      }

      // Email'i doldur
      try {
        console.log("Email giriliyor...");
        await driver.executeScript("arguments[0].value = '';", emailInput);
        await emailInput.sendKeys(EMAIL);
        console.log("✅ Email başarıyla girildi!");
      } catch (e) {
        console.log("Email doldurma hatası:", e.message);
        throw new Error("Email girilemedi!");
      }

      console.log("btnVerify'a tıklanıyor (email onay için)...");
      await driver.findElement(By.id("btnVerify")).click();
      console.log("✅ btnVerify'a tıklandı!");

      await driver.sleep(3000);

      // Şimdi password + captcha sayfası yüklendi
      console.log("Password sayfası bekleniyor...");
      await driver.sleep(2000);

      // Password input'unu bul
      let passwordInput = null;
      try {
        const allPasswords = await driver.findElements(By.css('input[type="password"]'));
        console.log(`Toplam ${allPasswords.length} password input bulundu`);
        
        for (let i = 0; i < allPasswords.length; i++) {
          try {
            const input = allPasswords[i];
            const isDisplayed = await input.isDisplayed();
            const rect = await input.getRect();
            const id = await input.getAttribute("id");
            const name = await input.getAttribute("name");
            const className = await input.getAttribute("class");
            
            console.log(`Password ${i}: id=${id}, name=${name}, class=${className}, displayed=${isDisplayed}, width=${rect.width}`);
            
            if (isDisplayed && rect.width > 50 && rect.height > 20) {
              console.log(`✅ Password input bulundu: ${id || name}`);
              passwordInput = input;
              break;
            }
          } catch (e) {
            console.log(`Password ${i} kontrol edilemedi:`, e.message);
          }
        }
      } catch (e) {
        console.log("Password input arama hatası:", e.message);
      }

      if (!passwordInput) {
        throw new Error("Password alanı bulunamadı!");
      }

      // Password'u doldur
      try {
        console.log("Password giriliyor...");
        await driver.executeScript("arguments[0].value = '';", passwordInput);
        await passwordInput.sendKeys(PASSWORD);
        console.log("✅ Password başarıyla girildi!");
      } catch (e) {
        console.log("Password doldurma hatası:", e.message);
        throw new Error("Password girilemedi!");
      }

      await driver.sleep(2000);

      // Login captcha'yı çöz - retry mekanizması ile
      let loginSuccess = false;
      let loginRetries = 0;
      const maxLoginRetries = 3;
      
      while (!loginSuccess && loginRetries < maxLoginRetries) {
        try {
          if (loginRetries > 0) {
            console.log(`\n🔄 Login tekrar deneniyor (${loginRetries + 1}/${maxLoginRetries})...`);
            
            await driver.sleep(2000);
            
            // Önce password alanını kontrol et - varsa ve boşsa doldur
            console.log("Password alanı kontrol ediliyor...");
            let passwordFound = false;
            let passwordFilled = false;
            
            const retryPasswords = await driver.findElements(By.css('input[type="password"]'));
            for (let passInput of retryPasswords) {
              try {
                // Görünürlük kontrolü - bazı inputlar hidden olabilir
                let passDisplayed = false;
                try {
                  passDisplayed = await passInput.isDisplayed();
                } catch (e) {
                  // isDisplayed hata verirse, JS ile kontrol et
                  passDisplayed = await driver.executeScript(`
                    const el = arguments[0];
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                  `, passInput);
                }
                
                const passRect = await passInput.getRect();
                if (passDisplayed && passRect.width > 50) {
                  passwordFound = true;
                  console.log("✅ Password input bulundu!");
                  
                  // entry-disabled class'ını kaldır (anti-bot önlemi olabilir)
                  const inputClass = await passInput.getAttribute('class');
                  if (inputClass && inputClass.includes('entry-disabled')) {
                    console.log("⚠️ entry-disabled class'ı tespit edildi, kaldırılıyor...");
                    await driver.executeScript(`
                      arguments[0].classList.remove('entry-disabled');
                      arguments[0].removeAttribute('disabled');
                      arguments[0].removeAttribute('readonly');
                    `, passInput);
                    await driver.sleep(300);
                  }
                  
                  // Password değerini kontrol et ve doldur
                  const currentValue = await passInput.getAttribute('value');
                  if (!currentValue || currentValue.length === 0) {
                    // Önce JS ile temizle, sonra doldur
                    await driver.executeScript("arguments[0].value = '';", passInput);
                    await driver.executeScript("arguments[0].focus();", passInput);
                    await driver.sleep(200);
                    
                    // sendKeys ile gir
                    await passInput.sendKeys(PASSWORD);
                    
                    // Değer girildi mi kontrol et
                    const newValue = await passInput.getAttribute('value');
                    if (newValue && newValue.length > 0) {
                      console.log("✅ Password tekrar girildi!");
                      passwordFilled = true;
                    } else {
                      // sendKeys çalışmadıysa JS ile dene
                      console.log("⚠️ sendKeys çalışmadı, JS ile deneniyor...");
                      await driver.executeScript(`arguments[0].value = arguments[1];`, passInput, PASSWORD);
                      // Input event'i tetikle
                      await driver.executeScript(`
                        arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                        arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
                      `, passInput);
                      console.log("✅ Password JS ile girildi!");
                      passwordFilled = true;
                    }
                  } else {
                    console.log("✅ Password zaten dolu");
                    passwordFilled = true;
                  }
                  break;
                }
              } catch (e) {
                console.log(`⚠️ Password input kontrol hatası: ${e.message}`);
              }
            }
            
            // Password input bulunamadı veya görünmüyor - email sayfasına dönmüş olabiliriz
            if (!passwordFound) {
              console.log("⚠️ Password alanı bulunamadı - email sayfasına dönülmüş olabilir");
              
              // Email input bul ve doldur
              const retryEmailInputs = await driver.findElements(By.css('input[type="text"]'));
              for (let input of retryEmailInputs) {
                try {
                  const isDisplayed = await input.isDisplayed();
                  const rect = await input.getRect();
                  if (isDisplayed && rect.width > 50) {
                    await driver.executeScript("arguments[0].value = '';", input);
                    await input.sendKeys(EMAIL);
                    console.log("✅ Email tekrar girildi!");
                    
                    // btnVerify tıkla
                    await driver.sleep(1000);
                    try {
                      await driver.findElement(By.id("btnVerify")).click();
                      console.log("✅ btnVerify tıklandı!");
                    } catch (e) {
                      console.log("⚠️ btnVerify bulunamadı");
                    }
                    await driver.sleep(3000);
                    break;
                  }
                } catch (e) {}
              }
              
              // Şimdi password sayfası yüklenmeli - tekrar password doldur
              console.log("Password sayfası bekleniyor...");
              await driver.sleep(1500);
              
              const newPasswords = await driver.findElements(By.css('input[type="password"]'));
              for (let passInput of newPasswords) {
                try {
                  let passDisplayed = false;
                  try {
                    passDisplayed = await passInput.isDisplayed();
                  } catch (e) {
                    passDisplayed = await driver.executeScript(`
                      const el = arguments[0];
                      const style = window.getComputedStyle(el);
                      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                    `, passInput);
                  }
                  
                  const passRect = await passInput.getRect();
                  if (passDisplayed && passRect.width > 50) {
                    console.log("✅ Password input bulundu!");
                    
                    // entry-disabled class'ını kaldır
                    const inputClass = await passInput.getAttribute('class');
                    if (inputClass && inputClass.includes('entry-disabled')) {
                      console.log("⚠️ entry-disabled class'ı kaldırılıyor...");
                      await driver.executeScript(`
                        arguments[0].classList.remove('entry-disabled');
                        arguments[0].removeAttribute('disabled');
                        arguments[0].removeAttribute('readonly');
                      `, passInput);
                      await driver.sleep(300);
                    }
                    
                    await driver.executeScript("arguments[0].value = '';", passInput);
                    await driver.executeScript("arguments[0].focus();", passInput);
                    await driver.sleep(200);
                    await passInput.sendKeys(PASSWORD);
                    
                    const newValue = await passInput.getAttribute('value');
                    if (newValue && newValue.length > 0) {
                      console.log("✅ Password girildi!");
                      passwordFilled = true;
                    } else {
                      await driver.executeScript(`arguments[0].value = arguments[1];`, passInput, PASSWORD);
                      await driver.executeScript(`
                        arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                        arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
                      `, passInput);
                      console.log("✅ Password JS ile girildi!");
                      passwordFilled = true;
                    }
                    break;
                  }
                } catch (e) {
                  console.log(`⚠️ Password kontrol hatası: ${e.message}`);
                }
              }
            }
            
            if (!passwordFilled) {
              console.log("❌ Password alanı doldurulamadı!");
            }
            
            await driver.sleep(500);
          }
          
          console.log("Login captcha çözülüyor...");
          await solveCaptchaInIframe(driver, 0, 3, true); // isLoginCaptcha = true
          
          // Captcha sonrası "Application Temporarily Unavailable" kontrolü
          await driver.sleep(1500);
          console.log("Login captcha sonrası kontrol yapılıyor...");
          await checkAndHandleUnavailable(driver);
          
          // Home sayfasına gidene kadar bekle
          await driver.wait(until.urlContains("/Global/home/index"), 8000);
          console.log("✅ Giriş başarılı! Home sayfasına yönlendirildi.");
          loginSuccess = true;
          
        } catch (e) {
          loginRetries++;
          console.log(`❌ Login başarısız: ${e.message}`);
          
          if (loginRetries >= maxLoginRetries) {
            console.log(`❌ Maksimum retry sayısına ulaşıldı (${maxLoginRetries})`);
            throw new Error("Login başarısız - maksimum deneme sayısı aşıldı");
          }
          
          // Biraz bekle ve tekrar dene
          await driver.sleep(3000);
        }
      }

      await driver.sleep(1500);

      // "Application Temporarily Unavailable" kontrolü
      await checkAndHandleUnavailable(driver);

      // "Book Now" butonunu bul ve tıkla
      console.log('"Book Now" butonu aranıyor...');
      try {
        const bookNowBtn = await driver.findElement(
          By.css('a[href="/Global/appointment/newappointment"]')
        );
        await bookNowBtn.click();
        console.log('✅ "Book Now" butonuna tıklandı!');
      } catch (e) {
        console.log('❌ "Book Now" butonu bulunamadı:', e.message);
        throw new Error('"Book Now" butonuna tıklanamadı!');
      }

      await driver.sleep(1500);

      // "Application Temporarily Unavailable" kontrolü
      await checkAndHandleUnavailable(driver);

      // Sayfa içeriğini kontrol et - captcha var mı yoksa form sayfası mı?
      console.log("Randevu sayfası kontrol ediliyor...");
      await driver.sleep(1500);
      
      const currentUrl = await driver.getCurrentUrl();
      console.log("Mevcut URL:", currentUrl);
      
      // Form sayfasında mıyız kontrol et
      if (currentUrl.includes('/Global/bls/visatype')) {
        console.log('✅ Form sayfasına direkt gelinmiş - CAPTCHA ATLANMIŞ!');
        console.log('Form ekranı hazır...');
      } else {
        // Sayfa kaynağından da kontrol et
        const pageSource = await driver.getPageSource();
        const hasFormTitle = pageSource.includes('Book New Appointment - Visa Type Selection');
        
        if (hasFormTitle) {
          console.log('✅ Form sayfası tespit edildi (page source) - CAPTCHA YOK!');
        } else {
          console.log('Captcha sayfası tespit edildi, çözülüyor...');
        
        // Randevu sayfası captcha'sını çöz - retry mekanizması ile
        let appointmentCaptchaSuccess = false;
        let appointmentRetries = 0;
        const maxAppointmentRetries = 3;
        
        while (!appointmentCaptchaSuccess && appointmentRetries < maxAppointmentRetries) {
          try {
            if (appointmentRetries > 0) {
              console.log(`\n🔄 Randevu captcha tekrar deneniyor (${appointmentRetries + 1}/${maxAppointmentRetries})...`);
              await driver.sleep(1500);
              
              // Eğer sayfa refresh olduysa tekrar "Book Now"a tıkla
              const currentUrl = await driver.getCurrentUrl();
              if (currentUrl.includes('/home/index')) {
                console.log("Home sayfasına geri döndük, tekrar 'Book Now' tıklanıyor...");
                const retryBookNowBtn = await driver.findElement(
                  By.css('a[href="/Global/appointment/newappointment"]')
                );
                await retryBookNowBtn.click();
                await driver.sleep(1500);
              }
            }
            
            console.log("Randevu sayfası captcha'sı çözülüyor...");
            await solveCaptchaInIframe(driver);
            
            // Captcha sonrası "Application Temporarily Unavailable" kontrolü
            await driver.sleep(1500);
            console.log("Randevu captcha sonrası kontrol yapılıyor...");
            await checkAndHandleUnavailable(driver);
            
            // Form sayfasına gidene kadar bekle
            console.log("Form sayfasına yönlendirme bekleniyor...");
            await driver.sleep(1500);
            
            try {
              await driver.wait(until.urlContains("/Global/bls/visatype"), 10000);
              console.log("✅ Randevu captcha başarılı! Form sayfasına yönlendirildi.");
              appointmentCaptchaSuccess = true;
            } catch (e) {
              // URL kontrolü başarısız, sayfa kaynağından kontrol et
              const pageCheck = await driver.getPageSource();
              if (pageCheck.includes('Book New Appointment - Visa Type Selection')) {
                console.log("✅ Form sayfası tespit edildi (alternatif kontrol)!");
                appointmentCaptchaSuccess = true;
              } else {
                throw new Error("Form sayfasına yönlendirilmedi");
              }
            }
            
          } catch (e) {
            appointmentRetries++;
            console.log(`❌ Randevu captcha başarısız: ${e.message}`);
            
            if (appointmentRetries >= maxAppointmentRetries) {
              console.log(`❌ Maksimum retry sayısına ulaşıldı (${maxAppointmentRetries})`);
              throw new Error("Randevu captcha başarısız - maksimum deneme sayısı aşıldı");
            }
            
            await driver.sleep(3000);
          }
        }
        }
      }

      await driver.sleep(2000);

      // "Application Temporarily Unavailable" kontrolü
      await checkAndHandleUnavailable(driver);

      // "Application Temporarily Unavailable" kontrolü
      await checkAndHandleUnavailable(driver);

      console.log("✅ Form sayfası hazır!");
      await driver.sleep(2000);
      
      // Dropdown'ların yüklenmesini bekle
      await driver.wait(
        until.elementLocated(By.css("span.k-dropdown-wrap")),
        10000
      );
      console.log("📝 Dropdown'lar yüklendi, form dolduruluyor...\n");
      await driver.sleep(1000);

      // Form doldurma - Label text'e göre
      const formSuccess = {
        jurisdiction: false,
        location: false,
        visaType: false,
        visaSubType: false,
        category: false
      };

      // 1. Jurisdiction
      formSuccess.jurisdiction = await selectKendoDropdownByLabel(driver, "Jurisdiction", "Ankara");
      if (!formSuccess.jurisdiction) {
        console.log("❌ Jurisdiction seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Jurisdiction");
      }
      await driver.sleep(500);

      // 2. Location
      formSuccess.location = await selectKendoDropdownByLabel(driver, "Location", "Ankara");
      if (!formSuccess.location) {
        console.log("❌ Location seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Location");
      }
      await driver.sleep(500);

      // 3. Visa Type
      formSuccess.visaType = await selectKendoDropdownByLabel(driver, "Visa Type", "Schengen Visa/ Short Term Visa");
      if (!formSuccess.visaType) {
        console.log("❌ Visa Type seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Visa Type");
      }
      await driver.sleep(500);

      // 4. Visa Sub Type
      formSuccess.visaSubType = await selectKendoDropdownByLabel(driver, "Visa Sub Type", "Tourist Visa");
      if (!formSuccess.visaSubType) {
        console.log("❌ Visa Sub Type seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Visa Sub Type");
      }
      await driver.sleep(500);

      // 5. Appointment For (Radio button - atlıyoruz, varsayılan Individual seçili)
      console.log("\n📌 Appointment For: Individual (varsayılan)\n");
      
      // 6. Category
      formSuccess.category = await selectKendoDropdownByLabel(driver, "Category", "Normal");
      if (!formSuccess.category) {
        console.log("❌ Category seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Category");
      }
      await driver.sleep(500);
      
      console.log("\n✅ TÜM FORM ALANLARI BAŞARIYLA DOLDURULDU!\n");

      await driver.sleep(500);

      // "Application Temporarily Unavailable" kontrolü (submit öncesi)
      await checkAndHandleUnavailable(driver);

      // Submit butonu
      console.log("Submit butonu aranıyor...");
      const submitBtn = await driver.findElement(By.id("btnSubmit"));
      
      await driver.wait(until.elementIsVisible(submitBtn), 5000);
      await driver.wait(until.elementIsEnabled(submitBtn), 5000);
      
      try {
        await submitBtn.click();
        console.log("✅ Form gönderildi!");
      } catch (e) {
        console.log("JS ile gönderiliyor...");
        await driver.executeScript("arguments[0].click();", submitBtn);
        console.log("✅ Form JS ile gönderildi!");
      }

      await driver.sleep(5000);

      // "Application Temporarily Unavailable" kontrolü (submit sonrası)
      await checkAndHandleUnavailable(driver);

      await driver.sleep(3000);
      
      // ========== SENARYO 1: Form submit sonrası captcha kontrolü ==========
      console.log("📋 Form submit sonrası sayfa kontrol ediliyor...");
      const postSubmitUrl = await driver.getCurrentUrl();
      const postSubmitPageSource = await driver.getPageSource();
      
      // Slot Selection sayfası mı?
      const hasSlotSelectionTitle = postSubmitPageSource.includes('Book New Appointment - Slot Selection');
      
      // Captcha sayfası mı?
      const hasCaptcha = !hasSlotSelectionTitle && postSubmitPageSource.includes('Please select all boxes');
      
      // "No slots available" mesajı kontrolü
      const noSlotsMessage = postSubmitPageSource.includes('Currently, no slots are available');
      
      if (noSlotsMessage) {
        console.log("⚠️ Normal Category'de slot yok: Currently, no slots are available");
        console.log("Premium Category deneniyor...");
        
        // Try Again butonuna basarak forma geri dön
        try {
          await tryPremiumCategory(driver);
          // Premium akışı başarılı olduysa buradan devam eder
          // Eğer Premium'da da slot yoksa return yapacak
        } catch (e) {
          console.log("❌ Premium Category akışında hata:", e.message);
          return;
        }
        
        // Premium akışı tamamlandı (slot bulundu veya bulunamadı)
        return;
      }
      
      // Randevu kapalı mı? (Error sayfası veya farklı bir sayfa)
      const isAppointmentClosed = !hasSlotSelectionTitle && !hasCaptcha && 
                                   (postSubmitPageSource.includes('No appointments available') ||
                                    postSubmitPageSource.includes('currently unavailable') ||
                                    postSubmitPageSource.includes('Şu anda randevu bulunmamaktadır') ||
                                    (!postSubmitUrl.includes('/slot') && !postSubmitUrl.includes('/captcha')));
      
      if (hasCaptcha) {
        console.log("🔒 Form submit sonrası CAPTCHA ekranı tespit edildi!");
        console.log("Captcha çözülüyor...");
        
        await solveCaptchaInIframe(driver);
        
        // Captcha sonrası "Application Temporarily Unavailable" kontrolü
        await driver.sleep(2000);
        console.log("Form submit captcha sonrası kontrol yapılıyor...");
        await checkAndHandleUnavailable(driver);
        
        await driver.sleep(3000);
        
        // Captcha sonrası tekrar kontrol
        const afterCaptchaPageSource = await driver.getPageSource();
        const afterCaptchaHasSlotTitle = afterCaptchaPageSource.includes('Book New Appointment - Slot Selection');
        const noSlotsAvailable = afterCaptchaPageSource.includes('Currently, no slots are available');
        
        if (noSlotsAvailable) {
          console.log("⚠️ Normal Category'de slot yok (captcha sonrası): Currently, no slots are available");
          console.log("Premium Category deneniyor...");
          
          // Try Again butonuna basarak forma geri dön
          try {
            await tryPremiumCategory(driver);
            // Premium akışı başarılı olduysa buradan devam eder
          } catch (e) {
            console.log("❌ Premium Category akışında hata:", e.message);
            return;
          }
          
          // Premium akışı tamamlandı
          return;
        }
        
        if (!afterCaptchaHasSlotTitle) {
          console.log("❌ Captcha sonrası Slot Selection sayfasına yönlendirilemedi!");
          throw new Error("Slot Selection sayfasına erişilemedi");
        }
        
        console.log("✅ Captcha çözüldü, Slot Selection sayfasına yönlendirildi!");
      } else if (isAppointmentClosed) {
        console.log("❌ Normal Category'de randevular kapalı!");
        console.log("Slot Selection veya Captcha ekranı gelmedi - Premium deneniyor...");
        
        // Try Again butonuna basarak forma geri dön
        try {
          await tryPremiumCategory(driver);
        } catch (e) {
          console.log("❌ Premium Category akışında hata:", e.message);
          return;
        }
        
        // Premium akışı tamamlandı
        return;
      } else if (hasSlotSelectionTitle) {
        console.log("✅ Slot Selection sayfasına direkt yönlendirildi (captcha yok)!");
      }
      
      // ========== SENARYO 2: Slot Selection sayfası ==========
      console.log("\n📅 NORMAL CATEGORY - SLOT SELECTION SAYFASI\n");
      await driver.sleep(2000);
      
      // Slot tarama ve bildirim fonksiyonunu çağır
      await scanAndNotifySlots(driver, "Normal");
      
      return;
      
    } catch (e) {
      console.error('❌ Hata oluştu:', e.message);
      
      // Form doldurma hatası mı kontrol et
      if (e.message && e.message.includes('Form doldurma başarısız')) {
        const errorStep = e.message.replace('Form doldurma başarısız: ', '');
        try {
          await notifyFormError(errorStep);
        } catch (telegramError) {
          console.log("Telegram bildirimi gönderilemedi");
        }
      } else {
        // Genel hata bildirimi
        try {
          await notifyBotError(e.message);
        } catch (telegramError) {
          console.log("Telegram bildirimi gönderilemedi");
        }
      }
    } finally {
      await driver.quit();
    }
  })();
}

// app.js artık sadece main() fonksiyonunu çalıştırıyor
// Döngü için main.js kullanılmalı!
main();