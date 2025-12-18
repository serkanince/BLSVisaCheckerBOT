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

      // Sayfadaki tüm iframe'leri kontrol et
      console.log("Sayfadaki iframe'ler kontrol ediliyor...");
      try {
        const allIframes = await driver.findElements(By.css('iframe'));
        console.log(`Toplam ${allIframes.length} iframe bulundu`);
        for (let i = 0; i < allIframes.length; i++) {
          try {
            const iframe = allIframes[i];
            const title = await iframe.getAttribute('title');
            const src = await iframe.getAttribute('src');
            const id = await iframe.getAttribute('id');
            console.log(`Iframe ${i}: title="${title}", src="${src ? src.substring(0, 50) : 'null'}", id="${id}"`);
          } catch (e) {
            console.log(`Iframe ${i} kontrol edilemedi:`, e.message);
          }
        }
      } catch (e) {
        console.log("Iframe kontrolü başarısız:", e.message);
      }

      // Login captcha'yı çöz - retry mekanizması ile
      let loginSuccess = false;
      let loginRetries = 0;
      const maxLoginRetries = 3;
      
      while (!loginSuccess && loginRetries < maxLoginRetries) {
        try {
          if (loginRetries > 0) {
            console.log(`\n🔄 Login tekrar deneniyor (${loginRetries + 1}/${maxLoginRetries})...`);
            
            // Sayfa refresh olduysa tekrar email gir
            const currentUrl = await driver.getCurrentUrl();
            if (currentUrl.includes('/Account/LogIn')) {
              console.log("Login sayfasına geri döndük, tekrar email giriliyor...");
              
              // Email input bul ve doldur
              await driver.sleep(2000);
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
                    await driver.findElement(By.id("btnVerify")).click();
                    await driver.sleep(3000);
                    
                    // Password sayfası - password gir
                    const retryPasswords = await driver.findElements(By.css('input[type="password"]'));
                    for (let passInput of retryPasswords) {
                      try {
                        const passDisplayed = await passInput.isDisplayed();
                        const passRect = await passInput.getRect();
                        if (passDisplayed && passRect.width > 50) {
                          await driver.executeScript("arguments[0].value = '';", passInput);
                          await passInput.sendKeys(PASSWORD);
                          console.log("✅ Password tekrar girildi!");
                          break;
                        }
                      } catch (e) {}
                    }
                    await driver.sleep(2000);
                    break;
                  }
                } catch (e) {}
              }
            }
          }
          
          console.log("Login captcha çözülüyor...");
          await solveCaptchaInIframe(driver);
          
          // Captcha sonrası "Application Temporarily Unavailable" kontrolü
          await driver.sleep(2000);
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

      await driver.sleep(3000);

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

      await driver.sleep(3000);

      // "Application Temporarily Unavailable" kontrolü
      await checkAndHandleUnavailable(driver);

      // Sayfa içeriğini kontrol et - captcha var mı yoksa form sayfası mı?
      console.log("Randevu sayfası kontrol ediliyor...");
      await driver.sleep(3000);
      
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
              await driver.sleep(2000);
              
              // Eğer sayfa refresh olduysa tekrar "Book Now"a tıkla
              const currentUrl = await driver.getCurrentUrl();
              if (currentUrl.includes('/home/index')) {
                console.log("Home sayfasına geri döndük, tekrar 'Book Now' tıklanıyor...");
                const retryBookNowBtn = await driver.findElement(
                  By.css('a[href="/Global/appointment/newappointment"]')
                );
                await retryBookNowBtn.click();
                await driver.sleep(3000);
              }
            }
            
            console.log("Randevu sayfası captcha'sı çözülüyor...");
            await solveCaptchaInIframe(driver);
            
            // Captcha sonrası "Application Temporarily Unavailable" kontrolü
            await driver.sleep(2000);
            console.log("Randevu captcha sonrası kontrol yapılıyor...");
            await checkAndHandleUnavailable(driver);
            
            // Form sayfasına gidene kadar bekle
            console.log("Form sayfasına yönlendirme bekleniyor...");
            await driver.sleep(3000);
            
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
      await driver.sleep(1500);

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
      await driver.sleep(2000);

      // 2. Location
      formSuccess.location = await selectKendoDropdownByLabel(driver, "Location", "Ankara");
      if (!formSuccess.location) {
        console.log("❌ Location seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Location");
      }
      await driver.sleep(2000);

      // 3. Visa Type
      formSuccess.visaType = await selectKendoDropdownByLabel(driver, "Visa Type", "Schengen Visa/ Short Term Visa");
      if (!formSuccess.visaType) {
        console.log("❌ Visa Type seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Visa Type");
      }
      await driver.sleep(2000);

      // 4. Visa Sub Type
      formSuccess.visaSubType = await selectKendoDropdownByLabel(driver, "Visa Sub Type", "Tourist Visa");
      if (!formSuccess.visaSubType) {
        console.log("❌ Visa Sub Type seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Visa Sub Type");
      }
      await driver.sleep(2000);

      // 5. Appointment For (Radio button - atlıyoruz, varsayılan Individual seçili)
      console.log("\n📌 Appointment For: Individual (varsayılan)\n");
      
      // 6. Category
      formSuccess.category = await selectKendoDropdownByLabel(driver, "Category", "Normal");
      if (!formSuccess.category) {
        console.log("❌ Category seçilemedi, form gönderilemez!");
        throw new Error("Form doldurma başarısız: Category");
      }
      await driver.sleep(1500);
      
      console.log("\n✅ TÜM FORM ALANLARI BAŞARIYLA DOLDURULDU!\n");

      await driver.sleep(1000);

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
        console.log("⚠️ RANDEVULAR KAPALI: Currently, no slots are available");
        console.log("Seçilen kategori için şu anda randevu yok.");
        
        try {
          await notifyAppointmentsClosed();
        } catch (e) {
          console.log("Telegram bildirimi gönderilemedi");
        }
        
        return; // Script'i sonlandır
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
          console.log("⚠️ RANDEVULAR KAPALI: Currently, no slots are available");
          console.log("Seçilen kategori için şu anda randevu yok.");
          
          try {
            await notifyAppointmentsClosed();
          } catch (e) {
            console.log("Telegram bildirimi gönderilemedi");
          }
          
          return; // Script'i sonlandır
        }
        
        if (!afterCaptchaHasSlotTitle) {
          console.log("❌ Captcha sonrası Slot Selection sayfasına yönlendirilemedi!");
          throw new Error("Slot Selection sayfasına erişilemedi");
        }
        
        console.log("✅ Captcha çözüldü, Slot Selection sayfasına yönlendirildi!");
      } else if (isAppointmentClosed) {
        console.log("❌ RANDEVULAR TAMAMEN KAPALI!");
        console.log("Slot Selection veya Captcha ekranı gelmedi - randevu yok!");
        
        try {
          await notifyAppointmentsClosed();
        } catch (e) {
          console.log("Telegram bildirimi gönderilemedi");
        }
        
        // Bu durumda script'i sonlandır
        return;
      } else if (hasSlotSelectionTitle) {
        console.log("✅ Slot Selection sayfasına direkt yönlendirildi (captcha yok)!");
      }
      
      // ========== SENARYO 2: Slot Selection sayfası ==========
      console.log("\n📅 SLOT SELECTION SAYFASI\n");
      await driver.sleep(2000);
      
      // Appointment Date picker'ı bul (görünür olanı)
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
        console.log("❌ Hiçbir date picker bulunamadı!");
        console.log("🔔 AMA SLOT SAYFASINA ULAŞILDI! Manuel kontrol öneriliyor...");
        
        try {
          await notifySlotPageReached("Date picker bulunamadı ama slot sayfası açık!");
        } catch (e) {
          console.log("Telegram bildirimi gönderilemedi");
        }
        
        throw new Error("Date picker bulunamadı");
      }
      
      // Date picker'a tıkla - Birden fazla yöntemle dene
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
            // Takvim ikonunu bul (input'un yanındaki)
            const parent = await visibleDatePicker.findElement(By.xpath('../..'));
            const calendarIcon = await parent.findElement(By.css('.k-icon.k-i-calendar'));
            await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", calendarIcon);
            await driver.sleep(500);
            await driver.executeScript("arguments[0].click();", calendarIcon);
          }
        },
        {
          name: "Focus + Enter",
          fn: async () => {
            await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", visibleDatePicker);
            await driver.sleep(500);
            await driver.executeScript("arguments[0].focus();", visibleDatePicker);
            await driver.sleep(300);
            await visibleDatePicker.sendKeys(Key.ENTER);
          }
        }
      ];
      
      for (const method of openMethods) {
        try {
          console.log(`  Deneniyor: ${method.name}...`);
          await method.fn();
          await driver.sleep(2000);
          
          // Takvimin açıldığını kontrol et
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
        console.log("❌ Hiçbir yöntemle takvim açılamadı!");
        console.log("🔔 AMA SLOT SAYFASINA ULAŞILDI! Manuel kontrol öneriliyor...");
        
        // Slot sayfasına ulaşıldı ama takvim açılamadı - bu önemli!
        try {
          await notifySlotPageReached("Takvim açılamadı ama slot sayfası açık!");
        } catch (e) {
          console.log("Telegram bildirimi gönderilemedi");
        }
        
        throw new Error("Takvim açılamadı - tüm yöntemler denendi");
      }
      
      await driver.sleep(2000);
      
      // Takvim elementinin varlığını kesin kontrol et
      const calendarExists = await driver.findElements(By.css('.k-calendar'));
      if (calendarExists.length === 0) {
        console.log("❌ Takvim elementi bulunamadı!");
        
        // Son bir deneme: Tüm takvim container'ları kontrol et
        const anyCalendar = await driver.findElements(By.css('.k-calendar-container, .k-datepicker, .k-animation-container'));
        console.log(`Debug: ${anyCalendar.length} takvim benzeri element bulundu`);
        
        if (anyCalendar.length === 0) {
          console.log("🔔 Slot sayfasına ulaşıldı ama takvim elementi yok!");
          
          try {
            await notifySlotPageReached("Takvim elementi bulunamadı ama slot sayfası açık!");
          } catch (e) {
            console.log("Telegram bildirimi gönderilemedi");
          }
          
          throw new Error("Takvim açılamadı - hiçbir takvim elementi yok");
        }
      }
      
      console.log(`✅ ${calendarExists.length} takvim elementi bulundu`);
      
      // ========== YEŞİL TARİHLERİ BULMA SİSTEMİ ==========
      console.log("\n🔍 TÜM AYLARI TARAYARAK YEŞİL TARİHLER ARANIYOR...\n");
      
      const availableDatesWithSlots = [];
      const maxMonthsToCheck = 12; // Maksimum 12 ay ileriye bak
      
      for (let monthIndex = 0; monthIndex < maxMonthsToCheck; monthIndex++) {
        try {
          // Mevcut ay başlığını al - daha robust selector
          let monthTitle = null;
          try {
            monthTitle = await driver.findElement(By.css('.k-calendar .k-nav-fast'));
          } catch (e) {
            // Alternatif selector dene
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
          
          // Bu aydaki TÜM tarihleri kontrol et
          const allDateLinks = await driver.findElements(By.css('.k-calendar a.k-link[data-value]'));
          console.log(`  Toplam ${allDateLinks.length} tarih elementi bulundu`);
          
          if (allDateLinks.length === 0) {
            console.log("⚠️ Hiç tarih elementi bulunamadı, sonraki aya geçiliyor");
            continue;
          }
          
          let foundInThisMonth = 0;
          
          for (let i = 0; i < allDateLinks.length; i++) {
            try {
              const dateLink = allDateLinks[i];
              const dataValue = await dateLink.getAttribute('data-value');
              
              if (!dataValue) {
                continue; // data-value yoksa atla
              }
              
              const parentTd = await dateLink.findElement(By.xpath('..'));
              
              // k-state-disabled olanları atla (disabled tarihler)
              const tdClass = await parentTd.getAttribute('class');
              if (tdClass && tdClass.includes('k-state-disabled')) {
                continue;
              }
              
              // JavaScript ile background-color kontrolü (daha güvenilir)
              const colorInfo = await driver.executeScript(`
                const link = arguments[0];
                const style = window.getComputedStyle(link);
                const bgColor = style.backgroundColor;
                
                // RGB'yi parse et
                const match = bgColor.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
                if (!match) return { bgColor: bgColor, isGreen: false };
                
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                
                // Yeşil kontrolü: G dominant, R ve B düşük
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
                  rgb: colorInfo.rgb
                });
                foundInThisMonth++;
                console.log(`  ✅ YEŞİL TARİH: ${dateText} ${currentMonth} (${dataValue}) - ${colorInfo.bgColor}`);
              }
            } catch (e) {
              // Bu tarihi atlayıp devam et
              continue;
            }
          }
          
          if (foundInThisMonth > 0) {
            console.log(`✅ ${currentMonth}: ${foundInThisMonth} yeşil tarih bulundu!`);
          } else {
            console.log(`⚪ ${currentMonth}: Yeşil tarih yok`);
          }
          
          // Son ay mı kontrol et (daha fazla ilerleyebilir miyiz?)
          if (monthIndex < maxMonthsToCheck - 1) {
            // Bir sonraki aya geç (sağ ok butonu)
            try {
              const nextMonthBtns = await driver.findElements(By.css('.k-calendar .k-nav-next'));
              
              if (nextMonthBtns.length === 0) {
                console.log("⚠️ Sonraki ay butonu bulunamadı");
                break;
              }
              
              const nextMonthBtn = nextMonthBtns[0];
              
              // Buton disabled mı kontrol et
              const btnClass = await nextMonthBtn.getAttribute('class');
              if (btnClass && btnClass.includes('k-state-disabled')) {
                console.log("⚠️ Sonraki ay butonu disabled - son aya ulaşıldı");
                break;
              }
              
              // Butona tıkla
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
      
      console.log(`\n📊 TOPLAM ${availableDatesWithSlots.length} YEŞİL TARİH BULUNDU!\n`);
      
      if (availableDatesWithSlots.length === 0) {
        console.log("❌ HİÇBİR UYGUN TARİH YOK!");
        
        try {
          await notifyNoAppointments(maxMonthsToCheck);
          console.log("✅ Telegram bildirimi gönderildi!");
        } catch (e) {
          console.log("❌ Telegram bildirimi gönderilemedi:", e.message);
        }
        
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
      
      console.log("\n🎉 RANDEVU TARAMASI TAMAMLANDI!\n");
      
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

// ========== BOT LOOP ==========
(async function loop() {
  console.log("\n🤖 BLS VİZE RANDEVU BOT BAŞLADI!\n");
  console.log("⚙️  Ayarlar:");
  console.log("   📍 Lokasyon: Ankara");
  console.log("   🎫 Vize Tipi: Schengen Turist");
  console.log("   ⏱  Kontrol Aralığı: 15 dakika");
  console.log("   📱 Telegram: Sadece sonuç bildirimleri\n");
  
  let runCount = 0;
  
  while (true) {
    runCount++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 DÖNGÜ #${runCount} BAŞLADI - ${new Date().toLocaleString('tr-TR')}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      await main();
    } catch (e) {
      console.error(`\n❌ Döngü #${runCount} hatası:`, e.message);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ DÖNGÜ #${runCount} TAMAMLANDI`);
    console.log(`⏰ Sonraki kontrol: ${new Date(Date.now() + 15 * 60 * 1000).toLocaleString('tr-TR')}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // 15 dakika bekle
    await new Promise(res => setTimeout(res, 15 * 60 * 1000));
  }
})();