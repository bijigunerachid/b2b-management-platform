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

describe("payment generator", () => {
    const { invoiceTotals } = require("../billing/billing");
    const data = generateDataset({ seed: 11, customers: 40, products: 50, orders: 800, users: 2, months: 12, now });

    const paidByOrder = new Map();
    for (const payment of data.payments) {
        paidByOrder.set(payment.key, (paidByOrder.get(payment.key) ?? 0) + payment.amount);
    }

    test("never pays cancelled orders or more than the invoice total", () => {
        for (const [key, paid] of paidByOrder) {
            const order = data.orders[key];
            expect(order.status).not.toBe("Cancelled");
            expect(paid).toBeLessThanOrEqual(invoiceTotals(order.total_amount).total + 0.005);
        }
    });

    test("payments are positive and dated between the order and now", () => {
        for (const payment of data.payments) {
            const order = data.orders[payment.key];
            expect(payment.amount).toBeGreaterThan(0);
            expect(payment.paid_at.getTime()).toBeGreaterThanOrEqual(order.created_at.getTime());
            expect(payment.paid_at.getTime()).toBeLessThanOrEqual(now.getTime());
        }
    });

    test("older invoices are mostly settled, recent ones mostly open", () => {
        const settledShare = (filter) => {
            const orders = data.orders.map((order, key) => ({ order, key })).filter(({ order }) => order.status !== "Cancelled" && filter(order));
            const settled = orders.filter(({ order, key }) => (paidByOrder.get(key) ?? 0) >= invoiceTotals(order.total_amount).total - 0.005);
            return settled.length / orders.length;
        };
        const ageDays = (order) => (now - order.created_at) / 86400000;

        expect(settledShare((order) => ageDays(order) > 90)).toBeGreaterThan(0.8);
        expect(settledShare((order) => ageDays(order) < 20)).toBeLessThan(0.5);
    });

    test("payment habits belong to the customer, so the past predicts the future", () => {
        const { payerProfile } = require("../seed/generate");
        expect(payerProfile(7)).toEqual(payerProfile(7));

        // Days after the due date that each settled invoice was fully paid.
        const delays = new Map();
        data.orders.forEach((order, key) => {
            const paid = data.payments.filter((payment) => payment.key === key);
            const total = invoiceTotals(order.total_amount).total;
            if (order.status === "Cancelled" || paid.reduce((sum, payment) => sum + payment.amount, 0) < total - 0.005) return;
            const last = Math.max(...paid.map((payment) => payment.paid_at.getTime()));
            const delay = (last - order.created_at.getTime()) / 86400000 - 30;
            const type = payerProfile(order.customerIndex).type;
            delays.set(type, [...(delays.get(type) ?? []), delay]);
        });
        const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
        expect(mean(delays.get("early"))).toBeLessThan(mean(delays.get("on_time")));
        expect(mean(delays.get("on_time"))).toBeLessThan(mean(delays.get("slow")));
    });
});
