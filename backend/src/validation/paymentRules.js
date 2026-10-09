const { PAYMENT_METHODS } = require("../billing/billing");

const recordPaymentRules = [
    { field: "amount", required: true, type: "number", min: 0.01, max: 9999999999.99 },
    { field: "method", required: true, oneOf: PAYMENT_METHODS },
    { field: "paid_at", type: "string", maxLength: 10 },
    { field: "reference", type: "string", maxLength: 100 },
    { field: "note", type: "string", maxLength: 255 }
];

const voidPaymentRules = [
    { field: "reason", required: true, type: "string", minLength: 3, maxLength: 255 }
];

module.exports = { recordPaymentRules, voidPaymentRules };
