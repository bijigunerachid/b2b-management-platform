
const express = require("express");
const router = express.Router();

const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

router.use(protect);

// Read products
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

// Create and update products
router.post(
    "/",
    authorize("Admin", "Manager"),
    createProduct
);

router.put(
    "/:id",
    authorize("Admin", "Manager"),
    updateProduct
);

// Delete products
router.delete(
    "/:id",
    authorize("Admin"),
    deleteProduct
);

module.exports = router;