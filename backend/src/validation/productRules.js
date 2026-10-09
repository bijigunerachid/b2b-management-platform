// Lengths and bounds match the products table.
const productRules = [
    { field: "name", required: true, type: "string", minLength: 2, maxLength: 150 },
    { field: "description", type: "string", maxLength: 1000 },
    { field: "price", required: true, type: "number", min: 0, max: 99999999.99 },
    { field: "stock", required: true, type: "integer", min: 0, max: 1000000000 },
    { field: "category_id", required: true, type: "integer", min: 1 },
    { field: "is_active", oneOf: [true, false, 0, 1] },
    { field: "reorder_point", type: "integer", min: 0, max: 1000000 },
    { field: "supplier_id", type: "integer", min: 1 },
    { field: "average_cost", type: "number", min: 0, max: 99999999.99 }
];

// On update stock is optional: a changed value is recorded as an adjustment.
const productUpdateRules = productRules.map((rule) =>
    rule.field === "stock" ? { ...rule, required: false } : rule
);

module.exports = productRules;
module.exports.productUpdateRules = productUpdateRules;
