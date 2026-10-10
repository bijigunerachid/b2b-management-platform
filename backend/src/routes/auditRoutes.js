const express = require("express");

const { listAuditLog } = require("../controllers/auditController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

// Read-only: the log has no update or delete endpoints.
const router = express.Router();
router.use(protect);
router.get("/", requirePermission("audit.view"), listAuditLog);

module.exports = router;
