const db = require("../config/db");

// ================= GET ALL CASES FOR USER / ADMIN =================

exports.getAllCases = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let sql = `
            SELECT rc.*, 
                   i.itemName, i.category, i.status as itemStatus, i.images as itemImages,
                   uc.name as claimantName, uc.email as claimantEmail,
                   uf.name as custodianName, uf.email as custodianEmail
            FROM recovery_cases rc
            JOIN items i ON rc.itemId = i.id
            JOIN users uc ON rc.claimantId = uc.id
            LEFT JOIN users uf ON rc.custodianId = uf.id
        `;
        const params = [];

        if (role !== "admin") {
            sql += " WHERE rc.claimantId = ? OR rc.custodianId = ?";
            params.push(userId, userId);
        }

        sql += " ORDER BY rc.id DESC";

        const [cases] = await db.query(sql, params);
        res.json({
            success: true,
            count: cases.length,
            data: cases
        });
    } catch (err) {
        console.error("Get Cases Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= GET SINGLE CASE DETAILS =================

exports.getCaseByNumber = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const [cases] = await db.query(`
            SELECT rc.*, 
                   i.itemName, i.category, i.brand, i.color, i.status as itemStatus, i.images as itemImages, i.location, i.date as incidentDate,
                   uc.name as claimantName, uc.email as claimantEmail,
                   uf.name as custodianName, uf.email as custodianEmail,
                   c.proofDescription, c.evidenceImages, c.challengeQuestion, c.challengeVerified
            FROM recovery_cases rc
            JOIN items i ON rc.itemId = i.id
            JOIN users uc ON rc.claimantId = uc.id
            LEFT JOIN users uf ON rc.custodianId = uf.id
            LEFT JOIN claims c ON rc.claimId = c.id
            WHERE rc.caseNumber = ?
        `, [caseNumber]);

        if (cases.length === 0) {
            return res.status(404).json({ success: false, message: "Recovery case not found." });
        }

        const caseData = cases[0];
        if (role !== "admin" && caseData.claimantId !== userId && caseData.custodianId !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized access to recovery case." });
        }

        // Fetch audit trail for this case/item
        const [auditLogs] = await db.query(`
            SELECT * FROM audit_logs 
            WHERE (targetType = 'CLAIM' AND targetId = ?) OR (targetType = 'ITEM' AND targetId = ?)
            ORDER BY id ASC
        `, [caseData.claimId ? caseData.claimId.toString() : "-1", caseData.itemId.toString()]);

        res.json({
            success: true,
            data: caseData,
            timeline: auditLogs
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= UPDATE CASE STATUS =================

exports.updateCaseStatus = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const { status, note } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        const allowedStatuses = ['INITIATED', 'VERIFYING', 'CHALLENGE_ISSUED', 'VERIFIED', 'HANDOVER_PENDING', 'RECOVERED', 'CLOSED', 'DISPUTED'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}` });
        }

        const [cases] = await db.query("SELECT * FROM recovery_cases WHERE caseNumber = ?", [caseNumber]);
        if (cases.length === 0) {
            return res.status(404).json({ success: false, message: "Recovery case not found." });
        }

        const currentCase = cases[0];
        if (role !== "admin" && currentCase.custodianId !== userId && currentCase.claimantId !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized to update this recovery case." });
        }

        await db.query(`
            UPDATE recovery_cases 
            SET status = ?, closedAt = CASE WHEN ? IN ('RECOVERED', 'CLOSED') THEN NOW() ELSE closedAt END
            WHERE caseNumber = ?
        `, [status, status, caseNumber]);

        // Audit Log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'CASE_STATUS_UPDATE', 'CASE', ?, ?)
        `, [userId, role || 'user', caseNumber, JSON.stringify({ oldStatus: currentCase.status, newStatus: status, note: note || null })]);

        res.json({
            success: true,
            message: `Recovery case ${caseNumber} status updated to ${status}.`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
