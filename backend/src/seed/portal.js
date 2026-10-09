// Creates portal logins for the biggest customers so the demo portal is
// full of real orders, invoices, and quotes. Skips if any portal account
// already exists.

const bcrypt = require("bcrypt");
const { BCRYPT_ROUNDS } = require("../config/security");
const { temporaryPassword } = require("../controllers/portalAccessController");

async function seedPortal(connection, { customers = 3, password } = {}) {
    const [[{ existing }]] = await connection.query(
        "SELECT COUNT(*) AS existing FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'Customer'"
    );
    if (Number(existing) > 0) return null;

    const [[role]] = await connection.query("SELECT id FROM roles WHERE name = 'Customer'");
    if (!role) return null;

    const [top] = await connection.query(
        `SELECT c.id, c.company_name, c.contact_name
         FROM customers c
         INNER JOIN orders o ON o.customer_id = c.id AND o.status <> 'Cancelled'
         GROUP BY c.id
         ORDER BY SUM(o.total_amount) DESC
         LIMIT ?`,
        [customers]
    );
    if (top.length === 0) return null;

    const plain = password || temporaryPassword();
    const hash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
    const accounts = [];

    for (const customer of top) {
        const [first = "Client", ...rest] = (customer.contact_name || "Client User").split(" ");
        const slug = customer.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
        const email = `buyer@${slug}.portal.example`;

        await connection.query(
            `INSERT INTO users (first_name, last_name, email, password, role_id, customer_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [first, rest.join(" ") || "Buyer", email, hash, role.id, customer.id]
        );
        accounts.push({ email, company: customer.company_name });
    }

    return { accounts, password: plain, generated: !password };
}

module.exports = { seedPortal };
