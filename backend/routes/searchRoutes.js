const express = require("express");
const router = express.Router();

const searchController = require("../controllers/searchController");

// Search items with filters
router.get("/", searchController.searchItems);

// Spatial Proximity Radius Search
router.get("/proximity", searchController.proximitySearch);

module.exports = router;