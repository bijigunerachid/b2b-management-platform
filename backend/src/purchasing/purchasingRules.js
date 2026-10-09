// Purchase order lifecycle and reorder suggestions. Pure functions.
//
//   Draft ──order──► Ordered ──receive──► Received (adds stock)
//     │                 └──cancel──► Cancelled
//     ├──cancel──► Cancelled
//     └──delete
//
// "Late" is derived: an Ordered PO whose expected date has passed.

const { dateOnly } = require("../quotes/quoteRules");

const MAX_ITEMS = 200;
const COVER_MULTIPLIER = 3; // reorder up to 3× the reorder point
const ESTIMATED_COST_RATIO = 0.6; // cost estimate when no purchase history exists

const ACTIONS = {
    Draft: ["edit", "order", "cancel", "delete"],
    Ordered: ["receive", "cancel"],
    Received: [],
    Cancelled: []
};

function allowedActions(po) {
    return ACTIONS[po.status] ?? [];
}

function canPerform(po, action) {
    return allowedActions(po).includes(action);
}

function isLate(po, now = new Date()) {
    return po.status === "Ordered" && Boolean(po.expected_at) && dateOnly(po.expected_at) < dateOnly(now);
}

/**
 * Average cost after receiving `quantity` units at `unitCost` on top of
 * `stock` units that cost `averageCost` each. An unknown or empty starting
 * position takes the new cost.
 */
function weightedAverageCost({ stock, averageCost, quantity, unitCost }) {
    const onHand = Math.max(0, Number(stock));
    if (averageCost === null || averageCost === undefined || onHand === 0) return Math.round(Number(unitCost) * 100) / 100;
    const total = onHand * Number(averageCost) + quantity * Number(unitCost);
    return Math.round((total / (onHand + quantity)) * 100) / 100;
}

function poNumber(po) {
    const year = new Date(po.created_at).getFullYear() || new Date().getFullYear();
    return `PO-${year}-${String(po.id).padStart(6, "0")}`;
}

/**
 * Validates and normalizes a create/update payload.
 * Returns { error } or { value: { supplierId, expectedAt, notes, lines } }
 * where lines is Map(productId → { quantity, unitCost }).
 */
function parsePurchaseOrderPayload(body) {
    const supplierId = Number(body?.supplier_id);
    if (!Number.isSafeInteger(supplierId) || supplierId < 1) {
        return { error: "Choose a supplier." };
    }

    const expectedAt = body.expected_at || null;
    if (expectedAt !== null && (typeof expectedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expectedAt) || Number.isNaN(new Date(`${expectedAt}T00:00:00`).getTime()))) {
        return { error: "expected_at must be a date (YYYY-MM-DD)." };
    }

    const notes = body.notes ?? "";
    if (typeof notes !== "string" || notes.length > 1000) {
        return { error: "notes must be text of at most 1000 characters." };
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
        return { error: "Add at least one product." };
    }
    if (items.length > MAX_ITEMS) {
        return { error: `A purchase order can contain at most ${MAX_ITEMS} lines.` };
    }

    const lines = new Map();
    for (const item of items) {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        const unitCost = Number(item?.unit_cost);

        if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
            return { error: "Each line needs a product and a whole quantity of at least 1." };
        }
        if (item?.unit_cost === undefined || item?.unit_cost === null || item?.unit_cost === "" || !Number.isFinite(unitCost) || unitCost < 0 || unitCost > 99999999.99) {
            return { error: "Each line needs a unit cost between 0 and 99,999,999.99." };
        }
        if (lines.has(productId)) {
            return { error: "Each product can appear only once in a purchase order." };
        }

        lines.set(productId, { quantity, unitCost: Math.round(unitCost * 100) / 100 });
    }

    return { value: { supplierId, expectedAt, notes: notes.trim() || null, lines } };
}

/** Unit cost to propose: last purchase price, else an estimate from the sale price. */
function proposedCost(product, lastCosts) {
    const last = lastCosts.get(product.id);
    if (last !== undefined) return Number(last);
    return Math.round(Number(product.price) * ESTIMATED_COST_RATIO * 100) / 100;
}

/**
 * Products to reorder: active, with a reorder point, whose stock plus
 * quantity already on order is at or below that point. Suggests enough to
 * reach COVER_MULTIPLIER × reorder point. Grouped by preferred supplier.
 */
function reorderSuggestions(products, lastCosts = new Map()) {
    const groups = new Map();

    for (const product of products) {
        const reorderPoint = Number(product.reorder_point);
        if (!product.is_active || reorderPoint <= 0) continue;

        const stock = Number(product.stock);
        const onOrder = Number(product.on_order ?? 0);
        const available = stock + onOrder;
        if (available > reorderPoint) continue;

        const quantity = Math.max(1, reorderPoint * COVER_MULTIPLIER - available);
        const unitCost = proposedCost(product, lastCosts);
        const key = product.supplier_id ?? "none";

        if (!groups.has(key)) {
            groups.set(key, {
                supplier_id: product.supplier_id ?? null,
                supplier_name: product.supplier_name ?? null,
                items: [],
                total: 0
            });
        }

        const group = groups.get(key);
        group.items.push({
            product_id: product.id,
            name: product.name,
            stock,
            on_order: onOrder,
            reorder_point: reorderPoint,
            quantity,
            unit_cost: unitCost,
            urgency: stock === 0 ? "out" : "low"
        });
        group.total = Math.round((group.total + quantity * unitCost) * 100) / 100;
    }

    // Suppliers first (most urgent first), products without a supplier last.
    return [...groups.values()]
        .map((group) => ({
            ...group,
            items: group.items.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
        }))
        .sort((a, b) => {
            if (!a.supplier_id) return 1;
            if (!b.supplier_id) return -1;
            const outA = a.items.filter((item) => item.stock === 0).length;
            const outB = b.items.filter((item) => item.stock === 0).length;
            return outB - outA || b.items.length - a.items.length;
        });
}

module.exports = {
    ACTIONS,
    COVER_MULTIPLIER,
    allowedActions,
    canPerform,
    isLate,
    parsePurchaseOrderPayload,
    poNumber,
    proposedCost,
    reorderSuggestions,
    weightedAverageCost
};
