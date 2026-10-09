const { nextVolumeBreak, resolvePrice } = require("./pricingRules");

/**
 * Everything needed to price products for one customer: their active price
 * list, their contract prices, and the volume breaks. Returns null when the
 * customer doesn't exist.
 */
async function loadPricingContext(connection, customerId) {
    const [customers] = await connection.query(
        `SELECT c.id, pl.id AS price_list_id, pl.name AS price_list_name, pl.discount_percent
         FROM customers c
         LEFT JOIN price_lists pl ON pl.id = c.price_list_id AND pl.is_active = 1
         WHERE c.id = ?`,
        [customerId]
    );
    if (customers.length === 0) return null;

    const customer = customers[0];
    const [contracts] = await connection.query("SELECT product_id, unit_price FROM customer_prices WHERE customer_id = ?", [customerId]);
    const [breaks] = await connection.query("SELECT category_id, min_quantity, discount_percent FROM volume_discounts ORDER BY min_quantity");

    return {
        priceList: customer.price_list_id
            ? { id: customer.price_list_id, name: customer.price_list_name, discount_percent: Number(customer.discount_percent) }
            : null,
        contracts: new Map(contracts.map((row) => [Number(row.product_id), Number(row.unit_price)])),
        breaks: breaks.map((row) => ({ ...row, min_quantity: Number(row.min_quantity), discount_percent: Number(row.discount_percent) }))
    };
}

/** API shape for a priced line, with a hint about the next volume break. */
function describePrice(context, product, quantity) {
    const price = resolvePrice(context, product, quantity);
    const next = price.source === "contract" ? null : nextVolumeBreak(context.breaks, product.category_id, quantity);

    return {
        product_id: Number(product.id),
        quantity,
        list_price: price.listPrice,
        unit_price: price.unitPrice,
        price_source: price.source,
        discount_percent: price.discountPercent,
        label: price.label,
        next_break: next ? { min_quantity: next.min_quantity, discount_percent: next.discount_percent } : null
    };
}

module.exports = { describePrice, loadPricingContext };
