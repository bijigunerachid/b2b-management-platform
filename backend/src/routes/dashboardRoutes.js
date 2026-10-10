
const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

router.get("/stats", protect, requirePermission("dashboard.view"), getDashboardStats);

module.exports = router;