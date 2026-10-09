const express = require("express");

const pricing = require("../controllers/pricingController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const STAFF = ["Admin", "Manager", "Employee"];
const WRITERS = ["Admin", "Manager"];

// Customer-specific routes (price list, contract prices) are mounted on the customers router.
const router = express.Router();
router.use(protect);

router.get("/price-lists", authorize(...STAFF), pricing.listPriceLists);
router.post("/price-lists", authorize(...WRITERS), pricing.createPriceList);
router.put("/price-lists/:id", authorize(...WRITERS), pricing.updatePriceList);
router.delete("/price-lists/:id", authorize(...WRITERS), pricing.deletePriceList);

router.get("/volume-discounts", authorize(...STAFF), pricing.listVolumeDiscounts);
router.post("/volume-discounts", authorize(...WRITERS), pricing.createVolumeDiscount);
router.put("/volume-discounts/:id", authorize(...WRITERS), pricing.updateVolumeDiscount);
router.delete("/volume-discounts/:id", authorize(...WRITERS), pricing.deleteVolumeDiscount);

router.get("/customer-prices", authorize(...STAFF), pricing.listCustomerPrices);
router.delete("/customer-prices/:id", authorize(...WRITERS), pricing.deleteCustomerPrice);

router.post("/preview", authorize(...STAFF), pricing.previewPrices);

function mountCustomerPricingRoutes(customerRouter) {
    customerRouter.patch("/:id/price-list", authorize(...WRITERS), pricing.setCustomerPriceList);
    customerRouter.put("/:id/prices", authorize(...WRITERS), pricing.setCustomerPrice);
}

module.exports = { mountCustomerPricingRoutes, pricingRouter: router };
