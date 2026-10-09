require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { seedQuotes } = require("../seed/quotes");

/*
 * Adds a realistic quote pipeline to an existing database.
 *
 *   npm run seed:quotes
 *
 * Skips entirely when quotes already exist, so running it again is safe.
 */
async function run() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const created = await seedQuotes(connection);
        await connection.commit();

        console.log(
            created === 0
                ? "Quotes already exist (or there are no customers/products). Nothing to do."
                : `Added ${created} quotes.`
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
    console.error("Quote seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
