const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { clearSessionCookie } = require("../config/security");

// Staff roles are defined once, with their permissions, in config/permissions.js.
const STAFF_ROLES = Object.keys(require("../config/permissions").STAFF_ROLES);

function unauthorized(res, message) {
    clearSessionCookie(res);

    return res.status(401).json({
        success: false,
        message
    });
}

/**
 * Verifies the session cookie and loads the user's current state. On
 * success sets req.user and returns true; otherwise sends the response.
 */
async function authenticate(req, res) {
    // 1. Read the JWT from the HttpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({
            success: false,
            message: "Authentication required. Please log in."
        });
        return false;
    }

    // 2. Verify signature and expiry; only accept the algorithm we sign with
    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });
    } catch {
        unauthorized(res, "Your session has expired. Please log in again.");
        return false;
    }

    // 3. Load the user's current state and role in one query
    const [users] = await pool.query(
        `SELECT users.id, users.role_id, users.is_active, users.customer_id,
                users.token_version, roles.name AS role
         FROM users
         INNER JOIN roles ON roles.id = users.role_id
         WHERE users.id = ?`,
        [decoded.userId]
    );

    const user = users[0];

    if (!user || !user.is_active) {
        unauthorized(res, "Your account is unavailable. Please contact an administrator.");
        return false;
    }

    // 4. Reject sessions revoked by logout, password/role change, or deactivation
    if (decoded.tokenVersion !== user.token_version) {
        unauthorized(res, "Your session has ended. Please log in again.");
        return false;
    }

    // 5. Use current database permissions, never role data from the token
    req.user = {
        userId: user.id,
        roleId: user.role_id,
        role: user.role,
        customerId: user.customer_id
    };

    return true;
}

function guard(check, deniedMessage) {
    return async (req, res, next) => {
        try {
            if (!(await authenticate(req, res))) return undefined;

            if (!check(req.user)) {
                return res.status(403).json({ success: false, message: deniedMessage });
            }

            return next();
        } catch (error) {
            console.error("Authentication middleware error:", error);

            return res.status(500).json({
                success: false,
                message: "Authentication check failed."
            });
        }
    };
}

/**
 * Staff only. Secure by default: every internal route uses this, so a
 * customer portal account can never reach staff data, even on routes that
 * don't call authorize().
 */
const protect = guard(
    (user) => STAFF_ROLES.includes(user.role),
    "This area is for staff accounts only."
);

/** Customer portal accounts only; they must belong to a customer company. */
const protectCustomer = guard(
    (user) => user.role === "Customer" && Number.isSafeInteger(user.customerId),
    "This area is for customer portal accounts only."
);

/** Any signed-in account (profile, logout, password change). */
const protectAnyUser = guard(() => true, "");

module.exports = { STAFF_ROLES, protect, protectAnyUser, protectCustomer };
