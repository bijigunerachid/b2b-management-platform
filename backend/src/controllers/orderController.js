
const pool = require("../config/database");

// GET /api/orders
const getOrders = async (req, res) => {
    try {
        const [orders] = await pool.query(`
            SELECT
                o.id,
                o.customer_id,
                c.company_name,
                o.status,
                o.total_amount,
                o.created_at
            FROM orders o
            INNER JOIN customers c ON c.id = o.customer_id
            ORDER BY o.id DESC
        `);

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
            `SELECT
                o.id,
                o.customer_id,
                c.company_name,
                o.status,
                o.total_amount,
                o.created_at
             FROM orders o
             INNER JOIN customers c ON c.id = o.customer_id
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
                ...orders[0],
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

        // 3. Acquire a connection and start a transaction
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        // 4. Verify customer exists
        const [customers] = await connection.query(
            "SELECT id FROM customers WHERE id = ?",
            [customerId]
        );

        if (customers.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        let totalCents = 0;
        const orderItems = [];

        // 5. Lock products, check availability and calculate prices
        for (const [productId, quantity] of quantities) {
            const [products] = await connection.query(
                `SELECT id, name, price, stock, is_active
                 FROM products
                 WHERE id = ?
                 FOR UPDATE`,
                [productId]
            );

            if (products.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    success: false,
                    message: `Product ${productId} was not found`
                });
            }

            const product = products[0];

            if (!product.is_active) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    success: false,
                    message: `${product.name} is inactive`
                });
            }

            if (Number(product.stock) < quantity) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message: `Insufficient stock for ${product.name}`
                });
            }

            const price = Number(product.price);

            if (!Number.isFinite(price) || price < 0) {
                throw new Error(
                    `Invalid database price for product ${product.id}`
                );
            }

            // Calculate in cents to reduce floating-point errors
            const priceCents = Math.round(price * 100);
            totalCents += priceCents * quantity;

            if (!Number.isSafeInteger(totalCents)) {
                throw new Error("Order total exceeds the supported limit");
            }

            orderItems.push({
                product_id: product.id,
                quantity,
                unit_price: priceCents / 100
            });
        }

        const total = (totalCents / 100).toFixed(2);

        // 6. Create order header
        const [orderResult] = await connection.query(
            `INSERT INTO orders
                (customer_id, status, total_amount)
             VALUES (?, 'Pending', ?)`,
            [customerId, total]
        );

        const orderId = orderResult.insertId;

        // 7. Save items and decrease inventory
        for (const item of orderItems) {
            await connection.query(
                `INSERT INTO order_items
                    (order_id, product_id, quantity, unit_price)
                 VALUES (?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.quantity,
                    item.unit_price.toFixed(2)
                ]
            );

            const [updateResult] = await connection.query(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ?
                   AND is_active = 1
                   AND stock >= ?`,
                [
                    item.quantity,
                    item.product_id,
                    item.quantity
                ]
            );

            if (updateResult.affectedRows !== 1) {
                throw new Error(
                    `Inventory update failed for product ${item.product_id}`
                );
            }
        }

        // 8. Commit all changes together
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