const { Builder, Browser, By, Key, until } = require("selenium-webdriver");
const { solveCaptchaInIframe } = require("./captchaSolver");
const {
  notifyAppointmentFound,
  notifySlotPageReached
} = require("./telegramNotifier");
const CFG = require("./config");
const MSG = require("./messages");
const { saveLastCity, loadLastCity, getOrderedCities, isLocationAlreadySet } = require("./stateManager");

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
        console.log(MSG.UNAVAILABLE_DETECTED);
        await driver.sleep(5000);
        console.log(MSG.UNAVAILABLE_REFRESHING);
        await driver.navigate().refresh();
        await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
        console.log(MSG.PAGE_REFRESHED);
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
    labelText,
    visibleText,
    timeout = CFG.DROPDOWN.TIMEOUT
  ) {
    const targetText = visibleText.trim().toLowerCase();

    try {
      console.log(MSG.DROPDOWN_SEARCHING(labelText, visibleText));

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
              console.log(MSG.DROPDOWN_FOUND(labelText));
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
        console.log(MSG.DROPDOWN_NOT_FOUND(labelText));
        return false;
      }

      // Dropdown'a tıkla
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", targetDropdown);
      await driver.sleep(CFG.SLEEP.SHORT);
      await driver.executeScript("arguments[0].click();", targetDropdown);
      console.log(MSG.DROPDOWN_OPENED(labelText));
      await driver.sleep(400);

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
                    await driver.sleep(150);
                    await driver.executeScript("arguments[0].click();", item);
                    console.log(MSG.DROPDOWN_SELECTED(labelText, txt));
                    await driver.sleep(400);
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
        await driver.sleep(200);
      }

      if (!found) {
        console.log(MSG.DROPDOWN_NOT_SELECTED(labelText, visibleText));
      }
      return found;

    } catch (e) {
      console.log(MSG.DROPDOWN_ERROR(labelText, e.message));
      return false;
    }
  }

  // ============================================================
  // MyAppointments sayfasında başvuru sahibi konumunu ayarla
  // ============================================================
  async function setApplicantLocation(driver, city) {
    console.log(MSG.LOCATION_SET_STARTING(city.name));

    try {
      // 1. MyAppointments sayfasına git
      console.log(MSG.LOCATION_SET_PAGE_LOADING);
      await driver.get(CFG.MY_APPOINTMENTS_URL);
      await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
      await checkAndHandleUnavailable(driver);
      await driver.sleep(CFG.SLEEP.LONG);

      // 2. Edit (ManageApplicant) butonuna tıkla - "Primary Applicant" veya ilk görünür olanı seç
      console.log(MSG.LOCATION_SET_EDIT_SEARCHING);
      let editBtn = null;

      try {
        // "Primary Applicant" yazan kişinin detay satırını bul (Ayrıca 'Add New Member' butonunu ekarte eder)
        editBtn = await driver.findElement(
          By.xpath("//div[contains(@class, 'row') and contains(@class, 'border') and contains(., 'Primary Applicant')]//a[contains(@onclick, 'ManageApplicant')]")
        );
      } catch (e) {
        // Fallback 1: onclick'te ManageApplicant geçen herhangi bir <a>
        try {
          const editBtns = await driver.findElements(By.css('a[onclick*="ManageApplicant"]'));
          for (const btn of editBtns) {
            if (await btn.isDisplayed()) { editBtn = btn; break; }
          }
        } catch (_) { }
      }

      // Fallback 2: "Edit" metnine sahip herhangi görünür buton/link
      if (!editBtn) {
        try {
          const allEdits = await driver.findElements(
            By.xpath("//a[contains(@class,'btn') and (contains(text(),'Edit') or contains(@title,'Edit'))] | //button[contains(text(),'Edit')]")
          );
          for (const btn of allEdits) {
            if (await btn.isDisplayed()) { editBtn = btn; break; }
          }
        } catch (_) { }
      }

      if (!editBtn) throw new Error('Edit butonu bulunamadı veya tıklanamadı');

      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", editBtn);
      await driver.sleep(CFG.SLEEP.SHORT);
      await driver.executeScript("arguments[0].click();", editBtn);
      console.log(MSG.LOCATION_SET_EDIT_CLICKED);

      // ─────────────────────────────────────────────────────────────
      // AŞAMA A: Bootstrap modal (ana DOM'da — iframe YOK)
      //   Yapı:  div.modal-content > div.modal-body  (Location + Visa Type)
      //                            > div.modal-footer > button "Proceed"
      // ─────────────────────────────────────────────────────────────

      // Modal'ın açılmasını bekle
      await driver.sleep(1000);
      await driver.wait(
        until.elementLocated(By.css('div.modal-content')),
        CFG.DROPDOWN.TIMEOUT
      );
      console.log(MSG.LOCATION_SET_POPUP_READY);
      await driver.sleep(CFG.SLEEP.MEDIUM);

      // 3. Location dropdown'unu şehre göre set et (ana DOM / Bootstrap modal)
      const locationSet = await selectKendoDropdownByLabel(driver, 'Location', city.LOCATION);
      if (!locationSet) throw new Error(`Location "${city.LOCATION}" seçilemedi`);
      console.log(MSG.LOCATION_SET_DROPDOWN_SET(city.name));
      await driver.sleep(CFG.SLEEP.LONG);

      // 4. Visa Type kontrol et - Schengen Visa olmalı (ana DOM)
      let currentVisaType = '';
      try {
        const visaTypeInput = await driver.findElement(By.css('span[aria-owns="VisaType_listbox"] .k-input, .k-input[aria-controls="VisaType_listbox"]'));
        currentVisaType = await visaTypeInput.getText();
      } catch (_) { /* okunamazsa boş kalır */ }

      if (currentVisaType.includes('Schengen')) {
        console.log(MSG.LOCATION_SET_VISA_TYPE_OK);
      } else {
        const visaSet = await selectKendoDropdownByLabel(driver, 'Visa Type', CFG.FORM.VISA_TYPE);
        if (!visaSet) throw new Error('Visa Type seçilemedi');
        console.log(MSG.LOCATION_SET_VISA_TYPE_SET);
        await driver.sleep(CFG.SLEEP.MEDIUM);
      }

      // 5. Proceed butonuna tıkla — ana DOM'daki modal-footer içinde
      //    <button class="btn btn-success" type="button" onclick="VisaTypeProceed();">Proceed</button>
      const proceedBtn = await driver.findElement(
        By.xpath("//div[contains(@class,'modal-footer')]//button[contains(text(),'Proceed')]")
      );
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", proceedBtn);
      await driver.sleep(CFG.SLEEP.SHORT);
      await driver.executeScript("arguments[0].click();", proceedBtn);
      console.log(MSG.LOCATION_SET_PROCEED_CLICKED);

      // ─────────────────────────────────────────────────────────────
      // AŞAMA B: Kendo Window + iframe (ManageApplicant)
      //   Proceed → VisaTypeProceed() → Kendo Window açılır
      //   İçinde:  <iframe class="k-content-frame" src="/Global/appointmentdata/ManageApplicant?...">
      //   Submit butonu bu iframe içindedir.
      // ─────────────────────────────────────────────────────────────

      // iframe'in DOM'a girmesini bekle
      await driver.sleep(2000);
      await driver.wait(
        until.elementLocated(By.css('iframe.k-content-frame')),
        CFG.DROPDOWN.TIMEOUT
      );
      await driver.sleep(500);

      // iframe'e geç
      const popupIframe = await driver.findElement(By.css('iframe.k-content-frame'));
      await driver.switchTo().frame(popupIframe);

      // iframe içindeki içeriğin yüklenmesini bekle
      await driver.sleep(1000);

      // 6. Submit butonunu bul (iframe context'inde) — birden fazla strateji
      let submitBtn = null;

      // Strateji 1: btn-primary + "Submit" metni
      try {
        const s1 = await driver.findElements(
          By.xpath("//button[contains(@class,'btn-primary') and normalize-space(text())='Submit']")
        );
        for (const btn of s1) {
          if (await btn.isDisplayed()) { submitBtn = btn; break; }
        }
      } catch (_) { }

      // Strateji 2: type=submit + btn-primary
      if (!submitBtn) {
        try {
          const s2 = await driver.findElements(
            By.xpath("//button[@type='submit' and contains(@class,'btn-primary')]")
          );
          for (const btn of s2) {
            if (await btn.isDisplayed()) { submitBtn = btn; break; }
          }
        } catch (_) { }
      }

      // Strateji 3: Herhangi görünür type=submit butonu
      if (!submitBtn) {
        try {
          const s3 = await driver.findElements(By.xpath("//button[@type='submit']"));
          for (const btn of s3) {
            if (await btn.isDisplayed()) { submitBtn = btn; break; }
          }
        } catch (_) { }
      }

      // Strateji 4: JS ile iframe document içindeki butonları tara
      if (!submitBtn) {
        console.log('⚠️ Selenium ile Submit bulunamadı, JS ile deneniyor...');
        try {
          await driver.executeScript(`
            var btns = document.querySelectorAll('button[type="submit"], button.btn-primary');
            for (var b of btns) {
              if (b.offsetParent !== null) { b.click(); break; }
            }
          `);
          console.log(MSG.LOCATION_SET_SUBMIT_CLICKED);
          await driver.sleep(1000);
          submitBtn = 'clicked_via_js'; // sentinel
        } catch (jsErr) {
          console.log('⚠️ JS click de başarısız: ' + jsErr.message);
        }
      }

      if (!submitBtn) {
        await driver.switchTo().defaultContent();
        throw new Error('Submit butonu hiçbir strateji ile bulunamadı!');
      }

      if (submitBtn !== 'clicked_via_js') {
        await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", submitBtn);
        await driver.sleep(CFG.SLEEP.SHORT);
        await driver.executeScript("arguments[0].click();", submitBtn);
        console.log(MSG.LOCATION_SET_SUBMIT_CLICKED);
        await driver.sleep(500); // kısa bekle — alert hızlı açılıyor
      }

      // 7. Alert'i kabul et — alert açıkken switchTo().defaultContent() da throw eder!
      //    Bu yüzden önce alert'i kontrol et, sonra context'e dön.
      try {
        // Çok hızlı gelen alert'i yakalamak için kısa bir wait ile dene
        await driver.wait(until.alertIsPresent(), 3000);
        const alert = await driver.switchTo().alert();
        await alert.accept();
        console.log(MSG.LOCATION_SET_ALERT_CLOSED);
      } catch (_) {
        // Alert henüz açılmadı — iframe'den çık, sonra tekrar dene
        try {
          await driver.switchTo().defaultContent();
        } catch (switchErr) {
          // defaultContent geçişi de fail ederse alert vardır, yakala
          try {
            const lateAlert = await driver.switchTo().alert();
            await lateAlert.accept();
            console.log(MSG.LOCATION_SET_ALERT_CLOSED);
          } catch (_2) { /* alert yoksa önemsiz */ }
        }
        // Son bir kez daha alert var mı diye bak
        try {
          await driver.wait(until.alertIsPresent(), 2000);
          const alert2 = await driver.switchTo().alert();
          await alert2.accept();
          console.log(MSG.LOCATION_SET_ALERT_CLOSED);
        } catch (_) {
          console.log('⚠️ Alert beklendi ama gelmedi, devam ediliyor...');
        }
      }

      // Her koşulda ana context'e dön (zaten dönülmüş olabilir, try ile safe)
      try { await driver.switchTo().defaultContent(); } catch (_) { }

      await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
      console.log(MSG.LOCATION_SET_DONE(city.name));

    } catch (e) {
      console.log(MSG.LOCATION_SET_ERROR(e.message));
      throw e; // Konum ayarlanamadıysa şehri atla
    }
  }

  // Premium Category'yi deneme fonksiyonu
  async function tryPremiumCategory(driver, city) {
    console.log(MSG.PREMIUM_FLOW_STARTING);

    console.log(MSG.TRY_AGAIN_SEARCHING);
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
              await driver.sleep(250);
              await driver.executeScript("arguments[0].click();", link);
              console.log(MSG.TRY_AGAIN_LINK_CLICKED);
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
                await driver.sleep(250);
                await driver.executeScript("arguments[0].click();", btn);
                console.log(MSG.TRY_AGAIN_BTN_CLICKED);
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
        console.log(MSG.TRY_AGAIN_NOT_FOUND);
        const bookNowBtn = await driver.findElement(By.css(`a[href="${CFG.BOOK_NOW_URL}"]`));
        await bookNowBtn.click();
        console.log(MSG.BOOK_NOW_BTN_CLICKED);
      }
    } catch (e) {
      console.log(MSG.TRY_AGAIN_FAILED(e.message));
      throw new Error("Try Again işlemi başarısız");
    }

    await driver.sleep(1500);

    // 2. "Application Temporarily Unavailable" kontrolü
    await checkAndHandleUnavailable(driver);

    // 3. Captcha kontrolü (randevu sayfası)
    console.log(MSG.PREMIUM_CAPTION_PAGE_CHECKING);
    await driver.sleep(CFG.SLEEP.LONG);

    const currentUrl = await driver.getCurrentUrl();
    const pageSource = await driver.getPageSource();

    // Form sayfasında mıyız?
    const hasFormTitle = pageSource.includes('Book New Appointment - Visa Type Selection');

    if (!hasFormTitle && !currentUrl.includes('/Global/bls/visatype')) {
      console.log(MSG.CAPTCHA_DETECTED);

      let captchaSuccess = false;
      let captchaRetries = 0;
      const maxCaptchaRetries = CFG.RETRY.MAX_CAPTCHA_RETRIES;

      while (!captchaSuccess && captchaRetries < maxCaptchaRetries) {
        try {
          if (captchaRetries > 0) {
            console.log(MSG.PREMIUM_CAPTCHA_RETRYING(captchaRetries + 1, maxCaptchaRetries));
            await driver.sleep(CFG.SLEEP.LONG);
          }

          await solveCaptchaInIframe(driver);

          // Captcha sonrası kontrol
          await driver.sleep(1000);
          await checkAndHandleUnavailable(driver);

          // Form sayfasına gidildi mi?
          await driver.sleep(1500);
          const afterCaptchaUrl = await driver.getCurrentUrl();
          const afterCaptchaPage = await driver.getPageSource();

          if (afterCaptchaUrl.includes('/Global/bls/visatype') ||
            afterCaptchaPage.includes('Book New Appointment - Visa Type Selection')) {
            console.log(MSG.CAPTCHA_FORM_SUCCESS);
            captchaSuccess = true;
          } else {
            throw new Error("Form sayfasına yönlendirilemedi");
          }

        } catch (e) {
          captchaRetries++;
          console.log(MSG.PREMIUM_CAPTCHA_FAILED(e.message));

          if (captchaRetries >= maxCaptchaRetries) {
            throw new Error("Captcha çözülemedi - maksimum deneme aşıldı");
          }

          await driver.sleep(1500);
        }
      }
    } else {
      console.log(MSG.CAPTCHA_NOT_NEEDED);
    }

    await driver.sleep(1000);
    await checkAndHandleUnavailable(driver);

    // 4. Form doldurma - Premium seçimi
    console.log(MSG.PREMIUM_FORM_FILLING);

    await driver.wait(until.elementLocated(By.css("span.k-dropdown-wrap")), CFG.DROPDOWN.TIMEOUT);
    await driver.sleep(CFG.SLEEP.MEDIUM);

    const formSuccess = {
      jurisdiction: false,
      location: false,
      visaType: false,
      visaSubType: false,
      category: false
    };

    formSuccess.jurisdiction = await selectKendoDropdownByLabel(driver, "Jurisdiction", city.JURISDICTION);
    if (!formSuccess.jurisdiction) throw new Error("Premium: Jurisdiction seçilemedi");
    await driver.sleep(CFG.SLEEP.SHORT);

    formSuccess.location = await selectKendoDropdownByLabel(driver, "Location", city.LOCATION);
    if (!formSuccess.location) throw new Error("Premium: Location seçilemedi");
    await driver.sleep(CFG.SLEEP.SHORT);

    formSuccess.visaType = await selectKendoDropdownByLabel(driver, "Visa Type", CFG.FORM.VISA_TYPE);
    if (!formSuccess.visaType) throw new Error("Premium: Visa Type seçilemedi");
    await driver.sleep(CFG.SLEEP.SHORT);

    formSuccess.visaSubType = await selectKendoDropdownByLabel(driver, "Visa Sub Type", CFG.FORM.VISA_SUB_TYPE);
    if (!formSuccess.visaSubType) throw new Error("Premium: Visa Sub Type seçilemedi");
    await driver.sleep(CFG.SLEEP.SHORT);

    console.log(MSG.PREMIUM_CATEGORY_SELECTING);
    formSuccess.category = await selectKendoDropdownByLabel(driver, "Category", CFG.FORM.CATEGORY_PREMIUM);
    if (!formSuccess.category) throw new Error("Premium: Category seçilemedi");
    await driver.sleep(CFG.SLEEP.MEDIUM);

    // 6. PREMIUM MODAL DIALOG KONTROLÜ VE ACCEPT
    console.log(MSG.PREMIUM_MODAL_CHECKING);

    try {
      // Modal'ın açılmasını bekle
      await driver.sleep(1000);

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
              console.log(MSG.PREMIUM_MODAL_FOUND);
              console.log(MSG.PREMIUM_MODAL_TEXT(text));
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
                    await driver.sleep(150);
                    await driver.executeScript("arguments[0].click();", btn);
                    console.log(MSG.PREMIUM_MODAL_ACCEPT_CLICKED);
                    acceptClicked = true;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }

              if (!acceptClicked) {
                console.log(MSG.PREMIUM_MODAL_ACCEPT_NOT_FOUND);
              }

              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!modalFound) {
        console.log(MSG.PREMIUM_MODAL_NOT_FOUND);
      }
      await driver.sleep(CFG.SLEEP.MEDIUM);
    } catch (e) {
      console.log(MSG.PREMIUM_MODAL_ERROR(e.message));
    }

    console.log(MSG.PREMIUM_FORM_DONE);
    await driver.sleep(CFG.SLEEP.SHORT);
    await checkAndHandleUnavailable(driver);

    console.log(MSG.PREMIUM_SUBMIT_SEARCHING);
    const submitBtn = await driver.findElement(By.id("btnSubmit"));
    await driver.wait(until.elementIsVisible(submitBtn), 5000);
    await driver.wait(until.elementIsEnabled(submitBtn), 5000);
    try {
      await submitBtn.click();
      console.log(MSG.PREMIUM_SUBMITTED);
    } catch (e) {
      await driver.executeScript("arguments[0].click();", submitBtn);
      console.log(MSG.PREMIUM_SUBMITTED_JS);
    }

    await driver.sleep(CFG.SLEEP.AFTER_SUBMIT);
    await checkAndHandleUnavailable(driver);
    await driver.sleep(CFG.SLEEP.AFTER_LOGIN);

    console.log(MSG.PREMIUM_CHECKING);

    const premiumPageSource = await driver.getPageSource();
    const premiumHasCaptcha = premiumPageSource.includes('Please select all boxes');

    if (premiumHasCaptcha) {
      console.log(MSG.CAPTCHA_PREMIUM_DETECTED);
      console.log(MSG.CAPTCHA_SOLVING);
      try {
        await solveCaptchaInIframe(driver);
        await driver.sleep(CFG.SLEEP.LONG);
        await checkAndHandleUnavailable(driver);
        await driver.sleep(CFG.SLEEP.LONG);
        console.log(MSG.CAPTCHA_PREMIUM_SOLVED);
      } catch (e) {
        console.log(MSG.CAPTCHA_PREMIUM_FAILED(e.message));
        throw new Error("Premium captcha çözülemedi");
      }
    }

    const premiumSlotOpen = await checkIfSlotsAreOpen(driver, "Premium");

    if (premiumSlotOpen) {
      console.log(MSG.PREMIUM_SLOT_FOUND);
      await driver.sleep(CFG.SLEEP.LONG);
      await scanAndNotifySlots(driver, "Premium");
    } else {
      console.log(MSG.PREMIUM_SLOT_NOT_FOUND);
    }
  }

  // ============================================================
  // Tek bir şehir için tam tarama akışı (Normal + Premium)
  // ============================================================
  async function scanCity(driver, city, skipLocationSet = false) {
    console.log(MSG.CITY_SCAN_START(city.name));

    // Başvuru sahibi konumunu bu şehre ayarla (zaten set ise atla)
    if (!skipLocationSet) {
      await setApplicantLocation(driver, city);
    }
    // BLS profili bu şehre işlendi; Book Now / form / captcha vb. hata verse bile sonraki çalışmada doğru şehirden devam edilsin
    saveLastCity(city.name);

    // Ana sayfaya geri dön
    await driver.get(`https://turkey.blsspainglobal.com${CFG.BLS_HOME_URL}`);
    await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
    await checkAndHandleUnavailable(driver);

    // Her şehir için "Book Now" butonuna tıkla
    console.log(MSG.BOOK_NOW_SEARCHING);
    try {
      // Sayfanın tam yüklenmesini bekle
      await driver.wait(
        until.elementLocated(By.css(`a[href="${CFG.BOOK_NOW_URL}"]`)),
        CFG.DROPDOWN.TIMEOUT
      );
      await driver.sleep(CFG.SLEEP.MEDIUM);

      const bookNowBtn = await driver.findElement(
        By.css(`a[href="${CFG.BOOK_NOW_URL}"]`)
      );

      // Scroll + JS click (element not interactable hatasını önler)
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", bookNowBtn);
      await driver.sleep(CFG.SLEEP.SHORT);

      try {
        await bookNowBtn.click();
      } catch (_) {
        await driver.executeScript("arguments[0].click();", bookNowBtn);
      }
      console.log(MSG.BOOK_NOW_CLICKED);
    } catch (e) {
      console.log(MSG.BOOK_NOW_NOT_FOUND(e.message));
      throw new Error('"Book Now" butonuna tıklanamadı!');
    }

    await driver.sleep(750);
    await checkAndHandleUnavailable(driver);

    console.log(MSG.APPOINTMENT_PAGE_CHECKING);
    await driver.sleep(750);

    const cityCurrentUrl = await driver.getCurrentUrl();
    console.log(MSG.CURRENT_URL(cityCurrentUrl));

    if (cityCurrentUrl.includes(CFG.VISA_TYPE_URL)) {
      console.log(MSG.FORM_DIRECT);
    } else {
      const cityPageSource = await driver.getPageSource();
      const cityHasFormTitle = cityPageSource.includes('Book New Appointment - Visa Type Selection');

      if (cityHasFormTitle) {
        console.log(MSG.FORM_DETECTED_SOURCE);
      } else {
        console.log(MSG.FORM_CAPTCHA_DETECTED);

        let appointmentCaptchaSuccess = false;
        let appointmentRetries = 0;
        const maxAppointmentRetries = CFG.RETRY.MAX_APPOINTMENT_RETRIES;

        while (!appointmentCaptchaSuccess && appointmentRetries < maxAppointmentRetries) {
          try {
            if (appointmentRetries > 0) {
              console.log(MSG.APPOINTMENT_CAPTCHA_RETRYING(appointmentRetries + 1, maxAppointmentRetries));
              await driver.sleep(750);

              const retryUrl = await driver.getCurrentUrl();
              if (retryUrl.includes('/home/index')) {
                console.log(MSG.HOME_REDIRECT_BOOK_NOW);
                const retryBookNowBtn = await driver.findElement(
                  By.css(`a[href="${CFG.BOOK_NOW_URL}"]`)
                );
                await retryBookNowBtn.click();
                await driver.sleep(750);
              }
            }

            console.log(MSG.APPOINTMENT_CAPTCHA_SOLVING);
            await solveCaptchaInIframe(driver);

            await driver.sleep(750);
            console.log(MSG.AFTER_CAPTCHA_CHECKING);
            await checkAndHandleUnavailable(driver);

            console.log(MSG.FORM_REDIRECT_WAITING);
            await driver.sleep(750);

            try {
              await driver.wait(until.urlContains(CFG.VISA_TYPE_URL), 10000);
              console.log(MSG.APPOINTMENT_CAPTCHA_SUCCESS);
              appointmentCaptchaSuccess = true;
            } catch (e) {
              const pageCheck = await driver.getPageSource();
              if (pageCheck.includes('Book New Appointment - Visa Type Selection')) {
                console.log(MSG.APPOINTMENT_CAPTCHA_ALT_SUCCESS);
                appointmentCaptchaSuccess = true;
              } else {
                throw new Error("Form sayfasına yönlendirilmedi");
              }
            }

          } catch (e) {
            appointmentRetries++;
            console.log(MSG.APPOINTMENT_CAPTCHA_FAILED(e.message));

            if (appointmentRetries >= maxAppointmentRetries) {
              console.log(MSG.APPOINTMENT_MAX_RETRY(maxAppointmentRetries));
              throw new Error("Randevu captcha başarısız - maksimum deneme sayısı aşıldı");
            }

            await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
          }
        }
      }
    }

    await driver.sleep(1000);
    await checkAndHandleUnavailable(driver);
    await checkAndHandleUnavailable(driver);

    console.log(MSG.FORM_READY);
    await driver.sleep(CFG.SLEEP.LONG);

    await driver.wait(
      until.elementLocated(By.css("span.k-dropdown-wrap")),
      CFG.DROPDOWN.TIMEOUT
    );
    console.log(MSG.FORM_FILLING_DROPDOWNS);
    await driver.sleep(CFG.SLEEP.MEDIUM);

    const formSuccess = {
      jurisdiction: false,
      location: false,
      visaType: false,
      visaSubType: false,
      category: false
    };

    formSuccess.jurisdiction = await selectKendoDropdownByLabel(driver, "Jurisdiction", city.JURISDICTION);
    if (!formSuccess.jurisdiction) {
      console.log(MSG.JURISDICTION_FAILED);
      throw new Error(`Form doldurma başarısız: Jurisdiction (${city.name})`);
    }
    await driver.sleep(CFG.SLEEP.SHORT);

    formSuccess.location = await selectKendoDropdownByLabel(driver, "Location", city.LOCATION);
    if (!formSuccess.location) {
      console.log(MSG.LOCATION_FAILED);
      throw new Error(`Form doldurma başarısız: Location (${city.name})`);
    }
    await driver.sleep(CFG.SLEEP.SHORT);

    formSuccess.visaType = await selectKendoDropdownByLabel(driver, "Visa Type", CFG.FORM.VISA_TYPE);
    if (!formSuccess.visaType) {
      console.log(MSG.VISA_TYPE_FAILED);
      throw new Error(`Form doldurma başarısız: Visa Type (${city.name})`);
    }
    await driver.sleep(CFG.SLEEP.SHORT);

    formSuccess.visaSubType = await selectKendoDropdownByLabel(driver, "Visa Sub Type", CFG.FORM.VISA_SUB_TYPE);
    if (!formSuccess.visaSubType) {
      console.log(MSG.VISA_SUB_TYPE_FAILED);
      throw new Error(`Form doldurma başarısız: Visa Sub Type (${city.name})`);
    }
    await driver.sleep(CFG.SLEEP.SHORT);

    console.log(MSG.APPOINTMENT_FOR_INFO);

    formSuccess.category = await selectKendoDropdownByLabel(driver, "Category", CFG.FORM.CATEGORY_NORMAL);
    if (!formSuccess.category) {
      console.log(MSG.CATEGORY_FAILED);
      throw new Error(`Form doldurma başarısız: Category (${city.name})`);
    }
    await driver.sleep(CFG.SLEEP.SHORT);

    console.log(MSG.FORM_ALL_DONE);
    await driver.sleep(CFG.SLEEP.SHORT);
    await checkAndHandleUnavailable(driver);

    console.log(MSG.FORM_SUBMIT_SEARCHING);
    const submitBtn = await driver.findElement(By.id("btnSubmit"));
    await driver.wait(until.elementIsVisible(submitBtn), 5000);
    await driver.wait(until.elementIsEnabled(submitBtn), 5000);

    try {
      await submitBtn.click();
      console.log(MSG.FORM_SUBMITTED);
    } catch (e) {
      console.log(MSG.FORM_SUBMIT_JS_FALLBACK);
      await driver.executeScript("arguments[0].click();", submitBtn);
      console.log(MSG.FORM_SUBMITTED_JS);
    }

    await driver.sleep(CFG.SLEEP.AFTER_SUBMIT);
    await checkAndHandleUnavailable(driver);
    await driver.sleep(CFG.SLEEP.AFTER_LOGIN);

    console.log(MSG.FORM_SUBMIT_CHECKING);

    const cityPageSourceAfterSubmit = await driver.getPageSource();
    const hasCaptcha = cityPageSourceAfterSubmit.includes('Please select all boxes');

    if (hasCaptcha) {
      console.log(MSG.CAPTCHA_FORM_DETECTED);
      console.log(MSG.CAPTCHA_SOLVING);
      try {
        await solveCaptchaInIframe(driver);
        await driver.sleep(CFG.SLEEP.LONG);
        await checkAndHandleUnavailable(driver);
        await driver.sleep(CFG.SLEEP.LONG);
        console.log(MSG.CAPTCHA_SOLVED);
      } catch (e) {
        console.log(MSG.CAPTCHA_FAILED(e.message));
        throw new Error("Captcha çözülemedi");
      }
    }

    const slotOpen = await checkIfSlotsAreOpen(driver, `${city.name} Normal`);

    if (slotOpen) {
      console.log(MSG.NORMAL_SLOT_FOUND);
      await driver.sleep(CFG.SLEEP.LONG);
      await scanAndNotifySlots(driver, `${city.name} Normal`);
    } else {
      console.log(MSG.NORMAL_NO_SLOT);
      try {
        await tryPremiumCategory(driver, city);
      } catch (e) {
        console.log(MSG.PREMIUM_FAILED(e.message));
      }
    }

    console.log(MSG.CITY_SCAN_DONE(city.name));

    // Bir sonraki şehir için ana sayfaya dön
    await driver.get(`https://turkey.blsspainglobal.com${CFG.BLS_HOME_URL}`);
    await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
    await checkAndHandleUnavailable(driver);
  }

  // Slot açık mı kontrol fonksiyonu - SADELEŞTİRİLMİŞ
  // NOT: Bu fonksiyon çağrılmadan ÖNCE captcha kontrolü yapılmalı!
  async function checkIfSlotsAreOpen(driver, categoryName) {
    await driver.sleep(1000);
    await checkAndHandleUnavailable(driver);

    const pageSource = await driver.getPageSource();

    // "Appointment Slot" label'ı var mı kontrol et - BU EN ÖNEMLİ KONTROL!
    const hasAppointmentSlotLabel = pageSource.includes('Appointment Slot');

    if (hasAppointmentSlotLabel) {
      console.log(MSG.SLOT_OPEN(categoryName));

      try {
        const message = `🎉 *${categoryName} Category'de Slotlar Açıldı!*\n\n` +
          `✅ "Appointment Slot" label'ı tespit edildi\n` +
          `📅 Randevu seçimi yapılabilir!\n\n` +
          `🔗 [Hemen Kontrol Et!](${CFG.TELEGRAM.SLOT_OPEN_LINK})\n\n` +
          `⏰ ${new Date().toLocaleString('tr-TR')}`;

        const { sendMessageToTelegram } = require("./telegramNotifier");
        await sendMessageToTelegram(message);
        console.log(MSG.SLOT_TELEGRAM_SENT);
      } catch (e) {
        console.log(MSG.SLOT_TELEGRAM_FAILED(e.message));
      }

      return true;
    }

    console.log(MSG.SLOT_CLOSED(categoryName));
    return false;
  }

  // Slot tarama ve bildirim fonksiyonu (kod tekrarını önlemek için)
  async function scanAndNotifySlots(driver, categoryName = "Normal") {
    // Date picker'ı bul
    console.log(MSG.DATE_PICKER_SEARCHING);
    const allDatePickers = await driver.findElements(By.css('input.k-input[data-role="datepicker"]'));

    let visibleDatePicker = null;
    for (const picker of allDatePickers) {
      try {
        const isDisplayed = await picker.isDisplayed();
        if (isDisplayed) {
          visibleDatePicker = picker;
          const pickerId = await picker.getAttribute('id');
          console.log(MSG.DATE_PICKER_FOUND(pickerId));
          break;
        }
      } catch (e) { continue; }
    }

    if (!visibleDatePicker) {
      console.log(MSG.DATE_PICKER_NOT_FOUND);
      console.log(MSG.SLOT_NO_DATE_PICKER(categoryName));
      try {
        await notifySlotPageReached(`${categoryName}: Date picker bulunamadı ama slot sayfası açık!`);
      } catch (e) {
        console.log(MSG.TELEGRAM_FAILED_SIMPLE);
      }
      throw new Error("Date picker bulunamadı");
    }

    console.log(MSG.CALENDAR_OPENING);

    let calendarOpened = false;
    const openMethods = [
      {
        name: "JS Click",
        fn: async () => {
          await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", visibleDatePicker);
          await driver.sleep(250);
          await driver.executeScript("arguments[0].click();", visibleDatePicker);
        }
      },
      {
        name: "Normal Click",
        fn: async () => {
          await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", visibleDatePicker);
          await driver.sleep(250);
          await visibleDatePicker.click();
        }
      },
      {
        name: "Calendar Icon Click",
        fn: async () => {
          const parent = await visibleDatePicker.findElement(By.xpath('../..'));
          const calendarIcon = await parent.findElement(By.css('.k-icon.k-i-calendar'));
          await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", calendarIcon);
          await driver.sleep(250);
          await driver.executeScript("arguments[0].click();", calendarIcon);
        }
      }
    ];

    for (const method of openMethods) {
      try {
        console.log(MSG.CALENDAR_METHOD_TRYING(method.name));
        await method.fn();
        await driver.sleep(CFG.SLEEP.LONG);

        const calendarCheck = await driver.findElements(By.css('.k-calendar-container[aria-hidden="false"], .k-calendar-container:not([aria-hidden="true"])'));
        if (calendarCheck.length > 0) {
          console.log(MSG.CALENDAR_OPENED(method.name));
          calendarOpened = true;
          break;
        }
      } catch (e) {
        console.log(MSG.CALENDAR_METHOD_FAILED(method.name, e.message));
      }
    }

    if (!calendarOpened) {
      console.log(MSG.CALENDAR_NOT_OPENED);
      console.log(MSG.SLOT_NO_CALENDAR(categoryName));
      try {
        await notifySlotPageReached(`${categoryName}: Takvim açılamadı ama slot sayfası açık!`);
      } catch (e) { console.log(MSG.TELEGRAM_FAILED_SIMPLE); }
      throw new Error("Takvim açılamadı");
    }

    await driver.sleep(CFG.SLEEP.LONG);

    const calendarExists = await driver.findElements(By.css('.k-calendar'));
    if (calendarExists.length === 0) {
      console.log(MSG.CALENDAR_ELEM_NOT_FOUND);
      try {
        await notifySlotPageReached(`${categoryName}: Takvim elementi yok ama slot sayfası açık!`);
      } catch (e) { console.log(MSG.TELEGRAM_FAILED_SIMPLE); }
      throw new Error("Takvim elementi yok");
    }

    console.log(MSG.CALENDAR_ELEM_FOUND(calendarExists.length));
    console.log(MSG.CALENDAR_SEARCHING(categoryName));

    const availableDatesWithSlots = [];
    const maxMonthsToCheck = CFG.CALENDAR.MAX_MONTHS_TO_CHECK;

    for (let monthIndex = 0; monthIndex < maxMonthsToCheck; monthIndex++) {
      try {
        let monthTitle = null;
        try {
          monthTitle = await driver.findElement(By.css('.k-calendar .k-nav-fast'));
        } catch (e) {
          try {
            monthTitle = await driver.findElement(By.css('.k-calendar .k-header a.k-nav-fast'));
          } catch (e2) {
            console.log(MSG.CALENDAR_MONTH_NO_HEADER(monthIndex));
            break;
          }
        }

        const currentMonth = await monthTitle.getText();
        console.log(MSG.CALENDAR_MONTH_CHECKING(currentMonth));
        await driver.sleep(CFG.SLEEP.MEDIUM);

        const allDateLinks = await driver.findElements(By.css('.k-calendar a.k-link[data-value]'));
        console.log(MSG.CALENDAR_DATES_FOUND(allDateLinks.length));
        if (allDateLinks.length === 0) {
          console.log(MSG.CALENDAR_NO_DATES);
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
              console.log(MSG.CALENDAR_GREEN_DATE(dateText, currentMonth, dataValue));
            }
          } catch (e) {
            continue;
          }
        }

        if (foundInThisMonth > 0) {
          console.log(MSG.CALENDAR_MONTH_GREEN(currentMonth, foundInThisMonth));
        } else {
          console.log(MSG.CALENDAR_MONTH_EMPTY(currentMonth));
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
            await driver.sleep(CFG.SLEEP.CALENDAR_NAV);
            console.log(MSG.CALENDAR_NEXT_MONTH(monthIndex + 2, maxMonthsToCheck));
          } catch (e) {
            console.log(MSG.CALENDAR_NEXT_MONTH_ERROR(e.message));
            break;
          }
        }

      } catch (e) {
        console.log(MSG.CALENDAR_MONTH_ERROR(e.message));
        break;
      }
    }

    console.log(MSG.CALENDAR_TOTAL_GREEN(categoryName, availableDatesWithSlots.length));

    if (availableDatesWithSlots.length === 0) {
      console.log(MSG.CALENDAR_NO_DATES_FOUND(categoryName));
      return;
    }

    try {
      await notifyAppointmentFound(availableDatesWithSlots);
      console.log(MSG.TELEGRAM_SENT);
    } catch (e) {
      console.log(MSG.TELEGRAM_FAILED(e.message));
    }

    console.log(MSG.CALENDAR_CLOSING);
    try {
      await driver.executeScript("arguments[0].blur();", visibleDatePicker);
      await driver.sleep(CFG.SLEEP.SHORT);
      await driver.actions().sendKeys(Key.ESCAPE).perform();
      await driver.sleep(CFG.SLEEP.SHORT);
      console.log(MSG.CALENDAR_CLOSED);
    } catch (e) {
      console.log(MSG.CALENDAR_CLOSE_ERROR(e.message));
    }

    console.log(MSG.SCAN_DONE(categoryName));
  }

  (async function example() {
    const chromeOptions = new (require("selenium-webdriver/chrome").Options)();
    chromeOptions.addArguments("--start-maximized");
    let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(chromeOptions).build();
    try {
      await driver.get(CFG.LOGIN_URL);

      console.log(MSG.PAGE_LOADED);
      await driver.sleep(CFG.SLEEP.AFTER_LOGIN);

      let unavailableRetries = 0;
      while (await checkAndHandleUnavailable(driver) && unavailableRetries < CFG.RETRY.MAX_UNAVAILABLE_RETRIES) {
        unavailableRetries++;
        await driver.sleep(CFG.SLEEP.LONG);
      }

      console.log(MSG.EMAIL_WAITING);
      await driver.sleep(CFG.SLEEP.LONG);

      let emailInput = null;
      try {
        const allInputs = await driver.findElements(By.css('input[type="text"]'));
        for (let i = 0; i < allInputs.length; i++) {
          try {
            const input = allInputs[i];
            const isDisplayed = await input.isDisplayed();
            const rect = await input.getRect();
            const id = await input.getAttribute("id");
            const name = await input.getAttribute("name");
            if (isDisplayed && rect.width > 50 && rect.height > 20) {
              console.log(MSG.EMAIL_FOUND(id || name));
              emailInput = input;
              break;
            }
          } catch (e) { }
        }
      } catch (e) { }

      if (!emailInput) throw new Error("Email alanı bulunamadı!");

      try {
        console.log(MSG.EMAIL_ENTERING);
        await driver.executeScript("arguments[0].value = '';", emailInput);
        await emailInput.sendKeys(EMAIL);
        console.log(MSG.EMAIL_SUCCESS);
      } catch (e) {
        console.log(MSG.EMAIL_ERROR(e.message));
        throw new Error("Email girilemedi!");
      }

      console.log(MSG.VERIFY_CLICKING);
      await driver.findElement(By.id("btnVerify")).click();
      console.log(MSG.VERIFY_CLICKED);

      await driver.sleep(CFG.SLEEP.AFTER_LOGIN);

      console.log(MSG.PASSWORD_WAITING);
      await driver.sleep(CFG.SLEEP.LONG);

      let passwordInput = null;
      try {
        const allPasswords = await driver.findElements(By.css('input[type="password"]'));
        for (let i = 0; i < allPasswords.length; i++) {
          try {
            const input = allPasswords[i];
            const isDisplayed = await input.isDisplayed();
            const rect = await input.getRect();
            const id = await input.getAttribute("id");
            const name = await input.getAttribute("name");
            if (isDisplayed && rect.width > 50 && rect.height > 20) {
              console.log(MSG.PASSWORD_FOUND);
              passwordInput = input;
              break;
            }
          } catch (e) { }
        }
      } catch (e) { }

      if (!passwordInput) throw new Error("Password alanı bulunamadı!");

      try {
        console.log(MSG.PASSWORD_ENTERING);
        await driver.executeScript("arguments[0].value = '';", passwordInput);
        await passwordInput.sendKeys(PASSWORD);
        console.log(MSG.PASSWORD_SUCCESS);
      } catch (e) {
        console.log(MSG.PASSWORD_ERROR(e.message));
        throw new Error("Password girilemedi!");
      }

      await driver.sleep(1000);

      // Login captcha'yı çöz - retry mekanizması ile
      let loginSuccess = false;
      let loginRetries = 0;
      const maxLoginRetries = CFG.RETRY.MAX_LOGIN_RETRIES;

      while (!loginSuccess && loginRetries < maxLoginRetries) {
        try {
          if (loginRetries > 0) {
            console.log(MSG.LOGIN_RETRYING(loginRetries + 1, maxLoginRetries));
            await driver.sleep(CFG.SLEEP.LONG);

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
                  console.log(MSG.PASSWORD_FOUND);

                  const inputClass = await passInput.getAttribute('class');
                  if (inputClass && inputClass.includes('entry-disabled')) {
                    console.log(MSG.ENTRY_DISABLED_REMOVING);
                    await driver.executeScript(`
                      arguments[0].classList.remove('entry-disabled');
                      arguments[0].removeAttribute('disabled');
                      arguments[0].removeAttribute('readonly');
                    `, passInput);
                    await driver.sleep(150);
                  }

                  // Password değerini kontrol et ve doldur
                  const currentValue = await passInput.getAttribute('value');
                  if (!currentValue || currentValue.length === 0) {
                    // Önce JS ile temizle, sonra doldur
                    await driver.executeScript("arguments[0].value = '';", passInput);
                    await driver.executeScript("arguments[0].focus();", passInput);
                    await driver.sleep(100);

                    // sendKeys ile gir
                    await passInput.sendKeys(PASSWORD);

                    // Değer girildi mi kontrol et
                    const newValue = await passInput.getAttribute('value');
                    if (newValue && newValue.length > 0) {
                      console.log(MSG.PASSWORD_RETRY_SUCCESS);
                      passwordFilled = true;
                    } else {
                      await driver.executeScript(`arguments[0].value = arguments[1];`, passInput, PASSWORD);
                      await driver.executeScript(`
                        arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                        arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
                      `, passInput);
                      console.log(MSG.PASSWORD_JS_SUCCESS);
                      passwordFilled = true;
                    }
                  } else {
                    console.log(MSG.PASSWORD_ALREADY_FILLED);
                    passwordFilled = true;
                  }
                  break;
                }
              } catch (e) { }
            }

            if (!passwordFound) {
              console.log(MSG.PASSWORD_NOT_FOUND);

              // Email input bul ve doldur
              const retryEmailInputs = await driver.findElements(By.css('input[type="text"]'));
              for (let input of retryEmailInputs) {
                try {
                  const isDisplayed = await input.isDisplayed();
                  const rect = await input.getRect();
                  if (isDisplayed && rect.width > 50) {
                    await driver.executeScript("arguments[0].value = '';", input);
                    await input.sendKeys(EMAIL);
                    console.log(MSG.EMAIL_SUCCESS);
                    await driver.sleep(CFG.SLEEP.MEDIUM);
                    try {
                      await driver.findElement(By.id("btnVerify")).click();
                      console.log(MSG.VERIFY_CLICKED);
                    } catch (e) {
                      console.log(MSG.VERIFY_NOT_FOUND);
                    }
                    await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
                    break;
                  }
                } catch (e) { }
              }

              console.log(MSG.PASSWORD_WAITING);
              await driver.sleep(750);

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
                    console.log(MSG.PASSWORD_FOUND);

                    const inputClass = await passInput.getAttribute('class');
                    if (inputClass && inputClass.includes('entry-disabled')) {
                      console.log(MSG.ENTRY_DISABLED_REMOVED);
                      await driver.executeScript(`
                        arguments[0].classList.remove('entry-disabled');
                        arguments[0].removeAttribute('disabled');
                        arguments[0].removeAttribute('readonly');
                      `, passInput);
                      await driver.sleep(150);
                    }

                    await driver.executeScript("arguments[0].value = '';", passInput);
                    await driver.executeScript("arguments[0].focus();", passInput);
                    await driver.sleep(100);
                    await passInput.sendKeys(PASSWORD);

                    const newValue = await passInput.getAttribute('value');
                    if (newValue && newValue.length > 0) {
                      console.log(MSG.PASSWORD_RETRY_SUCCESS);
                      passwordFilled = true;
                    } else {
                      await driver.executeScript(`arguments[0].value = arguments[1];`, passInput, PASSWORD);
                      await driver.executeScript(`
                        arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                        arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
                      `, passInput);
                      console.log(MSG.PASSWORD_JS_SUCCESS);
                      passwordFilled = true;
                    }
                    break;
                  }
                } catch (e) { }
              }
            }

            if (!passwordFilled) {
              console.log(MSG.PASSWORD_FILL_FAILED);
            }

            await driver.sleep(250);
          }

          console.log(MSG.LOGIN_CAPTCHA_SOLVING);
          await solveCaptchaInIframe(driver, 0, CFG.RETRY.MAX_CAPTCHA_RETRIES, true);

          await driver.sleep(750);
          console.log(MSG.AFTER_LOGIN_CHECKING);
          await checkAndHandleUnavailable(driver);

          await driver.wait(until.urlContains(CFG.BLS_HOME_URL), 8000);
          console.log(MSG.LOGIN_SUCCESS);
          loginSuccess = true;

        } catch (e) {
          loginRetries++;
          console.log(MSG.LOGIN_FAILED(e.message));

          if (loginRetries >= maxLoginRetries) {
            console.log(MSG.LOGIN_MAX_RETRY(maxLoginRetries));
            throw new Error("Login başarısız - maksimum deneme sayısı aşıldı");
          }

          await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
        }
      }

      await driver.sleep(750);

      // "Application Temporarily Unavailable" kontrolü
      await checkAndHandleUnavailable(driver);

      // Akıllı sıralama: son taranan şehrin bir sonrakinden başla
      const orderedCities = getOrderedCities(CFG.CITIES);
      const lastSavedCity = loadLastCity(); // getOrderedCities ile aynı okuma, tutarlı sonuç
      console.log(MSG.CITY_ORDER_INFO(orderedCities.map(c => c.name)));

      // Tüm şehirleri sırayla tara
      for (let i = 0; i < orderedCities.length; i++) {
        const city = orderedCities[i];
        // İlk şehir lastCity ile aynıysa lokasyon BLS'de ZATEN set edilmiş — setApplicantLocation atla
        const skipLocationSet = (i === 0) && (lastSavedCity === city.name);
        if (skipLocationSet) {
          console.log(`⚡ ${city.name} lokasyonu zaten set — ManageApplicant adımı atlanıyor.`);
        }
        try {
          await scanCity(driver, city, skipLocationSet);
        } catch (e) {
          console.log(MSG.CITY_SCAN_ERROR(city.name, e.message));
          // Bir şehirde hata olsa da sonrakine geç; ana sayfaya dön
          try {
            await driver.get(`https://turkey.blsspainglobal.com${CFG.BLS_HOME_URL}`);
            await driver.sleep(CFG.SLEEP.AFTER_LOGIN);
            await checkAndHandleUnavailable(driver);
          } catch (_) { }
        }

        // Şehirler arası 10 saniyelik bekleme (son şehirden sonra gerekmez)
        if (i < orderedCities.length - 1) {
          console.log(`⏳ Sonraki şehre geçmeden önce 10 saniye bekleniyor...`);
          await driver.sleep(10000);
        }
      }

      console.log(MSG.ALL_CITIES_DONE);

    } catch (e) {
      console.error(MSG.GLOBAL_ERROR(e.message));
    } finally {
      await driver.quit();
    }
  })();
}

// app.js artık sadece main() fonksiyonunu çalıştırıyor
// Döngü için main.js kullanılmalı!
main();