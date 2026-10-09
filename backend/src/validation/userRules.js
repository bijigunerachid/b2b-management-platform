// Lengths match the users table. Password strength is enforced separately
// by checkPasswordPolicy because it is optional on update.
const baseRules = [
    { field: "first_name", required: true, type: "string", minLength: 1, maxLength: 100 },
    { field: "last_name", required: true, type: "string", minLength: 1, maxLength: 100 },
    { field: "email", required: true, type: "email", maxLength: 255 },
    { field: "role_id", required: true, type: "integer", min: 1 },
    { field: "password", type: "string" }
];

const createUserRules = baseRules.map((rule) =>
    rule.field === "password" ? { ...rule, required: true } : rule
);

const updateUserRules = baseRules;

const userStatusRules = [
    { field: "is_active", required: true, oneOf: [true, false] }
];

module.exports = { createUserRules, updateUserRules, userStatusRules };
