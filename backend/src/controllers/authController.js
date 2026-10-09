const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
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
                roles.name AS role,
                users.is_active
            FROM users
            INNER JOIN roles
                ON users.role_id = roles.id
            WHERE users.email = ?
            `,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        // 3. Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive"
            });
        }

        // 4. Compare password with bcrypt hash
        const passwordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // 5. Create JWT
        const token = jwt.sign(
            {
                userId: user.id,
                roleId: user.role_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        // 6. Store JWT in HttpOnly cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 60 * 60 * 1000
        });

        // 7. Never send password back to frontend
        res.json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
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
                roles.name AS role,
                users.is_active
            FROM users
            INNER JOIN roles
                ON users.role_id = roles.id
            WHERE users.id = ?
            `,
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = users[0];

        if (!user.is_active) {
            res.clearCookie("token", {
                httpOnly: true,
                secure: false,
                sameSite: "lax"
            });

            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated."
            });
        }

        return res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get current user"
        });
    }
};

const logout = (req ,res) => {
    res.clearCookie("token",{
        httpOnly : true,
        secure : false,
        samesite: "lax"
    });
    res.json({
        success:true,
        message: "Logout successful"
    });
};

module.exports = {
    login,
    getCurrentUser,
    logout
};