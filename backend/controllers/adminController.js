const db = require("../config/db");
const notificationService = require("../services/notificationService");

exports.getStats = async (req, res) => {
    try {
        let items = [];
        try {
            const [rows] = await db.query("SELECT * FROM items");
            items = rows;
        } catch (err) {
            items = global.inMemoryItems || [];
        }

        const totalItems = items.length;
        const lostCount = items.filter(i => i.status === 'lost').length;
        const foundCount = items.filter(i => i.status === 'found').length;
        const returnedCount = items.filter(i => i.status === 'returned' || i.isReturned).length;

        // Category breakdown
        const categories = {};
        items.forEach(i => {
            const cat = i.category || 'Other';
            categories[cat] = (categories[cat] || 0) + 1;
        });

        const recoveryRate = totalItems > 0 ? Math.round(((foundCount + returnedCount) / totalItems) * 100) : 85;

        res.json({
            success: true,
            stats: {
                totalItems,
                lostCount,
                foundCount,
                returnedCount,
                recoveryRate,
                categories
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getHeatmapData = async (req, res) => {
    try {
        let items = [];
        try {
            const [rows] = await db.query("SELECT id, itemName, category, status, latitude, longitude, location FROM items WHERE latitude IS NOT NULL AND longitude IS NOT NULL");
            items = rows;
        } catch (err) {
            items = (global.inMemoryItems || []).filter(i => i.latitude && i.longitude);
        }

        // Format points for Leaflet Heatmap [lat, lng, intensity]
        const heatPoints = items.map(i => [
            parseFloat(i.latitude),
            parseFloat(i.longitude),
            i.status === 'lost' ? 0.8 : 0.5 // Higher intensity for lost items
        ]);

        res.json({
            success: true,
            totalPoints: heatPoints.length,
            points: heatPoints,
            items
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= USER MODERATION =================

exports.getUsers = async (req, res) => {
    try {
        let users = [];
        try {
            const [rows] = await db.query(
                "SELECT id, name, email, phone, role, trustScore, points, badge, isBanned, createdAt FROM users ORDER BY id DESC"
            );
            users = rows;
        } catch (err) {
            users = (global.inMemoryUsers || []).map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone,
                role: u.role || 'user',
                trustScore: u.trustScore || 0,
                points: u.points || 0,
                badge: u.badge || 'Bronze Finder',
                isBanned: u.isBanned || false,
                createdAt: u.createdAt || new Date()
            }));
        }

        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleUserBan = async (req, res) => {
    try {
        const { id } = req.params;
        let isBanned = false;

        try {
            const [rows] = await db.query("SELECT id, role, isBanned FROM users WHERE id = ?", [id]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            if (rows[0].role === 'admin') {
                return res.status(403).json({ success: false, message: "Admin accounts cannot be banned." });
            }

            isBanned = !rows[0].isBanned;
            await db.query("UPDATE users SET isBanned = ? WHERE id = ?", [isBanned, id]);
        } catch (err) {
            const user = (global.inMemoryUsers || []).find(u => u.id == id);
            if (!user) return res.status(404).json({ success: false, message: "User not found" });
            user.isBanned = !user.isBanned;
            isBanned = user.isBanned;
        }

        res.json({
            success: true,
            message: `User ${isBanned ? 'banned' : 'unbanned'} successfully`,
            isBanned
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= CLAIMS & DISPUTES MODERATION =================

exports.getAllClaims = async (req, res) => {
    try {
        let claims = [];
        try {
            const [rows] = await db.query(`
                SELECT c.*, 
                       i.itemName, i.category, i.status as itemStatus, i.contactName as finderName, i.userId as finderUserId,
                       u.name as claimantName, u.email as claimantEmail, u.phone as claimantPhone
                FROM claims c
                JOIN items i ON c.itemId = i.id
                JOIN users u ON c.claimantId = u.id
                ORDER BY c.id DESC
            `);
            claims = rows;
        } catch (err) {
            claims = global.inMemoryClaims || [];
        }

        res.json({ success: true, count: claims.length, data: claims });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resolveClaimDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: "Action must be 'approve' or 'reject'" });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        let claimantId = null;
        let itemId = null;
        let itemName = "Item";

        try {
            const [rows] = await db.query("SELECT c.*, i.itemName FROM claims c JOIN items i ON c.itemId = i.id WHERE c.id = ?", [id]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: "Claim not found" });
            }

            claimantId = rows[0].claimantId;
            itemId = rows[0].itemId;
            itemName = rows[0].itemName;

            await db.query(
                "UPDATE claims SET status = ?, adminNotes = ?, reviewedBy = ? WHERE id = ?",
                [newStatus, adminNotes || "Admin dispute resolution override", req.user ? req.user.id : null, id]
            );

            if (newStatus === 'approved') {
                await db.query("UPDATE items SET status = 'claimed' WHERE id = ?", [itemId]);
            }
        } catch (err) {
            const claim = (global.inMemoryClaims || []).find(c => c.id == id);
            if (!claim) return res.status(404).json({ success: false, message: "Claim not found" });
            claim.status = newStatus;
            claim.adminNotes = adminNotes;
            claimantId = claim.claimantId;
            itemId = claim.itemId;
        }

        // Trigger notification to claimant
        if (claimantId) {
            await notificationService.createAlert({
                userId: claimantId,
                title: action === 'approve' ? `Claim Dispute Resolved: Approved` : `Claim Dispute Resolved: Rejected`,
                message: `Admin has reviewed the dispute for '${itemName}'. Status: ${newStatus.toUpperCase()}.${adminNotes ? ' Note: ' + adminNotes : ''}`
            });
        }

        res.json({
            success: true,
            message: `Claim successfully ${newStatus} by admin moderation.`,
            status: newStatus
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= ITEM MODERATION =================

exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        try {
            await db.query("DELETE FROM items WHERE id = ?", [id]);
        } catch (err) {
            if (global.inMemoryItems) {
                global.inMemoryItems = global.inMemoryItems.filter(i => i.id != id);
            }
        }

        res.json({ success: true, message: "Item deleted by admin moderation." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= AUDIT LOGS =================

exports.getAuditLogs = async (req, res) => {
    try {
        const [logs] = await db.query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= FRAUD RISK ALERTS =================

exports.getFraudAlerts = async (req, res) => {
    try {
        const [alerts] = await db.query(`
            SELECT fr.*, i.itemName, i.category, u.name as userName, u.email as userEmail
            FROM fraud_risk_logs fr
            JOIN items i ON fr.itemId = i.id
            JOIN users u ON fr.userId = u.id
            ORDER BY fr.id DESC LIMIT 100
        `);
        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= MATCHING WEIGHTS CONFIGURATION =================

exports.getMatchingConfig = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM matching_config ORDER BY id ASC");
        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateMatchingConfig = async (req, res) => {
    try {
        const { configs } = req.body;
        const adminId = req.user ? req.user.id : null;

        if (!configs) {
            return res.status(400).json({ success: false, message: "configs payload is required." });
        }

        const entries = Array.isArray(configs) 
            ? configs 
            : Object.entries(configs).map(([configKey, configValue]) => ({ configKey, configValue }));

        for (const entry of entries) {
            const { configKey, configValue } = entry;
            if (configKey !== undefined && configValue !== undefined) {
                await db.query(
                    `INSERT INTO matching_config (configKey, configValue, updatedBy) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE configValue = VALUES(configValue), updatedBy = VALUES(updatedBy)`,
                    [configKey, parseFloat(configValue), adminId]
                );
            }
        }

        // Audit log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, details)
            VALUES (?, 'admin', 'CONFIG_UPDATE', 'MATCHING_CONFIG', ?)
        `, [adminId, JSON.stringify(entries)]);

        // Fetch refreshed configs
        const [updated] = await db.query("SELECT * FROM matching_config ORDER BY id ASC");

        res.json({
            success: true,
            message: "Matching configuration updated successfully.",
            data: updated
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

