const express = require("express");
const router = express.Router();
const safeTagController = require("../controllers/safeTagController");
const authMiddleware = require("../middleware/authMiddleware");

// Public: Resolve Tag info when finder scans QR code
router.get("/resolve/:tagCode", safeTagController.resolveTagPublic);

// Public: Finder pings owner with GPS coordinates & message
router.post("/ping/:tagCode", safeTagController.finderPingOwner);

// Protected: Get user's registered SafeTags
router.get("/my-tags", authMiddleware, safeTagController.getMySafeTags);

// Protected: Register new valuable asset SafeTag
router.post("/", authMiddleware, safeTagController.createSafeTag);

// Protected: Toggle isLost status
router.put("/:id/toggle-lost", authMiddleware, safeTagController.toggleLostStatus);

module.exports = router;
