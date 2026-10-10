const express = require("express");

const { protect, protectCustomer } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const portal = require("../controllers/portalController");
const access = require("../controllers/portalAccessController");

/* Customer-facing: /api/portal/* (Customer accounts only) */
const portalRouter = express.Router();
portalRouter.use(protectCustomer);
portalRouter.get("/summary", portal.getSummary);
portalRouter.get("/catalog", portal.getCatalog);
portalRouter.post("/cart/price", portal.priceCart);
portalRouter.get("/orders", portal.listOrders);
portalRouter.get("/orders/:id", portal.getOrder);
portalRouter.post("/orders", portal.placePortalOrder);
portalRouter.get("/credit-notes/:id", portal.getCreditNote);
portalRouter.get("/quotes", portal.listQuotes);
portalRouter.get("/quotes/:id", portal.getQuote);
portalRouter.post("/quotes/:id/accept", portal.acceptQuote);
portalRouter.post("/quotes/:id/reject", portal.rejectQuote);

/* Staff-side access management (Admin/Manager) */
const inviteRules = [
    { field: "first_name", required: true, type: "string", minLength: 1, maxLength: 100 },
    { field: "last_name", required: true, type: "string", minLength: 1, maxLength: 100 },
    { field: "email", required: true, type: "email", maxLength: 255 }
];

// Mounted inside the customers router (already authenticated as staff).
function mountCustomerAccessRoutes(customerRouter) {
    customerRouter.get("/:id/portal-users", requirePermission("customers.view"), access.listPortalUsers);
    customerRouter.post("/:id/portal-users", requirePermission("portal.manage"), validate(inviteRules), access.invitePortalUser);
}

/* /api/portal-users/:id/status */
const portalUserRouter = express.Router();
portalUserRouter.use(protect);
portalUserRouter.patch(
    "/:id/status",
    requirePermission("portal.manage"),
    validate([{ field: "is_active", required: true, oneOf: [true, false] }]),
    access.setPortalUserStatus
);

module.exports = { mountCustomerAccessRoutes, portalRouter, portalUserRouter };
