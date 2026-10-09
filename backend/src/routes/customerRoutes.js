
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
const { authorize } = require("../middleware/roleMiddleware");

const customerRules = require("../validation/customerRules");
// All routes require authentication
router.use(protect);

// Read: Admin, Manager, Employee
router.get("/", authorize("Admin", "Manager", "Employee"), getCustomers);
router.get("/:id", authorize("Admin", "Manager", "Employee"), getCustomerById);

// Create and update: Admin, Manager
router.post("/", authorize("Admin", "Manager"), validate(customerRules), createCustomer);
router.put("/:id", authorize("Admin", "Manager"), validate(customerRules), updateCustomer);

// Delete: Admin only
router.delete("/:id", authorize("Admin"), deleteCustomer);

module.exports = router;