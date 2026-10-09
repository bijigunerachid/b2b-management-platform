const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { allowedOrigins } = require("../config/security");

// This is a JSON API: lock the CSP down completely.
const securityHeaders = helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'none'"],
            formAction: ["'none'"]
        }
    },
    crossOriginResourcePolicy: { policy: "same-site" }
});

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defense: state-changing requests that come from a browser must carry
 * an Origin (or Referer) from the allow-list. Non-browser clients that send
 * neither header (curl, tests, server-to-server) are not affected.
 */
function originCheck(req, res, next) {
    if (!UNSAFE_METHODS.has(req.method)) return next();

    const origin = req.get("origin");
    const referer = req.get("referer");
    let source = origin;

    if (!source && referer) {
        try {
            source = new URL(referer).origin;
        } catch {
            source = "invalid";
        }
    }

    if (!source || allowedOrigins().includes(source)) return next();

    return res.status(403).json({
        success: false,
        message: "Request origin is not allowed."
    });
}

function limitResponse(message) {
    return (req, res) =>
        res.status(429).json({ success: false, message });
}

// Per IP + email: slows down password guessing against one account.
const loginAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) =>
        `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`,
    handler: limitResponse(
        "Too many failed sign-in attempts. Please wait 15 minutes and try again."
    )
});

// Per IP: stops one client from spraying many accounts.
const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: limitResponse(
        "Too many sign-in attempts from this network. Please try again later."
    )
});

// Generous ceiling for the whole API to blunt scraping and floods.
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: limitResponse("Too many requests. Please slow down.")
});

module.exports = {
    apiLimiter,
    loginAccountLimiter,
    loginIpLimiter,
    originCheck,
    securityHeaders
};
