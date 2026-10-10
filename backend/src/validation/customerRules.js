// Field names must match the customers table (and what the frontend sends).
const customerRules = [
    { field: "company_name", required: true, type: "string", minLength: 2, maxLength: 150 },
    { field: "contact_name", required: true, type: "string", minLength: 2, maxLength: 150 },
    { field: "email", type: "email", maxLength: 255 },
    { field: "phone", type: "string", maxLength: 30 },
    { field: "address", type: "string", maxLength: 255 },
    { field: "city", type: "string", maxLength: 100 },
    { field: "country", type: "string", maxLength: 100 },
    { field: "email_language", oneOf: ["en", "fr", "ar"] },
    { field: "payment_reminders", oneOf: [true, false] }
];

module.exports = customerRules;
