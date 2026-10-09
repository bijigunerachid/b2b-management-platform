
function validate(rules) {
    return (req, res, next) => {
        const errors = [];

        for (const rule of rules) {
            const value = req.body[rule.field];

            if (rule.required && (
                value === undefined ||
                value === null ||
                value === ""
            )) {
                errors.push({
                    field: rule.field,
                    message: `${rule.field} is required.`
                });

                continue;
            }

            if (value === undefined || value === null || value === "") {
                continue;
            }

            if (rule.type === "string" && typeof value !== "string") {
                errors.push({
                    field: rule.field,
                    message: `${rule.field} must be a string.`
                });
            }

            if (
                rule.type === "number" &&
                (typeof value !== "number" || !Number.isFinite(value))
            ) {
                errors.push({
                    field: rule.field,
                    message: `${rule.field} must be a valid number.`
                });
            }

            if (
                rule.minLength &&
                typeof value === "string" &&
                value.trim().length < rule.minLength
            ) {
                errors.push({
                    field: rule.field,
                    message: `${rule.field} must contain at least ${rule.minLength} characters.`
                });
            }

            if (
                rule.min !== undefined &&
                typeof value === "number" &&
                value < rule.min
            ) {
                errors.push({
                    field: rule.field,
                    message: `${rule.field} must be at least ${rule.min}.`
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
                    message: `${rule.field} must be a valid email address.`
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