
require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function createAdmin() {
    try {
        const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const password = process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            throw new Error(
                "Set ADMIN_EMAIL and ADMIN_PASSWORD temporarily in backend/.env."
            );
        }

        if (password.length < 12) {
            throw new Error(
                "Use a unique administrator password of at least 12 characters."
            );
        }

        const [existingUsers] = await pool.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            console.log(
                "This email already exists. No account was changed."
            );
            return;
        }

        const [roles] = await pool.query(
            "SELECT id FROM roles WHERE name = 'Admin' LIMIT 1"
        );

        if (roles.length === 0) {
            throw new Error(
                "Admin role not found. Run database/schema.sql first."
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            `INSERT INTO users
                (first_name, last_name, email, password, role_id, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [
                "System",
                "Administrator",
                email,
                passwordHash,
                roles[0].id
            ]
        );

        console.log("Initial Admin account created successfully.");
        console.log(`Email: ${email}`);
        console.log("Password: not displayed.");
    } finally {
        await pool.end();
    }
}

createAdmin().catch((error) => {
    console.error("Could not create Admin:", error.message);
    process.exitCode = 1;
});