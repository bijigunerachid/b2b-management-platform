// Accounts created by scripts/prepare-db.js in the test database only.
const PASSWORD = process.env.E2E_PASSWORD || "E2e-Test-Password-2026";
const DB_NAME = process.env.E2E_DB_NAME || "b2b_e2e";

const ACCOUNTS = {
    admin: { email: "admin@e2e.test", first_name: "Amal", last_name: "Admin", role: "Admin" },
    manager: { email: "manager@e2e.test", first_name: "Mounir", last_name: "Manager", role: "Manager" },
    accountant: { email: "accountant@e2e.test", first_name: "Aicha", last_name: "Accountant", role: "Accountant" },
    warehouse: { email: "warehouse@e2e.test", first_name: "Walid", last_name: "Warehouse", role: "Warehouse" },
    employee: { email: "employee@e2e.test", first_name: "Elias", last_name: "Employee", role: "Employee" }
};

module.exports = { ACCOUNTS, DB_NAME, PASSWORD };
