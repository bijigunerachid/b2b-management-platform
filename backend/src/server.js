require("dotenv").config({ quiet: true });

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const pool = require("./config/database");
const validateEnv = require("./config/validateEnv");
const { allowedOrigins } = require("./config/security");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { paymentRouter, receivablesRouter } = require("./routes/paymentRoutes");
const quoteRoutes = require("./routes/quoteRoutes");
const creditNoteRoutes = require("./routes/creditNoteRoutes");
const { pricingRouter } = require("./routes/pricingRoutes");
const reportRoutes = require("./routes/reportRoutes");
const { inventoryRouter, purchaseOrderRouter, supplierRouter } = require("./routes/purchasingRoutes");
const { portalRouter, portalUserRouter } = require("./routes/portalRoutes");
const {
    notFound,
    errorHandler
} = require("./middleware/errorMiddleware");
const {
    apiLimiter,
    originCheck,
    securityHeaders
} = require("./middleware/securityMiddleware");

validateEnv();

const app = express();

app.disable("x-powered-by");

// Behind a reverse proxy, set TRUST_PROXY (e.g. "1") so rate limits see
// the real client IP instead of the proxy's.
if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set("trust proxy", Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

app.use(securityHeaders);

app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin (curl, server-to-server) carry no
        // browser credentials risk; browsers must be on the allow-list.
        callback(null, !origin || allowedOrigins().includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
    maxAge: 600
}));

app.use(originCheck);
app.use(express.json({ limit: "100kb", strict: true }));
app.use(cookieParser());

// Responses carry business data: never let shared caches store them.
app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

// Liveness + database readiness for Docker and uptime monitors.
// Registered before the rate limiter so health probes are never throttled.
// Reports only up/down: no versions or error details.
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "ok" });
    } catch {
        res.status(503).json({ status: "unavailable" });
    }
});

app.use("/api", apiLimiter);

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "B2B Management API is running"
    });
});

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRouter);
app.use("/api/receivables", receivablesRouter);
app.use("/api/quotes", quoteRoutes);
app.use("/api/credit-notes", creditNoteRoutes);
app.use("/api/pricing", pricingRouter);
app.use("/api/reports", reportRoutes);
app.use("/api/suppliers", supplierRouter);
app.use("/api/purchase-orders", purchaseOrderRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/portal", portalRouter);
app.use("/api/portal-users", portalUserRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
