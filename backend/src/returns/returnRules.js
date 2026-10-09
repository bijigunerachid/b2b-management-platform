// Returns and credit notes. Pure functions.
//
// Only completed (delivered) orders can be returned. Each line can be returned
// up to the quantity that was ordered, across all credit notes of the order.
// The credit first reduces the open balance; whatever the customer has already
// paid beyond the new total is refunded.

const { EPSILON, PAYMENT_METHODS, VAT_RATE, round2 } = require("../billing/billing");

const RETURN_REASONS = ["Damaged in transit", "Defective", "Wrong item", "No longer needed", "Other"];
const MAX_NOTE_LENGTH = 500;

function canReturn(order) {
    return order.status === "Completed";
}

function creditNoteNumber(note) {
    const year = new Date(note.created_at).getFullYear() || new Date().getFullYear();
    return `CN-${year}-${String(note.id).padStart(6, "0")}`;
}

/**
 * Validates a create payload.
 * Returns { error } or { value: { reason, note, refundMethod, lines } }
 * where lines is Map(productId → { quantity, restock }).
 */
function parseReturnPayload(body) {
    if (!RETURN_REASONS.includes(body?.reason)) {
        return { error: "Choose a reason for the return." };
    }

    const note = body.note ?? "";
    if (typeof note !== "string" || note.length > MAX_NOTE_LENGTH) {
        return { error: `The note can be at most ${MAX_NOTE_LENGTH} characters.` };
    }
    if (body.reason === "Other" && note.trim().length < 3) {
        return { error: "Describe the reason in the note." };
    }

    const refundMethod = body.refund_method ?? null;
    if (refundMethod !== null && !PAYMENT_METHODS.includes(refundMethod)) {
        return { error: `refund_method must be one of: ${PAYMENT_METHODS.join(", ")}.` };
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
        return { error: "Choose at least one product to return." };
    }
    if (items.length > 100) {
        return { error: "A credit note can contain at most 100 lines." };
    }

    const lines = new Map();
    for (const item of items) {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);

        if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1) {
            return { error: "Each line needs a product and a whole quantity of at least 1." };
        }
        if (typeof item.restock !== "boolean") {
            return { error: "Say for each line whether the goods go back into stock." };
        }
        if (lines.has(productId)) {
            return { error: "Each product can appear only once." };
        }
        lines.set(productId, { quantity, restock: item.restock });
    }

    return { value: { reason: body.reason, note: note.trim() || null, refundMethod, lines } };
}

/** Order lines with how many units can still be returned. */
function returnableLines(orderLines) {
    return orderLines.map((line) => {
        const ordered = Number(line.quantity);
        const returned = Number(line.returned ?? 0);
        return {
            product_id: line.product_id,
            product_name: line.product_name,
            unit_price: Number(line.unit_price),
            ordered,
            returned,
            returnable: Math.max(0, ordered - returned)
        };
    });
}

/**
 * Works out the credit note for the requested lines.
 * `billing` is the order's current billing summary.
 * Returns { error, status } or { value: { lines, subtotal, vat, total, appliedToBalance, refundAmount } }.
 */
function buildCreditNote({ orderLines, requested, billing }) {
    const available = new Map(returnableLines(orderLines).map((line) => [line.product_id, line]));
    const lines = [];

    for (const [productId, { quantity, restock }] of requested) {
        const line = available.get(productId);
        if (!line) {
            return { status: 400, error: `Product ${productId} is not on this order.` };
        }
        if (quantity > line.returnable) {
            return {
                status: 409,
                error: line.returnable === 0
                    ? `${line.product_name} has already been fully returned.`
                    : `Only ${line.returnable} of ${line.product_name} can still be returned.`
            };
        }
        lines.push({
            productId,
            productName: line.product_name,
            quantity,
            unitPrice: line.unit_price,
            restock,
            amount: round2(quantity * line.unit_price)
        });
    }

    const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));

    // When this note returns everything that is left, it credits exactly what
    // remains of the invoice, so cent rounding across notes can't leave 0.01 owed.
    const returnsEverything = [...available.values()].every(
        (line) => (requested.get(line.product_id)?.quantity ?? 0) === line.returnable
    );
    const remaining = round2(billing.invoice_total - billing.credited);
    let total = returnsEverything ? remaining : round2(subtotal * (1 + VAT_RATE));
    total = Math.min(total, remaining);

    if (total <= EPSILON) {
        return { status: 400, error: "The returned lines have no value to credit." };
    }

    const vat = round2(total - subtotal);
    const appliedToBalance = round2(Math.min(total, billing.balance));
    const refundAmount = round2(total - appliedToBalance);

    return { value: { lines, subtotal, vat, total, appliedToBalance, refundAmount } };
}

module.exports = {
    MAX_NOTE_LENGTH,
    RETURN_REASONS,
    buildCreditNote,
    canReturn,
    creditNoteNumber,
    parseReturnPayload,
    returnableLines
};
