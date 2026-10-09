const express = require("express");
require("dotenv").config();
const pool = require("./config/database");
const userRoutes = require("./routes/userRoutes");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const {
    notFound,
    errorHandler
} = require("./middleware/errorMiddleware");
const validateEnv = require("./config/validateEnv");
validateEnv();
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Root endpoint
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "B2B Management API is running"
    });
});

// Existing API routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Database connection test
app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS result");

        res.status(200).json({
            message: "MySQL connection successful",
            database: rows
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            message: "MySQL connection failed"
        });
    }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}