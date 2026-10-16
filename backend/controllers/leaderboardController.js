const pointModel = require("../models/pointModel");
const userModel = require("../models/userModel");
const claimModel = require("../models/claimModel");

// ================= GET TOP FINDERS LEADERBOARD =================
exports.getLeaderboard = async (req, res) => {
    try {
        const topFinders = await pointModel.getTopFinders(10);
        res.json({ success: true, leaderboard: topFinders });
    } catch (error) {
        console.error("Get Leaderboard Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching leaderboard." });
    }
};

// ================= GET USER PROFILE & DASHBOARD STATS =================
exports.getUserDashboard = async (req, res) => {
    try {
        const userId = req.user.id; // From authMiddleware
        const user = await userModel.getUserById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const pointHistory = await pointModel.getUserTransactions(userId);
        const myClaims = await claimModel.getClaimsByUserId(userId);

        res.json({
            success: true,
            user,
            pointHistory,
            myClaims
        });
    } catch (error) {
        console.error("Get User Dashboard Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching user dashboard." });
    }
};
