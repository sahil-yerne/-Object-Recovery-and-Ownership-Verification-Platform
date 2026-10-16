const db = require("../config/db");
const crypto = require("crypto");
const QRCode = require("qrcode");
const notificationService = require("../services/notificationService");

// Helper to generate a unique SafeTag code
function generateTagCode() {
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    const year = new Date().getFullYear();
    return `TAG-${rand}-${year}`;
}

// ================= CREATE A NEW SAFETAG (REGISTER VALUABLE) =================
exports.createSafeTag = async (req, res) => {
    try {
        const userId = req.user.id;
        const { assetName, category, brand, color, rewardAmount, emergencyNote } = req.body;

        if (!assetName || !category) {
            return res.status(400).json({ success: false, message: "Asset Name and Category are required." });
        }

        const tagCode = generateTagCode();
        const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5004}`;
        const landingUrl = `${baseUrl}/safetag.html?tag=${tagCode}`;

        // Generate QR code as Base64 Data URL
        const qrDataUrl = await QRCode.toDataURL(landingUrl, {
            errorCorrectionLevel: "H",
            margin: 2,
            color: {
                dark: "#00f0ff",
                light: "#0a0f1d"
            },
            width: 300
        });

        const [result] = await db.query(`
            INSERT INTO asset_safetags 
            (tagCode, userId, assetName, category, brand, color, rewardAmount, emergencyNote)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tagCode,
            userId,
            assetName,
            category,
            brand || null,
            color || null,
            rewardAmount ? parseFloat(rewardAmount) : 0.00,
            emergencyNote || null
        ]);

        res.status(201).json({
            success: true,
            message: "Asset SafeTag registered successfully! Attach this QR Code to your valuable.",
            data: {
                id: result.insertId,
                tagCode,
                assetName,
                landingUrl,
                qrDataUrl
            }
        });
    } catch (error) {
        console.error("Create SafeTag Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= GET USER'S REGISTERED SAFETAGS =================
exports.getMySafeTags = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.query(
            "SELECT * FROM asset_safetags WHERE userId = ? ORDER BY id DESC",
            [userId]
        );

        const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5004}`;

        const tagsWithQr = await Promise.all(rows.map(async (tag) => {
            const landingUrl = `${baseUrl}/safetag.html?tag=${tag.tagCode}`;
            const qrDataUrl = await QRCode.toDataURL(landingUrl, {
                errorCorrectionLevel: "M",
                margin: 2,
                color: {
                    dark: "#00f0ff",
                    light: "#0a0f1d"
                },
                width: 250
            });
            return {
                ...tag,
                landingUrl,
                qrDataUrl
            };
        }));

        res.json({
            success: true,
            count: tagsWithQr.length,
            data: tagsWithQr
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= TOGGLE LOST STATUS ON SAFETAG =================
exports.toggleLostStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const [rows] = await db.query("SELECT * FROM asset_safetags WHERE id = ? AND userId = ?", [id, userId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "SafeTag not found." });
        }

        const currentLost = rows[0].isLost;
        const newLost = !currentLost;

        await db.query("UPDATE asset_safetags SET isLost = ? WHERE id = ?", [newLost, id]);

        res.json({
            success: true,
            message: newLost ? "🚨 Asset flagged as LOST. Anyone scanning its QR code will see an emergency lost alert." : "✅ Asset status returned to NORMAL.",
            isLost: newLost
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= PUBLIC RESOLVE SAFETAG (WHEN FINDER SCANS QR) =================
exports.resolveTagPublic = async (req, res) => {
    try {
        const { tagCode } = req.params;

        const [rows] = await db.query(`
            SELECT st.id, st.tagCode, st.assetName, st.category, st.brand, st.color, 
                   st.rewardAmount, st.emergencyNote, st.isLost, st.scanCount, st.lastScannedAt,
                   u.name as ownerName
            FROM asset_safetags st
            JOIN users u ON st.userId = u.id
            WHERE st.tagCode = ?
        `, [tagCode]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Invalid or unrecognized SafeTag." });
        }

        const tag = rows[0];

        // Increment scan count and update timestamp
        await db.query(
            "UPDATE asset_safetags SET scanCount = scanCount + 1, lastScannedAt = NOW() WHERE id = ?",
            [tag.id]
        );

        // Sanitize owner name for privacy (e.g., "Sahil Y." or "Owner")
        const ownerNameParts = tag.ownerName.trim().split(/\s+/);
        const maskedOwner = ownerNameParts[0] + (ownerNameParts.length > 1 ? ` ${ownerNameParts[1][0]}.` : "");

        res.json({
            success: true,
            data: {
                tagCode: tag.tagCode,
                assetName: tag.assetName,
                category: tag.category,
                brand: tag.brand,
                color: tag.color,
                rewardAmount: tag.rewardAmount,
                emergencyNote: tag.emergencyNote,
                isLost: Boolean(tag.isLost),
                scanCount: tag.scanCount + 1,
                ownerDisplayName: maskedOwner
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= FINDER PINGS OWNER WITH GPS LOCATION =================
exports.finderPingOwner = async (req, res) => {
    try {
        const { tagCode } = req.params;
        const { latitude, longitude, finderMessage, contactHint } = req.body;

        const [rows] = await db.query("SELECT * FROM asset_safetags WHERE tagCode = ?", [tagCode]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "SafeTag not found." });
        }

        const tag = rows[0];

        if (latitude && longitude) {
            await db.query(
                "UPDATE asset_safetags SET lastScanLat = ?, lastScanLng = ?, lastScannedAt = NOW() WHERE id = ?",
                [parseFloat(latitude), parseFloat(longitude), tag.id]
            );
        }

        // Send High-Priority Notification to Owner
        const locationText = latitude && longitude ? ` Coordinates: (${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)})` : "";
        const messageText = finderMessage ? ` Message from Finder: "${finderMessage}".` : "";
        const contactText = contactHint ? ` Finder contact info: ${contactHint}.` : "";

        await notificationService.createAlert({
            userId: tag.userId,
            title: `📍 URGENT: Your SafeTag "${tag.assetName}" was just scanned!`,
            message: `A finder just scanned the SafeTag QR code for your ${tag.assetName}.${locationText}${messageText}${contactText}`
        });

        res.json({
            success: true,
            message: "🎉 The verified owner has been notified with your location ping! Thank you for being an honest finder."
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
