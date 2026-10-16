const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authMiddleware(req, res, next);
    }
    next();
};

// Push Subscription Route
router.post("/subscribe", optionalAuth, notificationController.subscribePush);

// Recent Notifications Route
router.get("/recent", optionalAuth, notificationController.getRecentNotifications);

// Notification Preferences (Protected)
router.get("/preferences", authMiddleware, notificationController.getPreferences);
router.put("/preferences", authMiddleware, notificationController.updatePreferences);

module.exports = router;
