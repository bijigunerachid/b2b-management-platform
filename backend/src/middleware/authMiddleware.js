
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const protect = async (req, res, next) => {
    try {
        // 1. Read the JWT from the HttpOnly cookie
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        // 2. Verify the token
        let decoded;

        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token. Please log in again."
            });
        }

        // 3. Check that the user still exists and is active
        const [users] = await pool.query(
            `SELECT id, role_id, is_active
             FROM users
             WHERE id = ?`,
            [decoded.userId]
        );

        if (users.length === 0 || !users[0].is_active) {
            res.clearCookie("token", {
                httpOnly: true,
                secure: false,
                sameSite: "lax"
            });

            return res.status(401).json({
                success: false,
                message: "Your account is unavailable. Please contact an administrator."
            });
        }

        // 4. Use current database permissions, not stale JWT role data
        const [roles] = await pool.query(
            "SELECT name FROM roles WHERE id = ?",
            [users[0].role_id]
        );

        if (roles.length === 0) {
            return res.status(403).json({
                success: false,
                message: "User role not found."
            });
        }

        req.user = {
            userId: users[0].id,
            roleId: users[0].role_id,
            role: roles[0].name
        };

        // 5. Continue to the requested route
        next();

    } catch (error) {
        console.error("Authentication middleware error:", error);

        return res.status(500).json({
            success: false,
            message: "Authentication check failed."
        });
    }
};

module.exports = { protect };