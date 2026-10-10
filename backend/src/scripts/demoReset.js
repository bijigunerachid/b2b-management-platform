require("dotenv").config({ quiet: true });

// Nightly reset for the public demo (npm run demo:reset):
//   1. wipes and regenerates the demo data (seed:large --reset);
//   2. recreates the shared demo accounts with DEMO_PASSWORD;
//   3. clears the audit log and old model versions.
// Then retrain the models (see deploy/demo-reset.sh). Refuses to run unless
// DEMO_MODE=true, so it can't wipe a real company's database by accident.

const path = require("path");
const { spawnSync } = require("child_process");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const { DEMO_ACCOUNTS } = require("../config/demo");

const MODEL_HISTORY_DAYS = 30;

function reseed() {
    const result = spawnSync(process.execPath, [path.join(__dirname, "seedLarge.js"), "--reset"], {
        stdio: "inherit",
        env: { ...process.env, SEED_USER_PASSWORD: process.env.DEMO_PASSWORD }
    });
    if (result.status !== 0) throw new Error("Reseeding failed.");
}

async function restoreAccounts(connection) {
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
    const [roles] = await connection.query("SELECT id, name FROM roles");
    const roleId = new Map(roles.map((role) => [role.name, role.id]));

    // The portal demo needs a company with history: the one with the most orders.
    const [[company]] = await connection.query(
        `SELECT c.id, c.company_name FROM customers c
         INNER JOIN orders o ON o.customer_id = c.id
         GROUP BY c.id ORDER BY COUNT(*) DESC, c.id LIMIT 1`
    );
    if (!company) throw new Error("No customer with orders to attach the demo client account to.");

    for (const account of DEMO_ACCOUNTS) {
        if (!roleId.has(account.role)) throw new Error(`Role ${account.role} is missing; run the migrations first.`);
        const customerId = account.role === "Customer" ? company.id : null;
        // Upsert keeps staff account ids (and so their history) stable from night to night.
        await connection.query(
            `INSERT INTO users (first_name, last_name, email, password, role_id, is_active, customer_id)
             VALUES (?, ?, ?, ?, ?, 1, ?)
             ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name),
                 password = VALUES(password), role_id = VALUES(role_id), is_active = 1, customer_id = VALUES(customer_id)`,
            [account.first_name, account.last_name, account.email, passwordHash, roleId.get(account.role), customerId]
        );
    }
    return company;
}

async function main() {
    if (process.env.DEMO_MODE !== "true") {
        throw new Error("demo:reset only runs with DEMO_MODE=true. It deletes all business data.");
    }
    if (!process.env.DEMO_PASSWORD) throw new Error("Set DEMO_PASSWORD.");

    reseed();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const company = await restoreAccounts(connection);
        await connection.query("DELETE FROM audit_log");
        await connection.query("DELETE FROM ml_models WHERE trained_at < NOW() - INTERVAL ? DAY", [MODEL_HISTORY_DAYS]);
        await connection.commit();
        console.log(`Demo accounts ready (${DEMO_ACCOUNTS.map((account) => account.key).join(", ")}); the client account belongs to ${company.company_name}.`);
        console.log("Now retrain the models so forecasts, risk scores and recommendations match the new data.");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error("Demo reset failed:", error.message);
    process.exitCode = 1;
});
