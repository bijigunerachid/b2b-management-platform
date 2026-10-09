
const pool = require("../config/database");

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
      SELECT id, name, stock
      FROM products
      WHERE is_active = 1 AND stock <= 5
      ORDER BY stock ASC
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

    res.json({
      success: true,
      data: {
        totalCustomers: Number(customerRows[0].total),
        totalProducts: Number(productRows[0].total),
        totalOrders: Number(orderRows[0].total),
        totalRevenue: Number(revenueRows[0].revenue),
        lowStockProducts: lowStockRows,
        recentOrders,
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

module.exports = { getDashboardStats };