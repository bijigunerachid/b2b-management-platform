const {
    allowedActions,
    forecastLevels,
    isLate,
    parsePurchaseOrderPayload,
    poNumber,
    proposedCost,
    reorderSuggestions
} = require("../purchasing/purchasingRules");

const now = new Date(2026, 9, 9, 15, 0);

describe("purchase order lifecycle", () => {
    test.each([
        ["Draft", ["edit", "order", "cancel", "delete"]],
        ["Ordered", ["receive", "cancel"]],
        ["Received", []],
        ["Cancelled", []]
    ])("%s allows %j", (status, actions) => {
        expect(allowedActions({ status })).toEqual(actions);
    });

    test("only ordered POs past their expected date are late", () => {
        expect(isLate({ status: "Ordered", expected_at: "2026-10-08" }, now)).toBe(true);
        expect(isLate({ status: "Ordered", expected_at: "2026-10-09" }, now)).toBe(false);
        expect(isLate({ status: "Ordered", expected_at: null }, now)).toBe(false);
        expect(isLate({ status: "Received", expected_at: "2026-01-01" }, now)).toBe(false);
    });

    test("PO numbers use the creation year", () => {
        expect(poNumber({ id: 7, created_at: new Date(2026, 0, 3) })).toBe("PO-2026-000007");
    });
});

describe("parsePurchaseOrderPayload", () => {
    const valid = { supplier_id: 2, expected_at: "2026-10-20", items: [{ product_id: 4, quantity: 10, unit_cost: 12.345 }] };

    test("normalizes a valid payload", () => {
        const { value } = parsePurchaseOrderPayload(valid);
        expect(value.supplierId).toBe(2);
        expect(value.lines.get(4)).toEqual({ quantity: 10, unitCost: 12.35 });
        expect(value.notes).toBeNull();
    });

    test.each([
        ["no supplier", { supplier_id: null }, /supplier/],
        ["bad date", { expected_at: "20/10/2026" }, /YYYY-MM-DD/],
        ["no items", { items: [] }, /at least one/],
        ["missing cost", { items: [{ product_id: 4, quantity: 1 }] }, /unit cost/],
        ["negative cost", { items: [{ product_id: 4, quantity: 1, unit_cost: -1 }] }, /unit cost/],
        ["zero quantity", { items: [{ product_id: 4, quantity: 0, unit_cost: 1 }] }, /quantity/],
        ["duplicate product", { items: [{ product_id: 4, quantity: 1, unit_cost: 1 }, { product_id: 4, quantity: 2, unit_cost: 1 }] }, /only once/]
    ])("rejects %s", (_label, override, message) => {
        expect(parsePurchaseOrderPayload({ ...valid, ...override }).error).toMatch(message);
    });
});

describe("reorder suggestions", () => {
    const product = (overrides) => ({
        id: 1, name: "Item", price: 100, stock: 3, on_order: 0, reorder_point: 5,
        is_active: 1, supplier_id: 9, supplier_name: "Atlas", ...overrides
    });

    test("suggests topping up to 3× the reorder point", () => {
        const [group] = reorderSuggestions([product({ stock: 3, reorder_point: 5 })]);
        expect(group.items[0]).toMatchObject({ quantity: 12, unit_cost: 60, urgency: "low" });
        expect(group.total).toBe(720);
    });

    test("counts stock already on order, so nothing is ordered twice", () => {
        expect(reorderSuggestions([product({ stock: 2, on_order: 10, reorder_point: 5 })])).toEqual([]);
        const [group] = reorderSuggestions([product({ stock: 1, on_order: 3, reorder_point: 5 })]);
        expect(group.items[0].quantity).toBe(11);
    });

    test("skips inactive products and products without a reorder point", () => {
        expect(reorderSuggestions([product({ is_active: 0 }), product({ id: 2, reorder_point: 0, stock: 0 })])).toEqual([]);
    });

    test("uses the last purchase cost when known", () => {
        expect(proposedCost({ id: 1, price: 100 }, new Map([[1, "42.50"]]))).toBe(42.5);
    });

    test("groups by supplier, most urgent first, unassigned last", () => {
        const groups = reorderSuggestions([
            product({ id: 1, supplier_id: null, supplier_name: null, stock: 0 }),
            product({ id: 2, supplier_id: 5, supplier_name: "Low", stock: 4 }),
            product({ id: 3, supplier_id: 6, supplier_name: "Out", stock: 0 }),
            product({ id: 4, supplier_id: 6, supplier_name: "Out", stock: 2, name: "B" })
        ]);
        expect(groups.map((g) => g.supplier_name)).toEqual(["Out", "Low", null]);
        expect(groups[0].items.map((item) => item.product_id)).toEqual([3, 4]);
    });
});

describe("forecast-based reorder levels", () => {
    // 8 units expected over 4 weeks, 80% interval up to 16.
    const forecast = { units: 8, lower_units: 2, upper_units: 16, horizon_weeks: 4 };
    const product = (overrides) => ({
        id: 1, name: "Item", price: 100, stock: 6, on_order: 0, reorder_point: 2, lead_time_days: 14,
        is_active: 1, supplier_id: 9, supplier_name: "Atlas", ...overrides
    });

    test("covers lead-time demand plus safety stock that grows with the square root of time", () => {
        // 2 weeks of lead time: 8 × 2/4 = 4 expected, plus (16 − 8) × √(2/4) ≈ 5.66 safety stock.
        expect(forecastLevels(product(), forecast)).toEqual({ reorderLevel: 10, target: 18, expected: 8 });
        // No supplier lead time: one week.
        expect(forecastLevels(product({ lead_time_days: null }), forecast).reorderLevel).toBe(6);
        expect(forecastLevels(product(), undefined)).toBeNull();
    });

    test("reorders up to the forecast target when stock falls to the forecast level", () => {
        const forecasts = new Map([[1, forecast]]);
        const [group] = reorderSuggestions([product({ stock: 6 })], new Map(), forecasts);
        expect(group.items[0]).toMatchObject({ reorder_level: 10, quantity: 12, forecast_units: 8, basis: "forecast" });
        expect(reorderSuggestions([product({ stock: 11 })], new Map(), forecasts)).toEqual([]);
    });

    test("includes products without a reorder point once they have a forecast", () => {
        const forecasts = new Map([[1, forecast]]);
        expect(reorderSuggestions([product({ reorder_point: 0, stock: 0 })])).toEqual([]);
        expect(reorderSuggestions([product({ reorder_point: 0, stock: 0 })], new Map(), forecasts)).toHaveLength(1);
    });

    test("keeps the manual reorder point as a minimum", () => {
        const forecasts = new Map([[1, forecast]]);
        const [group] = reorderSuggestions([product({ reorder_point: 20, stock: 15 })], new Map(), forecasts);
        expect(group.items[0]).toMatchObject({ reorder_level: 20, quantity: 45, basis: "reorder_point" });
    });
});
