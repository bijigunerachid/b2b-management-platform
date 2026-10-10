const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

const pool = mysql.createPool({
    host : process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // UTC end to end: the driver writes/reads instants as UTC, and every
    // connection's session runs in UTC so NOW()/CURRENT_TIMESTAMP agree with
    // timestamps written by the app regardless of server or OS time zone.
    timezone: "Z",
    // Calendar dates (valid_until, paid_at) stay plain "YYYY-MM-DD" strings
    // so no time zone conversion can move them to another day.
    dateStrings: ["DATE"]
});

pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
});

module.exports = pool;
