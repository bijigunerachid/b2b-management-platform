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
            throw new Error("DB_PASSWORD is required in production.");
        }

        if (!process.env.CORS_ORIGIN) {
            throw new Error("CORS_ORIGIN is required in production.");
        }

        if (process.env.CORS_ORIGIN.split(",").some((origin) => !origin.trim().startsWith("https://"))) {
            throw new Error("CORS_ORIGIN must only list https:// origins in production.");
        }
    }

    // The bootstrap credentials are only needed while running createAdmin.
    if (process.env.ADMIN_PASSWORD) {
        console.warn(
            "Warning: ADMIN_PASSWORD is set in the environment. Remove it from .env once the admin account exists."
        );
    }

    return true;
}

module.exports = validateEnv;
