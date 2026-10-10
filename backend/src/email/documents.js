// Loads what an invoice or quote email shows: the customer, the lines and the totals.

const { invoiceTotals, withBilling } = require("../billing/billing");
const { BILLING_JOINS, ORDER_BILLING_COLUMNS } = require("../billing/queries");
const { dateOnly, quoteNumber } = require("../quotes/quoteRules");

/** A local date as YYYY-MM-DD, so it reads the same in every time zone. */
function localDay(date) {
    const day = new Date(date);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function invoiceNumber(order) {
    const year = new Date(order.created_at).getFullYear();
    return `INV-${year}-${String(order.id).padStart(6, "0")}`;
}

async function loadCustomer(connection, customerId) {
    const [[customer]] = await connection.query(
        "SELECT id, company_name, contact_name, email, email_language, payment_reminders FROM customers WHERE id = ?",
        [customerId]
    );
    return customer ?? null;
}

/** An order as an invoice email needs it, or null. */
async function loadInvoice(connection, orderId, now = new Date()) {
    const [[row]] = await connection.query(
        `SELECT ${ORDER_BILLING_COLUMNS}
         FROM orders o
         INNER JOIN customers c ON c.id = o.customer_id
         ${BILLING_JOINS}
         WHERE o.id = ?`,
        [orderId]
    );
    if (!row) return null;

    const order = withBilling(row, now);
    const [items] = await connection.query(
        `SELECT p.name AS product_name, oi.quantity, oi.unit_price
         FROM order_items oi INNER JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? ORDER BY oi.id`,
        [orderId]
    );
    const { subtotal, vat, total } = invoiceTotals(order.total_amount);
    return {
        order_id: order.id,
        status: order.status,
        number: invoiceNumber(order),
        customer: await loadCustomer(connection, order.customer_id),
        due_date: localDay(order.billing.due_date),
        items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
        subtotal,
        vat,
        total,
        credited: order.billing.credited,
        paid: order.billing.amount_paid,
        balance: order.billing.balance,
        billing: order.billing
    };
}

/** A quote as a quote email needs it, or null. */
async function loadQuote(connection, quoteId) {
    const [[quote]] = await connection.query("SELECT id, customer_id, status, total_amount, valid_until, created_at FROM quotes WHERE id = ?", [quoteId]);
    if (!quote) return null;
    const [items] = await connection.query(
        `SELECT p.name AS product_name, qi.quantity, qi.unit_price
         FROM quote_items qi INNER JOIN products p ON p.id = qi.product_id
         WHERE qi.quote_id = ? ORDER BY qi.id`,
        [quoteId]
    );
    const { subtotal, vat, total } = invoiceTotals(quote.total_amount);
    return {
        quote_id: quote.id,
        status: quote.status,
        number: quoteNumber(quote),
        customer: await loadCustomer(connection, quote.customer_id),
        valid_until: dateOnly(quote.valid_until),
        items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
        subtotal,
        vat,
        total
    };
}

module.exports = { invoiceNumber, loadCustomer, loadInvoice, loadQuote, localDay };
