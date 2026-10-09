const { OrderPlacementError, placeOrder } = require("../services/orderPlacement");

/** Minimal in-memory stand-in for a MySQL connection. */
function fakeConnection({ customers = [1], products = {} } = {}) {
    const calls = [];
    const stock = Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.stock]));

    return {
        calls,
        stock,
        async query(sql, params = []) {
            calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });

            if (sql.includes("FROM customers")) {
                return [customers.includes(params[0]) ? [{ id: params[0] }] : []];
            }
            if (sql.includes("FROM products") && sql.includes("FOR UPDATE")) {
                const product = products[params[0]];
                return [product ? [{ id: params[0], stock: stock[params[0]], ...product }] : []];
            }
            if (sql.includes("INSERT INTO orders")) return [{ insertId: 501 }];
            if (sql.includes("INSERT INTO order_items")) return [{ affectedRows: 1 }];
            if (sql.includes("UPDATE products")) {
                const [quantity, id] = params;
                if (stock[id] < quantity) return [{ affectedRows: 0 }];
                stock[id] -= quantity;
                return [{ affectedRows: 1 }];
            }
            throw new Error(`Unexpected query: ${sql}`);
        }
    };
}

const catalog = {
    3: { name: "Chair", price: "850.10", is_active: 1, stock: 10 },
    1: { name: "Mouse", price: "0.10", is_active: 1, stock: 100 },
    7: { name: "Old desk", price: "100.00", is_active: 0, stock: 5 }
};

describe("placeOrder", () => {
    test("prices lines in cents, writes the order, and decrements stock", async () => {
        const connection = fakeConnection({ products: catalog });

        const result = await placeOrder(connection, 1, new Map([[3, { quantity: 2 }], [1, { quantity: 3 }]]));

        expect(result.orderId).toBe(501);
        expect(result.total).toBe("1700.50"); // 2 × 850.10 + 3 × 0.10, no float drift
        expect(connection.stock).toMatchObject({ 3: 8, 1: 97 });
    });

    test("locks products in id order to avoid deadlocks", async () => {
        const connection = fakeConnection({ products: catalog });

        await placeOrder(connection, 1, new Map([[3, { quantity: 1 }], [1, { quantity: 1 }]]));

        const locked = connection.calls.filter((c) => c.sql.includes("FOR UPDATE")).map((c) => c.params[0]);
        expect(locked).toEqual([1, 3]);
    });

    test("uses quoted unit prices when given", async () => {
        const connection = fakeConnection({ products: catalog });

        const result = await placeOrder(connection, 1, new Map([[3, { quantity: 2, unitPrice: 799.99 }]]));

        expect(result.total).toBe("1599.98");
        expect(result.items[0].unit_price).toBe(799.99);
    });

    test.each([
        ["unknown customer", { customer: 99, lines: [[3, 1]] }, 404, "Customer not found"],
        ["unknown product", { customer: 1, lines: [[42, 1]] }, 400, "Product 42 was not found"],
        ["inactive product", { customer: 1, lines: [[7, 1]] }, 400, "Old desk is inactive"],
        ["not enough stock", { customer: 1, lines: [[3, 11]] }, 409, "Insufficient stock for Chair"]
    ])("rejects %s without writing an order", async (_label, { customer, lines }, status, message) => {
        const connection = fakeConnection({ products: catalog });

        const attempt = placeOrder(connection, customer, new Map(lines.map(([id, quantity]) => [id, { quantity }])));

        await expect(attempt).rejects.toBeInstanceOf(OrderPlacementError);
        await expect(attempt).rejects.toMatchObject({ status, message });
        expect(connection.calls.some((c) => c.sql.includes("INSERT INTO orders"))).toBe(false);
    });
});
