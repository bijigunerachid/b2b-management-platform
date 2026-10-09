const express = require("express");

const { getCreditNote, listCreditNotes } = require("../controllers/creditNoteController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// Creating credit notes and listing an order's returns live on the order: see orderRoutes.js.
const router = express.Router();
router.use(protect);
router.get("/", authorize("Admin", "Manager", "Employee"), listCreditNotes);
router.get("/:id", authorize("Admin", "Manager", "Employee"), getCreditNote);

module.exports = router;
