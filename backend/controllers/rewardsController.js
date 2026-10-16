const db = require("../config/db");
const notificationService = require("../services/notificationService");
const { calculateBadge, ACHIEVEMENTS } = require("../services/aiService");

const STORE_CATALOG = [
    {
        id: "certificate",
        title: "Official Community Hero Certificate",
        cost: 100,
        category: "Recognition",
        badgeColor: "warning",
        icon: "bi-award-fill",
        description: "Official downloadable digital certificate of appreciation with cryptographic verification seal for resumes and portfolio.",
        type: "certificate"
    },
    {
        id: "boost",
        title: "72-Hour Search Boost (Pin to Top)",
        cost: 50,
        category: "Feature Perk",
        badgeColor: "info",
        icon: "bi-rocket-takeoff-fill",
        description: "Highlights and pins any of your reported lost/found item posts to the top of search results for 72 hours.",
        type: "feature"
    },
    {
        id: "coupon_coffee",
        title: "₹100 Café Coffee Day Voucher",
        cost: 150,
        category: "Food & Drinks",
        badgeColor: "success",
        icon: "bi-cup-hot-fill",
        description: "Instant digital discount code for a free beverage at partner coffee outlets.",
        type: "coupon"
    },
    {
        id: "coupon_shopping",
        title: "15% Off Amazon / E-Commerce Voucher",
        cost: 250,
        category: "Shopping",
        badgeColor: "primary",
        icon: "bi-bag-check-fill",
        description: "Exclusive 15% discount coupon code valid on apparel, electronics, and accessories.",
        type: "coupon"
    }
];


// ================= GET USER WALLET & TRANSACTIONS =================
exports.getMyWallet = async (req, res) => {
    try {
        const userId = req.user.id;

        let user = null;
        try {
            const [users] = await db.query(
                "SELECT id, name, email, points, trustScore, badge FROM users WHERE id = ?",
                [userId]
            );
            if (users.length > 0) user = users[0];
        } catch (err) {
            user = (global.inMemoryUsers || []).find(u => u.id == userId);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const points = user.points || 0;
        const trustScore = user.trustScore || 0;
        const badge = user.badge || calculateBadge(points);

        // Calculate progress to next rank
        let nextRank = "Silver Guardian";
        let nextRankPoints = 200;
        let rankProgressPct = Math.min(100, Math.round((points / 200) * 100));

        if (points >= 1500) {
            nextRank = "Max Rank (Legend)";
            nextRankPoints = 1500;
            rankProgressPct = 100;
        } else if (points >= 600) {
            nextRank = "Diamond Legend";
            nextRankPoints = 1500;
            rankProgressPct = Math.min(100, Math.round(((points - 600) / 900) * 100));
        } else if (points >= 200) {
            nextRank = "Gold Hero";
            nextRankPoints = 600;
            rankProgressPct = Math.min(100, Math.round(((points - 200) / 400) * 100));
        }

        // Fetch point transaction history
        let transactions = [];
        try {
            const [txs] = await db.query(
                "SELECT * FROM point_transactions WHERE userId = ? ORDER BY id DESC LIMIT 50",
                [userId]
            );
            transactions = txs;
        } catch (err) {
            transactions = [];
        }

        res.json({
            success: true,
            wallet: {
                points,
                trustScore,
                badge,
                nextRank,
                nextRankPoints,
                rankProgressPct,
                transactions
            }
        });
    } catch (error) {
        console.error("Get Wallet Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= GET REWARDS CATALOG =================
exports.getStoreCatalog = async (req, res) => {
    res.json({
        success: true,
        catalog: STORE_CATALOG
    });
};

// ================= REDEEM REWARD =================
exports.redeemReward = async (req, res) => {
    try {
        const userId = req.user.id;
        const { rewardId } = req.body;

        const perk = STORE_CATALOG.find(c => c.id === rewardId);
        if (!perk) {
            return res.status(400).json({ success: false, message: "Invalid reward item selected." });
        }

        let user = null;
        try {
            const [users] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
            if (users.length > 0) user = users[0];
        } catch (err) {
            user = (global.inMemoryUsers || []).find(u => u.id == userId);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if ((user.points || 0) < perk.cost) {
            return res.status(400).json({
                success: false,
                message: `Insufficient points! You need ${perk.cost} points, but currently have ${user.points || 0} points.`
            });
        }

        // Deduct points
        const newBalance = user.points - perk.cost;
        const newBadge = calculateBadge(newBalance);

        try {
            await db.query("UPDATE users SET points = ?, badge = ? WHERE id = ?", [newBalance, newBadge, userId]);
            await db.query(
                "INSERT INTO point_transactions (userId, points, reason) VALUES (?, ?, ?)",
                [userId, -perk.cost, `Redeemed Reward: ${perk.title}`]
            );
        } catch (dbErr) {
            user.points = newBalance;
            user.badge = newBadge;
        }

        // Generate voucher code or certificate data
        const voucherCode = "REWARD-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + perk.cost;

        await notificationService.createAlert({
            userId,
            title: `🎁 Reward Unlocked: ${perk.title}`,
            message: `You successfully redeemed ${perk.cost} points for '${perk.title}'. Code: ${voucherCode}.`
        });

        res.json({
            success: true,
            message: `🎉 Successfully redeemed ${perk.title}!`,
            remainingPoints: newBalance,
            reward: {
                id: perk.id,
                title: perk.title,
                voucherCode,
                redeemedAt: new Date()
            }
        });

    } catch (error) {
        console.error("Redeem Reward Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= GET USER ACHIEVEMENTS & MILESTONES =================
exports.getMyAchievements = async (req, res) => {
    try {
        const userId = req.user.id;
        let earned = [];
        try {
            const [rows] = await db.query(
                "SELECT achievementKey, achievementName, description, earnedAt FROM finder_achievements WHERE userId = ? ORDER BY earnedAt ASC",
                [userId]
            );
            earned = rows;
        } catch (e) {
            earned = [];
        }

        const earnedMap = {};
        for (const e of earned) {
            earnedMap[e.achievementKey] = e.earnedAt;
        }

        const allMilestones = Object.values(ACHIEVEMENTS).map(ach => ({
            key: ach.key,
            name: ach.name,
            description: ach.description,
            unlocked: Boolean(earnedMap[ach.key]),
            earnedAt: earnedMap[ach.key] || null
        }));

        res.json({
            success: true,
            totalUnlocked: earned.length,
            totalAvailable: Object.keys(ACHIEVEMENTS).length,
            achievements: allMilestones
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
