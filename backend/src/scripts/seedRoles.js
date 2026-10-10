require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { seedRoleAccounts } = require("../seed/staff");

/*
 * Adds Accountant and Warehouse demo accounts.
 *
 *   npm run seed:roles
 *
 * They share the seeded team's password. Skips if either role has an account.
 */
async function run() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await seedRoleAccounts(connection, { password: process.env.SEED_USER_PASSWORD });
        await connection.commit();

        if (!result) {
            console.log("Accountant or Warehouse accounts already exist. Nothing to do.");
            return;
        }
        for (const account of result.accounts) console.log(`  ${account.email}  (${account.role})`);
        if (result.generated) console.log(`  Password: ${result.password}  (dev only, shown once)`);
        else if (result.password) console.log("  Password: the value of SEED_USER_PASSWORD.");
        else console.log("  Password: the same as the other seeded team members.");
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

run().catch((error) => {
    console.error("Role seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
