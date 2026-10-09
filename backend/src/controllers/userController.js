const pool = require("../config/database");
const bcrypt = require("bcrypt");
const getUsers = async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT
                users.id,
                users.first_name,
                users.last_name,
                users.email,
                roles.name AS role,
                users.is_active,
                users.created_at
            FROM users
            INNER JOIN roles
                ON users.role_id = roles.id
            ORDER BY users.id DESC
        `);

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve users"
        });
    }
};

const createUser= async (req, res) => {
    try {
        const {
            first_name ,
            last_name,
            email,
            password,
            role_id
        }=req.body;

        if (!first_name || !last_name || !email || !password || !role_id) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }
        const [existingUser] = await pool.query(
            "SELECT * FROM users WHERE email = ?", 
            [email]);

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "User with this email already exists"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            `INSERT INTO users 
            (first_name ,last_name,email,password,role_id) VALUES (?, ?, ?, ?, ?)
            `,
            [   first_name,
                last_name,
                email,
                hashedPassword,
                role_id
            ]
        );
        res.status(201).json({
            success: true,
            message: "User created successfully",
            userId: result.insertId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to create user"
        });
    }
};



// Update an existing user
async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, role_id, password } = req.body;

        if (!first_name || !last_name || !email || !role_id) {
            return res.status(400).json({
                success: false,
                message: "First name, last name, email and role are required."
            });
        }

        // Check whether the user exists
        const [existingUsers] = await pool.query(
            "SELECT id FROM users WHERE id = ?",
            [id]
        );

        if (existingUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Check whether the email belongs to another user
        const [emailUsers] = await pool.query(
            "SELECT id FROM users WHERE email = ? AND id != ?",
            [email, id]
        );

        if (emailUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email is already in use."
            });
        }

        // Verify that the role exists
        const [roles] = await pool.query(
            "SELECT id FROM roles WHERE id = ?",
            [role_id]
        );

        if (roles.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid role."
            });
        }

        await pool.query(
            `UPDATE users
             SET first_name = ?, last_name = ?, email = ?, role_id = ?
             WHERE id = ?`,
            [first_name, last_name, email, role_id, id]
        );

        // Change the password only when a new one is provided
        if (password && password.trim() !== "") {
            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "Password must contain at least 8 characters."
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            await pool.query(
                "UPDATE users SET password = ? WHERE id = ?",
                [hashedPassword, id]
            );
        }

        return res.json({
            success: true,
            message: "User updated successfully."
        });
    } catch (error) {
        console.error("Update user error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update user."
        });
    }
}

// Activate or deactivate an account
async function updateUserStatus(req, res) {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false."
            });
        }

        // Prevent the current Admin from deactivating their own account
        if (Number(id) === Number(req.user.userId) && !is_active) {
            return res.status(400).json({
                success: false,
                message: "You cannot deactivate your own account."
            });
        }

        const [result] = await pool.query(
            "UPDATE users SET is_active = ? WHERE id = ?",
            [is_active ? 1 : 0, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            message: is_active
                ? "Account activated successfully."
                : "Account deactivated successfully."
        });
    } catch (error) {
        console.error("Update user status error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update account status."
        });
    }
}

module.exports = {
    getUsers,
    createUser,
    updateUser,
    updateUserStatus
};

