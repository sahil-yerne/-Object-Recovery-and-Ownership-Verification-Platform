const db = require("../config/db");

// ================= SUBSCRIBE TO PUSH NOTIFICATIONS =================

exports.subscribePush = async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user ? req.user.id : (req.body.userId || null);

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                success: false,
                message: "Valid push subscription object is required."
            });
        }

        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys ? subscription.keys.p256dh : null;
        const auth = subscription.keys ? subscription.keys.auth : null;

        // Check if already subscribed
        const [existing] = await db.query("SELECT id FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
        if (existing.length > 0) {
            await db.query("UPDATE push_subscriptions SET userId = ?, p256dh = ?, auth = ? WHERE endpoint = ?", [userId, p256dh, auth, endpoint]);
        } else {
            await db.query("INSERT INTO push_subscriptions (userId, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)", [userId, endpoint, p256dh, auth]);
        }

        res.json({
            success: true,
            message: "Push notifications successfully registered!"
        });
    } catch (error) {
        console.error("Push Subscription Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to register push subscription."
        });
    }
};

// ================= GET RECENT SYSTEM NOTIFICATIONS =================

exports.getRecentNotifications = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        let sql = "SELECT * FROM alerts WHERE userId = ? OR userId IS NULL ORDER BY createdAt DESC LIMIT 20";
        const [rows] = await db.query(sql, [userId]);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= NOTIFICATION PREFERENCES =================

exports.getPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.query("SELECT * FROM notification_preferences WHERE userId = ?", [userId]);
        if (rows.length === 0) {
            return res.json({
                success: true,
                preferences: {
                    userId,
                    emailNotifications: true,
                    pushNotifications: true,
                    matchAlerts: true,
                    claimUpdates: true,
                    rewardAlerts: true,
                    systemAnnouncements: true
                }
            });
        }
        res.json({
            success: true,
            preferences: rows[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const { emailNotifications, pushNotifications, matchAlerts, claimUpdates, rewardAlerts, systemAnnouncements } = req.body;

        await db.query(`
            INSERT INTO notification_preferences 
            (userId, emailNotifications, pushNotifications, matchAlerts, claimUpdates, rewardAlerts, systemAnnouncements)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            emailNotifications = VALUES(emailNotifications),
            pushNotifications = VALUES(pushNotifications),
            matchAlerts = VALUES(matchAlerts),
            claimUpdates = VALUES(claimUpdates),
            rewardAlerts = VALUES(rewardAlerts),
            systemAnnouncements = VALUES(systemAnnouncements)
        `, [
            userId,
            emailNotifications !== undefined ? Boolean(emailNotifications) : true,
            pushNotifications !== undefined ? Boolean(pushNotifications) : true,
            matchAlerts !== undefined ? Boolean(matchAlerts) : true,
            claimUpdates !== undefined ? Boolean(claimUpdates) : true,
            rewardAlerts !== undefined ? Boolean(rewardAlerts) : true,
            systemAnnouncements !== undefined ? Boolean(systemAnnouncements) : true
        ]);

        const [rows] = await db.query("SELECT * FROM notification_preferences WHERE userId = ?", [userId]);
        res.json({
            success: true,
            message: "Notification preferences saved successfully.",
            preferences: rows[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
