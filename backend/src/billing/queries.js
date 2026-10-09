// SQL fragments for loading orders with their payment and credit note totals.

const { EPSILON, withBilling } = require("./billing");

const BILLING_JOINS = `
    LEFT JOIN (
        SELECT order_id, SUM(amount) AS amount_paid
        FROM payments
        WHERE voided_at IS NULL
        GROUP BY order_id
    ) paid ON paid.order_id = o.id
    LEFT JOIN (
        SELECT order_id, SUM(total) AS amount_credited, SUM(refund_amount) AS amount_refunded
        FROM credit_notes
        GROUP BY order_id
    ) credit ON credit.order_id = o.id`;

const ORDER_BILLING_COLUMNS = `
    o.id,
    o.customer_id,
    c.company_name,
    o.status,
    o.total_amount,
    o.created_at,
    COALESCE(paid.amount_paid, 0) AS amount_paid,
    COALESCE(credit.amount_credited, 0) AS amount_credited,
    COALESCE(credit.amount_refunded, 0) AS amount_refunded`;

/** Billing for one order, read inside the caller's transaction (lock the order row first). */
async function loadOrderBilling(connection, order, now = new Date()) {
    const [[sums]] = await connection.query(
        `SELECT
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = ? AND voided_at IS NULL) AS amount_paid,
            (SELECT COALESCE(SUM(total), 0) FROM credit_notes WHERE order_id = ?) AS amount_credited,
            (SELECT COALESCE(SUM(refund_amount), 0) FROM credit_notes WHERE order_id = ?) AS amount_refunded`,
        [order.id, order.id, order.id]
    );

    return withBilling({ ...order, ...sums }, now).billing;
}

/** Non-cancelled orders that still have money owed, with billing attached. */
async function loadOpenInvoices(connection, now = new Date()) {
    const [rows] = await connection.query(
        `SELECT ${ORDER_BILLING_COLUMNS}
         FROM orders o
         INNER JOIN customers c ON c.id = o.customer_id
         ${BILLING_JOINS}
         WHERE o.status <> 'Cancelled'`
    );

    return rows
        .map((row) => withBilling(row, now))
        .filter((row) => row.billing.balance > EPSILON);
}

module.exports = { BILLING_JOINS, ORDER_BILLING_COLUMNS, loadOpenInvoices, loadOrderBilling };
