
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
const validate = require("../middleware/validate");
const { recordPaymentRules } = require("../validation/paymentRules");
const {
    getOrderPayments,
    recordPayment
} = require("../controllers/paymentController");
const {
    createOrderCreditNote,
    getOrderReturns
} = require("../controllers/creditNoteController");

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

router.get(
    "/:id/payments",
    authorize("Admin", "Manager", "Employee"),
    getOrderPayments
);

router.post(
    "/:id/payments",
    authorize("Admin", "Manager"),
    validate(recordPaymentRules),
    recordPayment
);

router.get(
    "/:id/credit-notes",
    authorize("Admin", "Manager", "Employee"),
    getOrderReturns
);

router.post(
    "/:id/credit-notes",
    authorize("Admin", "Manager"),
    createOrderCreditNote
);

module.exports = router;