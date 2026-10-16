const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiter");

// ================= AUTH ROUTES =================

// POST /api/auth/register
router.post("/register", authLimiter, authController.register);

// POST /api/auth/login
router.post("/login", authLimiter, authController.login);

// GET /api/auth/me (Protected - requires JWT)
router.get("/me", authMiddleware, authController.getMe);

module.exports = router;

