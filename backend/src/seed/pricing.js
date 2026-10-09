const { createRandom } = require("./generate");

// Demo pricing: four price lists (one retired), volume breaks for everything
// plus two categories, and contract prices for the biggest customers on the
// products they buy most. Skips when price lists already exist. Runs inside
// the caller's transaction.
const PRICE_LISTS = [
    { name: "Silver", description: "Regular accounts after their first year", discount: 3, active: true, share: 0.2 },
    { name: "Gold", description: "High-volume accounts", discount: 6, active: true, share: 0.12 },
    { name: "Distributor", description: "Resellers who buy by the pallet", discount: 10, active: true, share: 0.05 },
    { name: "Spring 2025 promotion", description: "Ended in June 2025", discount: 8, active: false, share: 0 }
];
const GLOBAL_BREAKS = [[20, 2], [50, 4], [100, 6]];
const PORTAL_EMAIL = "buyer@kasbahsuppliessnc.portal.example";

async function seedPricing(connection) {
    const [[{ existing }]] = await connection.query("SELECT COUNT(*) AS existing FROM price_lists");
    if (Number(existing) > 0) return null;

    const random = createRandom(5150);
    const listIds = [];
    for (const list of PRICE_LISTS) {
        const [result] = await connection.query(
            "INSERT INTO price_lists (name, description, discount_percent, is_active) VALUES (?, ?, ?, ?)",
            [list.name, list.description, list.discount, list.active]
        );
        listIds.push(result.insertId);
    }

    const [customers] = await connection.query("SELECT id FROM customers ORDER BY id");
    const assigned = [0, 0, 0];
    for (const customer of customers) {
        const roll = random.next();
        let cumulative = 0;
        for (let index = 0; index < 3; index += 1) {
            cumulative += PRICE_LISTS[index].share;
            if (roll < cumulative) {
                await connection.query("UPDATE customers SET price_list_id = ? WHERE id = ?", [listIds[index], customer.id]);
                assigned[index] += 1;
                break;
            }
        }
    }

    const breakRows = GLOBAL_BREAKS.map(([quantity, discount]) => [null, quantity, discount]);
    const [categories] = await connection.query(
        `SELECT c.id FROM categories c INNER JOIN products p ON p.category_id = c.id
         GROUP BY c.id ORDER BY COUNT(p.id) DESC LIMIT 2`
    );
    if (categories[0]) breakRows.push([categories[0].id, 30, 5], [categories[0].id, 80, 8]);
    if (categories[1]) breakRows.push([categories[1].id, 10, 3]);
    await connection.query("INSERT INTO volume_discounts (category_id, min_quantity, discount_percent) VALUES ?", [breakRows]);

    // Contract prices: top customers by completed sales (and the demo portal
    // client), on the products they buy most.
    const [top] = await connection.query(
        `SELECT customer_id FROM orders WHERE status = 'Completed'
         GROUP BY customer_id ORDER BY SUM(total_amount) DESC LIMIT 25`
    );
    const [portal] = await connection.query("SELECT customer_id FROM users WHERE email = ?", [PORTAL_EMAIL]);
    const portalCustomer = portal[0]?.customer_id ?? null;
    if (portalCustomer) {
        await connection.query("UPDATE customers SET price_list_id = ? WHERE id = ?", [listIds[1], portalCustomer]);
    }
    const contractCustomers = [...new Set([...(portalCustomer ? [portalCustomer] : []), ...top.map((row) => row.customer_id)])];

    const [managers] = await connection.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('Manager', 'Admin') AND u.is_active = 1 ORDER BY r.name = 'Manager' DESC, u.id LIMIT 1`
    );

    let contracts = 0;
    for (const customerId of contractCustomers) {
        const [products] = await connection.query(
            `SELECT p.id, p.price FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             INNER JOIN products p ON p.id = oi.product_id
             WHERE o.customer_id = ? AND p.is_active = 1
             GROUP BY p.id, p.price ORDER BY SUM(oi.quantity) DESC LIMIT ?`,
            [customerId, random.int(2, 4)]
        );
        for (const product of products) {
            const price = Math.round(Number(product.price) * (1 - random.int(8, 15) / 100) * 100) / 100;
            await connection.query(
                "INSERT INTO customer_prices (customer_id, product_id, unit_price, note, created_by) VALUES (?, ?, ?, ?, ?)",
                [customerId, product.id, price, random.pick(["Annual agreement 2026", "Framework contract", null]), managers[0]?.id ?? null]
            );
            contracts += 1;
        }
    }

    return { priceLists: PRICE_LISTS.length, assigned, volumeBreaks: breakRows.length, contracts };
}

module.exports = { seedPricing };
