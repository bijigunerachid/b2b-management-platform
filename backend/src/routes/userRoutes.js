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
const validate = require("../middleware/validate");
const {
    createUserRules,
    updateUserRules,
    userStatusRules
} = require("../validation/userRules");

router.use(protect, authorize("Admin"));

router.get("/", getUsers);
router.post("/", validate(createUserRules), createUser);
router.put("/:id", validate(updateUserRules), updateUser);
router.patch("/:id/status", validate(userStatusRules), updateUserStatus);

module.exports = router;
