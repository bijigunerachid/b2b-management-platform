jest.mock("../config/database", () => ({}));

const { fillMonths } = require("../controllers/dashboardController");

describe("fillMonths", () => {
    test("returns six months oldest first, filling gaps with zeros", () => {
        const result = fillMonths(
            [
                { month: "2026-08", orders: 3, revenue: "1500.50" },
                { month: "2026-10", orders: 1, revenue: 0 }
            ],
            new Date(2026, 9, 15)
        );

        expect(result.map((m) => m.month)).toEqual([
            "2026-05",
            "2026-06",
            "2026-07",
            "2026-08",
            "2026-09",
            "2026-10"
        ]);
        expect(result[3]).toEqual({ month: "2026-08", orders: 3, revenue: 1500.5 });
        expect(result[4]).toEqual({ month: "2026-09", orders: 0, revenue: 0 });
    });

    test("crosses year boundaries", () => {
        const result = fillMonths([], new Date(2027, 1, 1));

        expect(result[0].month).toBe("2026-09");
        expect(result[5].month).toBe("2027-02");
    });
});
