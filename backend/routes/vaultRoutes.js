const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const vaultController = require("../controllers/vaultController");

// Deposit private evidence (protected)
router.post("/deposit", authMiddleware, upload.array("receipts", 5), vaultController.depositVaultEvidence);

// Retrieve private evidence (owner/admin only)
router.get("/:itemId", authMiddleware, vaultController.getVaultEvidence);

module.exports = router;
