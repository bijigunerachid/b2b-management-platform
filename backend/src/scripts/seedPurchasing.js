require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { seedPurchasing } = require("../seed/purchasing");

/*
 * Adds suppliers, demand-based reorder points, and purchase-order history
 * to an existing database, keeping the stock ledger consistent.
 *
 *   npm run seed:purchasing
 *
 * Skips entirely when suppliers already exist, so running it again is safe.
 */
async function run() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await seedPurchasing(connection);
        await connection.commit();

        if (!result) {
            console.log("Suppliers already exist. Nothing to do.");
            return;
        }

        console.log(
            `Added ${result.suppliers} suppliers and purchase orders: ${result.received} received, ` +
            `${result.ordered} open, ${result.drafts} drafts, ${result.cancelled} cancelled ` +
            `(${result.ledgersRebuilt} product ledgers include receipts).`
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

run().catch((error) => {
    console.error("Purchasing seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
