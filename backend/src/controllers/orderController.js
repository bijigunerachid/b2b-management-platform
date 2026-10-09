
const pool = require("../config/database");
const { withBilling } = require("../billing/billing");
const { ORDER_BILLING_COLUMNS, PAID_JOIN } = require("../billing/queries");
const { OrderPlacementError, placeOrder } = require("../services/orderPlacement");

// GET /api/orders
const getOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT ${ORDER_BILLING_COLUMNS}
            FROM orders o
            INNER JOIN customers c ON c.id = o.customer_id
            ${PAID_JOIN}
            ORDER BY o.id DESC
        `);

        const now = new Date();
        const orders = rows.map((row) => withBilling(row, now));

        return res.json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error("Get orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve orders"
        });
    }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const [orders] = await pool.query(
            `SELECT ${ORDER_BILLING_COLUMNS}
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
             ${PAID_JOIN}
             WHERE o.id = ?`,
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const [items] = await pool.query(
            `SELECT
                oi.product_id,
                p.name AS product_name,
                oi.quantity,
                oi.unit_price,
                (oi.quantity * oi.unit_price) AS subtotal
             FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?`,
            [id]
        );

        return res.json({
            success: true,
            data: {
                ...withBilling(orders[0]),
                items
            }
        });
    } catch (error) {
        console.error("Get order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve order"
        });
    }
};

// POST /api/orders
const createOrder = async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const { customer_id, items } = req.body || {};
        const customerId = Number(customer_id);

        // 1. Validate customer ID
        if (
            !Number.isSafeInteger(customerId) ||
            customerId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid customer_id is required"
            });
        }

        // 2. Validate order items
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one order item is required"
            });
        }

        // Bound the work (and row locks) a single request can trigger.
        if (items.length > 100) {
            return res.status(400).json({
                success: false,
                message: "An order can contain at most 100 items"
            });
        }

        // Combine duplicate product IDs
        const quantities = new Map();

        for (const item of items) {
            const productId = Number(item?.product_id);
            const quantity = Number(item?.quantity);

            if (
                !Number.isSafeInteger(productId) ||
                productId < 1 ||
                !Number.isSafeInteger(quantity) ||
                quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Each item needs a valid product_id and positive integer quantity"
                });
            }

            const newQuantity =
                (quantities.get(productId) || 0) + quantity;

            if (!Number.isSafeInteger(newQuantity)) {
                return res.status(400).json({
                    success: false,
                    message: "Requested quantity is too large"
                });
            }

            quantities.set(productId, newQuantity);
        }

        // 3. Place the order inside one transaction
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const lines = new Map(
            [...quantities].map(([productId, quantity]) => [productId, { quantity }])
        );

        let placed;

        try {
            placed = await placeOrder(connection, customerId, lines);
        } catch (error) {
            if (error instanceof OrderPlacementError) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(error.status).json({
                    success: false,
                    message: error.message
                });
            }

            throw error;
        }

        const { orderId, total, items: orderItems } = placed;

        // 4. Commit all changes together
        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: {
                orderId,
                customer_id: customerId,
                total_amount: total,
                status: "Pending",
                items: orderItems
            }
        });
    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Order rollback error:", rollbackError);
            }
        }

        console.error("Create order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create order"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const orderId = Number(req.params.id);
        const { status } = req.body || {};

        if (!Number.isSafeInteger(orderId) || orderId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const allowedTransitions = {
            Pending: ["Processing", "Cancelled"],
            Processing: ["Completed", "Cancelled"],
            Completed: [],
            Cancelled: []
        };

        if (!Object.prototype.hasOwnProperty.call(
            allowedTransitions,
            status
        )) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status"
            });
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        // Lock order to prevent simultaneous status changes
        const [orders] = await connection.query(
            `SELECT id, status
             FROM orders
             WHERE id = ?
             FOR UPDATE`,
            [orderId]
        );

        if (orders.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const currentStatus = orders[0].status;

        if (currentStatus === status) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(409).json({
                success: false,
                message: `Order is already ${status}`
            });
        }

        if (!allowedTransitions[currentStatus]?.includes(status)) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(409).json({
                success: false,
                message:
                    `Cannot change order status from ${currentStatus} to ${status}`
            });
        }

        // Money already received must be voided (refunded) before cancelling.
        if (status === "Cancelled") {
            const [[{ activePayments }]] = await connection.query(
                `SELECT COUNT(*) AS activePayments
                 FROM payments
                 WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );

            if (Number(activePayments) > 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message:
                        "This order has recorded payments. Void them before cancelling the order."
                });
            }
        }

        // Restore stock only when moving to Cancelled
        if (status === "Cancelled") {
            const [items] = await connection.query(
                `SELECT product_id, quantity
                 FROM order_items
                 WHERE order_id = ?`,
                [orderId]
            );

            for (const item of items) {
                const [updateResult] = await connection.query(
                    `UPDATE products
                     SET stock = stock + ?
                     WHERE id = ?`,
                    [item.quantity, item.product_id]
                );

                if (updateResult.affectedRows !== 1) {
                    throw new Error(
                        `Could not restore stock for product ${item.product_id}`
                    );
                }
            }
        }

        await connection.query(
            "UPDATE orders SET status = ? WHERE id = ?",
            [status, orderId]
        );

        await connection.commit();
        transactionStarted = false;

        return res.json({
            success: true,
            message: "Order status updated successfully",
            data: {
                orderId,
                previousStatus: currentStatus,
                status
            }
        });
    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Status rollback error:", rollbackError);
            }
        }

        console.error("Update order status error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update order status"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    updateOrderStatus
};