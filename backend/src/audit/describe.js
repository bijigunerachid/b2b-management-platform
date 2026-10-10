// Turns a finished API request into an audit entry. Pure functions.
//
// Every successful POST/PUT/PATCH/DELETE is recorded. Routes listed here get a
// readable action and summary; anything else is still recorded with its method
// and path, so a new endpoint can't silently skip the log.

const SENSITIVE = /pass(word)?|token|secret|cookie/i;
const MAX_DETAILS = 4000;

// Requests that change nothing even though they are POSTs.
const READ_ONLY = [/^\/api\/pricing\/preview$/, /^\/api\/portal\/cart\/price$/, /^\/api\/assistant\/ask$/];

const name = (body, key) => (typeof body?.[key] === "string" && body[key].trim() ? body[key].trim() : null);
const money = (value) => `${Number(value).toFixed(2)} MAD`;

// [method, path regex, (match, req, response) => entry]
const ROUTES = [
    ["POST", /^\/api\/auth\/logout$/, () => ({ action: "auth.logout", summary: "Signed out" })],
    ["POST", /^\/api\/auth\/password$/, () => ({ action: "auth.password_changed", summary: "Changed their password" })],

    ["POST", /^\/api\/customers$/, (m, req, res) => ({ action: "customer.created", entity: ["customer", res?.customerId], summary: `Created customer ${name(req.body, "company_name")}` })],
    ["PUT", /^\/api\/customers\/(\d+)$/, (m, req) => ({ action: "customer.updated", entity: ["customer", m[1]], summary: `Updated customer ${name(req.body, "company_name") ?? `#${m[1]}`}` })],
    ["DELETE", /^\/api\/customers\/(\d+)$/, (m) => ({ action: "customer.deleted", entity: ["customer", m[1]], summary: `Deleted customer #${m[1]}` })],
    ["PATCH", /^\/api\/customers\/(\d+)\/price-list$/, (m) => ({ action: "customer.price_list_changed", entity: ["customer", m[1]], summary: `Changed the price list of customer #${m[1]}` })],
    ["PUT", /^\/api\/customers\/(\d+)\/prices$/, (m, req) => ({ action: "pricing.contract_price_set", entity: ["customer", m[1]], summary: `Set a contract price of ${money(req.body?.unit_price)} for product #${req.body?.product_id}` })],
    ["POST", /^\/api\/customers\/(\d+)\/portal-users$/, (m, req) => ({ action: "portal.access_granted", entity: ["customer", m[1]], summary: `Gave portal access to ${name(req.body, "email")}` })],
    ["PATCH", /^\/api\/portal-users\/(\d+)\/status$/, (m, req) => ({ action: req.body?.is_active ? "portal.access_enabled" : "portal.access_disabled", entity: ["portal_user", m[1]], summary: `${req.body?.is_active ? "Enabled" : "Disabled"} portal account #${m[1]}` })],

    ["POST", /^\/api\/products$/, (m, req, res) => ({ action: "product.created", entity: ["product", res?.productId], summary: `Created product ${name(req.body, "name")}` })],
    ["PUT", /^\/api\/products\/(\d+)$/, (m, req) => ({ action: "product.updated", entity: ["product", m[1]], summary: `Updated product ${name(req.body, "name") ?? `#${m[1]}`}` })],
    ["DELETE", /^\/api\/products\/(\d+)$/, (m) => ({ action: "product.deleted", entity: ["product", m[1]], summary: `Deleted product #${m[1]}` })],
    ["POST", /^\/api\/products\/(\d+)\/adjustments$/, (m, req) => ({ action: "stock.adjusted", entity: ["product", m[1]], summary: `Adjusted stock of product #${m[1]} by ${Number(req.body?.quantity) > 0 ? "+" : ""}${req.body?.quantity} (${req.body?.reason})` })],
    ["POST", /^\/api\/categories$/, (m, req, res) => ({ action: "category.created", entity: ["category", res?.categoryId], summary: `Created category ${name(req.body, "name")}` })],
    ["PUT", /^\/api\/categories\/(\d+)$/, (m, req) => ({ action: "category.updated", entity: ["category", m[1]], summary: `Updated category ${name(req.body, "name") ?? `#${m[1]}`}` })],
    ["DELETE", /^\/api\/categories\/(\d+)$/, (m) => ({ action: "category.deleted", entity: ["category", m[1]], summary: `Deleted category #${m[1]}` })],

    ["POST", /^\/api\/orders$/, (m, req, res) => ({ action: "order.created", entity: ["order", res?.data?.orderId], summary: `Created order #${res?.data?.orderId}` })],
    ["POST", /^\/api\/orders\/(\d+)\/email$/, (m) => ({ action: "order.invoice_emailed", entity: ["order", m[1]], summary: `Emailed the invoice for order #${m[1]}` })],
    ["POST", /^\/api\/quotes\/(\d+)\/email$/, (m) => ({ action: "quote.emailed", entity: ["quote", m[1]], summary: `Emailed quote #${m[1]}` })],
    ["PATCH", /^\/api\/orders\/(\d+)\/status$/, (m, req) => ({ action: "order.status_changed", entity: ["order", m[1]], summary: `Moved order #${m[1]} to ${req.body?.status}` })],
    ["POST", /^\/api\/orders\/(\d+)\/payments$/, (m, req) => ({ action: "payment.recorded", entity: ["order", m[1]], summary: `Recorded a ${money(req.body?.amount)} payment on order #${m[1]}` })],
    ["POST", /^\/api\/orders\/(\d+)\/credit-notes$/, (m, req, res) => ({ action: "credit_note.created", entity: ["order", m[1]], summary: `Created ${res?.data?.number ?? "a credit note"} for ${money(res?.data?.total ?? 0)} on order #${m[1]}` })],
    ["PATCH", /^\/api\/payments\/(\d+)\/void$/, (m, req) => ({ action: "payment.voided", entity: ["payment", m[1]], summary: `Voided payment #${m[1]}: ${name(req.body, "reason")}` })],

    ["POST", /^\/api\/quotes$/, (m, req, res) => ({ action: "quote.created", entity: ["quote", res?.data?.quoteId], summary: `Created quote #${res?.data?.quoteId}` })],
    ["PUT", /^\/api\/quotes\/(\d+)$/, (m) => ({ action: "quote.updated", entity: ["quote", m[1]], summary: `Updated quote #${m[1]}` })],
    ["DELETE", /^\/api\/quotes\/(\d+)$/, (m) => ({ action: "quote.deleted", entity: ["quote", m[1]], summary: `Deleted quote #${m[1]}` })],
    ["POST", /^\/api\/quotes\/(\d+)\/(send|accept|reject|convert|duplicate)$/, (m, req, res) => ({
        action: `quote.${{ send: "sent", accept: "accepted", reject: "rejected", convert: "converted", duplicate: "duplicated" }[m[2]]}`,
        entity: ["quote", m[1]],
        summary: { send: `Sent quote #${m[1]}`, accept: `Marked quote #${m[1]} accepted`, reject: `Marked quote #${m[1]} declined`, convert: `Converted quote #${m[1]} into order #${res?.data?.orderId}`, duplicate: `Duplicated quote #${m[1]}` }[m[2]]
    })],

    ["POST", /^\/api\/suppliers$/, (m, req, res) => ({ action: "supplier.created", entity: ["supplier", res?.data?.supplierId], summary: `Created supplier ${name(req.body, "name")}` })],
    ["PUT", /^\/api\/suppliers\/(\d+)$/, (m, req) => ({ action: "supplier.updated", entity: ["supplier", m[1]], summary: `Updated supplier ${name(req.body, "name") ?? `#${m[1]}`}` })],
    ["DELETE", /^\/api\/suppliers\/(\d+)$/, (m) => ({ action: "supplier.deleted", entity: ["supplier", m[1]], summary: `Deleted supplier #${m[1]}` })],
    ["POST", /^\/api\/purchase-orders$/, (m, req, res) => ({ action: "purchase_order.created", entity: ["purchase_order", res?.data?.purchaseOrderId], summary: `Created purchase order #${res?.data?.purchaseOrderId}` })],
    ["PUT", /^\/api\/purchase-orders\/(\d+)$/, (m) => ({ action: "purchase_order.updated", entity: ["purchase_order", m[1]], summary: `Updated purchase order #${m[1]}` })],
    ["DELETE", /^\/api\/purchase-orders\/(\d+)$/, (m) => ({ action: "purchase_order.deleted", entity: ["purchase_order", m[1]], summary: `Deleted purchase order #${m[1]}` })],
    ["POST", /^\/api\/purchase-orders\/(\d+)\/(order|receive|cancel)$/, (m) => ({
        action: `purchase_order.${{ order: "ordered", receive: "received", cancel: "cancelled" }[m[2]]}`,
        entity: ["purchase_order", m[1]],
        summary: `${{ order: "Sent", receive: "Received", cancel: "Cancelled" }[m[2]]} purchase order #${m[1]}`
    })],
    ["POST", /^\/api\/inventory\/reorder-suggestions\/purchase-orders$/, () => ({ action: "purchase_order.drafted", summary: "Created draft purchase orders from reorder suggestions" })],

    ["POST", /^\/api\/pricing\/price-lists$/, (m, req, res) => ({ action: "pricing.price_list_created", entity: ["price_list", res?.data?.id], summary: `Created price list ${name(req.body, "name")} (−${req.body?.discount_percent}%)` })],
    ["PUT", /^\/api\/pricing\/price-lists\/(\d+)$/, (m, req) => ({ action: "pricing.price_list_updated", entity: ["price_list", m[1]], summary: `Updated price list ${name(req.body, "name") ?? `#${m[1]}`}` })],
    ["DELETE", /^\/api\/pricing\/price-lists\/(\d+)$/, (m) => ({ action: "pricing.price_list_deleted", entity: ["price_list", m[1]], summary: `Deleted price list #${m[1]}` })],
    ["POST", /^\/api\/pricing\/volume-discounts$/, (m, req, res) => ({ action: "pricing.volume_discount_created", entity: ["volume_discount", res?.data?.id], summary: `Created a volume discount: ${req.body?.min_quantity}+ units −${req.body?.discount_percent}%` })],
    ["PUT", /^\/api\/pricing\/volume-discounts\/(\d+)$/, (m) => ({ action: "pricing.volume_discount_updated", entity: ["volume_discount", m[1]], summary: `Updated volume discount #${m[1]}` })],
    ["DELETE", /^\/api\/pricing\/volume-discounts\/(\d+)$/, (m) => ({ action: "pricing.volume_discount_deleted", entity: ["volume_discount", m[1]], summary: `Deleted volume discount #${m[1]}` })],
    ["DELETE", /^\/api\/pricing\/customer-prices\/(\d+)$/, (m) => ({ action: "pricing.contract_price_removed", entity: ["contract_price", m[1]], summary: `Removed contract price #${m[1]}` })],

    ["POST", /^\/api\/users$/, (m, req, res) => ({ action: "user.created", entity: ["user", res?.userId], summary: `Created staff account ${name(req.body, "email")}` })],
    ["PUT", /^\/api\/users\/(\d+)$/, (m, req) => ({ action: "user.updated", entity: ["user", m[1]], summary: `Updated staff account ${name(req.body, "email") ?? `#${m[1]}`}` })],
    ["PATCH", /^\/api\/users\/(\d+)\/status$/, (m, req) => ({ action: req.body?.is_active ? "user.activated" : "user.deactivated", entity: ["user", m[1]], summary: `${req.body?.is_active ? "Activated" : "Deactivated"} staff account #${m[1]}` })],

    ["POST", /^\/api\/portal\/orders$/, (m, req, res) => ({ action: "order.created", entity: ["order", res?.data?.orderId], summary: `Placed order #${res?.data?.orderId} from the portal` })],
    ["POST", /^\/api\/portal\/quotes\/(\d+)\/(accept|reject)$/, (m) => ({ action: `quote.${m[2] === "accept" ? "accepted" : "rejected"}`, entity: ["quote", m[1]], summary: `${m[2] === "accept" ? "Accepted" : "Declined"} quote #${m[1]} from the portal` })]
];

/** Removes secrets and caps the size of a request body before it is stored. */
function sanitize(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}...` : value;
    if (typeof value !== "object") return value;
    if (depth > 3) return "[...]";
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, SENSITIVE.test(key) ? "[hidden]" : sanitize(item, depth + 1)])
    );
}

function limitDetails(details) {
    if (details === null || details === undefined) return null;
    if (typeof details === "object" && Object.keys(details).length === 0) return null;
    const json = JSON.stringify(details);
    return json.length > MAX_DETAILS ? { truncated: true, size: json.length } : details;
}

/**
 * The audit entry for a finished request, or null when it isn't recorded.
 * `request`: { method, path, body, user }; `response`: { status, body }.
 */
function describe(request, response) {
    const { method, path } = request;
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
    if (READ_ONLY.some((pattern) => pattern.test(path))) return null;

    if (method === "POST" && path === "/api/auth/login") {
        const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase().slice(0, 255) : null;
        if (response.status === 200) {
            const user = response.body?.user;
            return { action: "auth.login", summary: "Signed in", actor: user ? { id: user.id, role: user.role } : null, entity: ["user", user?.id], details: null };
        }
        if (response.status === 401 || response.status === 403) {
            return { action: "auth.login_failed", summary: `Failed sign-in for ${email ?? "an unknown email"}`, actor: null, entity: null, details: { email } };
        }
        return null;
    }

    if (response.status >= 400) return null;

    for (const [routeMethod, pattern, build] of ROUTES) {
        if (routeMethod !== method) continue;
        const match = path.match(pattern);
        if (match) {
            const entry = build(match, request, response.body ?? {});
            return { details: limitDetails(sanitize(request.body ?? null)), ...entry };
        }
    }

    return { action: "request", summary: `${method} ${path}`, details: limitDetails(sanitize(request.body ?? null)) };
}

/** Field-by-field differences between two versions of a record. */
function diff(before, after, fields) {
    const changes = [];
    for (const field of fields) {
        const from = normalize(before?.[field]);
        const to = normalize(after?.[field]);
        if (from !== to) changes.push({ field, from, to });
    }
    return changes;
}

function normalize(value) {
    if (value === undefined || value === null || value === "") return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value;
    // "850.10" and 850.1 are the same price, but "0612..." is a phone number, not 612...
    if (typeof value === "string" && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value.trim())) return Number(value);
    return String(value);
}

module.exports = { describe, diff, sanitize };
