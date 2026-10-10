const pool = require("../config/database");
const { parseJson } = require("../services/json");

const ENTITY_TYPES = ["customer", "product", "category", "order", "payment", "quote", "supplier", "purchase_order", "price_list", "volume_discount", "contract_price", "user", "portal_user"];

// GET /api/audit?entity_type=&entity_id=&user_id=&action=&q=&from=&to=&page=&limit=
const listAuditLog = async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const conditions = [];
    const params = [];

    if (ENTITY_TYPES.includes(req.query.entity_type)) {
        conditions.push("a.entity_type = ?");
        params.push(req.query.entity_type);
        if (/^\d{1,20}$/.test(req.query.entity_id ?? "")) {
            conditions.push("a.entity_id = ?");
            params.push(req.query.entity_id);
        }
    }
    const userId = Number.parseInt(req.query.user_id, 10);
    if (Number.isSafeInteger(userId) && userId > 0) {
        conditions.push("a.user_id = ?");
        params.push(userId);
    }
    if (typeof req.query.action === "string" && /^[a-z_]+(\.[a-z_]+)?$/.test(req.query.action)) {
        // "order" matches every order.* action; "order.created" matches one.
        conditions.push(req.query.action.includes(".") ? "a.action = ?" : "a.action LIKE ?");
        params.push(req.query.action.includes(".") ? req.query.action : `${req.query.action}.%`);
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
        conditions.push("(a.summary LIKE ? OR a.user_name LIKE ?)");
        const term = `%${req.query.q.trim().slice(0, 100)}%`;
        params.push(term, term);
    }
    for (const [key, operator, suffix] of [["from", ">=", "00:00:00"], ["to", "<=", "23:59:59"]]) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(req.query[key] ?? "")) {
            conditions.push(`a.created_at ${operator} ?`);
            params.push(`${req.query[key]} ${suffix}`);
        }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_log a ${where}`, params);
        const [rows] = await pool.query(
            `SELECT a.id, a.user_id, a.user_name, a.user_role, a.action, a.entity_type, a.entity_id,
                    a.summary, a.changes, a.details, a.method, a.path, a.status, a.ip, a.created_at
             FROM audit_log a
             ${where}
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );
        const [people] = await pool.query(
            `SELECT DISTINCT a.user_id AS id, a.user_name AS name, a.user_role AS role
             FROM audit_log a WHERE a.user_id IS NOT NULL ORDER BY a.user_name LIMIT 500`
        );

        return res.json({
            success: true,
            data: rows.map((row) => ({ ...row, id: Number(row.id), changes: parseJson(row.changes), details: parseJson(row.details) })),
            people,
            pagination: { page, limit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / limit)) }
        });
    } catch (error) {
        console.error("Audit log error:", error);
        return res.status(500).json({ success: false, message: "Failed to load the audit log" });
    }
};

module.exports = { listAuditLog };
