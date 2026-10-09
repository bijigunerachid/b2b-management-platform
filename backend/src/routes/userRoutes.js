
const express = require("express");
const router = express.Router();

const {
    getUsers,
    createUser,
    updateUser,
    updateUserStatus
} = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

router.use(protect, authorize("Admin"));

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/status", updateUserStatus);

module.exports = router;