const pool = require("../config/database");
const { listModels, productForecast } = require("../ml/mlStore");

// GET /api/ml/models
const getModels = async (req, res) => {
    try {
        return res.json({ success: true, data: await listModels(pool) });
    } catch (error) {
        console.error("ML models error:", error);
        return res.status(500).json({ success: false, message: "Failed to load models" });
    }
};

// GET /api/ml/forecasts/products/:id
const getProductForecast = async (req, res) => {
    const productId = Number.parseInt(req.params.id, 10);
    if (!/^\d{1,10}$/.test(req.params.id) || productId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    try {
        const [products] = await pool.query("SELECT id FROM products WHERE id = ?", [productId]);
        if (!products.length) return res.status(404).json({ success: false, message: "Product not found" });
        return res.json({ success: true, data: await productForecast(pool, productId) });
    } catch (error) {
        console.error("Product forecast error:", error);
        return res.status(500).json({ success: false, message: "Failed to load the forecast" });
    }
};

module.exports = { getModels, getProductForecast };
