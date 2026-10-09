const pool = require("../config/database");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalize(body) {
    const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
    return {
        name: text(body.name),
        contact_name: text(body.contact_name),
        email: text(body.email)?.toLowerCase() ?? null,
        phone: text(body.phone),
        city: text(body.city),
        country: text(body.country) ?? "Morocco",
        lead_time_days: body.lead_time_days === undefined || body.lead_time_days === null || body.lead_time_days === "" ? 7 : Number(body.lead_time_days),
        notes: text(body.notes),
        is_active: body.is_active === undefined ? 1 : body.is_active ? 1 : 0
    };
}

// GET /api/suppliers
const getSuppliers = async (req, res) => {
    try {
        const [suppliers] = await pool.query(`
            SELECT s.*,
                   COUNT(DISTINCT p.id) AS product_count,
                   COALESCE(po.open_orders, 0) AS open_orders,
                   COALESCE(po.open_value, 0) AS open_value,
                   po.last_order_at
            FROM suppliers s
            LEFT JOIN products p ON p.supplier_id = s.id
            LEFT JOIN (
                SELECT supplier_id,
                       SUM(status = 'Ordered') AS open_orders,
                       SUM(CASE WHEN status = 'Ordered' THEN total_amount ELSE 0 END) AS open_value,
                       MAX(ordered_at) AS last_order_at
                FROM purchase_orders
                GROUP BY supplier_id
            ) po ON po.supplier_id = s.id
            GROUP BY s.id
            ORDER BY s.name
        `);

        return res.json({ success: true, count: suppliers.length, data: suppliers });
    } catch (error) {
        console.error("Get suppliers error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve suppliers" });
    }
};

async function save(req, res, id = null) {
    const supplier = normalize(req.body || {});

    if (!Number.isSafeInteger(supplier.lead_time_days) || supplier.lead_time_days < 0 || supplier.lead_time_days > 365) {
        return res.status(400).json({ success: false, message: "Lead time must be between 0 and 365 days." });
    }

    try {
        if (id === null) {
            const [result] = await pool.query("INSERT INTO suppliers SET ?", [supplier]);
            return res.status(201).json({ success: true, message: "Supplier created", data: { supplierId: result.insertId } });
        }

        const [result] = await pool.query("UPDATE suppliers SET ? WHERE id = ?", [supplier, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Supplier not found" });
        }
        return res.json({ success: true, message: "Supplier updated" });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ success: false, message: "A supplier with this name already exists." });
        }
        console.error("Save supplier error:", error);
        return res.status(500).json({ success: false, message: "Failed to save supplier" });
    }
}

// POST /api/suppliers
const createSupplier = (req, res) => save(req, res);

// PUT /api/suppliers/:id
const updateSupplier = (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    return save(req, res, id);
};

// DELETE /api/suppliers/:id — only suppliers with no purchase history.
const deleteSupplier = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid supplier ID" });

    // One transaction: if the delete is refused, products keep their supplier.
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query("UPDATE products SET supplier_id = NULL WHERE supplier_id = ?", [id]);
        const [result] = await connection.query("DELETE FROM suppliers WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Supplier not found" });
        }

        await connection.commit();
        return res.json({ success: true, message: "Supplier deleted" });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});


        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                message: "This supplier has purchase orders. Deactivate it instead to keep the history."
            });
        }
        console.error("Delete supplier error:", error);
        return res.status(500).json({ success: false, message: "Failed to delete supplier" });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { createSupplier, deleteSupplier, getSuppliers, updateSupplier };
