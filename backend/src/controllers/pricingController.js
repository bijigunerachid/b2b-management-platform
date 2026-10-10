const pool = require("../config/database");
const { recordChanges } = require("../middleware/auditTrail");
const { diff } = require("../audit/describe");
const { HttpError, withTransaction } = require("../services/transaction");
const { describePrice, loadPricingContext } = require("../pricing/pricing");
const { parseCustomerPrice, parsePriceList, parseVolumeDiscount } = require("../pricing/pricingRules");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** `message` is the whole error, e.g. "Invalid price list ID", so it can be translated. */
function requireId(value, message) {
    const id = parseId(value);
    if (!id) throw new HttpError(400, message);
    return id;
}

function serializeDiscount(row) {
    return { ...row, discount_percent: Number(row.discount_percent) };
}

/* Price lists */

// GET /api/pricing/price-lists
const listPriceLists = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT pl.*, COUNT(c.id) AS customer_count
             FROM price_lists pl
             LEFT JOIN customers c ON c.price_list_id = pl.id
             GROUP BY pl.id
             ORDER BY pl.discount_percent, pl.name`
        );
        return res.json({
            success: true,
            data: rows.map((row) => ({ ...serializeDiscount(row), is_active: Boolean(row.is_active), customer_count: Number(row.customer_count) }))
        });
    } catch (error) {
        console.error("Price lists error:", error);
        return res.status(500).json({ success: false, message: "Failed to load price lists" });
    }
};

async function savePriceList(connection, id, body, req) {
    const { error, value } = parsePriceList(body);
    if (error) throw new HttpError(400, error);

    const [taken] = await connection.query("SELECT id FROM price_lists WHERE name = ? AND id <> ?", [value.name, id ?? 0]);
    if (taken.length > 0) throw new HttpError(409, `A price list called ${value.name} already exists.`);

    const params = [value.name, value.description, value.discountPercent, value.isActive];
    if (id) {
        const [before] = await connection.query("SELECT name, description, discount_percent, is_active FROM price_lists WHERE id = ?", [id]);
        recordChanges(req, diff(before[0], { name: value.name, description: value.description, discount_percent: value.discountPercent, is_active: value.isActive },
            ["name", "description", "discount_percent", "is_active"]));
        const [result] = await connection.query(
            "UPDATE price_lists SET name = ?, description = ?, discount_percent = ?, is_active = ? WHERE id = ?",
            [...params, id]
        );
        if (result.affectedRows === 0) throw new HttpError(404, "Price list not found");
        return id;
    }

    const [result] = await connection.query(
        "INSERT INTO price_lists (name, description, discount_percent, is_active) VALUES (?, ?, ?, ?)",
        params
    );
    return result.insertId;
}

// POST /api/pricing/price-lists
const createPriceList = withTransaction(async (connection, req) => {
    const id = await savePriceList(connection, null, req.body, req);
    return { status: 201, body: { message: "Price list created", data: { id } } };
}, "Failed to create the price list");

// PUT /api/pricing/price-lists/:id
const updatePriceList = withTransaction(async (connection, req) => {
    const id = await savePriceList(connection, requireId(req.params.id, "Invalid price list ID"), req.body, req);
    return { body: { message: "Price list updated", data: { id } } };
}, "Failed to update the price list");

// DELETE /api/pricing/price-lists/:id
const deletePriceList = withTransaction(async (connection, req) => {
    const id = requireId(req.params.id, "Invalid price list ID");
    const [[{ customers }]] = await connection.query("SELECT COUNT(*) AS customers FROM customers WHERE price_list_id = ?", [id]);
    if (Number(customers) > 0) {
        throw new HttpError(
            409,
            Number(customers) === 1
                ? "1 customer uses this price list. Move them first or deactivate it."
                : `${customers} customers use this price list. Move them first or deactivate it.`
        );
    }

    const [result] = await connection.query("DELETE FROM price_lists WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new HttpError(404, "Price list not found");
    return { body: { message: "Price list deleted" } };
}, "Failed to delete the price list");

// PATCH /api/customers/:id/price-list { price_list_id: id | null }
const setCustomerPriceList = withTransaction(async (connection, req) => {
    const customerId = requireId(req.params.id, "Invalid customer ID");
    const raw = req.body?.price_list_id;
    const priceListId = raw === null || raw === "" || raw === undefined ? null : parseId(raw);
    if (raw !== null && raw !== "" && raw !== undefined && !priceListId) throw new HttpError(400, "Invalid price list ID");

    if (priceListId) {
        const [lists] = await connection.query("SELECT is_active FROM price_lists WHERE id = ?", [priceListId]);
        if (lists.length === 0) throw new HttpError(404, "Price list not found");
        if (!lists[0].is_active) throw new HttpError(400, "This price list is inactive.");
    }

    const [before] = await connection.query(
        "SELECT pl.name FROM customers c LEFT JOIN price_lists pl ON pl.id = c.price_list_id WHERE c.id = ?",
        [customerId]
    );
    const [result] = await connection.query("UPDATE customers SET price_list_id = ? WHERE id = ?", [priceListId, customerId]);
    if (result.affectedRows === 0) throw new HttpError(404, "Customer not found");
    const [after] = priceListId ? await connection.query("SELECT name FROM price_lists WHERE id = ?", [priceListId]) : [[{ name: null }]];
    recordChanges(req, diff({ price_list: before[0]?.name }, { price_list: after[0]?.name }, ["price_list"]));
    return { body: { message: "Price list updated" } };
}, "Failed to update the customer's price list");

/* Volume discounts */

// GET /api/pricing/volume-discounts
const listVolumeDiscounts = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT vd.*, cat.name AS category_name
             FROM volume_discounts vd
             LEFT JOIN categories cat ON cat.id = vd.category_id
             ORDER BY vd.category_id IS NOT NULL, cat.name, vd.min_quantity`
        );
        return res.json({ success: true, data: rows.map(serializeDiscount) });
    } catch (error) {
        console.error("Volume discounts error:", error);
        return res.status(500).json({ success: false, message: "Failed to load volume discounts" });
    }
};

async function saveVolumeDiscount(connection, id, body, req) {
    const { error, value } = parseVolumeDiscount(body);
    if (error) throw new HttpError(400, error);

    if (value.categoryId) {
        const [categories] = await connection.query("SELECT id FROM categories WHERE id = ?", [value.categoryId]);
        if (categories.length === 0) throw new HttpError(404, "Category not found");
    }

    const [same] = await connection.query(
        "SELECT id FROM volume_discounts WHERE category_id <=> ? AND min_quantity = ? AND id <> ?",
        [value.categoryId, value.minQuantity, id ?? 0]
    );
    if (same.length > 0) throw new HttpError(409, `There is already a discount from ${value.minQuantity} units for these products.`);

    const params = [value.categoryId, value.minQuantity, value.discountPercent];
    if (id) {
        const [before] = await connection.query("SELECT category_id, min_quantity, discount_percent FROM volume_discounts WHERE id = ?", [id]);
        recordChanges(req, diff(before[0], { category_id: value.categoryId, min_quantity: value.minQuantity, discount_percent: value.discountPercent },
            ["category_id", "min_quantity", "discount_percent"]));
        const [result] = await connection.query(
            "UPDATE volume_discounts SET category_id = ?, min_quantity = ?, discount_percent = ? WHERE id = ?",
            [...params, id]
        );
        if (result.affectedRows === 0) throw new HttpError(404, "Volume discount not found");
        return id;
    }

    const [result] = await connection.query("INSERT INTO volume_discounts (category_id, min_quantity, discount_percent) VALUES (?, ?, ?)", params);
    return result.insertId;
}

// POST /api/pricing/volume-discounts
const createVolumeDiscount = withTransaction(async (connection, req) => {
    const id = await saveVolumeDiscount(connection, null, req.body, req);
    return { status: 201, body: { message: "Volume discount created", data: { id } } };
}, "Failed to create the volume discount");

// PUT /api/pricing/volume-discounts/:id
const updateVolumeDiscount = withTransaction(async (connection, req) => {
    const id = await saveVolumeDiscount(connection, requireId(req.params.id, "Invalid volume discount ID"), req.body, req);
    return { body: { message: "Volume discount updated", data: { id } } };
}, "Failed to update the volume discount");

// DELETE /api/pricing/volume-discounts/:id
const deleteVolumeDiscount = withTransaction(async (connection, req) => {
    const [result] = await connection.query("DELETE FROM volume_discounts WHERE id = ?", [requireId(req.params.id, "Invalid volume discount ID")]);
    if (result.affectedRows === 0) throw new HttpError(404, "Volume discount not found");
    return { body: { message: "Volume discount deleted" } };
}, "Failed to delete the volume discount");

/* Contract prices */

// GET /api/pricing/customer-prices?customer_id=
const listCustomerPrices = async (req, res) => {
    const customerId = parseId(req.query.customer_id);

    try {
        const [rows] = await pool.query(
            `SELECT cp.id, cp.customer_id, c.company_name, cp.product_id, p.name AS product_name,
                    p.price AS list_price, cp.unit_price, cp.note, cp.updated_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
             FROM customer_prices cp
             INNER JOIN customers c ON c.id = cp.customer_id
             INNER JOIN products p ON p.id = cp.product_id
             LEFT JOIN users u ON u.id = cp.created_by
             WHERE (? IS NULL OR cp.customer_id = ?)
             ORDER BY c.company_name, p.name`,
            [customerId, customerId]
        );
        return res.json({
            success: true,
            data: rows.map((row) => ({ ...row, list_price: Number(row.list_price), unit_price: Number(row.unit_price) }))
        });
    } catch (error) {
        console.error("Customer prices error:", error);
        return res.status(500).json({ success: false, message: "Failed to load contract prices" });
    }
};

// PUT /api/customers/:id/prices { product_id, unit_price, note? }: creates or replaces
const setCustomerPrice = withTransaction(async (connection, req) => {
    const customerId = requireId(req.params.id, "Invalid customer ID");
    const { error, value } = parseCustomerPrice(req.body);
    if (error) throw new HttpError(400, error);

    const [customers] = await connection.query("SELECT id FROM customers WHERE id = ?", [customerId]);
    if (customers.length === 0) throw new HttpError(404, "Customer not found");
    const [products] = await connection.query("SELECT id FROM products WHERE id = ?", [value.productId]);
    if (products.length === 0) throw new HttpError(404, "Product not found");

    const [previous] = await connection.query("SELECT unit_price FROM customer_prices WHERE customer_id = ? AND product_id = ?", [customerId, value.productId]);
    recordChanges(req, diff({ unit_price: previous[0]?.unit_price }, { unit_price: value.unitPrice }, ["unit_price"]));

    await connection.query(
        `INSERT INTO customer_prices (customer_id, product_id, unit_price, note, created_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price), note = VALUES(note), created_by = VALUES(created_by)`,
        [customerId, value.productId, value.unitPrice, value.note, req.user.userId]
    );
    return { body: { message: "Contract price saved" } };
}, "Failed to save the contract price");

// DELETE /api/pricing/customer-prices/:id
const deleteCustomerPrice = withTransaction(async (connection, req) => {
    const [result] = await connection.query("DELETE FROM customer_prices WHERE id = ?", [requireId(req.params.id, "Invalid contract price ID")]);
    if (result.affectedRows === 0) throw new HttpError(404, "Contract price not found");
    return { body: { message: "Contract price removed" } };
}, "Failed to remove the contract price");

/* Preview */

async function priceItems(connection, customerId, items, { activeOnly = false } = {}) {
    if (!Array.isArray(items) || items.length > 200) throw new HttpError(400, "items must be a list of at most 200 lines.");

    const requests = new Map();
    for (const item of items) {
        const productId = parseId(item?.product_id);
        const quantity = Number(item?.quantity);
        if (!productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
            throw new HttpError(400, "Each line needs a product and a whole quantity of at least 1.");
        }
        requests.set(productId, (requests.get(productId) ?? 0) + quantity);
    }

    const context = await loadPricingContext(connection, customerId);
    if (!context) throw new HttpError(404, "Customer not found");
    if (requests.size === 0) return { price_list: context.priceList, lines: [] };

    const [products] = await connection.query(
        `SELECT id, price, category_id, is_active FROM products WHERE id IN (?)${activeOnly ? " AND is_active = 1" : ""}`,
        [[...requests.keys()]]
    );
    const lines = products.map((product) => describePrice(context, product, requests.get(product.id)));

    return { price_list: context.priceList, lines };
}

// POST /api/pricing/preview { customer_id, items: [{ product_id, quantity }] }
const previewPrices = withTransaction(async (connection, req) => {
    const customerId = requireId(req.body?.customer_id, "Invalid customer ID");
    return { body: { data: await priceItems(connection, customerId, req.body?.items) } };
}, "Failed to price the lines");

module.exports = {
    createPriceList,
    createVolumeDiscount,
    deleteCustomerPrice,
    deletePriceList,
    deleteVolumeDiscount,
    listCustomerPrices,
    listPriceLists,
    listVolumeDiscounts,
    previewPrices,
    priceItems,
    setCustomerPrice,
    setCustomerPriceList,
    updatePriceList,
    updateVolumeDiscount
};
