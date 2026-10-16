const express = require("express");
const router = express.Router();

const itemController = require("../controllers/itemController");
const upload = require("../middleware/upload");
const { reportLimiter } = require("../middleware/rateLimiter");

const authMiddleware = require("../middleware/authMiddleware");

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authMiddleware(req, res, next);
    }
    next();
};

// ================= CREATE LOST ITEM =================
router.post("/lost", reportLimiter, optionalAuth, upload.array("images", 5), itemController.createLostItem);

// ================= CREATE FOUND ITEM =================
router.post("/found", reportLimiter, optionalAuth, upload.array("images", 5), itemController.createFoundItem);

// ================= GET ALL ITEMS =================
router.get("/items", itemController.getAllItems);

// ================= GET SINGLE ITEM BY ID =================
router.get("/item/:id", itemController.getItemById);

// ================= VERIFY OWNERSHIP QUIZ =================
router.post("/item/:id/verify-quiz", itemController.verifyOwnershipQuiz);

// ================= DELETE ITEM BY ID (Protected) =================
router.delete("/item/:id", authMiddleware, itemController.deleteItem);

module.exports = router;