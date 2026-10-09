// Customer-facing portal API. Every query is scoped to req.user.customerId,
// which comes from the session (never from the request). Records belonging
// to other customers are reported as "not found", so IDs can't be probed.

const pool = require("../config/database");
const { ageingReport, invoiceTotals, withBilling } = require("../billing/billing");
const { ORDER_BILLING_COLUMNS, BILLING_JOINS } = require("../billing/queries");
const { HttpError, withTransaction } = require("../services/transaction");
const { placeOrder } = require("../services/orderPlacement");
const { loadCreditNote, serializeCreditNote } = require("../services/creditNotes");
const { describePrice, loadPricingContext } = require("../pricing/pricing");
const { priceItems } = require("./pricingController");
const { allowedActions, canPerform, daysLeft, dateOnly, effectiveStatus, quoteNumber } = require("../quotes/quoteRules");

const CATALOG_PAGE_SIZE = 24;
const MAX_CART_LINES = 50;

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Availability without revealing exact stock levels. */
function availability(product) {
    const stock = Number(product.stock);
    if (!product.is_active || stock <= 0) return "out_of_stock";
    if (product.reorder_point > 0 && stock <= product.reorder_point) return "low_stock";
    return "in_stock";
}

function publicQuote(row, now = new Date()) {
    const { vat, total } = invoiceTotals(row.total_amount);
    const status = effectiveStatus(row, now);
    return {
        id: row.id,
        number: quoteNumber(row),
        status,
        valid_until: dateOnly(row.valid_until),
        days_left: daysLeft(row, now),
        notes: row.notes,
        created_at: row.created_at,
        sent_at: row.sent_at,
        decided_at: row.decided_at,
        order_id: row.order_id,
        item_count: row.item_count,
        total_amount: Number(row.total_amount),
        vat,
        total_with_vat: total,
        // Customers can only accept or reject.
        actions: allowedActions(row, now).filter((action) => action === "accept" || action === "reject")
    };
}

/* ---------- Overview ---------- */

// GET /api/portal/summary
const getSummary = async (req, res) => {
    const customerId = req.user.customerId;

    try {
        const [[customer]] = await pool.query(
            "SELECT id, company_name, contact_name, email, phone, address, city, country FROM customers WHERE id = ?",
            [customerId]
        );

        const [orders] = await pool.query(
            `SELECT ${ORDER_BILLING_COLUMNS}
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
             ${BILLING_JOINS}
             WHERE o.customer_id = ?
             ORDER BY o.id DESC`,
            [customerId]
        );

        const withMoney = orders.map((order) => withBilling(order));
        const open = withMoney.filter((order) => order.status !== "Cancelled" && order.billing.balance > 0);
        const receivables = ageingReport(open);

        const [[quotes]] = await pool.query(
            `SELECT SUM(status = 'Sent' AND valid_until >= CURDATE()) AS awaiting
             FROM quotes WHERE customer_id = ?`,
            [customerId]
        );

        return res.json({
            success: true,
            data: {
                customer,
                balance: receivables.outstanding,
                overdue: receivables.overdue,
                overdue_count: receivables.overdue_count,
                orders_in_progress: withMoney.filter((order) => order.status === "Pending" || order.status === "Processing").length,
                quotes_awaiting: Number(quotes.awaiting ?? 0),
                recent_orders: withMoney.slice(0, 5).map(({ amount_paid: _paid, ...order }) => order)
            }
        });
    } catch (error) {
        console.error("Portal summary error:", error);
        return res.status(500).json({ success: false, message: "Could not load your account summary." });
    }
};

/* ---------- Catalog ---------- */

// GET /api/portal/catalog?search=&category_id=&page=
const getCatalog = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const categoryId = Number.parseInt(req.query.category_id, 10);

    const conditions = ["p.is_active = 1"];
    const params = [];

    if (search) {
        conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }
    if (Number.isSafeInteger(categoryId) && categoryId > 0) {
        conditions.push("p.category_id = ?");
        params.push(categoryId);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    try {
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${where}`, params);
        const [rows] = await pool.query(
            `SELECT p.id, p.name, p.description, p.price, p.stock, p.reorder_point, p.is_active,
                    p.category_id, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             ${where}
             ORDER BY (p.stock > 0) DESC, p.name
             LIMIT ? OFFSET ?`,
            [...params, CATALOG_PAGE_SIZE, (page - 1) * CATALOG_PAGE_SIZE]
        );
        const pricing = await loadPricingContext(pool, req.user.customerId);
        const [categories] = await pool.query(
            `SELECT c.id, c.name, COUNT(p.id) AS product_count
             FROM categories c
             INNER JOIN products p ON p.category_id = c.id AND p.is_active = 1
             GROUP BY c.id
             ORDER BY c.name`
        );

        return res.json({
            success: true,
            data: rows.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description,
                price: Number(product.price),
                ...yourPrice(pricing, product),
                category_id: product.category_id,
                category_name: product.category_name,
                availability: availability(product)
            })),
            categories,
            pagination: { page, limit: CATALOG_PAGE_SIZE, total: Number(total), totalPages: Math.ceil(Number(total) / CATALOG_PAGE_SIZE) }
        });
    } catch (error) {
        console.error("Portal catalog error:", error);
        return res.status(500).json({ success: false, message: "Could not load the catalog." });
    }
};

/** The customer's price for one unit, and the cheaper prices from volume breaks. */
function yourPrice(pricing, product) {
    const single = describePrice(pricing, product, 1);
    const tiers = [];

    if (single.price_source !== "contract") {
        const quantities = [...new Set(pricing.breaks.map((rule) => rule.min_quantity))].sort((a, b) => a - b);
        let last = single.unit_price;
        for (const quantity of quantities) {
            const tier = describePrice(pricing, product, quantity);
            if (tier.unit_price < last) {
                tiers.push({ min_quantity: quantity, unit_price: tier.unit_price });
                last = tier.unit_price;
            }
        }
    }

    return { your_price: single.unit_price, price_label: single.label, volume_prices: tiers };
}

// POST /api/portal/cart/price { items: [{ product_id, quantity }] }
const priceCart = withTransaction(async (connection, req) => {
    const result = await priceItems(connection, req.user.customerId, req.body?.items, { activeOnly: true });
    return { body: { data: { lines: result.lines } } };
}, "Could not price your cart.");

/* ---------- Orders ---------- */

// GET /api/portal/orders
const listOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${ORDER_BILLING_COLUMNS}, COUNT(oi.id) AS item_count
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
             ${BILLING_JOINS}
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.customer_id = ?
             GROUP BY o.id
             ORDER BY o.id DESC`,
            [req.user.customerId]
        );

        const now = new Date();
        return res.json({ success: true, data: rows.map((row) => withBilling(row, now)) });
    } catch (error) {
        console.error("Portal orders error:", error);
        return res.status(500).json({ success: false, message: "Could not load your orders." });
    }
};

// GET /api/portal/orders/:id — order, lines, billing, payments, and billing address
const getOrder = async (req, res) => {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(404).json({ success: false, message: "Order not found" });

    try {
        const [rows] = await pool.query(
            `SELECT ${ORDER_BILLING_COLUMNS}
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
             ${BILLING_JOINS}
             WHERE o.id = ? AND o.customer_id = ?`,
            [orderId, req.user.customerId]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Order not found" });

        const [items] = await pool.query(
            `SELECT oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.list_price,
                    (oi.quantity * oi.unit_price) AS subtotal, p.is_active AS product_active
             FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?
             ORDER BY oi.id`,
            [orderId]
        );
        const [payments] = await pool.query(
            `SELECT id, amount, method, reference, paid_at
             FROM payments
             WHERE order_id = ? AND voided_at IS NULL
             ORDER BY paid_at, id`,
            [orderId]
        );
        const [[customer]] = await pool.query(
            "SELECT company_name, contact_name, email, phone, address, city, country FROM customers WHERE id = ?",
            [req.user.customerId]
        );

        const [creditNotes] = await pool.query(
            "SELECT id, reason, total, refund_amount, refund_method, created_at FROM credit_notes WHERE order_id = ? ORDER BY id",
            [orderId]
        );

        return res.json({
            success: true,
            data: { ...withBilling(rows[0]), items, payments, credit_notes: creditNotes.map(serializeCreditNote), customer }
        });
    } catch (error) {
        console.error("Portal order error:", error);
        return res.status(500).json({ success: false, message: "Could not load the order." });
    }
};

// GET /api/portal/credit-notes/:id
const getCreditNote = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, message: "Credit note not found" });

    try {
        const creditNote = await loadCreditNote(pool, id, req.user.customerId);
        if (!creditNote) return res.status(404).json({ success: false, message: "Credit note not found" });

        // Staff names stay internal.
        delete creditNote.created_by_name;
        return res.json({ success: true, data: creditNote });
    } catch (error) {
        console.error("Portal credit note error:", error);
        return res.status(500).json({ success: false, message: "Could not load the credit note." });
    }
};

// POST /api/portal/orders { items: [{ product_id, quantity }], note? }
const placePortalOrder = withTransaction(async (connection, req) => {
    const items = req.body?.items;

    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "Your cart is empty.");
    if (items.length > MAX_CART_LINES) throw new HttpError(400, `An order can contain at most ${MAX_CART_LINES} products.`);

    const lines = new Map();
    for (const item of items) {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
            throw new HttpError(400, "Each product needs a whole quantity of at least 1.");
        }
        lines.set(productId, { quantity: (lines.get(productId)?.quantity ?? 0) + quantity });
    }

    // Always the signed-in customer's own account, at current catalog prices.
    const { orderId, total } = await placeOrder(connection, req.user.customerId, lines, { userId: req.user.userId });

    return { status: 201, body: { message: "Order placed", data: { orderId, total_amount: total } } };
}, "Your order could not be placed.");

/* ---------- Quotes ---------- */

// GET /api/portal/quotes — drafts are internal and never shown
const listQuotes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT q.*, COUNT(qi.id) AS item_count
             FROM quotes q
             LEFT JOIN quote_items qi ON qi.quote_id = q.id
             WHERE q.customer_id = ? AND q.status <> 'Draft'
             GROUP BY q.id
             ORDER BY q.id DESC`,
            [req.user.customerId]
        );
        const now = new Date();
        return res.json({ success: true, data: rows.map((row) => publicQuote(row, now)) });
    } catch (error) {
        console.error("Portal quotes error:", error);
        return res.status(500).json({ success: false, message: "Could not load your quotes." });
    }
};

// GET /api/portal/quotes/:id
const getQuote = async (req, res) => {
    const quoteId = parseId(req.params.id);
    if (!quoteId) return res.status(404).json({ success: false, message: "Quote not found" });

    try {
        const [rows] = await pool.query(
            `SELECT q.*, 0 AS item_count FROM quotes q
             WHERE q.id = ? AND q.customer_id = ? AND q.status <> 'Draft'`,
            [quoteId, req.user.customerId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Quote not found" });

        const [items] = await pool.query(
            `SELECT qi.product_id, p.name AS product_name, qi.quantity, qi.unit_price, qi.list_price,
                    (qi.quantity * qi.unit_price) AS subtotal
             FROM quote_items qi
             INNER JOIN products p ON p.id = qi.product_id
             WHERE qi.quote_id = ?
             ORDER BY qi.id`,
            [quoteId]
        );
        const [[customer]] = await pool.query(
            "SELECT company_name, contact_name, email, phone, address, city, country FROM customers WHERE id = ?",
            [req.user.customerId]
        );

        return res.json({
            success: true,
            data: { ...publicQuote({ ...rows[0], item_count: items.length }), customer_id: req.user.customerId, company_name: customer.company_name, items, customer }
        });
    } catch (error) {
        console.error("Portal quote error:", error);
        return res.status(500).json({ success: false, message: "Could not load the quote." });
    }
};

// POST /api/portal/quotes/:id/accept and /reject — customer decides
function decide(decision) {
    return withTransaction(async (connection, req) => {
        const quoteId = parseId(req.params.id);
        if (!quoteId) throw new HttpError(404, "Quote not found");

        const [rows] = await connection.query(
            "SELECT * FROM quotes WHERE id = ? AND customer_id = ? AND status <> 'Draft' FOR UPDATE",
            [quoteId, req.user.customerId]
        );
        const quote = rows[0];
        if (!quote) throw new HttpError(404, "Quote not found");

        const action = decision === "Accepted" ? "accept" : "reject";
        if (!canPerform(quote, action)) {
            const status = effectiveStatus(quote);
            throw new HttpError(409, status === "Expired" ? "This quote has expired. Contact us for a new one." : `This quote is already ${status.toLowerCase()}.`);
        }

        await connection.query("UPDATE quotes SET status = ?, decided_at = NOW() WHERE id = ?", [decision, quote.id]);
        return {
            body: {
                message: decision === "Accepted" ? "Quote accepted. We'll turn it into an order." : "Quote declined."
            }
        };
    }, "Your answer could not be recorded.");
}

module.exports = {
    acceptQuote: decide("Accepted"),
    availability,
    getCatalog,
    getCreditNote,
    priceCart,
    getOrder,
    getQuote,
    getSummary,
    listOrders,
    listQuotes,
    placePortalOrder,
    rejectQuote: decide("Rejected")
};
