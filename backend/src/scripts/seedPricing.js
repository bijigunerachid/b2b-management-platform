require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { seedPricing } = require("../seed/pricing");

/*
 * Adds price lists, volume discounts and contract prices to an existing database.
 *
 *   npm run seed:pricing
 *
 * Does nothing if price lists already exist. One transaction.
 */
async function run() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await seedPricing(connection);
        await connection.commit();

        if (!result) {
            console.log("Price lists already exist. Nothing to do.");
            return;
        }
        const [silver, gold, distributor] = result.assigned;
        console.log(
            `Added ${result.priceLists} price lists (${silver} Silver, ${gold} Gold, ${distributor} Distributor customers), ` +
            `${result.volumeBreaks} volume discounts and ${result.contracts} contract prices.`
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
    console.error("Pricing seed failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
