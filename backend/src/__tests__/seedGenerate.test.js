const { STATUSES, generateDataset } = require("../seed/generate");

const now = new Date(2026, 9, 9, 12, 0, 0);
const options = { seed: 7, customers: 60, products: 80, orders: 600, users: 10, months: 12, now };

describe("seed dataset generator", () => {
    const data = generateDataset(options);

    test("creates the requested volumes", () => {
        expect(data.customers).toHaveLength(60);
        expect(data.products).toHaveLength(80);
        expect(data.orders).toHaveLength(600);
        expect(data.users).toHaveLength(10);
    });

    test("is deterministic for the same seed", () => {
        expect(generateDataset(options)).toEqual(data);
    });

    test("order totals equal the sum of their items", () => {
        for (const order of data.orders) {
            const sum = order.items.reduce((total, item) => total + item.quantity * item.unit_price, 0);
            expect(order.total_amount).toBeCloseTo(sum, 2);
        }
    });

    test("orders use valid statuses, distinct products, and positive quantities", () => {
        for (const order of data.orders) {
            expect(STATUSES).toContain(order.status);
            const ids = order.items.map((item) => item.productIndex);
            expect(new Set(ids).size).toBe(ids.length);
            for (const item of order.items) {
                expect(Number.isInteger(item.quantity)).toBe(true);
                expect(item.quantity).toBeGreaterThan(0);
                expect(item.unit_price).toBe(data.products[item.productIndex].price);
            }
        }
    });

    test("dates are never in the future and customers precede their orders", () => {
        for (const order of data.orders) {
            expect(order.created_at.getTime()).toBeLessThanOrEqual(now.getTime());
            expect(data.customers[order.customerIndex].created_at.getTime()).toBeLessThanOrEqual(order.created_at.getTime());
        }
    });

    test("old orders are settled; only recent ones are pending", () => {
        const monthAgo = now.getTime() - 30 * 86400000;
        for (const order of data.orders) {
            if (order.created_at.getTime() < monthAgo) {
                expect(["Completed", "Cancelled"]).toContain(order.status);
            }
        }
    });

    test("prices, stock, and seeded users stay within safe bounds", () => {
        for (const product of data.products) {
            expect(product.price).toBeGreaterThanOrEqual(0);
            expect(product.stock).toBeGreaterThanOrEqual(0);
        }
        expect(data.products.some((product) => product.stock <= 5)).toBe(true);
        for (const user of data.users) {
            expect(user.role).not.toBe("Admin");
            expect(user.email.endsWith("@seed.b2b.local")).toBe(true);
        }
    });
});
