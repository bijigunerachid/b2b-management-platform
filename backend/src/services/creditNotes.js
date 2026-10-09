const { loadOrderBilling } = require("../billing/queries");
const { recordMovement } = require("./inventory");
const { HttpError } = require("./transaction");
const { buildCreditNote, canReturn, creditNoteNumber, returnableLines } = require("../returns/returnRules");

async function loadOrderLines(connection, orderId) {
    const [rows] = await connection.query(
        `SELECT oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price,
                COALESCE(r.returned, 0) AS returned
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         LEFT JOIN (
            SELECT ci.product_id, SUM(ci.quantity) AS returned
            FROM credit_note_items ci
            INNER JOIN credit_notes cn ON cn.id = ci.credit_note_id
            WHERE cn.order_id = ?
            GROUP BY ci.product_id
         ) r ON r.product_id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id`,
        [orderId, orderId]
    );
    return rows;
}

/**
 * Creates a credit note for a completed order inside the caller's transaction:
 * locks the order, checks the quantities, puts restocked goods back into the
 * ledger, and records any refund.
 */
async function createCreditNote(connection, { orderId, reason, note, refundMethod, lines: requested, userId = null, createdAt = null }) {
    const [orders] = await connection.query(
        "SELECT id, status, total_amount, created_at FROM orders WHERE id = ? FOR UPDATE",
        [orderId]
    );
    const order = orders[0];

    if (!order) throw new HttpError(404, "Order not found");
    if (!canReturn(order)) throw new HttpError(409, "Only completed orders can be returned.");

    const billing = await loadOrderBilling(connection, order);
    const result = buildCreditNote({ orderLines: await loadOrderLines(connection, orderId), requested, billing });
    if (result.error) throw new HttpError(result.status, result.error);

    const { lines, subtotal, vat, total, refundAmount } = result.value;

    if (refundAmount > 0 && !refundMethod) {
        throw new HttpError(400, `The customer has already paid for these goods. Choose how the ${refundAmount.toFixed(2)} MAD refund is paid back.`);
    }

    const [inserted] = await connection.query(
        `INSERT INTO credit_notes (order_id, reason, note, subtotal, vat, total, refund_amount, refund_method, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [orderId, reason, note, subtotal, vat, total, refundAmount, refundAmount > 0 ? refundMethod : null, userId, createdAt]
    );
    const creditNoteId = inserted.insertId;

    await connection.query(
        "INSERT INTO credit_note_items (credit_note_id, product_id, quantity, unit_price, restocked) VALUES ?",
        [lines.map((line) => [creditNoteId, line.productId, line.quantity, line.unitPrice, line.restock])]
    );

    const [[{ created_at: noteDate }]] = await connection.query("SELECT created_at FROM credit_notes WHERE id = ?", [creditNoteId]);
    const number = creditNoteNumber({ id: creditNoteId, created_at: noteDate });

    // Same lock order as order placement: by product id.
    const restocked = lines.filter((line) => line.restock).sort((a, b) => a.productId - b.productId);
    for (const line of restocked) {
        await recordMovement(connection, {
            productId: line.productId,
            quantity: line.quantity,
            type: "customer_return",
            reason: `Returned on ${number}`,
            orderId,
            creditNoteId,
            userId
        });
    }

    return { id: creditNoteId, number, subtotal, vat, total, refund_amount: refundAmount };
}

/** Lines that can still be returned and the credit notes already issued for an order. */
async function loadOrderReturns(connection, orderId) {
    const lines = returnableLines(await loadOrderLines(connection, orderId));
    const [notes] = await connection.query(
        `SELECT cn.id, cn.reason, cn.total, cn.refund_amount, cn.refund_method, cn.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
                (SELECT SUM(quantity) FROM credit_note_items WHERE credit_note_id = cn.id) AS units
         FROM credit_notes cn
         LEFT JOIN users u ON u.id = cn.created_by
         WHERE cn.order_id = ?
         ORDER BY cn.id DESC`,
        [orderId]
    );

    return {
        lines,
        credit_notes: notes.map((row) => serializeCreditNote(row))
    };
}

function serializeCreditNote(row) {
    const result = {
        ...row,
        number: creditNoteNumber(row),
        total: Number(row.total),
        refund_amount: Number(row.refund_amount)
    };
    if (row.subtotal !== undefined) result.subtotal = Number(row.subtotal);
    if (row.vat !== undefined) result.vat = Number(row.vat);
    if (row.units !== undefined) result.units = Number(row.units);
    return result;
}

/**
 * One credit note with its lines and the customer's billing address, for the
 * printable document. Pass `customerId` to restrict it to that customer (portal).
 */
async function loadCreditNote(connection, id, customerId = null) {
    const [rows] = await connection.query(
        `SELECT cn.id, cn.order_id, cn.reason, cn.note, cn.subtotal, cn.vat, cn.total,
                cn.refund_amount, cn.refund_method, cn.created_at,
                o.created_at AS order_created_at, o.customer_id,
                CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
         FROM credit_notes cn
         INNER JOIN orders o ON o.id = cn.order_id
         LEFT JOIN users u ON u.id = cn.created_by
         WHERE cn.id = ? AND (? IS NULL OR o.customer_id = ?)`,
        [id, customerId, customerId]
    );
    if (rows.length === 0) return null;

    const [items] = await connection.query(
        `SELECT ci.product_id, p.name AS product_name, ci.quantity, ci.unit_price, ci.restocked,
                (ci.quantity * ci.unit_price) AS amount
         FROM credit_note_items ci
         INNER JOIN products p ON p.id = ci.product_id
         WHERE ci.credit_note_id = ?
         ORDER BY ci.id`,
        [id]
    );
    const [[customer]] = await connection.query(
        "SELECT id, company_name, contact_name, email, phone, address, city, country FROM customers WHERE id = ?",
        [rows[0].customer_id]
    );

    return {
        ...serializeCreditNote(rows[0]),
        items: items.map((item) => ({
            ...item,
            unit_price: Number(item.unit_price),
            amount: Number(item.amount),
            restocked: Boolean(item.restocked)
        })),
        customer
    };
}

module.exports = { createCreditNote, loadCreditNote, loadOrderReturns, serializeCreditNote };
