
const pool = require("../config/database");

// GET /api/customers
const getCustomers = async (req, res) => {
    try {
        const [customers] = await pool.query(`
            SELECT *
            FROM customers
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            count: customers.length,
            data: customers
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve customers"
        });
    }
};

// GET /api/customers/:id
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id)) || Number(id) < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const [customers] = await pool.query(
            "SELECT * FROM customers WHERE id = ?",
            [id]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            data: customers[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve customer"
        });
    }
};

// POST /api/customers
const createCustomer = async (req, res) => {
    try {
        const {
            company_name,
            contact_name,
            email,
            phone,
            address,
            city,
            country
        } = req.body;

        if (
            typeof company_name !== "string" ||
            !company_name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO customers
            (company_name, contact_name, email, phone,
             address, city, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                company_name.trim(),
                contact_name || null,
                email || null,
                phone || null,
                address || null,
                city || null,
                country || "Morocco"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            customerId: result.insertId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to create customer"
        });
    }
};

// PUT /api/customers/:id
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            company_name,
            contact_name,
            email,
            phone,
            address,
            city,
            country
        } = req.body;

        if (!Number.isInteger(Number(id)) || Number(id) < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        if (
            typeof company_name !== "string" ||
            !company_name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        const [result] = await pool.query(
            `UPDATE customers
             SET company_name = ?,
                 contact_name = ?,
                 email = ?,
                 phone = ?,
                 address = ?,
                 city = ?,
                 country = ?
             WHERE id = ?`,
            [
                company_name.trim(),
                contact_name || null,
                email || null,
                phone || null,
                address || null,
                city || null,
                country || "Morocco",
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            message: "Customer updated successfully"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update customer"
        });
    }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id)) || Number(id) < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const [result] = await pool.query(
            "DELETE FROM customers WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            message: "Customer deleted successfully"
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                message: "This customer has orders, quotes, or portal accounts and can't be deleted."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to delete customer"
        });
    }
};

module.exports = {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
};