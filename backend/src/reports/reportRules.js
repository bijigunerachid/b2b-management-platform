// Sales report rules. Pure functions.
//
// Sales are orders that weren't cancelled, by order date, excluding VAT and
// net of returns (a credit note counts against the month of its order).
// Cost is what the goods cost when they were sold; returned goods that went
// back into stock give their cost back, written-off goods don't.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 1100;
const DEFAULT_DAYS = 90;

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toDateOnly(date) {
    return date.toISOString().slice(0, 10);
}

function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || toDateOnly(date) !== value ? null : date;
}

/**
 * Inclusive date range from ?from=&to= (YYYY-MM-DD, UTC days).
 * Defaults to the last 90 days. Returns { error } or { value: { from, to, days } }.
 */
function parseRange(query = {}, now = new Date()) {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const to = query.to ? parseDate(query.to) : today;
    if (!to) return { error: "to must be a date (YYYY-MM-DD)." };

    const from = query.from ? parseDate(query.from) : new Date(to.getTime() - (DEFAULT_DAYS - 1) * DAY_MS);
    if (!from) return { error: "from must be a date (YYYY-MM-DD)." };
    if (from > to) return { error: "The start date must be on or before the end date." };

    const days = Math.round((to - from) / DAY_MS) + 1;
    if (days > MAX_DAYS) return { error: "Choose a range of at most three years." };

    return { value: { from: toDateOnly(from), to: toDateOnly(to), days } };
}

/** The range of the same length that ends the day before `range` starts. */
function previousRange(range) {
    const from = new Date(`${range.from}T00:00:00Z`);
    const to = new Date(from.getTime() - DAY_MS);
    const start = new Date(to.getTime() - (range.days - 1) * DAY_MS);
    return { from: toDateOnly(start), to: toDateOnly(to), days: range.days };
}

/** SQL bounds: created_at >= start AND created_at < end. */
function sqlBounds(range) {
    const end = new Date(new Date(`${range.to}T00:00:00Z`).getTime() + DAY_MS);
    return [`${range.from} 00:00:00`, `${toDateOnly(end)} 00:00:00`];
}

/** Numbers for one report row, with margin. */
function summarize(row) {
    const revenue = round2(row.revenue ?? 0);
    const cost = round2(row.cost ?? 0);
    const margin = round2(revenue - cost);
    return {
        orders: Number(row.orders ?? 0),
        units: Number(row.units ?? 0),
        revenue,
        cost,
        margin,
        margin_percent: revenue > 0 ? round2((margin / revenue) * 100) : null,
        discounts: round2(row.discounts ?? 0),
        returns: round2(row.returns ?? 0)
    };
}

/** Percentage change, or null when there's nothing to compare with. */
function change(current, previous) {
    if (!previous) return null;
    return round2(((current - previous) / Math.abs(previous)) * 100);
}

/** Every month touched by the range (YYYY-MM), with zeros for months without sales. */
function fillMonths(rows, range) {
    const byMonth = new Map(rows.map((row) => [row.id, row]));
    const months = [];
    const cursor = new Date(`${range.from.slice(0, 7)}-01T00:00:00Z`);
    const last = range.to.slice(0, 7);

    while (toDateOnly(cursor).slice(0, 7) <= last) {
        const key = toDateOnly(cursor).slice(0, 7);
        months.push({ month: key, ...summarize(byMonth.get(key) ?? {}) });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
}

module.exports = { MAX_DAYS, change, fillMonths, parseRange, previousRange, sqlBounds, summarize };
