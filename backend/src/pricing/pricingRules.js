// Customer pricing. Pure functions.
//
// For one customer, product, and quantity:
//   1. a contract price for that customer and product wins outright;
//   2. otherwise the catalog price, less the customer's price list discount,
//      less the best volume discount that applies (category-specific or for
//      all products, whichever is larger).
// Discounts compound: 10% then 5% is 14.5% off, not 15%.

const PRICE_SOURCES = ["list", "price_list", "volume", "contract", "quote"];
const MAX_DISCOUNT = 50;

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** The largest volume break reached by `quantity` for a product in `categoryId`. */
function bestVolumeBreak(breaks, categoryId, quantity) {
    let best = null;
    for (const rule of breaks) {
        const applies = rule.category_id === null || rule.category_id === undefined || Number(rule.category_id) === Number(categoryId);
        if (!applies || quantity < Number(rule.min_quantity)) continue;
        if (!best || Number(rule.discount_percent) > Number(best.discount_percent)) best = rule;
    }
    return best;
}

/** The next break the customer could reach by ordering more, for "order 10 more to save 5%" hints. */
function nextVolumeBreak(breaks, categoryId, quantity) {
    const current = bestVolumeBreak(breaks, categoryId, quantity);
    const currentPercent = current ? Number(current.discount_percent) : 0;
    let next = null;
    for (const rule of breaks) {
        const applies = rule.category_id === null || rule.category_id === undefined || Number(rule.category_id) === Number(categoryId);
        if (!applies || quantity >= Number(rule.min_quantity) || Number(rule.discount_percent) <= currentPercent) continue;
        if (!next || Number(rule.min_quantity) < Number(next.min_quantity)) next = rule;
    }
    return next;
}

/**
 * Price for one line.
 * context: { priceList: { name, discount_percent } | null, contracts: Map(productId → price), breaks: [] }
 * product: { id, price, category_id }
 */
function resolvePrice(context, product, quantity) {
    const listPrice = round2(product.price);
    const contract = context.contracts?.get(Number(product.id));

    if (contract !== undefined && contract !== null) {
        const unitPrice = round2(contract);
        return {
            unitPrice,
            listPrice,
            source: "contract",
            discountPercent: listPrice > 0 ? round2((1 - unitPrice / listPrice) * 100) : 0,
            label: "Contract price"
        };
    }

    const listDiscount = Number(context.priceList?.discount_percent ?? 0);
    const volume = bestVolumeBreak(context.breaks ?? [], product.category_id, quantity);
    const volumeDiscount = Number(volume?.discount_percent ?? 0);

    const factor = (1 - listDiscount / 100) * (1 - volumeDiscount / 100);
    const unitPrice = round2(listPrice * factor);

    const labels = [];
    if (listDiscount > 0) labels.push(`${context.priceList.name} −${formatPercent(listDiscount)}`);
    if (volumeDiscount > 0) labels.push(`${volume.min_quantity}+ units −${formatPercent(volumeDiscount)}`);

    return {
        unitPrice,
        listPrice,
        source: volumeDiscount > 0 ? "volume" : listDiscount > 0 ? "price_list" : "list",
        discountPercent: round2((1 - factor) * 100),
        label: labels.join(", ") || null
    };
}

function formatPercent(value) {
    return `${Number(value).toString()}%`;
}

function parsePercent(value) {
    const percent = Number(value);
    if (value === "" || value === null || value === undefined || !Number.isFinite(percent) || percent <= 0 || percent > MAX_DISCOUNT) {
        return null;
    }
    return round2(percent);
}

/** { name, description?, discount_percent, is_active? } → { error } | { value } */
function parsePriceList(body) {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 100) return { error: "The name must be 2 to 100 characters." };

    const description = body.description ?? "";
    if (typeof description !== "string" || description.length > 255) return { error: "The description can be at most 255 characters." };

    const discount = parsePercent(body.discount_percent);
    if (discount === null) return { error: `The discount must be more than 0% and at most ${MAX_DISCOUNT}%.` };

    if (body.is_active !== undefined && typeof body.is_active !== "boolean") return { error: "is_active must be true or false." };

    return { value: { name, description: description.trim() || null, discountPercent: discount, isActive: body.is_active ?? true } };
}

/** { category_id: id | null, min_quantity, discount_percent } → { error } | { value } */
function parseVolumeDiscount(body) {
    const categoryId = body?.category_id === null || body?.category_id === "" || body?.category_id === undefined ? null : Number(body.category_id);
    if (categoryId !== null && (!Number.isSafeInteger(categoryId) || categoryId < 1)) return { error: "Choose a category or all products." };

    const minQuantity = Number(body?.min_quantity);
    if (!Number.isSafeInteger(minQuantity) || minQuantity < 2 || minQuantity > 100000) return { error: "The minimum quantity must be a whole number from 2 to 100,000." };

    const discount = parsePercent(body?.discount_percent);
    if (discount === null) return { error: `The discount must be more than 0% and at most ${MAX_DISCOUNT}%.` };

    return { value: { categoryId, minQuantity, discountPercent: discount } };
}

/** { product_id, unit_price, note? } → { error } | { value } */
function parseCustomerPrice(body) {
    const productId = Number(body?.product_id);
    if (!Number.isSafeInteger(productId) || productId < 1) return { error: "Choose a product." };

    const unitPrice = Number(body?.unit_price);
    if (body?.unit_price === "" || body?.unit_price === null || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 99999999.99) {
        return { error: "Enter a price between 0 and 99,999,999.99." };
    }

    const note = body.note ?? "";
    if (typeof note !== "string" || note.length > 255) return { error: "The note can be at most 255 characters." };

    return { value: { productId, unitPrice: round2(unitPrice), note: note.trim() || null } };
}

module.exports = {
    MAX_DISCOUNT,
    PRICE_SOURCES,
    bestVolumeBreak,
    nextVolumeBreak,
    parseCustomerPrice,
    parsePriceList,
    parseVolumeDiscount,
    resolvePrice
};
