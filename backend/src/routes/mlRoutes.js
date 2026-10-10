const express = require("express");

const { getCustomerRecommendations, getModels, getProductForecast } = require("../controllers/mlController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

// Model test results are management information; forecasts help anyone who
// plans stock, recommendations anyone who talks to customers.
const router = express.Router();
router.use(protect);
router.get("/models", requirePermission("reports.view"), getModels);
router.get("/forecasts/products/:id", requirePermission("inventory.view"), getProductForecast);
router.get("/recommendations/customers/:id", requirePermission("customers.view"), getCustomerRecommendations);

module.exports = router;
