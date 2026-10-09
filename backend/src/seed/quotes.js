// Generates a realistic quote pipeline from the data already in the
// database. Converted quotes are derived from real orders (same customer,
// lines, and prices, dated a few days earlier) so the history is consistent;
// the rest are open, accepted, rejected, or expired offers.

const { createRandom } = require("./generate");
const { dateOnly, addDays } = require("../quotes/quoteRules");

const DAY_MS = 86400000;
const DISCOUNTS = [[0, 50], [0.05, 25], [0.1, 15], [0.15, 10]];

function cents(value) {
    return Math.round(Number(value) * 100) / 100;
}

/**
 * Inserts quotes inside the caller's transaction. Does nothing when quotes
 * already exist, so it is safe to run more than once.
 * Returns the number of quotes created.
 */
async function seedQuotes(connection, { seed = 77, now = new Date(), converted = 320, open = 260 } = {}) {
    const [[{ existing }]] = await connection.query("SELECT COUNT(*) AS existing FROM quotes");
    if (Number(existing) > 0) return 0;

    const random = createRandom(seed);
    const yearAgo = new Date(now.getTime() - 365 * DAY_MS);

    const [orders] = await connection.query(
        "SELECT id, customer_id, total_amount, created_at FROM orders WHERE created_at >= ? ORDER BY id",
        [yearAgo]
    );
    const [customers] = await connection.query("SELECT id FROM customers");
    const [products] = await connection.query("SELECT id, price FROM products WHERE is_active = 1");

    if (customers.length === 0 || products.length === 0) return 0;

    const listPrice = new Map(products.map((product) => [product.id, Number(product.price)]));
    const quotes = [];

    // 1. Converted quotes, one per sampled order.
    const shuffled = [...orders];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = random.int(0, i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const sampled = shuffled.slice(0, converted);
    const orderIds = sampled.map((order) => order.id);
    const [orderItems] = orderIds.length
        ? await connection.query("SELECT order_id, product_id, quantity, unit_price FROM order_items WHERE order_id IN (?)", [orderIds])
        : [[]];
    const itemsByOrder = new Map();
    for (const item of orderItems) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id).push(item);
    }

    for (const order of sampled) {
        const orderDate = new Date(order.created_at);
        const created = new Date(orderDate.getTime() - random.int(3, 14) * DAY_MS);
        const sent = new Date(created.getTime() + random.int(0, 1) * DAY_MS + random.int(1, 8) * 3600000);
        const decided = new Date(Math.min(orderDate.getTime(), sent.getTime() + random.int(1, 5) * DAY_MS));

        quotes.push({
            customer_id: order.customer_id,
            status: "Converted",
            created_at: created,
            valid_until: dateOnly(addDays(created, 30)),
            sent_at: sent,
            decided_at: decided,
            converted_at: orderDate,
            order_id: order.id,
            items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: Number(item.unit_price),
                list_price: listPrice.get(item.product_id) ?? Number(item.unit_price)
            }))
        });
    }

    // 2. Open, accepted, rejected, and expired offers.
    for (let index = 0; index < open; index += 1) {
        const ageDays = Math.floor(random.next() ** 1.6 * 300);
        const created = new Date(now.getTime() - ageDays * DAY_MS - random.int(0, 8) * 3600000);
        const validity = random.weighted([[15, 20], [30, 65], [60, 15]]);

        const status =
            ageDays < 7
                ? random.weighted([["Draft", 35], ["Sent", 55], ["Accepted", 10]])
                : ageDays < 45
                  ? random.weighted([["Sent", 45], ["Accepted", 15], ["Rejected", 40]])
                  : random.weighted([["Sent", 40], ["Rejected", 60]]); // old "Sent" ones read as Expired

        const lineCount = random.weighted([[1, 25], [2, 30], [3, 25], [4, 12], [5, 8]]);
        const chosen = new Set();
        while (chosen.size < Math.min(lineCount, products.length)) {
            chosen.add(products[random.int(0, products.length - 1)].id);
        }

        const discount = random.weighted(DISCOUNTS);
        const items = [...chosen].map((productId) => {
            const price = listPrice.get(productId);
            const maxQuantity = price < 50 ? 80 : price < 300 ? 25 : price < 1500 ? 10 : 4;
            return {
                product_id: productId,
                quantity: random.int(1, maxQuantity),
                unit_price: cents(price * (1 - discount)),
                list_price: price
            };
        });

        // Each step is capped at "now", which keeps created ≤ sent ≤ decided.
        const sent = status === "Draft"
            ? null
            : new Date(Math.min(now.getTime(), created.getTime() + random.int(1, 30) * 3600000));
        const decided = ["Accepted", "Rejected"].includes(status)
            ? new Date(Math.min(now.getTime(), sent.getTime() + random.int(1, 12) * DAY_MS))
            : null;

        quotes.push({
            customer_id: customers[random.int(0, customers.length - 1)].id,
            status,
            created_at: created,
            valid_until: dateOnly(addDays(created, validity)),
            sent_at: sent,
            decided_at: decided,
            converted_at: null,
            order_id: null,
            items
        });
    }

    quotes.sort((a, b) => a.created_at - b.created_at);

    const notes = [null, null, null, "Delivery within 10 working days.", "Prices include volume discount.", "Valid for the quantities listed.", "Installation available on request."];
    const [[{ nextId }]] = await connection.query("SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM quotes");

    const quoteRows = quotes.map((quote, index) => [
        Number(nextId) + index,
        quote.customer_id,
        quote.status,
        quote.valid_until,
        notes[random.int(0, notes.length - 1)],
        quote.items.reduce((sum, item) => cents(sum + item.quantity * item.unit_price), 0),
        quote.created_at,
        quote.sent_at,
        quote.decided_at,
        quote.converted_at,
        quote.order_id
    ]);

    const itemRows = quotes.flatMap((quote, index) =>
        quote.items.map((item) => [Number(nextId) + index, item.product_id, item.quantity, item.unit_price, item.list_price])
    );

    for (let start = 0; start < quoteRows.length; start += 1000) {
        await connection.query(
            `INSERT INTO quotes
                (id, customer_id, status, valid_until, notes, total_amount, created_at, sent_at, decided_at, converted_at, order_id)
             VALUES ?`,
            [quoteRows.slice(start, start + 1000)]
        );
    }
    for (let start = 0; start < itemRows.length; start += 1000) {
        await connection.query(
            "INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, list_price) VALUES ?",
            [itemRows.slice(start, start + 1000)]
        );
    }

    return quotes.length;
}

module.exports = { seedQuotes };
