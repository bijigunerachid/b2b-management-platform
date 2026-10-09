
const pool = require("../config/database");

// GET /api/products
const getProducts = async (req, res) => {
    try {
        const { search, category_id } = req.query;

        let sql = `
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.is_active,
                p.category_id,
                c.name AS category_name,
                p.created_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE 1 = 1
        `;

        const params = [];

        if (search) {
            sql += " AND p.name LIKE ?";
            params.push(`%${search}%`);
        }

        if (category_id !== undefined) {
            const categoryId = Number(category_id);

            if (!Number.isInteger(categoryId) || categoryId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category_id"
                });
            }

            sql += " AND p.category_id = ?";
            params.push(categoryId);
        }

        sql += " ORDER BY p.id DESC";

        const [products] = await pool.query(sql, params);

        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve products"
        });
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
            category_id
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
             (name, description, price, stock, category_id)
             VALUES (?, ?, ?, ?, ?)`,
            [
                name.trim(),
                description || null,
                parsedPrice,
                parsedStock,
                parsedCategoryId
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