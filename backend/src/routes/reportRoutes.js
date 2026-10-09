const express = require("express");

const { getSalesReport } = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// Margins and costs are management information: Employees don't see them.
const router = express.Router();
router.use(protect);
router.get("/sales", authorize("Admin", "Manager"), getSalesReport);

module.exports = router;
