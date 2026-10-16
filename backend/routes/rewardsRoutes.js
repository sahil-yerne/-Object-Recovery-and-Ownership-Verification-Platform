const express = require("express");
const router = express.Router();
const rewardsController = require("../controllers/rewardsController");
const authMiddleware = require("../middleware/authMiddleware");

// Rewards Catalog (Public/Protected)
router.get("/catalog", rewardsController.getStoreCatalog);

// User Wallet & Point History (Protected)
router.get("/wallet", authMiddleware, rewardsController.getMyWallet);

// User Achievements & Milestones (Protected)
router.get("/achievements", authMiddleware, rewardsController.getMyAchievements);

// Redeem Reward (Protected)
router.post("/redeem", authMiddleware, rewardsController.redeemReward);

module.exports = router;
