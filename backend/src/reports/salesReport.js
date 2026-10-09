const { change, fillMonths, previousRange, sqlBounds, summarize } = require("./reportRules");

// What one group-by dimension looks like in SQL. Only these strings are ever
// interpolated into the query.
const DIMENSIONS = {
    product: { id: "p.id", label: "p.name", extra: "cat.name AS category_name" },
    customer: { id: "c.id", label: "c.company_name", extra: "c.city AS city" },
    category: { id: "cat.id", label: "cat.name", extra: "COUNT(DISTINCT p.id) AS products" },
    month: { id: "DATE_FORMAT(o.created_at, '%Y-%m')", label: "DATE_FORMAT(o.created_at, '%Y-%m')", extra: "NULL AS extra" }
};

const RETURNS_JOIN = `
    LEFT JOIN (
        SELECT cn.order_id, ci.product_id,
               SUM(ci.quantity) AS quantity,
               SUM(ci.quantity * ci.unit_price) AS amount,
               SUM(IF(ci.restocked, ci.quantity, 0)) AS restocked
        FROM credit_note_items ci
        INNER JOIN credit_notes cn ON cn.id = ci.credit_note_id
        GROUP BY cn.order_id, ci.product_id
    ) r ON r.order_id = oi.order_id AND r.product_id = oi.product_id`;

const MEASURES = `
    COUNT(DISTINCT o.id) AS orders,
    SUM(oi.quantity - COALESCE(r.quantity, 0)) AS units,
    SUM(oi.quantity * oi.unit_price - COALESCE(r.amount, 0)) AS revenue,
    SUM((oi.quantity - COALESCE(r.restocked, 0)) * COALESCE(oi.unit_cost, 0)) AS cost,
    SUM(IF(oi.list_price IS NULL, 0, oi.quantity * GREATEST(oi.list_price - oi.unit_price, 0))) AS discounts,
    SUM(COALESCE(r.amount, 0)) AS returns`;

const FROM = `
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN customers c ON c.id = o.customer_id
    INNER JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories cat ON cat.id = p.category_id
    ${RETURNS_JOIN}
    WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ?`;

async function totalsFor(connection, range) {
    const [[row]] = await connection.query(`SELECT ${MEASURES} ${FROM}`, sqlBounds(range));
    return summarize(row);
}

async function groupBy(connection, range, dimension) {
    const { id, label, extra } = DIMENSIONS[dimension];
    const [rows] = await connection.query(
        `SELECT ${id} AS id, ${label} AS label, ${extra}, ${MEASURES} ${FROM}
         GROUP BY ${id}, ${label}
         ORDER BY revenue DESC`,
        sqlBounds(range)
    );
    return rows.map((row) => {
        const { id: key, label: name, category_name: categoryName, city, products } = row;
        return {
            id: key,
            label: name,
            ...(categoryName !== undefined && { category_name: categoryName }),
            ...(city !== undefined && { city }),
            ...(products !== undefined && { products: Number(products) }),
            ...summarize(row)
        };
    });
}

/** The full report for one date range, compared with the period before it. */
async function salesReport(connection, range) {
    const previous = previousRange(range);
    const [totals, previousTotals, months, products, customers, categories] = await Promise.all([
        totalsFor(connection, range),
        totalsFor(connection, previous),
        groupBy(connection, range, "month"),
        groupBy(connection, range, "product"),
        groupBy(connection, range, "customer"),
        groupBy(connection, range, "category")
    ]);

    return {
        range,
        previous_range: previous,
        totals,
        previous_totals: previousTotals,
        changes: {
            revenue: change(totals.revenue, previousTotals.revenue),
            margin: change(totals.margin, previousTotals.margin),
            orders: change(totals.orders, previousTotals.orders)
        },
        monthly: fillMonths(months, range),
        by_product: products,
        by_customer: customers,
        by_category: categories
    };
}

module.exports = { salesReport };
