
const pool = require("../config/database");

// GET /api/categories
const getCategories = async (req, res) => {
    try {
        const [categories] = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.description,
                COUNT(p.id) AS product_count
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id, c.name, c.description
            ORDER BY c.name ASC
        `);

        res.json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve categories"
        });
    }
};

// GET /api/categories/:id
const getCategoryById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const [categories] = await pool.query(
            `SELECT id, name, description
             FROM categories
             WHERE id = ?`,
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            data: categories[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve category"
        });
    }
};

// POST /api/categories
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO categories (name, description)
             VALUES (?, ?)`,
            [name.trim(), description || null]
        );

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            categoryId: result.insertId
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists"
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to create category"
        });
    }
};

// PUT /api/categories/:id
const updateCategory = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, description } = req.body;

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const [result] = await pool.query(
            `UPDATE categories
             SET name = ?, description = ?
             WHERE id = ?`,
            [name.trim(), description || null, id]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.query(
                "SELECT id FROM categories WHERE id = ?",
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }
        }

        res.json({
            success: true,
            message: "Category updated successfully"
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists"
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update category"
        });
    }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const [result] = await pool.query(
            "DELETE FROM categories WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            message: "Category deleted successfully"
        });
    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                message: "Cannot delete a category that contains products"
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to delete category"
        });
    }
};

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};