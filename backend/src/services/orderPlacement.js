const { recordMovement } = require("./inventory");
const { loadPricingContext } = require("../pricing/pricing");
const { resolvePrice } = require("../pricing/pricingRules");

// Creates an order inside the caller's transaction: locks products, checks
// they are active and in stock, prices the lines with the customer's pricing
// rules, writes the order, and decrements inventory. Used by POST /orders and by quote conversion.

class OrderPlacementError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * @param connection  a connection with an open transaction
 * @param customerId  existing customer id
 * @param lines       Map(productId → { quantity, unitPrice? }). unitPrice
 *                    overrides the pricing rules (used for quoted prices).
 * @param options     { userId } recorded on the stock movements.
 */
async function placeOrder(connection, customerId, lines, { userId = null } = {}) {
    const pricing = await loadPricingContext(connection, customerId);

    if (!pricing) {
        throw new OrderPlacementError(404, "Customer not found");
    }

    let totalCents = 0;
    const orderItems = [];

    // Lock products in id order so concurrent orders can't deadlock.
    const productIds = [...lines.keys()].sort((a, b) => a - b);

    for (const productId of productIds) {
        const { quantity, unitPrice } = lines.get(productId);

        const [products] = await connection.query(
            `SELECT id, name, price, category_id, stock, is_active
             FROM products
             WHERE id = ?
             FOR UPDATE`,
            [productId]
        );

        if (products.length === 0) {
            throw new OrderPlacementError(400, `Product ${productId} was not found`);
        }

        const product = products[0];

        if (!product.is_active) {
            throw new OrderPlacementError(400, `${product.name} is inactive`);
        }

        if (Number(product.stock) < quantity) {
            throw new OrderPlacementError(409, `Insufficient stock for ${product.name}`);
        }

        const resolved = unitPrice === undefined || unitPrice === null
            ? resolvePrice(pricing, product, quantity)
            : { unitPrice: Number(unitPrice), listPrice: Number(product.price), source: "quote" };
        const price = resolved.unitPrice;

        if (!Number.isFinite(price) || price < 0) {
            throw new Error(`Invalid price for product ${product.id}`);
        }

        // Calculate in cents to reduce floating-point errors
        const priceCents = Math.round(price * 100);
        totalCents += priceCents * quantity;

        if (!Number.isSafeInteger(totalCents)) {
            throw new Error("Order total exceeds the supported limit");
        }

        orderItems.push({
            product_id: product.id,
            quantity,
            unit_price: priceCents / 100,
            list_price: Number(resolved.listPrice),
            price_source: resolved.source
        });
    }

    const total = (totalCents / 100).toFixed(2);

    const [orderResult] = await connection.query(
        `INSERT INTO orders
            (customer_id, status, total_amount)
         VALUES (?, 'Pending', ?)`,
        [customerId, total]
    );

    const orderId = orderResult.insertId;

    for (const item of orderItems) {
        await connection.query(
            `INSERT INTO order_items
                (order_id, product_id, quantity, unit_price, list_price, price_source)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [orderId, item.product_id, item.quantity, item.unit_price.toFixed(2), item.list_price.toFixed(2), item.price_source]
        );

        // Stock was checked under lock above; the ledger records the sale.
        await recordMovement(connection, {
            productId: item.product_id,
            quantity: -item.quantity,
            type: "sale",
            reason: `Order #${orderId}`,
            orderId,
            userId
        });
    }

    return { orderId, total, items: orderItems };
}

module.exports = { OrderPlacementError, placeOrder };
