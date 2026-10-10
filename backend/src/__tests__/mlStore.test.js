const { fillWeeks, listModels, loadActiveForecasts, loadRiskScores, mondayOf } = require("../ml/mlStore");

describe("ML store", () => {
    test("mondayOf returns the Monday of the week in UTC", () => {
        expect(mondayOf(new Date("2026-10-11T23:00:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
        expect(mondayOf(new Date("2026-10-05T00:00:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
    });

    test("fillWeeks returns consecutive weeks ending at the last one, with zeros for gaps", () => {
        const weeks = fillWeeks([{ week: "2026-09-21", units: "4" }], new Date("2026-09-28T00:00:00Z"), 3);
        expect(weeks).toEqual([
            { week: "2026-09-14", units: 0 },
            { week: "2026-09-21", units: 4 },
            { week: "2026-09-28", units: 0 }
        ]);
    });

    test("returns empty results before the ML migration has run", async () => {
        const missing = Object.assign(new Error("Table 'ml_models' doesn't exist"), { code: "ER_NO_SUCH_TABLE" });
        const connection = { query: jest.fn().mockRejectedValue(missing) };
        await expect(listModels(connection)).resolves.toEqual([]);
        await expect(loadActiveForecasts(connection)).resolves.toEqual(new Map());
        await expect(loadRiskScores(connection)).resolves.toEqual(new Map());
    });

    test("risk scores come back as numbers with their facts parsed", async () => {
        const connection = {
            query: jest.fn().mockResolvedValue([[{ order_id: 12, probability: "0.7312", facts: '{"reasons":["history"],"late_invoices":4}' }]])
        };
        const scores = await loadRiskScores(connection);
        expect(scores.get(12)).toEqual({ probability: 0.7312, facts: { reasons: ["history"], late_invoices: 4 } });
    });

    test("parses JSON metrics stored as text (MariaDB) and hides details of old versions", async () => {
        const connection = {
            query: jest.fn().mockResolvedValue([[
                { id: 2, name: "demand_forecast", version: "b", trained_at: "t", is_active: 1, metrics: '{"wape":0.7}', details: '{"a":1}' },
                { id: 1, name: "demand_forecast", version: "a", trained_at: "t", is_active: 0, metrics: { wape: 0.8 }, details: '{"a":1}' }
            ]])
        };
        const models = await listModels(connection);
        expect(models[0]).toMatchObject({ is_active: true, metrics: { wape: 0.7 }, details: { a: 1 } });
        expect(models[1]).toMatchObject({ is_active: false, metrics: { wape: 0.8 }, details: null });
    });

    test("other database errors still fail loudly", async () => {
        const connection = { query: jest.fn().mockRejectedValue(new Error("connection lost")) };
        await expect(listModels(connection)).rejects.toThrow("connection lost");
    });
});

describe("recommendations", () => {
    const { loadRecommendations } = require("../ml/mlStore");

    test("names the product a recommendation comes from, and falls back to category popularity", async () => {
        const query = jest
            .fn()
            .mockResolvedValueOnce([[
                { rank_position: 1, reason: '{"type":"bought_with","product_id":7,"share":0.4}', id: 3, name: "Toner Cartridge Black", price: "120.00" },
                { rank_position: 2, reason: null, id: 4, name: "A4 Paper Pack Eco", price: "40.00" }
            ]])
            .mockResolvedValueOnce([[{ id: 7, name: "Laser Printer Duplex" }]]);
        const items = await loadRecommendations({ query }, 12);
        expect(items[0]).toMatchObject({ price: 120, reason: { type: "bought_with", product_id: 7, product_name: "Laser Printer Duplex", share: 0.4 } });
        expect(items[1].reason).toEqual({ type: "popular_in_category" });
    });

    test("is empty before the migration has run", async () => {
        const missing = Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
        await expect(loadRecommendations({ query: jest.fn().mockRejectedValue(missing) }, 1)).resolves.toEqual([]);
    });
});
