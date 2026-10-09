const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { BCRYPT_ROUNDS, checkPasswordPolicy } = require("../config/security");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function roleName(connection, roleId) {
    const [roles] = await connection.query(
        "SELECT name FROM roles WHERE id = ?",
        [roleId]
    );
    return roles[0]?.name ?? null;
}

/** Number of active admins other than `excludeId`. */
async function otherActiveAdmins(connection, excludeId) {
    const [rows] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM users
         INNER JOIN roles ON roles.id = users.role_id
         WHERE roles.name = 'Admin' AND users.is_active = 1 AND users.id <> ?
         FOR UPDATE`,
        [excludeId]
    );
    return Number(rows[0].total);
}

const getUsers = async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT
                users.id,
                users.first_name,
                users.last_name,
                users.email,
                users.role_id,
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
        console.error("Get users error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve users"
        });
    }
};

const createUser = async (req, res) => {
    try {
        const { first_name, last_name, password, role_id } = req.body;
        const email = req.body.email.trim().toLowerCase();

        const passwordError = checkPasswordPolicy(password);

        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

        if (!(await roleName(pool, role_id))) {
            return res.status(400).json({ success: false, message: "Invalid role." });
        }

        const [existingUsers] = await pool.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A user with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const [result] = await pool.query(
            `INSERT INTO users
                (first_name, last_name, email, password, role_id)
             VALUES (?, ?, ?, ?, ?)`,
            [first_name.trim(), last_name.trim(), email, hashedPassword, role_id]
        );

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            userId: result.insertId
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A user with this email already exists."
            });
        }

        console.error("Create user error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create user"
        });
    }
};

// Update an existing user. All checks run before anything is written.
async function updateUser(req, res) {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const { first_name, last_name, role_id, password } = req.body;
    const email = req.body.email.trim().toLowerCase();
    const changingPassword = typeof password === "string" && password !== "";

    if (changingPassword) {
        const passwordError = checkPasswordPolicy(password);

        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingUsers] = await connection.query(
            `SELECT users.id, users.role_id, users.is_active, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = ?
             FOR UPDATE`,
            [id]
        );

        const existing = existingUsers[0];

        if (!existing) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const newRole = await roleName(connection, role_id);

        if (!newRole) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Invalid role." });
        }

        // Never allow the platform to end up without an active admin.
        if (
            existing.role === "Admin" &&
            newRole !== "Admin" &&
            existing.is_active &&
            (await otherActiveAdmins(connection, id)) === 0
        ) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "This is the last active admin. Promote another user to Admin first."
            });
        }

        const [emailUsers] = await connection.query(
            "SELECT id FROM users WHERE email = ? AND id <> ?",
            [email, id]
        );

        if (emailUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "This email is already in use." });
        }

        const roleChanged = Number(existing.role_id) !== Number(role_id);
        const hashedPassword = changingPassword
            ? await bcrypt.hash(password, BCRYPT_ROUNDS)
            : null;

        // A new password or role ends the user's existing sessions.
        await connection.query(
            `UPDATE users
             SET first_name = ?,
                 last_name = ?,
                 email = ?,
                 role_id = ?,
                 password = COALESCE(?, password),
                 token_version = token_version + ?
             WHERE id = ?`,
            [
                first_name.trim(),
                last_name.trim(),
                email,
                role_id,
                hashedPassword,
                changingPassword || roleChanged ? 1 : 0,
                id
            ]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: "User updated successfully."
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ success: false, message: "This email is already in use." });
        }

        console.error("Update user error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update user."
        });
    } finally {
        if (connection) connection.release();
    }
}

// Activate or deactivate an account
async function updateUserStatus(req, res) {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "is_active must be true or false."
        });
    }

    if (id === Number(req.user.userId) && !is_active) {
        return res.status(400).json({
            success: false,
            message: "You cannot deactivate your own account."
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT users.id, users.is_active, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = ?
             FOR UPDATE`,
            [id]
        );

        const user = rows[0];

        if (!user) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (
            !is_active &&
            user.role === "Admin" &&
            (await otherActiveAdmins(connection, id)) === 0
        ) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "This is the last active admin and cannot be deactivated."
            });
        }

        // Deactivation also revokes any sessions the user still has open.
        await connection.query(
            `UPDATE users
             SET is_active = ?,
                 token_version = token_version + ?
             WHERE id = ?`,
            [is_active ? 1 : 0, is_active ? 0 : 1, id]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: is_active
                ? "Account activated successfully."
                : "Account deactivated successfully."
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});

        console.error("Update user status error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update account status."
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    getUsers,
    createUser,
    updateUser,
    updateUserStatus
};
