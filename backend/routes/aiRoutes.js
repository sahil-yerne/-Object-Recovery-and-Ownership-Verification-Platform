const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const upload = require("../middleware/upload");

// ================= GENERATE AI DESCRIPTION =================
router.post("/generate-description", aiController.generateDescription);

// ================= AI LENS SCANNER =================
router.post("/lens-scan", upload.single("image"), aiController.analyzeImageLens);

// ================= AI OCR SCANNER =================
router.post("/ocr-scan", upload.single("document"), aiController.scanDocumentOcr);

module.exports = router;
