const express = require("express");

const router = express.Router();

const {
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/logout",protect,logout);
module.exports = router;