const pool = require("../config/database");
const { describe } = require("../audit/describe");

// Records every successful change made through the API (and sign-in attempts)
// once the response has been sent. Controllers can attach field-level changes
// with recordChanges(req, changes). A failed write is logged, never surfaced:
// the change it describes has already been committed.
function auditTrail(req, res, next) {
    // Unit tests run the app without a database.
    if (process.env.NODE_ENV === "test" || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

    const json = res.json.bind(res);
    res.json = (body) => {
        res.locals.auditBody = body;
        return json(body);
    };

    res.on("finish", () => {
        const entry = describe(
            { method: req.method, path: req.originalUrl.split("?")[0], body: req.body },
            { status: res.statusCode, body: res.locals.auditBody }
        );
        if (!entry) return;

        const actor = entry.actor !== undefined
            ? entry.actor
            : req.user
                ? { id: req.user.userId, role: req.user.role }
                : res.locals.auditActor ?? null;
        // Signing out without a session changes nothing worth recording.
        if (entry.action === "auth.logout" && !actor) return;
        writeEntry({ ...entry, actor, changes: req.auditChanges ?? null }, req, res.statusCode).catch((error) => {
            console.error("Audit log write failed:", error.message);
        });
    });

    next();
}

async function writeEntry(entry, req, status) {
    const [entityType, entityId] = entry.entity ?? [null, null];
    await pool.query(
        `INSERT INTO audit_log
            (user_id, user_name, user_role, action, entity_type, entity_id, summary, changes, details, method, path, status, ip)
         VALUES (
            ?,
            (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ?),
            COALESCE(?, (SELECT r.name FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = ?)),
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         )`,
        [
            entry.actor?.id ?? null,
            entry.actor?.id ?? null,
            entry.actor?.role ?? null,
            entry.actor?.id ?? null,
            entry.action,
            entityId === null || entityId === undefined ? null : entityType,
            entityId === null || entityId === undefined ? null : String(entityId),
            String(entry.summary).slice(0, 255),
            entry.changes?.length ? JSON.stringify(entry.changes) : null,
            entry.details ? JSON.stringify(entry.details) : null,
            req.method,
            req.originalUrl.split("?")[0].slice(0, 255),
            status,
            (req.ip ?? "").slice(0, 45)
        ]
    );
}

/** Attaches field-level changes ({ field, from, to }[]) to this request's audit entry. */
function recordChanges(req, changes) {
    if (changes?.length) req.auditChanges = [...(req.auditChanges ?? []), ...changes];
}

module.exports = { auditTrail, recordChanges };
