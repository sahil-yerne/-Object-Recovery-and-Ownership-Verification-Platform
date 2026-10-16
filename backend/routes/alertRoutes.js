const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alertController");
const authMiddleware = require("../middleware/authMiddleware");

// All alert routes require authentication
router.use(authMiddleware);

router.get("/", alertController.getMyAlerts);
router.put("/:id/read", alertController.markAsRead);

module.exports = router;
