const express = require("express");

const { getEmail, getEmailSettings, listEmails } = require("../controllers/emailController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

// The log of emails sent to clients (and the outbox when no mail server is set up).
const router = express.Router();
router.use(protect, requirePermission("emails.view"));
router.get("/", listEmails);
router.get("/settings", getEmailSettings);
router.get("/:id", getEmail);

module.exports = router;
