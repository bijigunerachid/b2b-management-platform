const { createRandom } = require("./generate");
const { createCreditNote } = require("../services/creditNotes");

// Credit notes on about 4% of completed orders, created through the same
// service as the app (quantity checks, stock ledger, refunds). Skips when
// credit notes already exist. Runs inside the caller's transaction.
const REASONS = [
    ["Damaged in transit", 35],
    ["Defective", 25],
    ["Wrong item", 20],
    ["No longer needed", 15],
    ["Other", 5]
];
const NOTES = {
    "Damaged in transit": ["Boxes crushed on delivery", "Delivered with broken packaging", null],
    Defective: ["Stopped working after a week", "Fails on start-up", null],
    "Wrong item": ["Wrong model shipped", "Wrong color", null],
    "No longer needed": ["Project cancelled", "Ordered too many", null],
    Other: ["Customer changed supplier", "Duplicate delivery"]
};
const METHODS = [["Bank transfer", 70], ["Cheque", 20], ["Cash", 10]];
const DAY_MS = 24 * 60 * 60 * 1000;

async function seedReturns(connection, { now = new Date() } = {}) {
    const [[{ existing }]] = await connection.query("SELECT COUNT(*) AS existing FROM credit_notes");
    if (Number(existing) > 0) return null;

    const [[manager]] = await connection.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('Manager', 'Admin') AND u.is_active = 1 ORDER BY r.name = 'Manager' DESC, u.id LIMIT 1`
    );
    const [orders] = await connection.query("SELECT id, created_at FROM orders WHERE status = 'Completed' ORDER BY id");
    const [items] = await connection.query(
        `SELECT oi.order_id, oi.product_id, oi.quantity FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id WHERE o.status = 'Completed' ORDER BY oi.id`
    );
    const linesByOrder = new Map();
    for (const item of items) {
        if (!linesByOrder.has(item.order_id)) linesByOrder.set(item.order_id, []);
        linesByOrder.get(item.order_id).push(item);
    }

    let created = 0;
    let refunds = 0;

    for (const order of orders) {
        const random = createRandom(7100 + order.id);
        if (!random.chance(0.04)) continue;

        const lines = linesByOrder.get(order.id) ?? [];
        const fullReturn = random.chance(0.1);
        const chosen = fullReturn ? lines : [random.pick(lines), ...(random.chance(0.25) ? [random.pick(lines)] : [])];
        const requested = new Map();
        const restockAll = random.chance(0.7);

        for (const line of chosen) {
            if (!line || requested.has(line.product_id)) continue;
            const quantity = fullReturn ? line.quantity : random.int(1, Math.max(1, Math.ceil(line.quantity / 3)));
            requested.set(line.product_id, { quantity, restock: restockAll || random.chance(0.5) });
        }
        if (requested.size === 0) continue;

        const reason = random.weighted(REASONS);
        const createdAt = new Date(Math.min(now.getTime() - DAY_MS, new Date(order.created_at).getTime() + random.int(3, 25) * DAY_MS));

        const note = await createCreditNote(connection, {
            orderId: order.id,
            reason,
            note: random.pick(NOTES[reason]),
            refundMethod: random.weighted(METHODS),
            lines: requested,
            userId: manager?.id ?? null,
            createdAt
        });
        created += 1;
        if (note.refund_amount > 0) refunds += 1;
    }

    return { created, refunds, completed: orders.length };
}

module.exports = { seedReturns };
