const notificationService = require("../services/notificationService");

// ================= GET USER NOTIFICATIONS =================
exports.getMyAlerts = async (req, res) => {
    try {
        const userId = req.user.id;
        const alerts = await notificationService.getUserAlerts(userId);
        const unreadCount = alerts.filter(a => !a.isRead).length;

        res.json({
            success: true,
            unreadCount,
            alerts,
            data: alerts
        });
    } catch (error) {
        console.error("Get Alerts Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= MARK NOTIFICATION AS READ =================
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await notificationService.markAlertAsRead(id, userId);

        res.json({
            success: true,
            message: "Notification marked as read."
        });
    } catch (error) {
        console.error("Mark Read Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
