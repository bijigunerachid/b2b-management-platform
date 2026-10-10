
const express = require("express");
const router = express.Router();

const {
    getOrders,
    getOrderById,
    createOrder,
    updateOrderStatus
} = require("../controllers/orderController");

const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");
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

const { emailInvoice } = require("../controllers/emailController");

router.use(protect);

router.get(
    "/",
    requirePermission("orders.view"),
    getOrders
);

router.get(
    "/:id",
    requirePermission("orders.view"),
    getOrderById
);

router.post(
    "/",
    requirePermission("orders.write"),
    createOrder
);
router.post(
    "/:id/email",
    requirePermission("emails.send"),
    emailInvoice
);

router.patch(
    "/:id/status",
    requirePermission("orders.fulfil"),
    updateOrderStatus
);

router.get(
    "/:id/payments",
    requirePermission("payments.view"),
    getOrderPayments
);

router.post(
    "/:id/payments",
    requirePermission("payments.write"),
    validate(recordPaymentRules),
    recordPayment
);

router.get(
    "/:id/credit-notes",
    requirePermission("payments.view"),
    getOrderReturns
);

router.post(
    "/:id/credit-notes",
    requirePermission("returns.write"),
    createOrderCreditNote
);

module.exports = router;