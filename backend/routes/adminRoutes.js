const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

// ================= ALL ADMIN ROUTES REQUIRE AUTH + ADMIN ROLE =================

// Analytics & Stats
router.get("/stats", authMiddleware, requireAdmin, adminController.getStats);
router.get("/heatmap-data", authMiddleware, requireAdmin, adminController.getHeatmapData);

// User Management
router.get("/users", authMiddleware, requireAdmin, adminController.getUsers);
router.put("/users/:id/ban", authMiddleware, requireAdmin, adminController.toggleUserBan);

// Claims & Disputes Moderation
router.get("/claims", authMiddleware, requireAdmin, adminController.getAllClaims);
router.put("/claims/:id/resolve", authMiddleware, requireAdmin, adminController.resolveClaimDispute);

// Audit & Fraud Logs
router.get("/audit-logs", authMiddleware, requireAdmin, adminController.getAuditLogs);
router.get("/fraud-alerts", authMiddleware, requireAdmin, adminController.getFraudAlerts);

// Item Moderation
router.delete("/items/:id", authMiddleware, requireAdmin, adminController.deleteItem);

// Matching Weights & Config
router.get("/matching-config", authMiddleware, requireAdmin, adminController.getMatchingConfig);
router.put("/matching-config", authMiddleware, requireAdmin, adminController.updateMatchingConfig);

module.exports = router;
