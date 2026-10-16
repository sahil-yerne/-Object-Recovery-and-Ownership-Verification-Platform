const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const db = require("../config/db");
const { generateEmbedding, cosineSimilarity } = require("../services/aiService");

router.post("/", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image provided" });
        }

        const uploadedImagePath = req.file.path;
        console.log("Generating embedding for search image...");
        const searchEmbedding = await generateEmbedding(uploadedImagePath);

        if (!searchEmbedding) {
            return res.status(500).json({ success: false, message: "Failed to process image" });
        }

        const parsedSearchEmbedding = JSON.parse(searchEmbedding);

        // Fetch all items that have an embedding
        const [items] = await db.query("SELECT * FROM items WHERE embedding IS NOT NULL");
        console.log(`Found ${items.length} items with embeddings to compare.`);

        const matches = [];
        for (const item of items) {
            const similarity = cosineSimilarity(parsedSearchEmbedding, item.embedding);
            // Threshold for similarity (0.6 is a good starting point for MobileNet embeddings)
            if (similarity > 0.6) {
                // don't send embedding back to client
                const { embedding, ...safeItem } = item;
                matches.push({
                    item: safeItem,
                    similarity: similarity
                });
            }
        }

        matches.sort((a, b) => b.similarity - a.similarity);

        // Try to clean up the uploaded temporary search image
        const fs = require("fs");
        try {
            fs.unlinkSync(uploadedImagePath);
        } catch (e) {
            console.error("Could not delete temp search image", e);
        }

        res.json({
            success: true,
            data: matches
        });
    } catch (error) {
        console.error("Match error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const matchEngineController = require("../controllers/matchEngineController");

// Instant AI match percentage calculation route
router.get("/instant/:itemId", matchEngineController.getInstantMatches);

// Pairwise hybrid evaluation route
router.post("/hybrid-evaluate", matchEngineController.evaluatePair);

module.exports = router;
