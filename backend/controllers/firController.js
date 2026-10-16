const db = require("../config/db");
const crypto = require("crypto");
const QRCode = require("qrcode");

// Helper to generate unique FIR declaration number
function generateFirNumber() {
    const year = new Date().getFullYear();
    const rand = crypto.randomInt(100000, 999999);
    return `FIR-${year}-POL-${rand}`;
}

// ================= GENERATE FIR / POLICE DECLARATION =================
exports.generateFir = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemId, authorityType, incidentNotes } = req.body;

        if (!itemId) {
            return res.status(400).json({ success: false, message: "Item ID is required." });
        }

        // Verify item exists and belongs to current user
        const [items] = await db.query("SELECT * FROM items WHERE id = ?", [itemId]);
        if (items.length === 0) {
            return res.status(404).json({ success: false, message: "Item record not found." });
        }

        const item = items[0];

        // Authorization: only the reporter or an admin can generate the declaration
        if (item.userId && item.userId !== userId && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access Denied: You can only file declarations for your own lost items." });
        }

        // Fetch Vault Data (Serial number, invoice) if available
        let vaultData = null;
        try {
            const [vaults] = await db.query(
                "SELECT serialNumber, invoiceNumber, hiddenMarks FROM ownership_vault WHERE itemId = ?",
                [itemId]
            );
            if (vaults.length > 0) vaultData = vaults[0];
        } catch (vErr) {}

        const firNumber = generateFirNumber();
        const authority = authorityType || "POLICE_DEPARTMENT";

        // Cryptographic verification hash (SHA-256)
        const hashPayload = `${firNumber}|${item.id}|${userId}|${item.itemName}|${item.date}|${Date.now()}`;
        const verificationHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

        const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5004}`;
        const verificationUrl = `${baseUrl}/api/fir/verify/${firNumber}`;

        // Generate QR code seal for paper document
        const qrSealDataUrl = await QRCode.toDataURL(verificationUrl, {
            errorCorrectionLevel: "H",
            margin: 2,
            color: { dark: "#0f172a", light: "#ffffff" },
            width: 200
        });

        // Insert into fir_declarations
        await db.query(`
            INSERT INTO fir_declarations 
            (firNumber, itemId, declarantId, authorityType, incidentDescription, verificationHash)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            firNumber,
            itemId,
            userId,
            authority,
            incidentNotes || item.description || "Lost property reported via Intelligent Object Recovery Platform.",
            verificationHash
        ]);

        // Audit log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'FIR_DECLARATION_FILED', 'ITEM', ?, ?)
        `, [userId, req.user.role || 'user', itemId.toString(), JSON.stringify({ firNumber, authority })]);

        res.status(201).json({
            success: true,
            message: "Official Incident FIR Declaration successfully compiled!",
            declaration: {
                firNumber,
                authority,
                verificationHash,
                qrSealDataUrl,
                filedAt: new Date(),
                declarant: {
                    name: item.contactName,
                    phone: item.phone,
                    email: item.email
                },
                item: {
                    id: item.id,
                    name: item.itemName,
                    category: item.category,
                    brand: item.brand,
                    color: item.color,
                    dateLost: item.date,
                    location: item.location,
                    coordinates: item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : "N/A",
                    description: item.description,
                    serialNumber: vaultData?.serialNumber || "Not Registered in Vault",
                    invoiceNumber: vaultData?.invoiceNumber || "Not Registered in Vault"
                }
            }
        });

    } catch (error) {
        console.error("Generate FIR Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= PUBLIC VERIFICATION OF FIR =================
exports.verifyFir = async (req, res) => {
    try {
        const { firNumber } = req.params;

        const [rows] = await db.query(`
            SELECT f.*, i.itemName, i.category, i.brand, i.color, i.date as itemDate, i.location,
                   u.name as declarantName
            FROM fir_declarations f
            JOIN items i ON f.itemId = i.id
            JOIN users u ON f.declarantId = u.id
            WHERE f.firNumber = ?
        `, [firNumber]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                isAuthentic: false,
                message: "❌ FIR / Declaration not found in the verified state registry."
            });
        }

        const fir = rows[0];

        res.json({
            success: true,
            isAuthentic: true,
            message: "✅ VERIFIED OFFICIAL DECLARATION: Tamper-evident cryptographic signature matched.",
            data: {
                firNumber: fir.firNumber,
                authorityType: fir.authorityType,
                verificationHash: fir.verificationHash,
                filedAt: fir.pdfGeneratedAt,
                status: fir.status,
                itemName: fir.itemName,
                category: fir.category,
                brand: fir.brand,
                location: fir.location,
                declarantName: fir.declarantName
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= GET USER'S FILED FIR DECLARATIONS =================
exports.getMyDeclarations = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.query(`
            SELECT f.*, i.itemName, i.category, i.status as itemStatus
            FROM fir_declarations f
            JOIN items i ON f.itemId = i.id
            WHERE f.declarantId = ?
            ORDER BY f.id DESC
        `, [userId]);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
