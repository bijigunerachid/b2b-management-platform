const pool = require("../config/database");
const { invoiceTotals } = require("../billing/billing");
const { OrderPlacementError, placeOrder } = require("../services/orderPlacement");
const { loadPricingContext } = require("../pricing/pricing");
const { resolvePrice } = require("../pricing/pricingRules");
const {
    DEFAULT_VALIDITY_DAYS,
    addDays,
    allowedActions,
    canPerform,
    dateOnly,
    daysLeft,
    effectiveStatus,
    parseQuotePayload,
    quoteNumber
} = require("../quotes/quoteRules");

class QuoteError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** API shape: derived status, number, allowed actions, VAT-inclusive total. */
function serialize(row, now = new Date()) {
    const { vat, total } = invoiceTotals(row.total_amount);
    return {
        ...row,
        total_amount: Number(row.total_amount),
        valid_until: dateOnly(row.valid_until),
        number: quoteNumber(row),
        status: effectiveStatus(row, now),
        stored_status: row.status,
        days_left: daysLeft(row, now),
        actions: allowedActions(row, now),
        vat,
        total_with_vat: total
    };
}

/** Wraps a handler in a transaction; QuoteError/OrderPlacementError become 4xx. */
function inTransaction(handler) {
    return async (req, res) => {
        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const result = await handler(connection, req);

            await connection.commit();
            return res.status(result.status ?? 200).json({ success: true, ...result.body });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => {});

            if (error instanceof QuoteError || error instanceof OrderPlacementError) {
                return res.status(error.status).json({ success: false, message: error.message });
            }

            console.error("Quote error:", error);
            return res.status(500).json({ success: false, message: "The quote could not be processed." });
        } finally {
            if (connection) connection.release();
        }
    };
}

async function lockQuote(connection, idParam) {
    const id = parseId(idParam);
    if (!id) throw new QuoteError(400, "Invalid quote ID");

    const [rows] = await connection.query("SELECT * FROM quotes WHERE id = ? FOR UPDATE", [id]);
    if (rows.length === 0) throw new QuoteError(404, "Quote not found");

    return rows[0];
}

function requireAction(quote, action) {
    if (!canPerform(quote, action)) {
        const status = effectiveStatus(quote);
        throw new QuoteError(409, `A ${status.toLowerCase()} quote can't be ${{
            edit: "edited",
            send: "sent",
            delete: "deleted",
            accept: "accepted",
            reject: "rejected",
            convert: "converted"
        }[action] ?? action}.`);
    }
}

/** Checks products and prices lines. Unpriced lines get the customer's price. */
async function priceLines(connection, customerId, lines) {
    const pricing = await loadPricingContext(connection, customerId);
    if (!pricing) throw new QuoteError(404, "Customer not found");

    const ids = [...lines.keys()];
    const [products] = await connection.query(
        "SELECT id, name, price, category_id, is_active FROM products WHERE id IN (?)",
        [ids]
    );
    const byId = new Map(products.map((product) => [product.id, product]));

    let totalCents = 0;
    const priced = [];

    for (const [productId, { quantity, unitPrice }] of lines) {
        const product = byId.get(productId);
        if (!product) throw new QuoteError(400, `Product ${productId} was not found.`);
        if (!product.is_active) throw new QuoteError(400, `${product.name} is inactive and can't be quoted.`);

        const listPrice = Number(product.price);
        const price = unitPrice ?? resolvePrice(pricing, product, quantity).unitPrice;
        totalCents += Math.round(price * 100) * quantity;

        priced.push({ productId, quantity, unitPrice: price, listPrice });
    }

    if (!Number.isSafeInteger(totalCents) || totalCents / 100 > 9999999999.99) {
        throw new QuoteError(400, "The quote total is too large.");
    }

    return { items: priced, total: (totalCents / 100).toFixed(2) };
}

async function insertItems(connection, quoteId, items) {
    await connection.query(
        "INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, list_price) VALUES ?",
        [items.map((item) => [quoteId, item.productId, item.quantity, item.unitPrice, item.listPrice])]
    );
}

/* ---------- Reads ---------- */

// GET /api/quotes
const listQuotes = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT q.*, c.company_name, COUNT(qi.id) AS item_count
            FROM quotes q
            INNER JOIN customers c ON c.id = q.customer_id
            LEFT JOIN quote_items qi ON qi.quote_id = q.id
            GROUP BY q.id
            ORDER BY q.id DESC
        `);

        const now = new Date();
        return res.json({ success: true, count: rows.length, data: rows.map((row) => serialize(row, now)) });
    } catch (error) {
        console.error("List quotes error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve quotes" });
    }
};

// GET /api/quotes/:id
const getQuote = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid quote ID" });

    try {
        const [rows] = await pool.query(
            `SELECT q.*, c.company_name,
                    CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
             FROM quotes q
             INNER JOIN customers c ON c.id = q.customer_id
             LEFT JOIN users u ON u.id = q.created_by
             WHERE q.id = ?`,
            [id]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Quote not found" });

        // Current stock/active state lets the UI warn before converting.
        const [items] = await pool.query(
            `SELECT qi.product_id, p.name AS product_name, qi.quantity,
                    qi.unit_price, qi.list_price,
                    (qi.quantity * qi.unit_price) AS subtotal,
                    p.stock AS current_stock, p.is_active AS product_active
             FROM quote_items qi
             INNER JOIN products p ON p.id = qi.product_id
             WHERE qi.quote_id = ?
             ORDER BY qi.id`,
            [id]
        );

        return res.json({ success: true, data: { ...serialize(rows[0]), items } });
    } catch (error) {
        console.error("Get quote error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve quote" });
    }
};

/* ---------- Writes ---------- */

// POST /api/quotes
const createQuote = inTransaction(async (connection, req) => {
    const { value, error } = parseQuotePayload(req.body);
    if (error) throw new QuoteError(400, error);

    const { items, total } = await priceLines(connection, value.customerId, value.lines);

    const [result] = await connection.query(
        `INSERT INTO quotes (customer_id, valid_until, notes, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [value.customerId, value.validUntil, value.notes, total, req.user.userId]
    );
    await insertItems(connection, result.insertId, items);

    return { status: 201, body: { message: "Quote created", data: { quoteId: result.insertId } } };
});

// PUT /api/quotes/:id (Draft only)
const updateQuote = inTransaction(async (connection, req) => {
    const quote = await lockQuote(connection, req.params.id);
    requireAction(quote, "edit");

    const { value, error } = parseQuotePayload(req.body);
    if (error) throw new QuoteError(400, error);

    const { items, total } = await priceLines(connection, value.customerId, value.lines);

    await connection.query(
        "UPDATE quotes SET customer_id = ?, valid_until = ?, notes = ?, total_amount = ? WHERE id = ?",
        [value.customerId, value.validUntil, value.notes, total, quote.id]
    );
    await connection.query("DELETE FROM quote_items WHERE quote_id = ?", [quote.id]);
    await insertItems(connection, quote.id, items);

    return { body: { message: "Quote updated" } };
});

// DELETE /api/quotes/:id (Draft only; sent quotes are part of the record)
const deleteQuote = inTransaction(async (connection, req) => {
    const quote = await lockQuote(connection, req.params.id);
    requireAction(quote, "delete");

    await connection.query("DELETE FROM quotes WHERE id = ?", [quote.id]);
    return { body: { message: "Draft deleted" } };
});

// POST /api/quotes/:id/send
const sendQuote = inTransaction(async (connection, req) => {
    const quote = await lockQuote(connection, req.params.id);
    requireAction(quote, "send");

    if (dateOnly(quote.valid_until) < dateOnly(new Date())) {
        throw new QuoteError(409, "This draft's validity date has passed. Edit it before sending.");
    }

    await connection.query("UPDATE quotes SET status = 'Sent', sent_at = NOW() WHERE id = ?", [quote.id]);
    return { body: { message: "Quote marked as sent" } };
});

// POST /api/quotes/:id/accept and /reject
function decide(decision) {
    return inTransaction(async (connection, req) => {
        const quote = await lockQuote(connection, req.params.id);
        requireAction(quote, decision === "Accepted" ? "accept" : "reject");

        await connection.query("UPDATE quotes SET status = ?, decided_at = NOW() WHERE id = ?", [decision, quote.id]);
        return { body: { message: decision === "Accepted" ? "Quote accepted" : "Quote rejected" } };
    });
}

// POST /api/quotes/:id/convert → creates a Pending order at the quoted prices
const convertQuote = inTransaction(async (connection, req) => {
    const quote = await lockQuote(connection, req.params.id);
    requireAction(quote, "convert");

    const [items] = await connection.query(
        "SELECT product_id, quantity, unit_price FROM quote_items WHERE quote_id = ?",
        [quote.id]
    );

    const lines = new Map(
        items.map((item) => [item.product_id, { quantity: item.quantity, unitPrice: Number(item.unit_price) }])
    );

    const { orderId, total } = await placeOrder(connection, quote.customer_id, lines, { userId: req.user.userId });

    await connection.query(
        "UPDATE quotes SET status = 'Converted', converted_at = NOW(), order_id = ? WHERE id = ?",
        [orderId, quote.id]
    );

    return { status: 201, body: { message: "Quote converted to an order", data: { orderId, total_amount: total } } };
});

// POST /api/quotes/:id/duplicate → new Draft with the same lines and prices
const duplicateQuote = inTransaction(async (connection, req) => {
    const quote = await lockQuote(connection, req.params.id);

    const [items] = await connection.query(
        `SELECT qi.product_id, qi.quantity, qi.unit_price
         FROM quote_items qi
         INNER JOIN products p ON p.id = qi.product_id
         WHERE qi.quote_id = ? AND p.is_active = 1`,
        [quote.id]
    );

    if (items.length === 0) {
        throw new QuoteError(409, "None of this quote's products are still active.");
    }

    const lines = new Map(
        items.map((item) => [item.product_id, { quantity: item.quantity, unitPrice: Number(item.unit_price) }])
    );
    const { items: priced, total } = await priceLines(connection, quote.customer_id, lines);

    const [result] = await connection.query(
        `INSERT INTO quotes (customer_id, valid_until, notes, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [quote.customer_id, dateOnly(addDays(new Date(), DEFAULT_VALIDITY_DAYS)), quote.notes, total, req.user.userId]
    );
    await insertItems(connection, result.insertId, priced);

    return { status: 201, body: { message: "Quote duplicated as a new draft", data: { quoteId: result.insertId } } };
});

module.exports = {
    acceptQuote: decide("Accepted"),
    convertQuote,
    createQuote,
    deleteQuote,
    duplicateQuote,
    getQuote,
    listQuotes,
    rejectQuote: decide("Rejected"),
    sendQuote,
    updateQuote
};
