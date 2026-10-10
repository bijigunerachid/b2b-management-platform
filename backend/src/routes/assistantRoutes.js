const express = require("express");

const { ask, getSuggestions } = require("../controllers/assistantController");
const { protectAnyUser } = require("../middleware/authMiddleware");

// Staff and portal clients both get the helper; each only sees the help
// articles meant for them (and, for staff, allowed by their role).
const router = express.Router();
router.use(protectAnyUser);
router.get("/suggestions", getSuggestions);
router.post("/ask", ask);

module.exports = router;
