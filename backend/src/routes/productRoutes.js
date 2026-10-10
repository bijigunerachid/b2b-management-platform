
const express = require("express");
const router = express.Router();

const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock
} = require("../controllers/productController");

const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");

const productRules = require("../validation/productRules");
const { productUpdateRules } = productRules;

router.use(protect);

router.get(
    "/",
    requirePermission("products.view"),
    getProducts
);

router.get(
    "/:id",
    requirePermission("products.view"),
    getProductById
);

router.post(
    "/",
    requirePermission("products.write"),
    validate(productRules),
    createProduct
);

router.put(
    "/:id",
    requirePermission("products.write"),
    validate(productUpdateRules),
    updateProduct
);

// Stock corrections with a reason, recorded in the ledger.
router.post(
    "/:id/adjustments",
    requirePermission("inventory.adjust"),
    adjustStock
);

router.delete(
    "/:id",
    requirePermission("products.delete"),
    deleteProduct
);

module.exports = router;