// ============================================================
//  AI AUTO-CATEGORIZATION  —  Voice & Image Search
//  Lost & Found Portal  |  Client-side NLP + MobileNet
// ============================================================

window.AICategorize = (function () {

    // ── Category keyword map for NLP ────────────────────────────────────────
    const CATEGORY_KEYWORD_MAP = {
        "Mobile": [
            "phone", "mobile", "smartphone", "iphone", "samsung", "android",
            "redmi", "oneplus", "realme", "oppo", "vivo", "mi", "pixel",
            "cell", "handset", "nokia", "motorola", "xiaomi"
        ],
        "Wallet": [
            "wallet", "purse", "billfold", "money", "cash", "card", "debit",
            "credit", "leather wallet", "handbag", "clutch"
        ],
        "Bag": [
            "bag", "backpack", "rucksack", "sack", "duffel", "tote",
            "shoulder bag", "luggage", "suitcase", "handbag", "knapsack",
            "briefcase", "kit bag", "wildcraft", "skybags"
        ],
        "Laptop": [
            "laptop", "computer", "notebook", "macbook", "dell", "hp",
            "lenovo", "asus", "acer", "surface", "chromebook", "tablet",
            "ipad", "pc", "ultrabook"
        ],
        "ID Card": [
            "id", "id card", "aadhar", "passport", "driving license",
            "pan card", "voter id", "identity", "license", "documents",
            "student id", "college card"
        ],
        "Keys": [
            "key", "keys", "keychain", "car key", "bike key", "house key",
            "room key", "vehicle key", "remote key"
        ],
        "Documents": [
            "document", "documents", "file", "files", "paper", "papers",
            "certificate", "marksheet", "admit card", "result", "report"
        ],
        "Jewellery": [
            "jewellery", "jewelry", "ring", "necklace", "bracelet",
            "earring", "bangle", "chain", "watch", "titan", "pendant",
            "gold", "silver", "diamond", "wristwatch"
        ],
        "Books": [
            "book", "books", "notebook", "diary", "textbook", "novel",
            "copy", "notes", "register"
        ],
        "Accessories": [
            "glasses", "specs", "spectacles", "sunglasses", "belt",
            "cap", "hat", "umbrella", "scarf", "gloves", "earphones",
            "headphones", "airpods", "charger", "cable", "pouch",
            "case", "cover", "powerbank"
        ]
    };

    // ── Color keywords ───────────────────────────────────────────────────────
    const COLOR_KEYWORDS = [
        "red", "blue", "green", "black", "white", "yellow", "orange",
        "purple", "pink", "grey", "gray", "silver", "gold", "brown",
        "maroon", "navy", "cyan", "beige", "cream", "dark", "light"
    ];

    // ── Common stop words to ignore ─────────────────────────────────────────
    const STOP_WORDS = new Set([
        "i", "my", "a", "an", "the", "is", "was", "are", "lost",
        "found", "near", "at", "in", "on", "from", "left", "have",
        "had", "it", "please", "help", "someone", "place", "location",
        "around", "somewhere", "please", "looking", "find"
    ]);

    // ── MobileNet label → category mapping ──────────────────────────────────
    const MOBILENET_TO_CATEGORY = {
        // Electronics / Mobile
        "cellular telephone": "Mobile",
        "mobile phone": "Mobile",
        "smartphone": "Mobile",
        "telephone": "Mobile",
        "remote control": "Mobile",
        "iPod": "Mobile",

        // Laptop / Tablet
        "laptop": "Laptop",
        "notebook": "Laptop",
        "desktop computer": "Laptop",
        "computer keyboard": "Laptop",
        "monitor": "Laptop",
        "screen": "Laptop",
        "tablet": "Laptop",

        // Bag
        "backpack": "Bag",
        "school bag": "Bag",
        "handbag": "Bag",
        "purse": "Bag",
        "wallet": "Wallet",
        "bag": "Bag",

        // Keys
        "can opener": "Keys",
        "key": "Keys",

        // Watch / Jewellery
        "digital watch": "Jewellery",
        "analog watch": "Jewellery",
        "watch": "Jewellery",
        "necklace": "Jewellery",
        "bracelet": "Jewellery",
        "ring": "Jewellery",

        // Books
        "book jacket": "Books",
        "book": "Books",
        "magazine": "Books",

        // Accessories
        "sunglasses": "Accessories",
        "sunglass": "Accessories",
        "glasses": "Accessories",
        "umbrella": "Accessories",
        "headphone": "Accessories",
        "earphone": "Accessories",
    };

    // ────────────────────────────────────────────────────────────────────────
    //  VOICE NLP ANALYZER
    // ────────────────────────────────────────────────────────────────────────
    function analyzeVoiceTranscript(transcript) {
        const lower = transcript.toLowerCase();
        const tokens = lower.split(/[\s,.'"-]+/).filter(t => t.length > 1);

        const result = {
            detectedCategory: null,
            detectedColor: null,
            detectedBrand: null,
            detectedKeywords: [],
            confidence: 0,
            analysis: []
        };

        // ── Detect Category ──────────────────────────────────────────────────
        let bestCategory = null;
        let bestCategoryScore = 0;

        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
            let score = 0;
            const matchedKws = [];
            for (const kw of keywords) {
                if (lower.includes(kw)) {
                    score += kw.split(" ").length; // multi-word phrases score higher
                    matchedKws.push(kw);
                }
            }
            if (score > bestCategoryScore) {
                bestCategoryScore = score;
                bestCategory = category;
                result.analysis.push({ category, score, matched: matchedKws });
            }
        }
        if (bestCategory) {
            result.detectedCategory = bestCategory;
            result.confidence = Math.min(95, 40 + bestCategoryScore * 15);
        }

        // ── Detect Color ─────────────────────────────────────────────────────
        for (const color of COLOR_KEYWORDS) {
            if (lower.includes(color)) {
                result.detectedColor = color.charAt(0).toUpperCase() + color.slice(1);
                break;
            }
        }

        // ── Detect Brand (any capitalized non-stop word near a category kw) ──
        const rawTokens = transcript.split(/[\s,.'"-]+/);
        const brandCandidates = rawTokens.filter(t =>
            t.length > 2 &&
            /^[A-Z]/.test(t) &&
            !STOP_WORDS.has(t.toLowerCase()) &&
            !COLOR_KEYWORDS.includes(t.toLowerCase())
        );
        if (brandCandidates.length > 0) {
            result.detectedBrand = brandCandidates[0];
        }

        // ── Significant keywords (for keyword field) ─────────────────────────
        result.detectedKeywords = tokens.filter(t =>
            t.length > 3 && !STOP_WORDS.has(t)
        ).slice(0, 5);

        return result;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  IMAGE AI CATEGORIZATION  (client-side via MobileNet CDN)
    // ────────────────────────────────────────────────────────────────────────
    let tfModel = null;

    async function loadTFModel() {
        if (tfModel) return tfModel;

        // Only try to load if tensorflow is available on the page
        if (typeof tf === 'undefined' || typeof mobilenet === 'undefined') {
            return null;
        }

        try {
            console.log("Loading MobileNet for client-side image classification...");
            tfModel = await mobilenet.load({ version: 2, alpha: 0.5 });
            console.log("MobileNet ready.");
            return tfModel;
        } catch (e) {
            console.warn("MobileNet load failed:", e);
            return null;
        }
    }

    async function classifyImage(imgElement) {
        const model = await loadTFModel();

        if (!model) {
            // Fallback: return generic result
            return [{
                label: "Item",
                category: null,
                probability: 0.5,
                fallback: true
            }];
        }

        try {
            const predictions = await model.classify(imgElement, 5);
            return predictions.map(p => {
                const lowerLabel = p.className.toLowerCase();
                let matchedCategory = null;

                for (const [mobileLabel, category] of Object.entries(MOBILENET_TO_CATEGORY)) {
                    if (lowerLabel.includes(mobileLabel.toLowerCase())) {
                        matchedCategory = category;
                        break;
                    }
                }

                return {
                    label: p.className,
                    probability: p.probability,
                    category: matchedCategory
                };
            });
        } catch (e) {
            console.error("Image classification error:", e);
            return [];
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    //  UI  —  Render AI Category Panel
    // ────────────────────────────────────────────────────────────────────────
    function showAIPanel(containerId, data) {
        let panel = document.getElementById("aiCategoryPanel");

        if (!panel) {
            panel = document.createElement("div");
            panel.id = "aiCategoryPanel";
            panel.className = "ai-panel";
            const container = document.getElementById(containerId);
            if (!container) return;
            container.parentNode.insertBefore(panel, container.nextSibling);
        }

        // Build badges
        let badgesHTML = "";

        if (data.detectedCategory) {
            badgesHTML += `
                <div class="ai-badge ai-badge-category">
                    <span class="ai-badge-icon">🏷️</span>
                    <div>
                        <div class="ai-badge-label">AI Category</div>
                        <div class="ai-badge-value">${data.detectedCategory}</div>
                    </div>
                    <button class="ai-apply-btn" onclick="window.AICategorize.applyCategory('${data.detectedCategory}')" title="Apply this category">
                        Apply ✓
                    </button>
                </div>`;
        }

        if (data.detectedColor) {
            badgesHTML += `
                <div class="ai-badge ai-badge-color">
                    <span class="ai-badge-icon">🎨</span>
                    <div>
                        <div class="ai-badge-label">Detected Color</div>
                        <div class="ai-badge-value">${data.detectedColor}</div>
                    </div>
                    <button class="ai-apply-btn" onclick="window.AICategorize.applyColor('${data.detectedColor}')" title="Apply this color">
                        Apply ✓
                    </button>
                </div>`;
        }

        if (data.detectedBrand) {
            badgesHTML += `
                <div class="ai-badge ai-badge-brand">
                    <span class="ai-badge-icon">🏷</span>
                    <div>
                        <div class="ai-badge-label">Possible Brand</div>
                        <div class="ai-badge-value">${data.detectedBrand}</div>
                    </div>
                    <button class="ai-apply-btn" onclick="window.AICategorize.applyBrand('${data.detectedBrand}')" title="Apply this brand">
                        Apply ✓
                    </button>
                </div>`;
        }

        // Confidence bar
        const conf = data.confidence || 0;
        const confColor = conf >= 70 ? "#10b981" : conf >= 40 ? "#f59e0b" : "#ef4444";

        panel.innerHTML = `
            <div class="ai-panel-header">
                <span class="ai-panel-icon">🤖</span>
                <span class="ai-panel-title">AI Auto-Categorization</span>
                <span class="ai-panel-source">${data.source === 'voice' ? '🎙️ Voice Detected' : '📷 Image Analyzed'}</span>
                <button class="ai-panel-close" onclick="window.AICategorize.dismissPanel()" title="Dismiss">✕</button>
            </div>

            <div class="ai-confidence-bar-wrap">
                <span class="ai-confidence-label">Confidence</span>
                <div class="ai-confidence-bar">
                    <div class="ai-confidence-fill" style="width: ${conf}%; background: ${confColor};"></div>
                </div>
                <span class="ai-confidence-pct" style="color:${confColor}">${conf}%</span>
            </div>

            <div class="ai-badges-row">
                ${badgesHTML || '<span class="ai-no-result">No specific category detected — try describing the item more clearly.</span>'}
            </div>

            ${data.detectedCategory ? `
            <div class="ai-apply-all-row">
                <button class="btn btn-sm btn-ai-apply-all" onclick="window.AICategorize.applyAll(${JSON.stringify(JSON.stringify(data))})">
                    <i class="bi bi-magic me-1"></i> Apply All AI Suggestions & Search
                </button>
            </div>` : ''}
        `;

        // Animate in
        panel.classList.remove("ai-panel-hidden");
        panel.classList.add("ai-panel-visible");
    }

    // Show image classification results
    function showImageAIPanel(predictions) {
        const topCategory = predictions.find(p => p.category)?.category || null;
        const topLabel = predictions[0]?.label || "Unknown object";
        const confidence = predictions[0]?.probability
            ? Math.round(predictions[0].probability * 100)
            : 50;

        showAIPanel("image-search", {
            detectedCategory: topCategory,
            detectedColor: null,
            detectedBrand: null,
            confidence: confidence,
            source: "image",
            topLabel: topLabel,
            predictions: predictions
        });

        // Also render prediction chips
        const panel = document.getElementById("aiCategoryPanel");
        if (panel && predictions.length > 0) {
            const chipsHTML = predictions.slice(0, 4).map(p => `
                <span class="ai-prediction-chip ${p.category ? 'ai-chip-matched' : ''}">
                    ${p.label.split(",")[0]}
                    <small>${Math.round(p.probability * 100)}%</small>
                    ${p.category ? `<span class="ai-chip-category-tag">${p.category}</span>` : ""}
                </span>
            `).join("");

            const chipsRow = document.createElement("div");
            chipsRow.className = "ai-predictions-row";
            chipsRow.innerHTML = `<div class="ai-pred-label">Top MobileNet Predictions:</div><div class="ai-chips-wrap">${chipsHTML}</div>`;
            panel.appendChild(chipsRow);
        }
    }

    // ── Apply Helpers ────────────────────────────────────────────────────────
    function applyCategory(category) {
        const sel = document.getElementById("category");
        if (sel) {
            sel.value = category;
            flashElement(sel);
        }
    }

    function applyColor(color) {
        const inp = document.getElementById("colorInput");
        if (inp) {
            inp.value = color;
            flashElement(inp);
        }
    }

    function applyBrand(brand) {
        const inp = document.getElementById("brandInput");
        if (inp) {
            inp.value = brand;
            flashElement(inp);
        }
    }

    function applyAll(dataJSON) {
        try {
            const data = JSON.parse(dataJSON);
            if (data.detectedCategory) applyCategory(data.detectedCategory);
            if (data.detectedColor) applyColor(data.detectedColor);
            if (data.detectedBrand) applyBrand(data.detectedBrand);

            // Switch to text mode and trigger search
            const textMode = document.getElementById("textMode");
            if (textMode) {
                textMode.checked = true;
                textMode.dispatchEvent(new Event("change"));
            }

            const form = document.getElementById("searchForm");
            if (form) {
                setTimeout(() => form.dispatchEvent(new Event("submit")), 200);
            }
        } catch (e) {
            console.error("applyAll error:", e);
        }
    }

    function dismissPanel() {
        const panel = document.getElementById("aiCategoryPanel");
        if (panel) {
            panel.classList.remove("ai-panel-visible");
            panel.classList.add("ai-panel-hidden");
        }
    }

    function flashElement(el) {
        el.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
        el.style.boxShadow = "0 0 12px rgba(0,243,255,0.8)";
        el.style.borderColor = "#00f3ff";
        setTimeout(() => {
            el.style.boxShadow = "";
            el.style.borderColor = "";
        }, 1500);
    }

    // ── Public API ───────────────────────────────────────────────────────────
    return {
        analyzeVoiceTranscript,
        classifyImage,
        showAIPanel,
        showImageAIPanel,
        applyCategory,
        applyColor,
        applyBrand,
        applyAll,
        dismissPanel,
        loadTFModel
    };

})();
