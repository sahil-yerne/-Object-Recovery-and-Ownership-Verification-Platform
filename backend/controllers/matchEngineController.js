const db = require("../config/db");
const { calculateHybridMatch, calculateDistanceKm, getMatchingWeights } = require("../services/aiService");

// ================= GET INSTANT HIGH CONFIDENCE MATCHES =================

exports.getInstantMatches = async (req, res) => {
    try {
        const { itemId } = req.params;

        let rows = [];
        try {
            const [dbRows] = await db.query("SELECT * FROM items WHERE id = ?", [itemId]);
            rows = dbRows;
        } catch (err) {
            rows = (global.inMemoryItems || []).filter(i => i.id == itemId);
        }

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        const targetItem = rows[0];
        const oppositeStatus = targetItem.status === 'lost' ? 'found' : 'lost';

        // Load active matching weights (cached)
        const weights = await getMatchingWeights(db);
        const minThreshold = weights.match_threshold !== undefined ? weights.match_threshold : 25;

        let candidates = [];
        try {
            const [candRows] = await db.query("SELECT * FROM items WHERE status = ? AND id != ?", [oppositeStatus, itemId]);
            candidates = candRows;
        } catch (err) {
            candidates = (global.inMemoryItems || []).filter(i => i.status === oppositeStatus && i.id != itemId);
        }

        const matches = candidates.map(item => {
            const hybrid = calculateHybridMatch(targetItem, item, weights);
            const distKm = calculateDistanceKm(targetItem.latitude, targetItem.longitude, item.latitude, item.longitude);
            return {
                ...item,
                matchPercentage: hybrid.finalScore,
                confidence: hybrid.confidence,
                uncertainty: hybrid.uncertainty,
                distanceKm: distKm,
                signalBreakdown: {
                    visualScore: hybrid.visualScore,
                    textScore: hybrid.textScore,
                    categoryScore: hybrid.categoryScore,
                    attributeScore: hybrid.attributeScore,
                    locationScore: hybrid.locationScore,
                    temporalScore: hybrid.temporalScore
                },
                reasons: hybrid.reasons
            };
        })
        .filter(m => m.matchPercentage >= minThreshold)
        .sort((a, b) => b.matchPercentage - a.matchPercentage);

        res.json({
            success: true,
            targetItem,
            totalMatches: matches.length,
            matches
        });

    } catch (error) {
        console.error("Match Engine Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= HYBRID EVALUATE PAIR =================

exports.evaluatePair = async (req, res) => {
    try {
        const { itemAId, itemBId } = req.body;
        if (!itemAId || !itemBId) {
            return res.status(400).json({ success: false, message: "Both itemAId and itemBId are required." });
        }

        const [itemARows] = await db.query("SELECT * FROM items WHERE id = ?", [itemAId]);
        const [itemBRows] = await db.query("SELECT * FROM items WHERE id = ?", [itemBId]);

        if (!itemARows || itemARows.length === 0 || !itemBRows || itemBRows.length === 0) {
            return res.status(404).json({ success: false, message: "One or both items could not be found." });
        }

        const evaluation = calculateHybridMatch(itemARows[0], itemBRows[0]);
        res.json({
            success: true,
            itemA: { id: itemARows[0].id, itemName: itemARows[0].itemName, status: itemARows[0].status },
            itemB: { id: itemBRows[0].id, itemName: itemBRows[0].itemName, status: itemBRows[0].status },
            evaluation
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
