const db = require("../config/db");

// ================= GET ALL VERIFIED SAFE ZONES =================

exports.getSafeZones = async (req, res) => {
    try {
        const { city } = req.query;
        let sql = "SELECT * FROM safe_zones WHERE isVerified = TRUE";
        const params = [];

        if (city) {
            sql += " AND city LIKE ?";
            params.push(`%${city}%`);
        }

        sql += " ORDER BY name ASC";
        const [rows] = await db.query(sql, params);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error("Get Safe Zones Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch safe handover zones."
        });
    }
};

// ================= DEPOSIT ITEM AT SAFE ZONE =================

exports.depositItemAtSafeZone = async (req, res) => {
    try {
        const { itemId, safeZoneId, depositNotes } = req.body;

        if (!itemId || !safeZoneId) {
            return res.status(400).json({
                success: false,
                message: "itemId and safeZoneId are required."
            });
        }

        // Verify safe zone exists
        const [zones] = await db.query("SELECT * FROM safe_zones WHERE id = ?", [safeZoneId]);
        if (zones.length === 0) {
            return res.status(404).json({ success: false, message: "Safe Zone not found." });
        }
        const zone = zones[0];

        // Update item storage details and location
        const storageDetails = `Deposited at Safe Hub: ${zone.name} (${zone.address}). Desk Notes: ${depositNotes || "In official safe custody"}`;
        await db.query(
            "UPDATE items SET storageDetails = ?, location = ?, latitude = ?, longitude = ? WHERE id = ?",
            [storageDetails, zone.address, zone.latitude, zone.longitude, itemId]
        );

        res.json({
            success: true,
            message: `Item custody successfully recorded at ${zone.name}!`,
            safeZone: zone,
            storageDetails
        });
    } catch (error) {
        console.error("Deposit Item Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to record safe zone deposit."
        });
    }
};
