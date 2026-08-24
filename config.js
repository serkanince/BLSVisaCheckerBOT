/**
 * BLS Visa Checker - Merkezi Konfigürasyon
 * Tüm statik değerler buradan yönetilir.
 */

module.exports = {
    // === URL ===
    LOGIN_URL: 'https://turkey.blsspainglobal.com/Global/Account/LogIn',
    BOOK_NOW_URL: '/Global/appointment/newappointment',
    BLS_HOME_URL: '/Global/home/index',
    VISA_TYPE_URL: '/Global/bls/visatype',
    MY_APPOINTMENTS_URL: 'https://turkey.blsspainglobal.com/Global/appointmentdata/MyAppointments',

    // === FORM DEĞERLERİ ===
    FORM: {
        VISA_TYPE: 'Schengen Visa/ Short Term Visa',
        VISA_SUB_TYPE: 'Tourist Visa',
        CATEGORY_NORMAL: 'Normal',
        CATEGORY_PREMIUM: 'Premium',
        CHECK_PREMIUM: false, // Sadece normal aranacaksa false yapın
    },

    // === ŞEHİRLER (her oturumda sırayla taranır) ===
    CITIES: [
        { name: 'Ankara', JURISDICTION: 'Ankara', LOCATION: 'Ankara' },
        { name: 'Istanbul', JURISDICTION: 'Istanbul', LOCATION: 'Istanbul' },
    ],

    // === RETRY & TIMEOUT ===
    RETRY: {
        MAX_LOGIN_RETRIES: 3,
        MAX_CAPTCHA_RETRIES: 3,
        MAX_APPOINTMENT_RETRIES: 3,
        MAX_UNAVAILABLE_RETRIES: 5,
    },

    // === SLEEP (ms) ===
    SLEEP: {
        SHORT: 700,
        MEDIUM: 1250,
        LONG: 2100,
        AFTER_LOGIN: 3100,
        AFTER_SUBMIT: 5200,
        RATE_LIMIT: 60000,
        CALENDAR_NAV: 1600,
    },

    // === TAKVİM ===
    CALENDAR: {
        MAX_MONTHS_TO_CHECK: 12,
    },

    // === DROPDOWN ===
    DROPDOWN: {
        TIMEOUT: 10000, // ms
    },

    // === CAPTCHA ===
    CAPTCHA: {
        EARLY_EXIT_VOTES: 3,
        OCR_SUCCESS_RATE_THRESHOLD: 20,
        OCR_MIN_ATTEMPTS_FOR_CUT: 50,
    },

    // === TELEGRAM BİLDİRİM METNİ (slot bulunduğunda) ===
    TELEGRAM: {
        SLOT_OPEN_LINK: 'https://turkey.blsspainglobal.com/Global/Account/LogIn',
    },
};
