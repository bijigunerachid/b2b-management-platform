const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { BCRYPT_ROUNDS } = require("../config/security");

// Accountant and Warehouse accounts for databases seeded before those roles
// existed. They get the same password as the rest of the seeded team (copied
// from an existing @seed.b2b.local account), so one password still opens
// every role. Skips when either role already has an account.
const ACCOUNTS = [
    ["Salma", "Benali", "Accountant"],
    ["Omar", "Lahlou", "Accountant"],
    ["Karim", "Ouali", "Warehouse"],
    ["Nadia", "Fassi", "Warehouse"],
    ["Hamza", "Idrissi", "Warehouse"]
];

async function seedRoleAccounts(connection, { password } = {}) {
    const [[{ existing }]] = await connection.query(
        "SELECT COUNT(*) AS existing FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name IN ('Accountant', 'Warehouse')"
    );
    if (Number(existing) > 0) return null;

    const [roles] = await connection.query("SELECT id, name FROM roles WHERE name IN ('Accountant', 'Warehouse')");
    const roleId = new Map(roles.map((role) => [role.name, role.id]));
    if (roleId.size < 2) return null;

    const [seeded] = await connection.query("SELECT password FROM users WHERE email LIKE '%@seed.b2b.local' LIMIT 1");
    let plain = null;
    let hash = seeded[0]?.password;
    if (!hash) {
        plain = password || crypto.randomBytes(9).toString("base64url");
        hash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
    }

    const emails = [];
    for (const [first, last, role] of ACCOUNTS) {
        const email = `${first}.${last}`.toLowerCase() + "@seed.b2b.local";
        await connection.query(
            "INSERT IGNORE INTO users (first_name, last_name, email, password, role_id) VALUES (?, ?, ?, ?, ?)",
            [first, last, email, hash, roleId.get(role)]
        );
        emails.push({ email, role });
    }

    return { accounts: emails, password: plain, generated: Boolean(plain) && !password };
}

module.exports = { seedRoleAccounts };
