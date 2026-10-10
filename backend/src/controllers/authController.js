const pool = require("../config/database");
const { permissionsFor } = require("../config/permissions");
const { isDemoMode } = require("../config/demo");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
    BCRYPT_ROUNDS,
    SESSION_HOURS,
    checkPasswordPolicy,
    clearSessionCookie,
    cookieOptions
} = require("../config/security");

// Compared against when the email is unknown, so a missing account takes
// as long as a wrong password and response timing reveals nothing.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", BCRYPT_ROUNDS);

const INVALID_CREDENTIALS = {
    success: false,
    message: "Invalid email or password"
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        // 1. Validate input shape
        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password ||
            email.length > 255 ||
            password.length > 200
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // 2. Find user
        const [users] = await pool.query(
            `
            SELECT
                users.id,
                users.first_name,
                users.last_name,
                users.email,
                users.password,
                users.role_id,
                users.token_version,
                users.customer_id,
                customers.company_name,
                roles.name AS role,
                users.is_active
            FROM users
            INNER JOIN roles
                ON users.role_id = roles.id
            LEFT JOIN customers
                ON customers.id = users.customer_id
            WHERE users.email = ?
            `,
            [email.trim().toLowerCase()]
        );

        const user = users[0];

        // 3. Always run bcrypt so timing doesn't reveal whether the email exists
        const passwordCorrect = await bcrypt.compare(
            password,
            user ? user.password : DUMMY_HASH
        );

        if (!user || !passwordCorrect) {
            return res.status(401).json(INVALID_CREDENTIALS);
        }

        // 4. Only reveal the account state to someone who knows the password
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact an administrator."
            });
        }

        // 5. Create JWT bound to the current session version
        const token = jwt.sign(
            {
                userId: user.id,
                tokenVersion: user.token_version
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: `${SESSION_HOURS}h`
            }
        );

        // 6. Store JWT in an HttpOnly cookie
        res.cookie("token", token, cookieOptions());

        // 7. Never send the password hash back
        return res.json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role,
                permissions: permissionsFor(user.role),
                customer_id: user.customer_id,
                company_name: user.company_name
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const [users] = await pool.query(
            `
            SELECT
                users.id,
                users.first_name,
                users.last_name,
                users.email,
                users.customer_id,
                customers.company_name,
                roles.name AS role
            FROM users
            INNER JOIN roles
                ON users.role_id = roles.id
            LEFT JOIN customers
                ON customers.id = users.customer_id
            WHERE users.id = ?
            `,
            [req.user.userId]
        );

        if (users.length === 0) {
            clearSessionCookie(res);

            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            user: { ...users[0], permissions: permissionsFor(users[0].role) }
        });
    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get current user"
        });
    }
};

// Always clears the cookie. When the token is still valid, it also revokes
// every session for this user, not just this browser's cookie (except in demo
// mode, where many visitors share one account).
const logout = async (req, res) => {
    const token = req.cookies?.token;

    if (token && !isDemoMode()) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: ["HS256"]
            });

            const [revoked] = await pool.query(
                `UPDATE users
                 SET token_version = token_version + 1
                 WHERE id = ? AND token_version = ?`,
                [decoded.userId, decoded.tokenVersion]
            );
            // Lets the audit log say who signed out (the route isn't behind protect).
            if (revoked.affectedRows > 0) res.locals.auditActor = { id: decoded.userId, role: null };
        } catch {
            // Expired or invalid token: nothing to revoke.
        }
    }

    clearSessionCookie(res);

    return res.json({
        success: true,
        message: "Logout successful"
    });
};

// POST /api/auth/password { current_password, new_password }
// Signs out every other session, then re-issues this device's cookie.
const changePassword = async (req, res) => {
    const { current_password: currentPassword, new_password: newPassword } = req.body || {};

    if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({ success: false, message: "Enter your current password." });
    }

    const policyError = checkPasswordPolicy(newPassword);
    if (policyError) {
        return res.status(400).json({ success: false, message: policyError });
    }

    if (newPassword === currentPassword) {
        return res.status(400).json({ success: false, message: "Choose a password different from the current one." });
    }

    try {
        const [users] = await pool.query("SELECT id, password, token_version FROM users WHERE id = ?", [req.user.userId]);
        const user = users[0];

        if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(400).json({ success: false, message: "Your current password is incorrect." });
        }

        const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        const nextVersion = user.token_version + 1;

        await pool.query(
            "UPDATE users SET password = ?, token_version = ? WHERE id = ? AND token_version = ?",
            [hash, nextVersion, user.id, user.token_version]
        );

        const token = jwt.sign(
            { userId: user.id, tokenVersion: nextVersion },
            process.env.JWT_SECRET,
            { algorithm: "HS256", expiresIn: `${SESSION_HOURS}h` }
        );
        res.cookie("token", token, cookieOptions());

        return res.json({ success: true, message: "Password changed. Other devices were signed out." });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({ success: false, message: "Could not change the password." });
    }
};

module.exports = {
    changePassword,
    login,
    getCurrentUser,
    logout
};
