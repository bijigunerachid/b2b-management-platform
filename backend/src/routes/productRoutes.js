
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
const validate = require("../middleware/validate");

const productRules = [
    {
        field: "name",
        required: true,
        type: "string",
        minLength: 2
    },
    {
        field: "price",
        required: true,
        type: "number",
        min: 0
    },
    {
        field: "stock",
        required: true,
        type: "number",
        min: 0
    },
    {
        field: "category_id",
        required: true,
        type: "number",
        min: 1
    }
];

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
    validate(productRules),
    updateProduct
);

router.delete(
    "/:id",
    authorize("Admin"),
    deleteProduct
);

module.exports = router;