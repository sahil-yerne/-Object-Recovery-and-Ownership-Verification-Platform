const express = require("express");
const router = express.Router();
const safeZoneController = require("../controllers/safeZoneController");

// Get verified safe drop-off hubs
router.get("/", safeZoneController.getSafeZones);

// Deposit item at a verified safe zone
router.post("/deposit", safeZoneController.depositItemAtSafeZone);

module.exports = router;
