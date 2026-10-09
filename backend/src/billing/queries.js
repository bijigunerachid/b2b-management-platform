// SQL fragments for loading orders with the sum of their non-voided payments.

const { EPSILON, withBilling } = require("./billing");

const PAID_JOIN = `
    LEFT JOIN (
        SELECT order_id, SUM(amount) AS amount_paid
        FROM payments
        WHERE voided_at IS NULL
        GROUP BY order_id
    ) paid ON paid.order_id = o.id`;

const ORDER_BILLING_COLUMNS = `
    o.id,
    o.customer_id,
    c.company_name,
    o.status,
    o.total_amount,
    o.created_at,
    COALESCE(paid.amount_paid, 0) AS amount_paid`;

/** Non-cancelled orders that still have money owed, with billing attached. */
async function loadOpenInvoices(connection, now = new Date()) {
    const [rows] = await connection.query(
        `SELECT ${ORDER_BILLING_COLUMNS}
         FROM orders o
         INNER JOIN customers c ON c.id = o.customer_id
         ${PAID_JOIN}
         WHERE o.status <> 'Cancelled'`
    );

    return rows
        .map((row) => withBilling(row, now))
        .filter((row) => row.billing.balance > EPSILON);
}

module.exports = { ORDER_BILLING_COLUMNS, PAID_JOIN, loadOpenInvoices };
