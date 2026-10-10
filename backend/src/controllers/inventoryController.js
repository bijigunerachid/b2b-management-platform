const pool = require("../config/database");
const { HttpError, withTransaction } = require("../services/transaction");
const { MOVEMENT_TYPES } = require("../services/inventory");
const { reorderSuggestions } = require("../purchasing/purchasingRules");
const { createDraft } = require("./purchaseOrderController");
const { loadActiveForecasts } = require("../ml/mlStore");

/** Active products with what's on order, supplier, last purchase cost, and demand forecast. */
async function loadReorderInputs(connection) {
    const [products] = await connection.query(`
        SELECT p.id, p.name, p.price, p.stock, p.reorder_point, p.is_active,
               p.supplier_id, s.name AS supplier_name, s.lead_time_days,
               COALESCE(oo.on_order, 0) AS on_order
        FROM products p
        LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.is_active = 1
        LEFT JOIN (
            SELECT poi.product_id, SUM(poi.quantity) AS on_order
            FROM purchase_order_items poi
            INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
            WHERE po.status = 'Ordered'
            GROUP BY poi.product_id
        ) oo ON oo.product_id = p.id
        WHERE p.is_active = 1
    `);

    // An inactive preferred supplier can't be ordered from: treat as unassigned.
    for (const product of products) {
        if (!product.supplier_name) product.supplier_id = null;
    }

    const [costs] = await connection.query(`
        SELECT poi.product_id, poi.unit_cost
        FROM purchase_order_items poi
        INNER JOIN (
            SELECT poi2.product_id, MAX(poi2.id) AS last_id
            FROM purchase_order_items poi2
            INNER JOIN purchase_orders po ON po.id = poi2.purchase_order_id
            WHERE po.status <> 'Cancelled'
            GROUP BY poi2.product_id
        ) latest ON latest.last_id = poi.id
    `);

    return {
        products,
        lastCosts: new Map(costs.map((row) => [row.product_id, Number(row.unit_cost)])),
        forecasts: await loadActiveForecasts(connection)
    };
}

// GET /api/inventory/summary
const getSummary = async (req, res) => {
    try {
        const [[stock]] = await pool.query(`
            SELECT COALESCE(SUM(stock), 0) AS units,
                   COALESCE(SUM(stock * price), 0) AS retail_value,
                   SUM(stock <= reorder_point AND reorder_point > 0) AS below_reorder,
                   SUM(stock = 0) AS out_of_stock
            FROM products
            WHERE is_active = 1
        `);
        const [[purchasing]] = await pool.query(`
            SELECT COUNT(DISTINCT po.id) AS open_orders,
                   COALESCE(SUM(poi.quantity), 0) AS units_on_order,
                   COUNT(DISTINCT CASE WHEN po.expected_at < CURDATE() THEN po.id END) AS late_orders
            FROM purchase_orders po
            LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
            WHERE po.status = 'Ordered'
        `);

        return res.json({
            success: true,
            data: {
                units: Number(stock.units),
                retail_value: Number(stock.retail_value),
                below_reorder: Number(stock.below_reorder ?? 0),
                out_of_stock: Number(stock.out_of_stock ?? 0),
                open_orders: Number(purchasing.open_orders),
                units_on_order: Number(purchasing.units_on_order),
                late_orders: Number(purchasing.late_orders)
            }
        });
    } catch (error) {
        console.error("Inventory summary error:", error);
        return res.status(500).json({ success: false, message: "Failed to load inventory summary" });
    }
};

// GET /api/inventory/movements?product_id=&type=&page=&limit=
const getMovements = async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const conditions = [];
    const params = [];

    const productId = Number.parseInt(req.query.product_id, 10);
    if (Number.isSafeInteger(productId) && productId > 0) {
        conditions.push("m.product_id = ?");
        params.push(productId);
    }
    if (MOVEMENT_TYPES.includes(req.query.type)) {
        conditions.push("m.type = ?");
        params.push(req.query.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM stock_movements m ${where}`, params);
        const [rows] = await pool.query(
            `SELECT m.id, m.product_id, p.name AS product_name, m.quantity, m.type, m.reason,
                    m.balance_after, m.order_id, m.purchase_order_id, m.credit_note_id, m.created_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
             FROM stock_movements m
             INNER JOIN products p ON p.id = m.product_id
             LEFT JOIN users u ON u.id = m.created_by
             ${where}
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );

        return res.json({
            success: true,
            data: rows,
            pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) }
        });
    } catch (error) {
        console.error("Movements error:", error);
        return res.status(500).json({ success: false, message: "Failed to load stock movements" });
    }
};

// GET /api/inventory/reorder-suggestions
const getReorderSuggestions = async (req, res) => {
    try {
        const { products, lastCosts, forecasts } = await loadReorderInputs(pool);
        return res.json({ success: true, data: reorderSuggestions(products, lastCosts, forecasts) });
    } catch (error) {
        console.error("Reorder suggestions error:", error);
        return res.status(500).json({ success: false, message: "Failed to compute reorder suggestions" });
    }
};

// POST /api/inventory/reorder-suggestions/purchase-orders { supplier_ids?: number[] }
// Recomputes suggestions server-side and creates one Draft PO per supplier.
const createDraftsFromSuggestions = withTransaction(async (connection, req) => {
    const requested = Array.isArray(req.body?.supplier_ids)
        ? new Set(req.body.supplier_ids.map(Number))
        : null;

    const { products, lastCosts, forecasts } = await loadReorderInputs(connection);
    const leadTimes = new Map(products.map((product) => [product.supplier_id, product.lead_time_days]));

    const groups = reorderSuggestions(products, lastCosts, forecasts).filter(
        (group) => group.supplier_id && (!requested || requested.has(group.supplier_id))
    );

    if (groups.length === 0) {
        throw new HttpError(409, "Nothing to reorder for the selected suppliers.");
    }

    const created = [];
    for (const group of groups) {
        const expected = new Date();
        expected.setDate(expected.getDate() + Number(leadTimes.get(group.supplier_id) ?? 7));

        const id = await createDraft(connection, {
            supplierId: group.supplier_id,
            expectedAt: expected.toISOString().slice(0, 10),
            notes: "Created from reorder suggestions.",
            lines: new Map(group.items.map((item) => [item.product_id, { quantity: item.quantity, unitCost: item.unit_cost }])),
            userId: req.user.userId
        });
        created.push({ purchaseOrderId: id, supplier_name: group.supplier_name, lines: group.items.length });
    }

    return { status: 201, body: { message: `Created ${created.length} draft purchase order${created.length === 1 ? "" : "s"}`, data: created } };
}, "Could not create purchase orders.");

module.exports = { createDraftsFromSuggestions, getMovements, getReorderSuggestions, getSummary };
