// Central security settings so every route uses the same rules.

const isProduction = () => process.env.NODE_ENV === "production";

const SESSION_HOURS = 1;

/** Origins allowed to call the API with credentials (comma-separated env). */
function allowedOrigins() {
    return (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

/**
 * Options for the session cookie. `clearCookie` must receive the same
 * options (minus maxAge) or browsers keep the cookie.
 */
function cookieOptions({ includeMaxAge = true } = {}) {
    return {
        httpOnly: true,
        secure: isProduction(),
        sameSite: "strict",
        path: "/",
        ...(includeMaxAge ? { maxAge: SESSION_HOURS * 60 * 60 * 1000 } : {})
    };
}

function clearSessionCookie(res) {
    res.clearCookie("token", cookieOptions({ includeMaxAge: false }));
}

const BCRYPT_ROUNDS = 12;

// bcrypt only uses the first 72 bytes of a password.
const PASSWORD_MAX_BYTES = 72;

/** Returns an error message, or null when the password is acceptable. */
function checkPasswordPolicy(password) {
    if (typeof password !== "string" || password.length < 10) {
        return "Password must contain at least 10 characters.";
    }

    if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
        return "Password must be at most 72 bytes long.";
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return "Password must contain at least one letter and one number.";
    }

    return null;
}

module.exports = {
    BCRYPT_ROUNDS,
    SESSION_HOURS,
    allowedOrigins,
    checkPasswordPolicy,
    clearSessionCookie,
    cookieOptions,
    isProduction
};
