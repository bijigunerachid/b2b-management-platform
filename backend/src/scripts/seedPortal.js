require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { seedPortal } = require("../seed/portal");

/*
 * Creates customer portal logins for the three biggest customers.
 *
 *   npm run seed:portal
 *
 * Uses SEED_USER_PASSWORD when set, otherwise prints a generated password
 * once. Skips if any portal account already exists.
 */
async function run() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await seedPortal(connection, { password: process.env.SEED_USER_PASSWORD });
        await connection.commit();

        if (!result) {
            console.log("Portal accounts already exist (or there are no orders yet). Nothing to do.");
            return;
        }

        console.log("Customer portal logins:");
        for (const account of result.accounts) console.log(`  ${account.email}  (${account.company})`);
        console.log(result.generated ? `  Password: ${result.password}  (dev only, shown once)` : "  Password: the value of SEED_USER_PASSWORD.");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

run().catch((error) => {
    console.error("Portal seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
