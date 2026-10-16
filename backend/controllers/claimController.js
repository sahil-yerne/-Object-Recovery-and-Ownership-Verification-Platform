const claimModel = require("../models/claimModel");
const pointModel = require("../models/pointModel");
const itemModel = require("../models/itemModel");
const notificationService = require("../services/notificationService");
const { checkAndAwardAchievements } = require("../services/aiService");
const db = require("../config/db");
const crypto = require("crypto");

// Helper to generate a cryptographically secure 6-digit OTP
function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

// OTP validity window in minutes
const OTP_EXPIRY_MINUTES = 15;

// Helper to generate unique Recovery Case Number (crypto-secure)
function generateCaseNumber() {
    const year = new Date().getFullYear();
    const rand = crypto.randomInt(10000, 99999);
    return `REC-${year}-${rand}`;
}

// ================= SUBMIT CLAIM =================
exports.submitClaim = async (req, res) => {
    try {
        const { itemId, proofDescription } = req.body;
        const claimantId = req.user.id; // From authMiddleware

        if (!itemId || !proofDescription) {
            return res.status(400).json({ success: false, message: "Item ID and proof description are required." });
        }

        // Verify item exists
        const [items] = await itemModel.getItemById(itemId);
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const targetItem = items[0];
        if (targetItem.userId && targetItem.userId === claimantId) {
            return res.status(400).json({ success: false, message: "You cannot submit a claim for an item you posted." });
        }

        // --- FRAUD & RISK ANALYSIS ---
        let riskScore = 0;
        let riskState = "NORMAL";
        const riskFlags = [];

        // 1. Check claim velocity in last 24h
        const [recentClaims] = await db.query(
            "SELECT COUNT(*) as cnt FROM claims WHERE claimantId = ? AND createdAt >= NOW() - INTERVAL 1 DAY",
            [claimantId]
        );
        if (recentClaims[0].cnt >= 3) {
            riskScore += 40;
            riskFlags.push("High claim frequency: >3 claims in 24 hours");
        }

        // 2. Check multiple claims on this same item
        const [itemClaims] = await db.query(
            "SELECT COUNT(*) as cnt FROM claims WHERE itemId = ?",
            [itemId]
        );
        if (itemClaims[0].cnt >= 2) {
            riskScore += 25;
            riskFlags.push("Multiple competing claims filed on same item");
        }

        if (riskScore >= 50) riskState = "SUSPICIOUS";
        else if (riskScore >= 25) riskState = "REVIEW_REQUIRED";

        // Handle uploaded evidence files
        let evidenceImages = [];
        if (req.files && req.files.length > 0) {
            evidenceImages = req.files.map(file => `/uploads/claims/${file.filename}`);
        }

        const [result] = await db.query(`
            INSERT INTO claims (itemId, claimantId, proofDescription, evidenceImages, status, riskScore, riskState)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `, [
            itemId,
            claimantId,
            proofDescription,
            evidenceImages.length > 0 ? JSON.stringify(evidenceImages) : null,
            riskScore,
            riskState
        ]);

        const claimId = result.insertId;

        // Create Central Recovery Case
        const caseNumber = generateCaseNumber();
        await db.query(`
            INSERT INTO recovery_cases (caseNumber, itemId, claimantId, custodianId, claimId, status, riskLevel)
            VALUES (?, ?, ?, ?, ?, 'INITIATED', ?)
        `, [caseNumber, itemId, claimantId, targetItem.userId || null, claimId, riskState]);

        // Log risk flags if any
        if (riskFlags.length > 0) {
            await db.query(`
                INSERT INTO fraud_risk_logs (itemId, userId, riskLevel, flags, score, details)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [itemId, claimantId, riskState, JSON.stringify(riskFlags), riskScore, `Claim ${claimId} flagged with ${riskState} state`]);
        }

        // Audit Log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'CLAIM_SUBMISSION', 'CLAIM', ?, ?)
        `, [claimantId, req.user.role || 'user', claimId.toString(), JSON.stringify({ itemId, caseNumber, riskState })]);

        // Notify item custodian
        if (targetItem.userId) {
            await notificationService.createAlert({
                userId: targetItem.userId,
                title: "New Ownership Claim Received 📋",
                message: `A user filed an ownership claim (${caseNumber}) for your posted item: "${targetItem.itemName}". Please review the proof in your Item Details page.`
            });
        }

        res.status(201).json({
            success: true,
            message: "Claim submitted successfully! The finder will review your ownership proof.",
            claimId,
            caseNumber,
            riskState,
            evidenceImages
        });
    } catch (error) {
        console.error("Submit Claim Error:", error);
        res.status(500).json({ success: false, message: "Server error submitting claim." });
    }
};

// ================= ISSUE OWNERSHIP CHALLENGE =================
exports.issueChallenge = async (req, res) => {
    try {
        const { claimId, challengeQuestion, challengeAnswer } = req.body;
        const currentUserId = req.user.id;

        if (!claimId || !challengeQuestion) {
            return res.status(400).json({ success: false, message: "Claim ID and Challenge Question are required." });
        }

        const claim = await claimModel.getClaimById(claimId);
        if (!claim) {
            return res.status(404).json({ success: false, message: "Claim not found." });
        }

        if (claim.finderUserId && claim.finderUserId !== currentUserId && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Unauthorized: Only the item custodian or admin can issue challenges." });
        }

        await db.query(`
            UPDATE claims 
            SET challengeQuestion = ?, challengeAnswer = ?, challengeVerified = FALSE
            WHERE id = ?
        `, [challengeQuestion, challengeAnswer || null, claimId]);

        await db.query(`
            UPDATE recovery_cases 
            SET status = 'CHALLENGE_ISSUED' 
            WHERE claimId = ?
        `, [claimId]);

        // Audit Log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'CHALLENGE_ISSUED', 'CLAIM', ?, ?)
        `, [currentUserId, req.user.role || 'user', claimId.toString(), JSON.stringify({ challengeQuestion })]);

        // Alert Claimant
        await notificationService.createAlert({
            userId: claim.claimantId,
            title: "Ownership Verification Challenge Issued 🛡️",
            message: `The custodian has asked an ownership challenge question for "${claim.itemName}": "${challengeQuestion}". Please answer in the portal to verify.`
        });

        res.json({
            success: true,
            message: "Ownership challenge question issued to claimant."
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= VERIFY OWNERSHIP CHALLENGE =================
exports.verifyChallenge = async (req, res) => {
    try {
        const { claimId, answer } = req.body;
        const currentUserId = req.user.id;

        if (!claimId || !answer) {
            return res.status(400).json({ success: false, message: "Claim ID and Answer are required." });
        }

        const [claimRows] = await db.query("SELECT * FROM claims WHERE id = ?", [claimId]);
        if (claimRows.length === 0) {
            return res.status(404).json({ success: false, message: "Claim not found." });
        }

        const claim = claimRows[0];
        if (claim.claimantId !== currentUserId && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Unauthorized: Only the claimant can answer this challenge." });
        }

        const targetAnswer = claim.challengeAnswer;
        const isMatch = targetAnswer ? targetAnswer.trim().toLowerCase() === answer.trim().toLowerCase() : true;

        if (isMatch) {
            await db.query("UPDATE claims SET challengeVerified = TRUE WHERE id = ?", [claimId]);
            await db.query("UPDATE recovery_cases SET status = 'VERIFIED' WHERE claimId = ?", [claimId]);

            await db.query(`
                INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
                VALUES (?, ?, 'CHALLENGE_VERIFIED', 'CLAIM', ?, ?)
            `, [currentUserId, req.user.role || 'user', claimId.toString(), JSON.stringify({ verified: true })]);

            return res.json({
                success: true,
                message: "Challenge answer verified successfully! Ownership verification confirmed."
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Incorrect challenge answer. Ownership verification failed."
            });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= GET CLAIMS FOR AN ITEM =================
exports.getItemClaims = async (req, res) => {
    try {
        const { itemId } = req.params;
        const claims = await claimModel.getClaimsByItemId(itemId);
        res.json({ success: true, claims });
    } catch (error) {
        console.error("Get Item Claims Error:", error);
        res.status(500).json({ success: false, message: "Server error getting claims." });
    }
};

// ================= APPROVE CLAIM & GENERATE OTP =================
exports.approveClaim = async (req, res) => {
    try {
        const { claimId } = req.body;
        const currentUserId = req.user.id;
        const userRole = req.user.role;

        if (!claimId) {
            return res.status(400).json({ success: false, message: "Claim ID is required." });
        }

        const claim = await claimModel.getClaimById(claimId);
        if (!claim) {
            return res.status(404).json({ success: false, message: "Claim not found." });
        }

        // Authorization check: Only the finder who posted the item or an admin can approve
        if (claim.finderUserId && claim.finderUserId !== currentUserId && userRole !== "admin") {
            return res.status(403).json({ 
                success: false, 
                message: "Access Denied: Only the finder who reported this item can approve ownership claims." 
            });
        }

        if (claim.status === 'returned') {
            return res.status(400).json({ success: false, message: "This item has already been marked as returned." });
        }

        const otp = generateOtp();
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        await claimModel.approveClaim(claimId, otp, currentUserId);

        // Update Recovery Case status with OTP and expiration
        await db.query(`
            UPDATE recovery_cases 
            SET status = 'HANDOVER_PENDING', handoverOtp = ?, otpExpiresAt = ?
            WHERE claimId = ?
        `, [otp, otpExpiresAt, claimId]);

        // Also store expiration on the claim record
        await db.query(`UPDATE claims SET otpExpiresAt = ? WHERE id = ?`, [otpExpiresAt, claimId]);

        // Audit Log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'CLAIM_APPROVAL', 'CLAIM', ?, ?)
        `, [currentUserId, userRole || 'user', claimId.toString(), JSON.stringify({ claimantId: claim.claimantId })]);

        // Notify Claimant with OTP
        await notificationService.createAlert({
            userId: claim.claimantId,
            title: "Ownership Claim Approved! 🎉",
            message: `Your claim for "${claim.itemName}" was approved! Your Handover OTP is: ${otp}. Please provide this OTP to the finder during physical pickup.`
        });

        res.json({
            success: true,
            message: "Claim approved! A 6-digit Handover OTP has been generated for verification during return.",
            handoverOtp: otp
        });
    } catch (error) {
        console.error("Approve Claim Error:", error);
        res.status(500).json({ success: false, message: "Server error approving claim." });
    }
};

// ================= REJECT CLAIM =================
exports.rejectClaim = async (req, res) => {
    try {
        const { claimId, reason } = req.body;
        const currentUserId = req.user.id;
        const userRole = req.user.role;

        if (!claimId) {
            return res.status(400).json({ success: false, message: "Claim ID is required." });
        }

        const claim = await claimModel.getClaimById(claimId);
        if (!claim) {
            return res.status(404).json({ success: false, message: "Claim not found." });
        }

        // Authorization check
        if (claim.finderUserId && claim.finderUserId !== currentUserId && userRole !== "admin") {
            return res.status(403).json({ 
                success: false, 
                message: "Access Denied: Only the finder who reported this item can reject ownership claims." 
            });
        }

        await claimModel.rejectClaim(claimId, reason || "Insufficient proof of ownership.", currentUserId);

        await db.query(`
            UPDATE recovery_cases 
            SET status = 'DISPUTED' 
            WHERE claimId = ?
        `, [claimId]);

        // Audit Log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'CLAIM_REJECTION', 'CLAIM', ?, ?)
        `, [currentUserId, userRole || 'user', claimId.toString(), JSON.stringify({ reason })]);

        // Notify Claimant of rejection
        await notificationService.createAlert({
            userId: claim.claimantId,
            title: "Ownership Claim Rejected ⚠️",
            message: `Your claim for "${claim.itemName}" was not approved. Reason: ${reason || "Proof did not match item characteristics."}`
        });

        res.json({
            success: true,
            message: "Claim rejected successfully."
        });
    } catch (error) {
        console.error("Reject Claim Error:", error);
        res.status(500).json({ success: false, message: "Server error rejecting claim." });
    }
};

// ================= VERIFY HANDOVER OTP & AWARD 200 POINTS =================
exports.verifyHandoverOtp = async (req, res) => {
    try {
        const { claimId, otp } = req.body;
        const currentUserId = req.user.id;
        const userRole = req.user.role;

        if (!claimId || !otp) {
            return res.status(400).json({ success: false, message: "Claim ID and OTP are required." });
        }

        const claim = await claimModel.getClaimById(claimId);
        if (!claim) {
            return res.status(404).json({ success: false, message: "Claim not found." });
        }

        // Authorization check: Only the finder or admin should verify the OTP and claim points
        if (claim.finderUserId && claim.finderUserId !== currentUserId && userRole !== "admin") {
            return res.status(403).json({ 
                success: false, 
                message: "Access Denied: Only the finder who possesses this item can verify the handover OTP." 
            });
        }

        if (claim.status === 'returned') {
            return res.status(400).json({ success: false, message: "This item has already been marked as returned." });
        }

        if (claim.status !== 'approved' || !claim.handoverOtp) {
            return res.status(400).json({ success: false, message: "This claim has not been approved yet." });
        }

        // Check OTP expiration
        if (claim.otpExpiresAt && new Date() > new Date(claim.otpExpiresAt)) {
            return res.status(400).json({
                success: false,
                message: `Handover OTP has expired (valid for ${OTP_EXPIRY_MINUTES} minutes). Please request the claim to be re-approved.`
            });
        }

        if (claim.handoverOtp !== otp.trim()) {
            return res.status(400).json({ success: false, message: "Invalid OTP code. Please verify with the owner." });
        }

        // Complete handover
        await claimModel.completeHandover(claimId);

        // Update recovery case
        await db.query(`
            UPDATE recovery_cases 
            SET status = 'RECOVERED', closedAt = NOW() 
            WHERE claimId = ?
        `, [claimId]);

        // Award +200 Points to the Finder (current user)
        const rewardResult = await pointModel.addPoints(
            currentUserId, 
            200, 
            `Verified Return of item '${claim.itemName}'`
        );

        // Audit Log
        await db.query(`
            INSERT INTO audit_logs (actorId, role, action, targetType, targetId, details)
            VALUES (?, ?, 'HANDOVER_COMPLETED', 'CLAIM', ?, ?)
        `, [currentUserId, userRole || 'user', claimId.toString(), JSON.stringify({ pointsAwarded: 200 })]);

        // Notify both parties of successful return
        await notificationService.createAlert({
            userId: currentUserId,
            title: "Item Handover Completed! 🏆 (+200 Points)",
            message: `Congratulations! You successfully verified the return of "${claim.itemName}" and earned +200 Trust Points!`
        });

        await notificationService.createAlert({
            userId: claim.claimantId,
            title: "Item Recovery Verified! 🌟",
            message: `Your item "${claim.itemName}" has been officially confirmed as returned! Thank you for using Lost & Found Portal.`
        });

        // Check and award any new achievements to the finder
        let unlockedAchievements = [];
        try {
            unlockedAchievements = await checkAndAwardAchievements(db, currentUserId);
            for (const ach of unlockedAchievements) {
                await notificationService.createAlert({
                    userId: currentUserId,
                    title: `🎖️ Milestone Unlocked: ${ach.name}!`,
                    message: `Congratulations! You unlocked the "${ach.name}" badge: ${ach.description}.`
                });
            }
        } catch (achErr) {
            console.warn("Handover achievement check error:", achErr.message);
        }

        res.json({
            success: true,
            message: "🎉 Item Handover Verified! You earned +200 Points and boosted your Trust Score!",
            pointsAwarded: 200,
            totalPoints: rewardResult.newPoints,
            badge: rewardResult.newBadge,
            trustScore: rewardResult.newTrustScore,
            newAchievements: unlockedAchievements
        });

    } catch (error) {
        console.error("Verify Handover Error:", error);
        res.status(500).json({ success: false, message: "Server error verifying handover." });
    }
};
