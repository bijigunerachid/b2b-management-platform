require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const { generateDataset } = require("../seed/generate");
const { seedQuotes } = require("../seed/quotes");
const { seedPurchasing } = require("../seed/purchasing");
const { seedPortal } = require("../seed/portal");
const { seedReturns } = require("../seed/returns");
const { seedPricing } = require("../seed/pricing");
const { backfillCosts } = require("../services/costs");

/*
 * Seeds the database with a large, realistic demo dataset.
 *
 *   npm run seed:large                       # append the default dataset
 *   npm run seed:large -- --orders=20000     # customize volumes
 *   npm run seed:large -- --reset            # wipe business data first
 *
 * Options: --customers --products --orders --users --months --seed --reset
 *
 * Everything runs in one transaction: it either all lands or nothing does.
 * --reset deletes ALL customers, products, categories, orders, payments, quotes,
 * suppliers, purchase orders, and stock movements, plus
 * previously seeded users (@seed.b2b.local). Real user accounts are kept.
 */

const DEFAULTS = {
    customers: 400,
    products: 350,
    orders: 5000,
    users: 24,
    months: 18,
    seed: 2026
};

const CHUNK_SIZE = 1000;

function parseArgs(argv) {
    const options = { ...DEFAULTS, reset: false };

    for (const arg of argv) {
        if (arg === "--reset") {
            options.reset = true;
            continue;
        }

        const match = /^--(\w+)=(\d+)$/.exec(arg);

        if (!match || !(match[1] in DEFAULTS)) {
            throw new Error(`Unknown option: ${arg}`);
        }

        options[match[1]] = Number(match[2]);
    }

    if (options.customers < 1 || options.products < 1 || options.months < 1) {
        throw new Error("customers, products, and months must be at least 1.");
    }

    return options;
}

async function insertChunks(connection, sql, rows) {
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
        await connection.query(sql, [rows.slice(start, start + CHUNK_SIZE)]);
    }
}

async function nextId(connection, table) {
    const [rows] = await connection.query(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next FROM ${table} FOR UPDATE`
    );
    return Number(rows[0].next);
}

async function seed() {
    const options = parseArgs(process.argv.slice(2));
    const startedAt = Date.now();

    console.log("Generating dataset…");
    const data = generateDataset(options);

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        if (options.reset) {
            console.log("Resetting business data…");
            // Children before parents, following the foreign keys.
            await connection.query("DELETE FROM quotes");
            await connection.query("DELETE FROM payments");
            await connection.query("DELETE FROM stock_movements");
            await connection.query("DELETE FROM credit_note_items");
            await connection.query("DELETE FROM credit_notes");
            await connection.query("DELETE FROM customer_prices");
            await connection.query("DELETE FROM volume_discounts");
            await connection.query("DELETE FROM purchase_orders");
            await connection.query("DELETE FROM order_items");
            await connection.query("DELETE FROM orders");
            await connection.query("DELETE FROM products");
            await connection.query("DELETE FROM users WHERE customer_id IS NOT NULL");
            await connection.query("DELETE FROM customers");
            await connection.query("DELETE FROM price_lists");
            await connection.query("DELETE FROM categories");
            await connection.query("DELETE FROM suppliers");
            await connection.query("DELETE FROM users WHERE email LIKE '%@seed.b2b.local' OR email LIKE '%.portal.example'");
        }

        // Categories: names are unique, so reuse existing ones.
        await connection.query(
            "INSERT IGNORE INTO categories (name, description) VALUES ?",
            [data.categories.map((category) => [category.name, category.description])]
        );
        const [categoryRows] = await connection.query("SELECT id, name FROM categories");
        const categoryIdByName = new Map(categoryRows.map((row) => [row.name, row.id]));
        const categoryIds = data.categories.map((category) => categoryIdByName.get(category.name));

        // Explicit ids let order_items reference rows without relying on
        // auto-increment values being consecutive.
        const firstCustomerId = await nextId(connection, "customers");
        console.log(`Inserting ${data.customers.length} customers…`);
        await insertChunks(
            connection,
            `INSERT INTO customers
                (id, company_name, contact_name, email, phone, address, city, country, created_at)
             VALUES ?`,
            data.customers.map((customer, index) => [
                firstCustomerId + index,
                customer.company_name,
                customer.contact_name,
                customer.email,
                customer.phone,
                customer.address,
                customer.city,
                customer.country,
                customer.created_at
            ])
        );

        const firstProductId = await nextId(connection, "products");
        console.log(`Inserting ${data.products.length} products…`);
        await insertChunks(
            connection,
            `INSERT INTO products
                (id, category_id, name, description, price, stock, is_active)
             VALUES ?`,
            data.products.map((product, index) => [
                firstProductId + index,
                categoryIds[product.categoryIndex],
                product.name,
                product.description,
                product.price,
                product.stock,
                product.is_active
            ])
        );

        // Every product's stock starts in the ledger as an opening balance.
        const openingRows = data.products
            .map((product, index) => [firstProductId + index, product.stock, "opening", "Opening balance", product.stock])
            .filter((row) => row[1] > 0);
        await insertChunks(
            connection,
            "INSERT INTO stock_movements (product_id, quantity, type, reason, balance_after) VALUES ?",
            openingRows
        );

        const firstOrderId = await nextId(connection, "orders");
        console.log(`Inserting ${data.orders.length} orders…`);
        await insertChunks(
            connection,
            `INSERT INTO orders
                (id, customer_id, status, total_amount, created_at)
             VALUES ?`,
            data.orders.map((order, index) => [
                firstOrderId + index,
                firstCustomerId + order.customerIndex,
                order.status,
                order.total_amount,
                order.created_at
            ])
        );

        const itemRows = data.orders.flatMap((order, index) =>
            order.items.map((item) => [
                firstOrderId + index,
                firstProductId + item.productIndex,
                item.quantity,
                item.unit_price
            ])
        );
        console.log(`Inserting ${itemRows.length} order items…`);
        await insertChunks(
            connection,
            `INSERT INTO order_items
                (order_id, product_id, quantity, unit_price)
             VALUES ?`,
            itemRows
        );

        const paymentRows = data.payments.map((payment) => [
            firstOrderId + payment.key,
            payment.amount,
            payment.method,
            payment.reference,
            payment.paid_at,
            payment.note
        ]);
        console.log(`Inserting ${paymentRows.length} payments…`);
        await insertChunks(
            connection,
            `INSERT INTO payments
                (order_id, amount, method, reference, paid_at, note)
             VALUES ?`,
            paymentRows
        );

        // Team members share one password so you can sign in as any role.
        let seededPassword = null;
        if (data.users.length > 0) {
            seededPassword =
                process.env.SEED_USER_PASSWORD ||
                crypto.randomBytes(9).toString("base64url");

            const [roleRows] = await connection.query("SELECT id, name FROM roles");
            const roleIdByName = new Map(roleRows.map((row) => [row.name, row.id]));
            const passwordHash = await bcrypt.hash(seededPassword, 10);

            console.log(`Inserting ${data.users.length} team members…`);
            await connection.query(
                `INSERT IGNORE INTO users
                    (first_name, last_name, email, password, role_id, is_active)
                 VALUES ?`,
                [
                    data.users.map((user) => [
                        user.first_name,
                        user.last_name,
                        user.email,
                        passwordHash,
                        roleIdByName.get(user.role),
                        user.is_active
                    ])
                ]
            );
        }

        const quoteCount = await seedQuotes(connection, { now: new Date() });
        const purchasing = await seedPurchasing(connection, { now: new Date() });
        await backfillCosts(connection);
        const portal = await seedPortal(connection, { password: seededPassword ?? process.env.SEED_USER_PASSWORD });
        const returns = await seedReturns(connection);
        const pricing = await seedPricing(connection);
        if (purchasing) console.log(`Inserted ${purchasing.suppliers} suppliers and purchase orders…`);
        if (quoteCount > 0) console.log(`Inserted ${quoteCount} quotes…`);

        await connection.commit();

        const revenue = data.orders
            .filter((order) => order.status === "Completed")
            .reduce((sum, order) => sum + order.total_amount, 0);

        console.log("");
        console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
        console.log(`  Customers:   ${data.customers.length}`);
        console.log(`  Categories:  ${data.categories.length}`);
        console.log(`  Products:    ${data.products.length}`);
        console.log(`  Orders:      ${data.orders.length} (${itemRows.length} line items, ${options.months} months)`);
        console.log(`  Payments:    ${paymentRows.length}`);
        console.log(`  Quotes:      ${quoteCount}${quoteCount === 0 ? " (existing quotes kept)" : ""}`);
        console.log(`  Returns:     ${returns ? `${returns.created} credit notes` : "existing credit notes kept"}`);
        console.log(`  Pricing:     ${pricing ? `${pricing.priceLists} price lists, ${pricing.volumeBreaks} volume discounts, ${pricing.contracts} contract prices` : "existing pricing kept"}`);
        console.log(`  Purchasing:  ${purchasing ? `${purchasing.suppliers} suppliers, ${purchasing.received + purchasing.ordered + purchasing.drafts + purchasing.cancelled} purchase orders` : "existing suppliers kept"}`);
        console.log(`  Revenue:     ${revenue.toLocaleString("en", { maximumFractionDigits: 0 })} MAD completed`);

        if (portal) {
            console.log("");
            console.log("Customer portal logins (same password as the seeded team):");
            for (const account of portal.accounts) console.log(`  ${account.email}  (${account.company})`);
        }

        if (seededPassword) {
            const sample = data.users.find((user) => user.is_active && user.role === "Manager");
            console.log(`  Team:        ${data.users.length} users (Managers and Employees)`);
            console.log("");
            console.log("Seeded accounts use the @seed.b2b.local domain.");
            if (sample) console.log(`  Example Manager: ${sample.email}`);
            console.log(
                process.env.SEED_USER_PASSWORD
                    ? "  Password: the value of SEED_USER_PASSWORD."
                    : `  Password: ${seededPassword}  (dev only, shown once)`
            );
        }
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

seed().catch((error) => {
    console.error("Seeding failed; no changes were saved:", error.message);
    process.exitCode = 1;
});
