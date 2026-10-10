const { fillWeeks, listModels, loadActiveForecasts, mondayOf } = require("../ml/mlStore");

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
