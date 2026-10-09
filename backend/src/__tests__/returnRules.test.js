const { billingSummary } = require("../billing/billing");
const {
    buildCreditNote,
    canReturn,
    creditNoteNumber,
    parseReturnPayload,
    returnableLines
} = require("../returns/returnRules");

const now = new Date(2026, 9, 9, 15, 0);

// 2 chairs at 500 + 4 lamps at 125 = 1500 HT, 1800 TTC.
const orderLines = [
    { product_id: 1, product_name: "Chair", quantity: 2, unit_price: "500.00", returned: 0 },
    { product_id: 2, product_name: "Lamp", quantity: 4, unit_price: "125.00", returned: 0 }
];
const order = { status: "Completed", totalAmount: 1500, createdAt: new Date(2026, 9, 1) };
const billingWith = (extra = {}) => billingSummary({ ...order, ...extra }, now);
const requested = (entries) => new Map(entries.map(([id, quantity, restock = true]) => [id, { quantity, restock }]));

describe("credit note basics", () => {
    test("only completed orders can be returned", () => {
        expect(canReturn({ status: "Completed" })).toBe(true);
        expect(canReturn({ status: "Processing" })).toBe(false);
        expect(canReturn({ status: "Cancelled" })).toBe(false);
    });

    test("numbers use the year the credit note was issued", () => {
        expect(creditNoteNumber({ id: 42, created_at: new Date(2026, 4, 2) })).toBe("CN-2026-000042");
    });

    test("returnable quantity subtracts earlier returns", () => {
        const [chair] = returnableLines([{ ...orderLines[0], returned: "1" }]);
        expect(chair).toMatchObject({ ordered: 2, returned: 1, returnable: 1, unit_price: 500 });
    });
});

describe("parseReturnPayload", () => {
    const valid = { reason: "Defective", items: [{ product_id: 1, quantity: 1, restock: false }] };

    test("normalizes a valid payload", () => {
        const { value } = parseReturnPayload({ ...valid, note: "  Leg broken  " });
        expect(value).toMatchObject({ reason: "Defective", note: "Leg broken", refundMethod: null });
        expect(value.lines.get(1)).toEqual({ quantity: 1, restock: false });
    });

    test.each([
        ["unknown reason", { reason: "Bored" }, /reason/],
        ["Other without a note", { reason: "Other" }, /Describe/],
        ["bad refund method", { refund_method: "Bitcoin" }, /refund_method/],
        ["no items", { items: [] }, /at least one/],
        ["zero quantity", { items: [{ product_id: 1, quantity: 0, restock: true }] }, /quantity/],
        ["missing restock", { items: [{ product_id: 1, quantity: 1 }] }, /back into stock/],
        ["duplicate product", { items: [{ product_id: 1, quantity: 1, restock: true }, { product_id: 1, quantity: 1, restock: true }] }, /only once/]
    ])("rejects %s", (_label, override, message) => {
        expect(parseReturnPayload({ ...valid, ...override }).error).toMatch(message);
    });
});

describe("buildCreditNote", () => {
    test("credits the returned lines with VAT and reduces an unpaid balance", () => {
        const { value } = buildCreditNote({ orderLines, requested: requested([[2, 2]]), billing: billingWith() });
        expect(value).toMatchObject({ subtotal: 250, vat: 50, total: 300, appliedToBalance: 300, refundAmount: 0 });
        expect(value.lines[0]).toMatchObject({ productId: 2, quantity: 2, unitPrice: 125, amount: 250, restock: true });
    });

    test("refunds what was already paid beyond the new total", () => {
        const { value } = buildCreditNote({ orderLines, requested: requested([[1, 1]]), billing: billingWith({ paid: 1800 }) });
        expect(value).toMatchObject({ total: 600, appliedToBalance: 0, refundAmount: 600 });
    });

    test("splits between the open balance and a refund", () => {
        const { value } = buildCreditNote({ orderLines, requested: requested([[1, 2]]), billing: billingWith({ paid: 1500 }) });
        expect(value).toMatchObject({ total: 1200, appliedToBalance: 300, refundAmount: 900 });
    });

    test("returning everything left credits exactly what remains of the invoice", () => {
        const lines = [{ product_id: 1, product_name: "Pen", quantity: 3, unit_price: "0.33", returned: 0 }];
        const billing = billingSummary({ ...order, totalAmount: 0.99 }, now); // TTC 1.19
        const first = buildCreditNote({ orderLines: lines, requested: requested([[1, 1]]), billing }).value;
        expect(first.total).toBe(0.4);

        const after = billingSummary({ ...order, totalAmount: 0.99, credited: first.total }, now);
        const rest = buildCreditNote({ orderLines: [{ ...lines[0], returned: 1 }], requested: requested([[1, 2]]), billing: after }).value;
        expect(rest.total).toBe(0.79);
        expect(round(first.total + rest.total)).toBe(1.19);
    });

    test.each([
        ["more than ordered", [[1, 3]], 409, /Only 2 of Chair/],
        ["a product not on the order", [[9, 1]], 400, /not on this order/]
    ])("rejects %s", (_label, entries, status, message) => {
        const result = buildCreditNote({ orderLines, requested: requested(entries), billing: billingWith() });
        expect(result.status).toBe(status);
        expect(result.error).toMatch(message);
    });

    test("rejects lines already fully returned", () => {
        const lines = [{ ...orderLines[0], returned: 2 }, orderLines[1]];
        expect(buildCreditNote({ orderLines: lines, requested: requested([[1, 1]]), billing: billingWith() }).error).toMatch(/already been fully returned/);
    });
});

describe("billing with credit notes", () => {
    test("a credit lowers what is owed", () => {
        expect(billingWith({ credited: 300 })).toMatchObject({ invoice_total: 1800, credited: 300, total_due: 1500, balance: 1500 });
    });

    test("refunds come off the amount paid", () => {
        expect(billingWith({ paid: 1800, credited: 600, refunded: 600 })).toMatchObject({
            total_due: 1200, amount_paid: 1200, balance: 0, payment_status: "Paid"
        });
    });

    test("an order returned in full is marked Credited", () => {
        expect(billingWith({ paid: 1800, credited: 1800, refunded: 1800 })).toMatchObject({ balance: 0, payment_status: "Credited", overdue: false });
        expect(billingWith({ credited: 1800 }).payment_status).toBe("Credited");
    });
});

function round(value) {
    return Math.round(value * 100) / 100;
}
