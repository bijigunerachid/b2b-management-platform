
const pool = require("../config/database");
const { ADJUSTMENT_REASONS, InventoryError, recordMovement } = require("../services/inventory");

/** Validates optional reorder_point / supplier_id; returns an error message or null. */
async function checkInventoryFields(connection, { reorder_point, supplier_id }) {
    if (reorder_point !== undefined && reorder_point !== null && (!Number.isSafeInteger(Number(reorder_point)) || Number(reorder_point) < 0)) {
        return "Reorder point must be a whole number of 0 or more.";
    }
    if (supplier_id !== undefined && supplier_id !== null) {
        const [suppliers] = await connection.query("SELECT id FROM suppliers WHERE id = ?", [Number(supplier_id)]);
        if (suppliers.length === 0) return "Supplier does not exist.";
    }
    return null;
}

// GET /api/products
const getProducts = async (req, res, next) => {
    try {
        const page = Math.max(
            1,
            Number.parseInt(req.query.page, 10) || 1
        );

        const requestedLimit = Number.parseInt(
            req.query.limit,
            10
        ) || 10;

        const limit = Math.min(
            100,
            Math.max(1, requestedLimit)
        );

        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim().slice(0, 100)
                : "";

        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];

        if (search) {
            conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
            params.push(`%${search}%`, `%${search}%`);
        }

        const categoryId = Number.parseInt(req.query.category_id, 10);

        if (Number.isSafeInteger(categoryId) && categoryId > 0) {
            conditions.push("p.category_id = ?");
            params.push(categoryId);
        }

        const supplierId = Number.parseInt(req.query.supplier_id, 10);

        if (Number.isSafeInteger(supplierId) && supplierId > 0) {
            conditions.push("p.supplier_id = ?");
            params.push(supplierId);
        }

        if (req.query.status === "active") {
            conditions.push("p.is_active = 1");
        } else if (req.query.status === "inactive") {
            conditions.push("p.is_active = 0");
        }

        if (req.query.stock === "low") {
            // Same definition as the dashboard and inventory summary.
            conditions.push("p.is_active = 1 AND p.reorder_point > 0 AND p.stock <= p.reorder_point");
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // Whitelisted sort columns; never interpolate raw query input.
        const sortColumns = {
            name: "p.name",
            price: "p.price",
            stock: "p.stock",
            created_at: "p.created_at",
            category: "c.name"
        };
        const sortColumn = sortColumns[req.query.sort] || "p.id";
        const sortDirection = req.query.order === "asc" ? "ASC" : "DESC";

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM products p
             ${whereClause}`,
            params
        );

        const [products] = await pool.query(
            `SELECT
                p.id, p.name, p.description, p.price, p.stock,
                p.category_id, p.is_active, p.created_at,
                p.reorder_point, p.supplier_id,
                c.name AS category_name,
                s.name AS supplier_name,
                COALESCE(oo.on_order, 0) AS on_order
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             LEFT JOIN (
                SELECT poi.product_id, SUM(poi.quantity) AS on_order
                FROM purchase_order_items poi
                INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
                WHERE po.status = 'Ordered'
                GROUP BY poi.product_id
             ) oo ON oo.product_id = p.id
             ${whereClause}
             ORDER BY ${sortColumn} ${sortDirection}, p.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const total = Number(countRows[0].total);

        return res.status(200).json({
            success: true,
            data: products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};
// GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const [products] = await pool.query(
            `SELECT p.*, c.name AS category_name, s.name AS supplier_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE p.id = ?`,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            data: products[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve product"
        });
    }
};

// POST /api/products
const createProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            stock,
            category_id,
            is_active,
            reorder_point,
            supplier_id
        } = req.body;

        const parsedPrice = Number(price);
        const parsedStock = Number(stock);
        const parsedCategoryId = Number(category_id);

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }

        if (
            price === undefined ||
            price === null ||
            price === "" ||
            !Number.isFinite(parsedPrice) ||
            parsedPrice < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Price must be a non-negative number"
            });
        }

        if (
            stock === undefined ||
            stock === null ||
            stock === "" ||
            !Number.isInteger(parsedStock) ||
            parsedStock < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Stock must be a non-negative integer"
            });
        }

        if (
            category_id === undefined ||
            !Number.isInteger(parsedCategoryId) ||
            parsedCategoryId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid category_id is required"
            });
        }

        const [categories] = await pool.query(
            "SELECT id FROM categories WHERE id = ?",
            [parsedCategoryId]
        );

        if (categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Category does not exist"
            });
        }

        const inventoryError = await checkInventoryFields(pool, { reorder_point, supplier_id });
        if (inventoryError) {
            return res.status(400).json({ success: false, message: inventoryError });
        }

        // Insert at zero stock, then record the initial stock in the ledger.
        const connection = await pool.getConnection();
        let result;

        try {
            await connection.beginTransaction();

            [result] = await connection.query(
                `INSERT INTO products
                 (name, description, price, stock, category_id, is_active, reorder_point, supplier_id)
                 VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
                [
                    name.trim(),
                    description || null,
                    parsedPrice,
                    parsedCategoryId,
                    is_active === false || is_active === 0 ? 0 : 1,
                    reorder_point ?? 5,
                    supplier_id ?? null
                ]
            );

            if (parsedStock > 0) {
                await recordMovement(connection, {
                    productId: result.insertId,
                    quantity: parsedStock,
                    type: "opening",
                    reason: "Initial stock",
                    userId: req.user.userId
                });
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            productId: result.insertId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to create product"
        });
    }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const { name, description, price, stock, category_id, is_active, reorder_point, supplier_id } = req.body;

    if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Product name is required" });
    }

    const parsedPrice = Number(price);
    const parsedCategoryId = Number(category_id);

    if (price === undefined || price === null || price === "" || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: "Invalid price" });
    }

    // Stock is optional here; when it differs from the current value the
    // change is recorded in the ledger as an adjustment.
    if (stock !== undefined && (!Number.isSafeInteger(Number(stock)) || Number(stock) < 0)) {
        return res.status(400).json({ success: false, message: "Invalid stock" });
    }

    if (category_id === undefined || !Number.isInteger(parsedCategoryId) || parsedCategoryId < 1) {
        return res.status(400).json({ success: false, message: "Invalid category_id" });
    }

    if (is_active !== undefined && ![0, 1, true, false].includes(is_active)) {
        return res.status(400).json({ success: false, message: "is_active must be true or false" });
    }

    let connection;

    try {
        const [categories] = await pool.query("SELECT id FROM categories WHERE id = ?", [parsedCategoryId]);

        if (categories.length === 0) {
            return res.status(400).json({ success: false, message: "Category does not exist" });
        }

        const inventoryError = await checkInventoryFields(pool, { reorder_point, supplier_id });
        if (inventoryError) {
            return res.status(400).json({ success: false, message: inventoryError });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.query(
            "SELECT id, stock, supplier_id FROM products WHERE id = ? FOR UPDATE",
            [id]
        );

        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        await connection.query(
            `UPDATE products
             SET name = ?,
                 description = ?,
                 price = ?,
                 category_id = ?,
                 is_active = COALESCE(?, is_active),
                 reorder_point = COALESCE(?, reorder_point),
                 supplier_id = ?
             WHERE id = ?`,
            [
                name.trim(),
                description || null,
                parsedPrice,
                parsedCategoryId,
                is_active === undefined ? null : Number(is_active),
                reorder_point ?? null,
                // Omitted keeps the current supplier; null clears it.
                supplier_id === undefined ? existing[0].supplier_id : supplier_id,
                id
            ]
        );

        const delta = stock === undefined ? 0 : Number(stock) - Number(existing[0].stock);

        if (delta !== 0) {
            await recordMovement(connection, {
                productId: id,
                quantity: delta,
                type: "adjustment",
                reason: "Edited on product form",
                userId: req.user.userId
            });
        }

        await connection.commit();

        return res.json({ success: true, message: "Product updated successfully" });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Update product error:", error);

        return res.status(500).json({ success: false, message: "Failed to update product" });
    } finally {
        if (connection) connection.release();
    }
};

// POST /api/products/:id/adjustments { quantity: signed int, reason, note? }
const adjustStock = async (req, res) => {
    const id = Number(req.params.id);
    const quantity = Number(req.body?.quantity);
    const reason = req.body?.reason;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    if (!Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity) > 1000000) {
        return res.status(400).json({ success: false, message: "Enter a non-zero whole quantity." });
    }
    if (!ADJUSTMENT_REASONS.includes(reason)) {
        return res.status(400).json({ success: false, message: `Choose a reason: ${ADJUSTMENT_REASONS.join(", ")}.` });
    }
    if (reason === "Other" && note.length < 3) {
        return res.status(400).json({ success: false, message: "Describe the reason in the note." });
    }
    if (note.length > 200) {
        return res.status(400).json({ success: false, message: "The note can be at most 200 characters." });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const balance = await recordMovement(connection, {
            productId: id,
            quantity,
            type: "adjustment",
            reason: note ? `${reason}: ${note}` : reason,
            userId: req.user.userId
        });

        await connection.commit();
        return res.status(201).json({ success: true, message: "Stock adjusted", data: { stock: balance } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});

        if (error instanceof InventoryError) {
            return res.status(error.status).json({ success: false, message: error.message });
        }

        console.error("Adjust stock error:", error);
        return res.status(500).json({ success: false, message: "Failed to adjust stock" });
    } finally {
        if (connection) connection.release();
    }
};


// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const [result] = await pool.query(
            "DELETE FROM products WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                message: "This product is used in orders or purchase orders. Deactivate it instead."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to delete product"
        });
    }
};

function validateProduct(data) {
    const {
        name,
        category_id,
        price,
        stock
    } = data;

    if (typeof name !== "string" || !name.trim()) {
        return "Product name is required.";
    }

    if (
        category_id === undefined ||
        !Number.isInteger(Number(category_id)) ||
        Number(category_id) <= 0
    ) {
        return "Please select a valid category.";
    }

    if (
        price === undefined ||
        price === null ||
        price === "" ||
        !Number.isFinite(Number(price)) ||
        Number(price) < 0
    ) {
        return "Price must be a valid non-negative number.";
    }

    if (
        stock === undefined ||
        stock === null ||
        stock === "" ||
        !Number.isInteger(Number(stock)) ||
        Number(stock) < 0
    ) {
        return "Stock must be a non-negative integer.";
    }

    return null;
}

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    adjustStock,
    deleteProduct,
    validateProduct
};