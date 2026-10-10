// Builds a fresh database for the browser tests: schema, migrations, a small
// seeded dataset, and one known account per role. Uses the backend's own
// scripts and dependencies, so the tests exercise the real setup path.
//
// Only ever touches E2E_DB_NAME (default b2b_e2e); it refuses any other name.

const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const backend = path.join(root, "backend");
const backendRequire = createRequire(path.join(backend, "package.json"));
backendRequire("dotenv").config({ path: path.join(backend, ".env"), quiet: true });
const mysql = backendRequire("mysql2/promise");
const bcrypt = backendRequire("bcrypt");

const { ACCOUNTS, DB_NAME, PASSWORD } = require("../accounts");

async function main() {
    if (!/^b2b_e2e\w*$/.test(DB_NAME)) {
        throw new Error(`Refusing to reset "${DB_NAME}": the test database name must start with b2b_e2e.`);
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    console.log(`Rebuilding ${DB_NAME}...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    const schema = fs.readFileSync(path.join(root, "database/schema.sql"), "utf8").replaceAll("b2b_management", DB_NAME);
    await connection.query(schema);
    await connection.end();

    const env = { ...process.env, DB_NAME, SEED_USER_PASSWORD: PASSWORD };
    const run = (script, args = []) =>
        execFileSync(process.execPath, [path.join(backend, "src/scripts", script), ...args], { cwd: backend, env, stdio: "inherit" });

    run("migrate.js");
    run("seedLarge.js", ["--customers=40", "--products=60", "--orders=400", "--users=6", "--months=6"]);

    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: DB_NAME
    });
    const hash = await bcrypt.hash(PASSWORD, 10);
    for (const account of Object.values(ACCOUNTS)) {
        if (account.role === "Customer") continue;
        await db.query(
            `INSERT INTO users (first_name, last_name, email, password, role_id)
             SELECT ?, ?, ?, ?, id FROM roles WHERE name = ?`,
            [account.first_name, account.last_name, account.email, hash, account.role]
        );
    }

    // The large seed creates portal logins for its biggest customers; the tests use the first one.
    const [[buyer]] = await db.query(
        `SELECT u.email, c.company_name FROM users u INNER JOIN customers c ON c.id = u.customer_id ORDER BY u.id LIMIT 1`
    );
    await db.end();

    fs.mkdirSync(path.join(__dirname, "../.auth"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "../.auth/portal.json"), JSON.stringify(buyer, null, 2));
    console.log(`Test database ready. Portal client: ${buyer.email} (${buyer.company_name})`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
