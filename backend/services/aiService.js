const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

let model = null;

async function loadModel() {
    if (!model) {
        console.log("Loading MobileNet model...");
        model = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log("MobileNet model loaded.");
    }
    return model;
}

async function generateEmbedding(imagePath) {
    try {
        if (!fs.existsSync(imagePath)) return null;
        const m = await loadModel();
        
        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        const tensor = tf.browser.fromPixels(canvas);
        const embeddings = m.infer(tensor, true); // true for embeddings
        
        const array = await embeddings.array();
        
        tensor.dispose();
        embeddings.dispose();
        
        return JSON.stringify(array[0]); // store as string in db
    } catch (err) {
        console.error("Error generating embedding:", err);
        return null;
    }
}

async function classifyImage(imagePath) {
    try {
        if (!fs.existsSync(imagePath)) return [];
        const m = await loadModel();
        
        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        const tensor = tf.browser.fromPixels(canvas);
        const predictions = await m.classify(tensor, 5);
        tensor.dispose();
        
        const dominantColor = detectDominantColor(ctx, image.width, image.height);
        
        return {
            predictions: predictions || [],
            dominantColor: dominantColor || "Black"
        };
    } catch (err) {
        console.error("Error classifying image:", err);
        return { predictions: [], dominantColor: "Black" };
    }
}

function detectDominantColor(ctx, width, height) {
    try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;

        // Sample every 20th pixel for performance
        for (let i = 0; i < data.length; i += 80) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }

        if (count === 0) return "Black";

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Map RGB to human color name
        if (r < 50 && g < 50 && b < 50) return "Black";
        if (r > 200 && g > 200 && b > 200) return "White";
        if (r > 150 && g > 150 && b > 150 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) return "Silver";
        if (r > 150 && g > 120 && b < 80) return "Gold";
        if (r > 120 && g < 70 && b < 70) return "Red";
        if (b > 120 && r < 100 && g < 120) return "Blue";
        if (g > 120 && r < 100 && b < 100) return "Green";
        if (r > 100 && g > 70 && b < 50) return "Brown";

        return "Black";
    } catch (e) {
        return "Black";
    }
}

function cosineSimilarity(vecA, vecB) {
    try {
        if (typeof vecA === 'string') vecA = JSON.parse(vecA);
        if (typeof vecB === 'string') vecB = JSON.parse(vecB);
        
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    } catch(e) {
        return 0;
    }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
    const p1 = parseFloat(lat1);
    const p2 = parseFloat(lon1);
    const p3 = parseFloat(lat2);
    const p4 = parseFloat(lon2);
    if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4)) return null;

    const R = 6371; // Earth radius in km
    const dLat = (p3 - p1) * Math.PI / 180;
    const dLon = (p4 - p2) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1 * Math.PI / 180) * Math.cos(p3 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    const tokens1 = new Set(text1.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 2));
    const tokens2 = new Set(text2.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 2));
    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersection = 0;
    tokens1.forEach(t => {
        if (tokens2.has(t)) intersection++;
    });

    const union = new Set([...tokens1, ...tokens2]).size;
    return Math.round((intersection / union) * 100);
}

// ================= UNIFIED BADGE CALCULATOR =================
function calculateBadge(points) {
    if (points >= 1500) return "Diamond Legend";
    if (points >= 600) return "Gold Hero";
    if (points >= 200) return "Silver Guardian";
    return "Bronze Scout";
}

// ================= CONFIGURABLE MATCHING WEIGHTS =================
// Default weights (used when DB config is unavailable)
const DEFAULT_WEIGHTS = {
    weight_visual: 0.30,
    weight_text: 0.20,
    weight_category: 0.20,
    weight_attribute: 0.15,
    weight_location: 0.10,
    weight_temporal: 0.05,
    match_threshold: 25
};

// Cache for DB-loaded weights (refreshed every 5 minutes)
let cachedWeights = null;
let weightsCacheTime = 0;
const WEIGHTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getMatchingWeights(db) {
    const now = Date.now();
    if (cachedWeights && (now - weightsCacheTime) < WEIGHTS_CACHE_TTL) {
        return cachedWeights;
    }
    
    try {
        if (!db) return DEFAULT_WEIGHTS;
        const [rows] = await db.query("SELECT configKey, configValue FROM matching_config");
        if (rows && rows.length > 0) {
            const weights = { ...DEFAULT_WEIGHTS };
            rows.forEach(row => {
                weights[row.configKey] = parseFloat(row.configValue);
            });
            cachedWeights = weights;
            weightsCacheTime = now;
            return weights;
        }
    } catch (err) {
        // DB unavailable, use defaults
    }
    return DEFAULT_WEIGHTS;
}

function calculateHybridMatch(itemA, itemB, weights = null) {
    const w = weights || DEFAULT_WEIGHTS;
    const reasons = [];
    let visualScore = 0;
    let textScore = 0;
    let categoryScore = 0;
    let locationScore = 0;
    let temporalScore = 0;
    let attributeScore = 0;

    // 1. Visual Similarity (MobileNet Cosine Similarity)
    if (itemA.embedding && itemB.embedding) {
        const cosSim = cosineSimilarity(itemA.embedding, itemB.embedding);
        visualScore = Math.max(0, Math.min(100, Math.round(cosSim * 100)));
        if (visualScore > 65) {
            reasons.push(`High visual vector similarity (${visualScore}%)`);
        } else if (visualScore > 40) {
            reasons.push(`Moderate visual pattern match (${visualScore}%)`);
        }
    }

    // 2. Category Match
    if (itemA.category && itemB.category && itemA.category.toLowerCase() === itemB.category.toLowerCase()) {
        categoryScore = 100;
        reasons.push(`Exact category match: "${itemA.category}"`);
    } else {
        categoryScore = 10;
    }

    // 3. Semantic Text Match
    const textA = [itemA.itemName, itemA.brand, itemA.color, itemA.description].filter(Boolean).join(" ");
    const textB = [itemB.itemName, itemB.brand, itemB.color, itemB.description].filter(Boolean).join(" ");
    textScore = calculateTextSimilarity(textA, textB);
    if (textScore > 40) {
        reasons.push(`Strong textual & keyword correlation (${textScore}%)`);
    }

    // 4. Attribute Match (Brand & Color)
    let attrMatches = 0;
    if (itemA.brand && itemB.brand && itemA.brand.toLowerCase() === itemB.brand.toLowerCase()) {
        attrMatches += 50;
        reasons.push(`Matching brand manufacturer: "${itemA.brand}"`);
    }
    if (itemA.color && itemB.color && itemA.color.toLowerCase() === itemB.color.toLowerCase()) {
        attrMatches += 50;
        reasons.push(`Matching color profile: "${itemA.color}"`);
    }
    attributeScore = attrMatches;

    // 5. Location Proximity
    if (itemA.latitude && itemA.longitude && itemB.latitude && itemB.longitude) {
        const distKm = calculateDistanceKm(itemA.latitude, itemA.longitude, itemB.latitude, itemB.longitude);
        if (distKm !== null) {
            if (distKm <= 2) {
                locationScore = 100;
                reasons.push(`Close spatial proximity: ${distKm} km`);
            } else if (distKm <= 10) {
                locationScore = 75;
                reasons.push(`Within immediate vicinity: ${distKm} km`);
            } else if (distKm <= 30) {
                locationScore = 40;
                reasons.push(`Within metro radius: ${distKm} km`);
            } else {
                locationScore = 10;
            }
        }
    } else if (itemA.location && itemB.location && itemA.location.toLowerCase().includes(itemB.location.toLowerCase())) {
        locationScore = 80;
        reasons.push(`Matching location name: "${itemA.location}"`);
    }

    // 6. Temporal Proximity
    if (itemA.date && itemB.date) {
        const dateA = new Date(itemA.date);
        const dateB = new Date(itemB.date);
        const diffDays = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
            temporalScore = 100;
            reasons.push(`Tight incident timeframe (${Math.round(diffDays)} days difference)`);
        } else if (diffDays <= 14) {
            temporalScore = 70;
            reasons.push(`Reported within 2 weeks (${Math.round(diffDays)} days)`);
        } else if (diffDays <= 45) {
            temporalScore = 40;
        } else {
            temporalScore = 10;
        }
    }

    // Weighted Hybrid Final Score (using configurable weights)
    const hasVisual = visualScore > 0;
    let finalScore = 0;
    if (hasVisual) {
        finalScore = Math.round(
            (visualScore * w.weight_visual) +
            (textScore * w.weight_text) +
            (categoryScore * w.weight_category) +
            (attributeScore * w.weight_attribute) +
            (locationScore * w.weight_location) +
            (temporalScore * w.weight_temporal)
        );
    } else {
        // Redistribute visual weight proportionally when no image embedding
        const noVisualTotal = w.weight_text + w.weight_category + w.weight_attribute + w.weight_location + w.weight_temporal;
        const scale = noVisualTotal > 0 ? (1.0 / noVisualTotal) : 1;
        finalScore = Math.round(
            (textScore * w.weight_text * scale) +
            (categoryScore * w.weight_category * scale) +
            (attributeScore * w.weight_attribute * scale) +
            (locationScore * w.weight_location * scale) +
            (temporalScore * w.weight_temporal * scale)
        );
    }

    finalScore = Math.min(100, Math.max(0, finalScore));

    let confidence = "LOW";
    if (finalScore >= 75) confidence = "HIGH";
    else if (finalScore >= 45) confidence = "MEDIUM";
    else if (finalScore >= 20) confidence = "LOW";
    else confidence = "INSUFFICIENT_EVIDENCE";

    const uncertainty = Math.round((1 - (finalScore / 100)) * 100) / 100;

    return {
        finalScore,
        confidence,
        uncertainty,
        visualScore,
        textScore,
        categoryScore,
        attributeScore,
        locationScore,
        temporalScore,
        reasons: reasons.length > 0 ? reasons : ["General category similarity"],
        weightsUsed: {
            visual: w.weight_visual,
            text: w.weight_text,
            category: w.weight_category,
            attribute: w.weight_attribute,
            location: w.weight_location,
            temporal: w.weight_temporal
        },
        evaluatedAt: new Date()
    };
}

// ================= CONTINUOUS MATCHING =================
// Find matches for a newly submitted item against existing opposite-status items
async function findContinuousMatches(db, newItem, weights = null) {
    try {
        const oppositeStatus = newItem.status === 'lost' ? 'found' : 'lost';
        const [candidates] = await db.query(
            "SELECT * FROM items WHERE status = ? AND id != ?",
            [oppositeStatus, newItem.id]
        );
        
        const threshold = (weights && weights.match_threshold) || DEFAULT_WEIGHTS.match_threshold;
        
        const matches = candidates
            .map(candidate => {
                const hybrid = calculateHybridMatch(newItem, candidate, weights);
                return {
                    candidateId: candidate.id,
                    candidateItemName: candidate.itemName,
                    candidateCategory: candidate.category,
                    candidateStatus: candidate.status,
                    candidateLocation: candidate.location,
                    matchScore: hybrid.finalScore,
                    confidence: hybrid.confidence,
                    reasons: hybrid.reasons
                };
            })
            .filter(m => m.matchScore >= threshold)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10); // Top 10 candidates
        
        return matches;
    } catch (err) {
        console.error("Continuous matching error:", err.message);
        return [];
    }
}

// ================= ACHIEVEMENT DEFINITIONS =================
const ACHIEVEMENTS = {
    FIRST_REPORT: { key: 'first_report', name: 'First Valid Report', description: 'Submitted your first item report' },
    FIRST_RECOVERY: { key: 'first_recovery', name: 'First Successful Recovery', description: 'Completed your first verified item return' },
    TRUSTED_FINDER: { key: 'trusted_finder', name: 'Trusted Community Finder', description: 'Achieved Silver Guardian rank or higher' },
    FIVE_RECOVERIES: { key: 'five_recoveries', name: 'Five Successful Recoveries', description: 'Completed 5 verified item returns' },
    TEN_RECOVERIES: { key: 'ten_recoveries', name: 'Ten Successful Recoveries', description: 'Completed 10 verified item returns' },
    COMMUNITY_HERO: { key: 'community_hero', name: 'Community Hero', description: 'Reached Gold Hero rank' },
    LEGEND: { key: 'legend', name: 'Diamond Legend', description: 'Reached the highest Diamond Legend rank' }
};

async function checkAndAwardAchievements(db, userId) {
    try {
        const [users] = await db.query("SELECT points, badge FROM users WHERE id = ?", [userId]);
        if (!users || users.length === 0) return [];
        
        const user = users[0];
        const newAchievements = [];
        
        // Count user's reports
        const [reportCount] = await db.query("SELECT COUNT(*) as cnt FROM items WHERE userId = ?", [userId]);
        const reports = reportCount[0].cnt;
        
        // Count successful recoveries (handover completions as finder)
        const [recoveryCount] = await db.query(
            "SELECT COUNT(*) as cnt FROM point_transactions WHERE userId = ? AND reason LIKE '%Verified Return%'",
            [userId]
        );
        const recoveries = recoveryCount[0].cnt;
        
        const achievementsToCheck = [
            { condition: reports >= 1, ...ACHIEVEMENTS.FIRST_REPORT },
            { condition: recoveries >= 1, ...ACHIEVEMENTS.FIRST_RECOVERY },
            { condition: user.points >= 200, ...ACHIEVEMENTS.TRUSTED_FINDER },
            { condition: recoveries >= 5, ...ACHIEVEMENTS.FIVE_RECOVERIES },
            { condition: recoveries >= 10, ...ACHIEVEMENTS.TEN_RECOVERIES },
            { condition: user.points >= 600, ...ACHIEVEMENTS.COMMUNITY_HERO },
            { condition: user.points >= 1500, ...ACHIEVEMENTS.LEGEND }
        ];
        
        for (const ach of achievementsToCheck) {
            if (ach.condition) {
                try {
                    await db.query(
                        "INSERT IGNORE INTO finder_achievements (userId, achievementKey, achievementName, description) VALUES (?, ?, ?, ?)",
                        [userId, ach.key, ach.name, ach.description]
                    );
                    // Check if it was actually inserted (new achievement)
                    const [result] = await db.query(
                        "SELECT id FROM finder_achievements WHERE userId = ? AND achievementKey = ? AND earnedAt >= NOW() - INTERVAL 5 SECOND",
                        [userId, ach.key]
                    );
                    if (result.length > 0) {
                        newAchievements.push({ key: ach.key, name: ach.name, description: ach.description });
                    }
                } catch (e) {
                    // Achievement already exists or table not ready
                }
            }
        }
        
        return newAchievements;
    } catch (err) {
        console.error("Achievement check error:", err.message);
        return [];
    }
}

module.exports = {
    loadModel,
    generateEmbedding,
    classifyImage,
    cosineSimilarity,
    calculateHybridMatch,
    calculateDistanceKm,
    calculateTextSimilarity,
    calculateBadge,
    getMatchingWeights,
    findContinuousMatches,
    checkAndAwardAchievements,
    ACHIEVEMENTS,
    DEFAULT_WEIGHTS
};
