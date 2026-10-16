const db = require("../config/db");

// ================= DEPOSIT PRIVATE EVIDENCE IN VAULT =================

exports.depositVaultEvidence = async (req, res) => {
    try {
        const { itemId, serialNumber, invoiceNumber, hiddenMarks, privateNotes } = req.body;
        const ownerId = req.user.id;

        if (!itemId) {
            return res.status(400).json({ success: false, message: "Item ID is required." });
        }

        // Verify that user is owner or item has no userId yet (bind to user)
        const [items] = await db.query("SELECT * FROM items WHERE id = ?", [itemId]);
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: "Target item not found." });
        }

        const item = items[0];
        if (item.userId && item.userId !== ownerId && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Unauthorized: You are not the owner of this item." });
        }

        let receiptImages = [];
        if (req.files && req.files.length > 0) {
            receiptImages = req.files.map(f => `/uploads/misc/${f.filename}`);
        }

        // Check if vault record already exists for this item
        const [existing] = await db.query("SELECT id FROM ownership_vault WHERE itemId = ?", [itemId]);
        if (existing.length > 0) {
            await db.query(`
                UPDATE ownership_vault 
                SET serialNumber = COALESCE(?, serialNumber),
                    invoiceNumber = COALESCE(?, invoiceNumber),
                    receiptImages = COALESCE(?, receiptImages),
                    hiddenMarks = COALESCE(?, hiddenMarks),
                    privateNotes = COALESCE(?, privateNotes)
                WHERE itemId = ?
            `, [
                serialNumber || null,
                invoiceNumber || null,
                receiptImages.length > 0 ? JSON.stringify(receiptImages) : null,
                hiddenMarks || null,
                privateNotes || null,
                itemId
            ]);
            return res.json({ success: true, message: "Ownership vault record updated successfully." });
        } else {
            const [result] = await db.query(`
                INSERT INTO ownership_vault (itemId, ownerId, serialNumber, invoiceNumber, receiptImages, hiddenMarks, privateNotes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                itemId,
                ownerId,
                serialNumber || null,
                invoiceNumber || null,
                receiptImages.length > 0 ? JSON.stringify(receiptImages) : null,
                hiddenMarks || null,
                privateNotes || null
            ]);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
                VALUES (?, ?, 'VAULT_DEPOSIT', 'ITEM', ?, ?)
            `, [ownerId, req.user.role || 'user', itemId.toString(), JSON.stringify({ hasSerial: !!serialNumber, hasInvoice: !!invoiceNumber })]);

            return res.status(201).json({
                success: true,
                message: "Private ownership proof deposited into Vault.",
                vaultId: result.insertId
            });
        }
    } catch (err) {
        console.error("Vault Deposit Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= GET VAULT EVIDENCE (PROTECTED) =================

exports.getVaultEvidence = async (req, res) => {
    try {
        const { itemId } = req.params;
        const requesterId = req.user.id;
        const requesterRole = req.user.role;

        const [items] = await db.query("SELECT userId FROM items WHERE id = ?", [itemId]);
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const isOwner = items[0].userId === requesterId;
        const isAdmin = requesterRole === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "FORBIDDEN: Private ownership vault is only accessible by the owner or administrator." });
        }

        const [vault] = await db.query("SELECT * FROM ownership_vault WHERE itemId = ?", [itemId]);
        if (vault.length === 0) {
            return res.status(404).json({ success: false, message: "No private vault record exists for this item." });
        }

        res.json({
            success: true,
            data: vault[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
