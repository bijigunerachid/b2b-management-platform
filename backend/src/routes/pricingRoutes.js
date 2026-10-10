const express = require("express");

const pricing = require("../controllers/pricingController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

// Customer-specific routes (price list, contract prices) are mounted on the customers router.
const router = express.Router();
router.use(protect);

router.get("/price-lists", requirePermission("pricing.view"), pricing.listPriceLists);
router.post("/price-lists", requirePermission("pricing.write"), pricing.createPriceList);
router.put("/price-lists/:id", requirePermission("pricing.write"), pricing.updatePriceList);
router.delete("/price-lists/:id", requirePermission("pricing.write"), pricing.deletePriceList);

router.get("/volume-discounts", requirePermission("pricing.view"), pricing.listVolumeDiscounts);
router.post("/volume-discounts", requirePermission("pricing.write"), pricing.createVolumeDiscount);
router.put("/volume-discounts/:id", requirePermission("pricing.write"), pricing.updateVolumeDiscount);
router.delete("/volume-discounts/:id", requirePermission("pricing.write"), pricing.deleteVolumeDiscount);

router.get("/customer-prices", requirePermission("pricing.view"), pricing.listCustomerPrices);
router.delete("/customer-prices/:id", requirePermission("pricing.write"), pricing.deleteCustomerPrice);

router.post("/preview", requirePermission("orders.view"), pricing.previewPrices);

function mountCustomerPricingRoutes(customerRouter) {
    customerRouter.patch("/:id/price-list", requirePermission("pricing.write"), pricing.setCustomerPriceList);
    customerRouter.put("/:id/prices", requirePermission("pricing.write"), pricing.setCustomerPrice);
}

module.exports = { mountCustomerPricingRoutes, pricingRouter: router };
