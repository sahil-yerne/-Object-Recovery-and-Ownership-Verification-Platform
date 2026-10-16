const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

// Public: List organizations
router.get("/", organizationController.getOrganizations);

// Public: Single organization details & scoped stats
router.get("/:idOrSlug", organizationController.getOrganizationByIdOrSlug);

// Public/Auth: Items belonging to an organization
router.get("/:id/items", organizationController.getOrganizationItems);

// Protected: Join organization
router.post("/:id/join", authMiddleware, organizationController.joinOrganization);

// Protected: Create new organization (Platform Admin)
router.post("/", authMiddleware, requireAdmin, organizationController.createOrganization);

module.exports = router;
