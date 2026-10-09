const express = require("express");

const router = express.Router();

const {
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");
const {
    loginAccountLimiter,
    loginIpLimiter
} = require("../middleware/securityMiddleware");

router.post("/login", loginIpLimiter, loginAccountLimiter, login);
router.get("/me", protect, getCurrentUser);
router.post("/logout", logout);

module.exports = router;
