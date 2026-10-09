// Fills in missing costs, the same way migration 008 does: products from their
// received purchase orders (or an estimate), then order lines from products.
// Used by the large seed, which inserts products and orders after migrating.
async function backfillCosts(connection) {
    const [products] = await connection.query(
        `UPDATE products p
         LEFT JOIN (
            SELECT poi.product_id, SUM(poi.quantity * poi.unit_cost) / SUM(poi.quantity) AS cost
            FROM purchase_order_items poi
            INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
            WHERE po.status = 'Received'
            GROUP BY poi.product_id
         ) received ON received.product_id = p.id
         SET p.average_cost = ROUND(COALESCE(received.cost, p.price * (0.45 + MOD(p.id * 37, 30) / 100)), 2)
         WHERE p.average_cost IS NULL`
    );
    const [lines] = await connection.query(
        `UPDATE order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         SET oi.unit_cost = p.average_cost
         WHERE oi.unit_cost IS NULL`
    );
    return { products: products.affectedRows, lines: lines.affectedRows };
}

module.exports = { backfillCosts };
