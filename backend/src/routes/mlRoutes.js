const express = require("express");

const { getModels, getProductForecast } = require("../controllers/mlController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

// Model test results are management information; forecasts help anyone who
// plans stock.
const router = express.Router();
router.use(protect);
router.get("/models", requirePermission("reports.view"), getModels);
router.get("/forecasts/products/:id", requirePermission("inventory.view"), getProductForecast);

module.exports = router;
