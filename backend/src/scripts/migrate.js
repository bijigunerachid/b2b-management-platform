require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Applies every database/migrations/*.sql file in order. Each migration is
// written to be idempotent, so running this again is safe.
async function migrate() {
    const directory = path.join(__dirname, "../../../database/migrations");
    const files = fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        for (const file of files) {
            const sql = fs.readFileSync(path.join(directory, file), "utf8")
                .replace(/^USE\s+\w+;\s*$/m, "");
            await connection.query(sql);
            console.log(`Applied ${file}`);
        }
    } finally {
        await connection.end();
    }
}

migrate().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
});
