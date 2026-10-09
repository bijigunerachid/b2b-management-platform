const pool = require("../config/database");

/** A business-rule failure that maps to an HTTP status (4xx). */
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * Wraps an Express handler in one database transaction. The handler gets
 * (connection, req) and returns { status?, body }. Errors carrying a 4xx
 * `status` (HttpError, InventoryError, OrderPlacementError…) become JSON
 * responses; anything else rolls back and returns 500.
 */
function withTransaction(handler, failureMessage = "The request could not be processed.") {
    return async (req, res) => {
        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const result = await handler(connection, req);

            await connection.commit();
            return res.status(result.status ?? 200).json({ success: true, ...result.body });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => {});

            if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
                return res.status(error.status).json({ success: false, message: error.message });
            }

            console.error(failureMessage, error);
            return res.status(500).json({ success: false, message: failureMessage });
        } finally {
            if (connection) connection.release();
        }
    };
}

module.exports = { HttpError, withTransaction };
