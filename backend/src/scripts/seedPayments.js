require("dotenv").config({ quiet: true });

const pool = require("../config/database");
const { createRandom, generatePayments } = require("../seed/generate");

/*
 * Backfills realistic payment history for existing orders that have no
 * payments yet (for example, orders created by an older seed run).
 *
 *   npm run seed:payments
 *
 * Orders that already have payments are skipped, and each order's outcome
 * is deterministic, so running this again changes nothing. Everything is
 * inserted in one transaction.
 */
async function seedPayments() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [orders] = await connection.query(
            `SELECT o.id AS \`key\`, o.customer_id AS customer_key, o.status, o.total_amount, o.created_at
             FROM orders o
             WHERE o.status <> 'Cancelled'
               AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id)
             ORDER BY o.id`
        );

        if (orders.length === 0) {
            console.log("Every order already has payment history. Nothing to do.");
            await connection.rollback();
            return;
        }

        // One generator per order, seeded by its id: an order's outcome
        // (including "stays unpaid") is the same on every run, so running
        // this again never pays invoices that were meant to stay open.
        const payments = orders.flatMap((order) =>
            generatePayments(createRandom(4242 + order.key), [order])
        );

        for (let start = 0; start < payments.length; start += 1000) {
            await connection.query(
                `INSERT INTO payments (order_id, amount, method, reference, paid_at, note)
                 VALUES ?`,
                [
                    payments.slice(start, start + 1000).map((payment) => [
                        payment.key,
                        payment.amount,
                        payment.method,
                        payment.reference,
                        payment.paid_at,
                        payment.note
                    ])
                ]
            );
        }

        await connection.commit();

        const paidOrders = new Set(payments.map((payment) => payment.key)).size;
        console.log(
            payments.length === 0
                ? `No new payments: the ${orders.length} orders without payments are intentionally left unpaid.`
                : `Added ${payments.length} payments across ${paidOrders} of ${orders.length} orders; the rest stay unpaid.`
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

seedPayments().catch((error) => {
    console.error("Payment seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
