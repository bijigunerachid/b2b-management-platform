
const pool = require("../config/database");

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

        if (req.query.status === "active") {
            conditions.push("p.is_active = 1");
        } else if (req.query.status === "inactive") {
            conditions.push("p.is_active = 0");
        }

        if (req.query.stock === "low") {
            conditions.push("p.stock <= 5");
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
                c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
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
            `SELECT p.*, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
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
            is_active
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

        const [result] = await pool.query(
            `INSERT INTO products
             (name, description, price, stock, category_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name.trim(),
                description || null,
                parsedPrice,
                parsedStock,
                parsedCategoryId,
                is_active === false || is_active === 0 ? 0 : 1
            ]
        );

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
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const {
            name,
            description,
            price,
            stock,
            category_id,
            is_active
        } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }

        const parsedPrice = Number(price);
        const parsedStock = Number(stock);
        const parsedCategoryId = Number(category_id);

        if (
            price === undefined ||
            price === null ||
            price === "" ||
            !Number.isFinite(parsedPrice) ||
            parsedPrice < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid price"
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
                message: "Invalid stock"
            });
        }

        if (
            category_id === undefined ||
            !Number.isInteger(parsedCategoryId) ||
            parsedCategoryId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid category_id"
            });
        }

        if (
            is_active !== undefined &&
            ![0, 1, true, false].includes(is_active)
        ) {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false"
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

        const [result] = await pool.query(
            `UPDATE products
             SET name = ?,
                 description = ?,
                 price = ?,
                 stock = ?,
                 category_id = ?,
                 is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [
                name.trim(),
                description || null,
                parsedPrice,
                parsedStock,
                parsedCategoryId,
                is_active === undefined
                    ? null
                    : Number(is_active),
                id
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.query(
                "SELECT id FROM products WHERE id = ?",
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }
        }

        res.json({
            success: true,
            message: "Product updated successfully"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update product"
        });
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
                message: "Cannot delete a product used in an order"
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
    deleteProduct,
    validateProduct
};