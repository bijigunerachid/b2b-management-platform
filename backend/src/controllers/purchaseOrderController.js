const pool = require("../config/database");
const { HttpError, withTransaction } = require("../services/transaction");
const { recordMovement } = require("../services/inventory");
const { dateOnly } = require("../quotes/quoteRules");
const {
    allowedActions,
    canPerform,
    isLate,
    parsePurchaseOrderPayload,
    poNumber,
    weightedAverageCost
} = require("../purchasing/purchasingRules");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function serialize(row, now = new Date()) {
    return {
        ...row,
        total_amount: Number(row.total_amount),
        expected_at: row.expected_at ? dateOnly(row.expected_at) : null,
        number: poNumber(row),
        late: isLate(row, now),
        actions: allowedActions(row)
    };
}

async function lockPurchaseOrder(connection, idParam) {
    const id = parseId(idParam);
    if (!id) throw new HttpError(400, "Invalid purchase order ID");

    const [rows] = await connection.query("SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE", [id]);
    if (rows.length === 0) throw new HttpError(404, "Purchase order not found");

    return rows[0];
}

function requireAction(po, action) {
    if (!canPerform(po, action)) {
        throw new HttpError(409, `A ${po.status.toLowerCase()} purchase order can't be ${{
            edit: "edited",
            order: "placed",
            receive: "received",
            cancel: "cancelled",
            delete: "deleted"
        }[action]}.`);
    }
}

/** Checks supplier and products; returns priced lines and the total. */
async function priceLines(connection, supplierId, lines) {
    const [suppliers] = await connection.query("SELECT id, is_active FROM suppliers WHERE id = ?", [supplierId]);
    if (suppliers.length === 0) throw new HttpError(404, "Supplier not found");
    if (!suppliers[0].is_active) throw new HttpError(400, "This supplier is inactive.");

    const [products] = await connection.query("SELECT id, name FROM products WHERE id IN (?)", [[...lines.keys()]]);
    const known = new Set(products.map((product) => product.id));

    let totalCents = 0;
    const items = [];

    for (const [productId, { quantity, unitCost }] of lines) {
        if (!known.has(productId)) throw new HttpError(400, `Product ${productId} was not found.`);
        totalCents += Math.round(unitCost * 100) * quantity;
        items.push({ productId, quantity, unitCost });
    }

    if (!Number.isSafeInteger(totalCents) || totalCents / 100 > 9999999999.99) {
        throw new HttpError(400, "The purchase order total is too large.");
    }

    return { items, total: (totalCents / 100).toFixed(2) };
}

async function insertItems(connection, purchaseOrderId, items) {
    await connection.query(
        "INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES ?",
        [items.map((item) => [purchaseOrderId, item.productId, item.quantity, item.unitCost])]
    );
}

/** Inserts a Draft PO; shared by the builder and reorder suggestions. */
async function createDraft(connection, { supplierId, expectedAt, notes, lines, userId }) {
    const { items, total } = await priceLines(connection, supplierId, lines);

    const [result] = await connection.query(
        `INSERT INTO purchase_orders (supplier_id, expected_at, notes, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [supplierId, expectedAt, notes, total, userId]
    );
    await insertItems(connection, result.insertId, items);

    return result.insertId;
}

/* ---------- Reads ---------- */

// GET /api/purchase-orders
const listPurchaseOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT po.*, s.name AS supplier_name,
                   COUNT(poi.id) AS item_count,
                   COALESCE(SUM(poi.quantity), 0) AS unit_count
            FROM purchase_orders po
            INNER JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
            GROUP BY po.id
            ORDER BY po.id DESC
        `);

        const now = new Date();
        return res.json({ success: true, count: rows.length, data: rows.map((row) => serialize(row, now)) });
    } catch (error) {
        console.error("List purchase orders error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve purchase orders" });
    }
};

// GET /api/purchase-orders/:id
const getPurchaseOrder = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid purchase order ID" });

    try {
        const [rows] = await pool.query(
            `SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone,
                    s.lead_time_days, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
             FROM purchase_orders po
             INNER JOIN suppliers s ON s.id = po.supplier_id
             LEFT JOIN users u ON u.id = po.created_by
             WHERE po.id = ?`,
            [id]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Purchase order not found" });

        const [items] = await pool.query(
            `SELECT poi.product_id, p.name AS product_name, poi.quantity, poi.unit_cost,
                    (poi.quantity * poi.unit_cost) AS subtotal,
                    p.stock AS current_stock, p.reorder_point
             FROM purchase_order_items poi
             INNER JOIN products p ON p.id = poi.product_id
             WHERE poi.purchase_order_id = ?
             ORDER BY poi.id`,
            [id]
        );

        return res.json({ success: true, data: { ...serialize(rows[0]), items } });
    } catch (error) {
        console.error("Get purchase order error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve purchase order" });
    }
};

/* ---------- Writes ---------- */

const FAILED = "The purchase order could not be processed.";

// POST /api/purchase-orders
const createPurchaseOrder = withTransaction(async (connection, req) => {
    const { value, error } = parsePurchaseOrderPayload(req.body);
    if (error) throw new HttpError(400, error);

    const id = await createDraft(connection, { ...value, userId: req.user.userId });
    return { status: 201, body: { message: "Purchase order created", data: { purchaseOrderId: id } } };
}, FAILED);

// PUT /api/purchase-orders/:id (Draft only)
const updatePurchaseOrder = withTransaction(async (connection, req) => {
    const po = await lockPurchaseOrder(connection, req.params.id);
    requireAction(po, "edit");

    const { value, error } = parsePurchaseOrderPayload(req.body);
    if (error) throw new HttpError(400, error);

    const { items, total } = await priceLines(connection, value.supplierId, value.lines);

    await connection.query(
        "UPDATE purchase_orders SET supplier_id = ?, expected_at = ?, notes = ?, total_amount = ? WHERE id = ?",
        [value.supplierId, value.expectedAt, value.notes, total, po.id]
    );
    await connection.query("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", [po.id]);
    await insertItems(connection, po.id, items);

    return { body: { message: "Purchase order updated" } };
}, FAILED);

// DELETE /api/purchase-orders/:id (Draft only)
const deletePurchaseOrder = withTransaction(async (connection, req) => {
    const po = await lockPurchaseOrder(connection, req.params.id);
    requireAction(po, "delete");

    await connection.query("DELETE FROM purchase_orders WHERE id = ?", [po.id]);
    return { body: { message: "Draft deleted" } };
}, FAILED);

// POST /api/purchase-orders/:id/order — sent to the supplier
const placePurchaseOrder = withTransaction(async (connection, req) => {
    const po = await lockPurchaseOrder(connection, req.params.id);
    requireAction(po, "order");

    // Default the expected date from the supplier's lead time.
    const [[supplier]] = await connection.query("SELECT lead_time_days FROM suppliers WHERE id = ?", [po.supplier_id]);
    await connection.query(
        `UPDATE purchase_orders
         SET status = 'Ordered', ordered_at = NOW(),
             expected_at = COALESCE(expected_at, DATE_ADD(CURDATE(), INTERVAL ? DAY))
         WHERE id = ?`,
        [supplier.lead_time_days, po.id]
    );

    return { body: { message: "Purchase order placed" } };
}, FAILED);

// POST /api/purchase-orders/:id/receive — adds every line to stock
const receivePurchaseOrder = withTransaction(async (connection, req) => {
    const po = await lockPurchaseOrder(connection, req.params.id);
    requireAction(po, "receive");

    const [items] = await connection.query(
        "SELECT product_id, quantity, unit_cost FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY product_id",
        [po.id]
    );

    for (const item of items) {
        const [[product]] = await connection.query("SELECT stock, average_cost FROM products WHERE id = ? FOR UPDATE", [item.product_id]);
        const averageCost = weightedAverageCost({
            stock: product.stock,
            averageCost: product.average_cost,
            quantity: item.quantity,
            unitCost: item.unit_cost
        });
        await connection.query("UPDATE products SET average_cost = ? WHERE id = ?", [averageCost, item.product_id]);

        await recordMovement(connection, {
            productId: item.product_id,
            quantity: item.quantity,
            type: "purchase_receipt",
            reason: `${poNumber(po)} received`,
            purchaseOrderId: po.id,
            userId: req.user.userId
        });
    }

    await connection.query("UPDATE purchase_orders SET status = 'Received', received_at = NOW() WHERE id = ?", [po.id]);

    const units = items.reduce((sum, item) => sum + item.quantity, 0);
    return { body: { message: `Received ${units} units into stock`, data: { units, lines: items.length } } };
}, FAILED);

// POST /api/purchase-orders/:id/cancel
const cancelPurchaseOrder = withTransaction(async (connection, req) => {
    const po = await lockPurchaseOrder(connection, req.params.id);
    requireAction(po, "cancel");

    await connection.query("UPDATE purchase_orders SET status = 'Cancelled', cancelled_at = NOW() WHERE id = ?", [po.id]);
    return { body: { message: "Purchase order cancelled" } };
}, FAILED);

module.exports = {
    cancelPurchaseOrder,
    createDraft,
    createPurchaseOrder,
    deletePurchaseOrder,
    getPurchaseOrder,
    listPurchaseOrders,
    placePurchaseOrder,
    receivePurchaseOrder,
    updatePurchaseOrder
};
