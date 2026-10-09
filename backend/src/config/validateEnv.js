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

        // Browsers treat localhost as a secure context, so plain http is
        // allowed there for testing the production build locally.
        const insecure = process.env.CORS_ORIGIN.split(",")
            .map((origin) => origin.trim())
            .filter((origin) => !origin.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

        if (insecure.length > 0) {
            throw new Error(`CORS_ORIGIN must only list https:// origins in production (got: ${insecure.join(", ")}).`);
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
