
const express = require("express");
const router = express.Router();

const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const categoryRules = require("../validation/categoryRules");

router.use(protect);

// All authenticated roles can read categories
router.get(
    "/",
    requirePermission("products.view"),
    getCategories
);

router.get(
    "/:id",
    requirePermission("products.view"),
    getCategoryById
);

// Only Admin and Manager can manage categories
router.post(
    "/",
    requirePermission("products.write"),
    validate(categoryRules),
    createCategory
);

router.put(
    "/:id",
    requirePermission("products.write"),
    validate(categoryRules),
    updateCategory
);

// Only Admin can delete categories
router.delete(
    "/:id",
    requirePermission("products.delete"),
    deleteCategory
);

module.exports = router;