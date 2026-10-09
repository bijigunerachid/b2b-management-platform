
const express = require("express");
const router = express.Router();

const {
    getOrders,
    getOrderById,
    createOrder,
    updateOrderStatus
} = require("../controllers/orderController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

router.use(protect);

router.get(
    "/",
    authorize("Admin", "Manager", "Employee"),
    getOrders
);

router.get(
    "/:id",
    authorize("Admin", "Manager", "Employee"),
    getOrderById
);

router.post(
    "/",
    authorize("Admin", "Manager"),
    createOrder
);
router.patch(
    "/:id/status",
    authorize("Admin", "Manager"),
    updateOrderStatus
);

module.exports = router;