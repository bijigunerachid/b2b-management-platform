const { OrderPlacementError, placeOrder } = require("../services/orderPlacement");

/** Minimal in-memory stand-in for a MySQL connection. */
function fakeConnection({ customers = [1], products = {}, contracts = [], breaks = [], priceList = null } = {}) {
    const calls = [];
    const stock = Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.stock]));

    return {
        calls,
        stock,
        async query(sql, params = []) {
            calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });

            if (sql.includes("FROM customers")) {
                return [customers.includes(params[0]) ? [{ id: params[0], ...(priceList ?? {}) }] : []];
            }
            if (sql.includes("FROM customer_prices")) return [contracts];
            if (sql.includes("FROM volume_discounts")) return [breaks];
            if (sql.includes("FROM products") && sql.includes("FOR UPDATE")) {
                const product = products[params[0]];
                return [product ? [{ id: params[0], stock: stock[params[0]], ...product }] : []];
            }
            if (sql.includes("INSERT INTO orders")) return [{ insertId: 501 }];
            if (sql.includes("INSERT INTO order_items")) return [{ affectedRows: 1 }];
            if (sql.includes("UPDATE products SET stock = ?")) {
                const [balance, id] = params;
                stock[id] = balance;
                return [{ affectedRows: 1 }];
            }
            if (sql.includes("INSERT INTO stock_movements")) return [{ insertId: 1 }];
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

        // Every stock change is written to the ledger with its balance.
        const movements = connection.calls.filter((c) => c.sql.includes("INSERT INTO stock_movements"));
        expect(movements.map((m) => [m.params[0], m.params[1], m.params[2], m.params[4], m.params[5]])).toEqual([
            [1, -3, "sale", 97, 501],
            [3, -2, "sale", 8, 501]
        ]);
    });

    test("locks products in id order to avoid deadlocks", async () => {
        const connection = fakeConnection({ products: catalog });

        await placeOrder(connection, 1, new Map([[3, { quantity: 1 }], [1, { quantity: 1 }]]));

        // First acquisition order is what matters; re-locking a row the
        // transaction already holds (the ledger does) is a no-op in MySQL.
        const locked = connection.calls.filter((c) => c.sql.includes("FOR UPDATE")).map((c) => c.params[0]);
        expect([...new Set(locked)]).toEqual([1, 3]);
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

    test("applies the customer's pricing rules and records them on each line", async () => {
        const connection = fakeConnection({
            products: { 3: { ...catalog[3], category_id: 2 }, 1: { ...catalog[1], category_id: 5, average_cost: "0.04" } },
            priceList: { price_list_id: 4, price_list_name: "Gold", discount_percent: "10.00" },
            contracts: [{ product_id: 1, unit_price: "0.05" }],
            breaks: [{ category_id: 2, min_quantity: 2, discount_percent: "5.00" }]
        });

        const result = await placeOrder(connection, 1, new Map([[3, { quantity: 2 }], [1, { quantity: 3 }]]));

        // Chair: 850.10 × 0.9 × 0.95 = 726.84; mouse: contract price.
        expect(result.items).toEqual([
            { product_id: 1, quantity: 3, unit_price: 0.05, list_price: 0.1, price_source: "contract", unit_cost: 0.04 },
            { product_id: 3, quantity: 2, unit_price: 726.84, list_price: 850.1, price_source: "volume", unit_cost: null }
        ]);
        expect(result.total).toBe("1453.83");
    });

    test("quoted prices override the rules", async () => {
        const connection = fakeConnection({ products: catalog, priceList: { price_list_id: 4, price_list_name: "Gold", discount_percent: "10.00" } });
        const result = await placeOrder(connection, 1, new Map([[3, { quantity: 1, unitPrice: 800 }]]));
        expect(result.items[0]).toMatchObject({ unit_price: 800, list_price: 850.1, price_source: "quote" });
    });
});
