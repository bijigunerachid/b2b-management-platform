// Lengths and bounds match the products table.
const productRules = [
    { field: "name", required: true, type: "string", minLength: 2, maxLength: 150 },
    { field: "description", type: "string", maxLength: 1000 },
    { field: "price", required: true, type: "number", min: 0, max: 99999999.99 },
    { field: "stock", required: true, type: "integer", min: 0, max: 1000000000 },
    { field: "category_id", required: true, type: "integer", min: 1 },
    { field: "is_active", oneOf: [true, false, 0, 1] }
];

module.exports = productRules;
