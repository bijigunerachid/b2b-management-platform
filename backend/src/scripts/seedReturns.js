require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { seedReturns } = require("../seed/returns");

/*
 * Adds credit notes (returns) to an existing database.
 *
 *   npm run seed:returns
 *
 * Does nothing if credit notes already exist. One transaction.
 */
async function run() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await seedReturns(connection);
        await connection.commit();

        console.log(
            result
                ? `Added ${result.created} credit notes (${result.refunds} with a refund) across ${result.completed} completed orders.`
                : "Credit notes already exist. Nothing to do."
        );
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

run().catch((error) => {
    console.error("Return seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
