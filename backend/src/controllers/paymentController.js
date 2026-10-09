const pool = require("../config/database");
const {
    EPSILON,
    ageingReport,
    round2,
    withBilling
} = require("../billing/billing");
const { BILLING_JOINS, ORDER_BILLING_COLUMNS, loadOpenInvoices, loadOrderBilling } = require("../billing/queries");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Local calendar date as YYYY-MM-DD. */
function toDateOnly(date) {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PAYMENT_COLUMNS = `
    p.id, p.order_id, p.amount, p.method, p.reference, p.paid_at, p.note,
    p.created_at, p.voided_at, p.void_reason,
    CONCAT(r.first_name, ' ', r.last_name) AS recorded_by_name,
    CONCAT(v.first_name, ' ', v.last_name) AS voided_by_name`;

const PAYMENT_JOINS = `
    LEFT JOIN users r ON r.id = p.recorded_by
    LEFT JOIN users v ON v.id = p.voided_by`;

async function loadPayments(connection, orderId) {
    const [rows] = await connection.query(
        `SELECT ${PAYMENT_COLUMNS}
         FROM payments p ${PAYMENT_JOINS}
         WHERE p.order_id = ?
         ORDER BY p.paid_at DESC, p.id DESC`,
        [orderId]
    );
    return rows.map((row) => ({ ...row, paid_at: toDateOnly(row.paid_at) }));
}

// GET /api/orders/:id/payments
const getOrderPayments = async (req, res) => {
    const orderId = parseId(req.params.id);

    if (!orderId) {
        return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    try {
        const [orders] = await pool.query(
            `SELECT ${ORDER_BILLING_COLUMNS}
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
             ${BILLING_JOINS}
             WHERE o.id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        return res.json({
            success: true,
            data: {
                billing: withBilling(orders[0]).billing,
                payments: await loadPayments(pool, orderId)
            }
        });
    } catch (error) {
        console.error("Get payments error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve payments" });
    }
};

// POST /api/orders/:id/payments
const recordPayment = async (req, res) => {
    const orderId = parseId(req.params.id);

    if (!orderId) {
        return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const amount = round2(req.body.amount);
    const { method } = req.body;
    const reference = req.body.reference?.trim() || null;
    const note = req.body.note?.trim() || null;
    const today = toDateOnly(new Date());
    const paidAt = req.body.paid_at || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(new Date(`${paidAt}T00:00:00`).getTime())) {
        return res.status(400).json({ success: false, message: "paid_at must be a date (YYYY-MM-DD)." });
    }

    if (paidAt > today) {
        return res.status(400).json({ success: false, message: "Payment date cannot be in the future." });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lock the order row so concurrent payments can't overpay it.
        const [orders] = await connection.query(
            "SELECT id, status, total_amount, created_at FROM orders WHERE id = ? FOR UPDATE",
            [orderId]
        );
        const order = orders[0];

        if (!order) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === "Cancelled") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Payments can't be recorded on a cancelled order." });
        }

        if (paidAt < toDateOnly(order.created_at)) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Payment date can't be before the order date." });
        }

        const billing = await loadOrderBilling(connection, order);

        if (billing.balance <= EPSILON) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "This invoice is already paid in full." });
        }

        if (amount > billing.balance + EPSILON) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Amount exceeds the balance due (${billing.balance.toFixed(2)} MAD).`
            });
        }

        const [result] = await connection.query(
            `INSERT INTO payments (order_id, amount, method, reference, paid_at, note, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, amount, method, reference, paidAt, note, req.user.userId]
        );

        const updated = await loadOrderBilling(connection, order);
        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Payment recorded",
            data: {
                paymentId: result.insertId,
                billing: updated
            }
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Record payment error:", error);
        return res.status(500).json({ success: false, message: "Failed to record payment" });
    } finally {
        if (connection) connection.release();
    }
};

// PATCH /api/payments/:id/void
const voidPayment = async (req, res) => {
    const paymentId = parseId(req.params.id);

    if (!paymentId) {
        return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [payments] = await connection.query("SELECT id, order_id, amount, voided_at FROM payments WHERE id = ?", [paymentId]);
        const payment = payments[0];

        if (!payment) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        const [orders] = await connection.query(
            "SELECT id, status, total_amount, created_at FROM orders WHERE id = ? FOR UPDATE",
            [payment.order_id]
        );
        const [[current]] = await connection.query("SELECT voided_at FROM payments WHERE id = ?", [paymentId]);

        if (current.voided_at) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "This payment is already voided." });
        }

        // Refunds on credit notes were paid out of this money, so it can't disappear.
        const billing = await loadOrderBilling(connection, orders[0]);
        if (billing.amount_paid - Number(payment.amount) < -EPSILON) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Part of this payment was refunded on a credit note, so it can't be voided."
            });
        }

        await connection.query(
            "UPDATE payments SET voided_at = NOW(), voided_by = ?, void_reason = ? WHERE id = ?",
            [req.user.userId, req.body.reason.trim(), paymentId]
        );
        await connection.commit();

        return res.json({ success: true, message: "Payment voided" });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Void payment error:", error);
        return res.status(500).json({ success: false, message: "Failed to void payment" });
    } finally {
        if (connection) connection.release();
    }
};

// GET /api/receivables
const getReceivables = async (req, res) => {
    try {
        const open = await loadOpenInvoices(pool);
        const report = ageingReport(open);

        open.sort(
            (a, b) =>
                b.billing.days_overdue - a.billing.days_overdue ||
                b.billing.balance - a.billing.balance
        );

        return res.json({
            success: true,
            data: {
                ...report,
                invoices: open.map((order) => ({
                    id: order.id,
                    customer_id: order.customer_id,
                    company_name: order.company_name,
                    status: order.status,
                    created_at: order.created_at,
                    billing: order.billing
                }))
            }
        });
    } catch (error) {
        console.error("Receivables error:", error);
        return res.status(500).json({ success: false, message: "Failed to load receivables" });
    }
};

module.exports = {
    getOrderPayments,
    getReceivables,
    recordPayment,
    voidPayment
};
