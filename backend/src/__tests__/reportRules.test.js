const { change, fillMonths, parseRange, previousRange, sqlBounds, summarize } = require("../reports/reportRules");
const { weightedAverageCost } = require("../purchasing/purchasingRules");

const now = new Date(Date.UTC(2026, 9, 9, 15));

describe("parseRange", () => {
    test("defaults to the last 90 days, today included", () => {
        expect(parseRange({}, now).value).toEqual({ from: "2026-07-12", to: "2026-10-09", days: 90 });
    });

    test("accepts an explicit range", () => {
        expect(parseRange({ from: "2026-01-01", to: "2026-01-31" }, now).value).toEqual({ from: "2026-01-01", to: "2026-01-31", days: 31 });
    });

    test.each([
        [{ from: "2026-02-30" }, /from must be a date/],
        [{ to: "09/10/2026" }, /to must be a date/],
        [{ from: "2026-05-02", to: "2026-05-01" }, /on or before/],
        [{ from: "2020-01-01", to: "2026-01-01" }, /three years/]
    ])("rejects %j", (query, message) => {
        expect(parseRange(query, now).error).toMatch(message);
    });
});

test("the previous period has the same length and ends the day before", () => {
    expect(previousRange({ from: "2026-07-12", to: "2026-10-09", days: 90 })).toEqual({ from: "2026-04-13", to: "2026-07-11", days: 90 });
});

test("SQL bounds include the whole last day", () => {
    expect(sqlBounds({ from: "2026-01-01", to: "2026-01-31" })).toEqual(["2026-01-01 00:00:00", "2026-02-01 00:00:00"]);
});

describe("summarize", () => {
    test("computes margin and margin percent", () => {
        expect(summarize({ orders: "3", units: "10", revenue: "1000.005", cost: "600", discounts: "12.5", returns: "0" })).toEqual({
            orders: 3, units: 10, revenue: 1000.01, cost: 600, margin: 400.01, margin_percent: 40, discounts: 12.5, returns: 0
        });
    });

    test("no revenue means no margin percent", () => {
        expect(summarize({}).margin_percent).toBeNull();
    });
});

test("change is null without a previous value", () => {
    expect(change(120, 100)).toBe(20);
    expect(change(80, 100)).toBe(-20);
    expect(change(50, 0)).toBeNull();
});

test("fillMonths covers every month in the range", () => {
    const months = fillMonths([{ id: "2026-09", revenue: 100, cost: 70 }], { from: "2026-07-15", to: "2026-10-02" });
    expect(months.map((m) => [m.month, m.revenue, m.margin])).toEqual([
        ["2026-07", 0, 0],
        ["2026-08", 0, 0],
        ["2026-09", 100, 30],
        ["2026-10", 0, 0]
    ]);
});

describe("weightedAverageCost", () => {
    test("blends the new delivery with stock on hand", () => {
        expect(weightedAverageCost({ stock: 10, averageCost: 50, quantity: 30, unitCost: 70 })).toBe(65);
    });

    test("an empty shelf or unknown cost takes the new cost", () => {
        expect(weightedAverageCost({ stock: 0, averageCost: 50, quantity: 5, unitCost: 70 })).toBe(70);
        expect(weightedAverageCost({ stock: 8, averageCost: null, quantity: 5, unitCost: 70.456 })).toBe(70.46);
    });
});
