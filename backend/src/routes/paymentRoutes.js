const express = require("express");

const { getReceivables, voidPayment } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { voidPaymentRules } = require("../validation/paymentRules");

// Recording and listing payments live on the order: see orderRoutes.js.

const paymentRouter = express.Router();
paymentRouter.use(protect);
// Voiding money already received is an Admin-only correction.
paymentRouter.patch("/:id/void", requirePermission("payments.void"), validate(voidPaymentRules), voidPayment);

const receivablesRouter = express.Router();
receivablesRouter.use(protect);
receivablesRouter.get("/", requirePermission("payments.view"), getReceivables);

module.exports = { paymentRouter, receivablesRouter };
