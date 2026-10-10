const { PERMISSIONS, can } = require("../config/permissions");

function deny(req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
}

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) return deny(req, res);
        next();
    };
};

/** Allows the request when the user's role has `permission` (see config/permissions.js). */
function requirePermission(permission) {
    if (!PERMISSIONS[permission]) throw new Error(`Unknown permission: ${permission}`);
    return (req, res, next) => {
        if (!can(req.user, permission)) return deny(req, res);
        next();
    };
}

module.exports = { authorize, requirePermission };
