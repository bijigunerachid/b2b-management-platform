
function validateEnv() {
    const requiredVariables = [
        "DB_HOST",
        "DB_USER",
        "DB_NAME",
        "JWT_SECRET"
    ];

    const missingVariables = requiredVariables.filter(
        (variable) => !process.env[variable]
    );

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missingVariables.join(", ")}`
        );
    }

    if (process.env.JWT_SECRET.length < 32) {
        throw new Error(
            "JWT_SECRET must contain at least 32 characters."
        );
    }

    if (process.env.NODE_ENV === "production") {
        if (!process.env.DB_PASSWORD) {
            throw new Error(
                "DB_PASSWORD is required in production."
            );
        }
    }

    return true;
}

module.exports = validateEnv;