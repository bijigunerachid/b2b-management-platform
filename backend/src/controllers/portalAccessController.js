// Staff-side management of customer portal accounts.

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const { BCRYPT_ROUNDS } = require("../config/security");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** A readable temporary password that satisfies the password policy. */
function temporaryPassword() {
    const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const pick = (set, count) => Array.from({ length: count }, () => set[crypto.randomInt(set.length)]).join("");
    return `${pick(letters, 5)}-${pick(digits, 2)}${pick(letters, 3)}-${pick(digits, 3)}`;
}

// GET /api/customers/:id/portal-users
const listPortalUsers = async (req, res) => {
    const customerId = parseId(req.params.id);
    if (!customerId) return res.status(400).json({ success: false, message: "Invalid customer ID" });

    try {
        const [users] = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.created_at
             FROM users u
             INNER JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'Customer' AND u.customer_id = ?
             ORDER BY u.created_at`,
            [customerId]
        );
        return res.json({ success: true, data: users });
    } catch (error) {
        console.error("List portal users error:", error);
        return res.status(500).json({ success: false, message: "Failed to load portal access" });
    }
};

// POST /api/customers/:id/portal-users { first_name, last_name, email }
// Returns a one-time temporary password; only its hash is stored.
const invitePortalUser = async (req, res) => {
    const customerId = parseId(req.params.id);
    if (!customerId) return res.status(400).json({ success: false, message: "Invalid customer ID" });

    const firstName = req.body.first_name.trim();
    const lastName = req.body.last_name.trim();
    const email = req.body.email.trim().toLowerCase();

    try {
        const [customers] = await pool.query("SELECT id, company_name FROM customers WHERE id = ?", [customerId]);
        if (customers.length === 0) return res.status(404).json({ success: false, message: "Customer not found" });

        const [[role]] = await pool.query("SELECT id FROM roles WHERE name = 'Customer'");
        if (!role) return res.status(500).json({ success: false, message: "Run the database migrations first." });

        const password = temporaryPassword();
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const [result] = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password, role_id, customer_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, email, hash, role.id, customerId]
        );

        return res.status(201).json({
            success: true,
            message: `Portal access created for ${customers[0].company_name}.`,
            data: { userId: result.insertId, email, temporary_password: password }
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        console.error("Invite portal user error:", error);
        return res.status(500).json({ success: false, message: "Could not create portal access" });
    }
};

// PATCH /api/portal-users/:id/status { is_active }
// Deactivating also revokes any open sessions.
const setPortalUserStatus = async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user ID" });

    const active = req.body.is_active;

    try {
        const [result] = await pool.query(
            `UPDATE users u
             INNER JOIN roles r ON r.id = u.role_id
             SET u.is_active = ?, u.token_version = u.token_version + ?
             WHERE u.id = ? AND r.name = 'Customer'`,
            [active ? 1 : 0, active ? 0 : 1, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Portal account not found" });
        }
        return res.json({ success: true, message: active ? "Portal access enabled" : "Portal access disabled" });
    } catch (error) {
        console.error("Portal user status error:", error);
        return res.status(500).json({ success: false, message: "Could not update portal access" });
    }
};

module.exports = { invitePortalUser, listPortalUsers, setPortalUserStatus, temporaryPassword };
