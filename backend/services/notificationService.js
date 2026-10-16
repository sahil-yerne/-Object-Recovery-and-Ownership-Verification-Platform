const db = require("../config/db");

/**
 * In-App & Email Notification Service
 */

exports.createAlert = async ({ userId, title, message, latitude = null, longitude = null }) => {
    try {
        if (!userId) return null;

        const sql = `
            INSERT INTO alerts (userId, title, message, latitude, longitude, isRead)
            VALUES (?, ?, ?, ?, ?, FALSE)
        `;
        const [result] = await db.query(sql, [userId, title, message, latitude, longitude]);
        return result.insertId;
    } catch (err) {
        console.error("Failed to create alert notification:", err.message);
        return null;
    }
};

exports.getUserAlerts = async (userId) => {
    try {
        const sql = `
            SELECT * FROM alerts 
            WHERE userId = ? 
            ORDER BY id DESC 
            LIMIT 30
        `;
        const [rows] = await db.query(sql, [userId]);
        return rows;
    } catch (err) {
        console.error("Failed to fetch user alerts:", err.message);
        return [];
    }
};

exports.markAlertAsRead = async (alertId, userId) => {
    try {
        const sql = `UPDATE alerts SET isRead = TRUE WHERE id = ? AND userId = ?`;
        await db.query(sql, [alertId, userId]);
        return true;
    } catch (err) {
        console.error("Failed to mark alert as read:", err.message);
        return false;
    }
};
