const db = require("../config/db");
const { calculateBadge } = require("../services/aiService");

// ================= ADD POINTS TO USER =================
exports.addPoints = async (userId, points, reason) => {
    // 1. Record transaction
    const sqlTrans = `INSERT INTO point_transactions (userId, points, reason) VALUES (?, ?, ?)`;
    await db.query(sqlTrans, [userId, points, reason]);

    // 2. Update user points & recalculate badge and trust score
    const [userRows] = await db.query(`SELECT points, trustScore FROM users WHERE id = ?`, [userId]);
    const currentPoints = (userRows[0]?.points || 0) + points;
    const newTrustScore = Math.min(100, (userRows[0]?.trustScore || 0) + Math.floor(points / 10));
    const newBadge = calculateBadge(currentPoints);

    const sqlUser = `UPDATE users SET points = ?, badge = ?, trustScore = ? WHERE id = ?`;
    await db.query(sqlUser, [currentPoints, newBadge, newTrustScore, userId]);

    return { newPoints: currentPoints, newBadge, newTrustScore };
};

// ================= GET USER POINT TRANSACTIONS =================
exports.getUserTransactions = async (userId) => {
    const sql = `SELECT * FROM point_transactions WHERE userId = ? ORDER BY id DESC`;
    const [rows] = await db.query(sql, [userId]);
    return rows;
};

// ================= GET LEADERBOARD (TOP 10) =================
exports.getTopFinders = async (limit = 10) => {
    const safeLimit = parseInt(limit, 10) || 10;
    const sql = `
        SELECT id, name, email, points, badge, trustScore, createdAt 
        FROM users 
        ORDER BY points DESC, trustScore DESC 
        LIMIT ?
    `;
    const [rows] = await db.query(sql, [safeLimit]);
    return rows;
};
