// Who can do what. Routes check permissions, never role names, and the
// signed-in user's permission list is sent to the frontend so both sides use
// this one table. Customer (portal) accounts have no staff permissions.

const STAFF_ROLES = {
    Admin: "Everything, including users and the audit log.",
    Manager: "Runs sales, catalog, pricing and purchasing. No user management.",
    Accountant: "Read-only on sales and catalog. Records payments and returns, sees costs, reports and the audit log.",
    Warehouse: "Stock, deliveries and order fulfilment. No prices, costs or money.",
    Employee: "Read-only access to sales, catalog and stock."
};

const ALL = Object.keys(STAFF_ROLES);

const PERMISSIONS = {
    "dashboard.view": { group: "General", label: "See the dashboard", roles: ALL },
    "reports.view": { group: "General", label: "See reports and margins", roles: ["Admin", "Manager", "Accountant"] },
    "audit.view": { group: "General", label: "See the audit log", roles: ["Admin", "Accountant"] },
    "users.manage": { group: "General", label: "Manage staff accounts", roles: ["Admin"] },

    "customers.view": { group: "Customers", label: "See customers", roles: ALL },
    "customers.write": { group: "Customers", label: "Add and edit customers", roles: ["Admin", "Manager"] },
    "customers.delete": { group: "Customers", label: "Delete customers", roles: ["Admin"] },
    "portal.manage": { group: "Customers", label: "Give clients portal access", roles: ["Admin", "Manager"] },

    "quotes.view": { group: "Sales", label: "See quotes", roles: ["Admin", "Manager", "Accountant", "Employee"] },
    "quotes.write": { group: "Sales", label: "Create, send and convert quotes", roles: ["Admin", "Manager"] },
    "orders.view": { group: "Sales", label: "See orders", roles: ALL },
    "orders.write": { group: "Sales", label: "Create and cancel orders", roles: ["Admin", "Manager"] },
    "orders.fulfil": { group: "Sales", label: "Move orders to processing and completed", roles: ["Admin", "Manager", "Warehouse"] },

    "payments.view": { group: "Money", label: "See payments, receivables and credit notes", roles: ["Admin", "Manager", "Accountant", "Employee"] },
    "payments.write": { group: "Money", label: "Record payments", roles: ["Admin", "Manager", "Accountant"] },
    "payments.void": { group: "Money", label: "Void payments", roles: ["Admin", "Accountant"] },
    "returns.write": { group: "Money", label: "Create credit notes", roles: ["Admin", "Manager", "Accountant"] },

    "products.view": { group: "Catalog", label: "See products and categories", roles: ALL },
    "products.write": { group: "Catalog", label: "Add and edit products and categories", roles: ["Admin", "Manager"] },
    "products.delete": { group: "Catalog", label: "Delete products and categories", roles: ["Admin"] },
    "pricing.view": { group: "Catalog", label: "See price lists and contract prices", roles: ["Admin", "Manager", "Accountant", "Employee"] },
    "pricing.write": { group: "Catalog", label: "Change prices, discounts and contract prices", roles: ["Admin", "Manager"] },
    "costs.view": { group: "Catalog", label: "See product costs", roles: ["Admin", "Manager", "Accountant"] },

    "inventory.view": { group: "Inventory", label: "See stock, suppliers and purchase orders", roles: ALL },
    "inventory.adjust": { group: "Inventory", label: "Correct stock levels", roles: ["Admin", "Manager", "Warehouse"] },
    "purchasing.write": { group: "Inventory", label: "Create and send purchase orders", roles: ["Admin", "Manager"] },
    "purchasing.receive": { group: "Inventory", label: "Receive deliveries", roles: ["Admin", "Manager", "Warehouse"] },
    "suppliers.write": { group: "Inventory", label: "Add and edit suppliers", roles: ["Admin", "Manager"] },
    "suppliers.delete": { group: "Inventory", label: "Delete suppliers", roles: ["Admin"] }
};

function permissionsFor(role) {
    return Object.keys(PERMISSIONS).filter((permission) => PERMISSIONS[permission].roles.includes(role));
}

function can(user, permission) {
    return Boolean(user && PERMISSIONS[permission]?.roles.includes(user.role));
}

module.exports = { PERMISSIONS, STAFF_ROLES, can, permissionsFor };
