
const pool = require("../config/database");
const { ageingReport } = require("../billing/billing");
const { loadOpenInvoices } = require("../billing/queries");

// Returns exactly six months (oldest first), with zeros for months without orders.
function fillMonths(rows, now = new Date()) {
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  const months = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const row = byMonth.get(key);

    months.push({
      month: key,
      orders: Number(row?.orders ?? 0),
      revenue: Number(row?.revenue ?? 0),
    });
  }

  return months;
}

async function getDashboardStats(req, res) {
  try {
    const [customerRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM customers"
    );

    const [productRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM products"
    );

    const [orderRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM orders"
    );

    const [revenueRows] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE status = 'Completed'
    `);

    const [lowStockRows] = await pool.query(`
      SELECT id, name, stock, reorder_point
      FROM products
      WHERE is_active = 1 AND reorder_point > 0 AND stock <= reorder_point
      ORDER BY stock / reorder_point ASC, stock ASC
      LIMIT 10
    `);

    const [recentOrders] = await pool.query(`
      SELECT
        o.id,
        o.status,
        o.total_amount,
        o.created_at,
        c.company_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    // Completed revenue and order volume for the last six calendar months.
    const [monthlyRows] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS orders,
        COALESCE(SUM(CASE WHEN status = 'Completed' THEN total_amount END), 0) AS revenue
      FROM orders
      WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
      GROUP BY month
      ORDER BY month
    `);

    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS total
      FROM orders
      GROUP BY status
    `);

    const [topProducts] = await pool.query(`
      SELECT
        p.id,
        p.name,
        SUM(oi.quantity) AS quantity,
        SUM(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN products p ON p.id = oi.product_id
      WHERE o.status <> 'Cancelled'
      GROUP BY p.id, p.name
      ORDER BY quantity DESC
      LIMIT 5
    `);

    const receivables = ageingReport(await loadOpenInvoices(pool));

    const [expiringQuotes] = await pool.query(`
      SELECT q.id, c.company_name, DATE_FORMAT(q.valid_until, '%Y-%m-%d') AS valid_until,
             DATEDIFF(q.valid_until, CURDATE()) AS days_left
      FROM quotes q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.status = 'Sent'
        AND q.valid_until BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      ORDER BY q.valid_until
      LIMIT 5
    `);

    const [[{ lateOrders }]] = await pool.query(
      "SELECT COUNT(*) AS lateOrders FROM purchase_orders WHERE status = 'Ordered' AND expected_at < CURDATE()"
    );

    const [[{ readyToConvert }]] = await pool.query(
      "SELECT COUNT(*) AS readyToConvert FROM quotes WHERE status = 'Accepted'"
    );

    res.json({
      success: true,
      data: {
        totalCustomers: Number(customerRows[0].total),
        totalProducts: Number(productRows[0].total),
        totalOrders: Number(orderRows[0].total),
        totalRevenue: Number(revenueRows[0].revenue),
        lowStockProducts: lowStockRows,
        recentOrders,
        monthlyRevenue: fillMonths(monthlyRows),
        ordersByStatus: Object.fromEntries(
          statusRows.map((row) => [row.status, Number(row.total)])
        ),
        purchasing: {
          lateOrders: Number(lateOrders),
        },
        quotes: {
          expiringSoon: expiringQuotes,
          readyToConvert: Number(readyToConvert),
        },
        receivables: {
          outstanding: receivables.outstanding,
          overdue: receivables.overdue,
          overdueCount: receivables.overdue_count,
        },
        topProducts: topProducts.map((row) => ({
          id: row.id,
          name: row.name,
          quantity: Number(row.quantity),
          revenue: Number(row.revenue),
        })),
      },
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load dashboard statistics.",
    });
  }
}

module.exports = { getDashboardStats, fillMonths };