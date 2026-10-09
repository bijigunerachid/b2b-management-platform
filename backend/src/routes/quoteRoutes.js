const express = require("express");
const router = express.Router();

const {
    acceptQuote,
    convertQuote,
    createQuote,
    deleteQuote,
    duplicateQuote,
    getQuote,
    listQuotes,
    rejectQuote,
    sendQuote,
    updateQuote
} = require("../controllers/quoteController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const read = authorize("Admin", "Manager", "Employee");
const write = authorize("Admin", "Manager");

router.use(protect);

router.get("/", read, listQuotes);
router.get("/:id", read, getQuote);

router.post("/", write, createQuote);
router.put("/:id", write, updateQuote);
router.delete("/:id", write, deleteQuote);

router.post("/:id/send", write, sendQuote);
router.post("/:id/accept", write, acceptQuote);
router.post("/:id/reject", write, rejectQuote);
router.post("/:id/convert", write, convertQuote);
router.post("/:id/duplicate", write, duplicateQuote);

module.exports = router;
