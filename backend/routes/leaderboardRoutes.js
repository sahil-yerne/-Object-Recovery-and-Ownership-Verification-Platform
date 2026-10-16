const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController");
const authMiddleware = require("../middleware/authMiddleware");

// Get Top Finders Leaderboard (Public)
router.get("/top-finders", leaderboardController.getLeaderboard);

// Get User Dashboard (Protected)
router.get("/my-dashboard", authMiddleware, leaderboardController.getUserDashboard);

module.exports = router;
