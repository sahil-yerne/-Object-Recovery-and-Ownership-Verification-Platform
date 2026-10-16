const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const caseController = require("../controllers/caseController");

// Get all cases (user's or all if admin)
router.get("/", authMiddleware, caseController.getAllCases);

// Get single case details & timeline
router.get("/:caseNumber", authMiddleware, caseController.getCaseByNumber);

// Update case status
router.patch("/:caseNumber/status", authMiddleware, caseController.updateCaseStatus);

module.exports = router;
