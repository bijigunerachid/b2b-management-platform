// Demo mode, for a public live demo. Off unless DEMO_MODE=true.
//
// Visitors sign in with one click as one of the shared accounts below and can
// try everything. Data is reset every night (npm run demo:reset). Because the
// accounts are shared, anything that would lock other visitors out is turned
// off: changing passwords, managing staff accounts, portal access, and
// signing out every session at once.

const DEMO_ACCOUNTS = [
    { key: "admin", role: "Admin", email: "admin@demo.b2b.local", first_name: "Amina", last_name: "Alaoui" },
    { key: "manager", role: "Manager", email: "manager@demo.b2b.local", first_name: "Karim", last_name: "Bennani" },
    { key: "accountant", role: "Accountant", email: "accountant@demo.b2b.local", first_name: "Salma", last_name: "Idrissi" },
    { key: "warehouse", role: "Warehouse", email: "warehouse@demo.b2b.local", first_name: "Youssef", last_name: "Tazi" },
    { key: "employee", role: "Employee", email: "employee@demo.b2b.local", first_name: "Nadia", last_name: "Chraibi" },
    { key: "client", role: "Customer", email: "client@demo.b2b.local", first_name: "Omar", last_name: "Fassi" }
];

// [method, path] pairs refused in demo mode.
const BLOCKED = [
    [/^(POST|PUT|PATCH|DELETE)$/, /^\/api\/users(\/|$)/],
    [/^POST$/, /^\/api\/auth\/password$/],
    [/^PATCH$/, /^\/api\/portal-users\/\d+\/status$/],
    [/^POST$/, /^\/api\/customers\/\d+\/portal-users$/]
];

function isDemoMode() {
    return process.env.DEMO_MODE === "true";
}

function resetTime() {
    return process.env.DEMO_RESET_TIME || "03:00 UTC";
}

/** Refuses actions that would lock other visitors out of the shared accounts. */
function demoGuard(req, res, next) {
    if (!isDemoMode()) return next();
    const path = req.originalUrl.split("?")[0];
    if (BLOCKED.some(([method, pattern]) => method.test(req.method) && pattern.test(path))) {
        return res.status(403).json({
            success: false,
            message: "This is turned off in the demo, so the shared demo accounts keep working for everyone."
        });
    }
    return next();
}

/** GET /api/demo: what the login page needs to offer one-click demo accounts. */
function demoInfo(req, res) {
    if (!isDemoMode()) return res.json({ success: true, data: { enabled: false } });
    return res.json({
        success: true,
        data: {
            enabled: true,
            password: process.env.DEMO_PASSWORD,
            reset_time: resetTime(),
            accounts: DEMO_ACCOUNTS.map(({ key, role, email, first_name, last_name }) => ({ key, role, email, name: `${first_name} ${last_name}` }))
        }
    });
}

module.exports = { DEMO_ACCOUNTS, demoGuard, demoInfo, isDemoMode, resetTime };
