// Lengths match the suppliers table.
const supplierRules = [
    { field: "name", required: true, type: "string", minLength: 2, maxLength: 150 },
    { field: "contact_name", type: "string", maxLength: 150 },
    { field: "email", type: "email", maxLength: 255 },
    { field: "phone", type: "string", maxLength: 30 },
    { field: "city", type: "string", maxLength: 100 },
    { field: "country", type: "string", maxLength: 100 },
    { field: "lead_time_days", type: "integer", min: 0, max: 365 },
    { field: "notes", type: "string", maxLength: 1000 },
    { field: "is_active", oneOf: [true, false, 0, 1] }
];

module.exports = supplierRules;
