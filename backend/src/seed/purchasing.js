// Seeds suppliers, reorder points, and purchase-order history from the data
// already in the database, keeping the stock ledger consistent.
//
// - Reorder points come from real demand: units sold in the last 90 days,
//   covering the supplier lead time plus one week of safety stock.
// - Historical POs are received through the ledger: each product's opening
//   balance moves earlier and shrinks by what was received, so the ledger
//   still sums to today's stock (opening → receipts → current stock).
// - Open POs are generated from the reorder suggestions themselves.

const { createRandom } = require("./generate");
const { poNumber, reorderSuggestions } = require("../purchasing/purchasingRules");

const DAY_MS = 86400000;

const SUPPLIERS = [
    ["Maghreb Office Supply", "Karim Tazi", "Casablanca", "Morocco", 4],
    ["Atlas Tech Distribution", "Salma Bennani", "Casablanca", "Morocco", 6],
    ["Souss Industrial", "Youssef Amrani", "Agadir", "Morocco", 8],
    ["Rif Furniture Works", "Nadia Alaoui", "Tanger", "Morocco", 14],
    ["Medina Packaging", "Omar Lahlou", "Fès", "Morocco", 5],
    ["Sahara Safety Gear", "Imane Berrada", "Marrakech", "Morocco", 7],
    ["EuroNet Components", "Lucas Martin", "Lyon", "France", 18],
    ["Iberia Print Solutions", "Elena García", "Madrid", "Spain", 12],
    ["Oasis Cleaning Supplies", "Hamza Chraibi", "Rabat", "Morocco", 3],
    ["Andalous Textiles", "Zineb Kettani", "Tétouan", "Morocco", 10]
];

function ymd(date) {
    return date.toISOString().slice(0, 10);
}

async function seedPurchasing(connection, { seed = 99, now = new Date() } = {}) {
    const [[{ existing }]] = await connection.query("SELECT COUNT(*) AS existing FROM suppliers");
    if (Number(existing) > 0) return null;

    const random = createRandom(seed);

    /* 1. Suppliers, each covering one or more categories. */
    const supplierIds = [];
    for (const [name, contact, city, country, lead] of SUPPLIERS) {
        const slug = name.toLowerCase().replace(/[^a-z]+/g, "");
        const [result] = await connection.query(
            `INSERT INTO suppliers (name, contact_name, email, phone, city, country, lead_time_days)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, contact, `orders@${slug.slice(0, 20)}.example.com`, `+212 5${random.int(20, 39)} ${random.int(10, 99)} ${random.int(10, 99)} ${random.int(10, 99)}`, city, country, lead]
        );
        supplierIds.push({ id: result.insertId, lead });
    }

    // Match categories to the supplier that plausibly sells them.
    const categorySupplier = {
        Electronics: "Atlas Tech Distribution",
        Lighting: "Atlas Tech Distribution",
        "Office Supplies": "Maghreb Office Supply",
        "Kitchen & Breakroom": "Maghreb Office Supply",
        Furniture: "Rif Furniture Works",
        "Storage & Archiving": "Rif Furniture Works",
        Networking: "EuroNet Components",
        "Software & Licenses": "EuroNet Components",
        Printing: "Iberia Print Solutions",
        Cleaning: "Oasis Cleaning Supplies",
        Packaging: "Medina Packaging",
        "Safety Equipment": "Sahara Safety Gear",
        "Tools & Hardware": "Souss Industrial",
        "Textiles & Uniforms": "Andalous Textiles"
    };
    const supplierByName = new Map(SUPPLIERS.map(([name], index) => [name, supplierIds[index]]));
    const [categories] = await connection.query("SELECT id, name FROM categories ORDER BY id");
    const supplierForCategory = new Map(
        categories.map((category, index) => [
            category.id,
            supplierByName.get(categorySupplier[category.name]) ?? supplierIds[index % supplierIds.length]
        ])
    );

    /* 2. Preferred supplier and demand-based reorder point per product. */
    const since = new Date(now.getTime() - 90 * DAY_MS);
    const [sales] = await connection.query(
        `SELECT oi.product_id, SUM(oi.quantity) AS sold
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= ? AND o.status <> 'Cancelled'
         GROUP BY oi.product_id`,
        [since]
    );
    const sold90 = new Map(sales.map((row) => [row.product_id, Number(row.sold)]));

    const [products] = await connection.query("SELECT id, name, price, stock, category_id, is_active FROM products");
    for (const product of products) {
        const supplier = supplierForCategory.get(product.category_id);
        const weekly = (sold90.get(product.id) ?? 0) / 13;
        const reorderPoint = Math.min(250, Math.max(2, Math.ceil(weekly * (supplier.lead / 7 + 1))));
        product.supplier_id = supplier.id;
        product.reorder_point = reorderPoint;
        await connection.query("UPDATE products SET supplier_id = ?, reorder_point = ? WHERE id = ?", [supplier.id, reorderPoint, product.id]);
    }

    const bySupplier = new Map();
    for (const product of products) {
        if (!product.is_active) continue;
        if (!bySupplier.has(product.supplier_id)) bySupplier.set(product.supplier_id, []);
        bySupplier.get(product.supplier_id).push(product);
    }

    const cost = (product) => Math.round(Number(product.price) * (0.55 + random.next() * 0.15) * 100) / 100;

    async function insertPurchaseOrder({ supplierId, status, createdAt, orderedAt, expectedAt, receivedAt, cancelledAt, lines, notes = null }) {
        const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
        const [result] = await connection.query(
            `INSERT INTO purchase_orders
                (supplier_id, status, expected_at, notes, total_amount, created_at, ordered_at, received_at, cancelled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [supplierId, status, expectedAt ? ymd(expectedAt) : null, notes, total.toFixed(2), createdAt, orderedAt ?? null, receivedAt ?? null, cancelledAt ?? null]
        );
        await connection.query(
            "INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES ?",
            [lines.map((line) => [result.insertId, line.productId, line.quantity, line.unitCost])]
        );
        return result.insertId;
    }

    /* 3. Historical received POs, reflected in the ledger. */
    // Only rewrite ledgers that still hold just their opening balance.
    const [untouched] = await connection.query(
        `SELECT product_id FROM stock_movements
         GROUP BY product_id
         HAVING COUNT(*) = 1 AND MAX(type) = 'opening'`
    );
    const rewritable = new Set(untouched.map((row) => row.product_id));
    const budget = new Map(products.map((product) => [product.id, Math.floor(Number(product.stock) * 0.7)]));
    const receipts = new Map(); // productId → [{ quantity, at, purchaseOrderId }]
    let received = 0;

    for (const { id: supplierId, lead } of supplierIds) {
        const catalog = (bySupplier.get(supplierId) ?? []).filter((product) => rewritable.has(product.id));
        if (catalog.length === 0) continue;

        const count = random.int(3, 6);
        for (let index = 0; index < count; index += 1) {
            const orderedAt = new Date(now.getTime() - random.int(30, 270) * DAY_MS);
            const expectedAt = new Date(orderedAt.getTime() + lead * DAY_MS);
            const receivedAt = new Date(expectedAt.getTime() + random.int(-2, 6) * DAY_MS);

            const lines = [];
            const picked = new Set();
            for (let attempt = 0; attempt < 12 && lines.length < random.int(2, 6); attempt += 1) {
                const product = catalog[random.int(0, catalog.length - 1)];
                const room = budget.get(product.id);
                if (picked.has(product.id) || room < 1) continue;
                const quantity = Math.min(room, random.int(product.reorder_point, product.reorder_point * 3));
                if (quantity < 1) continue;
                picked.add(product.id);
                budget.set(product.id, room - quantity);
                lines.push({ productId: product.id, quantity, unitCost: cost(product) });
            }
            if (lines.length === 0) continue;

            const createdAt = new Date(orderedAt.getTime() - random.int(0, 2) * DAY_MS);
            const purchaseOrderId = await insertPurchaseOrder({
                supplierId,
                status: "Received",
                createdAt,
                orderedAt,
                expectedAt,
                receivedAt,
                lines
            });
            received += 1;

            for (const line of lines) {
                if (!receipts.has(line.productId)) receipts.set(line.productId, []);
                receipts.get(line.productId).push({ quantity: line.quantity, at: receivedAt, purchaseOrderId, number: poNumber({ id: purchaseOrderId, created_at: createdAt }) });
            }
        }
    }

    // Rebuild each touched ledger: earlier, smaller opening balance, then receipts.
    for (const [productId, entries] of receipts) {
        const product = products.find((item) => item.id === productId);
        entries.sort((a, b) => a.at - b.at);
        const totalReceived = entries.reduce((sum, entry) => sum + entry.quantity, 0);
        const opening = Number(product.stock) - totalReceived;

        await connection.query("DELETE FROM stock_movements WHERE product_id = ?", [productId]);

        const rows = [];
        let balance = 0;
        if (opening > 0) {
            balance = opening;
            rows.push([productId, opening, "opening", "Opening balance", balance, null, new Date(entries[0].at.getTime() - 7 * DAY_MS)]);
        }
        for (const entry of entries) {
            balance += entry.quantity;
            rows.push([productId, entry.quantity, "purchase_receipt", `${entry.number} received`, balance, entry.purchaseOrderId, entry.at]);
        }

        await connection.query(
            "INSERT INTO stock_movements (product_id, quantity, type, reason, balance_after, purchase_order_id, created_at) VALUES ?",
            [rows]
        );
    }

    /* 4. Open POs from today's reorder suggestions (some running late). */
    const supplierById = new Map(supplierIds.map((supplier) => [supplier.id, supplier]));
    const groups = reorderSuggestions(
        products.map((product) => ({ ...product, on_order: 0, supplier_name: String(product.supplier_id) })),
        new Map()
    ).filter((group) => group.supplier_id);

    let ordered = 0;
    let drafts = 0;

    for (const [index, group] of groups.entries()) {
        // Leave roughly a third as suggestions for the user to act on.
        if (index % 3 === 2) continue;

        const lead = supplierById.get(group.supplier_id).lead;
        const isDraft = index % 5 === 4;
        const orderedAt = new Date(now.getTime() - random.int(1, lead + 6) * DAY_MS);
        const lines = group.items.map((item) => ({
            productId: item.product_id,
            quantity: item.quantity,
            unitCost: cost(products.find((product) => product.id === item.product_id))
        }));

        await insertPurchaseOrder({
            supplierId: group.supplier_id,
            status: isDraft ? "Draft" : "Ordered",
            createdAt: isDraft ? new Date(now.getTime() - random.int(0, 2) * DAY_MS) : new Date(orderedAt.getTime() - DAY_MS),
            orderedAt: isDraft ? null : orderedAt,
            expectedAt: new Date((isDraft ? now.getTime() : orderedAt.getTime()) + lead * DAY_MS),
            notes: isDraft ? "Waiting for supplier price confirmation." : null,
            lines
        });
        if (isDraft) drafts += 1;
        else ordered += 1;
    }

    /* 5. A couple of cancelled orders for a realistic history. */
    let cancelled = 0;
    for (const { id: supplierId } of supplierIds.slice(0, 2)) {
        const catalog = bySupplier.get(supplierId) ?? [];
        if (catalog.length === 0) continue;
        const product = catalog[random.int(0, catalog.length - 1)];
        const createdAt = new Date(now.getTime() - random.int(40, 120) * DAY_MS);
        await insertPurchaseOrder({
            supplierId,
            status: "Cancelled",
            createdAt,
            orderedAt: createdAt,
            cancelledAt: new Date(createdAt.getTime() + 2 * DAY_MS),
            notes: "Supplier could not meet the price.",
            lines: [{ productId: product.id, quantity: product.reorder_point * 2, unitCost: cost(product) }]
        });
        cancelled += 1;
    }

    return { suppliers: supplierIds.length, received, ordered, drafts, cancelled, ledgersRebuilt: receipts.size };
}

module.exports = { seedPurchasing };
