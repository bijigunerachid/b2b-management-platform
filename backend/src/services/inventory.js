// The only way stock changes. Each call updates products.stock and writes a
// stock_movements row with the resulting balance, inside the caller's
// transaction, so SUM(movements.quantity) always equals products.stock.

const MOVEMENT_TYPES = ["opening", "sale", "sale_cancelled", "purchase_receipt", "adjustment"];

const ADJUSTMENT_REASONS = [
    "Stock count correction",
    "Damaged",
    "Lost or stolen",
    "Expired",
    "Returned by customer",
    "Found",
    "Other"
];

class InventoryError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * Applies a signed stock change and records it.
 * @returns {Promise<number>} the new stock balance
 */
async function recordMovement(connection, { productId, quantity, type, reason = null, orderId = null, purchaseOrderId = null, userId = null }) {
    if (!MOVEMENT_TYPES.includes(type)) {
        throw new Error(`Unknown movement type: ${type}`);
    }
    if (!Number.isSafeInteger(quantity) || quantity === 0) {
        throw new Error("Movement quantity must be a non-zero integer");
    }

    // Lock the row (re-entrant if the caller already holds it).
    const [rows] = await connection.query("SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE", [productId]);
    const product = rows[0];

    if (!product) {
        throw new InventoryError(404, `Product ${productId} was not found`);
    }

    const balance = Number(product.stock) + quantity;
    if (balance < 0) {
        throw new InventoryError(409, `${product.name} has only ${product.stock} in stock`);
    }

    await connection.query("UPDATE products SET stock = ? WHERE id = ?", [balance, productId]);
    await connection.query(
        `INSERT INTO stock_movements
            (product_id, quantity, type, reason, balance_after, order_id, purchase_order_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, quantity, type, reason, balance, orderId, purchaseOrderId, userId]
    );

    return balance;
}

module.exports = { ADJUSTMENT_REASONS, InventoryError, MOVEMENT_TYPES, recordMovement };
