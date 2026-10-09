// Quote lifecycle rules. Pure functions so the state machine is unit tested.
//
//   Draft ──send──► Sent ──accept──► Accepted ──convert──► Converted
//     │               └──reject──► Rejected
//     └──delete
//
// "Expired" is derived: a Sent quote whose valid_until has passed. It can
// no longer be accepted; duplicate it to re-offer. Any quote can be duplicated.

const STORED_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Converted"];
const DEFAULT_VALIDITY_DAYS = 30;
const MAX_VALIDITY_DAYS = 365;
const MAX_ITEMS = 100;

const ACTIONS = {
    Draft: ["edit", "send", "delete", "duplicate"],
    Sent: ["accept", "reject", "duplicate"],
    Expired: ["duplicate"],
    Accepted: ["convert", "duplicate"],
    Rejected: ["duplicate"],
    Converted: ["duplicate"]
};

/** Local calendar date as YYYY-MM-DD. */
function dateOnly(value) {
    // DATE columns arrive as "YYYY-MM-DD" strings: keep them as-is.
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/** Status shown to users: stored status, or "Expired" for lapsed Sent quotes. */
function effectiveStatus(quote, now = new Date()) {
    if (quote.status === "Sent" && dateOnly(quote.valid_until) < dateOnly(now)) {
        return "Expired";
    }
    return quote.status;
}

function allowedActions(quote, now = new Date()) {
    return ACTIONS[effectiveStatus(quote, now)] ?? [];
}

function canPerform(quote, action, now = new Date()) {
    return allowedActions(quote, now).includes(action);
}

/** Days until valid_until (negative once expired). */
function daysLeft(quote, now = new Date()) {
    const end = new Date(`${dateOnly(quote.valid_until)}T00:00:00`);
    const today = new Date(`${dateOnly(now)}T00:00:00`);
    return Math.round((end - today) / 86400000);
}

function quoteNumber(quote) {
    const year = new Date(quote.created_at).getFullYear() || new Date().getFullYear();
    return `QUO-${year}-${String(quote.id).padStart(6, "0")}`;
}

/**
 * Validates and normalizes a create/update payload.
 * Returns { error } or { value: { customerId, validUntil, notes, lines } }
 * where lines is Map(productId → { quantity, unitPrice }).
 */
function parseQuotePayload(body, now = new Date()) {
    const customerId = Number(body?.customer_id);
    if (!Number.isSafeInteger(customerId) || customerId < 1) {
        return { error: "A valid customer_id is required." };
    }

    const validUntil = body.valid_until ?? dateOnly(addDays(now, DEFAULT_VALIDITY_DAYS));
    if (typeof validUntil !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(new Date(`${validUntil}T00:00:00`).getTime())) {
        return { error: "valid_until must be a date (YYYY-MM-DD)." };
    }
    if (validUntil < dateOnly(now)) {
        return { error: "valid_until can't be in the past." };
    }
    if (validUntil > dateOnly(addDays(now, MAX_VALIDITY_DAYS))) {
        return { error: `A quote can be valid for at most ${MAX_VALIDITY_DAYS} days.` };
    }

    const notes = body.notes ?? "";
    if (typeof notes !== "string" || notes.length > 1000) {
        return { error: "notes must be text of at most 1000 characters." };
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
        return { error: "Add at least one product to the quote." };
    }
    if (items.length > MAX_ITEMS) {
        return { error: `A quote can contain at most ${MAX_ITEMS} lines.` };
    }

    const lines = new Map();
    for (const item of items) {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        const unitPrice = item?.unit_price === undefined || item?.unit_price === null ? null : Number(item.unit_price);

        if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
            return { error: "Each line needs a product and a whole quantity of at least 1." };
        }
        if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 99999999.99)) {
            return { error: "Unit prices must be between 0 and 99,999,999.99." };
        }
        if (lines.has(productId)) {
            return { error: "Each product can appear only once in a quote." };
        }

        lines.set(productId, {
            quantity,
            unitPrice: unitPrice === null ? null : Math.round(unitPrice * 100) / 100
        });
    }

    return { value: { customerId, validUntil, notes: notes.trim() || null, lines } };
}

module.exports = {
    ACTIONS,
    DEFAULT_VALIDITY_DAYS,
    STORED_STATUSES,
    addDays,
    allowedActions,
    canPerform,
    dateOnly,
    daysLeft,
    effectiveStatus,
    parseQuotePayload,
    quoteNumber
};
