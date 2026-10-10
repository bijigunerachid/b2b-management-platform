
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
} = require("../controllers/customerController");

const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

const customerRules = require("../validation/customerRules");
// All routes require authentication
router.use(protect);

// Read: Admin, Manager, Employee
router.get("/", requirePermission("customers.view"), getCustomers);
router.get("/:id", requirePermission("customers.view"), getCustomerById);

// Create and update: Admin, Manager
router.post("/", requirePermission("customers.write"), validate(customerRules), createCustomer);
router.put("/:id", requirePermission("customers.write"), validate(customerRules), updateCustomer);

// Delete: Admin only
router.delete("/:id", requirePermission("customers.delete"), deleteCustomer);

// Portal access for this customer's contacts.
require("./portalRoutes").mountCustomerAccessRoutes(router);
require("./pricingRoutes").mountCustomerPricingRoutes(router);

module.exports = router;