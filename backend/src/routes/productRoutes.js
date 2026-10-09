
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
const { authorize } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");

const productRules = require("../validation/productRules");
const { productUpdateRules } = productRules;

router.use(protect);

router.get(
    "/",
    authorize("Admin", "Manager", "Employee"),
    getProducts
);

router.get(
    "/:id",
    authorize("Admin", "Manager", "Employee"),
    getProductById
);

router.post(
    "/",
    authorize("Admin", "Manager"),
    validate(productRules),
    createProduct
);

router.put(
    "/:id",
    authorize("Admin", "Manager"),
    validate(productUpdateRules),
    updateProduct
);

// Stock corrections with a reason, recorded in the ledger.
router.post(
    "/:id/adjustments",
    authorize("Admin", "Manager"),
    adjustStock
);

router.delete(
    "/:id",
    authorize("Admin"),
    deleteProduct
);

module.exports = router;