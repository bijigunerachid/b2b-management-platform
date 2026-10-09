const {
    allowedActions,
    canPerform,
    daysLeft,
    effectiveStatus,
    parseQuotePayload,
    quoteNumber
} = require("../quotes/quoteRules");

const now = new Date(2026, 9, 9, 15, 0); // 9 Oct 2026

describe("quote lifecycle", () => {
    test("a Sent quote expires the day after valid_until", () => {
        expect(effectiveStatus({ status: "Sent", valid_until: "2026-10-09" }, now)).toBe("Sent");
        expect(effectiveStatus({ status: "Sent", valid_until: "2026-10-08" }, now)).toBe("Expired");
    });

    test("only Sent quotes expire", () => {
        for (const status of ["Draft", "Accepted", "Rejected", "Converted"]) {
            expect(effectiveStatus({ status, valid_until: "2020-01-01" }, now)).toBe(status);
        }
    });

    test.each([
        ["Draft", "2026-12-01", ["edit", "send", "delete", "duplicate"]],
        ["Sent", "2026-12-01", ["accept", "reject", "duplicate"]],
        ["Sent", "2026-01-01", ["duplicate"]],
        ["Accepted", "2026-01-01", ["convert", "duplicate"]],
        ["Rejected", "2026-12-01", ["duplicate"]],
        ["Converted", "2026-12-01", ["duplicate"]]
    ])("%s (valid until %s) allows %j", (status, validUntil, actions) => {
        expect(allowedActions({ status, valid_until: validUntil }, now)).toEqual(actions);
    });

    test("an expired quote can't be accepted, and a sent one can't be edited", () => {
        expect(canPerform({ status: "Sent", valid_until: "2026-10-01" }, "accept", now)).toBe(false);
        expect(canPerform({ status: "Sent", valid_until: "2026-12-01" }, "edit", now)).toBe(false);
        expect(canPerform({ status: "Accepted", valid_until: "2026-10-01" }, "convert", now)).toBe(true);
    });

    test("daysLeft counts calendar days", () => {
        expect(daysLeft({ valid_until: "2026-10-12" }, now)).toBe(3);
        expect(daysLeft({ valid_until: "2026-10-09" }, now)).toBe(0);
        expect(daysLeft({ valid_until: "2026-10-01" }, now)).toBe(-8);
    });

    test("quote numbers use the creation year", () => {
        expect(quoteNumber({ id: 42, created_at: new Date(2026, 2, 1) })).toBe("QUO-2026-000042");
    });
});

describe("parseQuotePayload", () => {
    const valid = {
        customer_id: 3,
        valid_until: "2026-11-08",
        notes: "  Delivery in 2 weeks  ",
        items: [{ product_id: 5, quantity: 2, unit_price: 99.999 }, { product_id: 9, quantity: 1 }]
    };

    test("normalizes a valid payload", () => {
        const { value, error } = parseQuotePayload(valid, now);

        expect(error).toBeUndefined();
        expect(value.customerId).toBe(3);
        expect(value.notes).toBe("Delivery in 2 weeks");
        expect(value.lines.get(5)).toEqual({ quantity: 2, unitPrice: 100 });
        expect(value.lines.get(9)).toEqual({ quantity: 1, unitPrice: null });
    });

    test("defaults validity to 30 days", () => {
        const { value } = parseQuotePayload({ ...valid, valid_until: undefined }, now);
        expect(value.validUntil).toBe("2026-11-08");
    });

    test.each([
        ["missing customer", { customer_id: undefined }, /customer_id/],
        ["past validity", { valid_until: "2026-10-08" }, /past/],
        ["validity over a year", { valid_until: "2027-12-01" }, /at most 365/],
        ["bad date", { valid_until: "09/10/2026" }, /YYYY-MM-DD/],
        ["no items", { items: [] }, /at least one/],
        ["zero quantity", { items: [{ product_id: 1, quantity: 0 }] }, /quantity/],
        ["fractional quantity", { items: [{ product_id: 1, quantity: 1.5 }] }, /quantity/],
        ["negative price", { items: [{ product_id: 1, quantity: 1, unit_price: -1 }] }, /Unit prices/],
        ["duplicate product", { items: [{ product_id: 1, quantity: 1 }, { product_id: 1, quantity: 2 }] }, /only once/],
        ["huge notes", { notes: "x".repeat(1001) }, /1000/]
    ])("rejects %s", (_label, override, message) => {
        expect(parseQuotePayload({ ...valid, ...override }, now).error).toMatch(message);
    });
});
