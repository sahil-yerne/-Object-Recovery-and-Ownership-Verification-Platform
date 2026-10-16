const db = require("../config/db");

// ================= CREATE CLAIM =================
exports.createClaim = async (data) => {
    const sql = `
        INSERT INTO claims (itemId, claimantId, proofDescription, evidenceImages, status)
        VALUES (?, ?, ?, ?, 'pending')
    `;
    const values = [
        data.itemId, 
        data.claimantId, 
        data.proofDescription,
        data.evidenceImages ? JSON.stringify(data.evidenceImages) : null
    ];
    return await db.query(sql, values);
};

// ================= GET CLAIMS BY ITEM =================
exports.getClaimsByItemId = async (itemId) => {
    const sql = `
        SELECT c.*, u.name as claimantName, u.email as claimantEmail, u.phone as claimantPhone, u.trustScore as claimantTrustScore
        FROM claims c
        JOIN users u ON c.claimantId = u.id
        WHERE c.itemId = ?
        ORDER BY c.id DESC
    `;
    const [rows] = await db.query(sql, [itemId]);
    return rows;
};

// ================= GET CLAIMS BY USER (Claimant) =================
exports.getClaimsByUserId = async (userId) => {
    const sql = `
        SELECT c.*, i.itemName, i.category, i.status as itemStatus, i.images, i.location
        FROM claims c
        JOIN items i ON c.itemId = i.id
        WHERE c.claimantId = ?
        ORDER BY c.id DESC
    `;
    const [rows] = await db.query(sql, [userId]);
    return rows;
};

// ================= GET CLAIM BY ID =================
exports.getClaimById = async (claimId) => {
    const sql = `
        SELECT c.*, i.itemName, i.category, i.status as itemStatus, i.userId as finderUserId, i.contactName, i.email as finderEmail, i.phone as finderPhone
        FROM claims c
        JOIN items i ON c.itemId = i.id
        WHERE c.id = ?
    `;
    const [rows] = await db.query(sql, [claimId]);
    return rows[0];
};

// ================= APPROVE CLAIM & GENERATE OTP =================
exports.approveClaim = async (claimId, handoverOtp, reviewedBy = null) => {
    const sql = `UPDATE claims SET status = 'approved', handoverOtp = ?, reviewedBy = ? WHERE id = ?`;
    return await db.query(sql, [handoverOtp, reviewedBy, claimId]);
};

// ================= REJECT CLAIM =================
exports.rejectClaim = async (claimId, reason = null, reviewedBy = null) => {
    const sql = `UPDATE claims SET status = 'rejected', adminNotes = ?, reviewedBy = ? WHERE id = ?`;
    return await db.query(sql, [reason, reviewedBy, claimId]);
};

// ================= COMPLETE HANDOVER (Status -> returned) =================
exports.completeHandover = async (claimId) => {
    const [claimRows] = await db.query("SELECT itemId FROM claims WHERE id = ?", [claimId]);
    if (claimRows && claimRows.length > 0) {
        await db.query("UPDATE items SET status = 'returned' WHERE id = ?", [claimRows[0].itemId]);
    }
    const sql = `UPDATE claims SET status = 'returned' WHERE id = ?`;
    return await db.query(sql, [claimId]);
};

