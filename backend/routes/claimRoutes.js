const express = require("express");
const router = express.Router();
const claimController = require("../controllers/claimController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

// Submit a claim with optional evidence files (Protected)
router.post("/submit", authMiddleware, upload.array("evidence", 5), claimController.submitClaim);

// Get claims for an item
router.get("/item/:itemId", claimController.getItemClaims);

// Approve a claim & generate OTP (Protected)
router.post("/approve", authMiddleware, claimController.approveClaim);

// Reject a claim (Protected)
router.post("/reject", authMiddleware, claimController.rejectClaim);

// Issue an ownership challenge (Protected)
router.post("/challenge", authMiddleware, claimController.issueChallenge);

// Verify an ownership challenge answer (Protected)
router.post("/challenge/verify", authMiddleware, claimController.verifyChallenge);

// Verify Handover OTP & claim 200 points (Protected)
router.post("/verify-otp", authMiddleware, claimController.verifyHandoverOtp);

module.exports = router;
