const express = require("express");
const router = express.Router();
const firController = require("../controllers/firController");
const authMiddleware = require("../middleware/authMiddleware");

// Public: Verify an FIR document by scanning its QR seal
router.get("/verify/:firNumber", firController.verifyFir);

// Protected: Get list of user's filed FIRs
router.get("/my-declarations", authMiddleware, firController.getMyDeclarations);

// Protected: Generate official FIR declaration for an item
router.post("/generate", authMiddleware, firController.generateFir);

module.exports = router;
