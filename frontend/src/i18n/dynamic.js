// Texts translated with t(value) instead of t("literal"): statuses and other
// values from the API, and labels kept in English in constants. The checker
// (scripts/i18n-check.mjs) reads this list so they still need a translation.
// Role and permission texts mirror backend/src/config/permissions.js.

export default [
  // Navigation and section titles
  "Overview", "Dashboard", "Reports", "Sales", "Quotes", "Orders", "Receivables", "Credit notes", "Customers",
  "Catalog", "Products", "Categories", "Pricing", "Inventory", "Stock", "Purchase orders", "Suppliers",
  "Administration", "Users", "Audit log", "Home", "Account", "Portal",

  // Order, quote, purchase order and payment statuses
  "Pending", "Processing", "Completed", "Cancelled",
  "Draft", "Sent", "Accepted", "Rejected", "Expired", "Converted",
  "Ordered", "Received", "Late", "Drafted", "Created",
  "Paid", "Partially paid", "Unpaid", "Overdue", "Void", "Credited", "All",

  // Status descriptions
  "Awaiting review", "Being prepared", "Delivered and paid", "Stopped; stock restored",
  "Awaiting the customer's answer", "Ready to convert into an order", "Declined by the customer",
  "Validity date has passed", "Turned into an order",
  "Sent to the supplier, awaiting delivery", "Delivered and added to stock", "Not going ahead",

  // Payment methods, ageing, stock movements, reasons, price sources
  "Bank transfer", "Cheque", "Cash", "Card",
  "Not yet due", "1–30 days", "31–60 days", "61–90 days", "90+ days",
  "Opening balance", "Sale", "Sale cancelled", "Purchase receipt", "Adjustment", "Customer return",
  "Stock count correction", "Damaged", "Lost or stolen", "Returned by customer", "Found", "Other",
  "Damaged in transit", "Defective", "Wrong item", "No longer needed",
  "Catalog price", "Price list", "Volume discount", "Contract price", "Quoted price",

  // Filters, tabs and actions kept in constants
  "All time", "Last 7 days", "Last 30 days", "Last 90 days",
  "All payments", "Open balance", "Start processing", "Mark completed", "Cancel order",
  "Edit", "Mark as sent", "Accept", "Reject", "Convert to order", "Duplicate", "Delete",
  "Price lists", "Volume discounts", "Contract prices",
  "30 days", "90 days", "This year", "12 months", "product", "customer", "category",
  "All activity", "Sign-ins", "Payments", "Staff accounts", "Portal access",
  "In stock", "Low stock", "Out of stock", "To pay", "In progress",
  "Too weak", "Weak", "Good", "Strong",

  // Printed documents (the tagline comes from config/company.js)
  "Wholesale supplies for businesses",
  "PAID", "PARTIALLY PAID", "OVERDUE", "VOID", "CREDITED", "PAYMENT DUE",
  "DRAFT", "AWAITING APPROVAL", "ACCEPTED", "DECLINED", "EXPIRED",
  "Issued", "Due", "Order", "Customer", "Date", "Invoice", "Reason", "Prepared by", "Valid until",

  // Roles and permissions (from the API)
  "Admin", "Manager", "Accountant", "Warehouse", "Employee", "Customer",
  "Everything, including users and the audit log.",
  "Runs sales, catalog, pricing and purchasing. No user management.",
  "Read-only on sales and catalog. Records payments and returns, sees costs, reports and the audit log.",
  "Stock, deliveries and order fulfilment. No prices, costs or money.",
  "Read-only access to sales, catalog and stock.",
  "General", "Money",
  "See the dashboard", "See reports and margins", "See the audit log", "Manage staff accounts",
  "See customers", "Add and edit customers", "Delete customers", "Give clients portal access",
  "See quotes", "Create, send and convert quotes", "See orders", "Create and cancel orders",
  "Move orders to processing and completed", "See payments, receivables and credit notes",
  "Record payments", "Void payments", "Create credit notes", "See products and categories",
  "Add and edit products and categories", "Delete products and categories",
  "See price lists and contract prices", "Change prices, discounts and contract prices", "See product costs",
  "See stock, suppliers and purchase orders", "Correct stock levels", "Create and send purchase orders",
  "Receive deliveries", "Add and edit suppliers", "Delete suppliers",

  // Audit entity types
  "order", "payment", "quote", "product", "purchase order", "price list", "volume discount", "contract price", "user", "portal user",

  // Demand forecast: navigation, forecasting methods and chart series
  "Demand forecast",
  "Gradient-boosted model", "Learns from recent sales, last year, category seasonality and price",
  "Last 4 weeks again", "Assumes the next 4 weeks repeat the last 4",
  "13-week average", "Average weekly sales over the last quarter",
  "Same weeks last year", "What sold in these weeks a year ago",
  "Yearly average × season", "The product's yearly average, scaled by its category's season",
  "Actual sales", "Model", "Best simple method",
];
