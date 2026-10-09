const categoryRules = [
    { field: "name", required: true, type: "string", minLength: 1, maxLength: 100 },
    { field: "description", type: "string", maxLength: 1000 }
];

module.exports = categoryRules;
