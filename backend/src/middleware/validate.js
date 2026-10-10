
// How fields are named in error messages ("Company name is required."). The
// translation layer (src/i18n) translates these names along with the message.
const FIELD_LABELS = {
    address: "Address",
    amount: "Amount",
    average_cost: "Average cost",
    category_id: "Category",
    city: "City",
    company_name: "Company name",
    contact_name: "Contact name",
    country: "Country",
    description: "Description",
    email: "Email",
    email_language: "Email language",
    first_name: "First name",
    is_active: "Status",
    last_name: "Last name",
    lead_time_days: "Lead time",
    method: "Payment method",
    name: "Name",
    note: "Note",
    notes: "Notes",
    paid_at: "Payment date",
    password: "Password",
    payment_reminders: "Payment reminders",
    phone: "Phone",
    price: "Price",
    reason: "Reason",
    reference: "Reference",
    reorder_point: "Reorder point",
    role_id: "Role",
    stock: "Stock",
    supplier_id: "Supplier"
};

function fieldLabel(rule) {
    if (rule.label) return rule.label;
    if (FIELD_LABELS[rule.field]) return FIELD_LABELS[rule.field];
    const words = rule.field.replace(/_id$/, "").replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function validate(rules) {
    return (req, res, next) => {
        const errors = [];

        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Request body must be a JSON object."
            });
        }

        for (const rule of rules) {
            const value = req.body[rule.field];
            const label = fieldLabel(rule);

            if (rule.required && (
                value === undefined ||
                value === null ||
                value === ""
            )) {
                errors.push({
                    field: rule.field,
                    message: `${label} is required.`
                });

                continue;
            }

            if (value === undefined || value === null || value === "") {
                continue;
            }

            if (rule.type === "string" && typeof value !== "string") {
                errors.push({
                    field: rule.field,
                    message: `${label} must be a string.`
                });
            }

            if (
                rule.type === "number" &&
                (typeof value !== "number" || !Number.isFinite(value))
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be a valid number.`
                });
            }

            if (
                rule.type === "integer" &&
                (typeof value !== "number" || !Number.isSafeInteger(value))
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be a whole number.`
                });
            }

            if (
                rule.maxLength &&
                typeof value === "string" &&
                value.length > rule.maxLength
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be at most ${rule.maxLength} characters.`
                });
            }

            if (
                rule.max !== undefined &&
                typeof value === "number" &&
                value > rule.max
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be at most ${rule.max}.`
                });
            }

            if (rule.oneOf && !rule.oneOf.includes(value)) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be one of: ${rule.oneOf.join(", ")}.`
                });
            }

            if (
                rule.minLength &&
                typeof value === "string" &&
                value.trim().length < rule.minLength
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must contain at least ${rule.minLength} characters.`
                });
            }

            if (
                rule.min !== undefined &&
                typeof value === "number" &&
                value < rule.min
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be at least ${rule.min}.`
                });
            }

            if (
                rule.type === "email" &&
                (
                    typeof value !== "string" ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                )
            ) {
                errors.push({
                    field: rule.field,
                    message: `${label} must be a valid email address.`
                });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                errors
            });
        }

        next();
    };
}

module.exports = validate;
module.exports.FIELD_LABELS = FIELD_LABELS;