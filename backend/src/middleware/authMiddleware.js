const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { clearSessionCookie } = require("../config/security");

function unauthorized(res, message) {
    clearSessionCookie(res);

    return res.status(401).json({
        success: false,
        message
    });
}

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

        // 2. Verify signature and expiry; only accept the algorithm we sign with
        let decoded;

        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: ["HS256"]
            });
        } catch {
            return unauthorized(res, "Your session has expired. Please log in again.");
        }

        // 3. Load the user's current state and role in one query
        const [users] = await pool.query(
            `SELECT users.id, users.role_id, users.is_active,
                    users.token_version, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = ?`,
            [decoded.userId]
        );

        const user = users[0];

        if (!user || !user.is_active) {
            return unauthorized(res, "Your account is unavailable. Please contact an administrator.");
        }

        // 4. Reject sessions revoked by logout, password/role change, or deactivation
        if (decoded.tokenVersion !== user.token_version) {
            return unauthorized(res, "Your session has ended. Please log in again.");
        }

        // 5. Use current database permissions, never role data from the token
        req.user = {
            userId: user.id,
            roleId: user.role_id,
            role: user.role
        };

        return next();
    } catch (error) {
        console.error("Authentication middleware error:", error);

        return res.status(500).json({
            success: false,
            message: "Authentication check failed."
        });
    }
};

module.exports = { protect };
