const pool = require("../config/database");
const { parseRange } = require("../reports/reportRules");
const { salesReport } = require("../reports/salesReport");

// GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
const getSalesReport = async (req, res) => {
    const { error, value } = parseRange(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    try {
        return res.json({ success: true, data: await salesReport(pool, value) });
    } catch (err) {
        console.error("Sales report error:", err);
        return res.status(500).json({ success: false, message: "Failed to build the report" });
    }
};

module.exports = { getSalesReport };
