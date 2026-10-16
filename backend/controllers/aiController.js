const path = require("path");

exports.generateDescription = async (req, res) => {
    try {
        const { itemName, category, brand, color, itemCondition } = req.body;
        
        // This is a placeholder/mock for an actual LLM integration (like Gemini).
        // Since no API key was provided, we generate a smart templated description 
        // to simulate AI text generation.
        
        let desc = `I found this ${itemCondition && itemCondition !== 'Unknown' ? itemCondition.toLowerCase() + " condition " : ""}${color ? color + " " : ""}${itemName || "item"}`;
        
        if (brand) {
            desc += ` made by ${brand}. `;
        } else {
            desc += `. `;
        }
        
        if (category) {
            desc += `It looks like it belongs to the ${category} category. `;
        }
        
        desc += `Please contact me if this belongs to you so we can arrange a safe return.`;

        // Simulate AI generation delay
        setTimeout(() => {
            res.json({
                success: true,
                description: desc
            });
        }, 1500);

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const { classifyImage } = require("../services/aiService");

// ================= AI LENS IMAGE SCANNER =================

exports.analyzeImageLens = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image file provided for Lens analysis." });
        }

        const imagePath = req.file.path;
        
        // 1. Run MobileNet Image Classification & Color Detection on actual image pixels
        const { predictions, dominantColor } = await classifyImage(imagePath);
        
        let detected = {
            itemName: "",
            category: "Other",
            brand: "",
            color: dominantColor || "Black",
            itemCondition: "Good Condition",
            description: ""
        };

        if (predictions && predictions.length > 0) {
            const topPrediction = predictions[0].className.toLowerCase();
            console.log("AI Lens MobileNet Classifications:", predictions);

            // Smart mapping from MobileNet predictions to portal category/itemName
            if (topPrediction.includes("phone") || topPrediction.includes("cellular") || topPrediction.includes("mobile")) {
                detected.itemName = "Mobile Phone";
                detected.category = "Mobile";
                detected.description = "Smart mobile device detected via AI Lens visual scan.";
            } else if (topPrediction.includes("laptop") || topPrediction.includes("computer") || topPrediction.includes("notebook")) {
                detected.itemName = "Laptop Computer";
                detected.category = "Laptop";
                detected.description = "Laptop computer detected via AI Lens visual scan.";
            } else if (topPrediction.includes("wallet") || topPrediction.includes("billfold") || topPrediction.includes("purse")) {
                detected.itemName = "Wallet / Purse";
                detected.category = "Wallet";
                detected.description = "Personal wallet / purse detected via AI Lens visual scan.";
            } else if (topPrediction.includes("backpack") || topPrediction.includes("pack") || topPrediction.includes("bag")) {
                detected.itemName = "Backpack / Bag";
                detected.category = "Bag";
                detected.description = "Carrying bag / backpack detected via AI Lens visual scan.";
            } else if (topPrediction.includes("watch") || topPrediction.includes("stopwatch") || topPrediction.includes("timepiece")) {
                detected.itemName = "Wrist Watch";
                detected.category = "Accessories";
                detected.description = "Timepiece / watch detected via AI Lens visual scan.";
            } else if (topPrediction.includes("key")) {
                detected.itemName = "Key Ring";
                detected.category = "Keys";
                detected.description = "Keys detected via AI Lens visual scan.";
            } else if (topPrediction.includes("book") || topPrediction.includes("binder")) {
                detected.itemName = "Book / Journal";
                detected.category = "Books";
                detected.description = "Book or paper document detected via AI Lens visual scan.";
            } else {
                const cleanName = topPrediction.split(",")[0].trim();
                detected.itemName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                detected.description = `Detected object (${cleanName}) via AI Lens image analysis.`;
            }
        }

        // 2. Filename intelligence & parsing fallback
        const rawFileName = req.file.originalname;
        const nameWithoutExt = path.parse(rawFileName).name;
        const cleanTitle = nameWithoutExt.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
        const lowerTitle = cleanTitle.toLowerCase();

        // Brand matching
        const knownBrands = ["Apple", "Samsung", "HP", "Dell", "Lenovo", "Titan", "Nike", "Adidas", "Boat", "Sony", "Wildcraft", "Leather Co", "Portronics", "Noise", "Realme", "Xiaomi", "OnePlus"];
        let matchedBrand = "";
        for (const b of knownBrands) {
            if (lowerTitle.includes(b.toLowerCase())) {
                matchedBrand = b;
                break;
            }
        }
        if (!matchedBrand && cleanTitle.split(" ").length > 1) {
            const firstWord = cleanTitle.split(" ")[0];
            if (firstWord.length > 2 && !/^\d+$/.test(firstWord)) {
                matchedBrand = firstWord;
            }
        }

        // Category matching
        let matchedCategory = "";
        if (lowerTitle.includes("phone") || lowerTitle.includes("mobile") || lowerTitle.includes("iphone") || lowerTitle.includes("galaxy") || lowerTitle.includes("android")) {
            matchedCategory = "Mobile";
        } else if (lowerTitle.includes("laptop") || lowerTitle.includes("macbook") || lowerTitle.includes("notebook")) {
            matchedCategory = "Laptop";
        } else if (lowerTitle.includes("wallet") || lowerTitle.includes("purse") || lowerTitle.includes("cardholder")) {
            matchedCategory = "Wallet";
        } else if (lowerTitle.includes("bag") || lowerTitle.includes("backpack") || lowerTitle.includes("suitcase")) {
            matchedCategory = "Bag";
        } else if (lowerTitle.includes("watch") || lowerTitle.includes("power") || lowerTitle.includes("bank") || lowerTitle.includes("charger") || lowerTitle.includes("headphone") || lowerTitle.includes("earbud") || lowerTitle.includes("speaker") || lowerTitle.includes("cable") || lowerTitle.includes("ignite")) {
            matchedCategory = "Accessories";
        } else if (lowerTitle.includes("key")) {
            matchedCategory = "Keys";
        } else if (lowerTitle.includes("card") || lowerTitle.includes("id") || lowerTitle.includes("passport")) {
            matchedCategory = "ID Card";
        } else if (lowerTitle.includes("book") || lowerTitle.includes("file") || lowerTitle.includes("document")) {
            matchedCategory = "Documents";
        }

        if (!detected.itemName || detected.itemName === "Item Scanned" || detected.itemName === "Object") {
            if (cleanTitle && cleanTitle.length > 2) {
                detected.itemName = cleanTitle;
            }
        }

        if (matchedCategory) {
            detected.category = matchedCategory;
        }

        if (matchedBrand) {
            detected.brand = matchedBrand;
        }

        if (!detected.description) {
            detected.description = `Detected ${detected.itemName || 'item'} (${detected.brand ? detected.brand + ' ' : ''}${detected.color || ''}) via AI Lens scan.`;
        }

        console.log("AI Lens Final Detection Result:", detected);

        res.json({
            success: true,
            data: detected
        });

    } catch (error) {
        console.error("AI Lens Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= AI OCR INVOICE & SERIAL NUMBER EXTRACTOR =================

const Tesseract = require("tesseract.js");

exports.scanDocumentOcr = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No document/receipt image provided for OCR." });
        }

        const imagePath = req.file.path;
        console.log("🔍 Processing OCR for image:", imagePath);

        const result = await Tesseract.recognize(imagePath, 'eng');
        const rawText = result?.data?.text || "";

        // Extract potential serial numbers, model numbers, invoice amounts, IMEI
        const serialMatches = rawText.match(/(?:S\/N|SN|Serial|IMEI|Model|Invoice|No\.?)[\s:#-]*([A-Z0-9-]{4,25})/gi) || [];
        const dateMatches = rawText.match(/\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/g) || [];
        const priceMatches = rawText.match(/(?:Rs\.?|INR|\$|EUR|£)\s*[\d,]+(?:\.\d{2})?/gi) || [];

        res.json({
            success: true,
            rawText: rawText.trim(),
            extracted: {
                serials: [...new Set(serialMatches.map(s => s.trim()))],
                dates: [...new Set(dateMatches)],
                prices: [...new Set(priceMatches)]
            }
        });
    } catch (error) {
        console.error("OCR Scan Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
