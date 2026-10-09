
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
const { authorize } = require("../middleware/roleMiddleware");

router.use(protect);

// All authenticated roles can read categories
router.get(
    "/",
    authorize("Admin", "Manager", "Employee"),
    getCategories
);

router.get(
    "/:id",
    authorize("Admin", "Manager", "Employee"),
    getCategoryById
);

// Only Admin and Manager can manage categories
router.post(
    "/",
    authorize("Admin", "Manager"),
    createCategory
);

router.put(
    "/:id",
    authorize("Admin", "Manager"),
    updateCategory
);

// Only Admin can delete categories
router.delete(
    "/:id",
    authorize("Admin"),
    deleteCategory
);

module.exports = router;