/**
 * Multilingual Translation Engine (English & Hindi)
 * Object Recovery and Ownership Verification Platform
 */

const translations = {
    en: {
        appName: "Lost & Found Verification",
        navHome: "Home",
        navSearch: "Search Items",
        navReportLost: "Report Lost",
        navReportFound: "Report Found",
        navRewards: "Rewards Store",
        navChat: "Chat Hub",
        navAdmin: "Admin Portal",
        navLogin: "Login",
        navRegister: "Sign Up",
        navLogout: "Logout",
        heroTitle: "Find What's Lost. Verify What's Yours.",
        heroSubtitle: "Decentralized, AI-powered recovery network with encrypted privacy and safe custody verification.",
        searchPlaceholder: "Search keywords, items, brand, or location...",
        btnSearch: "Search Items",
        btnVoiceFill: "🎙️ Voice Auto-Fill",
        btnUseGPS: "📍 Use Current GPS Location",
        btnSubmit: "Submit Report",
        btnReset: "Reset",
        lblItemName: "Item Name",
        lblCategory: "Category",
        lblBrand: "Brand / Manufacturer",
        lblColor: "Color",
        lblDate: "Date Lost / Found",
        lblLocation: "Location / Landmark",
        lblDescription: "Detailed Description",
        lblUploadImages: "Upload Photos (Up to 5)",
        lblSecretQuestion: "Ownership Verification Secret Question",
        lblSecretAnswer: "Secret Answer (Hidden & Hashed)",
        lblContactName: "Your Full Name",
        lblPhone: "Phone Number (Masked by default)",
        lblEmail: "Email Address",
        statusLost: "LOST",
        statusFound: "FOUND",
        statusClaimed: "CLAIMED",
        statusReturned: "RETURNED",
        radiusFilter: "Proximity Radius",
        safeZonesTitle: "Verified Safe Drop-Off Zones",
        safeZoneBadge: "Verified Safe Hub",
        voiceListening: "🎙️ Listening... Please speak clearly in English or Hindi (e.g. 'Mera black Titan watch cafeteria me kho gaya')",
        voiceProcessing: "⚡ Processing speech entities...",
        voiceSuccess: "✅ Voice auto-filled details successfully!",
        pointsEarnedToast: "🎉 You earned +50 Karma Points for reporting this item!",
        footerText: "© 2026 Object Recovery Platform. Built for safe & verified community handovers."
    },
    hi: {
        appName: "खोया-पाया सत्यापन मंच",
        navHome: "होम",
        navSearch: "सामान खोजें",
        navReportLost: "खोया सामान दर्ज करें",
        navReportFound: "मिला सामान दर्ज करें",
        navRewards: "रिवॉर्ड्स स्टोर",
        navChat: "चैट हब",
        navAdmin: "एडमिन पोर्टल",
        navLogin: "लॉग इन",
        navRegister: "साइन अप",
        navLogout: "लॉग आउट",
        heroTitle: "खोई हुई चीजें पाएं। स्वामित्व सत्यापित करें।",
        heroSubtitle: "सुरक्षित, AI-संचालित रिकवरी नेटवर्क - गोपनीयता और सुरक्षित हैंडओवर के साथ।",
        searchPlaceholder: "कीवर्ड, वस्तु, ब्रांड या स्थान खोजें...",
        btnSearch: "खोजें",
        btnVoiceFill: "🎙️ बोलकर फॉर्म भरें",
        btnUseGPS: "📍 वर्तमान GPS स्थान चुनें",
        btnSubmit: "रिपोर्ट सबमिट करें",
        btnReset: "रीसेट करें",
        lblItemName: "वस्तु का नाम",
        lblCategory: "श्रेणी (Category)",
        lblBrand: "ब्रांड / निर्माता",
        lblColor: "रंग",
        lblDate: "खोए/मिले होने की तारीख",
        lblLocation: "स्थान / लैंडमार्क",
        lblDescription: "विस्तृत विवरण",
        lblUploadImages: "तस्वीरें अपलोड करें (अधिकतम 5)",
        lblSecretQuestion: "स्वामित्व सत्यापन हेतु गुप्त प्रश्न",
        lblSecretAnswer: "गुप्त उत्तर (सुरक्षित एवं गोपनीय)",
        lblContactName: "आपका पूरा नाम",
        lblPhone: "फोन नंबर (सुरक्षित रूप से मास्क रहेगा)",
        lblEmail: "ईमेल आईडी",
        statusLost: "खोया हुआ",
        statusFound: "मिला हुआ",
        statusClaimed: "दावा किया गया",
        statusReturned: "वापस लौटाया गया",
        radiusFilter: "दूरी का दायरा (Radius)",
        safeZonesTitle: "सत्यापित सुरक्षित ड्रॉप-ऑफ हब",
        safeZoneBadge: "सुरक्षित केंद्र",
        voiceListening: "🎙️ सुन रहा हूँ... कृपया साफ़ बोलें (जैसे: 'मेरा काला टाइटन घड़ी कैफेटेरिया में छूट गया')",
        voiceProcessing: "⚡ आवाज से जानकारी पहचानी जा रही है...",
        voiceSuccess: "✅ आवाज से फॉर्म सफलतापूर्वक भर दिया गया!",
        pointsEarnedToast: "🎉 बधाई! आपको इस रिपोर्ट के लिए +50 कर्मा पॉइंट्स मिले!",
        footerText: "© 2026 खोया-पाया सत्यापन मंच। सुरक्षित सामुदायिक रिकवरी के लिए निर्मित।"
    }
};

class I18nManager {
    constructor() {
        this.currentLang = localStorage.getItem("app_lang") || "en";
    }

    init() {
        this.applyLanguage(this.currentLang);
        this.injectLanguageSwitcher();
    }

    t(key) {
        const dict = translations[this.currentLang] || translations.en;
        return dict[key] || translations.en[key] || key;
    }

    setLanguage(lang) {
        if (!translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem("app_lang", lang);
        this.applyLanguage(lang);
        this.updateSwitcherUI();
    }

    toggleLanguage() {
        const nextLang = this.currentLang === "en" ? "hi" : "en";
        this.setLanguage(nextLang);
    }

    applyLanguage(lang) {
        const dict = translations[lang] || translations.en;
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key]) {
                if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                    el.placeholder = dict[key];
                } else {
                    el.innerText = dict[key];
                }
            }
        });
        document.documentElement.lang = lang;
    }

    injectLanguageSwitcher() {
        if (document.getElementById("i18n-toggle-btn")) return;
        
        const btn = document.createElement("button");
        btn.id = "i18n-toggle-btn";
        btn.className = "i18n-toggle-btn";
        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            background: linear-gradient(135deg, #06b6d4, #3b82f6);
            color: #ffffff;
            border: none;
            padding: 10px 18px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;
        btn.innerHTML = `🌐 <span>${this.currentLang === "en" ? "हिन्दी (HI)" : "English (EN)"}</span>`;
        btn.addEventListener("click", () => this.toggleLanguage());
        document.body.appendChild(btn);
    }

    updateSwitcherUI() {
        const btn = document.getElementById("i18n-toggle-btn");
        if (btn) {
            btn.innerHTML = `🌐 <span>${this.currentLang === "en" ? "हिन्दी (HI)" : "English (EN)"}</span>`;
        }
    }
}

const i18n = new I18nManager();
document.addEventListener("DOMContentLoaded", () => {
    i18n.init();
});

if (typeof module !== "undefined" && module.exports) {
    module.exports = { translations, I18nManager };
}
