const pool = require("../config/database");
const { HttpError, withTransaction } = require("../services/transaction");
const { createCreditNote, loadCreditNote, loadOrderReturns, serializeCreditNote } = require("../services/creditNotes");
const { canReturn, parseReturnPayload } = require("../returns/returnRules");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// GET /api/orders/:id/credit-notes
const getOrderReturns = async (req, res) => {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: "Invalid order ID" });

    try {
        const [orders] = await pool.query("SELECT id, status FROM orders WHERE id = ?", [orderId]);
        if (orders.length === 0) return res.status(404).json({ success: false, message: "Order not found" });

        const returns = await loadOrderReturns(pool, orderId);
        return res.json({
            success: true,
            data: {
                ...returns,
                can_return: canReturn(orders[0]) && returns.lines.some((line) => line.returnable > 0)
            }
        });
    } catch (error) {
        console.error("Order returns error:", error);
        return res.status(500).json({ success: false, message: "Failed to load returns" });
    }
};

// POST /api/orders/:id/credit-notes
const createOrderCreditNote = withTransaction(async (connection, req) => {
    const orderId = parseId(req.params.id);
    if (!orderId) throw new HttpError(400, "Invalid order ID");

    const { error, value } = parseReturnPayload(req.body);
    if (error) throw new HttpError(400, error);

    const creditNote = await createCreditNote(connection, { orderId, ...value, userId: req.user.userId });
    return { status: 201, body: { message: `Credit note ${creditNote.number} created`, data: creditNote } };
}, "Failed to create the credit note");

// GET /api/credit-notes
const listCreditNotes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT cn.id, cn.order_id, cn.reason, cn.subtotal, cn.vat, cn.total, cn.refund_amount,
                    cn.refund_method, cn.created_at, o.customer_id, c.company_name,
                    (SELECT SUM(quantity) FROM credit_note_items WHERE credit_note_id = cn.id) AS units
             FROM credit_notes cn
             INNER JOIN orders o ON o.id = cn.order_id
             INNER JOIN customers c ON c.id = o.customer_id
             ORDER BY cn.id DESC`
        );
        return res.json({ success: true, count: rows.length, data: rows.map(serializeCreditNote) });
    } catch (error) {
        console.error("Credit notes error:", error);
        return res.status(500).json({ success: false, message: "Failed to load credit notes" });
    }
};

// GET /api/credit-notes/:id
const getCreditNote = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid credit note ID" });

    try {
        const creditNote = await loadCreditNote(pool, id);
        if (!creditNote) return res.status(404).json({ success: false, message: "Credit note not found" });
        return res.json({ success: true, data: creditNote });
    } catch (error) {
        console.error("Credit note error:", error);
        return res.status(500).json({ success: false, message: "Failed to load the credit note" });
    }
};

module.exports = { createOrderCreditNote, getCreditNote, getOrderReturns, listCreditNotes };
