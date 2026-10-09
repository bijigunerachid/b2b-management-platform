const express = require("express");

const router = express.Router();

const {
    changePassword,
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");

const { protectAnyUser } = require("../middleware/authMiddleware");
const {
    loginAccountLimiter,
    loginIpLimiter
} = require("../middleware/securityMiddleware");

router.post("/login", loginIpLimiter, loginAccountLimiter, login);
router.get("/me", protectAnyUser, getCurrentUser);
router.post("/password", protectAnyUser, loginAccountLimiter, changePassword);
router.post("/logout", logout);

module.exports = router;
