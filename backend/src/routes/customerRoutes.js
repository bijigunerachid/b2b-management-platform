
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

const customerRules = [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "email", type: "email" },
    { field: "phone", type: "string" },
    { field: "address", type: "string" }
];
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