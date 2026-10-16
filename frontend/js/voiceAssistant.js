/**
 * Voice-to-Text Reporting Assistant
 * Object Recovery and Ownership Verification Platform
 * Supports English and Hindi Speech-to-Text with Natural Entity Extraction
 */

class VoiceReportingAssistant {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.initSpeechEngine();
    }

    initSpeechEngine() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API is not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = localStorage.getItem("app_lang") === "hi" ? "hi-IN" : "en-IN";

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUiState(true);
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Voice Transcript:", transcript);
            this.parseAndPopulateForm(transcript);
        };

        this.recognition.onerror = (event) => {
            console.warn("Speech recognition error:", event.error);
            this.isListening = false;
            this.updateUiState(false);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUiState(false);
        };
    }

    toggle() {
        if (!this.recognition) {
            alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.lang = localStorage.getItem("app_lang") === "hi" ? "hi-IN" : "en-US";
            this.recognition.start();
        }
    }

    updateUiState(listening) {
        const micBtns = document.querySelectorAll(".btn-voice-fill");
        micBtns.forEach(btn => {
            if (listening) {
                btn.classList.add("recording");
                btn.innerHTML = `🔴 <span>Listening... Speak Now</span>`;
            } else {
                btn.classList.remove("recording");
                btn.innerHTML = `🎙️ <span>Voice Auto-Fill</span>`;
            }
        });
    }

    parseAndPopulateForm(text) {
        const lower = text.toLowerCase();

        // 1. Detect Category
        const categoryMap = {
            "Electronics": ["phone", "mobile", "laptop", "macbook", "ipad", "tablet", "charger", "earphones", "airpods", "headphones", "camera", "मोबाइल", "फोन", "लैपटॉप"],
            "Wallet": ["wallet", "purse", "cardholder", "money", "पर्स", "बटुआ", "वॉलेट"],
            "Bag": ["bag", "backpack", "handbag", "suitcase", "बैग", "थैला"],
            "Keys": ["key", "keys", "keychain", "chabhi", "चाबी", "कुंजी"],
            "Documents": ["aadhar", "passport", "license", "pan card", "id card", "certificate", "दस्तावेज़", "पासपोर्ट", "लाइसेंस"],
            "Accessories": ["watch", "ring", "necklace", "bracelet", "glasses", "sunglasses", "घड़ी", "अंगूठी", "चश्मा"]
        };

        let detectedCategory = null;
        for (const [category, keywords] of Object.entries(categoryMap)) {
            if (keywords.some(k => lower.includes(k))) {
                detectedCategory = category;
                break;
            }
        }

        // 2. Detect Colors
        const colors = ["black", "white", "blue", "red", "green", "silver", "gold", "gray", "brown", "yellow", "kala", "safed", "neela", "lal", "peela", "काला", "सफेद", "नीला", "लाल"];
        let detectedColor = "";
        for (const c of colors) {
            if (lower.includes(c)) {
                detectedColor = c.charAt(0).toUpperCase() + c.slice(1);
                break;
            }
        }

        // 3. Detect Brand
        const brands = ["apple", "samsung", "titan", "wildcraft", "dell", "hp", "lenovo", "sony", "boat", "noise", "fastrack", "nike", "puma"];
        let detectedBrand = "";
        for (const b of brands) {
            if (lower.includes(b)) {
                detectedBrand = b.charAt(0).toUpperCase() + b.slice(1);
                break;
            }
        }

        // 4. Fill form fields
        const nameInput = document.getElementById("itemName") || document.querySelector("input[name='itemName']");
        const catSelect = document.getElementById("category") || document.querySelector("select[name='category']");
        const colorInput = document.getElementById("color") || document.querySelector("input[name='color']");
        const brandInput = document.getElementById("brand") || document.querySelector("input[name='brand']");
        const descInput = document.getElementById("description") || document.querySelector("textarea[name='description']");

        if (nameInput && !nameInput.value) {
            nameInput.value = (detectedBrand ? detectedBrand + " " : "") + (detectedColor ? detectedColor + " " : "") + (detectedCategory || "Reported Item");
        }
        if (catSelect && detectedCategory) {
            catSelect.value = detectedCategory;
        }
        if (colorInput && detectedColor) {
            colorInput.value = detectedColor;
        }
        if (brandInput && detectedBrand) {
            brandInput.value = detectedBrand;
        }
        if (descInput) {
            descInput.value = text;
        }

        alert(`🎙️ Voice Captured: "${text}"\n✨ Auto-filled detected details!`);
    }
}

// Geolocation GPS Helper
function fetchCurrentGPSLocation(callback) {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            const latInput = document.getElementById("latitude") || document.querySelector("input[name='latitude']");
            const lngInput = document.getElementById("longitude") || document.querySelector("input[name='longitude']");
            const locInput = document.getElementById("location") || document.querySelector("input[name='location']");

            if (latInput) latInput.value = latitude.toFixed(6);
            if (lngInput) lngInput.value = longitude.toFixed(6);
            if (locInput && !locInput.value) locInput.value = `GPS: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

            alert(`📍 GPS Coordinates Acquired:\nLat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
            if (callback) callback({ latitude, longitude });
        },
        (err) => {
            alert(`Unable to retrieve GPS location: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

const voiceAssistant = new VoiceReportingAssistant();
window.voiceAssistant = voiceAssistant;
window.fetchCurrentGPSLocation = fetchCurrentGPSLocation;
