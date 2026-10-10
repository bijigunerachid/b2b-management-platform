const express = require("express");

const { getCreditNote, listCreditNotes } = require("../controllers/creditNoteController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/roleMiddleware");

// Creating credit notes and listing an order's returns live on the order: see orderRoutes.js.
const router = express.Router();
router.use(protect);
router.get("/", requirePermission("payments.view"), listCreditNotes);
router.get("/:id", requirePermission("payments.view"), getCreditNote);

module.exports = router;
