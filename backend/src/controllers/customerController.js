
const pool = require("../config/database");
const { recordChanges } = require("../middleware/auditTrail");
const { diff } = require("../audit/describe");

// GET /api/customers
const getCustomers = async (req, res) => {
    try {
        const [customers] = await pool.query(`
            SELECT c.*, pl.name AS price_list_name, pl.discount_percent AS price_list_discount
            FROM customers c
            LEFT JOIN price_lists pl ON pl.id = c.price_list_id
            ORDER BY c.id DESC
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
            `SELECT c.*, pl.name AS price_list_name, pl.discount_percent AS price_list_discount, pl.is_active AS price_list_active
             FROM customers c
             LEFT JOIN price_lists pl ON pl.id = c.price_list_id
             WHERE c.id = ?`,
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
            country,
            email_language,
            payment_reminders
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
             address, city, country, email_language, payment_reminders)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_name.trim(),
                contact_name || null,
                email || null,
                phone || null,
                address || null,
                city || null,
                country || "Morocco",
                email_language || "fr",
                payment_reminders === false ? 0 : 1
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
            country,
            email_language,
            payment_reminders
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

        const [before] = await pool.query("SELECT * FROM customers WHERE id = ?", [id]);

        const [result] = await pool.query(
            `UPDATE customers
             SET company_name = ?,
                 contact_name = ?,
                 email = ?,
                 phone = ?,
                 address = ?,
                 city = ?,
                 country = ?,
                 email_language = COALESCE(?, email_language),
                 payment_reminders = COALESCE(?, payment_reminders)
             WHERE id = ?`,
            [
                company_name.trim(),
                contact_name || null,
                email || null,
                phone || null,
                address || null,
                city || null,
                country || "Morocco",
                email_language ?? null,
                payment_reminders === undefined ? null : payment_reminders ? 1 : 0,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        recordChanges(req, diff(before[0], { company_name: company_name.trim(), contact_name, email, phone, address, city, country: country || "Morocco" },
            ["company_name", "contact_name", "email", "phone", "address", "city", "country"]));

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